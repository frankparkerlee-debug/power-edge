"use client";

import { useRef, useState } from "react";

/**
 * Field agreement, filled on a phone at the kitchen table.
 *
 * Deliberately short. A rep standing in someone's living room is not going to
 * work through twenty fields, so this captures only what changes per job and
 * lets the fixed terms live in the agreement itself. The signature is a canvas
 * because asking a homeowner to type their name is not a signature anyone
 * wants to rely on later.
 */

type Line = { description: string; price: string };

export function ContractForm({ repDefault = "" }: { repDefault?: string }) {
  const [rep, setRep] = useState(repDefault);
  const [owner, setOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [claimBased, setClaimBased] = useState(true);
  const [carrier, setCarrier] = useState("");
  const [claimNo, setClaimNo] = useState("");
  const [deductible, setDeductible] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { description: "", price: "" },
    { description: "", price: "" },
  ]);
  const [total, setTotal] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ cancelBy: string; emailed: boolean } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [gaveNotices, setGaveNotices] = useState(false);
  const [error, setError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

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
  function end() {
    drawing.current = false;
  }
  function clearSig() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }

  async function sendForSignature() {
    setError("");
    if (!owner.trim() || !address.trim()) {
      setError("Homeowner name and property address are needed before sending.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": new URLSearchParams(window.location.search).get("key") || "",
        },
        body: JSON.stringify({
          mode: "send",
          rep,
          owner_names: owner,
          owner_phone: phone,
          owner_email: email,
          property_address: address,
          claim_based: claimBased,
          carrier,
          claim_number: claimNo,
          deductible,
          scope: lines.filter((l) => l.description.trim()),
          total_price: total,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Could not create the link.");
        return;
      }
      setSent(d.signUrl);
    } catch {
      setError("Network problem. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hasInk.current) {
      setError("Have the homeowner sign before you submit.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": new URLSearchParams(window.location.search).get("key") || "",
        },
        body: JSON.stringify({
          rep,
          owner_names: owner,
          owner_phone: phone,
          owner_email: email,
          property_address: address,
          claim_based: claimBased,
          carrier,
          claim_number: claimNo,
          deductible,
          scope: lines.filter((l) => l.description.trim()),
          total_price: total,
          signer_name: owner,
          signature_png: canvasRef.current!.toDataURL("image/png"),
          notices_delivered: gaveNotices,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Could not save. Check signal and try again.");
        return;
      }
      setDone({ cancelBy: d.cancelBy, emailed: d.emailed });
    } catch {
      setError("Network problem. Nothing was saved, try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-md border border-gray-300 px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none";
  const label = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1";

  if (sent) {
    return (
      <div className="rounded-lg border border-[#0c7a40] bg-[#f0fbf4] p-6">
        <h2 className="font-display text-xl font-extrabold">Link ready to send.</h2>
        <p className="mt-2 text-sm">
          Text or email this to the homeowner. They read the agreement and sign on
          their own device, and their cancellation window starts when they sign,
          not now.
        </p>
        <input
          readOnly
          value={sent}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-[13px]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`sms:?&body=${encodeURIComponent(`Your PowerEdge agreement is ready to review and sign: ${sent}`)}`}
            className="rounded-md bg-[#0c7a40] px-4 py-2.5 font-bold text-white"
          >
            Text it
          </a>
          <button
            onClick={() => navigator.clipboard?.writeText(sent)}
            className="rounded-md border border-gray-300 px-4 py-2.5 font-bold"
          >
            Copy link
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-gray-300 px-4 py-2.5 font-bold"
          >
            Start another
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-[#0c7a40] bg-[#f0fbf4] p-6">
        <h2 className="font-display text-xl font-extrabold">Signed and saved.</h2>
        <p className="mt-2 text-sm">
          The homeowner can cancel until midnight on <strong>{done.cancelBy}</strong>.
        </p>
        <p className="mt-2 text-sm">
          {done.emailed
            ? "A copy with their cancellation rights has been emailed to them."
            : "No email address was given, so hand them the printed copy with both cancellation notices."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md bg-[#0c7a40] px-5 py-2.5 font-bold text-white"
        >
          Start another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="c-owner">Homeowner name(s)</label>
          <input id="c-owner" required value={owner} onChange={(e) => setOwner(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="c-rep">Rep</label>
          <input id="c-rep" value={rep} onChange={(e) => setRep(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="c-phone">Phone</label>
          <input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="c-email">Email <span className="font-normal normal-case text-gray-400">(they get their copy here)</span></label>
          <input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="c-addr">Property address</label>
        <input id="c-addr" required value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={claimBased} onChange={(e) => setClaimBased(e.target.checked)} className="h-4 w-4" />
          This work is going through an insurance claim
        </label>
        {claimBased && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
      </div>

      <div>
        <span className={label}>Scope of work</span>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={l.description}
                placeholder="e.g. Tear off and replace roof, architectural shingle"
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...next[i], description: e.target.value };
                  setLines(next);
                }}
                className={`${input} flex-1`}
              />
              <input
                value={l.price}
                placeholder="$"
                onChange={(e) => {
                  const next = [...lines];
                  next[i] = { ...next[i], price: e.target.value };
                  setLines(next);
                }}
                className={`${input} w-28`}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines([...lines, { description: "", price: "" }])}
          className="mt-2 text-sm font-semibold text-[#0c7a40] underline"
        >
          Add a line
        </button>
      </div>

      <div className="sm:w-56">
        <label className={label} htmlFor="c-total">Total contract price</label>
        <input id="c-total" value={total} onChange={(e) => setTotal(e.target.value)} className={input} />
      </div>

      <div className="rounded-lg border-2 border-[#0b0e13] p-4">
        <p className="text-[13px] font-bold leading-snug">
          Read this to the homeowner before they sign: you may cancel this transaction at any
          time prior to midnight of the third business day after today, without penalty or
          obligation. We will email you that right in writing along with this agreement.
        </p>
      </div>

      <div>
        <span className={label}>Homeowner signature</span>
        <canvas
          ref={canvasRef}
          width={640}
          height={200}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none rounded-md border border-gray-300 bg-white"
          style={{ height: 160 }}
        />
        <button type="button" onClick={clearSig} className="mt-1 text-sm text-gray-500 underline">
          Clear
        </button>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 text-sm">
        <input
          type="checkbox"
          checked={gaveNotices}
          onChange={(e) => setGaveNotices(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          I gave the homeowner <strong>both printed cancellation notices</strong>.
          The email is a copy, not a replacement, so hand them the paper.
        </span>
      </label>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-[#0c7a40] px-6 py-4 font-display text-lg font-bold text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "They are signing now"}
      </button>
      <button
        type="button"
        onClick={sendForSignature}
        disabled={busy}
        className="w-full rounded-md border-2 border-[#0c7a40] px-6 py-3.5 font-display font-bold text-[#0c7a40] disabled:opacity-60"
      >
        Send them a link to sign later
      </button>
    </form>
  );
}
