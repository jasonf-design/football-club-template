# Doncaster City FC

The official site for Doncaster City Football Club — a React Router v7 app with
a built-in admin CMS, Stripe-powered pitch sponsorship & club shop, and a
libSQL/SQLite datastore.

## Quick start (local development)

```bash
# 1. Install
npm install

# 2. Configure env (a working SESSION_SECRET is already generated for local use;
#    .env is gitignored)
cp .env.example .env

# 3. Migrate the local SQLite database
npm run db:migrate

# 4. Seed your first admin user
npm run admin:create

# 5. Run the dev server (http://localhost:5173)
npm run dev
```

The site is at `/`. The admin CMS is at `/admin` (sign in at `/admin/login`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Run the production server (`./build/server/index.js`) |
| `npm run typecheck` | Regenerate route types + run `tsc` |
| `npm run db:generate` | Generate a Drizzle migration from `db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `$DB_URL` |
| `npm run db:studio` | Open Drizzle Studio against the DB |
| `npm run admin:create` | CLI to seed a new admin user |

## Environment variables

See `.env.example` for the full list.

| Variable | Purpose |
| --- | --- |
| `DB_URL` | libSQL connection string. For local dev: `file:./local.sqlite`. For prod: `file:/var/lib/dcfc/db.sqlite` (or a Turso URL). |
| `SESSION_SECRET` | Long random string used to sign cookies. Generate with `node -e "console.log(crypto.randomBytes(48).toString('base64url'))"`. |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe credentials. Leave blank until ready — checkout routes throw a clear error if unconfigured. |
| `UPLOADS_DIR` | Where uploaded images live on disk. Must be writable by the node user. |
| `PUBLIC_URL` | Public URL of the site (Stripe success/cancel URLs, OG tags). |
| `RESEND_API_KEY` / `CONTACT_NOTIFY_TO` / `CONTACT_NOTIFY_FROM` | Optional. When all three are set, the contact form also emails staff via Resend. If any are missing, submissions still land in `/admin/messages` — they just don't trigger an email. `CONTACT_NOTIFY_FROM` must be a verified sender on a domain you've added to Resend. |

## Project structure

```
football/
├── app/
│   ├── components/        # Shared UI (SiteHeader, AdminSidebar, NewsCard, …)
│   ├── lib/               # Server helpers (session, password, email, stripe, uploads, cart, …)
│   ├── routes/            # Route modules — wired up in routes.ts
│   ├── routes.ts          # Route config (we use config-based routing)
│   ├── root.tsx           # Document <html> shell + font loading
│   ├── app.css            # Tailwind v4 theme tokens & utilities
│   └── db.server.ts       # Drizzle DB client
├── db/
│   └── schema.ts          # All tables: users, posts, fixtures, pitch_*, …
├── drizzle/               # Generated migrations (commit these)
├── scripts/
│   ├── migrate.ts         # Migration runner used by `db:migrate`
│   └── create-admin.ts    # `admin:create` CLI
├── public/                # Static assets (crest, favicon, future media)
├── drizzle.config.ts
├── vite.config.ts
└── react-router.config.ts
```

## Design system

| Token | Value | Use |
| --- | --- | --- |
| `--font-display` | Anton | Scoreboard, match labels, hero badges |
| `--font-serif` | Fraunces (variable) | Page headlines, article titles |
| `--font-sans` | Inter | Body text |
| `--color-navy` | `#0E1F44` | Primary ink |
| `--color-sky` | `#6BB1DB` | Accent |
| `--color-paper` | `#FAFBFD` | Surface |
| `--color-paper-warm` | `#F5F1E8` | Section bands |
| `--color-ink` | `#0B1430` | Body text |
| `--color-mute` | `#5A6582` | Secondary text |

All tokens live in `app/app.css` under the `@theme` block — extend there.

## What's wired up

**Public site** (`/`)

- [x] Branded homepage with hero, next fixture, results strip, news grid, pitch CTA
- [x] News index + article (renders published posts from DB)
- [x] Fixtures & results (renders from DB)
- [x] First team
- [x] Sponsors & partnerships
- [x] Contact form (persists to `contact_messages`, with honeypot)
- [x] Pitch sponsorship page with interactive grid + Stripe checkout
- [x] Shop with product pages, cart, and Stripe checkout

**Admin CMS** (`/admin`)

- [x] Auth (argon2 + signed cookie sessions, `requireAdmin` guard)
- [x] Dashboard with live counts and build-status pills
- [x] Sidebar navigation
- [x] TipTap-powered posts editor
- [x] CRUD for posts, players, fixtures, sponsors, shop products
- [x] Pitch admin (grid seeding, manual orders, status overview)
- [x] Shop admin + orders inbox
- [x] Stripe checkout + `/api/stripe/webhook`
- [x] Contact messages inbox (mark handled, mailto reply)
- [x] Media library + image uploads (Sharp-processed)
- [x] **Team access** (admin-only) — add users, change role, reset another user's password, remove. Safeguards prevent self-deletion, self-demotion, and removing the last admin.
- [x] **Account settings** (`/admin/account`) — any signed-in user can update their own name and password (requires current password).

**Roles**

Two roles live on the `users` table: `admin` and `editor`. Today, `requireAdmin` in `app/lib/session.server.ts` admits any signed-in user; only the new user-management routes use the stricter `requireAdminRole`. If you want editors to be more restricted (e.g. no shop or orders), add `requireAdminRole` to those routes' loaders/actions.

**Notifications**

- Contact form submissions always persist to `contact_messages` and surface in `/admin/messages`.
- When `RESEND_API_KEY` + `CONTACT_NOTIFY_TO` + `CONTACT_NOTIFY_FROM` are all set, `app/lib/email.server.ts` also emails staff via Resend. Reply-to is set to the submitter so hitting Reply in your inbox responds to them directly. Failures are logged and swallowed — the form never breaks if Resend is down.

## Deployment notes (Hetzner VPS)

The site runs under **pm2** as the process `football`, listening on port `3010`,
fronted by a reverse proxy for TLS.

Deploy workflow:

```bash
npm run build           # produces ./build/{client,server}
pm2 restart football    # rolls the process onto the new build
```

Other notes:

- Persist `local.sqlite` and `uploads/` on a backed-up volume — point
  `DB_URL` and `UPLOADS_DIR` at it.
- Run `npm run db:migrate` after pulling new code that includes a migration.
- Use `litestream` (or a nightly `sqlite3 .backup` cron) to back up the DB
  off-box.
- The pm2 ecosystem file isn't checked in; env vars live in `.env` next to
  the build output.
