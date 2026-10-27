import { Link } from 'react-router-dom';
import { Database, FlaskConical, Scale, ExternalLink } from 'lucide-react';
import { RiskBadge, Tag } from '../common/UI';
import { EmptyState } from '../common/Feedback';
import { formatDays } from '../../utils/format';

function ScoreBar({ score }) {
  return (
    <div className="flex items-center gap-2" title={`Similarity match score ${(score * 100).toFixed(1)}%`}>
      <div className="h-1.5 w-20 rounded-full bg-ink-100">
        <div className="h-1.5 rounded-full bg-brass-500" style={{ width: `${Math.round(score * 100)}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-ink-700">{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function SimilarCaseList({ items = [], compact = false }) {
  if (!items.length) {
    return <EmptyState title="No similar cases yet" message="Run a prediction or similarity search to retrieve comparable cases." />;
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((s) => {
        const fromKanoon = s.source === 'kanoon';
        const fromDb = (s.source === 'database' || fromKanoon) && s.similarCaseId;
        const Title = fromDb ? Link : 'span';
        return (
          <li key={s._id || s.referenceId} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Title
                    {...(fromDb ? { to: `/cases/${s.similarCaseId}` } : {})}
                    className={`truncate text-sm font-medium ${fromDb ? 'text-ink-900 hover:text-brass-600' : 'text-ink-900'}`}
                  >
                    {s.title || s.caseNumber}
                  </Title>
                  {fromKanoon ? (
                    <Tag tone="emerald"><Scale className="mr-1 h-3 w-3" /> Indian Kanoon API</Tag>
                  ) : s.source === 'database' ? (
                    <Tag><Database className="mr-1 h-3 w-3" /> database</Tag>
                  ) : (
                    <Tag tone="brass"><FlaskConical className="mr-1 h-3 w-3" /> synthetic historical sample</Tag>
                  )}
                  {s.citation && (
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-mono text-ink-700">
                      Citation: {s.citation}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {s.caseNumber} · {s.caseType} · {s.court || '—'} · {s.currentStage || '—'}{s.status ? ` · ${s.status}` : ''}
                </p>
                {!compact && s.explanation && (
                  <p className="mt-1.5 text-xs text-ink-600 font-medium">Match: {s.explanation}</p>
                )}
                {!compact && s.headline && (
                  <p className="mt-1 rounded bg-amber-50/70 border border-amber-200/60 p-2 text-xs italic text-ink-700">
                    "{s.headline}"
                  </p>
                )}
                {!compact && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {s.docUrl && (
                      <a
                        href={s.docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-brass-600 hover:text-brass-700 hover:underline"
                      >
                        Read full judgment on Indian Kanoon <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {s.delayDays != null && (
                      <span className="text-xs text-ink-500">
                        {fromKanoon ? 'Historical timeline' : fromDb ? 'Model-estimated' : 'Recorded'} delay: {formatDays(Math.round(s.delayDays))}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <ScoreBar score={s.similarityScore} />
                <RiskBadge level={s.riskLevel} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
