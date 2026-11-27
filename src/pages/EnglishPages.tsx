import { lazy, Suspense, type ReactNode } from "react";

const AccountPanel = lazy(() => import("../AccountPanel"));

const title = (eyebrow: string, heading: ReactNode, subtitle?: string) => (
  <div className="section-heading page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{heading}</h1>{subtitle && <p className="page-lead">{subtitle}</p>}</div></div>
);
const panel = (children: ReactNode) => <div className="server-card page-panel">{children}</div>;
const discord = <a className="text-link" href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">OPEN DISCORD ↗</a>;

export function HomePageEn() {
  return <>
    <section className="hero"><div className="hero-image" /><div className="hero-shade" /><div className="hero-inner">
      <div className="kicker"><span /> RUSTY.LUB / EU LONG COMMUNITY SERVER</div>
      <h1>YOUR NEXT<br /><em>WIPE.</em> UNDER YOUR CONTROL.</h1>
      <p>Classic Rust with original rates. Build your team, establish your base and start a new story on Rusty.Lub.</p>
      <div className="hero-cta"><a className="btn btn-red" href="/en/servers">ABOUT THE SERVER ↗</a><a className="btn btn-ghost" href="/en/wipes">WIPE SCHEDULE</a></div>
      <div className="hero-meta"><span>EU LONG SERVER</span><span>VANILLA X1 / MONTHLY WIPE</span></div>
    </div><div className="hero-vertical">SURVIVE / BUILD / DOMINATE</div></section>
    <section className="quick-stats"><div><small>REGION</small><strong>EUROPE</strong><span>European server</span></div><div><small>MODE</small><strong>VANILLA X1</strong><span>Classic Rust</span></div><div><small>TEAM</small><strong>12 PLAYERS</strong><span>Group limit</span></div><div><small>WIPE</small><strong>MONTHLY</strong><span>First Thursday</span></div></section>
    <section className="content-section"><div className="section-heading"><div><div className="eyebrow">RUSTY.LUB / EU LONG</div><h2>ONE SERVER.<br /><em>PURE RUST.</em></h2></div><div className="section-note">No unnecessary modifications. Just you, your team and the island.</div></div>
      <div className="feature-grid"><div><small>01 / SERVER</small><strong>Server details</strong><span>Europe region, procedural map and standard Vanilla x1 rates.</span><a className="text-link" href="/en/servers">LEARN MORE ↗</a></div><div><small>02 / WIPE</small><strong>Clear wipe schedule</strong><span>Monthly wipe on the first Thursday of the month.</span><a className="text-link" href="/en/wipes">SCHEDULE ↗</a></div><div><small>03 / COMMUNITY</small><strong>Community</strong><span>News, announcements and player support on Discord.</span>{discord}</div></div>
    </section>
  </>;
}
export function ServersPageEn() {
 return <section className="content-section page-section">{title("RUSTY.LUB / EU LONG",<>ONE SERVER.<br /><em>PURE RUST.</em></>,"Server information and connection details for Rusty.Lub EU Long.")}{panel(<>
  <div className="server-card-top"><div className="server-region"><span className="region-flag">EU</span><span>EUROPE</span><b>MONTHLY WIPE</b></div><span className="server-status">LIVE PLAYER COUNT NOT CONNECTED</span></div>
  <div className="server-main"><div className="server-title"><h2>Rusty.Lub EU Long</h2><p>CLASSIC SURVIVAL · PROCEDURAL MAP · VANILLA</p></div><div className="server-capacity"><strong>— <small>/ 200</small></strong><span>PLAYERS ONLINE</span></div></div>
  <div className="server-facts"><div><small>MAP</small><b>PROCEDURAL</b></div><div><small>RATES</small><b>VANILLA X1</b></div><div><small>TEAM LIMIT</small><b>12 PLAYERS</b></div><div><small>REGION</small><b>EUROPE</b></div></div>
  <div className="server-details"><div className="server-address"><small>SERVER ADDRESS</small><code>202.36.95.125:26227</code></div><a className="copy-button" href="steam://connect/202.36.95.125:26227">CONNECT THROUGH STEAM ↗</a><div className="server-connect-command"><small>F1 CONSOLE COMMAND</small><code>client.connect 202.36.95.125:26227</code></div></div>
 </>)}<p className="page-lead">Clans and alliances are allowed. The limit for a single team is 12 players.</p></section>;
}
export function WipesPageEn() {
 return <section className="content-section page-section">{title("WIPE SCHEDULE / EU LONG",<>NEW MONTH.<br /><em>NEW STORY.</em></>,"Monthly wipe schedule for Rusty.Lub EU Long.")}<div className="wipe-panel"><div className="wipe-panel-top"><span>WIPE CALENDAR</span><span className="calendar-mark">EU / MSK</span></div><div className="wipe-date">FIRST<strong>THURSDAY</strong><span>OF EVERY MONTH</span></div><div className="wipe-panel-bottom"><span>MONTHLY WIPE</span><span>EXACT TIME ON DISCORD</span></div></div><p className="page-lead">The next wipe date and exact start time are confirmed in Discord. Follow official community announcements.</p>{discord}</section>;
}
export function RulesPageEn() {
 return <section className="content-section page-section">{title("FAIR PLAY / COMMUNITY",<>COMMUNITY <em>RULES.</em></>,"Basic requirements for fair play and respectful communication.")}<div className="rule-row"><b>01</b><span>Fair play</span><p>Cheats and third-party software that provide an unfair advantage are prohibited.</p></div><div className="rule-row"><b>02</b><span>Respect</span><p>Harassment, threats and targeted abuse of community members are prohibited.</p></div><div className="rule-row"><b>03</b><span>Teams and alliances</span><p>A single team is limited to 12 players. Clans and alliances are allowed.</p></div><p className="page-lead">Official announcements and administration updates are published on Discord.</p>{discord}</section>;
}
export function SupportPageEn() {
 return <section className="content-section page-section">{title("HELP / SUPPORT",<>NEED <em>HELP?</em></>,"Answers to common questions and ways to contact the community.")}<div className="faq-section"><details open><summary>How do I connect to the server?</summary><p>Open the Rust console with F1 and enter <code>client.connect 202.36.95.125:26227</code>. You can also connect through Steam.</p></details><details><summary>What are the rates and team size?</summary><p>Classic Vanilla x1 rates. A single team is limited to 12 players. Clans and alliances are allowed.</p></details><details><summary>When does the wipe happen?</summary><p>The monthly wipe takes place on the first Thursday. The exact time is confirmed on Discord.</p></details><details><summary>How can I contact the admins?</summary><p>Message us on the official Discord or email rusty.lub-slq@inbox.ru.</p></details></div><div className="contact-details"><a href="https://discord.gg/rustylub" target="_blank" rel="noreferrer">DISCORD COMMUNITY ↗</a><a href="mailto:rusty.lub-slq@inbox.ru">RUSTY.LUB-SLQ@INBOX.RU ↗</a></div></section>;
}
export function PrivacyPageEn() {
 return <section className="content-section page-section">{title("LEGAL / PRIVACY",<>PRIVACY <em>POLICY.</em></>,"Information about data used by the Rusty.Lub website.")}<h3>1. General information</h3><p className="page-lead">The Rusty.Lub website provides information about the game server and community. When using website features, technical data and Steam profile details necessary for authentication and the account area may be processed.</p><h3>2. Steam authentication</h3><p className="page-lead">Sign-in uses Steam OpenID. The website does not request your Steam password. SteamID64 and publicly available profile data are used to identify the account.</p><h3>3. Storage and security</h3><p className="page-lead">Account data is processed to provide account features. Do not share sign-in links or authentication codes with third parties.</p><h3>4. Contact</h3><p className="page-lead">Questions about data processing: rusty.lub-slq@inbox.ru.</p><p className="page-lead">This is a basic informational version and must be reviewed against the services actually enabled and applicable requirements before commercial launch.</p></section>;
}
export function TermsPageEn() {
 return <section className="content-section page-section">{title("LEGAL / TERMS",<>TERMS OF <em>USE.</em></>,"Terms for using the Rusty.Lub website.")}<h3>1. Website purpose</h3><p className="page-lead">The website publishes information about Rusty.Lub EU Long, wipe schedules and the community, and provides access to available account features.</p><h3>2. Account</h3><p className="page-lead">Website authentication is provided through Steam. Users are responsible for their Steam account security and compliance with Steam rules.</p><h3>3. Game server</h3><p className="page-lead">Server availability, wipe schedules and game settings may change. Current announcements are published on the official Discord.</p><h3>4. Contact</h3><p className="page-lead">For website-related questions: rusty.lub-slq@inbox.ru.</p></section>;
}
export function AccountPageEn() {
 return <section className="account-band page-account"><div><div className="eyebrow">PLAYER ACCOUNT / RUSTY.LUB</div><h1>YOUR PROGRESS.<br /><em>IN ONE PLACE.</em></h1><p>Sign in through Steam. Your Rusty.Lub profile is created automatically on first sign-in. No other registration methods are available.</p></div><Suspense fallback={<div className="page-panel" role="status">LOADING ACCOUNT…</div>}><AccountPanel language="en" /></Suspense></section>;
}
export function LinkPageEn() {
 return <section className="content-section page-section">{title("ACCOUNT LINKING",<>LINK YOUR <em>ACCOUNTS.</em></>,"A planned secure connection between Steam and Discord.")}{panel(<><h2>NOT CONNECTED YET</h2><p className="page-lead">Account linking will be available after Discord OAuth verification is configured. The website does not request Discord tokens or create a fake account link.</p>{discord}</>)}</section>;
}
export function LeaderboardsPageEn() {
 return <section className="content-section page-section">{title("COMMUNITY / RANKING",<>PLAYER <em>LEADERBOARDS.</em></>,"The leaderboard will appear after a verified source of game statistics is connected.")}{panel(<><h2>STATISTICS NOT CONNECTED</h2><p className="page-lead">There is currently no verified source for playtime, kills or other player statistics. No fictional rankings are displayed.</p></>)}</section>;
}
export function StorePageEn() {
 return <section className="content-section page-section">{title("RUSTY.LUB / STORE",<>COMMUNITY <em>STORE.</em></>,"Purchases and digital products are not available.")}{panel(<><h2>STORE NOT AVAILABLE</h2><p className="page-lead">The payment system and product catalogue are not active. No payments are accepted on this page. VIP Queue Pass is shown separately in the account area and will only become available after the payment integration is verified.</p><a className="text-link" href="/en/account">PLAYER ACCOUNT ↗</a></>)}</section>;
}
export function NotFoundPageEn() {
 return <section className="content-section page-section">{title("ERROR / 404",<>PAGE <em>NOT FOUND.</em></>,"This address does not exist on the Rusty.Lub website.")}<a className="btn btn-red" href="/en">BACK TO HOME</a></section>;
}
