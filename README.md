# PowerEdge — poweredgetx.com rebuild

Licensed roofing + electrical contractor site for the DFW metroplex. Next.js 16
(App Router) + Tailwind v4 + TypeScript. Built to **capture leads** and stand out
on the **"we're the one contractor you can verify"** wedge.

## Run it

```bash
npm run dev      # http://localhost:3000 (or: npm run dev -- --port 3007)
npm run build    # production build
```

## Strategy baked in

- **The wedge:** Roofing is unlicensed in Texas; electrical + solar legally require
  a Master Electrician. The site leads with real credentials (licensed & insured,
  40-year Master Electrician John Lott) — something storm-chasers can't fake.
  NOTE: TECL license number temporarily pulled sitewide (2026-07-20, new number
  pending); restore via `site.teclLicense` — see lib/site.ts.
- **Pricing = land-grab:** transparent electrical flat-rate menu (priced to win
  share now); roofing & storm stay free-inspection / quote-only.
- **Solar = repair & replacement only** (no new installs), under the electrical license.
- **Storm/insurance done by the book** — no deductible waiving, no acting as adjuster.

## Where to edit (everything important is data-driven)

| File | What it controls |
|------|------------------|
| `lib/site.ts` | Phone, email, license #, rating/review count, team bios, capacity. **Start here.** |
| `lib/services.ts` | Service copy + the **electrical flat-rate price menu** (prices are PLACEHOLDERS — set your real numbers). |
| `lib/reviews.ts` | Featured review quotes (replace with real Google reviews). |
| `lib/cities.ts` | Service-area city pages (add/remove cities → routes + sitemap update automatically). |
| `app/globals.css` | Brand colors + fonts (`@theme` block). |

## TODOs before launch (search the code for `TODO(parker)`)

1. **Google reviews URL** + booking URL in `lib/site.ts`.
2. **Real electrical prices** in `lib/services.ts` (current numbers are structural placeholders).
3. **Lead delivery:** copy `.env.example` → `.env.local`, add `RESEND_API_KEY`
   (email) and wire the Jobber GraphQL mutation in `app/api/lead/route.ts`.
4. **Real photos** — swap the initials avatars / add roof + crew imagery.
5. Point `poweredgetx.com` DNS at the host (Vercel or Render) once approved.

## Lead flow

Form → `POST /api/lead` → emails the team (Resend) **and** is wired to create a
Jobber request (drop in the token + mutation). Includes a honeypot for spam.
