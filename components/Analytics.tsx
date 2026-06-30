import Script from "next/script";

/**
 * Analytics + call tracking, all env-gated so the site runs clean until IDs are
 * added (no errors, nothing loads).
 *   NEXT_PUBLIC_GA_ID        - GA4 measurement ID (e.g. G-XXXXXXX)
 *   NEXT_PUBLIC_CALLRAIL_SRC - CallRail DNI swap script src (from CallRail JS
 *                              snippet, e.g. //cdn.callrail.com/companies/123/abc/12/swap.js)
 */
export function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  // CallRail swap script intentionally OFF: we use static per-page tracking
  // numbers (placed per route) instead of session-level dynamic swapping.
  // Set NEXT_PUBLIC_CALLRAIL_SRC to re-enable the swap method if ever needed.
  const callrail = process.env.NEXT_PUBLIC_CALLRAIL_SRC;

  return (
    <>
      {ga && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {callrail && (
        <Script
          src={callrail.startsWith("http") ? callrail : `https:${callrail}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
