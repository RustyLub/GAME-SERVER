import { useEffect, useState } from "react";
import { HomePage, ServersPage, WipesPage, RulesPage, SupportPage, PrivacyPage, TermsPage, AccountPage, LinkPage, LeaderboardsPage, StorePage, NotFoundPage, pageMeta } from "./pages/Pages";

const nav = [
  ["/servers", "Сервер"], ["/wipes", "Вайпы"], ["/rules", "Правила"],
  ["/support", "Поддержка"], ["/account", "Личный кабинет"],
] as const;

function App() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/$/, "") || "/");
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onPop = () => { setPath(window.location.pathname.replace(/\/$/, "") || "/"); setMenuOpen(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const meta = pageMeta[path] || { title: "Страница не найдена — Rusty.Lub", description: "Запрошенная страница не найдена." };
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", meta.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://rusty-lub.online" + (path === "/" ? "/" : path));
  }, [path]);
  const pages: Record<string, React.ReactNode> = {
    "/": <HomePage />, "/servers": <ServersPage />, "/wipes": <WipesPage />,
    "/rules": <RulesPage />, "/support": <SupportPage />, "/privacy": <PrivacyPage />,
    "/terms": <TermsPage />, "/account": <AccountPage />, "/link": <LinkPage />,
    "/leaderboards": <LeaderboardsPage />, "/store": <StorePage />,
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <div className="topline"><span><i className="live-dot" /> RUSTY.LUB COMMUNITY</span><span className="topline-center">EUROPE · CLASSIC RUST</span><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">НАШ DISCORD <b>↗</b></a></div>
    <header className="header">
      <a className="logo" href="/" aria-label="Rusty.Lub — главная"><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>EU LONG · RUST SERVER</small></span></a>
      <nav id="primary-navigation" className={"main-nav " + (menuOpen ? "nav-open" : "")} aria-label="Основная навигация">
        {nav.map(([url,label]) => <a key={url} href={url} aria-current={path===url ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <a className="login-button" href="/account">ЛИЧНЫЙ КАБИНЕТ <span>↗</span></a>
      <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} aria-controls="primary-navigation">{menuOpen ? "✕" : "☰"}</button>
    </header>
    <main id="main-content">{pages[path] || <NotFoundPage />}</main>
    <footer className="footer"><a className="logo" href="/"><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>EU LONG · RUST SERVER</small></span></a><span>RUSTY.LUB EU LONG · VANILLA X1</span><span><a href="/privacy">КОНФИДЕНЦИАЛЬНОСТЬ</a> · <a href="/terms">УСЛОВИЯ</a> · <a href="mailto:rusty.lub-slq@inbox.ru">CONTACT</a> · © 2026 RUSTY.LUB</span></footer>
  </div>;
}
export default App;
