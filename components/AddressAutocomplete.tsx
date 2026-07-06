"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Address typeahead. Suggests real addresses as the user types (Photon /
 * OpenStreetMap — free, no key, CORS-enabled), biased to North Texas. Picking
 * a suggestion fills the field and (optionally) fires onSelect to auto-run.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Street address, city, ZIP",
  className = "",
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}) {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 4) {
      setItems([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q,
        )}&limit=5&lat=32.9&lon=-96.8&lang=en`;
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json();
        const list: string[] = (data.features || [])
          .filter((f: any) => f.properties?.countrycode === "US")
          .map((f: any) => {
            const p = f.properties;
            const line1 =
              [p.housenumber, p.street].filter(Boolean).join(" ") || p.name;
            return [
              line1,
              p.city || p.district || p.county,
              [p.state, p.postcode].filter(Boolean).join(" "),
            ]
              .filter(Boolean)
              .join(", ");
          })
          .filter((s: string, i: number, a: string[]) => s && a.indexOf(s) === i);
        setItems(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(v: string) {
    skip.current = true; // don't re-search the chosen value
    onChange(v);
    setItems([]);
    setOpen(false);
    onSelect?.(v);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        required={required}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-ink-2 shadow-2xl">
          {items.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-steel text-fg-inv" : "text-fg-inv-dim"
                } hover:bg-steel hover:text-fg-inv`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
