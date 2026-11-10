import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Storm alerts stopped",
  robots: { index: false, follow: false },
};

export default async function StoppedPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <section className="bg-ink py-16">
      <Container className="max-w-xl">
        <h1 className="font-display text-3xl text-fg-inv">
          {e ? "That link didn't work." : "Storm alerts stopped."}
        </h1>
        <p className="mt-4 text-fg-inv-dim">
          {e
            ? `Call or text ${site.phone} and we'll take you off the list.`
            : `You won't hear from us about storms at that address. Changed your mind? Call or text ${site.phone}.`}
        </p>
      </Container>
    </section>
  );
}
