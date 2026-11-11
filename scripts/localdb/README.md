# Local test copy

A private copy of PowerEdge on this Mac: production's database structure, a
square mile of real storm data around Lake Worth (ZIP 76135), and the app with
every outside service switched off. Use it to test anything that needs rep,
closer or admin accounts without touching the live site.

    scripts/localdb/start.sh     # Postgres :54322, PostgREST :54323, proxy :54321
    scripts/localdb/dev.sh       # the app on http://localhost:3100

Sign in at http://localhost:3100/login with any test email that is on the
team (add people on the Team page as admin@poweredge.test). No email is sent;
get the link with:

    scripts/localdb/link.sh kai@poweredge.test

What is switched off in dev.sh: email (Resend), HubSpot, BatchData, Shovels,
Stripe, Plaid, Google keys, analytics. Pages say "the email did not go" where
production would send one; that is expected here.

Rebuilding from scratch: schema.sql is production's structure (no data),
pulled from catalog queries by extract_schema.py; functions.sql holds the
scoreboard functions; load_seed.py loads a saved slice of rows. Data files
live in data/ and .localdb/, both git-ignored.
