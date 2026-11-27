const servers = [
  { id: "eu-long", slug: "eu-long", name: "Rusty.Lub EU Long", host: "202.36.95.125", port: 26227, address: "202.36.95.125:26227", maxPlayers: 200, region: "Europe", map: "Procedural", rates: "Vanilla x1", teamLimit: 12, wipe: "Monthly", statusAvailable: true },
] as const;

export const NOINDEX_ROUTES = [
  "/account", "/link", "/leaderboards", "/store",
  "/en/account", "/en/link", "/en/leaderboards", "/en/store",
] as const;

export function isNoindexRoute(path: string): boolean {
  return (NOINDEX_ROUTES as readonly string[]).includes(path);
}

export const SITE_CONFIG = {
  servers,
  server: servers[0],
  wipe: { timezone: "Europe/Moscow", summerMonths: [4, 5, 6, 7, 8, 9, 10], summerHour: 21, winterHour: 22, weekday: 4 },
} as const;

export function getNextWipe(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SITE_CONFIG.wipe.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  let year = part("year");
  let month = part("month");
  const currentDay = part("day");
  const firstThursday = (targetYear: number, targetMonth: number) => {
    const firstDay = new Date(Date.UTC(targetYear, targetMonth - 1, 1)).getUTCDay();
    return 1 + ((SITE_CONFIG.wipe.weekday - firstDay + 7) % 7);
  };
  const scheduledHour = (targetMonth: number) => (SITE_CONFIG.wipe.summerMonths as readonly number[]).includes(targetMonth) ? SITE_CONFIG.wipe.summerHour : SITE_CONFIG.wipe.winterHour;
  let day = firstThursday(year, month);
  const hour = scheduledHour(month);
  const scheduledUtc = Date.UTC(year, month - 1, day, hour - 3, 0, 0);
  if (currentDay > day || (currentDay === day && now.getTime() >= scheduledUtc)) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    day = firstThursday(year, month);
  }
  return { date: new Date(Date.UTC(year, month - 1, day)), hour: scheduledHour(month), timezone: SITE_CONFIG.wipe.timezone };
}

export function formatNextWipe(locale: "ru-RU" | "en-GB" = "ru-RU") {
  const wipe = getNextWipe();
  return {
    date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(wipe.date),
    time: String(wipe.hour).padStart(2, "0") + ":00 MSK",
  };
}
