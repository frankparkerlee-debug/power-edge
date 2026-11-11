import Link from "next/link";
import { moneyShort } from "@/lib/money";
import {
  PERIODS,
  DEFAULT_GOALS,
  HAIL_BANDS,
  MIN_DOORS_FOR_RATE,
  closerNotes,
  goalsFor,
  isCloserRow,
  isSetterRow,
  paceFraction,
  pct,
  ranked,
  recordsFor,
  setterNotes,
  type Board,
  type DayRow,
  type Note,
  type Period,
  type RepRow,
} from "@/lib/scoreboard";

/**
 * The scoreboard page body. Pure: data in, markup out, so the page and its
 * sample-data preview render the same thing.
 *
 * Design: one column of reading, hairlines instead of boxes, numbers set in
 * sentences where a person reads them ("You're 2nd of 5 setters") and in
 * columns where they compare them. Every link is a plain URL (period, board,
 * whose coaching), so it works with no client script and can be shared.
 */

type BoardKey = "setters" | "closers";

export type ScoreboardProps = {
  period: Period;
  now: Board;
  before: Board;
  days: DayRow[];
  me: { name: string; role: string };
  board: BoardKey;
  /** "team", or a person's name. */
  focus: string;
  /** Setters see counts, not dollars, the same rule as Today. */
  money: boolean;
  isAdmin: boolean;
  basePath: string;
  nowMs: number;
  loadFailed?: boolean;
};

const GREEN = "#0c7a40";

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/** 75000 -> "$75k", 17500 -> "$17.5k". For goals beside a full number. */
const kMoney = (v: number) => (v >= 1000 ? `$${Number((v / 1000).toFixed(1))}k` : moneyShort(v));

