import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS, delay } from '../platforms';

const config = PLATFORMS.google;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const SEARCH_QUERIES = [
  '"business for sale" "seller financing" under $50000',
  '"established business" "owner retiring" utah',
  '"cash flowing" "business for sale" $10000 down',
  '"SBA loan" "business acquisition" small business under $100000',
  '"website for sale" revenue profit monthly',
  '"vending route" OR "FedEx route" OR "bread route" for sale',
  '"laundromat for sale" OR "car wash for sale" utah financing',
];

async function searchGoogle(query: string): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encodedQuery}&num=10`;

  try {
    const res = await fetch(url, {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) return deals;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Parse Google search results
    $('div.g, div[data-hveid]').each((_i, el) => {
      const $el = $(el);
      const linkEl = $el.find('a[href^="http"]').first();
      const href = linkEl.attr('href');
      const title = $el.find('h3').first().text().trim();
      const snippet = $el.find('[data-sncf], .VwiC3b, [class*="snippet"]').first().text().trim();

      if (!title || !href) return;

      // Skip non-listing results
      if (/google\.com|youtube\.com|wikipedia\.org|facebook\.com|twitter\.com|reddit\.com/i.test(href)) return;
      if (title.length < 10) return;

      // Check if this looks like a business listing
      const combined = `${title} ${snippet}`.toLowerCase();
      const isRelevant =
        combined.includes('for sale') ||
        combined.includes('business') ||
        combined.includes('acquisition') ||
        combined.includes('revenue') ||
        combined.includes('financing');

      if (!isRelevant) return;

      const priceMatch = combined.match(/\$[\d,]+/);
      const revenueMatch = combined.match(/(?:revenue|gross)[:\s]*\$?([\d,]+)/i);
      const cashFlowMatch = combined.match(/(?:cash\s*flow|profit|net|sde)[:\s]*\$?([\d,]+)/i);

      deals.push({
        source: 'google',
        sourceUrl: href,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: revenueMatch ? parsePrice(revenueMatch[1]) : null,
        cashFlow: cashFlowMatch ? parsePrice(cashFlowMatch[1]) : null,
        downPayment: null,
        financingAvailable: /seller financ|owner financ|sba|financing available/i.test(combined),
        businessType: 'Unknown',
        location: /utah|salt lake|slc|provo|ogden/i.test(combined) ? 'Utah' : 'Unknown',
        description: snippet.slice(0, 500),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error(`Google search error for "${query}":`, err instanceof Error ? err.message : err);
  }

  return deals;
}

export async function scrapeGoogleAlerts(): Promise<RawDeal[]> {
  const allDeals: RawDeal[] = [];

  // Only run a subset of queries to avoid rate limiting
  const queriesToRun = SEARCH_QUERIES.slice(0, 3);

  for (const query of queriesToRun) {
    try {
      const deals = await searchGoogle(query);
      allDeals.push(...deals);
      await delay(config.rateLimit);
    } catch (err) {
      console.error(`Google alerts error:`, err instanceof Error ? err.message : err);
    }
  }

  return allDeals;
}
