"use client";

import { useState } from "react";
import { AskPanel } from "./AskPanel";
import { Practice } from "./Practice";
import { Icon, type DoorRef } from "./shared";
import { useSpeak } from "./voice";

type Tab = "practice" | "ask" | "doors";

const TABS: Array<[Tab, string]> = [
  ["practice", "Practice"],
  ["ask", "Ask"],
  ["doors", "Find doors"],
];

/**
 * Coach: practice a real door out loud, ask the playbook, find the best
 * streets. One agent behind all three; the tabs are just where you start.
 */
export function Coach({
  initialDoor,
  initialTab,
  personas,
}: {
  initialDoor: DoorRef | null;
  initialTab: Tab;
  personas: Array<{ id: string; label: string }>;
}) {
  const [tab, setTab] = useState<Tab>(initialDoor ? "practice" : initialTab);
  const [door, setDoor] = useState<DoorRef | null>(initialDoor);
  const speech = useSpeak();

  function practice(d: DoorRef) {
    speech.unlock();
    setDoor(d);
    setTab("practice");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-4 lg:pb-10">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid flex-1 grid-cols-3 rounded-lg bg-[#e7e9ed] p-1">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-md py-2 text-sm font-bold ${tab === k ? "bg-white text-[#0b0e13] shadow-sm" : "text-gray-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={speech.toggleMute}
          aria-label={speech.muted ? "Turn voice on" : "Turn voice off"}
          title={speech.muted ? "Voice off" : "Voice on"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${speech.muted ? "border-[#d7dbe0] text-gray-400" : "border-[#0c7a40] text-[#0c7a40]"}`}
        >
          <Icon name={speech.muted ? "mute" : "speaker"} className="h-5 w-5" />
        </button>
      </div>

      {/* All three stay mounted so switching tabs doesn't lose a conversation. */}
      <div hidden={tab !== "practice"}>
        <Practice door={door} personas={personas} speech={speech} onPickDoor={setDoor} />
      </div>
      <div hidden={tab !== "ask"}>
        <AskPanel mode="ask" speech={speech} onPractice={practice} />
      </div>
      <div hidden={tab !== "doors"}>
        <AskPanel mode="doors" speech={speech} onPractice={practice} />
      </div>
    </div>
  );
}
