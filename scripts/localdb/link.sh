#!/bin/bash
# The newest unused sign-in link for an email, from the local database only.
# Usage: scripts/localdb/link.sh someone@poweredge.test
T=$(/opt/homebrew/opt/postgresql@17/bin/psql -h localhost -p 54322 -U postgres -d poweredge -Atc \
  "select token from login_tokens where email = lower('$1') and used_at is null and expires_at > now() order by created_at desc limit 1")
[ -n "$T" ] && echo "http://localhost:${PORT:-3100}/auth/callback?t=$T" || echo "no unused link for $1"
