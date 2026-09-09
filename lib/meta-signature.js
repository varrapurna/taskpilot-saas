import crypto from 'crypto';

/**
 * Verifies the signature Meta sends with every webhook POST request.
 * The comparison is constant-time so a caller cannot infer the app secret.
 */
export function verifyMetaWebhookSignature(rawBody, signature, appSecret) {
  if (!rawBody || !signature || !appSecret) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')}`;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(signature, 'utf8');

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}
