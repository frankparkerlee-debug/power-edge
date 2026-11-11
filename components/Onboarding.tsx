"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * A new rep's checklist, step by step, on a phone. The same screen serves
 * the office looking at one rep (office=true): office steps become buttons,
 * and the W-9 and bank numbers can be revealed (logged) for 1099s and payouts.
 */

type Step = { key: string; label: string; done: boolean; by: "rep" | "office"; detail: string };
type Permit = { city: string; status: string; permit_number: string | null; expires_on: string | null; photo_jpeg: string | null };

export type OnboardingProps = {
  memberId: number;
  name: string;
  role: string;
  self: boolean;
  office: boolean;
  steps: Step[];
  profile: {
    legal_name: string; phone: string; address: string; city: string; state: string; zip: string;
    emergency_name: string; emergency_phone: string; shirt_size: string; photo_jpeg: string;
  };
  agreement: { status: "draft" | "final"; version: string; title: string; sections: Array<{ h: string; p: string[] }>; signedAt: string | null; signedName: string | null };
  tax: { on: boolean; last4: string | null; type: string | null; name: string | null; at: string | null };
  bank: { on: boolean; last4: string | null; routing: string | null; type: string | null; at: string | null };
  training: { playbookRead: boolean; passed: boolean; attempts: number; best: number | null };
  quiz: Array<{ id: string; q: string; choices: string[] }>;
  docs: Array<{ file: string; name: string; why: string }>;
  permits: Permit[];
  cities: Array<{ city: string; how: string }>;
  officeInfo: { rideAlongBy: string | null; gearBy: string | null; notes: string };
  piiReady: boolean;
  /** Opened from an email about one step (?step=w9): start there. */
  initialStep?: string | null;
};

const input =
  "w-full rounded-md border border-[#d7dbe0] bg-white px-3 py-2.5 text-[16px] text-[#0b0e13] focus:border-[#0c7a40] focus:outline-none";
const label = "mb-1 block text-sm font-semibold text-[#3b424e]";
const primary = "rounded-md bg-[#0c7a40] px-5 py-3 font-display font-bold text-white disabled:opacity-60";
const quiet = "rounded-md border border-[#d7dbe0] bg-white px-4 py-2.5 text-sm font-semibold text-[#3b424e]";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Didn't save. Try again.");
  return data;
}

/** A phone photo, shrunk to a badge-sized JPEG. */
async function toJpeg(file: File, max = 640): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = src;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(src);
  }
}

function Saved({ msg, err }: { msg: string; err: string }) {
  if (err) return <p className="mt-3 text-sm font-semibold text-[#b42318]">{err}</p>;
  if (msg) return <p className="mt-3 text-sm font-semibold text-[#0c7a40]">{msg}</p>;
  return null;
}

