export interface RawDeal {
  source: string;
  sourceUrl: string;
  title: string;
  askingPrice: number | null;
  revenue: number | null;
  cashFlow: number | null;
  downPayment: number | null;
  financingAvailable: boolean;
  businessType: string;
  location: string;
  description: string;
  listedDate: string | null;
  scrapedAt: string;
}

export interface DealAnalysis {
  score: number;
  verdict: 'STRONG BUY' | 'WORTH EXPLORING' | 'MAYBE' | 'PASS';
  oneLiner: string;
  dealStructure: string;
  monthlyProfit: number;
  risks: string[];
  upside: string[];
  aiAngle: string;
  nextStep: string;
  category: 'saas' | 'ecommerce' | 'content' | 'service' | 'franchise' | 'local' | 'route' | 'real_asset' | 'other';
}

export interface AnalyzedDeal extends RawDeal {
  analysis: DealAnalysis;
  dealHash: string;
}

export interface Digest {
  date: string;
  generatedAt: string;
  totalScraped: number;
  totalAfterFilter: number;
  totalAnalyzed: number;
  deals: AnalyzedDeal[];
  subject: string;
  sourceHealth: Record<string, SourceStatus>;
}

export interface SourceStatus {
  name: string;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastError: string | null;
  dealsFound: number;
}

export interface BuyerFilters {
  maxAskingPrice: number;
  maxDownPayment: number;
  minScore: number;
  dealTypes: string[];
  locationPreference: string;
  excludeKeywords: string[];
}

export const DEFAULT_BUYER_FILTERS: BuyerFilters = {
  maxAskingPrice: 150000,
  maxDownPayment: 15000,
  minScore: 30,
  dealTypes: [
    'saas', 'ecommerce', 'content', 'service',
    'franchise', 'local', 'route', 'real_asset', 'other',
  ],
  locationPreference: 'Salt Lake City, Utah area for local deals, anywhere for online',
  excludeKeywords: ['mlm', 'dropshipping', 'crypto', 'gambling', 'cannabis'],
};

export interface ScraperResult {
  source: string;
  deals: RawDeal[];
  error: string | null;
  duration: number;
}

export type ScraperFn = () => Promise<RawDeal[]>;
