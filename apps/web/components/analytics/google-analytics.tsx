import Script from "next/script";

/**
 * Loads GA4 when NEXT_PUBLIC_GA_ID is configured. Consent Mode v2 defaults are `denied` (pushed
 * to the dataLayer before `config`), so the tag sends only cookieless, unmodelled pings until
 * <ConsentBanner /> grants consent; <AnalyticsProvider /> replays the stored choice on each load.
 */
export function GoogleAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){dataLayer.push(arguments);};
gtag('consent', 'default', {
  ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  analytics_storage: 'denied', wait_for_update: 500
});
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true, send_page_view: true });`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
    </>
  );
}
