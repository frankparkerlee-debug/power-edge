"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FactsCard, Icon, niceDate, readNdjson, type DoorRef, type HouseFacts, type Street } from "./shared";
import { useListen, type useSpeak } from "./voice";

type Msg = {
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  streets?: Street[];
  basis?: string;
  house?: HouseFacts;
  error?: string;
  done?: boolean;
};

const ASK_STARTERS = [
  "They asked if we can help with the deductible. What do I say?",
  "Someone already looked at their roof. Now what?",
  "Are we licensed?",
  "When does a booked inspection pay me $50?",
];

export function AskPanel({
  mode,
  speech,
  onPractice,
}: {
  mode: "ask" | "doors";
  speech: ReturnType<typeof useSpeak>;
  onPractice: (d: DoorRef) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [zip, setZip] = useState("");
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [locNote, setLocNote] = useState("");
  const listen = useListen();
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (msgs.length) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  function locate(): Promise<{ lat: number; lon: number } | null> {
    if (here) return Promise.resolve(here);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocNote("This phone can't share its location. Use a ZIP.");
        return resolve(null);
      }
      setLocNote("Finding you…");
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const h = { lat: p.coords.latitude, lon: p.coords.longitude };
          setHere(h);
          setLocNote("");
          resolve(h);
        },
        () => {
          setLocNote("Location is off. Allow it for this site, or use a ZIP.");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });
  }

  async function ask(question: string, where?: { lat: number; lon: number } | null) {
    const q = question.trim();
    if (!q || busy) return;
    speech.cancel();
    const history: Msg[] = [...msgs, { role: "user", text: q }];
    const idx = history.length;
    setMsgs([...history, { role: "assistant", text: "", steps: [] }]);
    setTyped("");
    setBusy(true);
    const patch = (fn: (m: Msg) => Msg) =>
      setMsgs((all) => all.map((m, i) => (i === idx ? fn(m) : m)));
    try {
      const res = await fetch("/api/coach/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, text: m.text })),
          here: where ?? here ?? undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        patch((m) => ({ ...m, error: d.error || "Coach couldn't answer. Try again.", done: true }));
        return;
      }
      await readNdjson(res, (e) => {
        if (e.t === "text") patch((m) => ({ ...m, text: m.text + String(e.d) }));
        else if (e.t === "step") patch((m) => ({ ...m, steps: [...(m.steps ?? []), String(e.d)] }));
        else if (e.t === "streets") patch((m) => ({ ...m, streets: e.streets as Street[], basis: String(e.basis) }));
        else if (e.t === "house") patch((m) => ({ ...m, house: e.house as HouseFacts }));
        else if (e.t === "error") patch((m) => ({ ...m, error: String(e.d) }));
      });
      patch((m) => ({ ...m, text: m.text.trim(), done: true }));
    } catch {
      patch((m) => ({ ...m, error: "No signal. Try again.", done: true }));
    } finally {
      setBusy(false);
    }
  }

  async function findNearMe() {
    speech.unlock();
    const h = await locate();
    if (h) void ask("Where should I knock today near me?", h);
  }

  function findZip() {
    const z = zip.trim();
    if (/^\d{5}$/.test(z)) void ask(`Where should I knock today in ${z}?`);
  }

  function mic() {
    if (listen.listening) return listen.stop();
    speech.cancel();
    speech.unlock();
    listen.start((t) => void ask(t));
  }

  return (
    <div className="space-y-3">
      {msgs.length === 0 && mode === "ask" && (
        <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-[#0b0e13]">Ask Coach</h2>
          <p className="mt-1 text-sm text-gray-600">
            Answers come from our scripts, the Texas compliance card and how pay works, and say which one. Ask about a house or where to knock too.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ASK_STARTERS.map((s) => (
              <button key={s} onClick={() => void ask(s)} className="rounded-full border border-[#d7dbe0] bg-[#f8f9fa] px-3 py-1.5 text-left text-sm text-[#0b0e13]">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "doors" && (
        <div className="rounded-xl border border-[#e3e6ea] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-[#0b0e13]">Find doors</h2>
          <p className="mt-1 text-sm text-gray-600">
            The best streets for today from our storm data: priority doors first (old roof or repeat storms, inside the claim window), then the biggest reported hail.
          </p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={findNearMe} disabled={busy} className="flex items-center justify-center gap-2 rounded-lg bg-[#0b0e13] py-3 font-bold text-white disabled:opacity-40">
              <Icon name="pin" className="h-5 w-5" />
              Use my location
            </button>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                findZip();
              }}
            >
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="ZIP"
                className="w-20 rounded-lg border border-[#d7dbe0] px-2.5 py-2.5 text-[16px] focus:border-[#0c7a40] focus:outline-none"
              />
              <button disabled={busy || zip.length !== 5} className="rounded-lg border border-[#0b0e13] px-3 font-bold text-[#0b0e13] disabled:opacity-30">
                Go
              </button>
            </form>
          </div>
          {locNote && <p className="mt-2 text-xs text-gray-600">{locNote}</p>}
        </div>
      )}

      {msgs.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="ml-10 rounded-2xl rounded-br-sm bg-[#0b0e13] px-3.5 py-2.5 text-[15px] text-white">
            {m.text}
          </div>
        ) : (
          <div key={i} className="space-y-2">
            {(m.steps ?? []).map((s, j) => (
              <div key={j} className="flex items-center gap-1.5 text-xs text-gray-500">
                <Icon name="search" className="h-3.5 w-3.5" />
                {s}
              </div>
            ))}
            {m.text || !m.done ? (
              <div className="mr-6 whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-[#e3e6ea] bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-[#0b0e13]">
                {m.text || <span className="text-gray-400">…</span>}
                {m.done && m.text && (
                  <button onClick={() => speech.say(m.text.replace(/From: .*$/m, ""), "f")} className="ml-2 inline-flex translate-y-0.5 text-gray-400 hover:text-[#0c7a40]" aria-label="Read it out loud">
                    <Icon name="speaker" className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : null}
            {m.house && (
              <div className="space-y-2">
                <FactsCard h={m.house} />
                <button onClick={() => onPractice({ lat: m.house!.lat, lon: m.house!.lon, address: m.house!.address })} className="w-full rounded-lg border border-[#0c7a40] py-2.5 text-sm font-bold text-[#0c7a40]">
                  Practice this door
                </button>
              </div>
            )}
            {m.streets && m.streets.length > 0 && (
              <div className="space-y-2">
                {m.streets.map((s, j) => (
                  <div key={j} className="rounded-xl border border-[#e3e6ea] bg-white p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-display font-bold text-[#0b0e13]">
                        {j + 1}. {s.street}
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">{[s.city, s.zip].filter(Boolean).join(" ")}</div>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">
                      {s.hail_in ? (
                        <span className="font-semibold text-[#0b0e13]">
                          {s.hail_in.toFixed(1)}″ hail reported {niceDate(s.hail_date)}.{" "}
                        </span>
                      ) : null}
                      {s.open} not knocked
                      {s.priority ? (s.priority === s.open ? ", all priority" : `, ${s.priority} priority`) : ""}
                      {s.worked ? ` · ${s.worked} worked` : ""}
                      {s.recent_permits ? ` · ${s.recent_permits} recent permit${s.recent_permits === 1 ? "" : "s"}` : ""}
                    </p>
                    <div className="mt-2 flex gap-4 text-sm">
                      <Link href={s.map} className="font-semibold text-[#0c7a40] underline">
                        Open the map
                      </Link>
                      {s.sample && (
                        <button onClick={() => onPractice(s.sample!)} className="font-semibold text-[#0b0e13] underline">
                          Practice a door here
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {m.error && <p className="text-sm font-semibold text-red-700">{m.error}</p>}
          </div>
        ),
      )}

      {(mode === "ask" || msgs.length > 0) && (
        <div className="sticky bottom-16 z-10 -mx-4 border-t border-[#e3e6ea] bg-[#f4f5f7]/95 px-4 pb-2 pt-3 backdrop-blur lg:bottom-0">
          {listen.listening && <p className="mb-2 text-sm text-gray-700">{listen.interim || "Listening…"}</p>}
          {listen.error && <p className="mb-2 text-xs font-semibold text-red-700">{listen.error}</p>}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(typed);
            }}
          >
            {listen.canListen && (
              <button
                type="button"
                onClick={mic}
                disabled={busy}
                aria-label={listen.listening ? "Stop listening" : "Ask out loud"}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${listen.listening ? "animate-pulse bg-[#d23a2f] text-white" : "bg-[#0c7a40] text-white"}`}
              >
                <Icon name="mic" className="h-6 w-6" />
              </button>
            )}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={mode === "doors" ? "Ask about these streets or a house" : "Ask anything about the door, the rules or pay"}
              className="min-w-0 flex-1 rounded-full border border-[#d7dbe0] bg-white px-4 py-3 text-[16px] focus:border-[#0c7a40] focus:outline-none"
            />
            <button type="submit" disabled={busy || !typed.trim()} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0b0e13] text-white disabled:opacity-30">
              <Icon name="send" className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
