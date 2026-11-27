import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithCustomToken, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

type SteamProfile = { displayName?: string; steamId?: string; avatarUrl?: string };
const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SteamProfile>({});
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!auth) { setChecking(false); setError("Firebase пока не настроен."); return; }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setChecking(false);
      setError("");
    }, () => { setChecking(false); setError("Не удалось проверить состояние авторизации."); });
  }, []);

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
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || !db) { setProfile({}); return; }
    let active = true;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const data = snapshot.data();
      setProfile({
        displayName: typeof data.displayName === "string" ? data.displayName : user.displayName || "Игрок Rusty.Lub",
        steamId: typeof data.steamId64 === "string" ? data.steamId64 : typeof data.steamId === "string" ? data.steamId : undefined,
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : undefined,
      });
    }).catch(() => { if (active) setError("Не удалось загрузить Steam-профиль. Проверь доступ к Firestore."); });
    return () => { active = false; };
  }, [user]);

  function loginWithSteam() {
    if (!apiBase) { setError("Steam-вход пока не подключён: сервер авторизации ещё не развёрнут."); return; }
    setBusy(true);
    setError("");
    window.location.assign(apiBase + "/auth/steam");
  }

  async function logout() {
    if (!auth) return;
    setBusy(true); setError(""); setMessage("");
    try { await signOut(auth); setProfile({}); setMessage("Ты вышел из аккаунта."); }
    catch { setError("Не удалось завершить сеанс. Попробуй ещё раз."); }
    finally { setBusy(false); }
  }

  if (checking || busy) return <div className="account-panel"><p role="status">{busy ? "Завершаем вход через Steam…" : "Проверяем состояние аккаунта…"}</p>{error && <p className="form-message form-error" role="alert">{error}</p>}</div>;
  if (user) return (
    <div className="account-panel">
      <div className="account-profile">
        {profile.avatarUrl ? <img className="account-avatar-image" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar">{(profile.displayName || user.displayName || "R").slice(0, 1).toUpperCase()}</span>}
        <div><small>STEAM АККАУНТ ПОДКЛЮЧЁН</small><strong>{profile.displayName || user.displayName || "Игрок Rusty.Lub"}</strong><span>{profile.steamId ? "SteamID64: " + profile.steamId : "Steam-профиль подтверждён"}</span></div>
      </div>
      <div className="account-profile-meta"><span>FIREBASE UID</span><code>{user.uid}</code></div>
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
      <button className="btn btn-steam" type="button" onClick={loginWithSteam} disabled={busy || !apiBase}>{busy ? "ПЕРЕХОД К STEAM…" : "ВОЙТИ ЧЕРЕЗ STEAM ↗"}</button>
      {!apiBase && <p className="account-disclaimer">Steam-авторизация будет доступна после развёртывания защищённого сервера входа. Других способов регистрации на сайте не будет.</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-disclaimer">Сайт не запрашивает и не хранит пароль от Steam. Авторизация проходит на стороне Steam.</p>
    </div>
  );
}
