"use client";

import { useRef, useState } from "react";

/**
 * Writing an agreement, in three short steps.
 *
 * The first version was one 1,574px scroll of fifteen inputs with two
 * competing submit buttons at the very bottom, so a rep filled in everything
 * before discovering which thing they were doing, and a signature pad rendered
 * even when they meant to send a link.
 *
 * Now the path is chosen before anything is asked, and each step asks only
 * what that path needs. On a phone at a front door, a short screen you can
 * finish beats a long one you have to survey.
 */

type Line = { description: string; price: string };
type Step = 1 | 2 | 3;

const COST_PER_SQUARE = 275; // Parker, 2026-11-09: this is our cost.

export function ContractForm({ repDefault = "" }: { repDefault?: string }) {
  const [step, setStep] = useState<Step>(1);

  const [rep] = useState(repDefault);
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [claimBased, setClaimBased] = useState(true);
  const [carrier, setCarrier] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const [deductible, setDeductible] = useState("");
  const [squares, setSquares] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", price: "" }]);
  const [total, setTotal] = useState("");

  const [gaveNotices, setGaveNotices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [done, setDone] = useState<{ cancelBy: string; emailed: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  // --- signature pad ---
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b0e13";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  }
  function clearSig() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }

  const payload = () => ({
    rep,
    owner_names: owner,
    owner_phone: phone,
    owner_email: email,
    property_address: address,
    claim_based: claimBased,
    carrier,
    claim_number: claimNo,
    deductible,
    squares: squares ? Number(squares) : undefined,
    scope: lines.filter((l) => l.description.trim()),
    total_price: total,
  });

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json() };
  }

  async function sendLink() {
    setError("");
    setBusy(true);
    try {
      const { res, data } = await post({ ...payload(), mode: "send" });
      if (!res.ok || !data.ok) return setError(data.error || "Could not create the link.");
      setSent(data.signUrl);
    } catch {
      setError("Network problem. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  async function signNow() {
    setError("");
    if (!hasInk.current) return setError("Have the homeowner sign before you submit.");
    setBusy(true);
    try {
      const { res, data } = await post({
        ...payload(),
        signer_name: owner,
        notices_delivered: gaveNotices,
        signature_png: canvasRef.current!.toDataURL("image/png"),
      });
      if (!res.ok || !data.ok) return setError(data.error || "Could not save.");
      setDone(data);
    } catch {
      setError("Network problem. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  // --- shared styles ---
  const input =
    "w-full rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none";
  const label = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";
  const primary =
    "w-full rounded-md bg-[#0c7a40] px-6 py-3.5 font-display text-base font-bold text-white disabled:opacity-60";
  const ghost =
    "w-full rounded-md border border-[#d7dbe0] px-6 py-3 font-display font-bold text-[#3b424e]";

  // --- terminal states ---
  if (sent) {
    return (
      <div className="rounded-lg border-2 border-[#0c7a40] bg-[#f0fbf4] p-5">
        <h2 className="font-display text-xl font-extrabold">Link ready.</h2>
        <p className="mt-1.5 text-sm">
          Send it to {owner || "the homeowner"}. Their cancellation window starts when they
          sign, not now.
        </p>
        <input
          readOnly
          value={sent}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-md border border-[#d7dbe0] bg-white px-3 py-2.5 text-[13px]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`sms:?&body=${encodeURIComponent(`Your PowerEdge agreement is ready to review and sign: ${sent}`)}`}
            className="rounded-md bg-[#0c7a40] px-4 py-2.5 font-bold text-white"
          >
            Text it
          </a>
          <button onClick={() => navigator.clipboard?.writeText(sent)} className="rounded-md border border-[#d7dbe0] px-4 py-2.5 font-bold">
            Copy
          </button>
          <button onClick={() => window.location.reload()} className="rounded-md border border-[#d7dbe0] px-4 py-2.5 font-bold">
            New agreement
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border-2 border-[#0c7a40] bg-[#f0fbf4] p-5">
        <h2 className="font-display text-xl font-extrabold">Signed.</h2>
        <p className="mt-1.5 text-sm">
          {owner} can cancel until midnight on <strong>{done.cancelBy}</strong>.
        </p>
        <p className="mt-2 text-sm">
          {done.emailed
            ? "Their copy, with the cancellation notice, has been emailed."
            : "No email address, so make sure they have the printed copy and both cancellation notices."}
        </p>
        <button onClick={() => window.location.reload()} className="mt-4 rounded-md bg-[#0c7a40] px-5 py-2.5 font-bold text-white">
          New agreement
        </button>
      </div>
    );
  }

  // --- live commission maths, so the rep sees their own number before the
  //     homeowner signs rather than working it out in a truck afterwards ---
  const sq = Number(squares) || 0;
  const collected = Number(String(total).replace(/[^0-9.]/g, "")) || 0;
  const gp = sq > 0 && collected > 0 ? collected - sq * COST_PER_SQUARE : 0;

  const stepOk =
    step === 1 ? owner.trim().length > 1 && address.trim().length > 4 : true;

  return (
    <div>
      {/* Where you are, and how much is left. */}
      <div className="mb-5 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step >= n ? "bg-[#0c7a40] text-white" : "bg-[#e3e6ea] text-gray-500"
              }`}
            >
              {n}
            </span>
            <span className={`text-xs font-semibold ${step === n ? "text-[#0b0e13]" : "text-gray-400"}`}>
              {n === 1 ? "Homeowner" : n === 2 ? "The work" : "Sign or send"}
            </span>
            {n < 3 && <span className="hidden h-px flex-1 bg-[#e3e6ea] sm:block" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="c-owner">Homeowner name(s)</label>
            <input id="c-owner" autoFocus value={owner} onChange={(e) => setOwner(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="c-addr">Property address</label>
            <input id="c-addr" value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="c-phone">Phone</label>
              <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="c-email">
                Email <span className="font-normal normal-case text-gray-400">their copy goes here</span>
              </label>
              <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </div>
          </div>
          <button onClick={() => setStep(2)} disabled={!stepOk} className={primary}>
            Next: the work
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setClaimBased(true)}
              className={`rounded-md border-2 p-3 text-left ${claimBased ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#e3e6ea]"}`}
            >
              <span className="block font-display font-bold">Insurance claim</span>
              <span className="block text-xs text-gray-600">Carrier sets the price</span>
            </button>
            <button
              onClick={() => setClaimBased(false)}
              className={`rounded-md border-2 p-3 text-left ${!claimBased ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#e3e6ea]"}`}
            >
              <span className="block font-display font-bold">Cash</span>
              <span className="block text-xs text-gray-600">We set the price</span>
            </button>
          </div>

          {claimBased && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="c-carrier">Carrier</label>
                <input id="c-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="c-claim">Claim #</label>
                <input id="c-claim" value={claimNo} onChange={(e) => setClaimNo(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="c-ded">Deductible</label>
                <input id="c-ded" value={deductible} onChange={(e) => setDeductible(e.target.value)} className={input} />
              </div>
            </div>
          )}

          <div>
            <span className={label}>Scope of work</span>
            {lines.map((l, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  value={l.description}
                  placeholder="Tear off and replace roof…"
                  onChange={(e) => {
                    const n = [...lines];
                    n[i] = { ...n[i], description: e.target.value };
                    setLines(n);
                  }}
                  className={`${input} flex-1`}
                />
                <input
                  value={l.price}
                  placeholder="$"
                  onChange={(e) => {
                    const n = [...lines];
                    n[i] = { ...n[i], price: e.target.value };
                    setLines(n);
                  }}
                  className={`${input} w-24`}
                />
              </div>
            ))}
            <button onClick={() => setLines([...lines, { description: "", price: "" }])} className="text-sm font-semibold text-[#0c7a40] underline">
              Add a line
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="c-sq">Squares</label>
              <input id="c-sq" inputMode="decimal" value={squares} onChange={(e) => setSquares(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="c-total">Total price</label>
              <input id="c-total" value={total} onChange={(e) => setTotal(e.target.value)} className={input} />
            </div>
          </div>

          {gp > 0 && (
            <div className="rounded-md border border-[#e3e6ea] bg-white p-3 text-sm">
              <span className="text-gray-600">
                {sq} sq × ${COST_PER_SQUARE} cost = ${(sq * COST_PER_SQUARE).toLocaleString()}
              </span>
              <span className="ml-2 font-bold text-[#0b0e13]">
                Gross profit ${gp.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className={ghost}>Back</button>
            <button onClick={() => setStep(3)} className={primary}>Next: sign or send</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-md border border-[#e3e6ea] bg-white p-4 text-sm">
            <div className="font-display font-bold text-[#0b0e13]">{owner}</div>
            <div className="text-gray-600">{address}</div>
            <div className="mt-1 text-gray-600">
              {claimBased ? "Insurance claim" : "Cash"}
              {total ? ` · ${total}` : ""}
            </div>
          </div>

          <button onClick={sendLink} disabled={busy} className={primary}>
            {busy ? "Working…" : "Send them a link to sign"}
          </button>
          <p className="text-center text-xs text-gray-500">
            They read it and sign on their own phone. Their cancellation window starts then.
          </p>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-[#e3e6ea]" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">or sign here now</span>
            <span className="h-px flex-1 bg-[#e3e6ea]" />
          </div>

          <div>
            <span className={label}>Homeowner signature</span>
            <canvas
              ref={canvasRef}
              width={640}
              height={200}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={() => (drawing.current = false)}
              onPointerLeave={() => (drawing.current = false)}
              className="w-full touch-none rounded-md border border-[#d7dbe0] bg-white"
              style={{ height: 150 }}
            />
            <button type="button" onClick={clearSig} className="mt-1 text-sm text-gray-500 underline">
              Clear
            </button>
          </div>

          <label className="flex items-start gap-2.5 rounded-md border border-[#e3e6ea] bg-white p-3 text-sm">
            <input type="checkbox" checked={gaveNotices} onChange={(e) => setGaveNotices(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>I gave them <strong>both printed cancellation notices</strong>. The email is a copy, not a replacement.</span>
          </label>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className={ghost}>Back</button>
            <button onClick={signNow} disabled={busy} className={primary}>
              {busy ? "Saving…" : "Record signature"}
            </button>
          </div>
        </div>
      )}

      {error && step !== 3 && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}
