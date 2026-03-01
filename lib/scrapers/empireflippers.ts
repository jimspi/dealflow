import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.empireflippers;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeEmpireFlippers(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  // Try their API endpoint first
  try {
    const apiUrl = 'https://empireflippers.com/api/listings?listing_price_max=150000&page=1';
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
            listing_number?: string;
            listing_price?: number;
            monthly_net_profit?: number;
            niche?: string;
            monetization?: string[];
            description?: string;
            created_at?: string;
          }>;
        };
        if (data.listings && Array.isArray(data.listings)) {
          for (const listing of data.listings) {
            const monthlyProfit = listing.monthly_net_profit || 0;
            deals.push({
              source: 'empireflippers',
              sourceUrl: listing.url || `https://empireflippers.com/listing/${listing.listing_number || ''}`,
              title: listing.title || `${listing.niche || 'Online'} Business`,
              askingPrice: listing.listing_price || null,
              revenue: null,
              cashFlow: monthlyProfit ? monthlyProfit * 12 : null,
              downPayment: null,
              financingAvailable: false,
              businessType: listing.niche || (listing.monetization || []).join(', ') || 'Online Business',
              location: 'Online',
              description: (listing.description || '').slice(0, 500),
              listedDate: listing.created_at || null,
              scrapedAt: new Date().toISOString(),
            });
          }
          return deals;
        }
      }
    }
  } catch {
    // API failed
  }

  // HTML fallback
  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`Empire Flippers returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="listing"], [class*="Listing"], [class*="card"]').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/listing/"], h3, h4').first();
      const title = titleEl.text().trim();
      const href = $el.find('a[href*="/listing/"]').first().attr('href') || $el.find('a').first().attr('href');
      if (!title || title.length < 3) return;

      const sourceUrl = href ? (href.startsWith('http') ? href : `https://empireflippers.com${href}`) : config.searchUrls[0];
      const fullText = $el.text();

      const priceMatch = fullText.match(/\$[\d,]+/);
      const profitMatch = fullText.match(/(?:profit|net)[:\s]*\$?([\d,]+)\s*\/?\s*mo/i);
      const nicheMatch = fullText.match(/(?:niche|type)[:\s]*([A-Za-z\s&]+)/i);

      deals.push({
        source: 'empireflippers',
        sourceUrl,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: null,
        cashFlow: profitMatch ? parsePrice(profitMatch[1]) : null,
        downPayment: null,
        financingAvailable: false,
        businessType: nicheMatch ? nicheMatch[1].trim() : 'Online Business',
        location: 'Online',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('Empire Flippers scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
