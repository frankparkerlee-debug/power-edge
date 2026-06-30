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
  // CallRail JS — required for BOTH dynamic number insertion (call source
  // tracking) AND native form capture (CallTrk.captureForm → Message Flow
  // auto-text). Public client script, safe to ship; env can override.
  const callrail =
    process.env.NEXT_PUBLIC_CALLRAIL_SRC ||
    "//cdn.callrail.com/companies/387742686/2f03333e58cf8b31a3b5/12/swap.js";

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
