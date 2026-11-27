import { useMemo, useState } from "react";

type Tab = "all" | "monthly" | "vanilla";

const SERVER = {
  name: "Rusty.Lub EU Long",
  address: "202.36.95.125:26227",
  connect: "client.connect 202.36.95.125:26227",
  region: "EUROPE",
  mode: "VANILLA",
  rate: "x1",
  slots: 200,
  team: 12,
  wipe: "Первый четверг месяца",
};

function App() {
  const [tab, setTab] = useState<Tab>("all");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState("servers");

  const copyConnect = async () => {
    try {
      await navigator.clipboard.writeText(SERVER.connect);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = "steam://connect/202.36.95.125:26227";
    }
  };

  const sections = useMemo(() => [
    { id: "servers", label: "Серверы" },
    { id: "wipe", label: "Вайпы" },
    { id: "stats", label: "Статистика" },
    { id: "maps", label: "Карты" },
    { id: "store", label: "Магазин" },
    { id: "rules", label: "Правила" },
  ], []);

  return (
    <div className="app-shell">
      <div className="topline">
        <span><i className="live-dot" /> RUSTY.LUB NETWORK</span>
        <span className="topline-center">EUROPE · RUST COMMUNITY</span>
        <a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">DISCORD <b>↗</b></a>
      </div>

      <header className="header">
        <a className="logo" href="#home" aria-label="Rusty.Lub home">
          <span className="logo-symbol">R<span>.</span></span>
          <span className="logo-word">RUSTY<span>.LUB</span><small>GAME SERVERS</small></span>
        </a>
        <nav className="main-nav">
          {sections.map((item) => (
            <a key={item.id} className={activeSection === item.id ? "active" : ""} href={`#${item.id}`} onClick={() => setActiveSection(item.id)}>{item.label}</a>
          ))}
        </nav>
        <a className="login-button" href="#account">ВОЙТИ ЧЕРЕЗ STEAM <span>↗</span></a>
        <button className="mobile-menu" onClick={() => setExpanded(!expanded)} aria-label="Открыть меню">☰</button>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-image" />
          <div className="hero-shade" />
          <div className="hero-inner">
            <div className="kicker"><span /> OFFICIAL RUSTY.LUB SERVER</div>
            <h1>YOUR NEXT<br /><em>WIPE</em> STARTS HERE.</h1>
            <p>Чистый Rust. Честная игра. Твоё место в мире Rusty.Lub.</p>
            <div className="hero-cta">
              <button className="btn btn-red" onClick={copyConnect}>{copied ? "КОМАНДА СКОПИРОВАНА ✓" : "ПОДКЛЮЧИТЬСЯ К СЕРВЕРУ ↗"}</button>
              <a className="btn btn-ghost" href="#servers">ПОДРОБНЕЕ ↓</a>
            </div>
            <div className="hero-meta"><span><i className="live-dot" /> SERVER CONFIGURED</span><span>EUROPE / MONTHLY / VANILLA X1</span></div>
          </div>
          <div className="hero-vertical">SURVIVE&nbsp; / &nbsp;BUILD&nbsp; / &nbsp;DOMINATE</div>
        </section>

        <section className="quick-stats">
          <div><small>NETWORK</small><strong>EUROPE</strong><span>Европейский регион</span></div>
          <div><small>GAME MODE</small><strong>VANILLA X1</strong><span>Классический Rust</span></div>
          <div><small>TEAM LIMIT</small><strong>12 PLAYERS</strong><span>Максимум в команде</span></div>
          <div><small>WIPE CYCLE</small><strong>MONTHLY</strong><span>Первый четверг месяца</span></div>
        </section>

        <section className="content-section server-section" id="servers">
          <div className="section-heading">
            <div><div className="eyebrow">RUSTY.LUB / SERVERS</div><h2>НАШИ <em>СЕРВЕРЫ</em></h2></div>
            <div className="section-note">Выбери сервер и присоединяйся к игре.</div>
          </div>
          <div className="server-toolbar">
            <div className="tabs">
              <button className={tab === "all" ? "selected" : ""} onClick={() => setTab("all")}>ВСЕ СЕРВЕРЫ <b>01</b></button>
              <button className={tab === "monthly" ? "selected" : ""} onClick={() => setTab("monthly")}>MONTHLY</button>
              <button className={tab === "vanilla" ? "selected" : ""} onClick={() => setTab("vanilla")}>VANILLA</button>
            </div>
            <button className="expand-button" onClick={() => setExpanded(!expanded)}>{expanded ? "СВЕРНУТЬ −" : "РАЗВЕРНУТЬ +"}</button>
          </div>
          {(tab === "all" || tab === "monthly" || tab === "vanilla") && (
            <article className="server-card">
              <div className="server-card-top">
                <div className="server-region"><span className="region-flag">EU</span><span>EUROPE</span><b>MONTHLY WIPE</b></div>
                <span className="server-status"><i className="live-dot" /> STATUS DATA PENDING</span>
              </div>
              <div className="server-main">
                <div className="server-title"><h3>{SERVER.name}</h3><p>CLASSIC SURVIVAL · NO MODIFIED GATHER</p></div>
                <div className="server-capacity"><strong>— <small>/ {SERVER.slots}</small></strong><span>PLAYERS ONLINE</span></div>
              </div>
              <div className="server-facts">
                <div><small>MAP</small><b>PROCEDURAL</b></div>
                <div><small>GATHER RATE</small><b>{SERVER.rate.toUpperCase()}</b></div>
                <div><small>TEAM LIMIT</small><b>{SERVER.team}</b></div>
                <div><small>WIPE</small><b>MONTHLY</b></div>
              </div>
              {expanded && <div className="server-details">
                <div className="server-address"><small>SERVER ADDRESS</small><code>{SERVER.address}</code></div>
                <button className="copy-button" onClick={copyConnect}>{copied ? "СКОПИРОВАНО ✓" : "COPY CONNECT ↗"}</button>
                <div className="server-connect-command"><small>CONSOLE COMMAND</small><code>{SERVER.connect}</code></div>
              </div>}
              <div className="server-card-bottom"><span>WIPE: {SERVER.wipe.toUpperCase()}</span><a href="#wipe">WIPE DETAILS ↗</a></div>
            </article>
          )}
        </section>

        <section className="content-section split-section" id="wipe">
          <div><div className="eyebrow">WIPE SCHEDULE / EU LONG</div><h2>СЛЕДУЮЩИЙ<br /><em>WIPE.</em></h2><p>Плановый вайп проходит в первый четверг каждого месяца. Точное время и подтверждение даты будут публиковаться здесь.</p></div>
          <div className="wipe-panel"><div className="wipe-panel-top"><span>WIPE CALENDAR</span><span className="calendar-mark">01 / EU</span></div><div className="wipe-date">THURSDAY <strong>01<sup>ST</sup></strong></div><div className="wipe-panel-bottom"><span>EVERY MONTH</span><span>EUROPE / MOSCOW TIME</span></div></div>
        </section>

        <section className="content-section info-section" id="stats">
          <div className="section-heading"><div><div className="eyebrow">PLAYER DATA / COMMUNITY</div><h2>ИГРОВАЯ <em>СТАТИСТИКА</em></h2></div><span className="coming-label">DATA SOURCE NOT CONNECTED</span></div>
          <div className="placeholder-grid"><div><small>PLAYER PROFILES</small><strong>Профили игроков</strong><span>Steam-профили и история активности</span></div><div><small>LEADERBOARDS</small><strong>Таблица лидеров</strong><span>Рейтинг игроков текущего вайпа</span></div><div><small>SERVER HISTORY</small><strong>История сервера</strong><span>Онлайн и показатели по вайпам</span></div></div>
        </section>

        <section className="content-section map-section" id="maps">
          <div className="section-heading"><div><div className="eyebrow">WORLD / PROCEDURAL MAP</div><h2>МИР <em>RUSTY.LUB</em></h2></div><span className="coming-label">MAP DATA NOT CONNECTED</span></div>
          <div className="map-placeholder"><div className="map-cross">+</div><div><strong>PROCEDURAL WORLD</strong><span>Карта текущего вайпа появится после подключения источника данных.</span></div><span className="map-coordinates">EU / 01</span></div>
        </section>

        <section className="content-section store-section" id="store">
          <div className="store-copy"><div className="eyebrow">RUSTY.LUB / STORE</div><h2>ПРИОРИТЕТ<br /><em>В ОЧЕРЕДИ.</em></h2><p>Магазин будет оформлен по модели Rusticated: выбор сервера, услуга, срок действия и способ оплаты. Покупка пока не подключена.</p><a className="btn btn-red" href="#account">ПЕРЕЙТИ В МАГАЗИН ↗</a></div>
          <div className="product-card"><div className="product-tag">QUEUE PRIORITY</div><div className="product-icon">↗</div><h3>VIP QUEUE SKIP</h3><p>Приоритетное подключение к Rusty.Lub EU Long.</p><div className="product-price">SOON <small> / 30 DAYS</small></div><span className="disabled-buy">PURCHASE NOT CONNECTED</span></div>
        </section>

        <section className="content-section rules-section" id="rules">
          <div className="section-heading"><div><div className="eyebrow">FAIR PLAY / SERVER POLICY</div><h2>ПРАВИЛА <em>СЕРВЕРА</em></h2></div><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">ВОПРОСЫ? DISCORD ↗</a></div>
          <div className="rule-row"><b>01</b><span>Честная игра</span><p>Запрещены читы, макросы и использование стороннего ПО для получения преимущества.</p></div>
          <div className="rule-row"><b>02</b><span>Уважение</span><p>Запрещены угрозы, травля и дискриминация участников сообщества.</p></div>
          <div className="rule-row"><b>03</b><span>Командная игра</span><p>Максимальный размер команды — 12 игроков. Правила союзов уточняются администрацией.</p></div>
        </section>

        <section className="account-band" id="account"><div><div className="eyebrow">PLAYER ACCOUNT</div><h2>ТВОЙ ПРОГРЕСС.<br /><em>В ОДНОМ МЕСТЕ.</em></h2></div><div><p>Войди через Steam, чтобы управлять профилем и покупками. Авторизация будет включена после настройки Steam OpenID.</p><button className="btn btn-ghost" disabled>STEAM LOGIN — COMING SOON</button></div></section>
      </main>

      <footer className="footer"><a className="logo" href="#home"><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>GAME SERVERS</small></span></a><span>RUSTY.LUB EU LONG · VANILLA X1</span><span>© 2026 RUSTY.LUB</span></footer>
    </div>
  );
}

export default App;