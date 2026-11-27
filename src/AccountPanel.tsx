import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where } from "firebase/firestore/lite";
import { auth, db } from "./lib/firebase";

type SteamProfile = { displayName?: string; steamId?: string; avatarUrl?: string; customDisplayName?: string; discordId?: string; discordUsername?: string; discordAvatarUrl?: string };
type OrderRow = { id: string; status?: string; amount?: number; currency?: string; createdAt?: { toDate?: () => Date } };
type VipConfig = { enabled: boolean; price: number | null; currency: string; durationDays: number };
type VipEntitlement = { id: string; status: string; expiresAt: string | null };
function statusLabel(status: string | undefined, english: boolean) {
  const labels: Record<string, [string, string]> = {
    creating: ["Создаётся", "Creating"], pending: ["Ожидает оплаты", "Awaiting payment"],
    paid: ["Оплачен", "Paid"], canceled: ["Отменён", "Canceled"], expired: ["Истёк", "Expired"],
    refunded: ["Возвращён", "Refunded"], partially_refunded: ["Частичный возврат", "Partially refunded"],
    disputed: ["Оспаривается", "Disputed"], chargebacked: ["Оспорен банком", "Charged back"],
    creation_failed: ["Ошибка создания", "Creation failed"], active: ["Активен", "Active"],
    grant_pending: ["Выдаётся", "Grant pending"], revoke_pending: ["Снимается", "Revocation pending"],
    suspended: ["Приостановлен", "Suspended"], revoked: ["Отозван", "Revoked"],
  };
  const pair = labels[status || ""];
  return pair ? pair[english ? 1 : 0] : status || "—";
}

const apiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";

