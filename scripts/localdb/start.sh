#!/bin/bash
# Local test stack: Postgres (54322), PostgREST (54323), Supabase-style proxy (54321).
# Then run the app against it with: scripts/localdb/dev.sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="$ROOT/.localdb"
PG=/opt/homebrew/opt/postgresql@17/bin
mkdir -p "$DB"
if [ ! -f "$DB/jwt_secret" ]; then
  node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))' > "$DB/jwt_secret"
fi
SECRET=$(cat "$DB/jwt_secret")
$PG/pg_isready -h localhost -p 54322 >/dev/null 2>&1 || LC_ALL=en_US.UTF-8 $PG/pg_ctl -D "$DB/pg" -l "$DB/pg.log" start >/dev/null
cat > "$DB/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:local-only@localhost:54322/poweredge"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = 54323
CONF
pkill -f "postgrest $DB/postgrest.conf" 2>/dev/null || true
pkill -f "scripts/localdb/proxy.mjs" 2>/dev/null || true
nohup postgrest "$DB/postgrest.conf" > "$DB/postgrest.log" 2>&1 &
nohup node "$ROOT/scripts/localdb/proxy.mjs" > "$DB/proxy.log" 2>&1 &
node -e '
const c=require("crypto"),s=process.argv[1],b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const now=Math.floor(Date.now()/1000),h=b({alg:"HS256",typ:"JWT"}),p=b({role:"service_role",iss:"poweredge-local",iat:now,exp:now+3600*24*365*5});
console.log(h+"."+p+"."+c.createHmac("sha256",s).update(h+"."+p).digest("base64url"));' "$SECRET" > "$DB/service_key"
[ -f "$DB/admin_token" ] || node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))' > "$DB/admin_token"
sleep 1
echo "local stack up. Key in $DB/service_key"
