import { NextResponse } from "next/server";
import { apiUser, listMembers } from "@/lib/auth";
import { onbSignedCopy, onbSignedOffice, sendOnboardingEmail } from "@/lib/emails";
import { site } from "@/lib/site";
import { clientIp } from "@/lib/rateLimit";
import { digits, encrypt, piiReady, validEin, validRouting, validSsn } from "@/lib/pii";
import { upsert, removePermit, loadOnboarding, PERMIT_CITIES } from "@/lib/onboarding";
import { AGREEMENT_STATUS, AGREEMENT_VERSION, agreementPlainText } from "@/lib/repAgreement";
import { grade } from "@/lib/onboardingQuiz";

export const dynamic = "force-dynamic";

/**
 * Every onboarding step posts here: { action, ...fields }.
 *
 * A rep acts on their own record. An admin may act on anyone's for the
 * office steps (ride-along, gear, notes) and permits, but never enters a
 * rep's SSN, bank account or signature for them: those are the rep's own.
 */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const s = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

function photoOk(v: unknown) {
  const p = String(v ?? "");
  return p === "" || (p.startsWith("data:image/jpeg;base64,") && p.length < 600_000);
}

export async function POST(req: Request) {
  const u = await apiUser(req);
  if (!u) return bad("Sign in first.", 401);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return bad("Invalid request");
  }
  const action = s(b.action, 20);
  const isAdmin = u.role === "admin";
  const target = b.member_id != null && isAdmin ? Number(b.member_id) : u.id;
  if (!Number.isFinite(target)) return bad("Who?");
  const self = target === u.id;
  const now = new Date().toISOString();

  switch (action) {
    case "profile": {
      if (!self && !isAdmin) return bad("Not yours.", 403);
      const row = {
        member_id: target,
        legal_name: s(b.legal_name, 120),
        phone: s(b.phone, 30),
        address: s(b.address, 160),
        city: s(b.city, 80),
        state: s(b.state, 2).toUpperCase(),
        zip: s(b.zip, 10),
        emergency_name: s(b.emergency_name, 120),
        emergency_phone: s(b.emergency_phone, 30),
        shirt_size: s(b.shirt_size, 6),
        ...(b.photo_jpeg !== undefined ? { photo_jpeg: String(b.photo_jpeg || "") || null } : {}),
      };
      if (!row.legal_name || row.legal_name.length < 3) return bad("Your legal name, as on your ID.");
      if (digits(row.phone).length < 10) return bad("A phone number we can reach you on.");
      if (!row.address) return bad("Your home address.");
      if (!row.emergency_name || digits(row.emergency_phone).length < 10) return bad("An emergency contact with a phone number.");
      if (!photoOk(b.photo_jpeg)) return bad("That photo didn't come through. Try again.");
      return NextResponse.json({ ok: await upsert("rep_onboarding", row) });
    }

    case "agreement": {
      if (!self) return bad("Only you can sign your agreement.", 403);
      if (AGREEMENT_STATUS !== "final") return bad("The agreement isn't open for signing yet.");
      const typed = s(b.typed_name, 120);
      const sig = String(b.signature_png ?? "");
      if (typed.length < 3) return bad("Type your full legal name.");
      if (!sig.startsWith("data:image/png;base64,") || sig.length < 2000 || sig.length > 400_000) return bad("Sign in the box.");
      const text = agreementPlainText(typed, u.role);
      const ok = await upsert("rep_onboarding", {
        member_id: target,
        agreement_version: AGREEMENT_VERSION,
        agreement_text: text,
        agreement_typed_name: typed,
        agreement_signature_png: sig,
        agreement_signed_at: now,
        agreement_ip: clientIp(req),
      });
      // A copy to the rep for their records, and a note to the office. A
      // mail problem never undoes the signature; it's logged in Health.
      if (ok && process.env.RESEND_API_KEY) {
        const base = process.env.NEXT_PUBLIC_SITE_URL || site.url;
        const signedAt = new Date(now).toLocaleString("en-US", {
          timeZone: "America/Chicago",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const c = { first: typed.split(/\s+/)[0], name: typed, version: AGREEMENT_VERSION, signedAt, text, url: `${base}/admin/onboarding/agreement` };
        await sendOnboardingEmail(process.env.RESEND_API_KEY, u.email, onbSignedCopy(c), "onboarding-agreement-copy").catch(() => undefined);
        const admins = (await listMembers()).filter((m) => m.active && m.role === "admin" && m.email.includes("@"));
        for (const a of admins) {
          await sendOnboardingEmail(
            process.env.RESEND_API_KEY,
            a.email,
            onbSignedOffice({ ...c, url: `${base}/admin/onboarding/agreement?member=${target}` }),
            "onboarding-agreement-signed",
          ).catch(() => undefined);
        }
      }
      return NextResponse.json({ ok });
    }

    case "tax": {
      if (!self) return bad("Only you can enter your tax details.", 403);
      if (!piiReady()) return bad("Secure storage isn't switched on yet. The office has been told; try again later.", 503);
      const tinType = b.tin_type === "ein" ? "ein" : "ssn";
      const tin = digits(s(b.tin, 20));
      if (tinType === "ssn" ? !validSsn(tin) : !validEin(tin)) return bad(tinType === "ssn" ? "That SSN doesn't look right." : "That EIN doesn't look right.");
      const row = {
        member_id: target,
        legal_name: s(b.legal_name, 120),
        business_name: s(b.business_name, 120) || null,
        tax_class: s(b.tax_class, 40) || "individual",
        address: s(b.address, 160),
        city: s(b.city, 80),
        state: s(b.state, 2).toUpperCase(),
        zip: s(b.zip, 10),
        tin_type: tinType,
        tin_enc: encrypt(tin),
        tin_last4: tin.slice(-4),
        certified_name: s(b.certified_name, 120),
        certified_at: now,
        ip: clientIp(req),
      };
      if (!row.legal_name || !row.address || !row.city || row.state.length !== 2 || row.zip.length < 5) return bad("Fill in your name and full address.");
      if (row.certified_name.toLowerCase() !== row.legal_name.toLowerCase()) return bad("Type your name exactly as above to certify.");
      return NextResponse.json({ ok: await upsert("rep_tax", row) });
    }

    case "bank": {
      if (!self) return bad("Only you can enter your bank details.", 403);
      if (!piiReady()) return bad("Secure storage isn't switched on yet. The office has been told; try again later.", 503);
      const routing = digits(s(b.routing, 20));
      const account = digits(s(b.account, 30));
      if (!validRouting(routing)) return bad("That routing number doesn't check out. It's the 9 digits at the bottom left of a check.");
      if (account.length < 4 || account.length > 17) return bad("That account number doesn't look right.");
      if (account !== digits(s(b.account_confirm, 30))) return bad("The account numbers don't match.");
      if (b.authorize !== true) return bad("Tick the box to authorize deposits.");
      return NextResponse.json({
        ok: await upsert("rep_bank", {
          member_id: target,
          holder_name: s(b.holder_name, 120),
          routing,
          account_enc: encrypt(account),
          account_last4: account.slice(-4),
          account_type: b.account_type === "savings" ? "savings" : "checking",
          authorized_at: now,
          ip: clientIp(req),
        }),
      });
    }

    case "playbook": {
      if (!self) return bad("Only you can confirm you read it.", 403);
      return NextResponse.json({ ok: await upsert("rep_onboarding", { member_id: target, playbook_read_at: now }) });
    }

    case "quiz": {
      if (!self) return bad("Only you can take your check.", 403);
      const answers = (b.answers ?? {}) as Record<string, number>;
      const r = grade(answers);
      const { onb } = await loadOnboarding(target);
      await upsert("rep_onboarding", {
        member_id: target,
        quiz_attempts: (onb?.quiz_attempts ?? 0) + 1,
        quiz_best: Math.max(onb?.quiz_best ?? 0, r.score),
        ...(r.passed && !onb?.quiz_passed_at ? { quiz_passed_at: now } : {}),
      });
      return NextResponse.json({ ok: true, ...r });
    }

    case "permit": {
      const city = s(b.city, 60);
      if (!city) return bad("Which city?");
      if (b.remove === true) return NextResponse.json({ ok: await removePermit(target, city) });
      const status = ["needed", "applied", "approved", "not_required"].includes(String(b.status)) ? String(b.status) : "needed";
      const expires = s(b.expires_on, 10);
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return bad("Expiry date as a date.");
      if (!photoOk(b.photo_jpeg)) return bad("That photo didn't come through. Try again.");
      return NextResponse.json({
        ok: await upsert(
          "rep_permits",
          {
            member_id: target,
            city: PERMIT_CITIES.find((c) => c.city.toLowerCase() === city.toLowerCase())?.city ?? city,
            status,
            permit_number: s(b.permit_number, 60) || null,
            expires_on: expires || null,
            ...(b.photo_jpeg !== undefined ? { photo_jpeg: String(b.photo_jpeg || "") || null } : {}),
            updated_by: u.name,
          },
          "member_id,city",
        ),
      });
    }

    case "office": {
      if (!isAdmin) return bad("The office does this one.", 403);
      const row: Record<string, unknown> = { member_id: target };
      if (b.ride_along !== undefined) {
        row.ride_along_at = b.ride_along ? now : null;
        row.ride_along_by = b.ride_along ? u.name : null;
      }
      if (b.gear !== undefined) {
        row.gear_issued_at = b.gear ? now : null;
        row.gear_by = b.gear ? u.name : null;
      }
      if (b.office_notes !== undefined) row.office_notes = s(b.office_notes, 1000) || null;
      return NextResponse.json({ ok: await upsert("rep_onboarding", row) });
    }

    default:
      return bad("Unknown step.");
  }
}
