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

- `POST /auth/register` — `{ username, password, displayName }` → `{ token, user }`
- `POST /auth/login` — `{ username, password }` → `{ token, user }`
- `GET  /auth/me` — `Authorization: Bearer <token>` → `{ user }`
- Страницы `/register`, `/login`, `/` (home с профилем и кнопкой logout)
- JWT хранится в `localStorage`, hydrate при загрузке через `/auth/me`

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

## Дальше (план)

- **Этап 2**: профиль, поиск пользователей, создание личного чата.
- **Этап 3**: список чатов, экран чата, отправка сообщений через REST.
- **Этап 4**: Socket.IO — real-time сообщения, online/offline, typing.
- **Этап 5**: edit / delete, read/unread, responsive UI.
