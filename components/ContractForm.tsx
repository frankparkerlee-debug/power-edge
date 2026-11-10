"use client";

import { useRef, useState } from "react";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { money, claimSplit } from "@/lib/money";

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

/**
 * What the homeowner is told the agreement is worth.
 *
 * Our cost per square used to be in this file so the rep could see the gross
 * profit on the screen while the homeowner watched. Parker pulled it on
 * 2026-11-10: a closer does not need the company's margin to close, and it
 * does not belong on a phone held at a kitchen table.
 */

export type ContractPrefill = {
  owner?: string;
  phone?: string;
  email?: string;
  address?: string;
  carrier?: string;
  claimNumber?: string;
  deductible?: string;
  claimBased?: boolean;
  squares?: string;
};

export function ContractForm({
  repDefault = "",
  prefill,
}: {
  repDefault?: string;
  prefill?: ContractPrefill;
}) {
  const [step, setStep] = useState<Step>(1);

  const [rep] = useState(repDefault);
  // Everything the CRM already knows arrives filled in. A closer opening this
  // from a job record was retyping the name, address, phone and email that
  // were on the screen they just left.
  const [owner, setOwner] = useState(prefill?.owner ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [address, setAddress] = useState(prefill?.address ?? "");

  const [claimBased, setClaimBased] = useState(prefill?.claimBased ?? true);
  const [carrier, setCarrier] = useState(prefill?.carrier ?? "");
  const [claimNo, setClaimNo] = useState(prefill?.claimNumber ?? "");
  const [deductible, setDeductible] = useState(prefill?.deductible ?? "");
  const [squares, setSquares] = useState(prefill?.squares ?? "");
  /**
   * Roofs are priced by the square, so that is how a closer enters one:
   * how many squares, then the rate. The amount follows. Asking for a lump
   * sum meant doing that multiplication in your head in a driveway.
   */
  const [pricePerSquare, setPricePerSquare] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", price: "" }]);
  /**
   * The rep typed line prices AND a separate total, with nothing connecting
   * them. Fill in a line at $18,400, hit next, and the agreement went out with
   * a blank contract price, because the total was its own untouched field.
   * The total is now the sum of the lines, and only becomes a free field once
   * the rep deliberately edits it (a claim job whose carrier number differs
   * from the line items still needs that).
   */
  const [totalEdited, setTotalEdited] = useState(false);
  const [totalRaw, setTotalRaw] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{
    url: string;
    id: string;
    emailed: boolean;
    emailedTo: string | null;
    emailError: string | null;
  } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendTo, setResendTo] = useState("");
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
      setSent({
        url: data.signUrl,
        id: data.id,
        emailed: !!data.emailed,
        emailedTo: data.emailedTo ?? null,
        emailError: data.emailError ?? null,
      });
      setResendTo(data.emailedTo || email || "");
    } catch {
      setError("Network problem. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!sent) return;
    setResending(true);
    try {
      const res = await fetch("/api/admin/contract/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sent.id, email: resendTo.trim() }),
      });
      const data = await res.json();
      setSent({
        ...sent,
        emailed: !!data.ok,
        emailedTo: data.emailedTo ?? resendTo.trim(),
        emailError: data.ok ? null : data.error || "That did not go through either.",
      });
    } catch {
      setSent({ ...sent, emailed: false, emailError: "Network problem." });
    } finally {
      setResending(false);
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
      <div
        className={`rounded-lg border-2 p-5 ${
          sent.emailed ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#b42318] bg-[#fef3f2]"
        }`}
      >
        <h2 className="font-display text-xl font-extrabold">
          {sent.emailed ? "Sent to the homeowner." : "Saved, but the email did not send."}
        </h2>

        {sent.emailed ? (
          <p className="mt-1.5 text-sm">
            {owner || "They"} will get it at <strong>{sent.emailedTo}</strong>. Their
            cancellation window starts when they sign, not now.
          </p>
        ) : (
          <p className="mt-1.5 text-sm">
            The agreement is saved and the link below works. {sent.emailError} Fix the
            address and send it again, or hand them the link yourself.
          </p>
        )}

        {/*
          The rep used to be handed a URL and left to text it from their own
          phone. Now we send it, and if we could not, we say so here rather
          than letting them walk away assuming the homeowner has it.
        */}
        {!sent.emailed && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={resendTo}
              onChange={(e) => setResendTo(e.target.value)}
              placeholder="their@email.com"
              className="min-w-0 flex-1 rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px]"
            />
            <button
              onClick={resend}
              disabled={resending || !resendTo.trim()}
              className="rounded-md bg-[#0c7a40] px-4 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {resending ? "Sending..." : "Send again"}
            </button>
          </div>
        )}

        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">
          Or send the link yourself
        </p>
        <input
          readOnly
          value={sent.url}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-md border border-[#d7dbe0] bg-white px-3 py-2.5 text-[13px]"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`sms:?&body=${encodeURIComponent(`Your PowerEdge agreement is ready to review and sign: ${sent.url}`)}`}
            className="rounded-md border border-[#d7dbe0] bg-white px-4 py-2.5 font-bold"
          >
            Text it
          </a>
          <button
            onClick={() => navigator.clipboard?.writeText(sent.url)}
            className="rounded-md border border-[#d7dbe0] bg-white px-4 py-2.5 font-bold"
          >
            Copy
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-[#d7dbe0] bg-white px-4 py-2.5 font-bold"
          >
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

  const money = (v: unknown) => Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;
  const sq = money(squares);
  const rate = money(pricePerSquare);
  /** The roof itself: squares times the rate. */
  const roofAmount = sq * rate;
  /** Anything else on the job: gutters, fascia, decking, a chimney. */
  const linesSum = lines.reduce((n, l) => n + money(l.price), 0);
  const computed = roofAmount + linesSum;
  /**
   * The contract price adds itself up, line by line, and the rep can still
   * override it. An insurance job settles at whatever the carrier approved,
   * which is frequently not what the line items come to.
   */
  const total = totalEdited ? totalRaw : computed > 0 ? String(computed) : "";
  const collected = money(total);

  /**
   * Step 2 had no validation, so a rep could walk straight through to "sign or
   * send" and put a binding agreement in front of a homeowner with no scope
   * and no contract price on it. A signed agreement that does not state what
   * the work is or what it costs is not one you want to rely on.
   */
  const scopeOk =
    (sq > 0 && rate > 0) || lines.some((l) => l.description.trim().length > 2);
  const priceOk = collected > 0;
  const stepOk =
    step === 1
      ? owner.trim().length > 1 && address.trim().length > 4
      : step === 2
        ? scopeOk && priceOk
        : true;

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
            {/*
              Typed by hand, this is where the record goes wrong. The address is
              the key everything else joins on, so one transposed house number
              puts the agreement on a different job from the inspection.
            */}
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              onSelect={setAddress}
              placeholder="Start typing the address"
              className={input}
            />
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

          {/* The roof, priced the way a roof is priced. */}
          <div className="rounded-md border border-[#e3e6ea] bg-white p-3">
            <span className={label}>The roof</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500" htmlFor="c-sq">
                  Squares
                </label>
                <input
                  id="c-sq"
                  inputMode="decimal"
                  placeholder="30"
                  value={squares}
                  onChange={(e) => setSquares(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500" htmlFor="c-rate">
                  Price per square
                </label>
                <input
                  id="c-rate"
                  inputMode="decimal"
                  placeholder="450"
                  value={pricePerSquare}
                  onChange={(e) => setPricePerSquare(e.target.value)}
                  className={input}
                />
              </div>
            </div>
            {roofAmount > 0 && (
              <p className="mt-2 text-sm text-gray-700">
                {sq} squares x ${rate.toLocaleString()} ={" "}
                <strong className="text-[#0b0e13]">
                  ${roofAmount.toLocaleString()}
                </strong>
              </p>
            )}
          </div>

          {/* Everything that is not the roof. One line, one amount. */}
          <div>
            <span className={label}>Anything else</span>
            {lines.map((l, i) => (
              <div key={i} className="mb-3 rounded-md border border-[#e3e6ea] bg-white p-3">
                {/*
                  This was a single-line input squeezed next to the amount box,
                  which on a phone left about twenty characters of room for a
                  description of the work. It is a textarea now, full width.
                */}
                <textarea
                  rows={2}
                  value={l.description}
                  placeholder="Gutters, fascia, decking, chimney flashing..."
                  onChange={(e) => {
                    const n = [...lines];
                    n[i] = { ...n[i], description: e.target.value };
                    setLines(n);
                  }}
                  className={`${input} resize-y`}
                />
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Amount
                  </span>
                  <input
                    inputMode="decimal"
                    value={l.price}
                    placeholder="$"
                    onChange={(e) => {
                      const n = [...lines];
                      n[i] = { ...n[i], price: e.target.value };
                      setLines(n);
                    }}
                    className={`${input} w-32`}
                  />
                  {lines.length > 1 && (
                    <button
                      onClick={() => setLines(lines.filter((_, x) => x !== i))}
                      className="ml-auto text-sm font-semibold text-gray-500 underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={() => setLines([...lines, { description: "", price: "" }])}
              className="text-sm font-semibold text-[#0c7a40] underline"
            >
              Add a line
            </button>
          </div>

          <div className="rounded-md border-2 border-[#0c7a40] bg-[#f0fbf4] p-3">
            <label className={label} htmlFor="c-total">
              Total contract price
            </label>
            <input
              id="c-total"
              inputMode="decimal"
              value={total}
              onChange={(e) => {
                setTotalEdited(true);
                setTotalRaw(e.target.value);
              }}
              className={`${input} bg-white text-lg font-bold`}
            />
            {/*
              Show the rep the figures the homeowner is about to see, so a
              wrong deductible gets caught at the kitchen table rather than in
              the signed copy.
            */}
            {claimBased && collected > 0 && money(deductible) ? (
              <div className="mt-3 space-y-1 border-t border-[#d7dbe0] pt-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Insurance pays</span>
                  <span>{claimSplit(total, deductible).carrierText}</span>
                </div>
                <div className="flex justify-between font-bold text-[#0b0e13]">
                  <span>They pay (deductible)</span>
                  <span>{claimSplit(total, deductible).deductibleText}</span>
                </div>
              </div>
            ) : null}
            {!totalEdited && computed > 0 && (
              <p className="mt-1.5 text-xs text-gray-600">
                Adds up from the lines above. Type over it if the carrier settled
                at a different number.
              </p>
            )}
            {totalEdited && (
              <button
                onClick={() => setTotalEdited(false)}
                className="mt-1.5 text-xs font-semibold text-[#0c7a40] underline"
              >
                Back to the calculated total
              </button>
            )}
          </div>

          {!stepOk && (
            <p className="text-sm text-gray-600">
              {!scopeOk
                ? "Add the squares and the rate, or describe the work, before you send this."
                : "Put a price on it before you send this."}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className={ghost}>Back</button>
            <button
              onClick={() => stepOk && setStep(3)}
              disabled={!stepOk}
              className={`${primary} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Next: sign or send
            </button>
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

          {/*
            There used to be a checkbox here attesting the rep had handed over
            two printed cancellation notices. Parker decided on 2026-11-10 that
            reps will not carry those: the agreement states the cancellation
            right in full, and the emailed copy repeats it with the deadline
            date. Asking a rep to confirm something they are no longer doing
            would train them to tick a box that means nothing.
          */}
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
