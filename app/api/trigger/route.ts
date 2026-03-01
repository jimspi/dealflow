import { NextResponse } from 'next/server';
import { runPipeline } from '../cron/daily-digest/route';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runPipeline();
}

// Also allow GET for easy browser testing
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized. Pass ?token=YOUR_CRON_SECRET or Authorization header.' }, { status: 401 });
  }

  return runPipeline();
}
