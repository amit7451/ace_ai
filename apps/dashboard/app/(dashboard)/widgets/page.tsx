'use client';

import { useState, useEffect, useRef } from 'react';

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWidgets = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/widgets', {
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setWidgets(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createWidget = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/widgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
        body: JSON.stringify({ allowedDomains: [] }),
      });
      const json = await response.json();
      if (json.success) fetchWidgets();
    } catch (err) {
      console.error(err);
    }
  };

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchWidgets();
    }
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Chat Widgets</h1>
        <button
          onClick={createWidget}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Generate New Widget
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Public Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {widgets.map((w) => (
              <tr key={w.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {w.publicKey}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${w.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {w.enabled ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(w.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-900 font-medium">
                  <a href={`/chat/${w.publicKey}`} target="_blank">
                    Test Hosted Chat
                  </a>
                </td>
              </tr>
            ))}
            {widgets.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No widgets generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
