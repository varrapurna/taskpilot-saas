function allowedOrigins() {
  return (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function hasAllowedOrigin(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && allowedOrigins().includes(origin));
}

export function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  if (!origin || !hasAllowedOrigin(request)) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}
