import { createHash } from 'crypto';
import { RawDeal } from './types';

let kvModule: typeof import('@vercel/kv') | null = null;

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
  if (!kvModule) {
    kvModule = await import('@vercel/kv');
  }
  return kvModule.kv;
}

export function hashDeal(deal: RawDeal): string {
  const normalized = `${deal.title.toLowerCase().trim()}|${deal.source}|${deal.askingPrice ?? 'unknown'}`;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export async function deduplicateDeals(deals: RawDeal[]): Promise<RawDeal[]> {
  const kv = await getKV();
  const seen = new Set<string>();
  const unique: RawDeal[] = [];

  for (const deal of deals) {
    const hash = hashDeal(deal);

    // In-batch dedup
    if (seen.has(hash)) continue;
    seen.add(hash);

    // KV dedup (skip if KV not configured)
    if (kv) {
      const exists = await kv.get(`deal:${hash}`);
      if (exists) continue;
    }

    unique.push(deal);
  }

  return unique;
}

export async function markDealsAsSeen(deals: Array<{ dealHash: string }>): Promise<void> {
  const kv = await getKV();
  if (!kv) return;

  for (const deal of deals) {
    await kv.set(`deal:${deal.dealHash}`, true, { ex: 60 * 60 * 24 * 30 }); // 30 day TTL
  }
}

export async function storeDigest(date: string, digest: unknown): Promise<void> {
  const kv = await getKV();
  if (!kv) return;

  await kv.set(`digest:${date}`, JSON.stringify(digest), { ex: 60 * 60 * 24 * 90 }); // 90 day TTL

  // Maintain a list of digest dates
  const dates: string[] = (await kv.get('digest:dates')) || [];
  if (!dates.includes(date)) {
    dates.unshift(date);
    if (dates.length > 90) dates.length = 90;
    await kv.set('digest:dates', JSON.stringify(dates));
  }
}

export async function getDigest(date: string): Promise<unknown | null> {
  const kv = await getKV();
  if (!kv) return null;
  const raw = await kv.get(`digest:${date}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function getDigestDates(): Promise<string[]> {
  const kv = await getKV();
  if (!kv) return [];
  const raw = await kv.get('digest:dates');
  if (!raw) return [];
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as string[]);
}

export async function getStoredFilters(): Promise<unknown | null> {
  const kv = await getKV();
  if (!kv) return null;
  return kv.get('buyer:filters');
}

export async function storeFilters(filters: unknown): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  await kv.set('buyer:filters', JSON.stringify(filters));
}
