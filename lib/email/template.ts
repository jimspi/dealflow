import { AnalyzedDeal, Digest } from '../types';

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'; // green
  if (score >= 40) return '#eab308'; // amber
  return '#ef4444'; // red
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case 'STRONG BUY': return '#22c55e';
    case 'WORTH EXPLORING': return '#3b82f6';
    case 'MAYBE': return '#eab308';
    case 'PASS': return '#71717a';
    default: return '#71717a';
  }
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return 'N/A';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount.toLocaleString()}`;
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    bizbuysell: 'BizBuySell',
    flippa: 'Flippa',
    acquire: 'Acquire.com',
    bizquest: 'BizQuest',
    empireflippers: 'Empire Flippers',
    exchangemarketplace: 'Exchange',
    franchisegator: 'FranchiseGator',
    loopnet: 'LoopNet',
    craigslist: 'Craigslist',
    google: 'Web Search',
  };
  return labels[source] || source;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTopDeal(deal: AnalyzedDeal): string {
  const { analysis } = deal;

  const risksHtml = analysis.risks
    .map(r => `<tr><td style="padding: 2px 0; color: #a1a1aa; font-family: system-ui, -apple-system, sans-serif; font-size: 13px;">&#8226; ${escapeHtml(r)}</td></tr>`)
    .join('');

  const upsideHtml = analysis.upside
    .map(u => `<tr><td style="padding: 2px 0; color: #a1a1aa; font-family: system-ui, -apple-system, sans-serif; font-size: 13px;">&#8226; ${escapeHtml(u)}</td></tr>`)
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
      <tr>
        <td style="padding: 24px; background-color: #111114; border-left: 4px solid #d4a853; border-radius: 8px;">
          <!-- Score + Verdict Badge -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
            <tr>
              <td>
                <span style="display: inline-block; background-color: ${scoreColor(analysis.score)}; color: #000; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 4px;">${analysis.score}</span>
                <span style="display: inline-block; color: ${verdictColor(analysis.verdict)}; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 8px; margin-left: 8px;">${analysis.verdict}</span>
              </td>
              <td align="right" style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 12px;">
                ${sourceLabel(deal.source)}
              </td>
            </tr>
          </table>

          <!-- Title -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
            <tr>
              <td style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #fafafa; line-height: 1.3;">
                ${escapeHtml(deal.title)}
              </td>
            </tr>
          </table>

          <!-- Key Metrics -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #27272a;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Asking Price</td>
                    <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Revenue</td>
                    <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Cash Flow</td>
                    <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Est. Monthly</td>
                  </tr>
                  <tr>
                    <td style="color: #fafafa; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; padding-top: 4px;">${formatCurrency(deal.askingPrice)}</td>
                    <td style="color: #fafafa; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; padding-top: 4px;">${formatCurrency(deal.revenue)}</td>
                    <td style="color: #fafafa; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; padding-top: 4px;">${formatCurrency(deal.cashFlow)}</td>
                    <td style="color: #22c55e; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 600; padding-top: 4px;">${formatCurrency(analysis.monthlyProfit)}/mo</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Location & Financing -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
            <tr>
              <td style="color: #a1a1aa; font-family: system-ui, -apple-system, sans-serif; font-size: 13px;">
                ${escapeHtml(deal.location)}${deal.financingAvailable ? ' &nbsp;&#8226;&nbsp; <span style="color: #22c55e;">Seller Financing: Yes</span>' : ''}
              </td>
            </tr>
          </table>

          <!-- One Liner -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
            <tr>
              <td style="padding: 12px 16px; background-color: #18181b; border-radius: 6px; border-left: 3px solid #d4a853;">
                <span style="color: #e4e4e7; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-style: italic; line-height: 1.5;">
                  &ldquo;${escapeHtml(analysis.oneLiner)}&rdquo;
                </span>
              </td>
            </tr>
          </table>

          <!-- Deal Structure -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr>
              <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">Deal Structure</td>
            </tr>
            <tr>
              <td style="color: #d4d4d8; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5;">
                ${escapeHtml(analysis.dealStructure)}
              </td>
            </tr>
          </table>

          <!-- AI Angle -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr>
              <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">AI Angle</td>
            </tr>
            <tr>
              <td style="color: #d4d4d8; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5;">
                ${escapeHtml(analysis.aiAngle)}
              </td>
            </tr>
          </table>

          <!-- Next Step -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr>
              <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">Next Step</td>
            </tr>
            <tr>
              <td style="color: #d4d4d8; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.5;">
                ${escapeHtml(analysis.nextStep)}
              </td>
            </tr>
          </table>

          <!-- Risks -->
          ${risksHtml ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 14px;">
            <tr>
              <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">Risks</td>
            </tr>
            ${risksHtml}
          </table>` : ''}

          <!-- Upside -->
          ${upsideHtml ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
            <tr>
              <td style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 4px;">Upside</td>
            </tr>
            ${upsideHtml}
          </table>` : ''}

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: #d4a853; border-radius: 6px;">
                <a href="${escapeHtml(deal.sourceUrl)}" target="_blank" style="display: inline-block; padding: 10px 24px; color: #09090b; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none;">View Listing &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function renderSecondaryDeal(deal: AnalyzedDeal, index: number): string {
  const { analysis } = deal;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td style="padding: 16px 20px; background-color: #111114; border-left: 3px solid #3f3f46; border-radius: 6px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <span style="color: #71717a; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;">${index}.</span>
                <span style="color: #fafafa; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 600; margin-left: 4px;">${escapeHtml(deal.title)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 6px;">
                <span style="display: inline-block; background-color: ${scoreColor(analysis.score)}; color: #000; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 3px;">${analysis.score}</span>
                <span style="color: ${verdictColor(analysis.verdict)}; font-family: system-ui, -apple-system, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-left: 6px;">${analysis.verdict}</span>
                <span style="color: #52525b; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; margin-left: 8px;">
                  ${formatCurrency(deal.askingPrice)} ask
                  ${deal.cashFlow ? ` &#8226; ${formatCurrency(deal.cashFlow)} CF` : ''}
                  &#8226; ${sourceLabel(deal.source)}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 8px; color: #a1a1aa; font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-style: italic; line-height: 1.4;">
                &ldquo;${escapeHtml(analysis.oneLiner)}&rdquo;
              </td>
            </tr>
            <tr>
              <td style="padding-top: 10px;">
                <a href="${escapeHtml(deal.sourceUrl)}" target="_blank" style="color: #d4a853; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 500; text-decoration: none;">View &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildEmailHtml(digest: Digest): string {
  const topDeal = digest.deals[0];
  const remainingDeals = digest.deals.slice(1);

  const topDealHtml = topDeal ? renderTopDeal(topDeal) : '';
  const remainingHtml = remainingDeals
    .map((deal, i) => renderSecondaryDeal(deal, i + 2))
    .join('');

  const sourceSummary = Object.values(digest.sourceHealth)
    .map(s => `${s.name}: ${s.dealsFound > 0 ? `${s.dealsFound} found` : '<span style="color: #ef4444;">failed</span>'}`)
    .join(' &nbsp;&#8226;&nbsp; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>DealFlow Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #09090b;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #27272a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 700; color: #fafafa; letter-spacing: -0.5px;">DEALFLOW</span>
                  </td>
                  <td align="right">
                    <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #71717a;">${formatDate(digest.date)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 24px 0;">
              <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #71717a;">
                ${digest.totalScraped} listings scanned &nbsp;&#8226;&nbsp; ${digest.totalAfterFilter} passed filters &nbsp;&#8226;&nbsp; ${digest.deals.length} analyzed &amp; scored
              </span>
            </td>
          </tr>

          <!-- Top Deal Header -->
          ${topDeal ? `
          <tr>
            <td style="padding-bottom: 16px;">
              <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #d4a853; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">TOP DEAL</span>
            </td>
          </tr>

          <!-- Top Deal Card -->
          <tr>
            <td>${topDealHtml}</td>
          </tr>` : ''}

          ${remainingDeals.length > 0 ? `
          <!-- More Deals Header -->
          <tr>
            <td style="padding: 16px 0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-bottom: 1px solid #27272a; padding-bottom: 8px;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 13px; color: #71717a; text-transform: uppercase; letter-spacing: 2px;">MORE DEALS</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Remaining Deals -->
          <tr>
            <td>${remainingHtml}</td>
          </tr>` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #27272a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color: #52525b; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; line-height: 1.6;">
                    <strong style="color: #71717a;">Source Health:</strong><br>
                    ${sourceSummary}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px; color: #3f3f46; font-family: system-ui, -apple-system, sans-serif; font-size: 11px;">
                    DealFlow Engine &mdash; Automated deal sourcing powered by Claude AI<br>
                    Deals are not vetted or verified. Always perform your own due diligence.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmptyEmailHtml(date: string, sourceHealth: Record<string, { name: string; dealsFound: number }>): string {
  const sourceSummary = Object.values(sourceHealth)
    .map(s => `${s.name}: ${s.dealsFound > 0 ? `${s.dealsFound} scanned` : 'no results'}`)
    .join(' &nbsp;&#8226;&nbsp; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DealFlow - No New Deals</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #09090b;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; width: 100%;">
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #27272a;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 700; color: #fafafa; letter-spacing: -0.5px;">DEALFLOW</span>
                  </td>
                  <td align="right">
                    <span style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #71717a;">${formatDate(date)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 48px 0; text-align: center;">
              <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; color: #a1a1aa; margin: 0 0 16px;">No new deals today</p>
              <p style="font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #52525b; margin: 0;">All sources were scanned, but nothing matched your criteria. Check back tomorrow.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid #27272a; color: #52525b; font-family: system-ui, -apple-system, sans-serif; font-size: 11px;">
              <strong style="color: #71717a;">Sources scanned:</strong><br>${sourceSummary}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
