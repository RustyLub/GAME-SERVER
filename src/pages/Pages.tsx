import { lazy, Suspense, type ReactNode } from "react";

const AccountPanel = lazy(() => import("../AccountPanel"));

export const pageMeta: Record<string, { title: string; description: string }> = {
  "/": { title: "Rusty.Lub — EU Long | Rust Server", description: "Rusty.Lub EU Long — классический Rust Vanilla x1 в Европе. Сервер, вайпы и сообщество." },
  "/servers": { title: "Сервер — Rusty.Lub EU Long", description: "Параметры Rusty.Lub EU Long: Europe, Vanilla x1, процедурная карта, команды до 12 игроков." },
  "/wipes": { title: "Вайпы — Rusty.Lub EU Long", description: "Расписание ежемесячных вайпов Rusty.Lub EU Long." },
  "/rules": { title: "Правила — Rusty.Lub", description: "Правила честной игры и поведения в сообществе Rusty.Lub." },
  "/support": { title: "Поддержка — Rusty.Lub", description: "Ответы на вопросы и способы связаться с командой Rusty.Lub." },
  "/privacy": { title: "Политика конфиденциальности — Rusty.Lub", description: "Информация об обработке данных на сайте Rusty.Lub." },
  "/terms": { title: "Условия использования — Rusty.Lub", description: "Условия использования сайта и сервисов Rusty.Lub." },
  "/account": { title: "Личный кабинет — Rusty.Lub", description: "Вход через Steam, профиль игрока и VIP Queue Pass Rusty.Lub." },
  "/link": { title: "Привязка аккаунтов — Rusty.Lub", description: "Связь игровых и community-аккаунтов Rusty.Lub." },
  "/leaderboards": { title: "Рейтинг игроков — Rusty.Lub", description: "Рейтинг игроков Rusty.Lub EU Long." },
  "/store": { title: "Магазин — Rusty.Lub", description: "Информация о доступности магазина Rusty.Lub." },
  "/en": { title: "Rusty.Lub — EU Long | Rust Server", description: "Rusty.Lub EU Long — classic Rust Vanilla x1 in Europe. Server details, wipes and community." },
  "/en/servers": { title: "Server — Rusty.Lub EU Long", description: "Rusty.Lub EU Long server details: Europe, Vanilla x1, procedural map and teams of up to 12." },
  "/en/wipes": { title: "Wipes — Rusty.Lub EU Long", description: "Monthly wipe schedule for Rusty.Lub EU Long." },
  "/en/rules": { title: "Rules — Rusty.Lub", description: "Fair play and community rules for Rusty.Lub." },
  "/en/support": { title: "Support — Rusty.Lub", description: "Answers to common questions and ways to contact Rusty.Lub." },
  "/en/privacy": { title: "Privacy Policy — Rusty.Lub", description: "Information about data processing on the Rusty.Lub website." },
  "/en/terms": { title: "Terms of Use — Rusty.Lub", description: "Terms for using the Rusty.Lub website and services." },
  "/en/account": { title: "Player Account — Rusty.Lub", description: "Steam sign-in, player profile and VIP Queue Pass." },
  "/en/link": { title: "Account Linking — Rusty.Lub", description: "Link Steam and community accounts on Rusty.Lub." },
  "/en/leaderboards": { title: "Player Leaderboards — Rusty.Lub", description: "Rusty.Lub EU Long player rankings." },
  "/en/store": { title: "Store — Rusty.Lub", description: "Information about Rusty.Lub store availability." },
};
function PageTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: string }) {
  return <div className="section-heading page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p className="page-lead">{subtitle}</p>}</div></div>;
}
function Panel({ children }: { children: ReactNode }) { return <div className="server-card page-panel">{children}</div>; }
function DiscordLink() { return <a className="text-link" href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">ОТКРЫТЬ DISCORD ↗</a>; }

export function HomePage() {
 return <>
  <section className="hero"><div className="hero-image" /><div className="hero-shade" /><div className="hero-inner"><div className="kicker"><span /> RUSTY.LUB / EU LONG COMMUNITY SERVER</div><h1>ТВОЙ СЛЕДУЮЩИЙ<br /><em>WIPE.</em> ПОД ТВОИМ КОНТРОЛЕМ.</h1><p>Классический Rust без модифицированных рейтов. Собирай команду, строй базу и начинай новую историю на Rusty.Lub.</p><div className="hero-cta"><a className="btn btn-red" href="/servers">О СЕРВЕРЕ ↗</a><a className="btn btn-ghost" href="/wipes">РАСПИСАНИЕ ВАЙПОВ</a></div><div className="hero-meta"><span>EU LONG SERVER</span><span>VANILLA X1 / MONTHLY WIPE</span></div></div><div className="hero-vertical">SURVIVE / BUILD / DOMINATE</div></section>
  <section className="quick-stats"><div><small>РЕГИОН</small><strong>EUROPE</strong><span>Европейский сервер</span></div><div><small>РЕЖИМ</small><strong>VANILLA X1</strong><span>Классический Rust</span></div><div><small>КОМАНДА</small><strong>12 ИГРОКОВ</strong><span>Лимит группы</span></div><div><small>ВАЙП</small><strong>MONTHLY</strong><span>Первый четверг месяца</span></div></section>
  <section className="content-section"><div className="section-heading"><div><div className="eyebrow">RUSTY.LUB / EU LONG</div><h2>ОДИН СЕРВЕР.<br /><em>ЧИСТЫЙ RUST.</em></h2></div><div className="section-note">Без лишних модификаций. Только вы, ваша команда и остров.</div></div><div className="feature-grid"><div><small>01 / SERVER</small><strong>Параметры сервера</strong><span>Регион Europe, процедурная карта и стандартные рейты Vanilla x1.</span><a className="text-link" href="/servers">ПОДРОБНЕЕ ↗</a></div><div><small>02 / WIPE</small><strong>Понятный вайп</strong><span>Плановый вайп проходит в первый четверг месяца.</span><a className="text-link" href="/wipes">РАСПИСАНИЕ ↗</a></div><div><small>03 / COMMUNITY</small><strong>Сообщество</strong><span>Новости, объявления и помощь игрокам в Discord.</span><DiscordLink /></div></div></section>
 </>;
}
export function ServersPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="RUSTY.LUB / EU LONG" title={<>ОДИН СЕРВЕР.<br /><em>ЧИСТЫЙ RUST.</em></>} subtitle="Основные параметры и подключение к Rusty.Lub EU Long." /><Panel><div className="server-card-top"><div className="server-region"><span className="region-flag">EU</span><span>EUROPE</span><b>MONTHLY WIPE</b></div><span className="server-status">СТАТИСТИКА ОНЛАЙНА НЕ ПОДКЛЮЧЕНА</span></div><div className="server-main"><div className="server-title"><h2>Rusty.Lub EU Long</h2><p>CLASSIC SURVIVAL · PROCEDURAL MAP · VANILLA</p></div><div className="server-capacity"><strong>— <small>/ 200</small></strong><span>ИГРОКОВ ОНЛАЙН</span></div></div><div className="server-facts"><div><small>КАРТА</small><b>PROCEDURAL</b></div><div><small>РЕЙТЫ</small><b>VANILLA X1</b></div><div><small>ЛИМИТ ГРУППЫ</small><b>12 ИГРОКОВ</b></div><div><small>РЕГИОН</small><b>EUROPE</b></div></div><div className="server-details"><div className="server-address"><small>АДРЕС СЕРВЕРА</small><code>202.36.95.125:26227</code></div><a className="copy-button" href="steam://connect/202.36.95.125:26227">ПОДКЛЮЧИТЬСЯ ЧЕРЕЗ STEAM ↗</a><div className="server-connect-command"><small>КОМАНДА ДЛЯ КОНСОЛИ F1</small><code>client.connect 202.36.95.125:26227</code></div></div></Panel><p className="page-lead">Кланы и альянсы разрешены. Лимит одной команды — 12 игроков.</p></section>;
}
export function WipesPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="WIPE SCHEDULE / EU LONG" title={<>НОВЫЙ МЕСЯЦ.<br /><em>НОВАЯ ИСТОРИЯ.</em></>} subtitle="Расписание плановых вайпов Rusty.Lub EU Long." /><div className="wipe-panel"><div className="wipe-panel-top"><span>WIPE CALENDAR</span><span className="calendar-mark">EU / MSK</span></div><div className="wipe-date">ПЕРВЫЙ<strong>ЧЕТВЕРГ</strong><span>КАЖДОГО МЕСЯЦА</span></div><div className="wipe-panel-bottom"><span>MONTHLY WIPE</span><span>ТОЧНОЕ ВРЕМЯ — В DISCORD</span></div></div><p className="page-lead">Подтверждение ближайшего вайпа и точное время публикуются в Discord. Следи за официальными объявлениями сообщества.</p><DiscordLink /></section>;
}
export function RulesPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="FAIR PLAY / COMMUNITY" title={<>ПРАВИЛА <em>СООБЩЕСТВА.</em></>} subtitle="Базовые требования к честной игре и уважительному общению." /><div className="rule-row"><b>01</b><span>Честная игра</span><p>Запрещены читы и стороннее программное обеспечение, дающее нечестное преимущество.</p></div><div className="rule-row"><b>02</b><span>Уважение</span><p>Запрещены травля, угрозы и целенаправленные оскорбления участников сообщества.</p></div><div className="rule-row"><b>03</b><span>Команды и альянсы</span><p>Размер одной команды ограничен 12 игроками. Кланы и альянсы разрешены.</p></div><p className="page-lead">Актуальные объявления и решения администрации публикуются в официальном Discord.</p><DiscordLink /></section>;
}
export function SupportPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="HELP / SUPPORT" title={<>НУЖНА <em>ПОМОЩЬ?</em></>} subtitle="Ответы на частые вопросы и контакты сообщества." /><div className="faq-section"><details open><summary>Как подключиться к серверу?</summary><p>Открой консоль Rust клавишей F1 и введи <code>client.connect 202.36.95.125:26227</code>. Также можно подключиться через Steam по адресу сервера.</p></details><details><summary>Какие рейты и размер команды?</summary><p>Классические рейты Vanilla x1. Лимит одной команды — 12 игроков. Кланы и альянсы разрешены.</p></details><details><summary>Когда проходит вайп?</summary><p>Плановый вайп — в первый четверг каждого месяца. Точное время подтверждается в Discord.</p></details><details><summary>Как связаться с администрацией?</summary><p>Напиши в официальном Discord или на почту rusty.lub-slq@inbox.ru.</p></details></div><div className="contact-details"><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">DISCORD COMMUNITY ↗</a><a href="mailto:rusty.lub-slq@inbox.ru">RUSTY.LUB-SLQ@INBOX.RU ↗</a></div></section>;
}
export function PrivacyPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="LEGAL / PRIVACY" title={<>ПОЛИТИКА <em>КОНФИДЕНЦИАЛЬНОСТИ.</em></>} subtitle="Информация о данных, используемых сайтом Rusty.Lub." /><h3>1. Общие положения</h3><p className="page-lead">Сайт Rusty.Lub предоставляет информацию о игровом сервере и сообществе. При использовании функций сайта могут обрабатываться технические данные и сведения профиля Steam, необходимые для авторизации и работы личного кабинета.</p><h3>2. Авторизация через Steam</h3><p className="page-lead">Вход выполняется через Steam OpenID. Сайт не запрашивает пароль Steam. Для идентификации аккаунта используется SteamID64 и доступные публичные данные профиля.</p><h3>3. Хранение и безопасность</h3><p className="page-lead">Данные аккаунта обрабатываются для предоставления функций личного кабинета. Не передавай третьим лицам ссылки входа и коды авторизации.</p><h3>4. Контакты</h3><p className="page-lead">Вопросы по обработке данных: rusty.lub-slq@inbox.ru.</p><p className="page-lead">Документ является базовой информационной редакцией и должен быть уточнён с учётом фактически включённых сервисов и применимых требований до коммерческого запуска.</p></section>;
}
export function TermsPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="LEGAL / TERMS" title={<>УСЛОВИЯ <em>ИСПОЛЬЗОВАНИЯ.</em></>} subtitle="Условия использования сайта Rusty.Lub." /><h3>1. Назначение сайта</h3><p className="page-lead">Сайт публикует информацию о Rusty.Lub EU Long, расписании вайпов и сообществе, а также предоставляет доступ к доступным функциям личного кабинета.</p><h3>2. Аккаунт</h3><p className="page-lead">Авторизация на сайте выполняется через Steam. Пользователь отвечает за безопасность своего Steam-аккаунта и соблюдение правил Steam.</p><h3>3. Игровой сервер</h3><p className="page-lead">Доступность сервера, расписание вайпов и игровые параметры могут изменяться. Актуальные объявления публикуются в официальном Discord.</p><h3>4. Обратная связь</h3><p className="page-lead">По вопросам использования сайта: rusty.lub-slq@inbox.ru.</p></section>;
}
export function AccountPage() {
 return <section className="account-band page-account"><div><div className="eyebrow">PLAYER ACCOUNT / RUSTY.LUB</div><h1>ТВОЙ ПРОГРЕСС.<br /><em>В ОДНОМ МЕСТЕ.</em></h1><p>Войди через Steam. При первом входе профиль Rusty.Lub создаётся автоматически. Других способов регистрации нет.</p></div><Suspense fallback={<div className="page-panel" role="status">ЗАГРУЗКА ЛИЧНОГО КАБИНЕТА…</div>}><AccountPanel /></Suspense></section>;
}
export function LinkPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="ACCOUNT LINKING" title={<>ПРИВЯЗКА <em>АККАУНТОВ.</em></>} subtitle="Раздел подготовлен для безопасной связи Steam и Discord." /><Panel><h2>ФУНКЦИЯ ЕЩЁ НЕ ПОДКЛЮЧЕНА</h2><p className="page-lead">Привязка появится после настройки серверной проверки Discord OAuth. Сейчас сайт не запрашивает Discord-токены и не создаёт фиктивную связь аккаунтов.</p><DiscordLink /></Panel></section>;
}
export function LeaderboardsPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="COMMUNITY / RANKING" title={<>РЕЙТИНГ <em>ИГРОКОВ.</em></>} subtitle="Таблица появится после подключения проверенного источника игровой статистики." /><Panel><h2>СТАТИСТИКА НЕ ПОДКЛЮЧЕНА</h2><p className="page-lead">Пока нет подтверждённого источника данных об игровом времени, убийствах и других показателях. Поэтому здесь не отображаются вымышленные рейтинги.</p></Panel></section>;
}
export function StorePage() {
 return <section className="content-section page-section"><PageTitle eyebrow="RUSTY.LUB / STORE" title={<>МАГАЗИН <em>СООБЩЕСТВА.</em></>} subtitle="Покупки и цифровые товары не открыты." /><Panel><h2>МАГАЗИН ПОКА НЕ ДОСТУПЕН</h2><p className="page-lead">Платёжная система и каталог товаров не активированы. Никакие платежи через эту страницу сейчас не принимаются. VIP Queue Pass отображается отдельно в личном кабинете и станет доступен только после подтверждения серверной платёжной интеграции.</p><a className="text-link" href="/account">ЛИЧНЫЙ КАБИНЕТ ↗</a></Panel></section>;
}
export function NotFoundPage() {
 return <section className="content-section page-section"><PageTitle eyebrow="ERROR / 404" title={<>СТРАНИЦА <em>НЕ НАЙДЕНА.</em></>} subtitle="Такого адреса нет на сайте Rusty.Lub." /><a className="btn btn-red" href="/">ВЕРНУТЬСЯ НА ГЛАВНУЮ</a></section>;
}
