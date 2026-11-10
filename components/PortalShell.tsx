"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The portal's own chrome.
 *
 * Internal pages previously rendered with no chrome at all: no navigation, no
 * back, no indication of where you were or how you got there. Every tool was a
 * standalone page you could only reach by typing a URL. This is the shell that
 * makes them one product.
 *
 * Deliberately NOT the marketing chrome. A rep in a driveway should never see
 * a "Free Inspection" call-to-action, and the office should never mistake the
 * company phone number in a nav bar for lead data.
 */

/**
 * Who is signed in, and therefore what they are here to do.
 *
 * Parker runs a setter and closer model: setters knock doors and book
 * inspections, closers turn up to those inspections, price the job and get it
 * signed. They are not the same screen. A setter does not price work, and
 * putting the agreement in front of one is how an unpriced contract gets
 * signed on a doorstep.
 *
 * "rep" is the old single role and still exists on older rows. It is treated
 * as both, so nobody loses access on the day this ships.
 */
type Role = "setter" | "closer" | "rep" | "admin";
type Me = { name: string; email: string; role: Role };

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Roles that see it. Omitted means everyone signed in. */
  roles?: Role[];
};

const SELLS = ["closer", "rep", "admin"] as const;

const NAV: NavItem[] = [
  { href: "/admin", label: "Today", icon: "sun" },
  { href: "/admin/storms", label: "Map", icon: "map" },
  { href: "/admin/jobs", label: "Jobs", icon: "folder" },
  // Setters book the inspection; the closer prices it and writes the paper.
  { href: "/admin/contract", label: "Agreement", icon: "pen", roles: [...SELLS] },
];

const MORE: NavItem[] = [
  // A setter's whole job is what is on the board, so they get this one.
  { href: "/admin/appointments", label: "Inspections", icon: "calendar" },
  { href: "/sales", label: "Playbook", icon: "book" },
  { href: "/admin/leads", label: "Leads", icon: "inbox", roles: ["admin"] },
  { href: "/admin/territories", label: "Territories", icon: "flag", roles: ["admin"] },
  { href: "/admin/health", label: "Health", icon: "pulse", roles: ["admin"] },
];

function allowed(n: NavItem, role?: Role) {
  if (!n.roles) return true;
  return !!role && n.roles.includes(role);
}

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const d: Record<string, string> = {
    sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
    map: "M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15",
    folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
    pen: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z",
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l3.5-7z",
    flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
    book: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
    pulse: "M22 12h-4l-3 9L9 3l-3 9H2",
    back: "M19 12H5M12 19l-7-7 7-7",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d[name] || d.folder} />
    </svg>
  );
}

/** Human title for the current route, so the bar always says where you are. */
function titleFor(path: string): { title: string; parent?: string } {
  const map: Record<string, { title: string; parent?: string }> = {
    "/admin": { title: "Today" },
    "/admin/storms": { title: "Knock map" },
    "/admin/jobs": { title: "Jobs" },
    "/admin/contract": { title: "New agreement", parent: "/admin/jobs" },
    "/admin/appointments": { title: "Inspections" },
    "/admin/leads": { title: "Leads" },
    "/admin/territories": { title: "Territories" },
    "/admin/health": { title: "Health" },
    "/sales": { title: "Playbook" },
  };
  if (map[path]) return map[path];
  if (path.startsWith("/admin/jobs/")) return { title: "Job", parent: "/admin/jobs" };
  return { title: "PowerEdge" };
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d?.ok) setMe(d);
        else setSignedOut(true);
      })
      .catch(() => { if (live) setSignedOut(true); });
    return () => { live = false; };
  }, []);

  const { title, parent } = titleFor(pathname);
  const isHome = pathname === "/admin";
  const nav = NAV.filter((n) => allowed(n, me?.role));
  const more = MORE.filter((n) => allowed(n, me?.role));

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  // Signed out: show the page's own prompt with no chrome. Rendering tabs
  // nobody can use, above a user chip reading "?", is worse than nothing.
  if (signedOut) {
    return <main className="min-h-screen bg-[#f4f5f7]">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-16 lg:pb-0">
      {/* Top bar: always says where you are, always offers a way back. */}
      <header className="sticky top-0 z-40 border-b border-[#1d222b] bg-[#0b0e13]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {!isHome ? (
            <button
              onClick={() => (parent ? router.push(parent) : router.back())}
              aria-label="Back"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Icon name="back" />
            </button>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#7FFBAE]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#0b0e13]">
                <path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z" />
              </svg>
            </span>
          )}
          <span className="truncate font-display text-base font-bold text-white">{title}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setMenu((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                {(me?.name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{me?.name || "…"}</span>
            </button>
          </div>
        </div>

        {menu && (
          <div className="absolute right-3 top-14 z-50 w-60 rounded-lg border border-[#2a2f3a] bg-[#11151c] p-2 shadow-2xl">
            <div className="px-3 py-2 text-xs text-white/50">
              {me?.email}
              {me?.role === "admin" && <span className="ml-1 text-[#7FFBAE]">· admin</span>}
            </div>
            {more.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMenu(false)}
                className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-white/85 hover:bg-white/10"
              >
                <Icon name={m.icon} className="h-4 w-4" />
                {m.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-white/60 hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-6xl">
        {/* Desktop rail. On mobile this is the bottom bar instead. */}
        <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 border-r border-[#e3e6ea] bg-white p-3 lg:block">
          {[...nav, ...more].map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`mb-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${
                  active ? "bg-[#0b0e13] text-white" : "text-[#3b424e] hover:bg-[#f0f1f4]"
                }`}
              >
                <Icon name={n.icon} className="h-4.5 w-4.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile tabs. Four, because a rep holding a phone at a front door
          should not be choosing between nine things. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#e3e6ea] bg-white lg:hidden">
        {nav.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                active ? "text-[#0c7a40]" : "text-[#6b7280]"
              }`}
            >
              <Icon name={n.icon} className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
