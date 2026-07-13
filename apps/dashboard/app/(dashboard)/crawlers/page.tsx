'use client';

import { useState, useEffect, useRef } from 'react';

export default function CrawlersPage() {
  const [crawlers, setCrawlers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!url) return;
    try {
      const response = await fetch('http://localhost:3001/api/v1/crawlers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      const json = await response.json();
      if (json.success) {
        alert(json.data.message || 'Crawler added successfully');
        setUrl('');
        fetchCrawlers();
      } else {
        alert('Failed to add crawler');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/crawlers/${id}/retry`, {
        method: 'POST',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        alert('Retry initiated successfully.');
        fetchCrawlers();
      } else {
        alert('Failed to retry: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger retry.');
    }
  };

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchCrawlers();
    }
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Website Crawlers</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border mb-8 flex gap-4">
        <input
          type="url"
          placeholder="https://example.com/docs"
          className="flex-1 border border-gray-300 rounded-md px-4 py-2"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          disabled={!url}
        >
          Add Crawler
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Base URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Pages Crawled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {crawlers.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {c.url}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {c.pagesCrawled || 0}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      c.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : c.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {c.status}
                  </span>
                  {c.status === 'FAILED' && c.errorDetails && (
                    <div
                      className="mt-1 text-xs text-red-500 truncate max-w-[200px]"
                      title={c.errorDetails}
                    >
                      {c.errorDetails}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {c.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(c.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {crawlers.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No crawlers active.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
