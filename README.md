# Notes

Full-stack note-taking app (Apple Notes–style UI) on **Nuxt 4**, **SQLite** (via **libsql** / `@libsql/client`), **Drizzle ORM**, **Better Auth** (email + password, admin plugin for users/roles), a small **SQLite-native admin** at `/cms` (read-only table views), rich editor with **Lexical** (`lexical-vue`), public read-only sharing at `/share/:token`, and Docker workflows for **development** (hot reload) and **production** behind **Caddy** with TLS.

## Quick start (local)

```bash
pnpm install
pnpm approve-builds --all   # once, if pnpm blocks native builds
cp .env.example .env
mkdir -p data
pnpm db:push                # or rely on automatic migrate on server start
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The **first registered user** is promoted to `admin` (see `server/utils/auth.ts`). Admins get **Admin** in the sidebar: **Staff** (`/staff`) links to **data CMS** (`/cms`) and **Users & roles** (`/staff/users`).

## Database

- Schema: [server/database/schema.ts](server/database/schema.ts)
- Migrations: [server/database/migrations/](server/database/migrations/) (applied on startup by [server/plugins/database-migrate.ts](server/plugins/database-migrate.ts))
- Manual push (dev): `pnpm db:push`

## Tests (local)

```bash
pnpm test
```

## Docker — development

Hot reload with source bind-mount and polling for file watchers:

```bash
docker compose up --build
```

### Если вы работаете **только через Docker**

На хосте **не нужен** свой `pnpm install` для запуска: при старте контейнер выполняет `pnpm install` в Linux и кладёт зависимости в том **`notes_node_modules`**. Исходники монтируются с Mac, а **нативные модули** (например `oxc-parser`) собираются внутри образа.

После смены зависимостей закоммитьте **`pnpm-lock.yaml`** и пересоберите / перезапустите compose (том подтянет актуальный lockfile).

Defaults: SQLite на томе `notes_data` в `/app/data/app.sqlite`. Том **`notes_node_modules`** изолирует `node_modules` от macOS. Если что-то ломается после смены lockfile/архитектуры: `docker compose down -v` или удалите только том Node через `docker volume ls` / `docker volume rm …`.

Переменные `NUXT_PUBLIC_SITE_URL`, `BETTER_AUTH_*` и др. задайте в `.env` в корне репозитория (Compose подхватывает автоматически).

## Docker — tests + production build

Один проход: установка зависимостей в Linux-томе, `pnpm test`, затем `pnpm run build` (как быстрая проверка CI):

```bash
docker compose -f docker-compose.test.yml run --rm --build test
```

Том **`notes_test_node_modules`** отделён от dev-тома. При смене lockfile пересоберите образ или удалите том тестов.

## Docker — production

Задайте публичные `NUXT_PUBLIC_SITE_URL` и `BETTER_AUTH_URL` как `https://ваш-домен`, сильный `BETTER_AUTH_SECRET`, `DOMAIN` для virtual host в [Caddyfile](Caddyfile) и **`CADDY_EMAIL`** (контакт для Let's Encrypt — см. глобальный блок в Caddyfile и [.env.example](.env.example)).

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Caddy terminates TLS and reverse-proxies to the Nitro app. Ensure DNS for `DOMAIN` points at the host and ports **80/443** are reachable.

## Отличие от чернового плана (AutoAdmin)

Ранний план предполагал слой [awecode/autoadmin](https://github.com/awecode/autoadmin) через `extends` в Nuxt. В текущей кодовой базе вместо этого — **встроенный read-only CMS** на маршрутах **`/cms`** (просмотр таблиц SQLite через приложение) плюс **`/staff/users`** для пользователей и ролей через Better Auth admin plugin. Подключение AutoAdmin остаётся опциональным отдельным объёмом работ.

## Layout

| Path | Purpose |
|------|---------|
| `/` | Notes app |
| `/login` | Sign in / sign up |
| `/share/:token` | Read-only shared note |
| `/staff` | Admin hub |
| `/staff/users` | Better Auth user list & roles |
| `/cms` | Admin read-only views: folders, notes (SQLite) |

## License

Private / your choice.
