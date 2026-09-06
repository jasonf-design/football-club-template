# Setting Up a New Club Website

This is a template football club website. Follow the steps below to brand and deploy it for a new club.

---

## 1. Club identity — `app/club.config.ts`

Open `app/club.config.ts` and fill in the club's details:

| Field | Example |
|-------|---------|
| `name.full` | `"Riverside City Football Club"` |
| `name.display` | `"RIVERSIDE CITY FC"` |
| `name.displayShort` | `"RIVERSIDE CITY"` |
| `name.short` | `"Riverside City FC"` |
| `name.abbreviation` | `"RCFC"` |
| `name.city` | `"Riverside"` |
| `name.tagline` | Club's strapline |
| `name.established` | Year founded |
| `social.twitter` | Full URL or `null` to hide |
| `social.instagram` | Full URL or `null` to hide |
| `social.facebook` | Full URL or `null` to hide |
| `social.tiktok` | Full URL or `null` to hide |
| `social.youtube` | Full URL or `null` to hide |
| `contact.adminEmails` | Array of staff emails for contact form notifications |
| `fwp.teamId` | Club's Football Web Pages team ID (see below) |
| `siteUrl` | Live domain, e.g. `"https://riversidecityfc.com"` |
| `session.cookieName` | `"__rcfc_session"` (use club abbreviation) |
| `session.cartKey` | `"rcfc.cart.v1"` |
| `session.cartEvent` | `"rcfc:cart-changed"` |

---

## 2. Club colours — `app/app.css`

Open `app/app.css` and update the `@theme` block with the club's brand colours:

```css
@theme {
  --color-navy: #0e1f44;    /* PRIMARY colour — main backgrounds, buttons */
  --color-navy-deep: #081633; /* Darker shade of primary */
  --color-sky: #6bb1db;     /* SECONDARY colour — accents, links, badges */
  --color-sky-bright: #4fa1d2;
  --color-sky-deep: #1f6a9a;
  --color-sky-soft: #d9ebf6;
  /* ... rest stay as-is */
}
```

Also update `theme.metaThemeColor` in `club.config.ts` to match `--color-navy`.

---

## 3. Club crest — `public/`

Replace these files with the club's crest (keep the same filenames):

| File | Size | Format |
|------|------|--------|
| `public/crest-128.avif` | 128×128px | AVIF (best quality, smallest) |
| `public/crest-128.webp` | 128×128px | WebP (fallback) |
| `public/crest-128.png` | 128×128px | PNG (final fallback) |
| `public/favicon.ico` | 32×32px | ICO |
| `public/favicon-32.png` | 32×32px | PNG |
| `public/apple-touch-icon.png` | 180×180px | PNG |

---

## 4. Football Web Pages (FWP) — fixture sync

The site syncs fixtures and results from [footballwebpages.co.uk](https://footballwebpages.co.uk).

To find the club's team ID:
1. Go to footballwebpages.co.uk
2. Search for the club
3. The team ID is in the URL: `footballwebpages.co.uk/team/XXXX`
4. Set `fwp.teamId` in `club.config.ts`

---

## 5. Environment variables — `.env`

Copy `.env.example` to `.env` and fill in:

```env
SESSION_SECRET=        # Random 64-char string (use: openssl rand -base64 48)
DATABASE_URL=          # Path to SQLite file
PUBLIC_URL=            # Full domain, e.g. https://riversidecityfc.com
COOKIE_SECURE=true

# Email (Resend — resend.com)
RESEND_API_KEY=
CONTACT_NOTIFY_FROM=   # e.g. noreply@riversidecityfc.com

# Stripe (optional — for shop/ticketing)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 6. Initial deploy

```bash
npm install
npm run build
```

Deploy using rsync to your server (update the IP/path):

```bash
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='*.sqlite' --exclude='.env' \
  ./ root@YOUR_SERVER_IP:/var/www/CLUB_NAME/ \
  && ssh root@YOUR_SERVER_IP "cd /var/www/CLUB_NAME && npm install --omit=dev && npm run build && pm2 restart CLUB_NAME --update-env"
```

---

## 7. Create the first admin user

SSH into the server and run:

```bash
cd /var/www/CLUB_NAME
node scripts/create-admin.js
```

---

## What the site includes

- **Home page** with hero, latest results, and recent news
- **Fixtures & results** synced from Football Web Pages
- **Squad pages** — 1st team, Under 23s, Under 18s
- **News / match reports** with full editor
- **Match programmes** (digital PDF-style)
- **Club shop** with Stripe payments
- **Pitch sponsorship** — virtual pitch squares
- **Player sponsorship**
- **Contact form** with email notifications
- **Admin panel** — manage all content without touching code
