# PowerEdge — poweredgetx.com rebuild

Roofing and home repair contractor site for the DFW metroplex. Next.js 16
(App Router) + Tailwind v4 + TypeScript. Built to **capture leads** and stand out
on the **"we're the one contractor you can verify"** wedge.

## Run it

```bash
npm run dev      # http://localhost:3000 (or: npm run dev -- --port 3007)
npm run build    # production build
```

## Strategy baked in

- **The wedge:** Texas does not license roofers at all, so anyone can call
  themselves one. The site leans on what is actually verifiable instead of a
  license number: liability coverage, a workmanship guarantee, a real local
  address, and the Google rating — see `site.liabilityCoverage`,
  `site.workmanshipGuarantee`, `site.googleRating` in `lib/site.ts`.
  Electrical and solar are no longer part of the business (Parker, 2026-09-04)
  and carry no credential claim anywhere on the site; `site.teclLicense` is
  retired for good, not "temporarily pulled." John Lott's team bio is Senior
  Crew Lead, 40 years in the trades, not Master Electrician.
- **Pricing:** roofing & storm/insurance work is free-inspection / quote-only
  (also required, since insurance-claim pricing can't legally be published).
  There is no flat-rate service menu; the electrical one was removed with
  electrical itself.
- **Deductible financing:** a real, core part of the offer for PowerEdge jobs
  only, financing the homeowner's deductible over months — never a standalone
  loan, never described as waiving/absorbing/covering/discounting it.
- **Storm/insurance done by the book** — no deductible waiving, no acting as adjuster.

## Where to edit (everything important is data-driven)

| File | What it controls |
|------|------------------|
| `lib/site.ts` | Phone, email, licence status (currently none, intentionally), rating/review count, team bios, capacity. **Start here.** |
| `lib/services.ts` | Service copy. Roofing and home repair only — no electrical or solar entries. |
| `lib/reviews.ts` | Featured review quotes (replace with real Google reviews). |
| `lib/cities.ts` | Service-area city pages (add/remove cities → routes + sitemap update automatically). |
| `app/globals.css` | Brand colors + fonts (`@theme` block). |

## Open items (search the code for `TODO(parker)`)

1. **Google "write a review" URL** in `lib/site.ts` (`googleWriteReviewUrl` is still the placeholder `"#"`).
2. **Real photos** — swap the initials avatars / add roof + crew imagery.
3. Point `poweredgetx.com` DNS at the host (Vercel or Render) once approved.

## Lead flow

Form → `POST /api/lead` → emails the team (Resend) **and** is wired to create a
Jobber request (drop in the token + mutation). Includes a honeypot for spam.
