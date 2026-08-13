'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

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
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            AUDIT LOGS
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Immutable security event trail for institution actions
          </p>
        </div>
      </div>

      <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-xs">
          <thead className="bg-zinc-950/90">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Action Event
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Actor ID
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Metadata Payload
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4 text-zinc-400">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 text-[10px] font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 uppercase tracking-wider">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-400 font-mono">{log.actorId || 'System'}</td>
                <td className="px-6 py-4">
                  {log.metadata ? (
                    <pre className="text-[10px] bg-zinc-950 p-2 border border-zinc-900 text-zinc-300 overflow-x-auto max-w-xs font-mono">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-zinc-600 italic">None</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  No audit logs recorded for this organization.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 animate-pulse">
                  Loading audit logs...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
