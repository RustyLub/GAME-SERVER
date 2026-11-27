import { useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile, type User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

function firebaseErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Этот адрес электронной почты уже зарегистрирован.",
    "auth/invalid-email": "Проверь правильность адреса электронной почты.",
    "auth/weak-password": "Пароль слишком простой. Используй не менее 6 символов.",
    "auth/invalid-credential": "Неверная почта или пароль.",
    "auth/user-disabled": "Этот аккаунт отключён.",
    "auth/too-many-requests": "Слишком много попыток. Попробуй позже.",
    "auth/operation-not-allowed": "В Firebase Console ещё не включён вход по электронной почте и паролю.",
    "auth/network-request-failed": "Не удалось связаться с Firebase. Проверь подключение к интернету.",
  };
  return messages[code] || "Не удалось выполнить операцию. Проверь настройки Firebase и попробуй ещё раз.";
}

export default function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!auth) {
      setChecking(false);
      setError("Firebase не настроен. Проверь конфигурацию приложения.");
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setProfileName(currentUser?.displayName || "");
      setChecking(false);
    }, () => {
      setChecking(false);
      setError("Не удалось проверить состояние авторизации.");
    });
  }, []);

  async function saveProfile(currentUser: User, displayName: string) {
    if (!db) {
      setMessage("Аккаунт создан. База Firestore пока не подключена — профиль будет сохранён после её настройки.");
      return;
    }
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        displayName,
        email: currentUser.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMessage("Аккаунт и профиль успешно созданы.");
    } catch {
      setMessage("Аккаунт создан. Не удалось сохранить профиль в Firestore: проверь, создана ли база и опубликованы ли правила.");
    }
  }


  useEffect(() => {
    if (!user || !db) return;
    let active = true;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!active || !snapshot.exists()) return;
      const storedName = snapshot.data().displayName;
      if (typeof storedName === "string" && storedName.length > 0) setProfileName(storedName);
    }).catch(() => {
      if (active) setMessage("Не удалось загрузить профиль из Firestore. Проверь настройки базы и правила доступа.");
    });
    return () => { active = false; };
  }, [user]);

  async function updateDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !db || !user) {
      setError("Для сохранения имени необходимо подключить Firestore.");
      return;
    }
    const nextName = profileName.trim();
    if (nextName.length < 2 || nextName.length > 40) {
      setError("Имя должно содержать от 2 до 40 символов.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const profileRef = doc(db, "users", user.uid);
      const profile = await getDoc(profileRef);
      await updateProfile(user, { displayName: nextName });
      if (profile.exists()) {
        await updateDoc(profileRef, { displayName: nextName, updatedAt: serverTimestamp() });
      } else {
        await setDoc(profileRef, {
          displayName: nextName,
          email: user.email || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setUser({ ...user });
      setEditingName(false);
      setMessage("Имя профиля обновлено.");
    } catch {
      setError("Не удалось сохранить имя. Проверь, что Firestore создан и актуальные правила опубликованы.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      setError("Firebase не настроен.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "register") {
        if (name.trim().length < 2) throw new Error("Укажи имя длиной не менее двух символов.");
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await saveProfile(credential.user, name.trim());
        setUser(credential.user);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setMessage("Вход выполнен.");
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error && !("code" in err) ? err.message : firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!auth || !email.trim()) {
      setError("Сначала введи адрес электронной почты.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Если аккаунт с таким адресом существует, Firebase отправит письмо для сброса пароля.");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!auth) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await signOut(auth);
      setMessage("Ты вышел из аккаунта.");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="account-panel"><p role="status">Проверяем состояние аккаунта…</p></div>;

  if (user) return (
    <div className="account-panel">
      <div className="account-profile">
        <span className="account-avatar">{(profileName || user.displayName || user.email || "R").slice(0, 1).toUpperCase()}</span>
        <div><small>ТЫ В СИСТЕМЕ</small><strong>{profileName || user.displayName || "Игрок Rusty.Lub"}</strong><span>{user.email}</span></div>
      </div>
      {editingName ? (
        <form className="account-form account-edit-form" onSubmit={updateDisplayName}>
          <label>НОВОЕ ИМЯ ИГРОКА<input value={profileName} onChange={event => setProfileName(event.target.value)} minLength={2} maxLength={40} required /></label>
          <div className="account-actions">
            <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "СОХРАНЕНИЕ…" : "СОХРАНИТЬ ИМЯ"}</button>
            <button className="btn btn-ghost" type="button" onClick={() => { setProfileName(user.displayName || ""); setEditingName(false); setError(""); }}>ОТМЕНА</button>
          </div>
        </form>
      ) : <button className="account-reset" type="button" onClick={() => { setProfileName(user.displayName || profileName); setEditingName(true); }}>ИЗМЕНИТЬ ИМЯ</button>}
      <div className="account-profile-meta"><span>UID АККАУНТА</span><code>{user.uid}</code></div>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      <button className="btn btn-ghost" type="button" onClick={logout} disabled={busy}>{busy ? "ВЫХОД…" : "ВЫЙТИ ИЗ АККАУНТА"}</button>
    </div>
  );

  return (
    <div className="account-panel">
      <div className="account-tabs" role="tablist" aria-label="Авторизация">
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ВХОД</button>
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>РЕГИСТРАЦИЯ</button>
      </div>
      <form className="account-form" onSubmit={submit}>
        {mode === "register" && <label>ИМЯ ИГРОКА<input value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" maxLength={40} minLength={2} required placeholder="Твоё имя" /></label>}
        <label>EMAIL<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} required placeholder="name@example.com" /></label>
        <label>ПАРОЛЬ<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required placeholder="Не менее 6 символов" /></label>
        <button className="btn btn-red" type="submit" disabled={busy}>{busy ? "ПОДОЖДИ…" : mode === "login" ? "ВОЙТИ В АККАУНТ ↗" : "СОЗДАТЬ АККАУНТ ↗"}</button>
      </form>
      {mode === "login" && <button className="account-reset" type="button" onClick={resetPassword} disabled={busy}>ЗАБЫЛ ПАРОЛЬ?</button>}
      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-disclaimer">Используется Firebase Authentication. Не используй пароль от Steam или Google.</p>
    </div>
  );
}
