const buckets = new Map();
const MAX_BUCKETS = 10_000;

function clientKey(request) {
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 120);

  const forwarded = request.headers.get('x-forwarded-for');
  const lastForwardedIp = forwarded?.split(',').at(-1)?.trim();
  return (lastForwardedIp || 'unknown').slice(0, 120);
}

function discardOldestBucket() {
  const oldestKey = buckets.keys().next().value;
  if (oldestKey) buckets.delete(oldestKey);
}

export function consumeRateLimit(request, scope, { limit, windowMs }) {
  const now = Date.now();
  const key = `${scope}:${clientKey(request)}`;
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    while (buckets.size >= MAX_BUCKETS) discardOldestBucket();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  buckets.delete(key);
  buckets.set(key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}
