import { RawDeal, AnalyzedDeal, BuyerFilters, DEFAULT_BUYER_FILTERS } from './types';

const EXCLUDE_PATTERNS = [
  /\bmlm\b/i,
  /\bmulti[- ]?level/i,
  /\bdropship/i,
  /\bcrypto/i,
  /\bgambl/i,
  /\bcasino/i,
  /\bcannabis\b/i,
  /\bmarijuana\b/i,
  /\bdispensary/i,
  /\badult\s+(entertainment|content)/i,
];

const LICENSE_PATTERNS = [
  /\bmedical\s+(license|degree|certification)/i,
  /\blaw\s+(license|degree|firm)/i,
  /\brequires?\s+(medical|law|legal|nursing|pharmacy)\s+(license|degree)/i,
  /\blicensed\s+(physician|doctor|attorney|lawyer|pharmacist|nurse)/i,
];

export function applyFilters(
  deals: RawDeal[],
  filters: BuyerFilters = DEFAULT_BUYER_FILTERS
): RawDeal[] {
  return deals.filter(deal => {
    // Price filter
    if (deal.askingPrice !== null && deal.askingPrice > filters.maxAskingPrice) {
      return false;
    }

    // Down payment filter
    if (deal.downPayment !== null && deal.downPayment > filters.maxDownPayment) {
      return false;
    }

    // Exclude keywords
    const text = `${deal.title} ${deal.description} ${deal.businessType}`.toLowerCase();

    for (const pattern of EXCLUDE_PATTERNS) {
      if (pattern.test(text)) {
        return false;
      }
    }

    for (const keyword of filters.excludeKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        return false;
      }
    }

    // Exclude if requires specialized license
    for (const pattern of LICENSE_PATTERNS) {
      if (pattern.test(text)) {
        return false;
      }
    }

    // Skip pre-revenue / idea-stage
    if (
      deal.revenue === null &&
      deal.cashFlow === null &&
      /\b(pre[- ]?revenue|idea[- ]?stage|concept|not yet launched|no revenue)\b/i.test(text)
    ) {
      return false;
    }

    return true;
  });
}

export function ensureDiversity(deals: AnalyzedDeal[]): AnalyzedDeal[] {
  const result: AnalyzedDeal[] = [];
  const sourceCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  // Sort by score descending
  const sorted = [...deals].sort((a, b) => b.analysis.score - a.analysis.score);

  for (const deal of sorted) {
    const sourceCount = sourceCounts[deal.source] || 0;
    const categoryCount = categoryCounts[deal.analysis.category] || 0;

    if (sourceCount >= 3 || categoryCount >= 3) {
      continue;
    }

    result.push(deal);
    sourceCounts[deal.source] = sourceCount + 1;
    categoryCounts[deal.analysis.category] = categoryCount + 1;

    if (result.length >= 10) break;
  }

  return result;
}
