"use client";

import { useRef, useState } from "react";

/**
 * Homeowner-facing signing. Deliberately shows the whole agreement above the
 * signature rather than a "click to accept" checkbox: on a brand arguing you
 * can verify us, hiding the terms behind a link would be the wrong trade.
 */
export function SignAgreement({
  token,
  ownerNames,
  address,
  email,
  scope,
  total,
  claimBased,
}: {
  token: string;
  ownerNames: string;
  address: string;
  email: string;
  scope: Array<{ description: string; price: string }>;
  total: string;
  claimBased: boolean;
}) {
  const [name, setName] = useState(ownerNames);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ cancelBy: string; emailed: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!hasInk.current) {
      setError("Please sign in the box above before continuing.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/contract/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_png: canvasRef.current!.toDataURL("image/png"),
          signer_name: name,
          owner_names: ownerNames,
          owner_email: email,
          property_address: address,
          scope,
          total_price: total,
          claim_based: claimBased,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Something went wrong. Call us and we'll sort it out.");
        return;
      }
      setDone(d);
    } catch {
      setError("Network problem. Nothing was signed, please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border-2 border-bolt bg-bolt/10 p-6">
        <h2 className="font-display text-2xl font-bold text-fg-inv">Signed. Thank you.</h2>
        <p className="mt-2 text-fg-inv-dim">
          You can cancel at any time before midnight on{" "}
          <strong className="text-fg-inv">{done.cancelBy}</strong>, with no penalty and
          nothing owed. Just reply to the email with the word CANCEL, or call us.
        </p>
        <p className="mt-3 text-sm text-fg-inv-dim">
          {done.emailed
            ? "A copy is on its way to your inbox."
            : "Ask your rep for a copy for your records."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-fg-inv" htmlFor="sig-name">
          Type your full name
        </label>
        <input
          id="sig-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-ink px-4 py-3 text-fg-inv focus:border-bolt focus:outline-none"
        />
      </div>

      <div>
        <span className="block text-sm font-semibold text-fg-inv">Sign below</span>
        <canvas
          ref={canvasRef}
          width={640}
          height={200}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
          className="mt-1 w-full touch-none rounded-md border border-line bg-white"
          style={{ height: 160 }}
        />
        <button
          type="button"
          onClick={clearSig}
          className="mt-1 text-sm text-fg-inv-dim underline hover:text-fg-inv"
        >
          Clear
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-bolt px-6 py-4 font-display text-lg font-bold text-ink transition-colors hover:bg-bolt-hi disabled:opacity-60"
      >
        {busy ? "Signing…" : "Sign this agreement"}
      </button>
      <p className="text-center text-xs leading-relaxed text-fg-inv-dim">
        You may cancel within three business days of signing, without penalty or
        obligation. We email you that right in writing the moment you sign.
      </p>
    </form>
  );
}
