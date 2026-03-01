import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS, delay } from '../platforms';

const config = PLATFORMS.bizbuysell;

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

  if (!res.ok) throw new Error(`BizBuySell returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const deals: RawDeal[] = [];

  // BizBuySell listing cards
  $('.listing').each((_i, el) => {
    const $el = $(el);
    const titleEl = $el.find('.listing-title a, .listingName a, h3 a').first();
    const title = titleEl.text().trim();
    const href = titleEl.attr('href');
    if (!title || !href) return;

    const sourceUrl = href.startsWith('http') ? href : `${config.baseUrl}${href}`;

    const priceText = $el.find('.listing-price, .price, [class*="price"]').first().text();
    const cashFlowText = $el.find('.listing-cashFlow, [class*="cashFlow"], [class*="cash-flow"]').first().text();
    const revenueText = $el.find('.listing-revenue, [class*="revenue"]').first().text();
    const locationText = $el.find('.listing-location, [class*="location"]').first().text().trim();
    const descText = $el.find('.listing-description, .listingDescription, p').first().text().trim();

    const description = descText.slice(0, 500);
    const financingAvailable = /seller financ|owner financ|sba|financing available/i.test(
      `${description} ${$el.text()}`
    );

    deals.push({
      source: 'bizbuysell',
      sourceUrl,
      title,
      askingPrice: parsePrice(priceText),
      revenue: parsePrice(revenueText),
      cashFlow: parsePrice(cashFlowText),
      downPayment: null,
      financingAvailable,
      businessType: $el.find('.listing-category, [class*="category"]').first().text().trim() || 'Unknown',
      location: locationText || 'Unknown',
      description,
      listedDate: null,
      scrapedAt: new Date().toISOString(),
    });
  });

  // Alternative selector pattern
  if (deals.length === 0) {
    $('[class*="listing"], [class*="result"], .search-result').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/Business-Opportunity/"], a[href*="/businesses-for-sale/"]').first();
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      if (!title || !href || title.length < 5) return;

      const sourceUrl = href.startsWith('http') ? href : `${config.baseUrl}${href}`;
      const fullText = $el.text();

      const priceMatch = fullText.match(/\$[\d,]+(?:\.\d{2})?/);
      const cashFlowMatch = fullText.match(/cash\s*flow[:\s]*\$?([\d,]+)/i);
      const revenueMatch = fullText.match(/revenue[:\s]*\$?([\d,]+)/i);

      deals.push({
        source: 'bizbuysell',
        sourceUrl,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: revenueMatch ? parsePrice(revenueMatch[1]) : null,
        cashFlow: cashFlowMatch ? parsePrice(cashFlowMatch[1]) : null,
        downPayment: null,
        financingAvailable: /seller financ|owner financ|sba|financing/i.test(fullText),
        businessType: 'Unknown',
        location: 'Unknown',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  }

  return deals;
}

export async function scrapeBizBuySell(): Promise<RawDeal[]> {
  const allDeals: RawDeal[] = [];

  for (const url of config.searchUrls) {
    try {
      const deals = await scrapePage(url);
      allDeals.push(...deals);
      await delay(config.rateLimit);
    } catch (err) {
      console.error(`BizBuySell error for ${url}:`, err instanceof Error ? err.message : err);
    }
  }

  return allDeals;
}
