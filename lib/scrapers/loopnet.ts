import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.loopnet;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function scrapeLoopNet(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`LoopNet returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="listing"], [class*="placard"], [class*="card"], .search-result').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/Listing/"], h3, h4, [class*="title"]').first();
      const title = titleEl.text().trim();
      const href = $el.find('a').first().attr('href');
      if (!title || title.length < 3) return;

      const sourceUrl = href ? (href.startsWith('http') ? href : `https://www.loopnet.com${href}`) : config.searchUrls[0];
      const fullText = $el.text();

      const priceMatch = fullText.match(/\$[\d,]+/);
      const capRateMatch = fullText.match(/(?:cap rate)[:\s]*([\d.]+)%/i);
      const locationText = $el.find('[class*="location"], [class*="address"]').first().text().trim();

      let businessType = 'Commercial Property';
      if (/laundrom/i.test(fullText)) businessType = 'Laundromat';
      else if (/car wash/i.test(fullText)) businessType = 'Car Wash';
      else if (/storage/i.test(fullText)) businessType = 'Storage Unit';
      else if (/vending/i.test(fullText)) businessType = 'Vending';
      else if (/gas station|convenience/i.test(fullText)) businessType = 'Gas Station / Convenience';
      else if (/restaurant|food/i.test(fullText)) businessType = 'Restaurant / Food';

      const description = capRateMatch
        ? `${fullText.slice(0, 450).trim()} | Cap Rate: ${capRateMatch[1]}%`
        : fullText.slice(0, 500).trim();

      deals.push({
        source: 'loopnet',
        sourceUrl,
        title,
        askingPrice: priceMatch ? parsePrice(priceMatch[0]) : null,
        revenue: null,
        cashFlow: null,
        downPayment: null,
        financingAvailable: /financ|sba|loan|owner carry/i.test(fullText),
        businessType,
        location: locationText || 'Utah',
        description,
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('LoopNet scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
