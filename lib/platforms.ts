export interface PlatformConfig {
  name: string;
  slug: string;
  baseUrl: string;
  searchUrls: string[];
  rateLimit: number; // ms between requests
  timeout: number; // ms
  requiresJs: boolean;
  headers: Record<string, string>;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function defaultHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  bizbuysell: {
    name: 'BizBuySell',
    slug: 'bizbuysell',
    baseUrl: 'https://www.bizbuysell.com',
    searchUrls: [
      'https://www.bizbuysell.com/businesses-for-sale/?q=&l=&d=10000-150000',
      'https://www.bizbuysell.com/businesses-for-sale/utah/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
  flippa: {
    name: 'Flippa',
    slug: 'flippa',
    baseUrl: 'https://flippa.com',
    searchUrls: [
      'https://flippa.com/search?filter%5Bproperty_type%5D=website,established_website,app,saas,ecommerce&filter%5Bprice_max%5D=50000&sort_alias=most_relevant',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: true,
    headers: defaultHeaders(),
  },
  acquire: {
    name: 'Acquire.com',
    slug: 'acquire',
    baseUrl: 'https://acquire.com',
    searchUrls: [
      'https://acquire.com/marketplace/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: true,
    headers: defaultHeaders(),
  },
  bizquest: {
    name: 'BizQuest',
    slug: 'bizquest',
    baseUrl: 'https://www.bizquest.com',
    searchUrls: [
      'https://www.bizquest.com/businesses-for-sale/?q=&l=utah&d=10000-150000',
      'https://www.bizquest.com/businesses-for-sale/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
  empireflippers: {
    name: 'Empire Flippers',
    slug: 'empireflippers',
    baseUrl: 'https://empireflippers.com',
    searchUrls: [
      'https://empireflippers.com/marketplace/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: true,
    headers: defaultHeaders(),
  },
  exchangemarketplace: {
    name: 'Exchange Marketplace',
    slug: 'exchangemarketplace',
    baseUrl: 'https://exchangemarketplace.com',
    searchUrls: [
      'https://exchangemarketplace.com/shops?page=1',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
  franchisegator: {
    name: 'FranchiseGator',
    slug: 'franchisegator',
    baseUrl: 'https://www.franchisegator.com',
    searchUrls: [
      'https://www.franchisegator.com/franchises/low-cost/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
  loopnet: {
    name: 'LoopNet',
    slug: 'loopnet',
    baseUrl: 'https://www.loopnet.com',
    searchUrls: [
      'https://www.loopnet.com/search/businesses-for-sale/utah/',
    ],
    rateLimit: 2000,
    timeout: 15000,
    requiresJs: true,
    headers: defaultHeaders(),
  },
  craigslist: {
    name: 'Craigslist SLC',
    slug: 'craigslist',
    baseUrl: 'https://saltlakecity.craigslist.org',
    searchUrls: [
      'https://saltlakecity.craigslist.org/search/bfs',
    ],
    rateLimit: 3000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
  google: {
    name: 'Google Search',
    slug: 'google',
    baseUrl: 'https://www.google.com',
    searchUrls: [
      'https://www.google.com/search?q=%22business+for+sale%22+%22seller+financing%22+under+%2450000',
      'https://www.google.com/search?q=%22established+business%22+%22owner+retiring%22+utah',
      'https://www.google.com/search?q=%22cash+flowing%22+%22business+for+sale%22+%2410000+down',
    ],
    rateLimit: 5000,
    timeout: 15000,
    requiresJs: false,
    headers: defaultHeaders(),
  },
};

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
