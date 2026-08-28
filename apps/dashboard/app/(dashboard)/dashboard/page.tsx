'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

interface SummaryData {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  };
  configuration: {
    institutionName?: string;
    supportEmail?: string;
    supportWebsite?: string;
    supportPhone?: string;
    introductoryMessage?: string;
    welcomeMessage?: string;
    llmProvider?: string;
    llmModel?: string;
    embeddingProvider?: string;
    embeddingModel?: string;
    temperature?: number;
    topK?: number;
    scoreThreshold?: number;
    systemPrompt?: string;
  };
  stats: {
    knowledge: {
      total: number;
      completed: number;
      processing: number;
      failed: number;
      byType: Record<string, number>;
      totalSizeBytes: number;
      maxStorageQuotaBytes: number;
    };
    crawlers: {
      total: number;
      active: number;
      completed: number;
      failed: number;
      totalPagesCrawled: number;
    };
    jobs: {
      total: number;
      running: number;
      completed: number;
      failed: number;
    };
    members: {
      total: number;
      byRole: Record<string, number>;
      pendingInvitations: number;
      currentUserRole: string;
    };
    widgets: {
      deploymentsCount: number;
      totalWidgets: number;
      activeWidgets: number;
      publicKeys: string[];
    };
  };
  recentSources: Array<{
    id: string;
    sourceType: string;
    status: string;
    createdAt: string;
    sizeBytes: number;
  }>;
  recentCrawlers: Array<{
    id: string;
    url: string;
    status: string;
    pagesCrawled: number;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    actorId?: string;
    metadata?: any;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const initialFetchDone = useRef(false);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const orgId = localStorage.getItem('organizationId');
      if (!orgId) {
        setError('No active institution workspace selected.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/summary`, {
        headers: { 'x-organization-id': orgId },
        credentials: 'include',
      });

      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
        setLastRefreshed(new Date());
        setError('');
      } else {
        setError(json.error?.message || 'Failed to retrieve institution summary data.');
      }
    } catch (err: any) {
      console.error('Error loading institution dashboard summary:', err);
      setError('Connection error: Unable to load dashboard summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSummary();
    }
  }, [fetchSummary]);

  const handleCopyId = () => {
    if (!summary?.organization.id) return;
    navigator.clipboard.writeText(summary.organization.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0.00 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto font-mono text-xs text-zinc-400 space-y-6 animate-pulse">
        <div className="h-10 bg-zinc-900/60 rounded border border-zinc-800 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-zinc-900/40 rounded border border-zinc-800" />
          <div className="h-28 bg-zinc-900/40 rounded border border-zinc-800" />
          <div className="h-28 bg-zinc-900/40 rounded border border-zinc-800" />
          <div className="h-28 bg-zinc-900/40 rounded border border-zinc-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-zinc-900/30 rounded border border-zinc-800" />
          <div className="h-64 bg-zinc-900/30 rounded border border-zinc-800" />
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-8 max-w-4xl mx-auto font-mono text-xs space-y-4">
        <div className="p-4 border border-red-900/60 bg-red-950/30 text-red-400">! {error}</div>
        <button
          onClick={() => fetchSummary(true)}
          className="px-4 py-2 modbit-btn-secondary text-xs uppercase"
        >
          [ RETRY DASHBOARD CONNECTION ]
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const { organization, configuration, stats, recentSources, recentCrawlers, recentActivity } =
    summary;

  const storageUsed = stats.knowledge.totalSizeBytes || 0;
  const storageMax = stats.knowledge.maxStorageQuotaBytes || 20 * 1024 * 1024;
  const storagePercentage = Math.min(100, Math.round((storageUsed / storageMax) * 100));

  const totalTypeCount = Object.values(stats.knowledge.byType).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-mono text-zinc-200">
      {/* ── HEADER BANNER & ACTION LAUNCHPAD ── */}
      <div className="border-b border-zinc-800 pb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                SYSTEM STATUS // OPERATIONAL
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-[11px] text-zinc-400 tracking-wider">
                ROLE:{' '}
                <span className="text-zinc-200 font-bold">{stats.members.currentUserRole}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.18em] text-zinc-100 uppercase">
              {configuration.institutionName || organization.name}
            </h1>

            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <span>WORKSPACE ID: {organization.id}</span>
              <button
                onClick={handleCopyId}
                className="text-[10px] text-zinc-400 hover:text-white border border-zinc-800 px-1.5 py-0.5 rounded bg-zinc-950/80 transition-colors uppercase"
                title="Copy Workspace ID"
              >
                {copiedId ? 'COPIED' : 'COPY'}
              </button>
              <span className="text-zinc-700">|</span>
              <span className="text-[11px] text-zinc-500">
                CREATED: {new Date(organization.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Quick Action Launchpad */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fetchSummary(true)}
              disabled={refreshing}
              className="px-3 py-2 modbit-btn-secondary text-[11px] font-mono tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh metrics"
            >
              <span className={refreshing ? 'animate-spin' : ''}>↻</span>
              <span>{refreshing ? 'SYNCING...' : 'SYNC STATS'}</span>
            </button>

            <Link
              href="/knowledge"
              className="px-3.5 py-2 modbit-btn-secondary text-[11px] font-mono tracking-wider hover:border-zinc-500"
            >
              [ + UPLOAD DOC ]
            </Link>

            <Link
              href="/crawlers"
              className="px-3.5 py-2 modbit-btn-secondary text-[11px] font-mono tracking-wider hover:border-zinc-500"
            >
              [ 🕷 START CRAWLER ]
            </Link>

            <Link
              href="/playground"
              className="px-4 py-2 modbit-btn-primary text-[11px] font-mono tracking-widest font-bold"
            >
              [ ✦ PLAYGROUND ]
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4 CORE SUMMARY METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Knowledge Base Volume */}
        <Link
          href="/knowledge"
          className="modbit-card p-5 border border-zinc-800 corner-border hover:border-zinc-600 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>KNOWLEDGE BASE</span>
              <span className="text-emerald-400 text-xs">● READY</span>
            </div>
            <div className="text-3xl font-bold text-zinc-100 tracking-wider group-hover:text-white">
              {stats.knowledge.total}
              <span className="text-xs text-zinc-500 font-normal ml-2 tracking-normal">
                SOURCES
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="text-emerald-400 font-bold">{stats.knowledge.completed} Ready</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">
                {stats.knowledge.processing} Processing
              </span>
              {stats.knowledge.failed > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-400 font-bold">{stats.knowledge.failed} Failed</span>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 mt-3 space-y-1.5">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>STORAGE QUOTA</span>
              <span>
                {formatBytes(storageUsed)} / {formatBytes(storageMax)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  storagePercentage > 85
                    ? 'bg-rose-500'
                    : storagePercentage > 60
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.max(2, storagePercentage)}%` }}
              />
            </div>
          </div>
        </Link>

        {/* Card 2: Web Scraping & Crawling */}
        <Link
          href="/crawlers"
          className="modbit-card p-5 border border-zinc-800 corner-border hover:border-zinc-600 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>WEB CRAWLERS</span>
              <span className="text-cyan-400 text-xs">
                {stats.crawlers.active > 0 ? '● CRAWLING' : '○ IDLE'}
              </span>
            </div>
            <div className="text-3xl font-bold text-zinc-100 tracking-wider group-hover:text-white">
              {stats.crawlers.totalPagesCrawled}
              <span className="text-xs text-zinc-500 font-normal ml-2 tracking-normal">
                PAGES INDEXED
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="text-zinc-300 font-bold">{stats.crawlers.total} Crawl Jobs</span>
              <span>•</span>
              <span className="text-cyan-400">{stats.crawlers.active} Active</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 mt-3 flex items-center justify-between text-[10px] text-zinc-500">
            <span>WEBSITE SOURCES</span>
            <span className="text-zinc-300 font-bold">
              {stats.knowledge.byType.WEBSITE || 0} URLS
            </span>
          </div>
        </Link>

        {/* Card 3: Ingestion Jobs */}
        <Link
          href="/jobs"
          className="modbit-card p-5 border border-zinc-800 corner-border hover:border-zinc-600 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>INGESTION PIPELINE</span>
              <span className="text-emerald-400 text-xs">● ONLINE</span>
            </div>
            <div className="text-3xl font-bold text-zinc-100 tracking-wider group-hover:text-white">
              {stats.jobs.total}
              <span className="text-xs text-zinc-500 font-normal ml-2 tracking-normal">
                TOTAL RUNS
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span className="text-emerald-400 font-bold">{stats.jobs.completed} Completed</span>
              <span>•</span>
              <span className="text-amber-400">{stats.jobs.running} Running</span>
              {stats.jobs.failed > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-400">{stats.jobs.failed} Failed</span>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 mt-3 flex items-center justify-between text-[10px] text-zinc-500">
            <span>PIPELINE HEALTH</span>
            <span className="text-emerald-400 font-bold">100% OPERATIONAL</span>
          </div>
        </Link>

        {/* Card 4: Team Members */}
        <Link
          href="/members"
          className="modbit-card p-5 border border-zinc-800 corner-border hover:border-zinc-600 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>WORKSPACE ACCESS</span>
              <span className="text-zinc-400 text-xs">👥 TEAM</span>
            </div>
            <div className="text-3xl font-bold text-zinc-100 tracking-wider group-hover:text-white">
              {stats.members.total}
              <span className="text-xs text-zinc-500 font-normal ml-2 tracking-normal">
                MEMBERS
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span>{stats.members.byRole.OWNER || 0} Owner</span>
              <span>•</span>
              <span>{stats.members.byRole.ADMIN || 0} Admin</span>
              <span>•</span>
              <span>{stats.members.byRole.EDITOR || 0} Editor</span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 mt-3 flex items-center justify-between text-[10px] text-zinc-500">
            <span>INVITATIONS PENDING</span>
            <span
              className={
                stats.members.pendingInvitations > 0 ? 'text-amber-400 font-bold' : 'text-zinc-400'
              }
            >
              {stats.members.pendingInvitations} Pending
            </span>
          </div>
        </Link>
      </div>

      {/* ── 2-COLUMN SECTION: INSTITUTION PROFILE & AI ENGINE STATUS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Institution Profile & Support Info */}
        <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest text-emerald-400">
              INSTITUTION IDENTITY & SUPPORT CONTACT
            </h2>
            <Link
              href="/institution-details"
              className="text-[11px] text-zinc-400 hover:text-white font-bold transition-colors uppercase"
            >
              [ ✎ EDIT PROFILE ]
            </Link>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
                Institution Name
              </span>
              <span className="font-bold text-zinc-200">
                {configuration.institutionName || organization.name}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
                Support Email
              </span>
              {configuration.supportEmail ? (
                <a
                  href={`mailto:${configuration.supportEmail}`}
                  className="text-cyan-400 hover:underline"
                >
                  {configuration.supportEmail}
                </a>
              ) : (
                <span className="text-zinc-600 italic">Not configured</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
                Support Website
              </span>
              {configuration.supportWebsite ? (
                <a
                  href={configuration.supportWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  {configuration.supportWebsite} ↗
                </a>
              ) : (
                <span className="text-zinc-600 italic">Not configured</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 bg-zinc-950/60 border border-zinc-800/60">
              <span className="text-zinc-500 text-[11px] uppercase tracking-wider">
                Support Phone
              </span>
              <span className="text-zinc-300">
                {configuration.supportPhone || (
                  <span className="text-zinc-600 italic">Not configured</span>
                )}
              </span>
            </div>
          </div>

          {/* Chatbot Welcome Greeting Preview */}
          <div className="p-3.5 border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>✦ CUSTOM CHATBOT GREETING</span>
              <span className="text-emerald-400 font-normal">LIVE PREVIEW</span>
            </div>
            <p className="text-xs text-zinc-300 italic bg-zinc-950/70 p-2.5 border border-zinc-800/80">
              &quot;
              {configuration.introductoryMessage ||
                configuration.welcomeMessage ||
                'Welcome! How can we help you today?'}
              &quot;
            </p>
          </div>
        </div>

        {/* Right Column: AI Inference Engine & Retrieval Parameters */}
        <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest text-emerald-400">
              AI INFERENCE & VECTOR SEARCH CONFIG
            </h2>
            <Link
              href="/settings"
              className="text-[11px] text-zinc-400 hover:text-white font-bold transition-colors uppercase"
            >
              [ ⚙ SETTINGS ]
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                LLM Provider
              </span>
              <div className="font-bold text-zinc-100 uppercase text-xs">
                {configuration.llmProvider || 'openai'}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Active Model
              </span>
              <div className="font-bold text-zinc-100 uppercase text-xs truncate">
                {configuration.llmModel || 'testing-model'}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Embedding Engine
              </span>
              <div className="font-bold text-zinc-100 uppercase text-xs">
                {configuration.embeddingProvider || 'openai'}
              </div>
            </div>

            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                Temperature / Top-K
              </span>
              <div className="font-bold text-zinc-100 text-xs">
                T: {configuration.temperature ?? 0.7} | K: {configuration.topK ?? 5}
              </div>
            </div>
          </div>

          {/* Widget Deployment Status */}
          <div className="p-3.5 border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              <span>WIDGET DEPLOYMENT STATUS</span>
              <Link href="/widgets" className="text-cyan-400 hover:underline">
                GET EMBED CODE →
              </Link>
            </div>
            <div className="flex items-center justify-between text-xs bg-zinc-950/70 p-2.5 border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${stats.widgets.activeWidgets > 0 ? 'bg-emerald-400' : 'bg-zinc-600'}`}
                />
                <span className="text-zinc-200">
                  {stats.widgets.totalWidgets > 0
                    ? `${stats.widgets.activeWidgets} active widget(s)`
                    : 'No active widget generated'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase font-mono">
                {stats.widgets.deploymentsCount} Deployment(s)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KNOWLEDGE ASSET DISTRIBUTION ── */}
      <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest text-emerald-400">
            KNOWLEDGE BASE FORMAT DISTRIBUTION
          </h2>
          <span className="text-xs text-zinc-500">TOTAL ASSETS: {stats.knowledge.total}</span>
        </div>

        {/* Visual Stacked Bar */}
        <div className="w-full h-3 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden flex">
          {stats.knowledge.byType.PDF > 0 && (
            <div
              className="bg-red-500 h-full transition-all"
              style={{
                width: `${(stats.knowledge.byType.PDF / totalTypeCount) * 100}%`,
              }}
              title={`PDF: ${stats.knowledge.byType.PDF}`}
            />
          )}
          {stats.knowledge.byType.DOCX > 0 && (
            <div
              className="bg-blue-500 h-full transition-all"
              style={{
                width: `${(stats.knowledge.byType.DOCX / totalTypeCount) * 100}%`,
              }}
              title={`DOCX: ${stats.knowledge.byType.DOCX}`}
            />
          )}
          {stats.knowledge.byType.TXT > 0 && (
            <div
              className="bg-amber-400 h-full transition-all"
              style={{
                width: `${(stats.knowledge.byType.TXT / totalTypeCount) * 100}%`,
              }}
              title={`TXT: ${stats.knowledge.byType.TXT}`}
            />
          )}
          {stats.knowledge.byType.MARKDOWN > 0 && (
            <div
              className="bg-purple-400 h-full transition-all"
              style={{
                width: `${(stats.knowledge.byType.MARKDOWN / totalTypeCount) * 100}%`,
              }}
              title={`Markdown: ${stats.knowledge.byType.MARKDOWN}`}
            />
          )}
          {stats.knowledge.byType.WEBSITE > 0 && (
            <div
              className="bg-cyan-400 h-full transition-all"
              style={{
                width: `${(stats.knowledge.byType.WEBSITE / totalTypeCount) * 100}%`,
              }}
              title={`Websites: ${stats.knowledge.byType.WEBSITE}`}
            />
          )}
        </div>

        {/* Legend Badges */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="text-zinc-400">PDF:</span>
            <span className="font-bold text-zinc-200">{stats.knowledge.byType.PDF || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="text-zinc-400">DOCX:</span>
            <span className="font-bold text-zinc-200">{stats.knowledge.byType.DOCX || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="text-zinc-400">TXT:</span>
            <span className="font-bold text-zinc-200">{stats.knowledge.byType.TXT || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
            <span className="text-zinc-400">MARKDOWN:</span>
            <span className="font-bold text-zinc-200">{stats.knowledge.byType.MARKDOWN || 0}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span className="text-zinc-400">WEBSITE URLS:</span>
            <span className="font-bold text-zinc-200">{stats.knowledge.byType.WEBSITE || 0}</span>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN SECTION: RECENT INGESTION & RECENT AUDIT TRAIL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Recent Knowledge & Crawler Sources */}
        <div className="modbit-card border border-zinc-800 corner-border overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
              <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest text-emerald-400">
                RECENT KNOWLEDGE ASSETS
              </h2>
              <Link
                href="/knowledge"
                className="text-[11px] text-zinc-400 hover:text-white transition-colors"
              >
                VIEW ALL →
              </Link>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {recentSources.length > 0 ? (
                recentSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-4 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800">
                          {source.sourceType}
                        </span>
                        <span className="text-zinc-400 text-xs truncate max-w-[180px]">
                          {source.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {formatBytes(source.sizeBytes)} • {formatDate(source.createdAt)}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider ${
                        source.status === 'COMPLETED'
                          ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-900/60'
                          : source.status === 'FAILED'
                            ? 'text-red-400 bg-red-950/30 border border-red-900/60'
                            : 'text-amber-400 bg-amber-950/30 border border-amber-900/60'
                      }`}
                    >
                      {source.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No knowledge documents uploaded yet.{' '}
                  <Link href="/knowledge" className="text-zinc-300 underline">
                    Upload your first document
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent Security & Audit Logs */}
        <div className="modbit-card border border-zinc-800 corner-border overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-6 py-3.5 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
              <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-widest text-emerald-400">
                RECENT WORKSPACE AUDIT TRAIL
              </h2>
              <Link
                href="/audit-logs"
                className="text-[11px] text-zinc-400 hover:text-white transition-colors"
              >
                VIEW ALL →
              </Link>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {recentActivity.length > 0 ? (
                recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 flex items-center justify-between gap-3 text-xs hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-zinc-200 tracking-wider truncate">
                        {log.action}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {log.actorId ? `By: ${log.actorId.slice(0, 8)}...` : 'System Event'} •{' '}
                        {formatDate(log.createdAt)}
                      </div>
                    </div>

                    <span className="text-[10px] text-zinc-500 font-mono">LOGGED</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No audit events recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER STATUS BAR ── */}
      <div className="p-4 border border-zinc-800/80 bg-zinc-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> API: FASTIFY ONLINE
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> DB: POSTGRESQL CONNECTED
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> REDIS QUEUE: ACTIVE
          </span>
        </div>

        <div>LAST SYNCED: {lastRefreshed.toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
