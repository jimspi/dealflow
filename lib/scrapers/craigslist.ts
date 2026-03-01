import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.craigslist;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeCraigslist(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`Craigslist returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Craigslist search results
    $('li.result-row, .cl-search-result, .result-info, li.cl-static-search-result').each((_i, el) => {
      const $el = $(el);

      // Try multiple selector patterns for Craigslist variations
      const titleEl = $el.find('a.result-title, .result-heading a, a.posting-title, a[href*="/bfs/"]').first();
      const title = titleEl.text().trim() || $el.find('.title-blob a, .titlestring').first().text().trim();
      const href = titleEl.attr('href') || $el.find('a').first().attr('href');
      if (!title || !href) return;

      const sourceUrl = href.startsWith('http') ? href : `${config.baseUrl}${href}`;

      const priceEl = $el.find('.result-price, .price, .priceinfo').first();
      const priceText = priceEl.text().trim();
      const dateEl = $el.find('time, .result-date, .date').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();

      const fullText = $el.text();

      deals.push({
        source: 'craigslist',
        sourceUrl,
        title,
        askingPrice: parsePrice(priceText),
        revenue: null,
        cashFlow: null,
        downPayment: null,
        financingAvailable: /financ|owner carry|seller carry|terms/i.test(fullText),
        businessType: 'Local Business',
        location: 'Salt Lake City, UT',
        description: fullText.replace(/\s+/g, ' ').trim().slice(0, 500),
        listedDate: dateText || null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('Craigslist scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
