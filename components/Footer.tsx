import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";
import { services } from "@/lib/services";
import { cities } from "@/lib/cities";
import { Stars } from "./ui";

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink text-fg-inv-dim">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            {site.tagline}
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Stars />
            <span className="text-sm font-semibold text-fg-inv">
              {site.googleRating}
            </span>
            <span className="text-sm">
              ({site.googleReviewCount} Google reviews)
            </span>
          </div>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-fg-inv">
            Services
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/${s.slug}`} className="hover:text-bolt">
                  {s.short}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <Link href="/storm-check" className="text-bolt hover:text-bolt-hi">
                Free hail / storm check
              </Link>
            </li>
            <li>
              <Link href="/roof-check" className="text-bolt hover:text-bolt-hi">
                Free roof coverage check
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-fg-inv">
            Service areas
          </h3>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {cities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/service-areas/${c.slug}`}
                  className="hover:text-bolt"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-fg-inv">
            Contact
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href={site.phoneHref} className="hover:text-bolt">
                {site.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="hover:text-bolt">
                {site.email}
              </a>
            </li>
            <li className="pt-2 text-xs leading-relaxed">
              TECL #{site.teclLicense} · Licensed & insured
              <br />
              {site.liabilityCoverage} liability coverage
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {site.legalName}. Serving{" "}
            {site.serviceArea}.
          </p>
          <p>
            Texas electrical contractor TECL #{site.teclLicense}. Roofing is
            unlicensed statewide in Texas —{" "}
            <a
              href={site.tdlrVerifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-bolt hover:underline"
            >
              verify our license at TDLR
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
