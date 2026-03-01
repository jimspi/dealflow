import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.exchangemarketplace;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeExchangeMarketplace(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`Exchange Marketplace returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="listing"], [class*="shop-card"], [class*="Card"], .grid-item').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/shops/"], h3, h4, [class*="title"]').first();
      const title = titleEl.text().trim();
      const href = $el.find('a').first().attr('href');
      if (!title || title.length < 3) return;

      const sourceUrl = href ? (href.startsWith('http') ? href : `https://exchangemarketplace.com${href}`) : config.searchUrls[0];
      const fullText = $el.text();

      const priceMatch = fullText.match(/\$[\d,]+/);
      const revenueMatch = fullText.match(/(?:revenue)[:\s]*\$?([\d,]+)/i);
      const profitMatch = fullText.match(/(?:profit|income)[:\s]*\$?([\d,]+)/i);

      deals.push({
        source: 'exchangemarketplace',
        sourceUrl,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: revenueMatch ? parsePrice(revenueMatch[1]) : null,
        cashFlow: profitMatch ? parsePrice(profitMatch[1]) : null,
        downPayment: null,
        financingAvailable: false,
        businessType: 'Shopify Store',
        location: 'Online',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('Exchange Marketplace scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