export function Onboarding(p: OnboardingProps) {
  const router = useRouter();
  const nextKey = (steps: Step[]) =>
    steps.find(
      (s) =>
        !s.done &&
        (s.by === "rep" || p.office) &&
        !(s.key === "agreement" && p.agreement.status === "draft") &&
        !((s.key === "w9" || s.key === "bank") && !p.piiReady),
    )?.key ?? null;
  const asked = p.steps.find((s) => s.key === p.initialStep)?.key ?? null;
  const [open, setOpen] = useState<string | null>(asked ?? nextKey(p.steps));
  // When the step you just finished turns green, open the next one.
  const doneKeys = p.steps.filter((s) => s.done).map((s) => s.key).join(",");
  const lastDone = useRef(doneKeys);
  useEffect(() => {
    if (doneKeys !== lastDone.current) {
      lastDone.current = doneKeys;
      setOpen(nextKey(p.steps));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKeys]);
  const done = p.steps.filter((s) => s.done).length;
  const refresh = () => router.refresh();
  const who = p.self ? "you" : p.name.split(" ")[0];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-gray-600">
          <strong className="text-[#0b0e13]">{done} of {p.steps.length}</strong> done
          {done === p.steps.length ? (p.self ? ". You're set." : ". All set.") : ""}
        </p>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {p.steps.map((s) => (
          <span key={s.key} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-[#0c7a40]" : "bg-[#e3e6ea]"}`} />
        ))}
      </div>

      <ol className="mt-5 space-y-3">
        {p.steps.map((s, i) => {
          const isOpen = open === s.key;
          return (
            <li key={s.key} className="rounded-lg border border-[#e3e6ea] bg-white">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.key)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                aria-expanded={isOpen}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-[#0c7a40] text-white" : "border border-[#d7dbe0] text-gray-500"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[#0b0e13]">
                    {s.label}
                    {s.by === "office" ? <span className="ml-1.5 text-xs font-normal text-gray-400">office</span> : null}
                  </span>
                  <span className="block text-sm text-gray-500">{s.detail}</span>
                </span>
                <span className="mt-1 text-gray-400">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen ? (
                <div className="border-t border-[#eceef1] px-4 pb-5 pt-4">
                  {s.key === "profile" ? <ProfileStep p={p} onSaved={refresh} /> : null}
                  {s.key === "agreement" ? <AgreementStep p={p} onSaved={refresh} /> : null}
                  {s.key === "w9" ? <TaxStep p={p} onSaved={refresh} /> : null}
                  {s.key === "bank" ? <BankStep p={p} onSaved={refresh} /> : null}
                  {s.key === "training" ? <TrainingStep p={p} onSaved={refresh} /> : null}
                  {s.key === "permits" ? <PermitStep p={p} onSaved={refresh} /> : null}
                  {s.key === "ride_along" || s.key === "gear" ? <OfficeStep p={p} which={s.key} done={s.done} onSaved={refresh} who={who} /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

function ProfileStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const [f, setF] = useState(p.profile);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setF({ ...f, photo_jpeg: await toJpeg(file) });
    } catch {
      setErr("Couldn't read that photo. Try another.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await post({ action: "profile", member_id: p.memberId, ...f });
      setMsg("Saved.");
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        {f.photo_jpeg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.photo_jpeg} alt="Badge photo" className="h-20 w-20 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-[#f1f3f5] text-xs text-gray-400">No photo</span>
        )}
        <label className={`${quiet} cursor-pointer`}>
          {f.photo_jpeg ? "Retake photo" : "Take badge photo"}
          <input type="file" accept="image/*" capture="user" onChange={photo} className="hidden" />
        </label>
        <span className="w-full text-xs text-gray-500">Plain background, face the camera. Used for your badge and permit applications.</span>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="o-name">Legal name (as on your ID)</label>
        <input id="o-name" className={input} value={f.legal_name} onChange={set("legal_name")} autoComplete="name" />
      </div>
      <div>
        <label className={label} htmlFor="o-phone">Mobile</label>
        <input id="o-phone" className={input} value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
      </div>
      <div>
        <label className={label} htmlFor="o-shirt">Shirt size</label>
        <select id="o-shirt" className={input} value={f.shirt_size} onChange={set("shirt_size")}>
          <option value="">Pick one</option>
          {["S", "M", "L", "XL", "2XL", "3XL"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="o-addr">Home address</label>
        <input id="o-addr" className={input} value={f.address} onChange={set("address")} autoComplete="street-address" />
      </div>
      <div className="grid grid-cols-[1fr_4.5rem_6rem] gap-2 sm:col-span-2">
        <input className={input} value={f.city} onChange={set("city")} placeholder="City" aria-label="City" autoComplete="address-level2" />
        <input className={input} value={f.state} onChange={set("state")} placeholder="TX" aria-label="State" maxLength={2} />
        <input className={input} value={f.zip} onChange={set("zip")} placeholder="ZIP" aria-label="ZIP" inputMode="numeric" />
      </div>
      <div>
        <label className={label} htmlFor="o-ec">Emergency contact</label>
        <input id="o-ec" className={input} value={f.emergency_name} onChange={set("emergency_name")} placeholder="Name" />
      </div>
      <div>
        <label className={label} htmlFor="o-ecp">Their phone</label>
        <input id="o-ecp" className={input} value={f.emergency_phone} onChange={set("emergency_phone")} inputMode="tel" />
      </div>
      <div className="sm:col-span-2">
        <button className={primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <Saved msg={msg} err={err} />
      </div>
    </form>
  );
}

function AgreementStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const a = p.agreement;
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const inked = useRef(false);
  const [typed, setTyped] = useState(p.profile.legal_name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b0e13";
  }, [a.status, p.self]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  async function sign() {
    setErr("");
    if (!inked.current) return setErr("Sign in the box.");
    setBusy(true);
    try {
      await post({ action: "agreement", typed_name: typed, signature_png: canvas.current!.toDataURL("image/png") });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="max-h-[55vh] overflow-y-auto rounded-md border border-[#eceef1] bg-[#fafbfc] p-4 text-sm leading-relaxed text-[#3b424e]">
        <p className="font-display text-base font-bold text-[#0b0e13]">{a.title}</p>
        <p className="text-xs text-gray-500">Version {a.version}</p>
        {a.sections.map((s) => (
          <div key={s.h} className="mt-4">
            <p className="font-semibold text-[#0b0e13]">{s.h}</p>
            {s.h === "Compensation Schedule" ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {s.p.map((x) => <li key={x}>{x}</li>)}
              </ul>
            ) : (
              s.p.map((x) => <p key={x} className="mt-1">{x}</p>)
            )}
          </div>
        ))}
      </div>

      {a.signedAt ? (
        <p className="mt-3 text-sm text-gray-600">
          Signed by <strong className="text-[#0b0e13]">{a.signedName}</strong> on{" "}
          {new Date(a.signedAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })}
          {p.steps.find((s) => s.key === "agreement")?.done ? "." : ", on an earlier version."}
        </p>
      ) : null}

      {a.status === "draft" ? (
        <p className="mt-3 rounded-md bg-[#fff8e6] px-3 py-2 text-sm text-[#7a4b00]">
          {p.office
            ? "Draft. Signing opens once counsel has cleared it and the office switches it to final."
            : "This opens for signing once the office finalizes it. Read it now; you'll get a heads-up."}
        </p>
      ) : p.self && !p.steps.find((s) => s.key === "agreement")?.done ? (
        <div className="mt-4">
          <label className={label} htmlFor="o-typed">Type your full legal name</label>
          <input id="o-typed" className={input} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <p className={`${label} mt-3`}>Sign below</p>
          <canvas
            ref={canvas}
            className="h-36 w-full touch-none rounded-md border border-[#d7dbe0] bg-white"
            onPointerDown={(e) => {
              drawing.current = true;
              const ctx = canvas.current!.getContext("2d")!;
              const { x, y } = pos(e);
              ctx.beginPath();
              ctx.moveTo(x, y);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvas.current!.getContext("2d")!;
              const { x, y } = pos(e);
              ctx.lineTo(x, y);
              ctx.stroke();
              inked.current = true;
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className={primary} onClick={sign} disabled={busy}>{busy ? "Signing…" : "Sign the agreement"}</button>
            <button
              type="button"
              className="text-sm font-semibold text-gray-500 underline"
              onClick={() => {
                const c = canvas.current!;
                c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
                inked.current = false;
              }}
            >
              Clear
            </button>
          </div>
          <Saved msg="" err={err} />
        </div>
      ) : null}
    </div>
  );
}

const TAX_CLASSES = [
  ["individual", "Individual or sole proprietor"],
  ["llc_single", "Single-member LLC"],
  ["llc_partnership", "LLC taxed as a partnership"],
  ["llc_s", "LLC taxed as an S corporation"],
  ["llc_c", "LLC taxed as a C corporation"],
  ["s_corp", "S corporation"],
  ["c_corp", "C corporation"],
  ["partnership", "Partnership"],
];

function TaxStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const [f, setF] = useState({
    legal_name: p.profile.legal_name, business_name: "", tax_class: "individual",
    address: p.profile.address, city: p.profile.city, state: p.profile.state || "TX", zip: p.profile.zip,
    tin_type: "ssn", tin: "", certified_name: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  if (p.tax.on && !p.self) return <Reveal p={p} field="tin" label={`${(p.tax.type || "ssn").toUpperCase()} ending ${p.tax.last4}`} note={`Certified by ${p.tax.name}.`} />;
  if (!p.self) return <p className="text-sm text-gray-500">{p.name.split(" ")[0]} fills this in themselves.</p>;
  if (!p.piiReady) return <p className="text-sm text-[#7a4b00]">Secure storage isn&apos;t switched on yet. The office is on it; check back soon.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await post({ action: "tax", ...f });
      setF({ ...f, tin: "" });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      {p.tax.on ? (
        <p className="sm:col-span-2 text-sm text-gray-600">
          On file: {(p.tax.type || "ssn").toUpperCase()} ending <strong>{p.tax.last4}</strong>. Fill this in again only to change it.
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <label className={label} htmlFor="t-name">Name (as on your tax return)</label>
        <input id="t-name" className={input} value={f.legal_name} onChange={set("legal_name")} />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="t-biz">Business name, if different (optional)</label>
        <input id="t-biz" className={input} value={f.business_name} onChange={set("business_name")} />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="t-class">Tax classification</label>
        <select id="t-class" className={input} value={f.tax_class} onChange={set("tax_class")}>
          {TAX_CLASSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="t-addr">Address</label>
        <input id="t-addr" className={input} value={f.address} onChange={set("address")} />
      </div>
      <div className="grid grid-cols-[1fr_4.5rem_6rem] gap-2 sm:col-span-2">
        <input className={input} value={f.city} onChange={set("city")} placeholder="City" aria-label="City" />
        <input className={input} value={f.state} onChange={set("state")} placeholder="TX" aria-label="State" maxLength={2} />
        <input className={input} value={f.zip} onChange={set("zip")} placeholder="ZIP" aria-label="ZIP" inputMode="numeric" />
      </div>
      <div className="sm:col-span-2">
        <span className={label}>Taxpayer ID</span>
        <div className="flex gap-2">
          {["ssn", "ein"].map((t) => (
            <button key={t} type="button" onClick={() => setF({ ...f, tin_type: t })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.tin_type === t ? "bg-[#0b0e13] text-white" : "border border-[#d7dbe0] text-[#3b424e]"}`}>
              {t === "ssn" ? "SSN" : "EIN"}
            </button>
          ))}
        </div>
        <input className={`${input} mt-2`} value={f.tin} onChange={set("tin")} inputMode="numeric" autoComplete="off"
          placeholder={f.tin_type === "ssn" ? "123-45-6789" : "12-3456789"} aria-label="Taxpayer ID number" />
        <p className="mt-1 text-xs text-gray-500">Sent over a secure connection and encrypted before it&apos;s stored. The office sees only the last four.</p>
      </div>
      <div className="sm:col-span-2 rounded-md bg-[#fafbfc] p-3 text-xs leading-relaxed text-gray-600">
        Under penalties of perjury, I certify that: (1) the number above is my correct taxpayer identification number;
        (2) I am not subject to backup withholding, or the IRS has told me I am no longer subject to it; (3) I am a U.S.
        citizen or other U.S. person; and (4) any FATCA code entered is correct (none applies here). Cross out item 2 by
        telling the office if the IRS has notified you that you are subject to backup withholding.
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="t-cert">Type your name exactly as above to certify</label>
        <input id="t-cert" className={input} value={f.certified_name} onChange={set("certified_name")} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <button className={primary} disabled={busy}>{busy ? "Saving…" : "Certify and save"}</button>
        <Saved msg="" err={err} />
      </div>
    </form>
  );
}

function BankStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const [f, setF] = useState({ holder_name: p.profile.legal_name, routing: "", account: "", account_confirm: "", account_type: "checking" });
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (p.bank.on && !p.self) return <Reveal p={p} field="account" label={`${p.bank.type} ending ${p.bank.last4}`} note={`Routing ${p.bank.routing}.`} />;
  if (!p.self) return <p className="text-sm text-gray-500">{p.name.split(" ")[0]} fills this in themselves.</p>;
  if (!p.piiReady) return <p className="text-sm text-[#7a4b00]">Secure storage isn&apos;t switched on yet. The office is on it; check back soon.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await post({ action: "bank", ...f, authorize: ok });
      setF({ ...f, account: "", account_confirm: "" });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      {p.bank.on ? (
        <p className="sm:col-span-2 text-sm text-gray-600">
          On file: {p.bank.type} account ending <strong>{p.bank.last4}</strong>. Fill this in again only to change it.
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <label className={label} htmlFor="b-holder">Name on the account</label>
        <input id="b-holder" className={input} value={f.holder_name} onChange={set("holder_name")} />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        {["checking", "savings"].map((t) => (
          <button key={t} type="button" onClick={() => setF({ ...f, account_type: t })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${f.account_type === t ? "bg-[#0b0e13] text-white" : "border border-[#d7dbe0] text-[#3b424e]"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="b-routing">Routing number</label>
        <input id="b-routing" className={input} value={f.routing} onChange={set("routing")} inputMode="numeric" autoComplete="off" placeholder="9 digits" />
      </div>
      <div>
        <label className={label} htmlFor="b-acct">Account number</label>
        <input id="b-acct" className={input} value={f.account} onChange={set("account")} inputMode="numeric" autoComplete="off" />
      </div>
      <div>
        <label className={label} htmlFor="b-acct2">Account number again</label>
        <input id="b-acct2" className={input} value={f.account_confirm} onChange={set("account_confirm")} inputMode="numeric" autoComplete="off" />
      </div>
      <label className="sm:col-span-2 flex items-start gap-2.5 text-sm text-gray-600">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1 h-4 w-4" />
        I authorize Power Edge, LLC to deposit my commission into this account, and to correct a deposit made in error.
      </label>
      <div className="sm:col-span-2">
        <button className={primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <Saved msg="" err={err} />
      </div>
    </form>
  );
}

function TrainingStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; of: number; passed: boolean; misses: Array<{ id: string; q: string; why: string }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function markRead() {
    setBusy(true);
    try {
      await post({ action: "playbook" });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(answers).length < p.quiz.length) return setErr("Answer every question.");
    setBusy(true);
    setErr("");
    try {
      const r = await post({ action: "quiz", answers });
      setResult(r);
      if (r.passed) onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-600">Read these first. They&apos;re short, and every rule in the check comes from them.</p>
      <ul className="mt-3 divide-y divide-[#eceef1] rounded-md border border-[#eceef1]">
        {p.docs.map((d) => (
          <li key={d.file} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0b0e13]">{d.name}</span>
              <span className="block text-xs text-gray-500">{d.why}</span>
            </span>
            <a href={`/sales/doc/${d.file}`} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-[#0c7a40] underline">Open</a>
          </li>
        ))}
      </ul>

      {!p.self ? (
        <p className="mt-4 text-sm text-gray-600">
          {p.training.passed ? "Passed the check." : `Check: ${p.training.attempts} attempt${p.training.attempts === 1 ? "" : "s"}, best ${p.training.best ?? 0}/10.`}
        </p>
      ) : !p.training.playbookRead ? (
        <button type="button" className={`${primary} mt-4`} onClick={markRead} disabled={busy}>I&apos;ve read them</button>
      ) : p.training.passed && !result ? (
        <p className="mt-4 text-sm font-semibold text-[#0c7a40]">You passed the compliance check.</p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <p className="text-sm font-semibold text-[#0b0e13]">Compliance check: all 10 right to pass. Take it as many times as you need.</p>
          {p.quiz.map((q, i) => {
            const missed = result?.misses.find((m) => m.id === q.id);
            return (
              <fieldset key={q.id} className={missed ? "rounded-md bg-[#fff4f2] p-3" : ""}>
                <legend className="text-sm font-semibold text-[#0b0e13]">{i + 1}. {q.q}</legend>
                <div className="mt-2 space-y-1.5">
                  {q.choices.map((c, j) => (
                    <label key={j} className="flex items-start gap-2.5 text-sm text-[#3b424e]">
                      <input type="radio" name={q.id} checked={answers[q.id] === j} onChange={() => setAnswers({ ...answers, [q.id]: j })} className="mt-1 h-4 w-4" />
                      {c}
                    </label>
                  ))}
                </div>
                {missed ? <p className="mt-2 text-sm text-[#b42318]">{missed.why}</p> : null}
              </fieldset>
            );
          })}
          <button className={primary} disabled={busy}>{busy ? "Checking…" : "Check my answers"}</button>
          {result ? (
            <p className={`text-sm font-semibold ${result.passed ? "text-[#0c7a40]" : "text-[#b42318]"}`}>
              {result.passed ? `${result.score} of ${result.of}. Passed.` : `${result.score} of ${result.of}. The ones in red explain the rule; fix them and check again.`}
            </p>
          ) : null}
          <Saved msg="" err={err} />
        </form>
      )}
    </div>
  );
}

function PermitStep({ p, onSaved }: { p: OnboardingProps; onSaved: () => void }) {
  const [add, setAdd] = useState("");
  const [err, setErr] = useState("");
  const have = new Set(p.permits.map((x) => x.city));

  async function save(body: Record<string, unknown>) {
    setErr("");
    try {
      await post({ action: "permit", member_id: p.memberId, ...body });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-600">
        Each city issues its own permit, by city limits. The ticket for knocking without one (up to $500) goes to the rep.
      </p>
      <ul className="mt-3 space-y-3">
        {p.permits.map((x) => (
          <PermitRow key={x.city} x={x} how={p.cities.find((c) => c.city === x.city)?.how ?? ""} onSave={save} />
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <select className={input} value={add} onChange={(e) => setAdd(e.target.value)} aria-label="Add a city">
          <option value="">Add a city you&apos;ll knock in</option>
          {p.cities.filter((c) => !have.has(c.city)).map((c) => <option key={c.city}>{c.city}</option>)}
        </select>
        <button type="button" className={quiet} disabled={!add} onClick={() => { save({ city: add, status: "needed" }); setAdd(""); }}>Add</button>
      </div>
      <Saved msg="" err={err} />
    </div>
  );
}

function PermitRow({ x, how, onSave }: { x: Permit; how: string; onSave: (b: Record<string, unknown>) => void }) {
  const [num, setNum] = useState(x.permit_number ?? "");
  const [exp, setExp] = useState(x.expires_on ?? "");
  const tone = x.status === "approved" || x.status === "not_required" ? "text-[#0c7a40]" : x.status === "applied" ? "text-[#7a4b00]" : "text-gray-500";
  return (
    <li className="rounded-md border border-[#eceef1] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-[#0b0e13]">{x.city}</span>
        <select value={x.status} onChange={(e) => onSave({ city: x.city, status: e.target.value })}
          className={`rounded-md border border-[#d7dbe0] bg-white px-2 py-1 text-sm font-semibold ${tone}`} aria-label={`${x.city} permit status`}>
          <option value="needed">Need to apply</option>
          <option value="applied">Applied, waiting</option>
          <option value="approved">Have it</option>
          <option value="not_required">Not required</option>
        </select>
      </div>
      {how ? <p className="mt-1 text-xs text-gray-500">{how}</p> : null}
      {x.status === "approved" ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className={input} value={num} onChange={(e) => setNum(e.target.value)} placeholder="Permit number" aria-label={`${x.city} permit number`} />
          <input className={input} type="date" value={exp} onChange={(e) => setExp(e.target.value)} aria-label={`${x.city} permit expires`} />
          <button type="button" className={`${quiet} col-span-2`} onClick={() => onSave({ city: x.city, status: x.status, permit_number: num, expires_on: exp })}>
            Save permit details
          </button>
        </div>
      ) : null}
      <button type="button" className="mt-2 text-xs font-semibold text-gray-400 underline" onClick={() => onSave({ city: x.city, remove: true })}>
        Remove {x.city}
      </button>
    </li>
  );
}

function OfficeStep({ p, which, done, onSaved, who }: { p: OnboardingProps; which: "ride_along" | "gear"; done: boolean; onSaved: () => void; who: string }) {
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(p.officeInfo.notes);
  const [err, setErr] = useState("");
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    try {
      await post({ action: "office", member_id: p.memberId, ...body });
      onSaved();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!p.office) {
    return (
      <p className="text-sm text-gray-600">
        {which === "ride_along"
          ? done ? "Done. You're cleared to knock on your own." : "Your lead will set up a day in the field with you before you knock alone."
          : done ? "Issued." : "The office hands you your badge, shirt, door hangers and appointment cards."}
      </p>
    );
  }
  return (
    <div>
      <button type="button" className={done ? quiet : primary} disabled={busy}
        onClick={() => save(which === "ride_along" ? { ride_along: !done } : { gear: !done })}>
        {which === "ride_along" ? (done ? "Undo ride-along sign-off" : `Sign off ${who}'s ride-along`) : done ? "Undo" : `Mark gear issued to ${who}`}
      </button>
      {which === "gear" ? (
        <div className="mt-4">
          <label className={label} htmlFor="o-notes">Office notes</label>
          <textarea id="o-notes" className={`${input} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className={`${quiet} mt-2`} disabled={busy} onClick={() => save({ office_notes: notes })}>Save notes</button>
        </div>
      ) : null}
      <Saved msg="" err={err} />
    </div>
  );
}

function Reveal({ p, field, label: what, note }: { p: OnboardingProps; field: "tin" | "account"; label: string; note: string }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  async function show() {
    setErr("");
    const res = await fetch("/api/onboarding/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: p.memberId, field }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.ok) return setErr(d.error || "Couldn't show it.");
    setValue(d.value);
    setTimeout(() => setValue(""), 30_000);
  }
  return (
    <div className="text-sm text-gray-600">
      <p>
        On file: <strong className="text-[#0b0e13]">{what}</strong>. {note}
      </p>
      {value ? (
        <p className="mt-2 font-mono text-base tracking-wider text-[#0b0e13]">{value}</p>
      ) : (
        <button type="button" className={`${quiet} mt-2`} onClick={show}>Show full number</button>
      )}
      <p className="mt-1 text-xs text-gray-400">Showing it is logged with your name. It hides again after 30 seconds.</p>
      <Saved msg="" err={err} />
    </div>
  );
}
