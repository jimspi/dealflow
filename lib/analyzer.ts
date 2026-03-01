import OpenAI from 'openai';
import { RawDeal, AnalyzedDeal, DealAnalysis } from './types';
import { hashDeal } from './dedup';

function getClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are a business acquisition analyst helping a buyer with $10,000 cash who is open to financing (seller financing, SBA loans, earnouts, revenue splits).

SCORING GUIDE:
- 80-100: Cash flowing, affordable entry, seller financing offered, strong upside
- 60-79: Good fundamentals but needs negotiation on price or terms
- 40-59: Interesting but significant unknowns or risks
- 20-39: Overpriced, unverifiable claims, or poor fit
- 1-19: Hard pass — doesn't meet criteria

You must respond ONLY in valid JSON, no markdown, no code fences, no explanation.`;

const ANALYSIS_PROMPT = `Analyze this business listing and provide a structured assessment.

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

Respond ONLY in this exact JSON format:
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
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.score !== 'number' ||
      !parsed.verdict ||
      !parsed.oneLiner
    ) {
      return null;
    }

    parsed.score = Math.max(1, Math.min(100, Math.round(parsed.score)));

    const validVerdicts = ['STRONG BUY', 'WORTH EXPLORING', 'MAYBE', 'PASS'];
    if (!validVerdicts.includes(parsed.verdict)) {
      parsed.verdict = parsed.score >= 70 ? 'WORTH EXPLORING' : parsed.score >= 40 ? 'MAYBE' : 'PASS';
    }

    const validCategories = ['saas', 'ecommerce', 'content', 'service', 'franchise', 'local', 'route', 'real_asset', 'other'];
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'other';
    }

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

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return null;

    const analysis = parseAnalysis(text);
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
  const toAnalyze = deals.slice(0, maxDeals);
  const analyzed: AnalyzedDeal[] = [];

  console.log(`[Analyzer] Analyzing ${toAnalyze.length} deals with GPT-4o...`);

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

  analyzed.sort((a, b) => b.analysis.score - a.analysis.score);

  console.log(`[Analyzer] ${analyzed.length} deals analyzed and scored`);
  return analyzed;
}

export async function generateSubjectLine(topDeal: AnalyzedDeal, totalDeals: number): Promise<string> {
  try {
    const response = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Generate a compelling email subject line for a daily deal digest email. The top deal is: "${topDeal.analysis.oneLiner}". There are ${totalDeals} total deals. Format: "DealFlow: [compelling hook about top deal] + ${totalDeals - 1} more". Keep it under 80 characters. Respond with ONLY the subject line, nothing else.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (text) {
      return text.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // Fallback
  }

  return `DealFlow: ${topDeal.analysis.oneLiner} + ${totalDeals - 1} more`;
}
