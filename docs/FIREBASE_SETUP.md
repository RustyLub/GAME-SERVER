# Подключение отдельного Firebase-проекта

Эта инструкция относится только к репозиторию `RustyLub/GAME-SERVER`. Не используй настройки Firebase от старого сайта Rusty.Lub.

## 1. Создать отдельный проект

1. Открой [Firebase Console](https://console.firebase.google.com/).
2. Создай новый проект с понятным названием, например `rustylub-game-server`.
3. Не импортируй настройки старого Firebase-проекта сайта.
4. В проекте открой **Project settings → General → Your apps**.
5. Нажми **Add app → Web** и зарегистрируй веб-приложение, например `Rusty.Lub GAME-SERVER`.
6. Firebase Hosting подключать не требуется: сайт публикуется через GitHub Pages.

## 2. Получить Web App config

В настройках зарегистрированного Web App выбери **SDK setup and configuration → Config**. Нужны шесть значений:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Это клиентская конфигурация Firebase. Она попадёт в собранный JavaScript сайта и не является секретом. Но приватные ключи и административные учётные данные Firebase сюда не относятся и не должны попадать в браузер, репозиторий или переписку.

## 3. Добавить конфигурацию в GitHub Actions

В репозитории открой **Settings → Secrets and variables → Actions → Variables** и создай Actions Variables со следующими точными именами:

| Имя переменной | Значение |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` из Firebase Web App config |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Используй именно **Variables**, поскольку это публичные параметры клиентской сборки. Не добавляй к ним приватный ключ service account. Workflow публикации уже подготовлен для чтения этих шести Variables и передачи их в Vite build. Если значения ещё не добавлены, они будут пустыми и Firebase останется неактивным.

## 4. Включить Authentication

После того как проект создан:

1. Открой **Build → Authentication → Get started**.
2. Не включай способы входа, которые не используются сайтом.
3. Для входа через Steam потребуется отдельный доверенный серверный обработчик OpenID. Одного включения Firebase Authentication недостаточно.
4. Добавление домена сайта в **Authentication → Settings → Authorized domains** выполняется после проверки домена и готовности авторизации.

## 5. Firestore

Firestore пока закрыт правилами по умолчанию в `firestore.rules`. Это намеренно: нельзя открывать чтение или запись всем пользователям до определения схемы данных и проверки прав.

После создания базы данных не ослабляй правила до `allow read, write: if true`. Публичные данные сервера, личные профили, платежи и VIP-права должны иметь разные правила доступа. Подтверждение оплаты и выдача VIP должны выполняться только доверенным backend, а не браузером.

## 6. Что не нужно присылать или публиковать

Никогда не передавай в чат и не коммить:

- пароль Google/Firebase;
- JSON-файл Firebase Admin service account;
- приватные ключи и токены;
- Steam Web API key;
- секреты Platega;
- RCON-пароль Rust-сервера.

Эти значения понадобятся только на серверной стороне и должны храниться в Secret Manager выбранного backend-провайдера.

## Контрольный список

- [ ] Создан отдельный Firebase-проект именно для GAME-SERVER.
- [ ] В нём зарегистрировано Web App.
- [ ] Получены все шесть полей Web App config.
- [ ] Шесть значений добавлены в GitHub Actions Variables.
- [x] Workflow сборки настроен на передачу переменных в Vite build.
- [ ] В Firebase Authentication добавлен production-домен.
- [ ] Firestore остаётся закрытым до внедрения проверенных правил.
- [ ] Серверные секреты хранятся отдельно от frontend.

Пока отдельный проект и его Web App config не созданы, Firebase-интеграция остаётся неактивной. Это безопасное ожидаемое состояние, а не ошибка сайта.
