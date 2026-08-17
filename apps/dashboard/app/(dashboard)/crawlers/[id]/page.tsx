'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const API_URL = API_BASE_URL;

interface CrawledPage {
  id: string;
  url: string;
  depth: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  httpStatus: number | null;
  errorMessage: string | null;
  discoveredAt: string;
  completedAt: string | null;
}

interface CrawlJobDetail {
  id: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'RETRYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  maxPages: number;
  maxDepth: number;
  includePaths: string[];
  excludePaths: string[];
  respectRobotsTxt: boolean;
  sameOriginOnly: boolean;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  errorDetails: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  pages: CrawledPage[];
}

export default function CrawlerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [crawler, setCrawler] = useState<CrawlJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchOnce = useCallback(async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_URL}/api/v1/crawlers/${id}`, {
        credentials: 'include',
        headers: orgId ? { 'X-Organization-Id': orgId } : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json?.error?.message || 'Failed to load crawl job');
      setCrawler(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchOnce();

    const es = new EventSource(`${API_URL}/api/v1/crawlers/${id}/stream`, {
      withCredentials: true,
    } as any);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'update' && payload.crawler) {
          setCrawler(payload.crawler);
        }
        if (payload.type === 'done') {
          es.close();
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      es.close();
    };
  }, [id, fetchOnce]);

  const runAction = async (action: 'retry' | 'cancel' | 'delete') => {
    try {
      const orgId = localStorage.getItem('organizationId');
      const headers = orgId ? { 'X-Organization-Id': orgId } : undefined;
      const res =
        action === 'delete'
          ? await fetch(`${API_URL}/api/v1/crawlers/${id}`, {
              method: 'DELETE',
              credentials: 'include',
              headers,
            })
          : await fetch(`${API_URL}/api/v1/crawlers/${id}/${action}`, {
              method: 'POST',
              credentials: 'include',
              headers,
            });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json?.error?.message || `Failed to ${action} crawl`);
      if (action === 'delete') {
        router.push('/crawlers');
      } else {
        await fetchOnce();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading)
    return (
      <div className="p-8 max-w-4xl mx-auto text-xs text-zinc-500 font-mono animate-pulse">
        LOADING CRAWLER DETAILS...
      </div>
    );
  if (error && !crawler)
    return (
      <div className="p-8 max-w-4xl mx-auto text-xs text-red-400 font-mono border border-red-900/60 bg-red-950/30">
        {error}
      </div>
    );
  if (!crawler) return null;

  const isActive = crawler.status === 'PENDING' || crawler.status === 'RUNNING';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 font-mono text-zinc-200">
      <Link href="/crawlers" className="text-xs text-zinc-400 hover:text-white underline block">
        ← Back to Crawlers
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase break-all">
            {crawler.url}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Started: {crawler.startedAt ? new Date(crawler.startedAt).toLocaleString() : '—'}
            {crawler.finishedAt && ` · Finished: ${new Date(crawler.finishedAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {crawler.status === 'FAILED' && (
            <button
              onClick={() => runAction('retry')}
              className="px-4 py-1.5 modbit-btn-secondary text-xs uppercase tracking-wider"
            >
              [ RETRY ]
            </button>
          )}
          {isActive && (
            <button
              onClick={() => runAction('cancel')}
              className="px-4 py-1.5 text-xs font-mono text-yellow-400 hover:text-yellow-300 border border-yellow-800/80 bg-yellow-950/40 uppercase tracking-wider"
            >
              [ CANCEL ]
            </button>
          )}
          {!isActive && (
            <button
              onClick={() => {
                if (confirm('Delete this crawl job history?')) {
                  runAction('delete');
                }
              }}
              className="px-4 py-1.5 text-xs font-mono text-red-400 hover:text-red-300 border border-red-900/60 hover:bg-red-950/40 uppercase tracking-wider"
            >
              [ DELETE ]
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Status" value={crawler.status} />
        <Stat label="Discovered" value={String(crawler.pagesDiscovered)} />
        <Stat label="Ingested" value={String(crawler.pagesCrawled)} />
        <Stat
          label="Failed"
          value={String(crawler.pagesFailed)}
          highlight={crawler.pagesFailed > 0}
        />
      </div>

      {crawler.errorDetails && (
        <div className="p-3 bg-red-950/30 border border-red-900/60 text-xs text-red-400">
          {crawler.errorDetails}
        </div>
      )}

      <div className="text-xs text-zinc-500 space-x-4">
        <span>Max Pages: {crawler.maxPages}</span>
        <span>Max Depth: {crawler.maxDepth}</span>
        <span>Robots.txt: {crawler.respectRobotsTxt ? 'Respected' : 'Ignored'}</span>
      </div>

      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
          Crawled Pages ({crawler.pages.length})
        </h2>
        <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-xs">
            <thead className="bg-zinc-950/90">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Page URL
                </th>
                <th className="px-4 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Depth
                </th>
                <th className="px-4 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {crawler.pages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    {isActive
                      ? 'Waiting for initial page discovery...'
                      : 'No pages recorded for this crawl job.'}
                  </td>
                </tr>
              )}
              {crawler.pages.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-zinc-200 break-all">{p.url}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.depth}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                        p.status === 'COMPLETED'
                          ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                          : p.status === 'FAILED'
                            ? 'border-red-900/60 bg-red-950/40 text-red-400'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.httpStatus ? `HTTP ${p.httpStatus}` : ''}
                    {p.errorMessage && <span className="text-red-400"> — {p.errorMessage}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="modbit-card border border-zinc-800 p-4 corner-border">
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-red-400' : 'text-zinc-100'}`}>
        {value}
      </p>
    </div>
  );
}
