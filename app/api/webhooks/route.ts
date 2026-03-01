import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('[Webhook] Received:', JSON.stringify(body).slice(0, 500));

    // Future: Handle inbound deal alerts from various sources
    // e.g., BizBuySell saved search alerts, Google Alerts RSS, etc.

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
