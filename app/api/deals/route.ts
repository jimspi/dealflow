import { NextResponse } from 'next/server';
import { getDigest, getDigestDates, getStoredFilters, storeFilters } from '@/lib/dedup';
import { DEFAULT_BUYER_FILTERS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  try {
    if (date) {
      // Get specific digest
      const digest = await getDigest(date);
      if (!digest) {
        return NextResponse.json({ error: 'Digest not found' }, { status: 404 });
      }
      return NextResponse.json(digest);
    }

    // Get list of digest dates + current filters
    const [dates, filters] = await Promise.all([
      getDigestDates(),
      getStoredFilters(),
    ]);

    return NextResponse.json({
      dates,
      filters: filters || DEFAULT_BUYER_FILTERS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Validate filter fields
    const allowedKeys = ['maxAskingPrice', 'maxDownPayment', 'minScore', 'dealTypes', 'locationPreference', 'excludeKeywords'];
    const updates: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid filter fields provided' }, { status: 400 });
    }

    // Merge with existing
    const existing = await getStoredFilters();
    const currentFilters = existing
      ? { ...DEFAULT_BUYER_FILTERS, ...(typeof existing === 'string' ? JSON.parse(existing) : existing) }
      : { ...DEFAULT_BUYER_FILTERS };

    const merged = { ...currentFilters, ...updates };
    await storeFilters(merged);

    return NextResponse.json({ success: true, filters: merged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update filters' },
      { status: 500 }
    );
  }
}
