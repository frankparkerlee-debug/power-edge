"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Talking and listening, done by the phone itself.
 *
 * Speech to text is the browser's SpeechRecognition (Safari and Chrome both
 * have it); text to speech is speechSynthesis. Nothing is recorded and no
 * audio is sent anywhere: only the words go to Coach. Where the browser can't
 * listen, the rep types (or uses the keyboard's own mic).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognizer(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const noop = () => () => {};

/** Can this browser listen? (false on the server, so the first render matches.) */
export function useCanListen() {
  return useSyncExternalStore(noop, () => !!recognizer(), () => false);
}

export function useListen() {
  const canListen = useCanListen();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);

  const stop = useCallback(() => rec.current?.stop(), []);

  /** Listen until the rep stops talking (or taps again), then hand back the words. */
  const start = useCallback((onDone: (text: string) => void) => {
    const R = recognizer();
    if (!R) return;
    rec.current?.abort();
    const r = new R();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    r.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setError("Microphone is blocked. Allow it for this site in your browser settings, or type instead.");
      } else if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        setError("Couldn't hear that. Try again or type it.");
      }
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) onDone(text);
    };
    rec.current = r;
    setError("");
    setInterim("");
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { canListen, listening, interim, error, start, stop };
}

/* ---------- Speaking ---------- */

const PREFER: Record<"f" | "m", string[]> = {
  f: ["Ava", "Samantha", "Allison", "Susan", "Zoe", "Nicky", "Joelle", "Google US English", "Microsoft Aria", "Microsoft Jenny"],
  m: ["Evan", "Nathan", "Tom", "Alex", "Aaron", "Reed", "Microsoft Guy", "Microsoft Davis", "Google US English"],
};

function pickVoice(voices: SpeechSynthesisVoice[], want: "f" | "m") {
  const us = voices.filter((v) => /en[-_]US/i.test(v.lang));
  const pool = us.length ? us : voices.filter((v) => /^en/i.test(v.lang));
  for (const name of PREFER[want]) {
    const hits = pool.filter((v) => v.name.includes(name));
    const best = hits.find((v) => /premium|enhanced|natural/i.test(v.name)) ?? hits[0];
    if (best) return best;
  }
  return pool[0] ?? null;
}

export function useSpeak() {
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const pending = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => (voices.current = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  /** iPhones only let a page speak after a tap: call this inside the tap. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    pending.current = 0;
    setSpeaking(false);
  }, []);

  /** Queue one piece of speech (a sentence at a time sounds natural and starts sooner). */
  const say = useCallback(
    (text: string, voice: "f" | "m" = "f") => {
      if (muted || typeof window === "undefined" || !window.speechSynthesis) return;
      const clean = text.replace(/\[[a-z]+\]/gi, "").replace(/\s+/g, " ").trim();
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      const v = pickVoice(voices.current, voice);
      if (v) u.voice = v;
      u.lang = "en-US";
      u.rate = 1.02;
      u.onstart = () => setSpeaking(true);
      u.onend = u.onerror = () => {
        pending.current = Math.max(0, pending.current - 1);
        if (!pending.current) setSpeaking(false);
      };
      pending.current++;
      window.speechSynthesis.speak(u);
    },
    [muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m && typeof window !== "undefined") window.speechSynthesis?.cancel();
      return !m;
    });
  }, []);

  return { muted, toggleMute, speaking, say, cancel, unlock };
}

/** Pull whole sentences off the front of a growing string; returns [sentences, rest]. */
export function takeSentences(buf: string): [string[], string] {
  const out: string[] = [];
  let rest = buf;
  const re = /^([\s\S]*?[.!?…]+["')\]]?)(\s+)/;
  let m: RegExpMatchArray | null;
  while ((m = rest.match(re))) {
    out.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return [out, rest];
}
