# Messenger

Telegram-like мессенджер. Реализованы **Этапы 1–4**: каркас, авторизация, профиль, поиск, личные чаты, отправка/получение сообщений real-time через Socket.IO, online/offline, typing indicator, read receipts (галочки) и непрочитанные счётчики.

## Стек

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Zustand + Axios
- **Backend**: Node.js + Express + TypeScript + Prisma + JWT + bcrypt
- **DB**: PostgreSQL 16 (в Docker)

## Структура

```
.
├── docker-compose.yml             # Postgres (dev)
├── docker-compose.prod.yml        # postgres + backend + frontend (prod)
├── package.json                   # root npm-скрипты: dev, db:*, migrate, setup
├── scripts/setup.mjs              # автоматический первый запуск
├── backend/                       # Express API
│   ├── Dockerfile
│   ├── prisma/schema.prisma       # User, Chat, ChatMember, Message
│   └── src/
│       ├── index.ts               # bootstrap (cors, json, error handler)
│       ├── routes/
│       │   ├── auth.ts            # /auth/register, /auth/login, /auth/me
│       │   ├── users.ts           # /users/search, /users/:id, PATCH /users/me
│       │   ├── chats.ts           # GET /chats, POST /chats/private
│       │   └── messages.ts        # GET/POST /chats/:id/messages
│       ├── middleware/auth.ts     # JWT guard
│       └── lib/                   # prisma, env, jwt, serializers
└── frontend/                      # Next.js (App Router)
    ├── Dockerfile
    └── src/
        ├── app/
        │   ├── page.tsx           # редирект на /chats или /login
        │   ├── login/, register/  # формы авторизации
        │   └── (app)/             # защищённый layout с сайдбаром
        │       ├── layout.tsx     # AuthGuard + 2-колоночный shell
        │       ├── chats/page.tsx
        │       ├── chats/[chatId]/page.tsx
        │       └── profile/page.tsx
        ├── components/
        │   ├── Sidebar.tsx        # ChatsPanel / ProfilePanel + BottomTabs
        │   ├── ChatsPanel.tsx     # поиск + список чатов
        │   ├── ChatListItem.tsx
        │   ├── ChatView.tsx       # header + список сообщений + ввод
        │   ├── MessageList.tsx
        │   ├── MessageInput.tsx
        │   ├── ProfilePanel.tsx
        │   ├── Avatar.tsx, SearchBar.tsx, BottomTabs.tsx, EmptyState.tsx
        │   └── AuthGuard.tsx
        ├── lib/                   # api, types, users, chats
        └── store/                 # zustand: auth, chats
```

## Локальный запуск

Требования: Node 20+, Docker Desktop.

### Первый запуск — всё одной командой

```bash
npm install         # ставит concurrently в корне
npm run setup       # ставит deps, поднимает postgres, прогоняет миграции
npm run dev         # backend + frontend параллельно
```

`npm run setup` сам:

1. установит зависимости в `backend/` и `frontend/`,
2. создаст `backend/.env` и `frontend/.env.local` из примеров (если их нет),
3. поднимет postgres контейнер,
4. дождётся готовности БД и прогонит `prisma migrate`.

После этого `npm run dev` запускает оба процесса с общими логами, помеченными `be` и `fe`.
Backend — `http://localhost:4000`, Frontend — `http://localhost:3000`.

### Полезные npm-скрипты (из корня)

| Команда                | Что делает                                              |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | backend + frontend параллельно                          |
| `npm run dev:backend`  | только backend                                          |
| `npm run dev:frontend` | только frontend                                         |
| `npm run db:up`        | поднять postgres                                        |
| `npm run db:down`      | остановить postgres                                     |
| `npm run db:reset`     | снести postgres вместе с volume и поднять заново        |
| `npm run db:psql`      | открыть `psql` внутри контейнера                        |
| `npm run db:logs`      | логи postgres                                           |
| `npm run migrate`      | `prisma migrate dev` в `backend/`                       |
| `npm run generate`     | `prisma generate`                                       |
| `npm run studio`       | Prisma Studio (UI для БД)                               |
| `npm run typecheck`    | tsc для backend и frontend                              |
| `npm run build`        | production-билд backend и frontend                      |

## Что работает

### REST API

Все ручки кроме `/auth/register` и `/auth/login` требуют `Authorization: Bearer <token>`.

| Метод | Путь                              | Что делает                                              |
| ----- | --------------------------------- | ------------------------------------------------------- |
| POST  | `/auth/register`                  | `{ username, password, displayName }` → `{ token, user }` |
| POST  | `/auth/login`                     | `{ username, password }` → `{ token, user }`            |
| GET   | `/auth/me`                        | текущий пользователь                                    |
| GET   | `/users/search?query=`            | поиск по username / displayName                         |
| GET   | `/users/:id`                      | публичный профиль                                       |
| PATCH | `/users/me`                       | `{ displayName?, avatarUrl? }`                          |
| GET   | `/chats`                          | список чатов с собеседником и lastMessage               |
| POST  | `/chats/private`                  | `{ userId }` — найти или создать приватный чат          |
| GET   | `/chats/:chatId/messages`         | `?before=<iso>&limit=<n>` — пагинация назад             |
| POST  | `/chats/:chatId/messages`         | `{ text }`                                              |

