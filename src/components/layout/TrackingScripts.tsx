import Script from "next/script";

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

function configuredGtmId() {
  const value = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  return value && GTM_ID_PATTERN.test(value) ? value : null;
}

/**
 * Loads Google Tag Manager only when a syntactically valid container ID is
 * configured. GA4 and Meta Pixel should be managed inside GTM so the website
 * has one browser-side tag entry point and avoids duplicate firing.
 */
export function TrackingScripts() {
  const gtmId = configuredGtmId();
  if (!gtmId) return null;

  const iframeSrc = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`;
  const loader = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;

  return (
    <>
      <Script id="velto-gtm" strategy="afterInteractive">
        {loader}
      </Script>
      <noscript>
        <iframe
          src={iframeSrc}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
          title="Google Tag Manager"
          aria-hidden="true"
        />
      </noscript>
    </>
  );
}
