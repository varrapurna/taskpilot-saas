export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { message: 'TaskPilot API is healthy.', code: 200 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
