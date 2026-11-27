import { useEffect, useState, type ReactNode } from "react";
import { SITE_CONFIG, isNoindexRoute } from "./config/site";
import {
  HomePage, ServersPage, ServerDetailsPage, WipesPage, RulesPage, SupportPage, PrivacyPage, CookiesPage, TermsPage,
  AccountPage, LinkPage, LeaderboardsPage, StorePage, NotFoundPage, pageMeta,
} from "./pages/Pages";
import {
  HomePageEn, ServersPageEn, ServerDetailsPageEn, WipesPageEn, RulesPageEn, SupportPageEn, PrivacyPageEn, CookiesPageEn,
  TermsPageEn, AccountPageEn, LinkPageEn, LeaderboardsPageEn, StorePageEn, NotFoundPageEn,
} from "./pages/EnglishPages";

const ruNav = [
  ["/servers", "Серверы"], ["/wipes", "Вайпы"], ["/rules", "Сообщество"],
  ["/support", "Поддержка"], ["/leaderboards", "Рейтинг"], ["/store", "Магазин"], ["/account", "Личный кабинет"],
] as const;
const enNav = [
  ["/servers", "Servers"], ["/wipes", "Wipes"], ["/rules", "Community"],
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
    const siteOrigin = ["https://rusty-lub.online", "https://rusty-lub.ru"].includes(window.location.origin)
      ? window.location.origin
      : "https://rusty-lub.online";
    const canonicalUrl = siteOrigin + (path === "/" ? "/" : path);
    const imageUrl = siteOrigin + (isEnglish ? "/og-en.png" : "/og-ru.png");
    const setMetaContent = (selector: string, content: string) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute("content", content);
    };
    setMetaContent('meta[name="description"]', meta.description);
    setMetaContent('link[rel="canonical"]', canonicalUrl);
    setMetaContent('meta[property="og:title"]', meta.title);
    setMetaContent('meta[property="og:description"]', meta.description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:image"]', imageUrl);
    setMetaContent('meta[property="og:locale"]', isEnglish ? "en_US" : "ru_RU");
    setMetaContent('meta[name="twitter:title"]', meta.title);
    setMetaContent('meta[name="twitter:description"]', meta.description);
    setMetaContent('meta[name="twitter:image"]', imageUrl);
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", pageMeta[path] && !isNoindexRoute(path) ? "index, follow" : "noindex, nofollow");
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
  const serverSlug = /^\/servers\/([a-z0-9-]+)$/.exec(routePath)?.[1];
  const configuredServer = serverSlug ? SITE_CONFIG.servers.find((server) => server.slug === serverSlug) : undefined;
  const dynamicServerPage = configuredServer
    ? isEnglish ? <ServerDetailsPageEn slug={configuredServer.slug} /> : <ServerDetailsPage slug={configuredServer.slug} />
    : null;
  const activePage = currentPages[routePath] ?? dynamicServerPage;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">{isEnglish ? "Skip to content" : "Перейти к содержимому"}</a>
    <div className="topline">
      <span><i className="live-dot" /> RUSTY.LUB NETWORK</span>
      <span className="topline-center">RUST SERVERS · COMMUNITY</span>
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
    <main id="main-content">{activePage || (isEnglish ? <NotFoundPageEn /> : <NotFoundPage />)}</main>
    <footer className="footer">
      <a className="logo" href={localize("/")}><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>RUST SERVER NETWORK</small></span></a>
      <span>RUSTY.LUB / RUST SERVER NETWORK</span>
      <span><a href={localize("/servers")}>{isEnglish ? "SERVERS" : "СЕРВЕРЫ"}</a> · <a href={localize("/wipes")}>{isEnglish ? "WIPES" : "ВАЙПЫ"}</a> · <a href={localize("/rules")}>{isEnglish ? "RULES" : "ПРАВИЛА"}</a> · <a href={localize("/support")}>{isEnglish ? "SUPPORT" : "ПОДДЕРЖКА"}</a> · <a href={localize("/link")}>{isEnglish ? "LINK ACCOUNTS" : "ПРИВЯЗКА"}</a> · <a href={localize("/leaderboards")}>{isEnglish ? "RANKING" : "РЕЙТИНГ"}</a> · <a href={localize("/store")}>{isEnglish ? "STORE" : "МАГАЗИН"}</a> · <a href={localize("/privacy")}>{isEnglish ? "PRIVACY" : "КОНФИДЕНЦИАЛЬНОСТЬ"}</a> · <a href={localize("/cookies")}>{isEnglish ? "COOKIES" : "COOKIES"}</a> · <a href={localize("/terms")}>{isEnglish ? "TERMS" : "УСЛОВИЯ"}</a> · <a href="mailto:rusty.lub-slq@inbox.ru">CONTACT</a> · © 2026 RUSTY.LUB</span>
    </footer>
  </div>;
}
export default App;
