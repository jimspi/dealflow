import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.flippa;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeFlippa(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  // Flippa has a JSON API we can try first
  try {
    const apiUrl = 'https://flippa.com/search/listings?filter%5Bproperty_type%5D=website,established_website,app,saas,ecommerce&filter%5Bprice_max%5D=50000&page=1&per_page=20';
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
          data?: Array<{
            title?: string;
            url?: string;
            slug?: string;
            current_price?: number;
            price?: number;
            profit_per_month?: number;
            monthly_profit?: number;
            revenue_per_month?: number;
            monthly_revenue?: number;
            property_type?: string;
            status?: string;
            description?: string;
            summary?: string;
            created_at?: string;
          }>;
        };
        if (data.data && Array.isArray(data.data)) {
          for (const listing of data.data) {
            if (!listing.title) continue;
            const monthlyProfit = listing.profit_per_month || listing.monthly_profit || null;
            const monthlyRevenue = listing.revenue_per_month || listing.monthly_revenue || null;

            deals.push({
              source: 'flippa',
              sourceUrl: listing.url || `https://flippa.com/listings/${listing.slug || ''}`,
              title: listing.title,
              askingPrice: listing.current_price || listing.price || null,
              revenue: monthlyRevenue ? monthlyRevenue * 12 : null,
              cashFlow: monthlyProfit ? monthlyProfit * 12 : null,
              downPayment: null,
              financingAvailable: false,
              businessType: listing.property_type || 'Online Business',
              location: 'Online',
              description: (listing.description || listing.summary || '').slice(0, 500),
              listedDate: listing.created_at || null,
              scrapedAt: new Date().toISOString(),
            });
          }
          return deals;
        }
      }
    }
  } catch {
    // API approach failed, try HTML scraping
  }

  // Fallback: HTML scraping
  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`Flippa returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="ListingCard"], [class*="listing-card"], [data-testid*="listing"]').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/listings/"], h3, h4').first();
      const title = titleEl.text().trim();
      const href = titleEl.attr('href') || $el.find('a').first().attr('href');
      if (!title || !href) return;

      const sourceUrl = href.startsWith('http') ? href : `https://flippa.com${href}`;
      const fullText = $el.text();

      const priceMatch = fullText.match(/\$[\d,]+/);
      const profitMatch = fullText.match(/(?:profit|net)[:\s]*\$?([\d,]+)\s*\/?\s*mo/i);
      const revenueMatch = fullText.match(/(?:revenue)[:\s]*\$?([\d,]+)\s*\/?\s*mo/i);

      deals.push({
        source: 'flippa',
        sourceUrl,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: revenueMatch ? parsePrice(revenueMatch[1]) : null,
        cashFlow: profitMatch ? parsePrice(profitMatch[1]) : null,
        downPayment: null,
        financingAvailable: false,
        businessType: 'Online Business',
        location: 'Online',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('Flippa HTML scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
