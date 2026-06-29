import Script from 'next/script';

export default function FormTest() {
  return (
    <>
      <Script id="mhl-config" strategy="beforeInteractive">
        {`
          window.mhl_id = "d23a8709-6409-43b0-8a98-127e06ec6d47";
          window.mhl_ingest_base = "/api/mhl";
        `}
      </Script>
      <Script
        src="https://d1h7xhvkv25xoi.cloudfront.net/form.render.js"
        strategy="afterInteractive"
      />
      <div id="mhl-form"></div>
    </>
  );
}
