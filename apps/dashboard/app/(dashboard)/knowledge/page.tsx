'use client';

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function KnowledgePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [crawlers, setCrawlers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeJobs, setActiveJobs] = useState<Record<string, any>>({});
  const [previewDoc, setPreviewDoc] = useState<{ id: string; name: string } | null>(null);

  const previousJobsRef = useRef<Record<string, any>>({});
  const initialFetchDone = useRef(false);

  const getOrgId = () => localStorage.getItem('organizationId') || '';

  const fetchSources = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge`, {
        headers: { 'x-organization-id': getOrgId() },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setSources(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCrawlers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/crawlers`, {
        headers: { 'x-organization-id': getOrgId() },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setCrawlers(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const documentSources = sources.filter((s) => s.sourceType !== 'WEBSITE');
  const totalUsedBytes = documentSources.reduce(
    (acc, item) => acc + (item.document?.sizeBytes || 0),
    0
  );

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const MAX_ORG_QUOTA = 20 * 1024 * 1024; // 20 MB

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // 1. Frontend validation: 5 MB limit per document
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 5 MB per document.`
      );
      e.target.value = '';
      return;
    }

    // 2. Frontend validation: 20 MB total organization storage quota
    if (totalUsedBytes + file.size > MAX_ORG_QUOTA) {
      alert(
        `Storage quota exceeded. Current: ${(totalUsedBytes / (1024 * 1024)).toFixed(2)} MB / Max 20.00 MB total.`
      );
      e.target.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/upload`, {
        method: 'POST',
        headers: {
          'x-organization-id': getOrgId(),
        },
        credentials: 'include',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        fetchSources();
      } else {
        alert('Upload failed: ' + (json.error?.message || 'Error processing file upload'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Upload failed: ' + (err.message || 'Error contacting server'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/${id}/retry`, {
        method: 'POST',
        headers: {
          'x-organization-id': getOrgId(),
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        alert('Retry initiated successfully.');
        fetchSources();
      } else {
        alert('Failed to retry: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger retry.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': getOrgId(),
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        fetchSources();
      } else {
        alert('Failed to delete: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger deletion.');
    }
  };

  const handleDeleteCrawler = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to completely delete this crawl job and all its extracted files?'
      )
    )
      return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/crawlers/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': getOrgId(),
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        fetchCrawlers();
      } else {
        alert('Failed to delete crawler: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger deletion.');
    }
  };

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSources();
      fetchCrawlers();
    }

    const orgId = getOrgId();
    if (!orgId) return;

    let eventSource: EventSource;
    let isFirstPush = true;

    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/jobs/stream?orgId=${orgId}`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'update' && Array.isArray(data.jobs)) {
            const newJobsMap: Record<string, any> = {};
            let needsRefetch = false;

            data.jobs.forEach((job: any) => {
              if (job.knowledgeSourceId) {
                newJobsMap[job.knowledgeSourceId] = job;
                const prevJob = previousJobsRef.current[job.knowledgeSourceId];
                if (!isFirstPush) {
                  if (
                    (!prevJob && (job.status === 'COMPLETED' || job.status === 'FAILED')) ||
                    (prevJob &&
                      prevJob.status !== job.status &&
                      (job.status === 'COMPLETED' || job.status === 'FAILED'))
                  ) {
                    needsRefetch = true;
                  }
                }
              }
            });

            isFirstPush = false;
            setActiveJobs(newJobsMap);
            previousJobsRef.current = newJobsMap;

            if (needsRefetch) {
              fetchSources();
            }
          }
        } catch (e) {
          console.error('Failed to parse SSE', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
      };
    } catch (err) {
      console.error('Failed to init EventSource', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const extractFilename = (storageKey?: string) => {
    if (!storageKey) return 'Document';
    const base = storageKey.includes('/') ? storageKey.split('/')[1] : storageKey;
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/;
    return base.replace(uuidRegex, '');
  };

  const storagePercentage = Math.min(100, Math.round((totalUsedBytes / MAX_ORG_QUOTA) * 100));

  const getFileUrl = (sourceId: string) => {
    return `${API_BASE_URL}/api/v1/knowledge/${sourceId}/file?orgId=${getOrgId()}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12 font-mono text-zinc-200">
      {/* Section 1: Documents */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
              DOCUMENT KNOWLEDGE BASE
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Upload PDF, TXT, DOCX, or MD files (Max 5 MB per file)
            </p>
          </div>

          <label className="modbit-btn-primary px-5 py-2.5 text-xs uppercase tracking-wider cursor-pointer inline-flex items-center gap-2 self-start sm:self-center">
            {uploading ? '[ UPLOADING... ]' : '[ UPLOAD DOCUMENT ]'}
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
              accept=".pdf,.txt,.md,.docx"
            />
          </label>
        </div>

        {/* Quota & Storage Bar */}
        <div className="modbit-card p-4 border border-zinc-800 corner-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-zinc-200 uppercase tracking-wider">
              STORAGE USAGE: {formatSize(totalUsedBytes)} / 20.00 MB TOTAL
            </span>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Maximum document file size limit: 5 MB per document
            </p>
          </div>

          <div className="w-full sm:w-48 bg-zinc-900 border border-zinc-800 h-2 overflow-hidden">
            <div
              className={`h-2 transition-all duration-300 ${
                storagePercentage >= 90
                  ? 'bg-red-500'
                  : storagePercentage >= 75
                    ? 'bg-yellow-400'
                    : 'bg-emerald-400'
              }`}
              style={{ width: `${storagePercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Table */}
        <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-xs">
            <thead className="bg-zinc-950/90">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Document Title
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Type
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Size
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Status
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {documentSources.map((s) => {
                const activeJob = activeJobs[s.id];
                const displayStatus = activeJob ? activeJob.status : s.status;
                const displayProgress = activeJob ? activeJob.progress : 0;
                const isRunning = displayStatus === 'RUNNING' || displayStatus === 'PENDING';
                const filename = extractFilename(s.document?.storageKey);

                return (
                  <tr key={s.id} className="hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-6 py-4 font-bold text-zinc-100">
                      <button
                        onClick={() => setPreviewDoc({ id: s.id, name: filename })}
                        className="text-left hover:text-white underline flex items-center gap-2 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span className="text-zinc-400 font-normal">👁</span>
                        <span>{filename}</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">{s.sourceType}</td>
                    <td className="px-6 py-4 text-zinc-400">{formatSize(s.document?.sizeBytes)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider w-fit ${
                            displayStatus === 'COMPLETED'
                              ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                              : displayStatus === 'FAILED'
                                ? 'border-red-900/60 bg-red-950/40 text-red-400'
                                : 'border-yellow-800/80 bg-yellow-950/40 text-yellow-400'
                          }`}
                        >
                          {displayStatus}
                        </span>
                        {isRunning && activeJob?.currentStage && (
                          <span className="text-[10px] text-zinc-500">
                            {activeJob.currentStage}
                          </span>
                        )}
                        {isRunning && displayProgress > 0 && (
                          <div className="w-24 bg-zinc-900 border border-zinc-800 h-1.5 overflow-hidden mt-1">
                            <div
                              className="bg-zinc-100 h-1.5 transition-all duration-300"
                              style={{ width: `${displayProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 space-x-3">
                      {displayStatus === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(s.id)}
                          className="text-zinc-300 hover:text-white underline text-[11px]"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-400 hover:text-red-300 underline text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {documentSources.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No document sources uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Website Crawlers */}
      <div className="space-y-6 pt-4 border-t border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
              WEBSITE CRAWLER SOURCES
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Active web scraping domains and extracted knowledge pages
            </p>
          </div>
        </div>

        <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-xs">
            <thead className="bg-zinc-950/90">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Seed URL
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Pages Crawled
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Status
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Started
                </th>
                <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
              {crawlers.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-200">
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white underline"
                    >
                      {c.url}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {c.pagesCrawled} completed
                    {c.pagesFailed > 0 && (
                      <span className="text-red-400 ml-2">({c.pagesFailed} failed)</span>
                    )}
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
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDeleteCrawler(c.id)}
                      className="text-red-400 hover:text-red-300 underline text-[11px]"
                      disabled={c.status === 'RUNNING'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {crawlers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                    No website crawlers created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF / Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c0c0f] border border-zinc-800 max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl corner-border animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-2 max-w-xl truncate">
                <span className="font-bold text-xs text-zinc-100 uppercase tracking-widest truncate">
                  DOCUMENT PREVIEW: {previewDoc.name}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={getFileUrl(previewDoc.id)}
                  target="_blank"
                  download={previewDoc.name}
                  className="px-3 py-1 modbit-btn-secondary text-[11px] uppercase tracking-wider"
                >
                  [ OPEN / DOWNLOAD ]
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 text-xs"
                >
                  [ ESC / CLOSE ]
                </button>
              </div>
            </div>

            {/* Embedded Iframe Preview */}
            <div className="flex-1 bg-zinc-900 relative">
              <iframe
                src={getFileUrl(previewDoc.id)}
                className="w-full h-full border-none"
                title={previewDoc.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
