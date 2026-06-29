import Link from "next/link";
import { clsx } from "@/lib/clsx";

export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

export function Kicker({
  children,
  className = "",
  tone = "bright",
}: {
  children: React.ReactNode;
  className?: string;
  /** "bright" lime for dark backgrounds, "deep" green for light backgrounds. */
  tone?: "bright" | "deep";
}) {
  const color = tone === "deep" ? "text-bolt-deep" : "text-bolt";
  const square = tone === "deep" ? "bg-bolt-deep" : "bg-bolt";
  return (
    <p className={clsx("kicker", color, className)}>
      <span
        className={clsx(
          "mr-2 inline-block h-2 w-2 translate-y-[-1px]",
          square,
        )}
      />
      {children}
    </p>
  );
}

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "dark";
  className?: string;
};

export function Button({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-6 py-3.5 font-display text-[0.95rem] font-bold tracking-tight transition-all duration-150 active:scale-[0.98]";
  const styles = {
    primary:
      "bg-bolt text-ink hover:bg-bolt-hi shadow-[0_8px_30px_-8px_rgba(127,251,174,0.55)]",
    ghost:
      "border border-line text-fg-inv hover:border-bolt hover:text-bolt",
    dark: "bg-ink text-fg-inv hover:bg-ink-2",
  };
  return (
    <Link href={href} className={clsx(base, styles[variant], className)}>
      {children}
    </Link>
  );
}

export function SectionHeading({
  kicker,
  title,
  intro,
  dark = false,
  align = "left",
}: {
  kicker?: string;
  title: string;
  intro?: string;
  dark?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div
      className={clsx(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      {kicker && (
        <Kicker className="mb-4" tone={dark ? "bright" : "deep"}>
          {kicker}
        </Kicker>
      )}
      <h2
        className={clsx(
          "font-display text-3xl sm:text-4xl md:text-5xl",
          dark ? "text-fg-inv" : "text-fg",
        )}
      >
        {title}
      </h2>
      {intro && (
        <p
          className={clsx(
            "mt-5 text-lg leading-relaxed",
            dark ? "text-fg-inv-dim" : "text-fg-dim",
          )}
        >
          {intro}
        </p>
      )}
    </div>
  );
}

/** Star rating row used in the review badge. */
export function Stars({
  className = "",
  tone = "bright",
}: {
  className?: string;
  tone?: "bright" | "deep";
}) {
  return (
    <span
      className={clsx(
        "inline-flex gap-0.5",
        tone === "deep" ? "text-bolt-deep" : "text-bolt",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4 fill-current">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}
