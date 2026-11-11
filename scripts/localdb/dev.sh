#!/bin/bash
# The app against the local stack. Every outside service is blanked, so a test
# run here cannot email a homeowner, text anyone, or touch HubSpot or billing.
# Email is written to .localdb/mail.jsonl instead of being sent.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="$ROOT/.localdb"
cd "$ROOT"
exec env \
  SUPABASE_URL=http://localhost:54321 \
  SUPABASE_SERVICE_ROLE_KEY="$(cat "$DB/service_key")" \
  ADMIN_TOKEN="$(cat "$DB/admin_token")" \
  PII_KEY="$( [ -f "$DB/pii_key" ] && cat "$DB/pii_key" )" \
  NEXT_PUBLIC_SITE_URL="http://localhost:${PORT:-3100}" \
  MAIL_SINK="$DB/mail.jsonl" RESEND_API_KEY=local-sink RESEND_AUDIENCE_ID= HUBSPOT_ACCESS_TOKEN= LEAD_WEBHOOK_URL= LEAD_TO_EMAIL= \
  JOBBER_API_TOKEN= BATCHDATA_API_KEY= SHOVELS_API_KEY= STRIPE_SECRET_KEY= STRIPE_PUBLISHABLE_KEY= \
  PLAID_SECRET= PLAID_CLIENT_ID= PLAID_ENV= GOOGLE_SOLAR_API_KEY= GOOGLE_MAPS_API_KEY= \
  NEXT_PUBLIC_META_PIXEL_ID= NEXT_PUBLIC_GA_ID= NEXT_PUBLIC_CALLRAIL_SRC= \
  npx next dev -p "${PORT:-3100}"
