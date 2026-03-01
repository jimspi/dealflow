import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.acquire;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseRevenueStr(text: string): number | null {
  const match = text.match(/\$?([\d,.]+)\s*(k|m)?/i);
  if (!match) return null;
  let val = parseFloat(match[1].replace(/,/g, ''));
  if (match[2]?.toLowerCase() === 'k') val *= 1000;
  if (match[2]?.toLowerCase() === 'm') val *= 1000000;
  return isNaN(val) ? null : val;
}

export async function scrapeAcquire(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  // Try API approach first
  try {
    const apiUrl = 'https://api.acquire.com/marketplace/listings?price_max=150000&page=1&per_page=20';
    const res = await fetch(apiUrl, {
      headers: {
        ...config.headers,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(config.timeout),
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        const data = await res.json() as {
          listings?: Array<{
            title?: string;
            url?: string;
            id?: string;
            asking_price?: number;
            annual_revenue?: number;
            annual_profit?: number;
            ttm_revenue?: number;
            ttm_profit?: number;
            business_model?: string;
            description?: string;
          }>;
        };
        if (data.listings && Array.isArray(data.listings)) {
          for (const listing of data.listings) {
            if (!listing.title) continue;
            deals.push({
              source: 'acquire',
              sourceUrl: listing.url || `https://acquire.com/listings/${listing.id || ''}`,
              title: listing.title,
              askingPrice: listing.asking_price || null,
              revenue: listing.annual_revenue || listing.ttm_revenue || null,
              cashFlow: listing.annual_profit || listing.ttm_profit || null,
              downPayment: null,
              financingAvailable: false,
              businessType: listing.business_model || 'SaaS / Online',
              location: 'Online',
              description: (listing.description || '').slice(0, 500),
              listedDate: null,
              scrapedAt: new Date().toISOString(),
            });
          }
          return deals;
        }
      }
    }
  } catch {
    // API failed, try HTML
  }

  // HTML fallback
  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`Acquire returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="listing"], [class*="card"], [data-listing]').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('h3, h4, [class*="title"]').first();
      const title = titleEl.text().trim();
      const href = $el.find('a[href*="/listing"]').first().attr('href') || $el.find('a').first().attr('href');
      if (!title || title.length < 3) return;

      const sourceUrl = href ? (href.startsWith('http') ? href : `https://acquire.com${href}`) : config.searchUrls[0];
      const fullText = $el.text();

      const priceMatch = fullText.match(/asking[:\s]*\$?([\d,.]+\s*[km]?)/i) || fullText.match(/\$[\d,]+/);
      const revenueMatch = fullText.match(/(?:arr|mrr|revenue)[:\s]*\$?([\d,.]+\s*[km]?)/i);
      const profitMatch = fullText.match(/(?:profit|sde|earnings)[:\s]*\$?([\d,.]+\s*[km]?)/i);

      deals.push({
        source: 'acquire',
        sourceUrl,
        title,
        askingPrice: priceMatch ? (typeof priceMatch[1] === 'string' ? parseRevenueStr(priceMatch[1]) : parsePrice(priceMatch[0])) : null,
        revenue: revenueMatch ? parseRevenueStr(revenueMatch[1]) : null,
        cashFlow: profitMatch ? parseRevenueStr(profitMatch[1]) : null,
        downPayment: null,
        financingAvailable: false,
        businessType: 'SaaS / Online',
        location: 'Online',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('Acquire scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
