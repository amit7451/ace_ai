'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQueuePaused, setIsQueuePaused] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem('organizationId') || '';
    if (!orgId) return;

    let eventSource: EventSource;

    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/jobs/stream?orgId=${orgId}`, {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'update') {
            setJobs(data.jobs);
            setIsQueuePaused(data.isPaused ?? false);
            setLoading(false);
          } else if (data.type === 'connected') {
            console.log('SSE Connected');
          }
        } catch (e) {
          console.error('Failed to parse SSE message', e);
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

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/jobs/${id}/retry`, {
        method: 'POST',
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        alert('Retry initiated successfully.');
      } else {
        alert('Failed to retry: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger retry.');
    }
  };

  const handleAction = async (endpoint: string, method: string = 'POST') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/jobs${endpoint}`, {
        method,
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
        credentials: 'include',
      });
      const json = await response.json();
      if (!json.success) {
        alert('Action failed: ' + json.error?.message);
      } else {
        if (endpoint === '/pause') setIsQueuePaused(true);
        if (endpoint === '/resume') setIsQueuePaused(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to perform action.');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            INGESTION JOBS
          </h1>
          {isQueuePaused && (
            <span className="px-2.5 py-0.5 border border-yellow-800/80 bg-yellow-950/40 text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
              QUEUE PAUSED
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {!isQueuePaused ? (
            <button
              onClick={() => handleAction('/pause')}
              className="px-4 py-2 text-xs font-mono text-yellow-400 border border-yellow-800/80 hover:bg-yellow-950/40 uppercase tracking-wider transition-colors"
            >
              [ PAUSE QUEUE ]
            </button>
          ) : (
            <button
              onClick={() => handleAction('/resume')}
              className="px-4 py-2 text-xs font-mono text-emerald-400 border border-emerald-800/80 hover:bg-emerald-950/40 uppercase tracking-wider transition-colors"
            >
              [ RESUME QUEUE ]
            </button>
          )}
          <button
            onClick={() => handleAction('/failed', 'DELETE')}
            className="px-4 py-2 text-xs font-mono text-red-400 border border-red-900/60 hover:bg-red-950/40 uppercase tracking-wider transition-colors"
          >
            [ CLEAR FAILED ]
          </button>
        </div>
      </div>

      <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-xs">
          <thead className="bg-zinc-950/90">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Job ID
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Stage
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Status
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Created At
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {jobs.map((j) => (
              <tr key={j.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4 font-bold text-zinc-100 font-mono">
                  {j.id.slice(0, 8)}...
                </td>
                <td className="px-6 py-4 text-zinc-400">
                  <div className="flex items-center space-x-3">
                    <span>{j.currentStage || 'UNKNOWN'}</span>
                    {j.status === 'RUNNING' && j.progress > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-zinc-900 border border-zinc-800 h-1.5 overflow-hidden">
                          <div
                            className="bg-zinc-100 h-1.5 transition-all duration-300"
                            style={{ width: `${j.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold">{j.progress}%</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                      j.status === 'COMPLETED'
                        ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                        : j.status === 'FAILED'
                          ? 'border-red-900/60 bg-red-950/40 text-red-400'
                          : 'border-yellow-800/80 bg-yellow-950/40 text-yellow-400'
                    }`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {new Date(j.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 space-x-3">
                  {j.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(j.id)}
                      className="text-zinc-300 hover:text-white underline text-[11px]"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(`/${j.id}`, 'DELETE')}
                    className="text-red-400 hover:text-red-300 underline text-[11px]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  No jobs queued.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 animate-pulse">
                  Connecting to live SSE job stream...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
