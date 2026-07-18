'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
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

const PAGE_STATUS_STYLES: Record<CrawledPage['status'], string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-yellow-100 text-yellow-800',
};

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

    // Live progress via SSE while the job can still change; the endpoint
    // itself closes the stream once status settles, so there's nothing to
    // tear down beyond the EventSource on unmount.
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
        // ignore malformed keep-alive/comment frames
      }
    };
    es.onerror = () => {
      // Browsers auto-reconnect EventSource on transient errors; if the
      // job has already finished the endpoint will have closed cleanly, so
      // this mainly guards against a genuinely dropped connection.
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

  if (loading) return <div className="p-8 max-w-4xl mx-auto text-sm text-gray-500">Loading...</div>;
  if (error && !crawler)
    return <div className="p-8 max-w-4xl mx-auto text-sm text-red-600">{error}</div>;
  if (!crawler) return null;

  const isActive = crawler.status === 'PENDING' || crawler.status === 'RUNNING';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/crawlers" className="text-sm text-gray-500 hover:underline">
        ← Back to crawlers
      </Link>

      <div className="flex items-start justify-between mt-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 break-all">{crawler.url}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Started {crawler.startedAt ? new Date(crawler.startedAt).toLocaleString() : '—'}
            {crawler.finishedAt && ` · Finished ${new Date(crawler.finishedAt).toLocaleString()}`}
          </p>
        </div>
        <div className="space-x-2">
          {crawler.status === 'FAILED' && (
            <button
              onClick={() => runAction('retry')}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Retry
            </button>
          )}
          {isActive && (
            <button
              onClick={() => runAction('cancel')}
              className="px-3 py-1.5 text-sm border border-yellow-300 text-yellow-700 rounded-md hover:bg-yellow-50"
            >
              Cancel
            </button>
          )}
          {!isActive && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Delete this crawl history? Knowledge already added stays in your knowledge base.'
                  )
                ) {
                  runAction('delete');
                }
              }}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
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
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {crawler.errorDetails}
        </div>
      )}

      <div className="mb-4 text-xs text-gray-500 space-x-3">
        <span>Max pages: {crawler.maxPages}</span>
        <span>Max depth: {crawler.maxDepth}</span>
        <span>Robots.txt: {crawler.respectRobotsTxt ? 'respected' : 'ignored'}</span>
        <span>Scope: {crawler.sameOriginOnly ? 'same site only' : 'follows external links'}</span>
      </div>

      <h2 className="text-sm font-medium text-gray-900 mb-2">Pages ({crawler.pages.length})</h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">URL</th>
              <th className="px-4 py-2 font-medium">Depth</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {crawler.pages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  {isActive
                    ? 'Waiting for the first page...'
                    : 'No pages were recorded for this crawl.'}
                </td>
              </tr>
            )}
            {crawler.pages.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 break-all">{p.url}</td>
                <td className="px-4 py-2 text-gray-500">{p.depth}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${PAGE_STATUS_STYLES[p.status]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {p.httpStatus ? `HTTP ${p.httpStatus}` : ''}
                  {p.errorMessage && <span className="text-red-600"> — {p.errorMessage}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}
