import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { LoginForm } from "@/components/LoginForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Team sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return (
    <section className="bg-ink py-20 sm:py-28">
      <Container className="max-w-sm">
        <h1 className="font-display text-3xl text-fg-inv">PowerEdge team</h1>
        <p className="mt-3 text-fg-inv-dim">
          Enter your work email and we&apos;ll send you a link. No password to
          remember, and it keeps you signed in for a month.
        </p>
        {e === "expired" && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            That link was already used or has expired. Request a new one.
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-8 text-sm text-fg-inv-dim">
          Not set up yet? Ask Parker to add you, or call{" "}
          <a href={site.phoneHref} className="font-semibold text-bolt">{site.phone}</a>.
        </p>
      </Container>
    </section>
  );
}
