# Firebase и Steam-вход Rusty.Lub

На сайте предусмотрен только вход через Steam. Регистрация выполняется автоматически при первом успешном Steam OpenID входе; email и пароль для аккаунта Rusty.Lub не используются.

## Firebase Web App
1. Открой Firebase Console и выбери проект rustylub.
2. В Project settings → General → Your apps проверь Web App с переданным для сайта appId.
3. Web App config публичен. Не публикуй Firebase Admin service account или приватные ключи.

## Firebase Authentication
Firebase Authentication используется как сессионный слой для Firebase Custom Tokens, которые выдаёт доверенный backend после проверки Steam OpenID.

Не включай Email/Password как способ регистрации Rusty.Lub. Steam не является встроенным OAuth-провайдером Firebase: Steam OpenID должен проверяться сервером, после чего сервер находит или создаёт Firebase-пользователя и выдаёт Custom Token.

Добавь rusty-lub.online в Authentication → Settings → Authorized domains. Backend callback URL должен использовать HTTPS.

## Cloud Firestore
1. Создай Firestore Database в Production mode.
2. Опубликуй правила из firestore.rules.

Профили находятся в users/{uid}. Клиент может читать только собственный профиль. Создание и изменение профилей запрещено из браузера: это делает доверенный backend через Firebase Admin SDK после проверки Steam.

Поля профиля: steamId (проверенный SteamID64), displayName (ник Steam), avatarUrl (аватар Steam), createdAt и updatedAt (server timestamp).

## Backend Steam OpenID
GitHub Pages не запускает серверный код. Разверни доверенный backend и задай VITE_API_BASE_URL в окружении сборки сайта.

Backend должен:
1. Начинать Steam OpenID 2.0 redirect и проверять state/nonce против CSRF.
2. Принимать callback только по HTTPS и проверять ответ Steam через OpenID check_authentication.
3. Извлекать SteamID64 только из проверенного claimed_id; не доверять SteamID из query-параметров клиента.
4. Получать публичные данные профиля Steam на сервере.
5. Находить или создавать Firebase user по стабильному SteamID.
6. Создавать Firebase Custom Token через Firebase Admin SDK и безопасно передавать браузеру одноразовый результат для обмена на Firebase session.
7. Хранить Steam Web API key и Firebase Admin credentials только в серверном secret manager.

Frontend ожидает GET {VITE_API_BASE_URL}/auth/steam. Endpoint не считается рабочим, пока backend не развёрнут и callback не протестирован.

## Проверка
- Новый Steam аккаунт автоматически создаёт Firebase identity и профиль.
- Повторный вход открывает тот же профиль.
- SteamID64 берётся только из проверенного OpenID claim.
- Подставленный SteamID не проходит проверку.
- Пользователь не может записать себе чужой SteamID или VIP через Firestore SDK.
- Logout завершает Firebase-сессию.

Платежи, VIP и команды Rust подключаются только после серверной проверки личности и прав доступа.
\n\n## 6. Развёртывание сервера авторизации\n\nИсходный код backend и инструкция по развёртыванию находятся в `backend/README.md`. Это отдельный Node.js сервис: GitHub Pages не может выполнять callback Steam. Для публикации сервиса нужен Google Cloud Run, настроенный проект Google Cloud, биллинг и сервисный аккаунт с минимальными правами. Ничего из этого нельзя включать или оплачивать без согласия владельца. После публикации укажи HTTPS адрес сервиса в GitHub Repository Variables как `VITE_API_BASE_URL`. Пока переменная пустая, кнопка Steam остаётся выключенной.\n