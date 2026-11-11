import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption for the two numbers PowerEdge holds that would hurt someone if
 * they leaked: a rep's SSN (or EIN) and their bank account number.
 *
 * AES-256-GCM with a key that lives only in the server's environment
 * (PII_KEY, 32 random bytes, base64). The database stores ciphertext and the
 * last four digits; a stolen database copy or a leaked service key does not
 * reveal the numbers. With no key set, nothing is accepted: the forms say so
 * rather than store a number in the clear.
 *
 * Generate a key once and put it in Render's environment:
 *   openssl rand -base64 32
 * Losing the key means the stored numbers cannot be read back (reps would
 * re-enter them), so keep a copy somewhere safe.
 */

const VERSION = "v1";

function key(): Buffer | null {
  const raw = process.env.PII_KEY;
  if (!raw) return null;
  try {
    const k = Buffer.from(raw, "base64");
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}

export const piiReady = () => key() !== null;

export function encrypt(plain: string): string {
  const k = key();
  if (!k) throw new Error("PII_KEY is not set");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${VERSION}:${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64")}`;
}

export function decrypt(token: string): string {
  const k = key();
  if (!k) throw new Error("PII_KEY is not set");
  const [v, b64] = token.split(":");
  if (v !== VERSION || !b64) throw new Error("Unknown ciphertext");
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** "123-45-6789" -> "123456789". */
export const digits = (s: string) => String(s || "").replace(/\D/g, "");

/** ABA routing numbers carry a checksum; a typo almost never passes it. */
export function validRouting(r: string) {
  const d = digits(r);
  if (d.length !== 9) return false;
  const n = d.split("").map(Number);
  const sum = 3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + (n[2] + n[5] + n[8]);
  return sum % 10 === 0 && sum > 0;
}

/** SSNs the IRS never issues: 000, 666 or 9xx area, 00 group, 0000 serial. */
export function validSsn(s: string) {
  const d = digits(s);
  if (d.length !== 9) return false;
  const area = d.slice(0, 3);
  return area !== "000" && area !== "666" && area[0] !== "9" && d.slice(3, 5) !== "00" && d.slice(5) !== "0000";
}

export function validEin(s: string) {
  const d = digits(s);
  return d.length === 9 && d.slice(0, 2) !== "00";
}
