import { reviews } from "@/lib/reviews";
import { site } from "@/lib/site";
import { Container, SectionHeading, Stars } from "./ui";

export function Reviews() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <SectionHeading
            kicker="What North Texas says"
            title="Rated 4.7 by your neighbors."
            intro="Real Google reviews from real DFW homeowners and businesses. We had a rough patch late last year — we fixed it, and we're earning back every star."
          />
          <a
            href={site.googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-4 rounded-card border border-paper-2 bg-white px-6 py-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-fg">
                  {site.googleRating}
                </span>
                <Stars tone="deep" />
              </div>
              <p className="mt-1 text-sm text-fg-dim">
                {site.googleReviewCount} Google reviews
              </p>
            </div>
          </a>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-card border border-paper-2 bg-white p-7 shadow-sm"
            >
              <Stars className="mb-4" tone="deep" />
              <blockquote className="flex-1 text-[15px] leading-relaxed text-fg">
                “{r.quote}”
              </blockquote>
              <figcaption className="mt-6 border-t border-paper-2 pt-4">
                <span className="font-display font-bold text-fg">
                  {r.author}
                </span>
                <span className="block text-sm text-fg-dim">{r.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
