import Image from "next/image";
import { photos } from "@/lib/photos";
import { Container, SectionHeading } from "./ui";

/** Recent-work photo gallery. Renders nothing until photos are added, so the
 *  page never shows an empty section. */
export function Gallery() {
  if (!photos.length) return null;
  return (
    <section className="bg-paper py-20 sm:py-28">
      <Container>
        <SectionHeading
          kicker="Recent work"
          title="Real roofs. Real crews. Real Texas homes."
          align="center"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <figure
              key={p.src}
              className="overflow-hidden rounded-card border border-paper-2 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={p.src}
                  alt={p.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
              {p.caption && (
                <figcaption className="p-3 text-sm text-fg-dim">
                  {p.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
