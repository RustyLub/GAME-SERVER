using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Oxide.Core;
using Oxide.Core.Libraries;

namespace Oxide.Plugins
{
    [Info("RustyLubVipQueue", "Rusty.Lub", "1.0.0")]
    [Description("Processes verified Rusty.Lub VIP queue grants and expirations from the trusted backend.")]
    public class RustyLubVipQueue : RustPlugin
    {
        private PluginConfig _config;
        private Oxide.Core.Libraries.Timer _pollTimer;
        private bool _polling;
        private readonly HashSet<string> _processing = new HashSet<string>();

        private class PluginConfig
        {
            public string ApiBaseUrl = "https://YOUR-BACKEND-DOMAIN";
            public string SharedSecret = "";
            public int PollIntervalSeconds = 15;
        }

        private class JobResponse
        {
            public List<VipJob> jobs = new List<VipJob>();
        }

        private class VipJob
        {
            public string id;
            public string type;
            public string steamId64;
            public string leaseToken;
        }

        private class AckPayload
        {
            public string type;
            public string id;
            public string leaseToken;
            public bool success;
            public string message;
        }

        protected override void LoadDefaultConfig()
        {
            _config = new PluginConfig();
            SaveConfig();
        }

        protected override void LoadConfig()
        {
            base.LoadConfig();
            try
            {
                _config = Config.ReadObject<PluginConfig>();
                if (_config == null) throw new Exception("Config was empty");
            }
            catch
            {
                PrintWarning("Invalid configuration. Writing default settings.");
                LoadDefaultConfig();
            }
        }

        protected override void SaveConfig()
        {
            Config.WriteObject(_config, true);
        }

        private void OnServerInitialized()
        {
            if (string.IsNullOrWhiteSpace(_config.ApiBaseUrl) ||
                _config.ApiBaseUrl.Contains("YOUR-BACKEND-DOMAIN") ||
                !Uri.TryCreate(_config.ApiBaseUrl, UriKind.Absolute, out var apiUri) ||
                apiUri.Scheme != Uri.UriSchemeHttps)
            {
                PrintError("Set ApiBaseUrl to the deployed HTTPS backend URL in carbon/config/RustyLubVipQueue.json.");
                return;
            }

            if (string.IsNullOrWhiteSpace(_config.SharedSecret))
            {
                PrintError("SharedSecret is empty. VIP queue delivery is disabled until it matches CARBON_SYNC_SECRET on the backend.");
                return;
            }

            var interval = Math.Max(10, Math.Min(300, _config.PollIntervalSeconds));
            _pollTimer = timer.Every(interval, PollQueue);
            timer.Once(3f, PollQueue);
            Puts("VIP queue bridge started. Poll interval: " + interval + " seconds.");
        }

        private void Unload()
        {
            _pollTimer?.Destroy();
            _processing.Clear();
        }

        private Dictionary<string, string> RequestHeaders()
        {
            return new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer " + _config.SharedSecret
            };
        }

        private bool IsValidSteamId64(string value)
        {
            if (string.IsNullOrEmpty(value) || value.Length != 17) return false;
            for (var i = 0; i < value.Length; i++)
            {
                if (value[i] < '0' || value[i] > '9') return false;
            }

            if (!ulong.TryParse(value, out var id)) return false;
            return id >= 76561197960265728UL && id <= 76561202255233023UL;
        }

        private void PollQueue()
        {
            if (_polling) return;
            _polling = true;
            var url = _config.ApiBaseUrl.TrimEnd('/') + "/internal/carbon/jobs";
            webrequest.Enqueue(url, null, (code, response) =>
            {
                _polling = false;
                if (code != 200 || string.IsNullOrEmpty(response))
                {
                    if (code != 204) PrintWarning("VIP queue poll failed: HTTP " + code);
                    return;
                }

                try
                {
                    var result = JsonConvert.DeserializeObject<JobResponse>(response);
                    if (result?.jobs == null) return;
                    foreach (var job in result.jobs)
                    {
                        if (job == null || string.IsNullOrEmpty(job.id) || string.IsNullOrEmpty(job.leaseToken)) continue;
                        var key = job.type + ":" + job.id;
                        if (_processing.Contains(key)) continue;
                        _processing.Add(key);
                        ProcessJob(job, key);
                    }
                }
                catch (Exception ex)
                {
                    PrintError("Could not parse VIP queue response: " + ex.Message);
                }
            }, this, RequestMethod.GET, RequestHeaders(), 15f);
        }

        private void ProcessJob(VipJob job, string processingKey)
        {
            if (!IsValidSteamId64(job.steamId64))
            {
                SendAcknowledgement(job, processingKey, false, "Invalid SteamID64 rejected by Carbon plugin.");
                return;
            }

            try
            {
                if (job.type == "grant")
                {
                    ConsoleSystem.Run(ConsoleSystem.Option.Server,
                        "global.skipqueueid " + job.steamId64 + " \"Rusty.Lub VIP\" \"7-day pass\"");
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "server.writecfg");
                }
                else if (job.type == "expire")
                {
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "global.removeskipqueue " + job.steamId64);
                    ConsoleSystem.Run(ConsoleSystem.Option.Server, "server.writecfg");
                }
                else
                {
                    SendAcknowledgement(job, processingKey, false, "Unsupported VIP job type.");
                    return;
                }

                SendAcknowledgement(job, processingKey, true, "Rust server command submitted.");
            }
            catch (Exception ex)
            {
                SendAcknowledgement(job, processingKey, false, ex.Message);
            }
        }

        private void SendAcknowledgement(VipJob job, string processingKey, bool success, string message)
        {
            var payload = new AckPayload
            {
                type = job.type,
                id = job.id,
                leaseToken = job.leaseToken,
                success = success,
                message = message
            };
            var body = JsonConvert.SerializeObject(payload);
            var url = _config.ApiBaseUrl.TrimEnd('/') + "/internal/carbon/ack";
            webrequest.Enqueue(url, body, (code, response) =>
            {
                _processing.Remove(processingKey);
                if (code != 200)
                {
                    PrintWarning("VIP job acknowledgement failed: HTTP " + code + ". The backend lease will expire and retry the job.");
                    return;
                }

                if (success) Puts("VIP " + job.type + " command submitted for SteamID64 " + job.steamId64 + ".");
                else PrintWarning("VIP job failed for " + job.steamId64 + ": " + message);
            }, this, RequestMethod.POST, new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer " + _config.SharedSecret,
                ["Content-Type"] = "application/json"
            }, 15f);
        }
    }
}
