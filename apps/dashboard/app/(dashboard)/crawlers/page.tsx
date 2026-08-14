'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

const API_URL = API_BASE_URL;

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

const ACTIVE_STATUSES: CrawlJob['status'][] = ['PENDING', 'RUNNING'];

export default function CrawlersPage() {
  const [crawlers, setCrawlers] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // Form options
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
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            WEBSITE CRAWLERS
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Scrape website domains and index pages into your Knowledge Base
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="modbit-btn-primary px-5 py-2.5 text-xs uppercase tracking-wider self-start sm:self-center"
        >
          {showForm ? '[ CLOSE FORM ]' : '[ + ADD CRAWLER ]'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="modbit-card p-6 border border-zinc-800 corner-border space-y-4"
        >
          <div>
            <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
              Target Website URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/docs"
              className="w-full px-3.5 py-2.5 modbit-input text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-200 underline block"
          >
            {showAdvanced ? 'Hide advanced configurations' : 'Show advanced configurations'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  Max pages
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full px-3 py-2 modbit-input text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  Max link depth
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(Number(e.target.value))}
                  className="w-full px-3 py-2 modbit-input text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  Include path patterns (comma-separated)
                </label>
                <input
                  type="text"
                  value={includePaths}
                  onChange={(e) => setIncludePaths(e.target.value)}
                  placeholder="/docs/**, /blog/*"
                  className="w-full px-3 py-2 modbit-input text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  Exclude path patterns (comma-separated)
                </label>
                <input
                  type="text"
                  value={excludePaths}
                  onChange={(e) => setExcludePaths(e.target.value)}
                  placeholder="/admin/**, /login"
                  className="w-full px-3 py-2 modbit-input text-xs"
                />
              </div>
            </div>
          )}

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {submitting ? '[ STARTING... ]' : '[ START CRAWL ]'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-xs text-red-400 p-3 border border-red-900/60 bg-red-950/30">{error}</p>
      )}

      {loading ? (
        <div className="p-8 text-center text-zinc-500 text-xs animate-pulse">
          LOADING CRAWLERS...
        </div>
      ) : crawlers.length === 0 ? (
        <div className="modbit-card p-8 border border-zinc-800 text-center text-zinc-500 text-xs corner-border">
          No website crawlers created yet. Click Add Crawler to start scraping.
        </div>
      ) : (
        <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-xs">
            <thead className="bg-zinc-950/90">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Target URL
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Status
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Pages
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Created At
                </th>
                <th className="px-6 py-3 text-right font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {crawlers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-100 break-all">
                    <Link href={`/crawlers/${c.id}`} className="hover:text-white underline">
                      {c.url}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                        c.status === 'COMPLETED'
                          ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                          : c.status === 'FAILED'
                            ? 'border-red-900/60 bg-red-950/40 text-red-400'
                            : 'border-yellow-800/80 bg-yellow-950/40 text-yellow-400'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    {c.pagesCrawled} / {c.pagesDiscovered || '?'}
                    {c.pagesFailed > 0 && (
                      <span className="text-red-400 ml-1.5">({c.pagesFailed} failed)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                    {c.status === 'FAILED' && (
                      <button
                        onClick={() => runAction(c.id, 'retry')}
                        disabled={busyIds.has(c.id)}
                        className="text-zinc-300 hover:text-white underline text-[11px] disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                    {ACTIVE_STATUSES.includes(c.status) && (
                      <button
                        onClick={() => runAction(c.id, 'cancel')}
                        disabled={busyIds.has(c.id)}
                        className="text-yellow-400 hover:text-yellow-300 underline text-[11px] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {!ACTIVE_STATUSES.includes(c.status) && (
                      <button
                        onClick={() => {
                          if (confirm('Delete this crawl job history?')) {
                            runAction(c.id, 'delete');
                          }
                        }}
                        disabled={busyIds.has(c.id)}
                        className="text-red-400 hover:text-red-300 underline text-[11px] disabled:opacity-50"
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
