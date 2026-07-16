'use client';

import { useState, useEffect } from 'react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const orgId = localStorage.getItem('organizationId') || '';
      const response = await fetch(
        `http://localhost:3001/api/v1/organizations/${orgId}/audit-logs`,
        {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }
      );
      const json = await response.json();
      if (json.success) setLogs(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actor ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metadata
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {log.actorId || 'System'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.metadata ? (
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-w-xs">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-gray-400 italic">None</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No audit logs found for this organization.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  Loading logs...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
