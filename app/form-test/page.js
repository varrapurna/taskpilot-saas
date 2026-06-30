import Script from 'next/script';

export default function FormTest() {
  return (
    <>
      <Script id="mhl-config" strategy="beforeInteractive">
        {`
          window.mhl_id = "51a9260b-d95e-464b-81a0-c17010bdf019";
          window.mhl_ingest_base = "https://mhleadsg.exploremira.com/api/ingestion";
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
