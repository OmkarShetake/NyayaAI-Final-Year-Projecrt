import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, Scale, Sparkles } from 'lucide-react';
import { caseService } from '../services/caseService';
import { useAsync } from '../hooks/useAsync';
import { AsyncBoundary, ErrorState, Spinner } from '../components/common/Feedback';
import { Card, Disclaimer, PageHeader, RiskBadge } from '../components/common/UI';
import SimilarCaseList from '../components/similarCases/SimilarCaseList';
import { useAuth } from '../context/AuthContext';

export default function SimilarCases() {
  const { id } = useParams();
  const { canEdit } = useAuth();
  const [topK, setTopK] = useState(5);
  const [source, setSource] = useState('kanoon');
  const [customQuery, setCustomQuery] = useState('');
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const caseQ = useAsync(() => caseService.get(id), [id]);
  const stored = useAsync(() => caseService.getSimilar(id), [id]);

  const c = caseQ.data?.case;

  // Auto-fill suggested search query based on case sections and type
  useEffect(() => {
    if (c && !customQuery) {
      const parts = [];
      if (c.legalSections && c.legalSections.length > 0) {
        parts.push(c.legalSections.slice(0, 2).join(' '));
      }
      if (c.caseType) {
        parts.push(c.caseType);
      }
      setCustomQuery(parts.join(' '));
    }
  }, [c]);

  const search = async () => {
    setBusy(true);
    setSearchError(null);
    try {
      const res = await caseService.findSimilar(id, {
        topK: Number(topK),
        includeHistorical,
        source,
        query: customQuery.trim() || undefined,
      });
      stored.setData(res);
      toast.success(res._message || `Retrieved ${res.data?.similarCases?.length || 0} similar precedents`);
    } catch (err) {
      setSearchError(err);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AsyncBoundary loading={caseQ.loading} error={caseQ.error} onRetry={caseQ.refetch}>
      {c && (
        <>
          <Link to={`/cases/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> Case details
          </Link>
          <PageHeader
            eyebrow="Similar case retrieval"
            title={c.title}
            subtitle={`${c.caseNumber} · ${c.caseType} · ${c.court} · ${c.currentStage}`}
            actions={<RiskBadge level={c.riskLevel} size="lg" />}
          />

          {canEdit && (
            <div className="card mb-6 space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <Scale className="h-4 w-4 text-brass-600" />
                  Precedent Search Configuration
                </div>
                <div className="text-xs text-ink-500">
                  Connected to <span className="font-semibold text-emerald-600">Indian Kanoon API</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <label className="label" htmlFor="source">Source</label>
                  <select id="source" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="kanoon">Indian Kanoon API (Live Judgments)</option>
                    <option value="all">All Sources (Kanoon + Internal DB)</option>
                    <option value="database">Internal Database Only</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="topk">Results count</label>
                  <select id="topk" className="input" value={topK} onChange={(e) => setTopK(e.target.value)}>
                    {[3, 5, 8, 10, 15].map((n) => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className="label" htmlFor="query">
                    Search keywords / legal sections
                    <span className="ml-1 text-xs font-normal text-ink-500">(sent to Indian Kanoon)</span>
                  </label>
                  <input
                    id="query"
                    type="text"
                    className="input"
                    placeholder="e.g. Section 138 NI Act Cheque Bounce"
                    value={customQuery}
                    onChange={(e) => setCustomQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brass-500 rounded"
                    checked={includeHistorical}
                    onChange={(e) => setIncludeHistorical(e.target.checked)}
                  />
                  Include synthetic historical sample corpus (if supplementing results)
                </label>

                <button type="button" className="btn-primary" onClick={search} disabled={busy}>
                  {busy ? <Spinner className="h-4 w-4 text-white" /> : <Search className="h-4 w-4" />}
                  {source === 'kanoon' ? 'Fetch from Indian Kanoon' : 'Find similar cases'}
                </button>
              </div>
            </div>
          )}

          {searchError && <div className="mb-6"><ErrorState error={searchError} onRetry={search} /></div>}

          <Card
            title="Most similar cases & judicial precedents"
            subtitle="Ranked by Indian Kanoon relevance, matching legal sections, court jurisdiction, and case type"
            bodyClassName="p-0"
          >
            <AsyncBoundary loading={stored.loading} error={stored.error} onRetry={stored.refetch}>
              <SimilarCaseList items={stored.data?.similarCases || []} />
            </AsyncBoundary>
          </Card>

          <div className="mt-6">
            <Disclaimer tone="info">
              Precedents are retrieved in real time from Indian Kanoon based on matching statutes, legal fragments, and proceedings attributes. Click &quot;Read full judgment on Indian Kanoon&quot; to review the complete decision text.
            </Disclaimer>
          </div>
        </>
      )}
    </AsyncBoundary>
  );
}