export default function AccountPanel({ language = "ru" }: { language?: "ru" | "en" }) {
  const en = language === "en";
  const t = (ru: string, english: string) => en ? english : ru;
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SteamProfile>({});
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [vipConfig, setVipConfig] = useState<VipConfig | null>(null);
  const [vipEntitlement, setVipEntitlement] = useState<VipEntitlement | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!apiBase) return;
    let active = true;
    fetch(apiBase + "/vip/config", { cache: "no-store" }).then((response) => response.json())
      .then((data: VipConfig) => { if (active) setVipConfig(data); })
      .catch(() => { if (active) setVipConfig(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      setError(t("Firebase пока не настроен для этого сайта.", "Firebase has not been configured for this website yet."));
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
      setError("");
    }, () => {
      setChecking(false);
      setError(t("Не удалось проверить состояние авторизации.", "Could not check the sign-in status."));
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("discordLinked") === "1") setMessage(t("Discord успешно привязан.", "Discord account linked successfully."));
    if (params.get("payment") === "success") setMessage(t("Вернулся со страницы оплаты. Ожидаем подтверждение Platega — возврат на сайт сам по себе не означает оплату.", "Returned from checkout. Waiting for Platega confirmation — the redirect itself does not mean the payment succeeded."));
    if (params.get("payment") === "failed") setError(t("Оплата не завершена. Новый платёж можно создать из личного кабинета.", "Payment was not completed. You can start a new checkout from your account."));
    const discordError = params.get("discordError");
    if (discordError) setError(t("Не удалось привязать Discord. Проверь настройки OAuth или используй другой Discord-аккаунт.", "Could not link Discord. Check OAuth settings or use another Discord account."));
    if (params.has("discordLinked") || params.has("discordError") || params.has("payment")) {
      params.delete("discordLinked"); params.delete("discordError"); params.delete("payment");
      window.history.replaceState({}, document.title, window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash);
    }
  }, []);

  useEffect(() => {
    if (!auth || !apiBase) return;
    const firebaseAuth = auth;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("steamCode");
    const steamError = params.get("steamError");
    if (!code && !steamError) return;

    params.delete("steamCode");
    params.delete("steamError");
    const query = params.toString();
    window.history.replaceState({}, document.title,
      window.location.pathname + (query ? "?" + query : "") + window.location.hash);

    if (steamError) {
      setError(steamError === "verification_failed"
        ? t("Steam не подтвердил вход. Попробуй авторизоваться ещё раз.", "Steam did not verify the sign-in. Please try again.")
        : t("Не удалось завершить вход через Steam.", "Could not complete Steam sign-in."));
      return;
    }
    if (!code) return;

    let active = true;
    setBusy(true);
    setError("");
    fetch(apiBase + "/auth/steam/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.customToken !== "string") {
        throw new Error(t("Не удалось обменять одноразовый код Steam.", "Could not exchange the one-time Steam code."));
      }
      await signInWithCustomToken(firebaseAuth, payload.customToken);
      if (active) setMessage(t("Вход через Steam выполнен.", "Signed in through Steam."));
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : t("Ошибка входа через Steam.", "Steam sign-in error."));
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setProfile({}); setOrders([]); setVipEntitlement(null);
      return;
    }
    let active = true;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const data = snapshot.data();
      setProfile({
        displayName: typeof data.displayName === "string" ? data.displayName : user.displayName || t("Игрок Rusty.Lub", "Rusty.Lub player"),
        steamId: typeof data.steamId64 === "string" ? data.steamId64 : undefined,
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
        customDisplayName: typeof data.customDisplayName === "string" ? data.customDisplayName : "",
        discordId: typeof data.discordId === "string" ? data.discordId : undefined,
        discordUsername: typeof data.discordUsername === "string" ? data.discordUsername : undefined,
        discordAvatarUrl: typeof data.discordAvatarUrl === "string" ? data.discordAvatarUrl : undefined,
      });
      setCustomDisplayName(typeof data.customDisplayName === "string" ? data.customDisplayName : "");
    }).catch(() => {
      if (active) setError(t("Не удалось загрузить Steam-профиль. Проверь доступ к Firestore.", "Could not load the Steam profile. Check Firestore access."));
    });
    getDocs(query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(10)))
      .then((snapshot) => { if (active) setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OrderRow))); })
      .catch(() => { if (active) setOrders([]); });
    user.getIdToken().then((token) => fetch(apiBase + "/vip/me", { headers: { Authorization: "Bearer " + token } }))
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active) setVipEntitlement(data?.entitlement || null); })
      .catch(() => { if (active) setVipEntitlement(null); });
    return () => { active = false; };
  }, [user]);

  function loginWithSteam() {
    if (!apiBase) {
      setError(t("Steam-вход пока не подключён: сервер авторизации ещё не развёрнут.", "Steam sign-in is not connected yet: the authentication server has not been deployed."));
      return;
    }
    if (!auth) {
      setError(t("Firebase пока не настроен для этого сайта.", "Firebase has not been configured for this website yet."));
      return;
    }
    setBusy(true);
    setError("");
    window.location.assign(apiBase + "/auth/steam?origin=" + encodeURIComponent(window.location.origin));
  }

  async function linkDiscord() {
    if (!auth?.currentUser || !apiBase) return;
    setBusy(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const form = document.createElement("form");
      form.method = "POST";
      form.action = apiBase + "/auth/discord/start";
      const field = document.createElement("input");
      field.type = "hidden";
      field.name = "idToken";
      field.value = token;
      form.appendChild(field);
      document.body.appendChild(form);
      form.submit();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Не удалось начать привязку Discord.", "Could not start Discord linking."));
      setBusy(false);
    }
  }

  async function unlinkDiscord() {
    if (!auth?.currentUser || !apiBase) return;
    setBusy(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(apiBase + "/auth/discord/unlink", { method: "POST", headers: { Authorization: "Bearer " + token } });
      if (!response.ok) throw new Error("Could not unlink Discord.");
      setProfile((current) => ({ ...current, discordId: undefined, discordUsername: undefined, discordAvatarUrl: undefined }));
      setMessage(t("Discord отвязан.", "Discord account unlinked."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Discord unlink failed."); }
    finally { setBusy(false); }
  }

  async function purchaseVip() {
    if (!auth?.currentUser || !apiBase) return;
    setBusy(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(apiBase + "/payments/orders", {
        method: "POST", credentials: "include",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: window.crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.redirectUrl !== "string") {
        const errors: Record<string, string> = {
          vip_checkout_not_configured: t("Магазин ещё не настроен.", "Store is not configured yet."),
          vip_already_active: t("У тебя уже действует VIP Queue Pass.", "You already have an active VIP Queue Pass."),
          payment_already_pending: t("У тебя уже есть незавершённый платёж.", "You already have a pending payment."),
        };
        throw new Error(errors[payload.error] || t("Не удалось создать платёж.", "Could not create payment."));
      }
      window.location.assign(payload.redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Ошибка создания платежа.", "Payment creation failed."));
      setBusy(false);
    }
  }

  async function saveDisplayName() {
    if (!user || !db) return;
    const value = customDisplayName.trim();
    if (value.length < 2 || value.length > 24) { setError(t("Имя должно содержать от 2 до 24 символов.", "Name must contain 2 to 24 characters.")); return; }
    setBusy(true); setError("");
    try {
      await updateDoc(doc(db, "users", user.uid), { customDisplayName: value });
      setProfile((current) => ({ ...current, customDisplayName: value }));
      setMessage(t("Имя профиля сохранено.", "Profile name saved."));
    } catch { setError(t("Не удалось сохранить имя профиля.", "Could not save profile name.")); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!auth) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signOut(auth);
      setProfile({});
      setMessage(t("Ты вышел из аккаунта.", "You have signed out."));
    } catch {
      setError(t("Не удалось завершить сеанс. Попробуй ещё раз.", "Could not end the session. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (checking || busy) {
    return <div className="account-panel">
      <p role="status">{busy ? t("Выполняем действие…", "Working…") : t("Проверяем состояние аккаунта…", "Checking account status…")}</p>
      {error && <p className="form-message form-error" role="alert">{error}</p>}
    </div>;
  }

  if (user) return (
    <div className="account-panel">
      <div className="account-profile">
        {profile.avatarUrl
          ? <img className="account-avatar-image" src={profile.avatarUrl} alt={t("Аватар Steam игрока", "Steam player avatar")} loading="lazy" decoding="async" width="88" height="88" referrerPolicy="no-referrer" />
          : <span className="account-avatar">{(profile.displayName || user.displayName || "R").slice(0, 1).toUpperCase()}</span>}
        <div>
          <small>{t("STEAM АККАУНТ ПОДКЛЮЧЁН", "STEAM ACCOUNT CONNECTED")}</small>
          <strong>{profile.customDisplayName || profile.displayName || user.displayName || t("Игрок Rusty.Lub", "Rusty.Lub player")}</strong>
          <span>{profile.steamId ? "SteamID64: " + profile.steamId : t("Steam-профиль подтверждён", "Steam profile verified")}</span>
        </div>
      </div>
      <div className="account-profile-meta"><span>FIREBASE UID</span><code>{user.uid}</code></div>
      <div className="account-edit-name"><label htmlFor="profile-name">{t("ИМЯ В ПРОФИЛЕ", "PROFILE DISPLAY NAME")}</label><input id="profile-name" maxLength={24} value={customDisplayName} onChange={(event) => setCustomDisplayName(event.target.value)} /><button className="btn btn-ghost" type="button" onClick={saveDisplayName} disabled={busy}>{t("СОХРАНИТЬ ИМЯ", "SAVE NAME")}</button></div>
      <div className="account-linked-service"><div><small>{t("DISCORD", "DISCORD")}</small><strong>{profile.discordUsername || t("Не привязан", "Not linked")}</strong>{profile.discordId && <span>Discord ID: {profile.discordId}</span>}</div>{profile.discordId ? <button className="btn btn-ghost" type="button" onClick={unlinkDiscord} disabled={busy}>{t("ОТВЯЗАТЬ", "UNLINK")}</button> : <button className="btn btn-ghost" type="button" onClick={linkDiscord} disabled={busy || !apiBase}>{t("ПРИВЯЗАТЬ DISCORD", "LINK DISCORD")}</button>}</div>
      <section className="account-vip"><small>{t("RUSTY.LUB STORE", "RUSTY.LUB STORE")}</small><h3>VIP QUEUE PASS · 7 {t("ДНЕЙ", "DAYS")}</h3><p>{t("Штатное право пропуска очереди Rust. Без предметов, повышенных рейтов и игровых плагинов. Свободный слот не гарантируется.", "Native Rust queue-skip permission. No items, boosted rates or game plugins. A free slot is not guaranteed.")}</p>{vipEntitlement?.status === "active" && vipEntitlement.expiresAt ? <p className="vip-entitlement-status">{t("АКТИВЕН ДО", "ACTIVE UNTIL")} {new Date(vipEntitlement.expiresAt).toLocaleString(en ? "en-GB" : "ru-RU")}</p> : vipEntitlement && !["expired", "revoked"].includes(vipEntitlement.status) ? <p className="vip-entitlement-status">{t("СТАТУС ПРОПУСКА", "PASS STATUS")}: {statusLabel(vipEntitlement.status, en)}</p> : null}{vipConfig?.enabled ? <button className="btn btn-red" type="button" onClick={purchaseVip} disabled={busy || vipEntitlement?.status === "active"}>{t("КУПИТЬ ЗА", "BUY FOR")} {vipConfig.price} {vipConfig.currency}</button> : <p className="account-disclaimer">{t("Покупка будет доступна после настройки Platega, RCON и серверных секретов.", "Checkout will be available after Platega, RCON and server secrets are configured.")}</p>}</section>
      <section className="account-orders"><small>{t("ИСТОРИЯ ЗАКАЗОВ", "ORDER HISTORY")}</small>{orders.length ? orders.map((order) => <div className="account-order" key={order.id}><span>#{order.id.slice(0, 10)}</span><b>{order.amount != null ? order.amount + " " + (order.currency || "RUB") : "—"}</b><em>{statusLabel(order.status, en)}</em>{order.createdAt?.toDate && <time>{order.createdAt.toDate().toLocaleDateString(en ? "en-GB" : "ru-RU")}</time>}</div>) : <p>{t("Заказов пока нет.", "No orders yet.")}</p>}</section>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={logout}>{t("ВЫЙТИ ИЗ АККАУНТА", "SIGN OUT")}</button>
    </div>
  );

  return (
    <div className="account-panel">
      <div className="steam-login-mark" aria-hidden="true">STEAM</div>
      <h3 className="steam-login-title">{t("ТВОЙ STEAM. ТВОЙ ПРОФИЛЬ.", "YOUR STEAM. YOUR PROFILE.")}</h3>
      <p className="steam-login-copy">{t("Войди через официальный аккаунт Steam. Если ты здесь впервые, профиль Rusty.Lub создастся автоматически после подтверждения входа.", "Sign in with your official Steam account. If this is your first visit, your Rusty.Lub profile will be created automatically after verification.")}</p>
      <button className="btn btn-steam" type="button" onClick={loginWithSteam} disabled={!apiBase || !auth}>
        {t("ВОЙТИ ЧЕРЕЗ STEAM ↗", "SIGN IN WITH STEAM ↗")}
      </button>
      {(!apiBase || !auth) && <p className="account-disclaimer">{t("Для входа нужны настроенный Firebase Web App и развёрнутый защищённый сервер авторизации. Других способов регистрации не будет.", "Sign-in requires a configured Firebase Web App and a deployed secure authentication server. No other registration methods will be offered.")}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-disclaimer">{t("Сайт не запрашивает и не хранит пароль от Steam. Авторизация проходит на стороне Steam.", "This website never asks for or stores your Steam password. Authentication takes place on Steam.")}</p>
    </div>
  );
}
