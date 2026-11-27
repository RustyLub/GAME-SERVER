import { useEffect, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";
type ServerStatusResponse = { online: boolean; players?: number; maxPlayers?: number };

export default function ServerStatus({ language = "ru" }: { language?: "ru" | "en" }) {
  const en = language === "en";
  const [status, setStatus] = useState<ServerStatusResponse | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!apiBase) { if (active) setChecked(true); return; }
      try {
        const response = await fetch(apiBase + "/public/server-status", { cache: "no-store" });
        if (!response.ok) throw new Error("status unavailable");
        const data = await response.json() as ServerStatusResponse;
        if (active && typeof data.online === "boolean") setStatus(data);
      } catch { if (active) setStatus(null); }
      finally { if (active) setChecked(true); }
    };
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const label = status
    ? status.online ? (en ? "SERVER ONLINE" : "СЕРВЕР В СЕТИ") : (en ? "SERVER OFFLINE" : "СЕРВЕР НЕ В СЕТИ")
    : checked ? (en ? "STATUS UNAVAILABLE" : "СТАТУС НЕ ДОСТУПЕН") : (en ? "CHECKING STATUS" : "ПРОВЕРЯЕМ СТАТУС");
  return <span className={"server-live-status" + (status?.online ? " is-online" : status && !status.online ? " is-offline" : "")} role="status" aria-live="polite">
    <i aria-hidden="true" /><span>{label}</span>
    {status?.online && typeof status.players === "number" && typeof status.maxPlayers === "number" ? <b>{status.players}/{status.maxPlayers}</b> : null}
  </span>;
}
