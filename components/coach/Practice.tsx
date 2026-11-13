"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DoorScene, type DoorMood } from "./DoorScene";
import { HouseAerial } from "./HouseAerial";
import { FactsCard, Icon, type DoorRef, type HouseFacts } from "./shared";
import { takeSentences, useListen, type useSpeak } from "./voice";

type Turn = { who: "rep" | "home"; text: string };
type Homeowner = { voice: "f" | "m"; opening: string; sign: boolean; label: string | null };
type Score = {
  result: "booked" | "come_back" | "no" | "walked_past" | "door_closed";
  score: number;
  headline: string;
  did_well: string[];
  fixes: Array<{ you_said: string; try: string; why: string }>;
  compliance: Array<{ rule: string; ok: boolean; note: string }>;
};

const MOODS: DoorMood[] = ["guarded", "curious", "warming", "annoyed", "leaving", "booked"];
const KNOCK = "(knocks on the door)";
const WALK = "(walks past)";
const RESULT: Record<Score["result"], string> = {
  booked: "Booked",
  come_back: "Come back",
  no: "Said no",
  walked_past: "Walked past",
  door_closed: "Door closed",
};

/** "[warming] Sure, come on by." -> ["warming", "Sure, come on by."] */
function splitMood(raw: string): [DoorMood | null, string] {
  const m = raw.match(/^\s*\[([a-z]+)\]\s*/i);
  const mood = m && (MOODS as string[]).includes(m[1].toLowerCase()) ? (m[1].toLowerCase() as DoorMood) : null;
  return [mood, raw.replace(/\[[a-z]+\]\s*/gi, "").trim()];
}

