// Proxy for the MH Leads embed.
// The vendor's API returns the form data but omits the CORS header, so the
// browser blocks our page from reading it. Server-to-server has no CORS, so we
// forward the request here and hand the response back same-origin.

const UPSTREAM = 'https://mhleadsg.exploremira.com/api/ingestion';

function targetUrl(request) {
  const url = new URL(request.url);
  const subPath = url.pathname.replace(/^\/api\/mhl\/?/, ''); // e.g. "v1/embed-config"
  return `${UPSTREAM}/${subPath}${url.search}`;
}

async function forward(request, method) {
  const init = {
    method,
    headers: { Accept: 'application/json' },
  };

  if (method === 'POST') {
    init.body = await request.text();
    init.headers['Content-Type'] =
      request.headers.get('content-type') || 'application/json';
  }

  const upstream = await fetch(targetUrl(request), init);
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(request) {
  return forward(request, 'GET');
}

export async function POST(request) {
  return forward(request, 'POST');
}