function ordinal(k: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = k % 100;
  return `${k}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function ago(iso: string, nowMs: number) {
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 18) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
}

/** "8551 S Meditteranean, Dallas" -> "S Meditteranean". The street, not the house. */
function street(address: string | null) {
  const line = String(address || "").split(",")[0].trim();
  return line.replace(/^\d+[A-Z]?\s+/i, "");
}

function firstName(who: string) {
  return who.split(" ")[0];
}

/* ---------------------------------------------------------------- pieces */

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const d = now - before;
  if (now === 0 && before === 0) return <span className="text-gray-400">&nbsp;</span>;
  return (
    <span className={d > 0 ? "text-[#0c7a40]" : "text-gray-500"} title={`${n(before)} at ${label}`}>
      {d > 0 ? "+" : d < 0 ? "−" : "±"}
      {n(Math.abs(d))}
    </span>
  );
}

function GoalBar({
  label,
  value,
  goal,
  pace,
  format = n,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  pace: number;
  format?: (v: number) => string;
  unit: string;
}) {
  const fill = Math.min(100, (value / goal) * 100);
  const expected = goal * pace;
  const done = value >= goal;
  const behind = Math.ceil(expected - value);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="text-gray-600">{label}</span>
        <span>
          <strong className="text-[#0b0e13]">{format(value)}</strong>
          <span className="text-gray-500"> of {format(goal)}</span>
          <span className={`ml-2 text-xs font-semibold ${done || behind <= 0 ? "text-[#0c7a40]" : "text-[#b54708]"}`}>
            {done ? "Goal met" : behind <= 0 ? "On pace" : `${format(behind)}${unit ? ` ${unit}` : ""} behind pace`}
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-[#eceef1]" role="img" aria-label={`${format(value)} of ${format(goal)}`}>
        <div className="h-2 rounded-full" style={{ width: `${fill}%`, background: GREEN }} />
        {!done && pace > 0 && pace < 1 ? (
          <div
            className="absolute -top-1 h-4 w-0.5 rounded bg-[#0b0e13]/40"
            style={{ left: `${pace * 100}%` }}
            title="Where you'd be on pace"
          />
        ) : null}
      </div>
    </div>
  );
}

function NoteLine({ note }: { note: Note }) {
  const dot = note.tone === "good" ? GREEN : note.tone === "owed" ? "#c2410c" : "#b54708";
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-[#3b424e]">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span>
        {note.text}
        {note.href ? (
          <>
            {" "}
            <Link href={note.href} className="font-semibold text-[#0c7a40] underline-offset-2 hover:underline">
              {note.link}
            </Link>
          </>
        ) : null}
      </span>
    </li>
  );
}

function SectionHead({ title, sub, id, right }: { title: string; sub?: string; id?: string; right?: React.ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-20 flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0b0e13]">{title}</h2>
        {sub ? <p className="text-sm text-gray-500">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

function Chips({ items }: { items: Array<{ label: string; href: string; on: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          scroll={false}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            c.on ? "bg-[#0b0e13] text-white" : "border border-[#d7dbe0] bg-white text-[#3b424e] hover:border-[#0b0e13]"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export function Scoreboard(props: ScoreboardProps) {
  const { period, now, before, days, me, board, focus, money, isAdmin, basePath, nowMs } = props;
  const href = (o: Partial<{ p: string; board: string; who: string }>, hash = "") => {
    const q = new URLSearchParams();
    const p = o.p ?? period.key;
    if (p !== "week") q.set("p", p);
    const b = o.board ?? board;
    if (b !== "setters") q.set("board", b);
    // Always carry whose coaching is open, "team" included: with no
    // parameter the page opens on your own.
    const w = o.who ?? focus;
    if (w) q.set("who", w);
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ""}${hash}`;
  };

  const pace = paceFraction(period, new Date(nowMs));
  const setters = ranked(now.reps, "setters", money);
  const closers = ranked(now.reps, "closers", money);
  const rows = board === "setters" ? setters : closers;
  const mine = now.reps.find((r) => r.who === me.name);
  const mySetter = setters.find((r) => r.who === me.name);
  const myCloser = closers.find((r) => r.who === me.name);
  const prevOf = (who: string) => before.reps.find((r) => r.who === who);

  /* The team, door to signature. */
  const t = now.team;
  const b = before.team;
  const steps: Array<{ label: string; v: number; was: number; of?: string; sub?: string }> = [
    { label: "Doors", v: t.knocks, was: b.knocks },
    { label: "Talked", v: t.talked, was: b.talked, of: pct(t.talked, t.knocks) ?? undefined, sub: "of doors" },
    {
      label: "Inspections set",
      v: t.sets,
      was: b.sets,
      of: t.talked >= MIN_DOORS_FOR_RATE ? `${n(((t.sets - t.web_sets) / t.talked) * 100)}%` : undefined,
      sub: "of talks",
    },
    { label: "Inspected", v: t.held, was: b.held },
    { label: "Damage found", v: t.damage, was: b.damage, of: pct(t.damage, t.held, 5) ?? undefined, sub: "of inspected" },
    { label: "Agreements out", v: t.sent, was: b.sent },
    { label: "Signed", v: t.signed, was: b.signed, of: pct(t.signed, t.sent, 3) ?? undefined, sub: "of sent" },
  ];

  /* Coaching: the team, or one person. */
  const pick = <T extends { who: string }>(xs: T[]) => (focus === "team" ? xs : xs.filter((x) => x.who === focus));
  const focusRow = focus === "team" ? null : now.reps.find((r) => r.who === focus) ?? null;
  const people = now.reps
    .filter((r) => r.knocks > 0 || r.sets > 0 || r.ran > 0 || r.signed > 0)
    .sort((a, b) => (a.who === me.name ? -1 : b.who === me.name ? 1 : a.who.localeCompare(b.who)));

  const reasonMap = new Map<string, number>();
  for (const r of pick(now.reasons)) reasonMap.set(r.reason, (reasonMap.get(r.reason) ?? 0) + Number(r.n));
  const reasons = [...reasonMap].sort((a, b) => b[1] - a[1]);
  const reasonTotal = reasons.reduce((s, [, v]) => s + v, 0);
  const reasonMax = Math.max(1, ...reasons.map(([, v]) => v));

  const hourMap = new Map<number, { knocks: number; talked: number; sets: number }>();
  for (const h of pick(now.hours)) {
    const x = hourMap.get(h.hour) ?? { knocks: 0, talked: 0, sets: 0 };
    x.knocks += Number(h.knocks);
    x.talked += Number(h.talked);
    x.sets += Number(h.sets);
    hourMap.set(h.hour, x);
  }
  const hourKeys = [...new Set([...Array.from({ length: 12 }, (_, i) => i + 8), ...hourMap.keys()])].sort((a, b) => a - b);
  const hourRate = (h: number) => {
    const x = hourMap.get(h);
    return x && x.knocks ? x.talked / x.knocks : 0;
  };
  const hourMax = Math.max(0.25, ...hourKeys.filter((h) => (hourMap.get(h)?.knocks ?? 0) >= 10).map(hourRate));
  const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
  const bestHour = hourKeys
    .filter((h) => (hourMap.get(h)?.knocks ?? 0) >= 10)
    .sort((a, b) => hourRate(b) - hourRate(a))[0];

  const hailMap = new Map<number, { knocks: number; talked: number; sets: number }>();
  for (const h of pick(now.hail)) {
    const x = hailMap.get(h.band) ?? { knocks: 0, talked: 0, sets: 0 };
    x.knocks += Number(h.knocks);
    x.talked += Number(h.talked);
    x.sets += Number(h.sets);
    hailMap.set(h.band, x);
  }

  const dayMap = new Map<string, { knocks: number; sets: number }>();
  for (const d of pick(now.daily)) {
    const x = dayMap.get(d.day) ?? { knocks: 0, sets: 0 };
    x.knocks += Number(d.knocks);
    x.sets += Number(d.sets);
    dayMap.set(d.day, x);
  }
  const dayMaxK = Math.max(1, ...[...dayMap.values()].map((d) => d.knocks));
  const dayMaxS = Math.max(1, ...[...dayMap.values()].map((d) => d.sets));
  const futureDay = (d: string) => d > period.today;
  const dayTick = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    return period.key === "week"
      ? dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })
      : String(dt.getUTCDate());
  };

  const focusLabel = focus === "team" ? "The team" : focus === me.name ? "You" : focus;
  const periodLower = period.label.toLowerCase();

  /* ------------------------------------------------------------- render */
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-[#0b0e13]">Scoreboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              {period.span}. <span className="text-gray-500">Everyone sees the same numbers.</span>
            </p>
          </div>
          <Chips items={PERIODS.map((p) => ({ label: p.label, href: href({ p: p.key }), on: p.key === period.key }))} />
        </div>

        {props.loadFailed ? (
          <p className="mt-5 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            The numbers didn&apos;t load. Refresh in a minute; if it keeps happening, check Health.
          </p>
        ) : null}

        {/* You */}
        {/* An admin gets the card only once they work doors or inspections themselves. */}
        {mine && (mySetter || myCloser) && (me.role !== "admin" || mine.knocks > 0 || mine.sets > 0 || mine.ran > 0 || mine.signed > 0) ? (
          <YouCard
            r={mine}
            setterRank={mySetter ? { rank: mySetter.rank, of: setters.length } : null}
            closerRank={myCloser ? { rank: myCloser.rank, of: closers.length } : null}
            prev={prevOf(me.name)}
            all={now.reps}
            days={days}
            period={period}
            pace={pace}
            money={money}
            role={me.role}
          />
        ) : null}

        {/* The team, door to signature */}
        <section className="mt-8">
          <SectionHead
            title={`${period.label}, door to signature`}
            sub={`The whole team${t.web_sets ? `, including ${t.web_sets} inspection${t.web_sets === 1 ? "" : "s"} booked on the website` : ""}. The small numbers compare with ${period.versus}.`}
          />
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#e3e6ea] bg-white">
            {/* Phone: a list, label left and number right. Wider: one row of steps. */}
            <ol className="flex flex-col divide-y divide-[#eceef1] sm:min-w-max sm:flex-row sm:divide-x sm:divide-y-0 lg:min-w-0">
              {steps.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 sm:block sm:min-w-[7.5rem] sm:flex-1 sm:py-3.5 lg:min-w-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#3b424e] sm:text-xs sm:text-gray-500">{s.label}</div>
                    <div className="mt-1 hidden font-display text-2xl font-extrabold tabular-nums text-[#0b0e13] sm:block">{n(s.v)}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-gray-500">
                      {s.of ? (
                        <span>
                          <span className="font-semibold text-[#3b424e]">{s.of}</span> {s.sub}
                        </span>
                      ) : (
                        <span className="hidden sm:inline">&nbsp;</span>
                      )}
                    </div>
                    <div className="mt-1 hidden text-xs tabular-nums sm:block">
                      <Delta now={s.v} before={s.was} label={period.versus} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right sm:hidden">
                    <div className="font-display text-xl font-extrabold tabular-nums text-[#0b0e13]">{n(s.v)}</div>
                    <div className="text-xs tabular-nums">
                      <Delta now={s.v} before={s.was} label={period.versus} />
                    </div>
                  </div>
                </li>
              ))}
              {money ? (
                <li className="bg-[#f6fbf8] px-4 py-3 sm:min-w-[7.5rem] sm:flex-1 sm:py-3.5 lg:min-w-0">
                  <div className="text-xs font-semibold text-gray-500">Signed value</div>
                  <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[#0c7a40]">
                    {t.signed_value ? moneyShort(t.signed_value) : "$0"}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {t.signed ? `${moneyShort(t.signed_value / t.signed)} average` : " "}
                  </div>
                  <div className="mt-1 text-xs tabular-nums">
                    {t.signed_value || b.signed_value ? (
                      <span className={t.signed_value >= b.signed_value ? "text-[#0c7a40]" : "text-gray-500"}>
                        {t.signed_value >= b.signed_value ? "+" : "−"}
                        {moneyShort(Math.abs(t.signed_value - b.signed_value))}
                      </span>
                    ) : (
                      <span>&nbsp;</span>
                    )}
                  </div>
                </li>
              ) : null}
            </ol>
          </div>
        </section>

        {/* Leaderboard and wins */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <section>
            <SectionHead
              title="Leaderboard"
              sub={
                board === "setters"
                  ? "Ranked by inspections set, then doors. Tap a name for their coaching."
                  : money
                    ? "Ranked by dollars signed. Tap a name for their coaching."
                    : "Ranked by agreements signed. Tap a name for their coaching."
              }
              right={
                <Chips
                  items={[
                    { label: "Setters", href: href({ board: "setters" }), on: board === "setters" },
                    { label: "Closers", href: href({ board: "closers" }), on: board === "closers" },
                  ]}
                />
              }
            />
            {rows.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-600">
                {board === "setters"
                  ? "No setters on the team yet. Add them on the Team page and they show up here."
                  : "No closers on the team yet. Add them on the Team page and they show up here."}
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
                <div
                  className={`hidden border-b border-[#eceef1] px-4 py-2 text-xs font-semibold text-gray-500 sm:grid ${
                    board === "setters" ? "sm:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1.4fr)_4rem_4rem_4.5rem_4rem]" : "sm:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1.4fr)_4rem_4.5rem_4.5rem_5rem]"
                  }`}
                >
                  <span>#</span>
                  <span>Name</span>
                  {board === "setters" ? (
                    <>
                      <span>Inspections set</span>
                      <span className="text-right">Doors</span>
                      <span className="text-right" title="Share of doors where someone came to the door">Talked</span>
                      <span className="text-right" title="Inspections set per 100 doors">Per 100</span>
                      <span className="text-right" title="Agreements signed from their inspections">Signed</span>
                    </>
                  ) : (
                    <>
                      <span>{money ? "Signed" : "Agreements signed"}</span>
                      <span className="text-right">Inspected</span>
                      <span className="text-right" title="Inspections where damage was found">Damage</span>
                      <span className="text-right" title="Signed, of roofs with damage">Close rate</span>
                      <span className="text-right">{money ? "Average" : "No-shows"}</span>
                    </>
                  )}
                </div>
                <ol>
                  {rows.map((r) => {
                    const you = r.who === me.name;
                    const g = goalsFor(r, period);
                    const primary = board === "setters" ? r.sets : money ? r.signed_value : r.signed;
                    // Setters see the closers' board in counts, with no dollar goal.
                    const goal = board === "setters" ? g.sets : money ? g.signed : null;
                    const fill = goal ? Math.min(100, (primary / goal) * 100) : 0;
                    const prev = prevOf(r.who);
                    const was = prev ? (board === "setters" ? prev.sets : money ? prev.signed_value : prev.signed) : 0;
                    return (
                      <li
                        key={r.who}
                        className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[#f0f1f3] px-4 py-3 last:border-0 ${
                          board === "setters"
                            ? "sm:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1.4fr)_4rem_4rem_4.5rem_4rem]"
                            : "sm:grid-cols-[2rem_minmax(0,1.6fr)_minmax(0,1.4fr)_4rem_4.5rem_4.5rem_5rem]"
                        } ${you ? "bg-[#f3faf6]" : ""}`}
                      >
                        <span className={`font-display text-base font-extrabold tabular-nums ${r.rank === 1 && primary > 0 ? "text-[#0c7a40]" : "text-gray-400"}`}>
                          {r.rank}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={href({ who: r.who }, "#coaching")}
                            scroll={false}
                            className="truncate font-semibold text-[#0b0e13] hover:underline"
                          >
                            {r.who}
                          </Link>
                          {you ? <span className="ml-1.5 text-xs font-semibold text-[#0c7a40]">You</span> : null}
                          {!r.active ? <span className="ml-1.5 text-xs text-gray-400">off the team</span> : null}
                          {/* Phone: the secondary numbers on one line. */}
                          <div className="text-xs leading-snug text-gray-500 sm:hidden">
                            {board === "setters"
                              ? [
                                  `${n(r.knocks)} doors`,
                                  pct(r.talked, r.knocks) ? `${pct(r.talked, r.knocks)} talked` : null,
                                  r.knocks >= MIN_DOORS_FOR_RATE ? `${((r.sets / r.knocks) * 100).toFixed(1)} per 100` : null,
                                  r.set_signed ? `${r.set_signed} signed` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                              : [
                                  `${r.ran} inspected`,
                                  `${r.damage} damage`,
                                  pct(r.signed, r.damage, 3) ? `${pct(r.signed, r.damage, 3)} close` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </div>
                        </div>
                        {/* Primary number with the goal under it. */}
                        <div className="min-w-[6.5rem] text-right sm:text-left">
                          <div className="flex items-baseline justify-end gap-1.5 sm:justify-start">
                            <span className="font-display text-base font-extrabold tabular-nums text-[#0b0e13]">
                              {board === "closers" && money ? moneyShort(primary) || "$0" : n(primary)}
                            </span>
                            {goal ? (
                              <span className="hidden text-xs text-gray-400 sm:inline">
                                of {board === "closers" ? kMoney(goal) : n(goal)}
                              </span>
                            ) : null}
                            {primary !== was ? (
                              <span className={`text-xs ${primary > was ? "text-[#0c7a40]" : "text-gray-400"}`} title={`${period.versus}`}>
                                {primary > was ? "↑" : "↓"}
                              </span>
                            ) : null}
                          </div>
                          {goal ? (
                            <div className="mt-1 hidden h-1.5 w-full max-w-[9rem] rounded-full bg-[#eceef1] sm:block">
                              <div className="h-1.5 rounded-full" style={{ width: `${fill}%`, background: GREEN }} />
                            </div>
                          ) : null}
                        </div>
                        {board === "setters" ? (
                          <>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">{n(r.knocks)}</span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">
                              {pct(r.talked, r.knocks) ?? <span className="text-gray-300">·</span>}
                            </span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">
                              {r.knocks >= MIN_DOORS_FOR_RATE ? ((r.sets / r.knocks) * 100).toFixed(1) : <span className="text-gray-300">·</span>}
                            </span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">{r.set_signed || <span className="text-gray-300">0</span>}</span>
                          </>
                        ) : (
                          <>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">{r.ran}</span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">
                              {pct(r.damage, r.ran, 3) ?? <span className="text-gray-300">·</span>}
                            </span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">
                              {pct(r.signed, r.damage, 3) ?? <span className="text-gray-300">·</span>}
                            </span>
                            <span className="hidden text-right tabular-nums text-[#3b424e] sm:block">
                              {money
                                ? r.signed
                                  ? moneyShort(r.signed_value / r.signed)
                                  : <span className="text-gray-300">·</span>
                                : r.no_shows}
                            </span>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            {isAdmin ? (
              <p className="mt-2 text-xs text-gray-500">
                Goals: {DEFAULT_GOALS.knocksWeek} doors and {DEFAULT_GOALS.setsWeek} inspections a week, {moneyShort(DEFAULT_GOALS.signedMonth)} signed a month, unless set per person on the{" "}
                <Link href="/admin/team#goals" className="font-semibold text-gray-700 underline">
                  Team page
                </Link>
                .
              </p>
            ) : null}
          </section>

          <section>
            <SectionHead title="Wins" sub={periodLower === "today" ? "Today." : `${period.label}.`} />
            {now.wins.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">The first inspection set {period.key === "today" ? "today" : `this ${period.key === "month" ? "month" : "week"}`} goes here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[#eceef1] border-y border-[#eceef1]">
                {now.wins.map((w, i) => (
                  <li key={`${w.kind}-${w.at}-${i}`} className="py-2.5 text-sm">
                    <div className="text-[#0b0e13]">
                      <span className="font-semibold">{w.who === me.name ? "You" : firstName(w.who)}</span>{" "}
                      {w.kind === "signed"
                        ? money && w.amount
                          ? <>signed <strong className="text-[#0c7a40]">{moneyShort(w.amount)}</strong></>
                          : "signed an agreement"
                        : w.kind === "damage"
                          ? "found damage"
                          : "set an inspection"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[street(w.address), ago(w.at, nowMs)].filter(Boolean).join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Coaching */}
        <section className="mt-10">
          <SectionHead
            id="coaching"
            title={focus === "team" ? "Coaching" : `Coaching: ${focusLabel === "You" ? "you" : focusLabel}`}
            sub="What the doors are telling us. Pick a person to see theirs."
          />
          <div className="mt-3">
            <Chips
              items={[
                { label: "Team", href: href({ who: "team" }, "#coaching"), on: focus === "team" },
                ...people.map((r) => ({
                  label: r.who === me.name ? "You" : r.who,
                  href: href({ who: r.who }, "#coaching"),
                  on: focus === r.who,
                })),
              ]}
            />
          </div>

          {/* Your own notes are already in your card at the top. */}
          {focusRow && !(focusRow.who === me.name && (mySetter || myCloser)) ? (
            <ul className="mt-4 space-y-1.5">
              {[...(isSetterRow(focusRow) ? setterNotes(focusRow, now.reps) : []), ...(isCloserRow(focusRow) ? closerNotes(focusRow, now.reps) : [])].map(
                (note, i) => <NoteLine key={i} note={note} />,
              )}
              {focusRow.knocks > 0 && focusRow.knocks < 40 && focusRow.ran < 5 ? (
                <li className="text-sm text-gray-500">Coaching notes start at 40 doors or 5 inspections in the period.</li>
              ) : null}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-8 lg:grid-cols-3">
            {/* Why they said no */}
            <div>
              <h3 className="font-semibold text-[#0b0e13]">Why they said no</h3>
              <p className="text-xs text-gray-500">
                {reasonTotal ? `${n(reasonTotal)} no's, from the reason tapped at the door.` : "From the reason tapped at the door."}
              </p>
              {reasons.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">No no&apos;s recorded yet.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {reasons.map(([reason, v]) => (
                    <li key={reason} title={`${reason}: ${v} (${Math.round((v / reasonTotal) * 100)}%)`}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate text-[#3b424e]">{reason}</span>
                        <span className="tabular-nums text-gray-500">{v}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-r bg-[#9aa3ae]" style={{ width: `${Math.max(2, (v / reasonMax) * 100)}%` }} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* When doors answer */}
            <div id="when" className="scroll-mt-20">
              <h3 className="font-semibold text-[#0b0e13]">When doors answer</h3>
              <p className="text-xs text-gray-500">
                {bestHour !== undefined
                  ? `Share of doors that opened, by hour. Best: ${hourLabel(bestHour)} at ${Math.round(hourRate(bestHour) * 100)}%.`
                  : "Share of doors that opened, by hour. Shows once an hour has 10 doors."}
              </p>
              <div className="mt-3 flex h-28 items-end gap-1 border-b border-[#d7dbe0]" role="img" aria-label="Share of doors that opened, by hour">
                {hourKeys.map((h) => {
                  const x = hourMap.get(h);
                  const enough = (x?.knocks ?? 0) >= 10;
                  const r = hourRate(h);
                  return (
                    <div
                      key={h}
                      className="flex h-full flex-1 flex-col justify-end"
                      title={x ? `${hourLabel(h)}: ${x.knocks} doors, ${x.talked} talked (${Math.round(r * 100)}%), ${x.sets} set${enough ? "" : ". Too few doors to read."}` : `${hourLabel(h)}: no doors`}
                    >
                      {x ? (
                        <div
                          className="w-full rounded-t"
                          style={{ height: `${Math.max(3, (Math.min(r, hourMax) / hourMax) * 100)}%`, background: enough ? GREEN : "#cfe3d7" }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-gray-400">
                {hourKeys.map((h) => (
                  <span key={h} className="flex-1 text-center">
                    {h % 2 === 0 ? hourLabel(h) : ""}
                  </span>
                ))}
              </div>
            </div>

            {/* Hail at the door */}
            <div>
              <h3 className="font-semibold text-[#0b0e13]">Hail at the door</h3>
              <p className="text-xs text-gray-500">Radar hail at the house, against what happened there.</p>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eceef1] text-left text-xs text-gray-500">
                    <th className="py-1.5 font-semibold">Hail</th>
                    <th className="py-1.5 text-right font-semibold">Doors</th>
                    <th className="py-1.5 text-right font-semibold">Talked</th>
                    <th className="py-1.5 text-right font-semibold" title="Inspections set per 100 doors">Per 100</th>
                  </tr>
                </thead>
                <tbody>
                  {[4, 3, 2, 1].map((band) => {
                    const x = hailMap.get(band);
                    return (
                      <tr key={band} className="border-b border-[#f3f4f6] last:border-0">
                        <td className="py-2 text-[#3b424e]">{HAIL_BANDS[band]}</td>
                        <td className="py-2 text-right tabular-nums">{x ? n(x.knocks) : <span className="text-gray-300">0</span>}</td>
                        <td className="py-2 text-right tabular-nums">{x ? pct(x.talked, x.knocks) ?? <span className="text-gray-300">·</span> : <span className="text-gray-300">·</span>}</td>
                        <td className="py-2 text-right tabular-nums">
                          {x && x.knocks >= MIN_DOORS_FOR_RATE ? ((x.sets / x.knocks) * 100).toFixed(1) : <span className="text-gray-300">·</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-500">If 2 in+ doesn&apos;t set more per 100, the map&apos;s default is wrong. This is where we&apos;ll see it.</p>
            </div>
          </div>
        </section>

        {/* Day by day */}
        {period.key !== "today" ? (
          <section className="mt-10">
            <SectionHead
              title="Day by day"
              sub={`${focusLabel === "You" ? "Yours" : focusLabel === "The team" ? "The team" : focusLabel}, ${periodLower}.`}
            />
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              {[
                { label: "Doors", key: "knocks" as const, max: dayMaxK },
                { label: "Inspections set", key: "sets" as const, max: dayMaxS },
              ].map((c) => (
                <div key={c.key}>
                  <div className="text-sm font-semibold text-[#3b424e]">{c.label}</div>
                  <div className="mt-2 flex h-24 items-end gap-[2px] border-b border-[#d7dbe0]" role="img" aria-label={`${c.label} per day`}>
                    {period.days.map((d) => {
                      const v = dayMap.get(d)?.[c.key] ?? 0;
                      return (
                        <div key={d} className="flex h-full flex-1 flex-col justify-end" title={`${d}: ${v} ${c.label.toLowerCase()}`}>
                          {v > 0 ? (
                            <div
                              className="mx-auto w-full max-w-[28px] rounded-t"
                              style={{ height: `${Math.max(3, (v / c.max) * 100)}%`, background: d === period.today ? GREEN : "#3b424e" }}
                            />
                          ) : futureDay(d) ? null : (
                            <div className="mx-auto h-[2px] w-full max-w-[28px] bg-[#e3e6ea]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-[2px] text-[10px] text-gray-400">
                    {period.days.map((d, i) => (
                      <span key={d} className="flex-1 text-center">
                        {period.key === "week" || i % 5 === 0 ? dayTick(d) : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- you card */

function YouCard({
  r,
  setterRank,
  closerRank,
  prev,
  all,
  days,
  period,
  pace,
  money,
  role,
}: {
  r: RepRow;
  setterRank: { rank: number; of: number } | null;
  closerRank: { rank: number; of: number } | null;
  prev?: RepRow;
  all: RepRow[];
  days: DayRow[];
  period: Period;
  pace: number;
  money: boolean;
  role: string;
}) {
  const g = goalsFor(r, period);
  const rec = recordsFor(r.who, days, period.today);
  const asSetter = !!setterRank && (role !== "closer" || r.knocks > 0);
  const asCloser = !!closerRank && (role !== "setter" || r.ran > 0 || r.signed > 0);
  const lead = asSetter && setterRank ? { ...setterRank, kind: "setters" } : closerRank ? { ...closerRank, kind: "closers" } : null;
  const notes = [...(asSetter ? setterNotes(r, all) : []), ...(asCloser ? closerNotes(r, all) : [])];
  const fmtDay = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  const periodWord =
    period.key === "today" ? "today" : period.key === "week" ? "this week" : period.key === "month" ? "this month" : "over 30 days";
  const empty = r.knocks === 0 && r.sets === 0 && r.ran === 0 && r.signed === 0;

  const facts: string[] = [];
  if (asSetter && rec.streak >= 2) facts.push(`${rec.streak} days in a row on doors`);
  if (rec.bestToday) facts.push("Best day of doors yet, today");
  else if (asSetter && rec.bestKnocks) facts.push(`Best day: ${n(rec.bestKnocks.n)} doors, ${fmtDay(rec.bestKnocks.day)}`);
  if (asSetter && rec.bestSets && rec.bestSets.n > 1) facts.push(`Most set in a day: ${rec.bestSets.n}`);
  if (asCloser && money && rec.bestWeek) facts.push(`Best week signed: ${moneyShort(rec.bestWeek.n)}`);

  return (
    <section className="mt-6 rounded-lg border border-[#e3e6ea] bg-white p-5">
      <p className="font-display text-xl font-bold leading-snug">
        {empty ? (
          <>
            <span className="text-[#0b0e13]">Nothing on the board {periodWord} yet.</span>{" "}
            <span className="text-gray-400">The first door counts.</span>
          </>
        ) : lead ? (
          <>
            <span className="text-[#0b0e13]">You&apos;re {ordinal(lead.rank)}</span>{" "}
            <span className="text-gray-400">
              of {lead.of} {lead.kind} {periodWord}.
            </span>
          </>
        ) : null}
      </p>
      {!empty ? (
        <p className="mt-1 text-sm text-gray-600">
          {[
            asSetter ? `${n(r.knocks)} doors` : null,
            asSetter ? `${n(r.talked)} talked` : null,
            asSetter ? `${n(r.sets)} inspection${r.sets === 1 ? "" : "s"} set` : null,
            asSetter && r.set_signed ? `${r.set_signed} signed from your sets` : null,
            asCloser ? `${r.ran} inspected` : null,
            asCloser ? (money ? `${moneyShort(r.signed_value) || "$0"} signed` : `${r.signed} signed`) : null,
            asSetter && r.hours >= 1 ? `${(r.knocks / r.hours).toFixed(0)} doors an hour` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          {prev && asSetter && prev.sets !== r.sets ? (
            <span className="text-gray-400"> ({prev.sets} set at {period.versus})</span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {asSetter ? (
          <>
            <GoalBar label="Doors" value={r.knocks} goal={g.knocks} pace={pace} unit="doors" />
            <GoalBar label="Inspections set" value={r.sets} goal={g.sets} pace={pace} unit="sets" />
          </>
        ) : null}
        {asCloser ? (
          money ? (
            <GoalBar label="Signed" value={r.signed_value} goal={g.signed} pace={pace} format={(v) => moneyShort(v) || "$0"} unit="" />
          ) : null
        ) : null}
      </div>

      {facts.length ? <p className="mt-4 text-sm text-[#3b424e]">{facts.join(" · ")}</p> : null}
      {notes.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-[#eceef1] pt-3">
          {notes.map((note, i) => (
            <NoteLine key={i} note={note} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
