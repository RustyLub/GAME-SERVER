import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

type SteamProfile = { displayName?: string; steamId?: string; avatarUrl?: string };
type VipConfig = { available: boolean; durationDays: number; priceRub: number | null };
type VipAccount = {
  entitlement: { status: string; expiresAt: string | null } | null;
  orders: { transactionId: string; amount: number; currency: string; status: string; createdAt: string | null }[];
};

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SteamProfile>({});
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [vipConfig, setVipConfig] = useState<VipConfig | null>(null);
  const [vipAccount, setVipAccount] = useState<VipAccount | null>(null);
  const [vipBusy, setVipBusy] = useState(false);
  const [vipError, setVipError] = useState("");
  const [vipNotice, setVipNotice] = useState("");

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      setError("Firebase пока не настроен.");
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
      setError("");
    }, () => {
      setChecking(false);
      setError("Не удалось проверить состояние авторизации.");
    });
  }, []);

  useEffect(() => {
    if (!apiBase) return;
    let active = true;
    fetch(apiBase + "/vip/config").then(async (response) => {
      if (!response.ok) throw new Error("VIP configuration unavailable");
      return response.json();
    }).then((data) => {
      if (active) setVipConfig({
        available: data.available === true,
        durationDays: Number(data.durationDays) || 7,
        priceRub: Number.isSafeInteger(data.priceRub) ? data.priceRub : null,
      });
    }).catch(() => {
      if (active) setVipConfig({ available: false, durationDays: 7, priceRub: null });
    });

    const params = new URLSearchParams(window.location.search);
    const vipResult = params.get("vip");
    if (vipResult === "return" || vipResult === "failed") {
      params.delete("vip");
      const query = params.toString();
      window.history.replaceState({}, document.title,
        window.location.pathname + (query ? "?" + query : "") + window.location.hash);
      setVipNotice(vipResult === "return"
        ? "Возврат с платёжной страницы получен. Это ещё не подтверждение оплаты — статус проверяется по уведомлению Platega."
        : "Платёж не был завершён. Если деньги списались, дождись проверки статуса Platega.");
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !apiBase) {
      setVipAccount(null);
      return;
    }
    let active = true;
    user.getIdToken().then((token) => fetch(apiBase + "/vip/me", {
      headers: { Authorization: "Bearer " + token },
    })).then(async (response) => {
      if (!response.ok) throw new Error("VIP account unavailable");
      return response.json();
    }).then((data) => {
      if (active) setVipAccount(data);
    }).catch(() => {
      if (active) setVipError("Не удалось загрузить состояние VIP и историю заказов.");
    });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!auth || !apiBase) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("steamCode");
    const steamError = params.get("steamError");
    if (!code && !steamError) return;
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    if (steamError) {
      setError(steamError === "verification_failed"
        ? "Steam не подтвердил вход. Попробуй авторизоваться ещё раз."
        : "Не удалось завершить вход через Steam.");
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
        throw new Error("Не удалось обменять одноразовый код Steam.");
      }
      if (!auth) throw new Error("Firebase пока не настроен.");
      await signInWithCustomToken(auth, payload.customToken);
      if (active) setMessage("Вход через Steam выполнен.");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Ошибка входа через Steam.");
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setProfile({});
      return;
    }
    let active = true;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const data = snapshot.data();
      setProfile({
        displayName: typeof data.displayName === "string" ? data.displayName : user.displayName || "Игрок Rusty.Lub",
        steamId: typeof data.steamId64 === "string" ? data.steamId64 : typeof data.steamId === "string" ? data.steamId : undefined,
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
      });
    }).catch(() => {
      if (active) setError("Не удалось загрузить Steam-профиль. Проверь доступ к Firestore.");
    });
    return () => { active = false; };
  }, [user]);

  function loginWithSteam() {
    if (!apiBase) {
      setError("Steam-вход пока не подключён: сервер авторизации ещё не развёрнут.");
      return;
    }
    setBusy(true);
    setError("");
    window.location.assign(apiBase + "/auth/steam");
  }

  async function buyVip() {
    if (!user || !apiBase || !vipConfig?.available) return;
    setVipBusy(true);
    setVipError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(apiBase + "/vip/order", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.redirect !== "string") {
        throw new Error(response.status === 503
          ? "Оплата VIP ещё не настроена на сервере."
          : "Не удалось создать платёж. Попробуй позже.");
      }
      const paymentUrl = new URL(payload.redirect);
      if (paymentUrl.protocol !== "https:") throw new Error("Получена небезопасная платёжная ссылка.");
      window.location.assign(paymentUrl.toString());
    } catch (cause) {
      setVipError(cause instanceof Error ? cause.message : "Ошибка создания заказа.");
      setVipBusy(false);
    }
  }

  async function logout() {
    if (!auth) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signOut(auth);
      setProfile({});
      setVipAccount(null);
      setMessage("Ты вышел из аккаунта.");
    } catch {
      setError("Не удалось завершить сеанс. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  function formatVipDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  }

  function vipStatusLabel(status: string) {
    if (status === "pending_delivery") return "Оплата подтверждена · ожидает выдачи на сервере";
    if (status === "active") return "VIP активен";
    if (status === "review_required") return "Требуется проверка платежа";
    if (status === "confirmed") return "Оплата подтверждена";
    if (status === "pending") return "Ожидает оплаты";
    if (status === "canceled") return "Отменён";
    if (status === "disputed") return "Платёж на проверке";
    if (status === "chargebacked") return "Возврат платежа";
    if (status === "partially_refunded") return "Частичный возврат · проверка";
    return status;
  }

  if (checking || busy) {
    return <div className="account-panel">
      <p role="status">{busy ? "Завершаем вход через Steam…" : "Проверяем состояние аккаунта…"}</p>
      {error && <p className="form-message form-error" role="alert">{error}</p>}
    </div>;
  }

  if (user) return (
    <div className="account-panel">
      <div className="account-profile">
        {profile.avatarUrl
          ? <img className="account-avatar-image" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
          : <span className="account-avatar">{(profile.displayName || user.displayName || "R").slice(0, 1).toUpperCase()}</span>}
        <div>
          <small>STEAM АККАУНТ ПОДКЛЮЧЁН</small>
          <strong>{profile.displayName || user.displayName || "Игрок Rusty.Lub"}</strong>
          <span>{profile.steamId ? "SteamID64: " + profile.steamId : "Steam-профиль подтверждён"}</span>
        </div>
      </div>
      <div className="account-profile-meta"><span>FIREBASE UID</span><code>{user.uid}</code></div>

      <section className="vip-shop" aria-label="VIP Queue Pass">
        <div className="vip-shop-top"><span>RUSTY.LUB / QUEUE ACCESS</span><b>{vipConfig?.durationDays || 7} DAYS</b></div>
        <h3>VIP QUEUE PASS</h3>
        <p>Пропуск очереди на Rusty.Lub EU Long. Проходка привязывается к подтверждённому SteamID64 и действует 7 дней после выдачи. Discord для активации не требуется.</p>
        <div className="vip-shop-price">
          {vipConfig?.available && vipConfig.priceRub !== null
            ? <><strong>{vipConfig.priceRub.toLocaleString("ru-RU")} ₽</strong><span>за 7 дней</span></>
            : <span>ОПЛАТА ПОКА НЕ ПОДКЛЮЧЕНА</span>}
        </div>
        <button className="btn btn-red" type="button" onClick={buyVip} disabled={!vipConfig?.available || vipBusy}>
          {vipBusy ? "СОЗДАЁМ ЗАКАЗ…" : "КУПИТЬ VIP ↗"}
        </button>
        {!vipConfig?.available && <small className="vip-shop-note">Покупка станет доступна после настройки Platega на защищённом сервере. Деньги сейчас не списываются.</small>}
        {vipNotice && <p className="vip-info-message" role="status">{vipNotice}</p>}
        {vipError && <p className="form-message form-error" role="alert">{vipError}</p>}
        {vipAccount?.entitlement && <div className="vip-entitlement">
          <small>ТЕКУЩАЯ ПРОХОДКА</small>
          <strong>{vipStatusLabel(vipAccount.entitlement.status)}</strong>
          <span>Действует до: {formatVipDate(vipAccount.entitlement.expiresAt)}</span>
        </div>}
        {vipAccount?.orders?.length ? <div className="vip-history">
          <small>ИСТОРИЯ ПЛАТЕЖЕЙ</small>
          {vipAccount.orders.map((order) => <div className="vip-history-row" key={order.transactionId}>
            <span>{formatVipDate(order.createdAt)}</span>
            <b>{order.amount.toLocaleString("ru-RU")} {order.currency}</b>
            <em>{vipStatusLabel(order.status)}</em>
          </div>)}
        </div> : null}
      </section>

      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={logout} disabled={busy}>ВЫЙТИ ИЗ АККАУНТА</button>
    </div>
  );

  return (
    <div className="account-panel">
      <div className="steam-login-mark" aria-hidden="true">STEAM</div>
      <h3 className="steam-login-title">ТВОЙ STEAM. ТВОЙ ПРОФИЛЬ.</h3>
      <p className="steam-login-copy">Войди через официальный аккаунт Steam. Если ты здесь впервые, профиль Rusty.Lub создастся автоматически после подтверждения входа.</p>
      <button className="btn btn-steam" type="button" onClick={loginWithSteam} disabled={busy || !apiBase}>
        {busy ? "ПЕРЕХОД К STEAM…" : "ВОЙТИ ЧЕРЕЗ STEAM ↗"}
      </button>
      {!apiBase && <p className="account-disclaimer">Steam-авторизация будет доступна после развёртывания защищённого сервера входа. Других способов регистрации на сайте не будет.</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-disclaimer">Сайт не запрашивает и не хранит пароль от Steam. Авторизация проходит на стороне Steam.</p>
    </div>
  );
}
