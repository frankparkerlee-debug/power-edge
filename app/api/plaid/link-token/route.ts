import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { plaid, plaidConfig } from "@/lib/plaid";

// Creates a short-lived Plaid Link token the browser widget opens with.
// Requests auth (account/routing) + identity so we can verify + underwrite on
// connect. Returns 501 (not 500) when keys aren't set, so the UI can degrade
// gracefully to the plain capture form.
export async function POST() {
  if (!plaidConfig().enabled) {
    return NextResponse.json({ error: "Plaid not configured" }, { status: 501 });
  }
  try {
    const data = await plaid<{ link_token: string }>("/link/token/create", {
      user: { client_user_id: randomUUID() },
      client_name: "PowerEdge Financing",
      products: ["auth", "identity"],
      country_codes: ["US"],
      language: "en",
    });
    return NextResponse.json({ link_token: data.link_token });
  } catch (err) {
    console.error("[plaid] link-token failed", err);
    return NextResponse.json(
      { error: "Could not start bank connect" },
      { status: 502 },
    );
  }
}
