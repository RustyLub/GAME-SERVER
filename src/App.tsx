import { useEffect, useState, type ReactNode } from "react";
import {
  HomePage, ServersPage, WipesPage, RulesPage, SupportPage, PrivacyPage, CookiesPage, TermsPage,
  AccountPage, LinkPage, LeaderboardsPage, StorePage, NotFoundPage, pageMeta,
} from "./pages/Pages";
import {
  HomePageEn, ServersPageEn, WipesPageEn, RulesPageEn, SupportPageEn, PrivacyPageEn, CookiesPageEn,
  TermsPageEn, AccountPageEn, LinkPageEn, LeaderboardsPageEn, StorePageEn, NotFoundPageEn,
} from "./pages/EnglishPages";

const ruNav = [
  ["/servers", "Сервер"], ["/wipes", "Вайпы"], ["/rules", "Правила"],
  ["/support", "Поддержка"], ["/leaderboards", "Рейтинг"], ["/store", "Магазин"], ["/account", "Личный кабинет"],
] as const;
const enNav = [
  ["/servers", "Server"], ["/wipes", "Wipes"], ["/rules", "Rules"],
  ["/support", "Support"], ["/leaderboards", "Leaderboard"], ["/store", "Store"], ["/account", "Account"],
] as const;

function App({ initialPath }: { initialPath?: string } = {}) {
  const getPath = () => initialPath ?? (typeof window !== "undefined" ? window.location.pathname.replace(/\/$/, "") || "/" : "/");
  const [path, setPath] = useState(getPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const isEnglish = path === "/en" || path.startsWith("/en/");
  const routePath = isEnglish ? path.slice(3) || "/" : path;
  const nav = isEnglish ? enNav : ruNav;
  const localize = (route: string) => isEnglish
    ? (route === "/" ? "/en" : "/en" + route)
    : route;
  const languageHref = isEnglish
    ? (routePath === "/" ? "/" : routePath)
    : (routePath === "/" ? "/en" : "/en" + routePath);

  useEffect(() => {
    const onPop = () => { setPath(window.location.pathname.replace(/\/$/, "") || "/"); setMenuOpen(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const meta = pageMeta[path] || {
      title: isEnglish ? "Page not found — Rusty.Lub" : "Страница не найдена — Rusty.Lub",
      description: isEnglish ? "The requested page could not be found." : "Запрошенная страница не найдена.",
    };
    document.documentElement.lang = isEnglish ? "en" : "ru";
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", meta.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://rusty-lub.online" + (path === "/" ? "/" : path));
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", pageMeta[path] ? "index, follow" : "noindex, nofollow");
  }, [path, isEnglish]);

  const ruPages: Record<string, ReactNode> = {
    "/": <HomePage />, "/servers": <ServersPage />, "/wipes": <WipesPage />,
    "/rules": <RulesPage />, "/support": <SupportPage />, "/privacy": <PrivacyPage />, "/cookies": <CookiesPage />,
    "/terms": <TermsPage />, "/account": <AccountPage />, "/link": <LinkPage />,
    "/leaderboards": <LeaderboardsPage />, "/store": <StorePage />,
  };
  const enPages: Record<string, ReactNode> = {
    "/": <HomePageEn />, "/servers": <ServersPageEn />, "/wipes": <WipesPageEn />,
    "/rules": <RulesPageEn />, "/support": <SupportPageEn />, "/privacy": <PrivacyPageEn />, "/cookies": <CookiesPageEn />,
    "/terms": <TermsPageEn />, "/account": <AccountPageEn />, "/link": <LinkPageEn />,
    "/leaderboards": <LeaderboardsPageEn />, "/store": <StorePageEn />,
  };
  const currentPages = isEnglish ? enPages : ruPages;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{isEnglish ? "Skip to content" : "Перейти к содержимому"}</a>
    <div className="topline">
      <span><i className="live-dot" /> RUSTY.LUB NETWORK</span>
      <span className="topline-center">EUROPE · CLASSIC RUST</span>
      <a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">{isEnglish ? "OUR DISCORD" : "НАШ DISCORD"} <b>↗</b></a>
    </div>
    <header className="header">
      <a className="logo" href={localize("/")} aria-label="Rusty.Lub — home">
        <span className="logo-symbol">R<span>.</span></span>
        <span className="logo-word">RUSTY<span>.LUB</span><small>RUST SERVER NETWORK</small></span>
      </a>
      <nav id="primary-navigation" className={"main-nav " + (menuOpen ? "nav-open" : "")} aria-label={isEnglish ? "Main navigation" : "Основная навигация"}>
        {nav.map(([url, label]) => <a key={url} href={localize(url)} aria-current={routePath === url ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <div className="header-actions">
        <a className="language-switch" href={languageHref} lang={isEnglish ? "ru" : "en"} aria-label={isEnglish ? "Switch to Russian" : "Switch to English"}>{isEnglish ? "RU" : "EN"}</a>
        <a className="login-button" href={localize("/account")}>{isEnglish ? "PLAYER ACCOUNT" : "ЛИЧНЫЙ КАБИНЕТ"} <span>↗</span></a>
      </div>
      <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? (isEnglish ? "Close menu" : "Закрыть меню") : (isEnglish ? "Open menu" : "Открыть меню")} aria-expanded={menuOpen} aria-controls="primary-navigation">{menuOpen ? "✕" : "☰"}</button>
    </header>
    <main id="main-content">{currentPages[routePath] || (isEnglish ? <NotFoundPageEn /> : <NotFoundPage />)}</main>
    <footer className="footer">
      <a className="logo" href={localize("/")}><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>EU LONG · RUST SERVER</small></span></a>
      <span>RUSTY.LUB / RUST SERVER NETWORK</span>
      <span><a href={localize("/servers")}>{isEnglish ? "SERVERS" : "СЕРВЕРЫ"}</a> · <a href={localize("/wipes")}>{isEnglish ? "WIPES" : "ВАЙПЫ"}</a> · <a href={localize("/rules")}>{isEnglish ? "RULES" : "ПРАВИЛА"}</a> · <a href={localize("/support")}>{isEnglish ? "SUPPORT" : "ПОДДЕРЖКА"}</a> · <a href={localize("/link")}>{isEnglish ? "LINK ACCOUNTS" : "ПРИВЯЗКА"}</a> · <a href={localize("/leaderboards")}>{isEnglish ? "RANKING" : "РЕЙТИНГ"}</a> · <a href={localize("/store")}>{isEnglish ? "STORE" : "МАГАЗИН"}</a> · <a href={localize("/privacy")}>{isEnglish ? "PRIVACY" : "КОНФИДЕНЦИАЛЬНОСТЬ"}</a> · <a href={localize("/cookies")}>{isEnglish ? "COOKIES" : "COOKIES"}</a> · <a href={localize("/terms")}>{isEnglish ? "TERMS" : "УСЛОВИЯ"}</a> · <a href="mailto:rusty.lub-slq@inbox.ru">CONTACT</a> · © 2026 RUSTY.LUB</span>
    </footer>
  </div>;
}
export default App;
