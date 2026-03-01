import { NextResponse } from 'next/server';
import { scrapeAll } from '@/lib/scrapers';
import { applyFilters, ensureDiversity } from '@/lib/filters';
import { deduplicateDeals, markDealsAsSeen, storeDigest, getStoredFilters } from '@/lib/dedup';
import { analyzeDeals, generateSubjectLine } from '@/lib/analyzer';
import { buildEmailHtml, buildEmptyEmailHtml } from '@/lib/email/template';
import { sendDigestEmail } from '@/lib/email/send';
import { Digest, BuyerFilters, DEFAULT_BUYER_FILTERS } from '@/lib/types';

export const maxDuration = 300; // 5 minutes for Vercel Pro
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify cron authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runPipeline();
}

export async function runPipeline() {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[DealFlow] Starting daily digest pipeline — ${today}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Step 1: Load buyer filters (from KV or defaults)
    let filters: BuyerFilters = DEFAULT_BUYER_FILTERS;
    try {
      const stored = await getStoredFilters();
      if (stored) {
        filters = { ...DEFAULT_BUYER_FILTERS, ...(typeof stored === 'string' ? JSON.parse(stored) : stored) };
      }
    } catch {
      console.log('[Filters] Using default filters');
    }

    // Step 2: Scrape all sources
    console.log('\n[Step 1] Scraping all sources...');
    const { deals: rawDeals, sourceHealth } = await scrapeAll();
    console.log(`[Step 1] Total raw deals: ${rawDeals.length}`);

    // Step 3: Deduplicate
    console.log('\n[Step 2] Deduplicating...');
    const uniqueDeals = await deduplicateDeals(rawDeals);
    console.log(`[Step 2] Unique deals: ${uniqueDeals.length} (${rawDeals.length - uniqueDeals.length} dupes removed)`);

    // Step 4: Apply filters
    console.log('\n[Step 3] Applying buyer criteria filters...');
    const filteredDeals = applyFilters(uniqueDeals, filters);
    console.log(`[Step 3] Deals after filtering: ${filteredDeals.length}`);

    // Handle zero deals
    if (filteredDeals.length === 0) {
      console.log('\n[Pipeline] No deals found matching criteria. Sending empty digest.');

      const emptyHtml = buildEmptyEmailHtml(today, sourceHealth);
      const emailResult = await sendDigestEmail(
        'DealFlow: No new deals today — all sources scanned',
        emptyHtml
      );

      const duration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        date: today,
        totalScraped: rawDeals.length,
        totalFiltered: 0,
        dealsInDigest: 0,
        emailSent: emailResult.success,
        emailId: emailResult.id,
        duration: `${(duration / 1000).toFixed(1)}s`,
      });
    }

    // Step 5: AI Analysis
    console.log('\n[Step 4] Running AI analysis...');
    const analyzedDeals = await analyzeDeals(filteredDeals, 10);
    console.log(`[Step 4] Analyzed: ${analyzedDeals.length} deals`);

    // Step 6: Filter by minimum score
    const scoredDeals = analyzedDeals.filter(d => d.analysis.score >= filters.minScore);
    console.log(`[Step 5] Deals above min score (${filters.minScore}): ${scoredDeals.length}`);

    if (scoredDeals.length === 0) {
      console.log('\n[Pipeline] No deals scored above minimum. Sending empty digest.');
      const emptyHtml = buildEmptyEmailHtml(today, sourceHealth);
      const emailResult = await sendDigestEmail(
        'DealFlow: No standout deals today — check back tomorrow',
        emptyHtml
      );

      return NextResponse.json({
        success: true,
        date: today,
        totalScraped: rawDeals.length,
        totalFiltered: filteredDeals.length,
        dealsInDigest: 0,
        emailSent: emailResult.success,
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      });
    }

    // Step 7: Ensure diversity
    const diverseDeals = ensureDiversity(scoredDeals);
    console.log(`[Step 6] Diverse selection: ${diverseDeals.length} deals`);

    // Step 8: Generate subject line
    console.log('\n[Step 7] Generating email subject...');
    const subject = await generateSubjectLine(diverseDeals[0], diverseDeals.length);
    console.log(`[Step 7] Subject: ${subject}`);

    // Step 9: Build email
    console.log('\n[Step 8] Building email template...');
    const digest: Digest = {
      date: today,
      generatedAt: new Date().toISOString(),
      totalScraped: rawDeals.length,
      totalAfterFilter: filteredDeals.length,
      totalAnalyzed: analyzedDeals.length,
      deals: diverseDeals,
      subject,
      sourceHealth,
    };

    const emailHtml = buildEmailHtml(digest);

    // Step 10: Send email
    console.log('\n[Step 9] Sending email...');
    const emailResult = await sendDigestEmail(subject, emailHtml);

    // Step 11: Store digest and mark deals as seen
    console.log('\n[Step 10] Storing digest and marking deals...');
    await Promise.all([
      storeDigest(today, digest),
      markDealsAsSeen(diverseDeals),
    ]);

    const duration = Date.now() - startTime;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[DealFlow] Pipeline complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`[DealFlow] ${diverseDeals.length} deals sent to inbox`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      date: today,
      totalScraped: rawDeals.length,
      totalUnique: uniqueDeals.length,
      totalFiltered: filteredDeals.length,
      totalAnalyzed: analyzedDeals.length,
      dealsInDigest: diverseDeals.length,
      topScore: diverseDeals[0]?.analysis.score,
      topDeal: diverseDeals[0]?.title,
      emailSent: emailResult.success,
      emailId: emailResult.id,
      subject,
      duration: `${(duration / 1000).toFixed(1)}s`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DealFlow] Pipeline failed: ${msg}`);

    return NextResponse.json(
      {
        success: false,
        error: msg,
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      },
      { status: 500 }
    );
  }
}
