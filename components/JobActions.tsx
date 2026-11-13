"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookAtDoor } from "./BookAtDoor";

/**
 * What a closer does from a job, in the order they do it.
 *
 * The job page used to offer "Book inspection" as a link to the public
 * homeowner form, never showed when the inspection was or who had it, and had
 * no way to record what the inspection found. So the visit left no trace, and
 * the written assessment promised in every booking confirmation had nowhere to
 * come from.
 *
 * Now the page shows the inspection with directions, and the closer records
 * the outcome in one step. Recording it moves the job and sends the homeowner
 * their assessment, either way.
 *
 * Photos and "was the homeowner there?" are recorded here too: together with
 * being the first inspection at the address, they decide whether it's a held
 * inspection, which pays the knocker's $50 (lib/held.ts).
 */

/** Shrink a phone photo to a JPEG about 1600px on the long side. */
async function toJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = bad;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) =>
      c.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.8),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type Inspection = {
  when: string;
  closer: string | null;
  status: string;
  /** What the setter told the closer: who decides, the gate code, the dog. */
  note?: string | null;
  setter?: string | null;
} | null;

export function JobActions({
  job,
  inspection,
  canSell,
}: {
  job: {
    id: string;
    stage: string;
    address: string;
    owner_name: string | null;
    phone: string | null;
    email: string | null;
    squares: number | null;
  };
  inspection: Inspection;
  canSell: boolean;
}) {
  const router = useRouter();
  const [booking, setBooking] = useState(false);
  const [verdict, setVerdict] = useState<"" | "qualifies" | "fine" | "no_show">("");
  const [findings, setFindings] = useState("");
  const [squares, setSquares] = useState(job.squares ? String(job.squares) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [present, setPresent] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<{ id: string }[]>([]);
  const [uploading, setUploading] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/jobs/${job.id}/photos`)
      .then((r) => r.json())
      .then((d) => {
        if (live && d.ok) setPhotos(d.photos);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [job.id]);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    let done = 0;
    for (const f of list) {
      setUploading(`Adding photo ${done + 1} of ${list.length}...`);
      try {
        const jpeg = await toJpeg(f);
        const res = await fetch(`/api/admin/jobs/${job.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: jpeg,
        });
        const d = await res.json();
        if (!res.ok || !d.ok) {
          setUploading(d.error || "A photo didn't upload. Try again.");
          return;
        }
        setPhotos((p) => [...p, { id: d.id }]);
        done++;
      } catch {
        setUploading("No signal, or the phone couldn't read that photo. Try again.");
        return;
      }
    }
    setUploading("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const map = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`;
  const awaitingInspection =
    job.stage === "inspection_booked" || (!!inspection && inspection.status === "booked");
  const preInspection = ["new", "contacted"].includes(job.stage);

  async function record() {
    if (!verdict) return;
    if (verdict !== "no_show" && present === null) {
      setMsg("Say whether the homeowner was there.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, findings, squares, homeownerPresent: present }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setMsg(d.error || "Could not save that.");
        return;
      }
      if (verdict === "no_show") {
        setMsg("Recorded. The job is back to Contacted so it can be rebooked.");
      } else {
        setMsg(
          d.emailed
            ? "Recorded, and the homeowner has their written assessment."
            : job.email
              ? "Recorded, but the assessment email did not go. Tell them before you leave."
              : "Recorded. There is no email on file, so tell them what you found.",
        );
      }
      router.refresh();
    } catch {
      setMsg("No signal. Nothing saved, try again.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (v: typeof verdict, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => {
        setVerdict(v);
        setMsg("");
      }}
      className={`rounded-lg border p-3 text-left ${
        verdict === v ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#d7dbe0] bg-white"
      }`}
    >
      <span className="block font-display font-bold text-[#0b0e13]">{label}</span>
      <span className="block text-xs text-gray-600">{sub}</span>
    </button>
  );

  return (
    <div className="mt-4 space-y-4">
      {/* The inspection, and how to get there. */}
      {inspection ? (
        <div className="rounded-lg border border-[#e3e6ea] bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Inspection
              </div>
              <div className="mt-0.5 font-display text-lg font-bold text-[#0b0e13]">
                {inspection.when}
              </div>
              <div className="text-sm text-gray-600">
                {inspection.closer ? `with ${inspection.closer}` : "No closer assigned yet"}
                {inspection.status !== "booked" ? ` · ${inspection.status.replace(/_/g, " ")}` : ""}
              </div>
            </div>
            <a
              href={map}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#0c7a40] px-3 py-2 text-sm font-bold text-[#0c7a40]"
            >
              Directions
            </a>
          </div>
          {/*
            The setter's note, where the closer reads it on the way in. It
            used to sit at the bottom of History, below the stage buttons, so a
            closer at the gate scrolled past everything to find the code.
          */}
          {inspection.note ? (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-[#0b0e13]">
              <span className="font-bold">
                {inspection.setter ? `From ${inspection.setter}: ` : "Setter's note: "}
              </span>
              {inspection.note}
            </div>
          ) : null}
        </div>
      ) : preInspection ? (
        <button
          type="button"
          onClick={() => setBooking(true)}
          className="w-full rounded-lg border-2 border-dashed border-[#0c7a40] bg-white py-3 font-bold text-[#0c7a40]"
        >
          Book the inspection
        </button>
      ) : null}

      {/* What the inspection found. Closers only: a setter recording a verdict
          would be telling a homeowner about a roof they never looked at. */}
      {canSell && awaitingInspection ? (
        <div className="rounded-lg border-2 border-[#0b0e13] bg-white p-4">
          <div className="font-display text-lg font-bold text-[#0b0e13]">What did you find?</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {btn("qualifies", "Storm damage", "Moves to Inspected, then price it")}
            {btn("fine", "Roof is fine", "They get it in writing. That's the promise.")}
            {btn("no_show", "Didn't happen", "Nobody home or postponed")}
          </div>

          {verdict && verdict !== "no_show" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="ja-findings">
                  What you saw (goes to the homeowner)
                </label>
                <textarea
                  id="ja-findings"
                  rows={3}
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder={
                    verdict === "fine"
                      ? "Shingles intact, no bruising, normal wear for age"
                      : "Hail bruising on the south and west slopes, 9 hits per test square, dented vents"
                  }
                  className="w-full resize-y rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                />
              </div>
              {verdict === "qualifies" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="ja-sq">
                    Squares
                  </label>
                  <input
                    id="ja-sq"
                    inputMode="decimal"
                    value={squares}
                    onChange={(e) => setSquares(e.target.value)}
                    placeholder="32"
                    className="w-full rounded-md border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {verdict && verdict !== "no_show" ? (
            <div className="mt-4">
              <div className="text-sm font-bold text-[#0b0e13]">Was the homeowner there?</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { v: true, label: "Yes", sub: "An owner was at the house" },
                  { v: false, label: "No", sub: "I inspected without them" },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    onClick={() => setPresent(o.v)}
                    className={`rounded-lg border p-3 text-left ${
                      present === o.v ? "border-[#0c7a40] bg-[#f0fbf4]" : "border-[#d7dbe0] bg-white"
                    }`}
                  >
                    <span className="block font-display font-bold text-[#0b0e13]">{o.label}</span>
                    <span className="block text-xs text-gray-600">{o.sub}</span>
                  </button>
                ))}
              </div>
              {inspection?.setter ? (
                <p className="mt-2 text-xs text-gray-600">
                  {`${inspection.setter} is paid $50 only when the homeowner was there, your photos are in, and it's PowerEdge's first inspection at this address.`}
                </p>
              ) : null}
              {photos.length === 0 ? (
                <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs font-semibold text-[#0b0e13]">
                  No photos yet. Add them below. An inspection without photos isn&apos;t held.
                </p>
              ) : null}
            </div>
          ) : null}

          {verdict ? (
            <button
              type="button"
              onClick={record}
              disabled={busy || (verdict !== "no_show" && present === null)}
              className="mt-3 w-full rounded-lg bg-[#0c7a40] py-3 font-display font-bold text-white disabled:opacity-40"
            >
              {busy
                ? "Saving..."
                : verdict === "fine"
                  ? "Record it and send their assessment"
                  : verdict === "qualifies"
                    ? "Record it and send what we found"
                    : "Record it"}
            </button>
          ) : null}
        </div>
      ) : null}

      {msg ? <p className="text-sm font-semibold text-[#0b0e13]">{msg}</p> : null}

      {/* Inspection photos. The agreement's "held" needs them in the app. */}
      {canSell && (inspection || !preInspection) ? (
        <div className="rounded-lg border border-[#e3e6ea] bg-white p-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-display text-base font-bold text-[#0b0e13]">Inspection photos</div>
            <div className="text-xs text-gray-500">{photos.length} in</div>
          </div>
          {photos.length ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <a key={p.id} href={`/api/admin/jobs/${job.id}/photos/${p.id}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/jobs/${job.id}/photos/${p.id}`}
                    alt="Inspection photo"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-600">
              Address in frame, each slope wide, a test square per slope, soft metals, collateral.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!uploading && uploading.startsWith("Adding")}
            className="mt-3 w-full rounded-lg border border-[#0c7a40] py-2.5 font-bold text-[#0c7a40] disabled:opacity-40"
          >
            {photos.length ? "Add more photos" : "Add photos"}
          </button>
          {uploading ? <p className="mt-2 text-xs font-semibold text-[#0b0e13]">{uploading}</p> : null}
        </div>
      ) : null}

      {booking ? (
        <BookAtDoor
          door={{ id: "", address: job.address }}
          jobId={job.id}
          prefill={{
            name: job.owner_name || "",
            phone: job.phone || "",
            email: job.email || "",
          }}
          onClose={() => setBooking(false)}
          onBooked={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
