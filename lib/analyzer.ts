import Anthropic from '@anthropic-ai/sdk';
import { RawDeal, AnalyzedDeal, DealAnalysis } from './types';
import { hashDeal } from './dedup';

function getClient(): Anthropic {
  return new Anthropic();
}

const ANALYSIS_PROMPT = `You are a business acquisition analyst helping a buyer with $10,000 cash who is open to financing (seller financing, SBA loans, earnouts, revenue splits).

Analyze this business listing and provide a structured assessment.

SCORING GUIDE:
- 80-100: Cash flowing, affordable entry, seller financing offered, strong upside
- 60-79: Good fundamentals but needs negotiation on price or terms
- 40-59: Interesting but significant unknowns or risks
- 20-39: Overpriced, unverifiable claims, or poor fit
- 1-19: Hard pass — doesn't meet criteria

LISTING:
Title: {title}
Source: {source}
Asking Price: {askingPrice}
Annual Revenue: {revenue}
Annual Cash Flow: {cashFlow}
Down Payment: {downPayment}
Financing Available: {financingAvailable}
Type: {businessType}
Location: {location}
Description: {description}

Respond ONLY in this exact JSON format, no markdown, no code fences, no explanation:
{"score":<1-100 integer>,"verdict":"<STRONG BUY|WORTH EXPLORING|MAYBE|PASS>","oneLiner":"<one compelling sentence about why this deal matters or doesnt>","dealStructure":"<how the buyer could realistically acquire this with $10k cash — be specific about financing approach>","monthlyProfit":<estimated monthly take-home after debt service if financed, integer>,"risks":["<risk 1>","<risk 2>","<risk 3>"],"upside":["<opportunity 1>","<opportunity 2>"],"aiAngle":"<specific way AI or automation could improve this business>","nextStep":"<exact first action the buyer should take if interested>","category":"<saas|ecommerce|content|service|franchise|local|route|real_asset|other>"}`;

function buildPrompt(deal: RawDeal): string {
  return ANALYSIS_PROMPT
    .replace('{title}', deal.title)
    .replace('{source}', deal.source)
    .replace('{askingPrice}', deal.askingPrice ? `$${deal.askingPrice.toLocaleString()}` : 'Not listed')
    .replace('{revenue}', deal.revenue ? `$${deal.revenue.toLocaleString()}` : 'Not listed')
    .replace('{cashFlow}', deal.cashFlow ? `$${deal.cashFlow.toLocaleString()}` : 'Not listed')
    .replace('{downPayment}', deal.downPayment ? `$${deal.downPayment.toLocaleString()}` : 'Not specified')
    .replace('{financingAvailable}', deal.financingAvailable ? 'Yes' : 'Not mentioned')
    .replace('{businessType}', deal.businessType)
    .replace('{location}', deal.location)
    .replace('{description}', deal.description);
}

function parseAnalysis(text: string): DealAnalysis | null {
  try {
    // Strip any markdown code fences
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (
      typeof parsed.score !== 'number' ||
      !parsed.verdict ||
      !parsed.oneLiner
    ) {
      return null;
    }

    // Clamp score
    parsed.score = Math.max(1, Math.min(100, Math.round(parsed.score)));

    // Validate verdict
    const validVerdicts = ['STRONG BUY', 'WORTH EXPLORING', 'MAYBE', 'PASS'];
    if (!validVerdicts.includes(parsed.verdict)) {
      parsed.verdict = parsed.score >= 70 ? 'WORTH EXPLORING' : parsed.score >= 40 ? 'MAYBE' : 'PASS';
    }

    // Validate category
    const validCategories = ['saas', 'ecommerce', 'content', 'service', 'franchise', 'local', 'route', 'real_asset', 'other'];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'other';
    }

    // Ensure arrays
    if (!Array.isArray(parsed.risks)) parsed.risks = [];
    if (!Array.isArray(parsed.upside)) parsed.upside = [];

    return parsed as DealAnalysis;
  } catch {
    return null;
  }
}

export async function analyzeDeal(deal: RawDeal): Promise<AnalyzedDeal | null> {
  try {
    const prompt = buildPrompt(deal);

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const analysis = parseAnalysis(textBlock.text);
    if (!analysis) {
      console.error(`Failed to parse analysis for: ${deal.title}`);
      return null;
    }

    return {
      ...deal,
      analysis,
      dealHash: hashDeal(deal),
    };
  } catch (err) {
    console.error(`Analysis error for "${deal.title}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function analyzeDeals(deals: RawDeal[], maxDeals = 10): Promise<AnalyzedDeal[]> {
  // Only analyze the top candidates (limit API calls)
  const toAnalyze = deals.slice(0, maxDeals);
  const analyzed: AnalyzedDeal[] = [];

  console.log(`[Analyzer] Analyzing ${toAnalyze.length} deals with Claude...`);

  // Run analyses in batches of 3 to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < toAnalyze.length; i += batchSize) {
    const batch = toAnalyze.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(deal => analyzeDeal(deal)));

    for (const result of results) {
      if (result) {
        analyzed.push(result);
        console.log(`  [${result.analysis.score}] ${result.analysis.verdict}: ${result.title}`);
      }
    }
  }

  // Sort by score descending
  analyzed.sort((a, b) => b.analysis.score - a.analysis.score);

  console.log(`[Analyzer] ${analyzed.length} deals analyzed and scored`);
  return analyzed;
}

export async function generateSubjectLine(topDeal: AnalyzedDeal, totalDeals: number): Promise<string> {
  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 100,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `Generate a compelling email subject line for a daily deal digest email. The top deal is: "${topDeal.analysis.oneLiner}". There are ${totalDeals} total deals. Format: "DealFlow: [compelling hook about top deal] + ${totalDeals - 1} more". Keep it under 80 characters. Respond with ONLY the subject line, nothing else.`,
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (textBlock && textBlock.type === 'text') {
      return textBlock.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Fallback
  }

  return `DealFlow: ${topDeal.analysis.oneLiner} + ${totalDeals - 1} more`;
}
