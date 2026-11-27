import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

type SteamProfile = { displayName?: string; steamId?: string; avatarUrl?: string };
const apiBase = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "";

export default function AccountPanel({ language = "ru" }: { language?: "ru" | "en" }) {
  const en = language === "en";
  const t = (ru: string, english: string) => en ? english : ru;
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SteamProfile>({});
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
    if (!auth || !apiBase) return;
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
      await signInWithCustomToken(auth, payload.customToken);
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
      setProfile({});
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
      });
    }).catch(() => {
      if (active) setError(t("Не удалось загрузить Steam-профиль. Проверь доступ к Firestore.", "Could not load the Steam profile. Check Firestore access."));
    });
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
    window.location.assign(apiBase + "/auth/steam");
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
      <p role="status">{busy ? t("Завершаем вход через Steam…", "Completing Steam sign-in…") : t("Проверяем состояние аккаунта…", "Checking account status…")}</p>
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
          <small>{t("STEAM АККАУНТ ПОДКЛЮЧЁН", "STEAM ACCOUNT CONNECTED")}</small>
          <strong>{profile.displayName || user.displayName || t("Игрок Rusty.Lub", "Rusty.Lub player")}</strong>
          <span>{profile.steamId ? "SteamID64: " + profile.steamId : t("Steam-профиль подтверждён", "Steam profile verified")}</span>
        </div>
      </div>
      <div className="account-profile-meta"><span>FIREBASE UID</span><code>{user.uid}</code></div>
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