export function Practice({
  door,
  personas,
  speech,
  onPickDoor,
}: {
  door: DoorRef | null;
  personas: Array<{ id: string; label: string }>;
  speech: ReturnType<typeof useSpeak>;
  onPickDoor: (d: DoorRef | null) => void;
}) {
  const [address, setAddress] = useState("");
  const [persona, setPersona] = useState("");
  const [house, setHouse] = useState<HouseFacts | null>(null);
  const [scene, setScene] = useState("");
  const [homeowner, setHomeowner] = useState<Homeowner | null>(null);
  const [offline, setOffline] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState("");
  const [mood, setMood] = useState<DoorMood>("closed");
  const [busy, setBusy] = useState<"" | "door" | "reply" | "score">("");
  const [typed, setTyped] = useState("");
  const [score, setScore] = useState<{ s: Score; who: { id: string; label: string; name: string }; offline?: boolean } | null>(null);
  const [error, setError] = useState("");
  const listen = useListen();
  const lastPersona = useRef<string>("");
  const bottom = useRef<HTMLDivElement | null>(null);
  const { say, cancel, unlock, speaking } = speech;

  const over = mood === "leaving" || mood === "booked";
  const started = turns.length > 0;

  const loadDoor = useCallback(
    async (where: { lat?: number; lon?: number; address?: string }, personaId: string | undefined) => {
      setBusy("door");
      setError("");
      setScore(null);
      setTurns([]);
      setLive("");
      cancel();
      try {
        const res = await fetch("/api/coach/door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...where, persona: personaId, previous: lastPersona.current }),
        });
        const d = await res.json();
        if (!res.ok || !d.ok) {
          setError(d.error || "Couldn't load that door.");
          return;
        }
        setHouse(d.house);
        setScene(d.scene);
        setHomeowner(d.homeowner);
        setOffline(!!d.offline);
        setMood("closed");
      } catch {
        setError("No signal. Try again.");
      } finally {
        setBusy("");
      }
    },
    [cancel],
  );

  // A door handed over from the map or from Ask/Find doors.
  const loadedFor = useRef<string>("");
  useEffect(() => {
    if (!door) return;
    const key = `${door.lat},${door.lon},${door.address}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    void loadDoor({ lat: door.lat, lon: door.lon, address: door.address }, persona || undefined);
  }, [door, loadDoor, persona]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, live, score]);

  async function reply(next: Turn[]) {
    setBusy("reply");
    setError("");
    setLive("");
    let raw = "";
    let spoken = 0;
    let pending = "";
    let gotMood = false;
    try {
      const res = await fetch("/api/coach/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, turns: next }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Coach couldn't answer. Try again.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        if (raw.includes("[[error]]")) break;
        const [m, text] = splitMood(raw);
        if (m && !gotMood) {
          gotMood = true;
          setMood(m);
        }
        setLive(text);
        // Speak each finished sentence while the rest is still arriving.
        if (gotMood || raw.length > 14) {
          pending += text.slice(spoken);
          spoken = text.length;
          const [sentences, rest] = takeSentences(pending);
          pending = rest;
          for (const s of sentences) say(s, homeowner?.voice ?? "f");
        }
      }
      if (raw.includes("[[error]]")) {
        setError("Coach lost the connection. Say that again.");
        return;
      }
      const [m, text] = splitMood(raw);
      pending += text.slice(spoken);
      if (pending.trim()) say(pending, homeowner?.voice ?? "f");
      if (m) setMood(m);
      setTurns([...next, { who: "home", text: raw.trim() }]);
    } catch {
      setError("No signal. Try again.");
    } finally {
      setLive("");
      setBusy("");
    }
  }

  function sendRep(text: string) {
    const t = text.trim();
    if (!t || busy || over) return;
    cancel();
    const next = [...turns, { who: "rep" as const, text: t }];
    setTurns(next);
    setTyped("");
    void reply(next);
  }

  function knock() {
    unlock();
    sendRep(KNOCK);
  }

  async function getScore(final?: Turn[]) {
    const t = final ?? turns;
    if (!t.length) return;
    setBusy("score");
    setError("");
    cancel();
    try {
      const res = await fetch("/api/coach/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, turns: t }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setError(d.error || "Couldn't score that. Try again.");
        return;
      }
      setScore({ s: d.score, who: d.homeowner, offline: d.offline });
      lastPersona.current = d.homeowner?.id ?? "";
    } catch {
      setError("No signal. Try again.");
    } finally {
      setBusy("");
    }
  }

  function walkPast() {
    const t = [{ who: "rep" as const, text: WALK }];
    setTurns(t);
    void getScore(t);
  }

  /** Same house again, with someone new at the door (never the one just practiced). */
  function again() {
    if (!house) return;
    setPersona("");
    void loadDoor({ lat: house.lat, lon: house.lon, address: house.address }, undefined);
  }

  function mic() {
    if (listen.listening) return listen.stop();
    cancel();
    unlock();
    listen.start((text) => sendRep(text));
  }

  /* ---------- No house yet ---------- */
  if (!house) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-[#0b0e13]">Practice a real door</h2>
          <p className="mt-1 text-sm text-gray-600">
            Pick a house and Coach plays whoever opens the door, using that house&apos;s real hail record. Talk out loud or type. You get a scorecard at the end.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (address.trim()) void loadDoor({ address }, persona || undefined);
            }}
          >
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address, e.g. 5629 Ainsdale Dr, Fort Worth"
              className="min-w-0 flex-1 rounded-lg border border-[#d7dbe0] px-3 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
            />
            <button disabled={busy === "door" || !address.trim()} className="rounded-lg bg-[#0b0e13] px-4 font-bold text-white disabled:opacity-40">
              {busy === "door" ? "…" : "Go"}
            </button>
          </form>
          <p className="mt-2 text-sm text-gray-600">
            Or tap a house on the{" "}
            <Link href="/admin/storms" className="font-semibold text-[#0c7a40] underline">
              Map
            </Link>{" "}
            and choose Practice this door.
          </p>
        </div>
        <PersonaPick personas={personas} value={persona} onChange={setPersona} />
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      </div>
    );
  }

  /* ---------- Scorecard ---------- */
  if (score) {
    const s = score.s;
    const ring = s.score >= 80 ? "#0c7a40" : s.score >= 55 ? "#c58a00" : "#d23a2f";
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#eef0f2" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={ring} strokeWidth="3.5" strokeDasharray={`${(s.score / 100) * 97.4} 97.4`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-extrabold text-[#0b0e13]">{s.score}</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{RESULT[s.result]}</div>
              <p className="mt-0.5 font-display text-base font-bold leading-snug text-[#0b0e13]">{s.headline}</p>
              <p className="mt-1 text-xs text-gray-600">
                At the door: {score.who.name}, {score.who.label.toLowerCase()}
              </p>
            </div>
          </div>
          {score.offline && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Offline scorecard: this machine has no AI key.</p>}
        </div>

        {s.compliance.length > 0 && (
          <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">The rules</h3>
            <ul className="mt-2 space-y-2">
              {s.compliance.map((c, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-[#e7f6ec] text-[#0c7a40]" : "bg-red-50 text-red-700"}`}>
                    <Icon name={c.ok ? "check" : "x"} className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="font-semibold text-[#0b0e13]">{c.rule}.</span> <span className="text-gray-700">{c.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.fixes.length > 0 && (
          <div className="space-y-3">
            {s.fixes.map((f, i) => (
              <div key={i} className="rounded-xl border border-[#e3e6ea] bg-white p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">You said</div>
                <p className="mt-0.5 text-sm italic text-gray-700">&ldquo;{f.you_said}&rdquo;</p>
                <div className="mt-2 text-xs font-bold uppercase tracking-wider text-[#0c7a40]">Try</div>
                <p className="mt-0.5 text-sm font-semibold text-[#0b0e13]">&ldquo;{f.try}&rdquo;</p>
                <p className="mt-1.5 text-xs text-gray-600">{f.why}</p>
              </div>
            ))}
          </div>
        )}

        {s.did_well.length > 0 && (
          <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">You did well</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0b0e13]">
              {s.did_well.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={again} className="rounded-lg bg-[#0c7a40] py-3 font-bold text-white">
            Same house, new homeowner
          </button>
          <button
            onClick={() => {
              setHouse(null);
              setScore(null);
              onPickDoor(null);
            }}
            className="rounded-lg border border-[#d7dbe0] bg-white py-3 font-bold text-[#0b0e13]"
          >
            Another house
          </button>
        </div>
        <div ref={bottom} />
      </div>
    );
  }

  /* ---------- At the door ---------- */
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-bold text-[#0b0e13]">{house.address}</div>
          <div className="text-xs text-gray-500">{[house.city, house.zip].filter(Boolean).join(", ")}</div>
        </div>
        <button
          onClick={() => {
            setHouse(null);
            onPickDoor(null);
            cancel();
          }}
          className="shrink-0 text-sm font-semibold text-gray-600 underline"
        >
          Change house
        </button>
      </div>

      {!started ? (
        <>
          <HouseAerial lat={house.lat} lon={house.lon} />
          <FactsCard h={house} />
          <DoorScene mood="closed" sign={homeowner?.sign} />
          <PersonaPick
            personas={personas}
            value={persona}
            onChange={(v) => {
              setPersona(v);
              void loadDoor({ lat: house.lat, lon: house.lon, address: house.address }, v || undefined);
            }}
          />
          <p className="text-sm text-gray-600">
            Know the hail date and stone size before you walk up. Then knock, or walk past if you shouldn&apos;t.
          </p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button onClick={knock} disabled={busy !== ""} className="flex items-center justify-center gap-2 rounded-lg bg-[#0b0e13] py-3.5 font-display font-bold text-white disabled:opacity-40">
              <Icon name="door" className="h-5 w-5" />
              {busy === "reply" ? "Knocking…" : "Knock"}
            </button>
            <button onClick={walkPast} disabled={busy !== ""} className="rounded-lg border border-[#d7dbe0] bg-white px-4 font-semibold text-gray-700 disabled:opacity-40">
              Walk past
            </button>
          </div>
          {offline && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Offline practice: this machine has no AI key, so the homeowner reads canned lines.</p>}
        </>
      ) : (
        <>
          <DoorScene mood={mood} sign={homeowner?.sign} speaking={speaking} />
          <FactsCard h={house} compact />
          <div className="space-y-2">
            {turns
              .filter((t) => t.text !== KNOCK)
              .map((t, i) =>
                t.who === "rep" ? (
                  <div key={i} className="ml-10 rounded-2xl rounded-br-sm bg-[#0b0e13] px-3.5 py-2.5 text-[15px] text-white">
                    {t.text}
                  </div>
                ) : (
                  <div key={i} className="mr-10 rounded-2xl rounded-bl-sm border border-[#e3e6ea] bg-white px-3.5 py-2.5 text-[15px] text-[#0b0e13]">
                    {splitMood(t.text)[1]}
                  </div>
                ),
              )}
            {busy === "reply" && (
              <div className="mr-10 rounded-2xl rounded-bl-sm border border-[#e3e6ea] bg-white px-3.5 py-2.5 text-[15px] text-[#0b0e13]">
                {live || <span className="text-gray-400">…</span>}
              </div>
            )}
          </div>

          {over ? (
            <button onClick={() => getScore()} disabled={busy !== ""} className="w-full rounded-lg bg-[#0c7a40] py-3.5 font-display font-bold text-white disabled:opacity-40">
              {busy === "score" ? "Scoring…" : "See my scorecard"}
            </button>
          ) : (
            <div className="sticky bottom-16 z-10 -mx-4 border-t border-[#e3e6ea] bg-[#f4f5f7]/95 px-4 pb-2 pt-3 backdrop-blur lg:bottom-0">
              {listen.listening && <p className="mb-2 text-sm text-gray-700">{listen.interim || "Listening…"}</p>}
              {listen.error && <p className="mb-2 text-xs font-semibold text-red-700">{listen.error}</p>}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendRep(typed);
                }}
              >
                {listen.canListen && (
                  <button
                    type="button"
                    onClick={mic}
                    disabled={busy !== ""}
                    aria-label={listen.listening ? "Stop listening" : "Talk"}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${listen.listening ? "animate-pulse bg-[#d23a2f] text-white" : "bg-[#0c7a40] text-white"}`}
                  >
                    <Icon name="mic" className="h-6 w-6" />
                  </button>
                )}
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={listen.canListen ? "Tap the mic and talk, or type" : "Type what you'd say"}
                  className="min-w-0 flex-1 rounded-full border border-[#d7dbe0] bg-white px-4 py-3 text-[16px] focus:border-[#0c7a40] focus:outline-none"
                />
                <button type="submit" disabled={busy !== "" || !typed.trim()} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0b0e13] text-white disabled:opacity-30">
                  <Icon name="send" className="h-5 w-5" />
                </button>
              </form>
              <button onClick={() => getScore()} disabled={busy !== "" || turns.length < 3} className="mt-2 w-full text-center text-sm font-semibold text-gray-600 underline disabled:opacity-40">
                {busy === "score" ? "Scoring…" : "End and score"}
              </button>
            </div>
          )}
        </>
      )}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <div ref={bottom} />
    </div>
  );
}

function PersonaPick({ personas, value, onChange }: { personas: Array<{ id: string; label: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block rounded-xl border border-[#e3e6ea] bg-white p-4">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Who opens the door</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[#d7dbe0] bg-white px-3 py-2.5 text-[16px]">
        <option value="">Surprise me</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
