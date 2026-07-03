"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight count-up that animates once when scrolled into view. No deps
 * (IntersectionObserver + rAF), styled by the parent. Respects reduced motion.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1300,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVal(to);
      return;
    }
    let backstop: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(to * eased);
              if (p < 1) requestAnimationFrame(step);
              else setVal(to);
            };
            requestAnimationFrame(step);
            // Backstop: if rAF is throttled (e.g. a backgrounded tab), guarantee
            // the final value still lands. setTimeout fires even when rAF is paused.
            backstop = setTimeout(() => setVal(to), duration + 600);
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(backstop);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}