### Socket.IO

Подключение: `io(API_URL, { auth: { token } })`.

| Направление       | Событие                | Payload                                                    |
| ----------------- | ---------------------- | ---------------------------------------------------------- |
| Клиент → Сервер   | `join_chat`            | `{ chatId }`                                               |
| Клиент → Сервер   | `leave_chat`           | `{ chatId }`                                               |
| Клиент → Сервер   | `send_message`         | `{ chatId, text }` + ack `{ ok, message? }`                |
| Клиент → Сервер   | `typing_start`         | `{ chatId }`                                               |
| Клиент → Сервер   | `typing_stop`          | `{ chatId }`                                               |
| Клиент → Сервер   | `mark_read`            | `{ chatId }`                                               |
| Сервер → Клиент   | `new_message`          | `{ message }` (рассылается всем участникам чата)           |
| Сервер → Клиент   | `messages_read`        | `{ chatId, userId, lastReadAt }`                           |
| Сервер → Клиент   | `user_typing`          | `{ chatId, userId }`                                       |
| Сервер → Клиент   | `user_stopped_typing`  | `{ chatId, userId }`                                       |
| Сервер → Клиент   | `user_online`          | `{ userId }` (только контактам этого юзера)                |
| Сервер → Клиент   | `user_offline`         | `{ userId, lastSeenAt }`                                   |

### UI

Двухколоночный layout (как Telegram Desktop):

- **Слева** — поиск, список чатов с зелёной точкой (online), красным badge (unread — `9+` если больше 9), одной/двумя галочками на последнем своём сообщении. Внизу — табы **Chats / Profile**.
- **Справа** — переписка: шапка с собеседником, статус («в сети» / «печатает…» / «был N мин назад»), лента сообщений с группировкой по дате, галочки прочтения, поле ввода (Enter — отправить, Shift+Enter — перенос строки).
- Поиск открывает (или создаёт) приватный чат.
- Все обновления — real-time через Socket.IO, без перезагрузки.

## Деплой на VPS (без домена, доступ по IP)

### 0. Что нужно на сервере

- Linux VPS (Ubuntu 22/24, Debian 12 и т.п.).
- Docker и Docker Compose plugin:

  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # перелогиниться
  ```

- В файрволе/security group открыть TCP-порты `3000` (frontend) и `4000` (backend). Postgres наружу не пробрасывается.

### 1. Клонировать репозиторий

```bash
git clone https://github.com/SHX-Developer/Telegram.git messenger
cd messenger
```

### 2. Заполнить `.env.prod`

```bash
cp .env.prod.example .env.prod
# Сгенерировать секреты:
openssl rand -base64 48     # → JWT_SECRET
openssl rand -base64 24     # → POSTGRES_PASSWORD
nano .env.prod              # вписать IP сервера в PUBLIC_WEB_URL / PUBLIC_API_URL
```

`PUBLIC_API_URL` обязательно `http://<IP_сервера>:4000` — этот URL «вшивается» в frontend на этапе сборки.

### 3. Собрать и запустить

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Backend на старте сам прогонит `prisma migrate deploy` (см. `backend/docker-entrypoint.sh`).

Проверить:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
curl http://localhost:4000/health           # {"ok":true}
```

Открыть в браузере: `http://<IP_сервера>:3000`.

### 4. Обновить (новый коммит)

```bash
cd messenger
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 5. Полезное

```bash
# Логи всех сервисов
docker compose -f docker-compose.prod.yml logs -f

# Зайти в БД
docker compose -f docker-compose.prod.yml exec postgres psql -U messenger -d messenger

# Остановить
docker compose -f docker-compose.prod.yml down

# Снести вместе с данными БД (ОСТОРОЖНО)
docker compose -f docker-compose.prod.yml down -v
```

### Когда привяжешь домен

Сменить `PUBLIC_WEB_URL=https://example.com`, `PUBLIC_API_URL=https://api.example.com`, поднять Nginx + Let's Encrypt перед контейнерами и переcобрать frontend. Это уже следующая итерация.

## Применение миграций после `git pull`

В этой итерации появилось новое поле `ChatMember.lastReadAt`. Чтобы прокатить миграцию локально:

```bash
npm run migrate          # выполнит prisma migrate dev — увидит файл миграции и применит
```

В проде (на VPS) при `docker compose up -d --build` контейнер backend сам прогонит
`prisma migrate deploy` через `docker-entrypoint.sh`.

## Дальше (план)

- **Этап 5**: edit / delete сообщений, аватарки (загрузка через S3/R2), responsive mobile UI.
