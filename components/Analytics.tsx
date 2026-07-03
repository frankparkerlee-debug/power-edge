import Script from "next/script";

/**
 * Analytics + call tracking, all env-gated so the site runs clean until IDs are
 * added (no errors, nothing loads).
 *   NEXT_PUBLIC_GA_ID         - GA4 measurement ID (e.g. G-XXXXXXX)
 *   NEXT_PUBLIC_META_PIXEL_ID - Meta (Facebook) Pixel ID for a PowerEdge pixel
 *                               (NOT the Merit peptide pixel — keep brands separate)
 *   NEXT_PUBLIC_CALLRAIL_SRC  - CallRail DNI swap script src (from CallRail JS
 *                               snippet, e.g. //cdn.callrail.com/companies/123/abc/12/swap.js)
 */
export function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const metaPixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
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
      {metaPixel && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${metaPixel}&ev=PageView&noscript=1`}
            />
          </noscript>
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
