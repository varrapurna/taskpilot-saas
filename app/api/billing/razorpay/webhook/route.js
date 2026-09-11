import { processRazorpayWebhook, verifyRazorpayWebhookSignature } from '@/server/billing/razorpay-webhook';

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const eventId = request.headers.get('x-razorpay-event-id');

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('Razorpay webhook rejected because its secret is not configured.');
    return new Response('Billing webhook is not configured.', { status: 503 });
  }
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.warn('Rejected Razorpay webhook with an invalid signature.');
    return new Response('Unauthorized', { status: 401 });
  }
  if (!eventId) return new Response('Missing Razorpay event ID.', { status: 400 });

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON payload.', { status: 400 });
  }

  try {
    await processRazorpayWebhook({ eventId, eventType: body.event, payload: body.payload });
    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Razorpay webhook processing failed.', error?.message);
    return new Response('Webhook processing failed.', { status: 500 });
  }
}
