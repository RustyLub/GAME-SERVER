import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
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
    if (!user || !db) { setProfile({}); return; }
    let active = true;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const data = snapshot.data();
      setProfile({
        displayName: typeof data.displayName === "string" ? data.displayName : user.displayName || "Игрок Rusty.Lub",
        steamId: typeof data.steamId === "string" ? data.steamId : undefined,
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

  if (checking) return <div className="account-panel"><p role="status">Проверяем состояние аккаунта…</p></div>;
  if (user) return (
    <div className="account-panel">
      <div className="account-profile">
        {profile.avatarUrl ? <img className="account-avatar-image" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span className="account-avatar">{(profile.displayName || user.displayName || "R").slice(0, 1).toUpperCase()}</span>}
        <div><small>STEAM АККАУНТ ПОДКЛЮЧЁН</small><strong>{profile.displayName || user.displayName || "Игрок Rusty.Lub"}</strong><span>{profile.steamId ? "SteamID64: " + profile.steamId : "Steam-профиль подтверждён"}</span></div>
      </div>
      <div className="account-profile-meta"><span>FIREBASE UID</span><code>{user.uid}</code></div>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={logout} disabled={busy}>{busy ? "ВЫХОД…" : "ВЫЙТИ ИЗ АККАУНТА"}</button>
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
