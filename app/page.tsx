'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Play, Calendar, Settings, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface SourceHealth {
  name: string;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastError: string | null;
  dealsFound: number;
}

interface DigestSummary {
  date: string;
  generatedAt: string;
  totalScraped: number;
  totalAfterFilter: number;
  totalAnalyzed: number;
  deals: Array<{
    title: string;
    analysis: { score: number; verdict: string; oneLiner: string };
  }>;
  subject: string;
  sourceHealth: Record<string, SourceHealth>;
}

interface Filters {
  maxAskingPrice: number;
  maxDownPayment: number;
  minScore: number;
  dealTypes: string[];
  locationPreference: string;
  excludeKeywords: string[];
}

const DEAL_TYPE_OPTIONS = [
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'content', label: 'Content / Media' },
  { value: 'service', label: 'Service Business' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'local', label: 'Local Business' },
  { value: 'route', label: 'Route Business' },
  { value: 'real_asset', label: 'Real Assets' },
  { value: 'other', label: 'Other' },
];

export default function AdminPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [runResult, setRunResult] = useState<string>('');
  const [digestDates, setDigestDates] = useState<string[]>([]);
  const [expandedDigest, setExpandedDigest] = useState<string | null>(null);
  const [digestData, setDigestData] = useState<Record<string, DigestSummary>>({});
  const [filters, setFilters] = useState<Filters>({
    maxAskingPrice: 150000,
    maxDownPayment: 15000,
    minScore: 30,
    dealTypes: ['saas', 'ecommerce', 'content', 'service', 'franchise', 'local', 'route', 'real_asset', 'other'],
    locationPreference: 'Salt Lake City, Utah area for local deals, anywhere for online',
    excludeKeywords: ['mlm', 'dropshipping', 'crypto', 'gambling', 'cannabis'],
  });
  const [filtersSaved, setFiltersSaved] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/deals');
      if (res.ok) {
        const data = await res.json();
        setDigestDates(data.dates || []);
        if (data.filters) setFilters(data.filters);
      }
    } catch {
      // KV not configured yet
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const triggerRun = async () => {
    setStatus('running');
    setRunResult('');
    try {
      const res = await fetch('/api/trigger', { method: 'POST', headers: { 'Authorization': `Bearer ${prompt('Enter CRON_SECRET:')}` } });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setRunResult(`Found ${data.dealsInDigest} deals. Top: ${data.topDeal || 'N/A'} (${data.topScore || 0}). Email ${data.emailSent ? 'sent' : 'failed'}. Took ${data.duration}.`);
        loadData();
      } else {
        setStatus('error');
        setRunResult(data.error || 'Pipeline failed');
      }
    } catch (err) {
      setStatus('error');
      setRunResult(err instanceof Error ? err.message : 'Request failed');
    }
  };

  const loadDigest = async (date: string) => {
    if (expandedDigest === date) {
      setExpandedDigest(null);
      return;
    }
    if (digestData[date]) {
      setExpandedDigest(date);
      return;
    }
    try {
      const res = await fetch(`/api/deals?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setDigestData(prev => ({ ...prev, [date]: data }));
        setExpandedDigest(date);
      }
    } catch {
      // ignore
    }
  };

  const saveFilters = async () => {
    try {
      const res = await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (res.ok) {
        setFiltersSaved(true);
        setTimeout(() => setFiltersSaved(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const toggleDealType = (value: string) => {
    setFilters(f => ({
      ...f,
      dealTypes: f.dealTypes.includes(value)
        ? f.dealTypes.filter(t => t !== value)
        : [...f.dealTypes, value],
    }));
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa]">
      <div className="max-w-[720px] mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <h1 className="font-serif text-3xl font-bold tracking-tight">DEALFLOW</h1>
          <span className="text-sm text-[#71717a]">Control Panel</span>
        </div>

        {/* Status Bar */}
        <section className="mb-10 p-5 bg-[#111114] rounded-lg border border-[#27272a]">
          <div className="flex items-center gap-3 mb-3">
            <Activity className="w-4 h-4 text-[#d4a853]" />
            <h2 className="font-serif text-lg font-semibold">Status</h2>
          </div>
          <div className="text-sm text-[#a1a1aa]">
            {status === 'idle' && <span>Ready. {digestDates.length > 0 ? `Last digest: ${digestDates[0]}` : 'No digests yet.'}</span>}
            {status === 'running' && <span className="text-[#eab308]">Running pipeline...</span>}
            {status === 'success' && <span className="text-[#22c55e]">{runResult}</span>}
            {status === 'error' && <span className="text-[#ef4444]">{runResult}</span>}
          </div>
        </section>

        {/* Manual Trigger */}
        <section className="mb-10">
          <button
            onClick={triggerRun}
            disabled={status === 'running'}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-[#d4a853] text-[#09090b] font-semibold rounded-lg hover:bg-[#c49b4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {status === 'running' ? 'Running...' : 'Run Now'}
          </button>
        </section>

        {/* Past Digests */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-[#71717a]" />
            <h2 className="font-serif text-lg font-semibold">Past Digests</h2>
          </div>
          {digestDates.length === 0 ? (
            <p className="text-sm text-[#52525b]">No digests yet. Run the pipeline to generate your first one.</p>
          ) : (
            <div className="space-y-2">
              {digestDates.map(date => (
                <div key={date} className="border border-[#27272a] rounded-lg overflow-hidden">
                  <button
                    onClick={() => loadDigest(date)}
                    className="w-full flex items-center justify-between p-3 hover:bg-[#111114] transition-colors text-left"
                  >
                    <span className="text-sm font-medium">{date}</span>
                    <div className="flex items-center gap-2">
                      {digestData[date] && (
                        <span className="text-xs text-[#71717a]">{digestData[date].deals.length} deals</span>
                      )}
                      {expandedDigest === date ? (
                        <ChevronDown className="w-4 h-4 text-[#71717a]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#71717a]" />
                      )}
                    </div>
                  </button>
                  {expandedDigest === date && digestData[date] && (
                    <div className="px-3 pb-3 border-t border-[#27272a]">
                      <p className="text-xs text-[#71717a] mt-2 mb-2">
                        {digestData[date].totalScraped} scraped &bull; {digestData[date].totalAfterFilter} filtered &bull; {digestData[date].deals.length} sent
                      </p>
                      {digestData[date].deals.map((deal, i) => (
                        <div key={i} className="flex items-start gap-2 py-1.5 text-sm">
                          <span className={`inline-block min-w-[28px] text-center text-xs font-bold px-1 py-0.5 rounded ${
                            deal.analysis.score >= 70 ? 'bg-green-500/20 text-green-400'
                            : deal.analysis.score >= 40 ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                          }`}>{deal.analysis.score}</span>
                          <span className="text-[#d4d4d8] flex-1">{deal.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Filter Controls */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-4 h-4 text-[#71717a]" />
            <h2 className="font-serif text-lg font-semibold">Filters</h2>
          </div>
          <div className="space-y-5 p-5 bg-[#111114] rounded-lg border border-[#27272a]">
            {/* Price Filters */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-1">Max Asking Price</label>
                <input
                  type="number"
                  value={filters.maxAskingPrice}
                  onChange={e => setFilters(f => ({ ...f, maxAskingPrice: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm text-[#fafafa] focus:border-[#d4a853] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-1">Max Down Payment</label>
                <input
                  type="number"
                  value={filters.maxDownPayment}
                  onChange={e => setFilters(f => ({ ...f, maxDownPayment: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm text-[#fafafa] focus:border-[#d4a853] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-1">Min Score</label>
                <input
                  type="number"
                  value={filters.minScore}
                  min={1}
                  max={100}
                  onChange={e => setFilters(f => ({ ...f, minScore: parseInt(e.target.value) || 1 }))}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm text-[#fafafa] focus:border-[#d4a853] focus:outline-none"
                />
              </div>
            </div>

            {/* Deal Types */}
            <div>
              <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-2">Deal Types</label>
              <div className="flex flex-wrap gap-2">
                {DEAL_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleDealType(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      filters.dealTypes.includes(opt.value)
                        ? 'border-[#d4a853] text-[#d4a853] bg-[#d4a853]/10'
                        : 'border-[#27272a] text-[#52525b] hover:border-[#3f3f46]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-1">Location Preference</label>
              <input
                type="text"
                value={filters.locationPreference}
                onChange={e => setFilters(f => ({ ...f, locationPreference: e.target.value }))}
                className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm text-[#fafafa] focus:border-[#d4a853] focus:outline-none"
              />
            </div>

            {/* Exclude Keywords */}
            <div>
              <label className="block text-xs text-[#71717a] uppercase tracking-wider mb-1">Exclude Keywords (comma-separated)</label>
              <input
                type="text"
                value={filters.excludeKeywords.join(', ')}
                onChange={e => setFilters(f => ({ ...f, excludeKeywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                className="w-full bg-[#18181b] border border-[#27272a] rounded px-3 py-2 text-sm text-[#fafafa] focus:border-[#d4a853] focus:outline-none"
              />
            </div>

            {/* Save */}
            <button
              onClick={saveFilters}
              className="flex items-center gap-2 px-4 py-2 bg-[#27272a] text-[#fafafa] text-sm font-medium rounded hover:bg-[#3f3f46] transition-colors"
            >
              {filtersSaved ? <CheckCircle className="w-4 h-4 text-[#22c55e]" /> : <Settings className="w-4 h-4" />}
              {filtersSaved ? 'Saved' : 'Save Filters'}
            </button>
          </div>
        </section>

        {/* Source Health */}
        {digestDates.length > 0 && digestData[digestDates[0]] && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-4 h-4 text-[#71717a]" />
              <h2 className="font-serif text-lg font-semibold">Source Health</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(digestData[digestDates[0]].sourceHealth).map(source => (
                <div key={source.name} className="flex items-center justify-between p-2.5 bg-[#111114] rounded border border-[#27272a]">
                  <span className="text-xs text-[#a1a1aa]">{source.name}</span>
                  <div className="flex items-center gap-1.5">
                    {source.dealsFound > 0 ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-[#22c55e]" />
                        <span className="text-xs text-[#22c55e]">{source.dealsFound}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-[#ef4444]" />
                        <span className="text-xs text-[#ef4444]">failed</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-[#3f3f46] pt-8 border-t border-[#27272a]">
          DealFlow Engine &mdash; Automated deal sourcing powered by Claude AI
        </footer>
      </div>
    </div>
  );
}
