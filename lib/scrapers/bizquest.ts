import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS, delay } from '../platforms';

const config = PLATFORMS.bizquest;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function scrapePage(url: string): Promise<RawDeal[]> {
  const res = await fetch(url, {
    headers: config.headers,
    signal: AbortSignal.timeout(config.timeout),
  });

  if (!res.ok) throw new Error(`BizQuest returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const deals: RawDeal[] = [];

  $('.listing, [class*="listing-card"], [class*="search-result"]').each((_i, el) => {
    const $el = $(el);
    const titleEl = $el.find('a[href*="/business/"], h3 a, h4 a, .listing-title a').first();
    const title = titleEl.text().trim();
    const href = titleEl.attr('href');
    if (!title || !href) return;

    const sourceUrl = href.startsWith('http') ? href : `${config.baseUrl}${href}`;
    const fullText = $el.text();

    const priceText = $el.find('[class*="price"]').first().text();
    const cashFlowText = $el.find('[class*="cash"], [class*="flow"]').first().text();
    const revenueText = $el.find('[class*="revenue"], [class*="gross"]').first().text();
    const locationText = $el.find('[class*="location"]').first().text().trim();

    deals.push({
      source: 'bizquest',
      sourceUrl,
      title,
      askingPrice: parsePrice(priceText) || parsePrice(fullText.match(/\$[\d,]+/)?.[0]),
      revenue: parsePrice(revenueText),
      cashFlow: parsePrice(cashFlowText),
      downPayment: null,
      financingAvailable: /seller financ|owner financ|sba|financing/i.test(fullText),
      businessType: $el.find('[class*="category"], [class*="type"]').first().text().trim() || 'Unknown',
      location: locationText || 'Unknown',
      description: $el.find('[class*="description"], p').first().text().trim().slice(0, 500),
      listedDate: null,
      scrapedAt: new Date().toISOString(),
    });
  });

  return deals;
}

export async function scrapeBizQuest(): Promise<RawDeal[]> {
  const allDeals: RawDeal[] = [];

  for (const url of config.searchUrls) {
    try {
      const deals = await scrapePage(url);
      allDeals.push(...deals);
      await delay(config.rateLimit);
    } catch (err) {
      console.error(`BizQuest error for ${url}:`, err instanceof Error ? err.message : err);
    }
  }

  return allDeals;
}
