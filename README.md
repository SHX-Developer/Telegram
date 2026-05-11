# Messenger

Telegram-like мессенджер. Сейчас реализован **Этап 1**: каркас проекта, PostgreSQL через Docker, Prisma, и базовая авторизация (регистрация / логин / `me`).

## Стек

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Zustand + Axios
- **Backend**: Node.js + Express + TypeScript + Prisma + JWT + bcrypt
- **DB**: PostgreSQL 16 (в Docker)

## Структура

```
.
├── docker-compose.yml          # Postgres
├── backend/                    # Express API
│   ├── prisma/schema.prisma    # User, Chat, ChatMember, Message
│   └── src/
│       ├── index.ts            # Express bootstrap
│       ├── routes/auth.ts      # /auth/register, /auth/login, /auth/me
│       ├── middleware/auth.ts  # JWT guard
│       └── lib/                # prisma, env, jwt
└── frontend/                   # Next.js
    └── src/
        ├── app/                # /, /login, /register
        ├── components/         # AuthGuard
        ├── lib/                # axios, types
        └── store/auth.ts       # Zustand auth store
```

## Запуск (первый раз)

### 1. Поднять Postgres

```bash
docker compose up -d
```

Проверить, что контейнер запущен и healthy:

```bash
docker compose ps
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

Сервер слушает `http://localhost:4000`.

Полезные команды:

- `npm run prisma:studio` — UI для просмотра БД.
- `npm run prisma:migrate` — применить новые миграции.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Открыть `http://localhost:3000`.

## Что работает

- `POST /auth/register` — `{ username, password, displayName }` → `{ token, user }`
- `POST /auth/login` — `{ username, password }` → `{ token, user }`
- `GET  /auth/me` — `Authorization: Bearer <token>` → `{ user }`
- Страницы `/register`, `/login`, `/` (home с профилем и кнопкой logout)
- JWT хранится в `localStorage`, hydrate при загрузке через `/auth/me`

## Дальше (план)

- **Этап 2**: профиль, поиск пользователей, создание личного чата.
- **Этап 3**: список чатов, экран чата, отправка сообщений через REST.
- **Этап 4**: Socket.IO — real-time сообщения, online/offline, typing.
- **Этап 5**: edit / delete, read/unread, responsive UI.
