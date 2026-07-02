import { redirect } from "next/navigation";
import { site } from "@/lib/site";

/**
 * /review — a short, memorable, textable link that sends a customer straight to
 * the Google review form. Your techs/door-knockers text "poweredgetx.com/review"
 * after a job; the customer taps once and leaves a review. This is the on-site
 * lever for rebuilding review recency/velocity.
 *
 * Set site.googleWriteReviewUrl (GBP → "Ask for reviews" → copy link). Until
 * then it falls back to the profile/maps link, then a Google search — never a
 * dead end.
 */
export function GET() {
  const write = site.googleWriteReviewUrl as string;
  const profile = site.googleReviewsUrl as string;
  const target =
    write && write !== "#"
      ? write
      : profile && profile !== "#"
        ? profile
        : `https://www.google.com/search?q=${encodeURIComponent(
            site.legalName + " Dallas Fort Worth reviews",
          )}`;
  redirect(target);
}
