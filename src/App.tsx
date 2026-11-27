import { useEffect, useState, type FormEvent } from "react";
import { isFirebaseConfigured } from "./lib/firebase";

const SERVER = {
  name: "Rusty.Lub EU Long",
  address: "202.36.95.125:26227",
  connect: "client.connect 202.36.95.125:26227",
  slots: 200,
  team: 12,
};

const navigation = [
  ["servers", "Сервер"],
  ["wipe", "Вайп"],
  ["features", "Особенности"],
  ["rules", "Правила"],
  ["faq", "FAQ"],
  ["contact", "Контакты"],
] as const;

function App() {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [formError, setFormError] = useState("");
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  async function copyConnect() {
    try {
      await navigator.clipboard.writeText(SERVER.connect);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = "steam://connect/202.36.95.125:26227";
    }
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || form.message.trim().length < 10) {
      setFormError("Заполни имя, укажи корректную почту и напиши сообщение не короче 10 символов.");
      setFormReady(false);
      return;
    }
    setFormError("");
    setFormReady(true);
    const subject = encodeURIComponent("Сообщение с сайта Rusty.Lub");
    const body = encodeURIComponent("Имя: " + form.name + "\nEmail: " + form.email + "\n\n" + form.message);
    window.location.href = "mailto:rusty.lub-slq@inbox.ru?subject=" + subject + "&body=" + body;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>
      <div className="topline">
        <span><i className="live-dot" /> RUSTY.LUB COMMUNITY</span>
        <span className="topline-center">EUROPE · CLASSIC RUST</span>
        <a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">НАШ DISCORD <b>↗</b></a>
      </div>

      <header className="header">
        <a className="logo" href="#home" aria-label="Rusty.Lub — главная">
          <span className="logo-symbol">R<span>.</span></span>
          <span className="logo-word">RUSTY<span>.LUB</span><small>EU LONG · RUST SERVER</small></span>
        </a>
        <nav id="primary-navigation" className={"main-nav " + (menuOpen ? "nav-open" : "")} aria-label="Основная навигация">
          {navigation.map(([id, label]) => <a key={id} href={"#" + id} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
        <button className="login-button" type="button" disabled title="Steam OpenID будет подключён на следующем этапе">ЛИЧНЫЙ КАБИНЕТ <span>↗</span></button>
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} aria-controls="primary-navigation">{menuOpen ? "✕" : "☰"}</button>
      </header>

      <main id="main-content">
        <section className="hero">
          <div className="hero-image" />
          <div className="hero-shade" />
          <div className="hero-inner">
            <div className="kicker"><span /> RUSTY.LUB / EU LONG COMMUNITY SERVER</div>
            <h1>ТВОЙ СЛЕДУЮЩИЙ<br /><em>WIPE.</em> ПОД ТВОИМ КОНТРОЛЕМ.</h1>
            <p>Классический Rust без модифицированных рейтов. Собирай команду, строй базу и начинай новую историю на Rusty.Lub.</p>
            <div className="hero-cta">
              <button className="btn btn-red" type="button" onClick={copyConnect}>{copied ? "КОМАНДА СКОПИРОВАНА ✓" : "СКОПИРОВАТЬ КОМАНДУ ↗"}</button>
              <a className="btn btn-ghost" href="#servers">О СЕРВЕРЕ ↓</a>
            </div>
            <div className="hero-meta"><span><i className="live-dot" /> EU LONG SERVER</span><span>VANILLA X1 / MONTHLY WIPE</span></div>
          </div>
          <div className="hero-vertical">SURVIVE&nbsp; / &nbsp;BUILD&nbsp; / &nbsp;DOMINATE</div>
        </section>

        <section className="quick-stats" aria-label="Параметры сервера">
          <div><small>РЕГИОН</small><strong>EUROPE</strong><span>Европейский сервер</span></div>
          <div><small>РЕЖИМ</small><strong>VANILLA X1</strong><span>Классический Rust</span></div>
          <div><small>КОМАНДА</small><strong>12 ИГРОКОВ</strong><span>Лимит группы</span></div>
          <div><small>ВАЙП</small><strong>MONTHLY</strong><span>Первый четверг месяца</span></div>
        </section>

        <section className="content-section server-section" id="servers">
          <div className="section-heading">
            <div><div className="eyebrow">RUSTY.LUB / EU LONG</div><h2>ОДИН СЕРВЕР.<br /><em>ЧИСТЫЙ RUST.</em></h2></div>
            <div className="section-note">Без лишних модификаций. Только вы, ваша команда и остров.</div>
          </div>
          <article className="server-card">
            <div className="server-card-top">
              <div className="server-region"><span className="region-flag">EU</span><span>EUROPE</span><b>MONTHLY WIPE</b></div>
              <span className="server-status"><i className="status-neutral" /> ДАННЫЕ ОНЛАЙНЕ НЕ ПОДКЛЮЧЕНЫ</span>
            </div>
            <div className="server-main">
              <div className="server-title"><h3>{SERVER.name}</h3><p>CLASSIC SURVIVAL · PROCEDURAL MAP · VANILLA</p></div>
              <div className="server-capacity"><strong>— <small>/ {SERVER.slots}</small></strong><span>ИГРОКОВ ОНЛАЙН</span></div>
            </div>
            <div className="server-facts">
              <div><small>КАРТА</small><b>PROCEDURAL</b></div>
              <div><small>РЕЙТЫ</small><b>VANILLA X1</b></div>
              <div><small>ЛИМИТ ГРУППЫ</small><b>{SERVER.team} ИГРОКОВ</b></div>
              <div><small>РЕГИОН</small><b>EUROPE</b></div>
            </div>
            <div className="server-details">
              <div className="server-address"><small>АДРЕС СЕРВЕРА</small><code>{SERVER.address}</code></div>
              <button className="copy-button" type="button" onClick={copyConnect}>{copied ? "СКОПИРОВАНО ✓" : "КОПИРОВАТЬ КОМАНДУ ↗"}</button>
              <div className="server-connect-command"><small>КОМАНДА ДЛЯ КОНСОЛИ F1</small><code>{SERVER.connect}</code></div>
            </div>
            <div className="server-card-bottom"><span>ЕЖЕМЕСЯЧНЫЙ ВАЙП · ПЕРВЫЙ ЧЕТВЕРГ</span><a href="#wipe">РАСПИСАНИЕ ВАЙПОВ ↗</a></div>
          </article>
        </section>

        <section className="content-section split-section" id="wipe">
          <div><div className="eyebrow">WIPE SCHEDULE / EU LONG</div><h2>НОВЫЙ МЕСЯЦ.<br /><em>НОВАЯ ИСТОРИЯ.</em></h2><p>Плановый вайп проходит в первый четверг каждого месяца. Время и подтверждение ближайшего вайпа публикуются в Discord — следи за объявлениями сообщества.</p><a className="text-link" href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">СЛЕДИТЬ ЗА ОБЪЯВЛЕНИЯМИ ↗</a></div>
          <div className="wipe-panel"><div className="wipe-panel-top"><span>WIPE CALENDAR</span><span className="calendar-mark">EU / MSK</span></div><div className="wipe-date">ПЕРВЫЙ <strong>ЧЕТВЕРГ</strong><span>КАЖДОГО МЕСЯЦА</span></div><div className="wipe-panel-bottom"><span>MONTHLY WIPE</span><span>ТОЧНОЕ ВРЕМЯ — В DISCORD</span></div></div>
        </section>

        <section className="content-section info-section" id="features">
          <div className="section-heading"><div><div className="eyebrow">WHY RUSTY.LUB</div><h2>ТВОЯ ИГРА.<br /><em>ТВОИ УСЛОВИЯ.</em></h2></div></div>
          <div className="feature-grid">
            <div><small>01 / VANILLA</small><strong>Классический Rust</strong><span>Стандартные рейты x1 без ускоренной добычи и лишних модификаций.</span></div>
            <div><small>02 / COMMUNITY</small><strong>Играйте вместе</strong><span>Команды до 12 игроков. Кланы и альянсы разрешены.</span></div>
            <div><small>03 / MONTHLY</small><strong>Понятный вайп</strong><span>Новый цикл каждый первый четверг месяца.</span></div>
          </div>
        </section>

        <section className="content-section rules-section" id="rules">
          <div className="section-heading"><div><div className="eyebrow">FAIR PLAY / COMMUNITY</div><h2>ОСНОВЫ <em>ПРАВИЛ.</em></h2></div><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">ПОЛНЫЕ ОБЪЯВЛЕНИЯ — DISCORD ↗</a></div>
          <div className="rule-row"><b>01</b><span>Честная игра</span><p>Запрещены читы и стороннее ПО, дающее нечестное преимущество.</p></div>
          <div className="rule-row"><b>02</b><span>Уважение</span><p>Не превращай общение в травлю, угрозы и оскорбления участников сообщества.</p></div>
          <div className="rule-row"><b>03</b><span>Команды и альянсы</span><p>Размер команды ограничен 12 игроками. Кланы и альянсы разрешены.</p></div>
        </section>

        <section className="content-section faq-section" id="faq">
          <div className="section-heading"><div><div className="eyebrow">HELP / FAQ</div><h2>ЧАСТЫЕ <em>ВОПРОСЫ.</em></h2></div></div>
          <details><summary>Как подключиться к серверу?</summary><p>Открой консоль Rust клавишей F1 и введи <code>{SERVER.connect}</code>. Кнопка на сайте скопирует команду, а если буфер обмена недоступен — откроет подключение через Steam.</p></details>
          <details><summary>Какие рейты и размер команды?</summary><p>Сервер работает на классических рейтах Vanilla x1. Лимит команды — 12 игроков. Кланы и альянсы разрешены.</p></details>
          <details><summary>Когда проходит вайп?</summary><p>Плановый вайп — в первый четверг каждого месяца. Точное время публикуется в Discord.</p></details>
          <details><summary>Где узнать новости и задать вопрос?</summary><p>В официальном Discord-сообществе: <a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">discord.gg/rustylub</a>.</p></details>
        </section>

        <section className="account-band" id="account">
          <div><div className="eyebrow">PLAYER ACCOUNT / IN DEVELOPMENT</div><h2>ТВОЙ ПРОГРЕСС.<br /><em>В ОДНОМ МЕСТЕ.</em></h2></div>
          <div><p>Личный кабинет, Steam-авторизация и история покупок появятся после подключения отдельного Firebase-проекта и серверной авторизации. Сейчас эти функции не активны.</p><button className="btn btn-ghost" type="button" disabled>STEAM LOGIN — В РАЗРАБОТКЕ</button><small className="firebase-note">{isFirebaseConfigured ? "Firebase-конфигурация обнаружена." : "Firebase ожидает настройки отдельного проекта GAME-SERVER."}</small></div>
        </section>

        <section className="content-section contact-section" id="contact">
          <div className="section-heading"><div><div className="eyebrow">CONTACT / SUPPORT</div><h2>ЕСТЬ <em>ВОПРОС?</em></h2></div><div className="section-note">Напиши нам — разберёмся.</div></div>
          <div className="contact-layout">
            <div className="contact-details"><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">DISCORD COMMUNITY ↗</a><a href="mailto:rusty.lub-slq@inbox.ru">RUSTY.LUB-SLQ@INBOX.RU ↗</a><span>Форма подготовит письмо и откроет его в твоём почтовом приложении. Автоматическая отправка пока не подключена.</span></div>
            <form className="contact-form" onSubmit={submitContact} noValidate>
              <label>ИМЯ<input autoComplete="name" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Как к тебе обращаться?" /></label>
              <label>EMAIL<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="name@example.com" /></label>
              <label>СООБЩЕНИЕ<textarea value={form.message} onChange={e => setForm({...form,message:e.target.value})} placeholder="Опиши свой вопрос..." rows={4} /></label>
              {formError && <p className="form-message form-error" role="alert">{formError}</p>}
              {formReady && <p className="form-message" role="status">Почтовое приложение должно открыться с подготовленным сообщением.</p>}
              <button className="btn btn-red" type="submit">ПОДГОТОВИТЬ СООБЩЕНИЕ ↗</button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer"><a className="logo" href="#home"><span className="logo-symbol">R<span>.</span></span><span className="logo-word">RUSTY<span>.LUB</span><small>EU LONG · RUST SERVER</small></span></a><span>RUSTY.LUB EU LONG · VANILLA X1</span><span><a href="mailto:rusty.lub-slq@inbox.ru">CONTACT</a> · © 2026 RUSTY.LUB</span></footer>
    </div>
  );
}

export default App;
