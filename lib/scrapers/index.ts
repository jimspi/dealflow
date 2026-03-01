import { RawDeal, ScraperResult, SourceStatus } from '../types';
import { scrapeBizBuySell } from './bizbuysell';
import { scrapeFlippa } from './flippa';
import { scrapeAcquire } from './acquire';
import { scrapeBizQuest } from './bizquest';
import { scrapeEmpireFlippers } from './empireflippers';
import { scrapeExchangeMarketplace } from './exchangemarketplace';
import { scrapeFranchiseGator } from './franchisegator';
import { scrapeLoopNet } from './loopnet';
import { scrapeCraigslist } from './craigslist';
import { scrapeGoogleAlerts } from './google-alerts';

interface ScraperEntry {
  name: string;
  slug: string;
  fn: () => Promise<RawDeal[]>;
}

const SCRAPERS: ScraperEntry[] = [
  { name: 'BizBuySell', slug: 'bizbuysell', fn: scrapeBizBuySell },
  { name: 'Flippa', slug: 'flippa', fn: scrapeFlippa },
  { name: 'Acquire.com', slug: 'acquire', fn: scrapeAcquire },
  { name: 'BizQuest', slug: 'bizquest', fn: scrapeBizQuest },
  { name: 'Empire Flippers', slug: 'empireflippers', fn: scrapeEmpireFlippers },
  { name: 'Exchange Marketplace', slug: 'exchangemarketplace', fn: scrapeExchangeMarketplace },
  { name: 'FranchiseGator', slug: 'franchisegator', fn: scrapeFranchiseGator },
  { name: 'LoopNet', slug: 'loopnet', fn: scrapeLoopNet },
  { name: 'Craigslist SLC', slug: 'craigslist', fn: scrapeCraigslist },
  { name: 'Google Search', slug: 'google', fn: scrapeGoogleAlerts },
];

export interface ScrapeAllResult {
  deals: RawDeal[];
  results: ScraperResult[];
  sourceHealth: Record<string, SourceStatus>;
}

export async function scrapeAll(): Promise<ScrapeAllResult> {
  const results: ScraperResult[] = [];
  const sourceHealth: Record<string, SourceStatus> = {};

  // Run all scrapers in parallel with individual error isolation
  const scraperPromises = SCRAPERS.map(async (scraper): Promise<ScraperResult> => {
    const start = Date.now();
    try {
      const deals = await scraper.fn();
      const duration = Date.now() - start;

      console.log(`[${scraper.name}] Found ${deals.length} deals in ${duration}ms`);

      sourceHealth[scraper.slug] = {
        name: scraper.name,
        lastSuccess: new Date().toISOString(),
        lastFailure: null,
        lastError: null,
        dealsFound: deals.length,
      };

      return {
        source: scraper.slug,
        deals,
        error: null,
        duration,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.error(`[${scraper.name}] Failed in ${duration}ms: ${errorMsg}`);

      sourceHealth[scraper.slug] = {
        name: scraper.name,
        lastSuccess: null,
        lastFailure: new Date().toISOString(),
        lastError: errorMsg,
        dealsFound: 0,
      };

      return {
        source: scraper.slug,
        deals: [],
        error: errorMsg,
        duration,
      };
    }
  });

  const settledResults = await Promise.all(scraperPromises);
  results.push(...settledResults);

  // Combine all deals
  const allDeals = results.flatMap(r => r.deals);

  const successCount = results.filter(r => !r.error).length;
  const totalDeals = allDeals.length;
  console.log(`\n[Orchestrator] ${successCount}/${SCRAPERS.length} scrapers succeeded, ${totalDeals} total deals found`);

  return {
    deals: allDeals,
    results,
    sourceHealth,
  };
}
