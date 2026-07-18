'use client';

import { useState, useEffect, useRef } from 'react';

export default function KnowledgePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [crawlers, setCrawlers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeJobs, setActiveJobs] = useState<Record<string, any>>({});
  const previousJobsRef = useRef<Record<string, any>>({});
  const initialFetchDone = useRef(false);

  const fetchSources = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/knowledge', {
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
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
      const response = await fetch('http://localhost:3001/api/v1/crawlers', {
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setCrawlers(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const response = await fetch('http://localhost:3001/api/v1/knowledge/upload', {
        method: 'POST',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        fetchSources();
      } else {
        alert('Upload failed: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/knowledge/${id}/retry`, {
        method: 'POST',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
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
      const response = await fetch(`http://localhost:3001/api/v1/knowledge/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
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
      const response = await fetch(`http://localhost:3001/api/v1/crawlers/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
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
    // ONE initial fetch
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSources();
      fetchCrawlers();
    }

    const orgId = localStorage.getItem('organizationId') || '';
    if (!orgId) return;

    let eventSource: EventSource;
    let isFirstPush = true; // Use local variable for the closure

    try {
      eventSource = new EventSource(`http://localhost:3001/api/v1/jobs/stream?orgId=${orgId}`, {
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
                // Invalidate cache and refetch if a job status transitioned to COMPLETED or FAILED
                // BUT skip this check on the very first SSE push since we already did an initial fetch!
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
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const extractFilename = (storageKey?: string) => {
    if (!storageKey) return 'Unknown Document';
    const parts = storageKey.split('-');
    if (parts.length > 1) {
      return parts.slice(1).join('-'); // removes the uuid prefix
    }
    return storageKey;
  };

  // Filter to avoid showing website sources in the document list if they happen to appear
  const documentSources = sources.filter((s) => s.sourceType !== 'WEBSITE');

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Document Knowledge Base</h1>

          <label
            className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 ${uploading ? 'opacity-50' : ''}`}
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
              accept=".pdf,.txt,.md,.docx"
            />
          </label>
        </div>

        <div className="bg-white rounded-lg shadow border overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documentSources.map((s) => {
                const activeJob = activeJobs[s.id];
                // Use live SSE status if it exists, otherwise use database status
                const displayStatus = activeJob ? activeJob.status : s.status;
                const displayProgress = activeJob ? activeJob.progress : 0;
                const isRunning = displayStatus === 'RUNNING' || displayStatus === 'PENDING';

                return (
                  <tr key={s.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {extractFilename(s.document?.storageKey)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.sourceType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSize(s.document?.sizeBytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${
                            displayStatus === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : displayStatus === 'FAILED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {displayStatus}
                        </span>
                        {isRunning && activeJob?.currentStage && (
                          <span className="text-[10px] font-medium text-gray-500">
                            {activeJob.currentStage}
                          </span>
                        )}
                        {isRunning && displayProgress > 0 && (
                          <div className="flex items-center space-x-2 mt-1">
                            <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden flex items-center">
                              <div
                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${displayProgress}%` }}
                              ></div>
                            </div>
                            <span className="text-[10px] font-semibold text-blue-600">
                              {displayProgress}%
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium space-x-4">
                      {displayStatus === 'FAILED' && (
                        <button
                          onClick={() => handleRetry(s.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {documentSources.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No document sources uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-6 mt-12">
          <h1 className="text-2xl font-bold text-gray-900">Crawler Knowledge / Websites</h1>
        </div>
        <div className="bg-white rounded-lg shadow border overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seed URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {crawlers.map((c) => {
                return (
                  <tr key={c.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        {c.url}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {c.pagesCrawled} completed
                      {c.pagesFailed > 0 && (
                        <span className="text-red-500 ml-2">({c.pagesFailed} failed)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${
                          c.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : c.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium space-x-4">
                      <button
                        onClick={() => handleDeleteCrawler(c.id)}
                        className="text-red-600 hover:text-red-900"
                        disabled={c.status === 'RUNNING'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {crawlers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No websites crawled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
