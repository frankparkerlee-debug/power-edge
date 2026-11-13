"use client";

/**
 * The front door, drawn simply: the door opens wider as the homeowner warms
 * up, closes when they're done, and their face and the chip under it say how
 * it's going. A plain illustration on purpose, never a photo of a person.
 */

export type DoorMood = "closed" | "guarded" | "curious" | "warming" | "annoyed" | "leaving" | "booked";

const LABEL: Record<DoorMood, string> = {
  closed: "Door closed",
  guarded: "Guarded",
  curious: "Curious",
  warming: "Warming up",
  annoyed: "Annoyed",
  leaving: "Closing the door",
  booked: "Booked",
};

const DOT: Record<DoorMood, string> = {
  closed: "#8a919c",
  guarded: "#8a919c",
  curious: "#2563eb",
  warming: "#0c7a40",
  annoyed: "#c58a00",
  leaving: "#d23a2f",
  booked: "#0c7a40",
};

/** How far the door is open: 1 = shut, smaller = wider. */
const SHUT: Record<DoorMood, number> = {
  closed: 1,
  guarded: 0.42,
  curious: 0.16,
  warming: 0.12,
  annoyed: 0.38,
  leaving: 1,
  booked: 0.12,
};

function Mouth({ mood }: { mood: DoorMood }) {
  if (mood === "warming" || mood === "booked") return <path d="M175 97 q10 8 20 0" stroke="#0b0e13" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  if (mood === "annoyed") return <path d="M176 100 q9 -6 18 0" stroke="#0b0e13" strokeWidth="2.2" fill="none" strokeLinecap="round" />;
  if (mood === "curious") return <circle cx="185" cy="98" r="2.6" fill="#0b0e13" />;
  return <path d="M177 98 h16" stroke="#0b0e13" strokeWidth="2.2" strokeLinecap="round" />;
}

export function DoorScene({ mood, sign, speaking }: { mood: DoorMood; sign?: boolean; speaking?: boolean }) {
  const crossed = mood === "guarded" || mood === "annoyed";
  const brow = mood === "annoyed";
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e3e6ea] bg-[#f6f4ef]">
      <svg viewBox="0 0 360 210" className="block h-auto w-full" role="img" aria-label={`Homeowner: ${LABEL[mood]}`}>
        {/* Wall and siding */}
        <rect width="360" height="210" fill="#efece5" />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1="0" x2="360" y1={22 * i + 10} y2={22 * i + 10} stroke="#e2ded4" strokeWidth="1" />
        ))}
        {/* Porch light */}
        <rect x="236" y="56" width="10" height="16" rx="3" fill="#2b313b" />
        <circle cx="241" cy="66" r="9" fill="#ffe9a8" opacity="0.35" />
        {/* Frame and dark doorway */}
        <rect x="138" y="38" width="94" height="160" rx="3" fill="#d6d2c8" />
        <rect x="146" y="46" width="78" height="152" fill="#1d222b" />
        {/* Homeowner, standing in the doorway */}
        <g opacity={mood === "closed" || mood === "leaving" ? 0 : 1} style={{ transition: "opacity 300ms" }}>
          <rect x="160" y="112" width="50" height="86" rx="18" fill="#5b6472" />
          <circle cx="185" cy="90" r="17" fill="#e6d6c2" />
          <circle cx="179" cy="88" r="1.9" fill="#0b0e13" />
          <circle cx="191" cy="88" r="1.9" fill="#0b0e13" />
          {brow && <path d="M175 82 l7 3 M195 82 l-7 3" stroke="#0b0e13" strokeWidth="1.8" strokeLinecap="round" />}
          <Mouth mood={mood} />
          {crossed && <rect x="163" y="134" width="44" height="12" rx="6" fill="#4a5260" />}
          {speaking && (
            <g stroke="#7FFBAE" strokeWidth="2.4" fill="none" strokeLinecap="round">
              <path d="M210 80 q6 8 0 16" className="animate-pulse" />
              <path d="M216 75 q10 13 0 26" className="animate-pulse" />
            </g>
          )}
        </g>
        {/* The door itself, hinged on the left */}
        <g
          style={{
            transform: `scaleX(${SHUT[mood]})`,
            transformOrigin: "146px 46px",
            transformBox: "view-box",
            transition: "transform 450ms ease",
          }}
        >
          <rect x="146" y="46" width="78" height="152" fill="#0b0e13" />
          <rect x="154" y="56" width="62" height="56" rx="2" fill="none" stroke="#2b313b" strokeWidth="2" />
          <rect x="154" y="122" width="62" height="64" rx="2" fill="none" stroke="#2b313b" strokeWidth="2" />
          <circle cx="214" cy="124" r="3.2" fill="#c9b37a" />
          {sign && (
            <g>
              <rect x="160" y="70" width="50" height="26" rx="2" fill="#ffffff" />
              <text x="185" y="81" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="#b4232b" fontFamily="system-ui, sans-serif">NO</text>
              <text x="185" y="91" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="#b4232b" fontFamily="system-ui, sans-serif">SOLICITING</text>
            </g>
          )}
        </g>
        {/* Step and mat */}
        <rect x="120" y="198" width="130" height="12" fill="#c9c4b8" />
        <rect x="160" y="194" width="50" height="5" rx="2" fill="#7a6a52" />
      </svg>
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#0b0e13] shadow-sm">
        <span className="h-2 w-2 rounded-full" style={{ background: DOT[mood] }} />
        {LABEL[mood]}
      </div>
    </div>
  );
}
