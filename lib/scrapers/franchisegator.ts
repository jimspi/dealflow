import * as cheerio from 'cheerio';
import { RawDeal } from '../types';
import { PLATFORMS } from '../platforms';

const config = PLATFORMS.franchisegator;

function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseInvestmentRange(text: string): { min: number | null; max: number | null } {
  const match = text.match(/\$?([\d,]+)\s*[-–]\s*\$?([\d,]+)/);
  if (match) {
    return {
      min: parsePrice(match[1]),
      max: parsePrice(match[2]),
    };
  }
  const single = text.match(/\$?([\d,]+)/);
  return {
    min: single ? parsePrice(single[1]) : null,
    max: null,
  };
}

export async function scrapeFranchiseGator(): Promise<RawDeal[]> {
  const deals: RawDeal[] = [];

  try {
    const res = await fetch(config.searchUrls[0], {
      headers: config.headers,
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!res.ok) throw new Error(`FranchiseGator returned ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    $('[class*="franchise"], [class*="listing"], .result, .card').each((_i, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[href*="/franchise/"], h3 a, h4 a, [class*="name"] a').first();
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');
      if (!title || title.length < 3) return;

      const sourceUrl = href ? (href.startsWith('http') ? href : `${config.baseUrl}${href}`) : config.searchUrls[0];
      const fullText = $el.text();

      const investmentText = fullText.match(/(?:investment|cost|fee)[:\s]*\$?[\d,]+\s*[-–]?\s*\$?[\d,]*/i)?.[0] || '';
      const investment = parseInvestmentRange(investmentText);
      const feeMatch = fullText.match(/(?:franchise fee)[:\s]*\$?([\d,]+)/i);
      const categoryMatch = $el.find('[class*="category"], [class*="industry"]').first().text().trim();

      deals.push({
        source: 'franchisegator',
        sourceUrl,
        title: `Franchise: ${title}`,
        askingPrice: investment.min || (feeMatch ? parsePrice(feeMatch[1]) : null),
        revenue: null,
        cashFlow: null,
        downPayment: feeMatch ? parsePrice(feeMatch[1]) : investment.min,
        financingAvailable: /financ|sba|loan/i.test(fullText),
        businessType: categoryMatch || 'Franchise',
        location: 'Various',
        description: fullText.slice(0, 500).trim(),
        listedDate: null,
        scrapedAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    console.error('FranchiseGator scraping error:', err instanceof Error ? err.message : err);
  }

  return deals;
}
