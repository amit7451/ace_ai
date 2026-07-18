'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CrawlJob {
  id: string;
  url: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  maxPages: number;
  maxDepth: number;
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  errorDetails: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const STATUS_STYLES: Record<CrawlJob['status'], string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-yellow-100 text-yellow-800',
};

const ACTIVE_STATUSES: CrawlJob['status'][] = ['PENDING', 'RUNNING'];

export default function CrawlersPage() {
  const [crawlers, setCrawlers] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Advanced options
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [maxDepth, setMaxDepth] = useState(3);
  const [includePaths, setIncludePaths] = useState('');
  const [excludePaths, setExcludePaths] = useState('');
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [sameOriginOnly, setSameOriginOnly] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchCrawlers = useCallback(async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_URL}/api/v1/crawlers`, {
        credentials: 'include',
        headers: orgId ? { 'X-Organization-Id': orgId } : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json?.error?.message || 'Failed to load crawlers');
      setCrawlers(json.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrawlers();
  }, [fetchCrawlers]);

  // Poll while anything is still in flight — a crawl can take minutes, and
  // this keeps the list's page counts moving without the user refreshing.
  useEffect(() => {
    const hasActive = crawlers.some((c) => ACTIVE_STATUSES.includes(c.status));
    if (!hasActive) return;
    const interval = setInterval(fetchCrawlers, 3000);
    return () => clearInterval(interval);
  }, [crawlers, fetchCrawlers]);

  const resetForm = () => {
    setUrl('');
    setMaxPages(50);
    setMaxDepth(3);
    setIncludePaths('');
    setExcludePaths('');
    setRespectRobotsTxt(true);
    setSameOriginOnly(true);
    setShowAdvanced(false);
    setFormError(null);
  };

  const parsePaths = (value: string) =>
    value
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_URL}/api/v1/crawlers`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(orgId ? { 'X-Organization-Id': orgId } : {}),
        },
        body: JSON.stringify({
          url,
          maxPages,
          maxDepth,
          includePaths: parsePaths(includePaths),
          excludePaths: parsePaths(excludePaths),
          respectRobotsTxt,
          sameOriginOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Failed to start crawl');
      }
      resetForm();
      setShowForm(false);
      await fetchCrawlers();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (id: string, action: 'retry' | 'cancel' | 'delete') => {
    setBusyIds((prev) => new Set(prev).add(id));
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
      await fetchCrawlers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Website Crawlers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Point at a page on your site and every page reachable from it (up to your limits) gets
            added to your knowledge base.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800"
        >
          {showForm ? 'Cancel' : '+ Add Crawler'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 border border-gray-200 rounded-lg p-5 bg-gray-50"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/docs"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll crawl this page and same-site links from it. Internal/private addresses are
              always rejected.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-sm text-gray-600 underline mb-3"
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max pages</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max link depth
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Only crawl paths matching (comma-separated, optional)
                </label>
                <input
                  type="text"
                  value={includePaths}
                  onChange={(e) => setIncludePaths(e.target.value)}
                  placeholder="/docs/**, /blog/*"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Never crawl paths matching (comma-separated, optional)
                </label>
                <input
                  type="text"
                  value={excludePaths}
                  onChange={(e) => setExcludePaths(e.target.value)}
                  placeholder="/admin/**, /login"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={respectRobotsTxt}
                  onChange={(e) => setRespectRobotsTxt(e.target.checked)}
                />
                Respect robots.txt
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sameOriginOnly}
                  onChange={(e) => setSameOriginOnly(e.target.checked)}
                />
                Stay on this site only
              </label>
            </div>
          )}

          {formError && <p className="text-sm text-red-600 mb-3">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? 'Starting...' : 'Start Crawl'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : crawlers.length === 0 ? (
        <p className="text-sm text-gray-500">
          No crawlers yet. Add one to start building your knowledge base.
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pages</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {crawlers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/crawlers/${c.id}`}
                      className="text-blue-600 hover:underline break-all"
                    >
                      {c.url}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${STATUS_STYLES[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.pagesCrawled} / {c.pagesDiscovered || '?'}
                    {c.pagesFailed > 0 && (
                      <span className="text-red-600 ml-1">({c.pagesFailed} failed)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {c.status === 'FAILED' && (
                      <button
                        onClick={() => runAction(c.id, 'retry')}
                        disabled={busyIds.has(c.id)}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                    {ACTIVE_STATUSES.includes(c.status) && (
                      <button
                        onClick={() => runAction(c.id, 'cancel')}
                        disabled={busyIds.has(c.id)}
                        className="text-xs text-yellow-700 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {!ACTIVE_STATUSES.includes(c.status) && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              'Delete this crawl history? Knowledge already added stays in your knowledge base.'
                            )
                          ) {
                            runAction(c.id, 'delete');
                          }
                        }}
                        disabled={busyIds.has(c.id)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
