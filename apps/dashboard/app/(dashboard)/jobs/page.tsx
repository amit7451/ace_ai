'use client';

import { useState, useEffect } from 'react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isQueuePaused, setIsQueuePaused] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem('organizationId') || '';
    if (!orgId) return;

    let eventSource: EventSource;

    try {
      eventSource = new EventSource(`http://localhost:3001/api/v1/jobs/stream?orgId=${orgId}`, {
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
      const response = await fetch(`http://localhost:3001/api/v1/jobs/${id}/retry`, {
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
      const response = await fetch(`http://localhost:3001/api/v1/jobs${endpoint}`, {
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Ingestion Jobs</h1>
          {isQueuePaused && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full border border-yellow-200">
              QUEUE PAUSED
            </span>
          )}
        </div>
        <div className="space-x-3">
          {!isQueuePaused ? (
            <button
              onClick={() => handleAction('/pause')}
              className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 text-sm font-medium transition-colors"
            >
              Pause Queue
            </button>
          ) : (
            <button
              onClick={() => handleAction('/resume')}
              className="px-4 py-2 bg-green-100 text-green-800 rounded-md hover:bg-green-200 text-sm font-medium transition-colors"
            >
              Resume Queue
            </button>
          )}
          <button
            onClick={() => handleAction('/failed', 'DELETE')}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 text-sm font-medium transition-colors"
          >
            Clear Failed
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Job ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((j) => (
              <tr key={j.id} className={j.status === 'FAILED' ? 'bg-red-50/50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {j.id.slice(0, 8)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>{j.currentStage || 'UNKNOWN'}</span>
                    {j.status === 'RUNNING' && j.progress > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2.5 overflow-hidden flex items-center">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${j.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-blue-600">{j.progress}%</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      j.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : j.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(j.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                  {j.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(j.id)}
                      className="text-blue-600 hover:text-blue-900 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(`/${j.id}`, 'DELETE')}
                    className="text-red-600 hover:text-red-900 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No jobs queued.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 animate-pulse">
                  Connecting to live stream...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
