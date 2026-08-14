'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function WidgetsPage() {
  const router = useRouter();
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingFreeKey, setIsUsingFreeKey] = useState(false);
  const [activeProvider, setActiveProvider] = useState('testing');
  const [showKeyWarningModal, setShowKeyWarningModal] = useState(false);

  const fetchWidgets = async () => {
    try {
      const orgId = localStorage.getItem('organizationId') || '';
      const [widgetsRes, configRes, keysRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/widgets`, {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/api/v1/configuration`, {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/api/v1/configuration/apikeys`, {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
      ]);

      const widgetsJson = await widgetsRes.json();
      const configJson = await configRes.json();
      const keysJson = await keysRes.json();

      if (widgetsJson.success) setWidgets(widgetsJson.data);

      const provider = configJson.data?.llmProvider || 'testing';
      setActiveProvider(provider);

      const keysList: any[] = keysJson.data || [];
      const hasCustomKey = keysList.some((k) => k.provider === provider && k.hasKey);

      // Free key if testing provider OR provider key not configured
      const usingFree = provider === 'testing' || !hasCustomKey;
      setIsUsingFreeKey(usingFree);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createWidget = async () => {
    if (isUsingFreeKey) {
      setShowKeyWarningModal(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/widgets`, {
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

  const navigateToSettingsAPIKeys = () => {
    router.push('/settings#api-keys');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      {/* Top Free Key Alert Banner */}
      {isUsingFreeKey && (
        <div className="p-4 border border-amber-500/50 bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="text-sm">⚠️</span>
            <div>
              <span className="font-bold uppercase tracking-wider block">
                Free Key Notice (Playground Testing Only)
              </span>
              <span className="text-[11px] text-amber-400/90">
                You are using the shared free key. Live website widgets require your own configured
                API key.
              </span>
            </div>
          </div>
          <button
            onClick={navigateToSettingsAPIKeys}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-colors whitespace-nowrap self-start sm:self-auto shadow-md"
          >
            Configure API Key →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            CHAT WIDGETS
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Embeddable website chat widget keys and hosted widget instances
          </p>
        </div>
        <button
          onClick={createWidget}
          className="modbit-btn-primary px-5 py-2.5 text-xs uppercase tracking-wider self-start sm:self-center font-bold"
        >
          [ + GENERATE NEW WIDGET ]
        </button>
      </div>

      {/* Key Warning Modal */}
      {showKeyWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono text-zinc-100">
          <div className="relative w-full max-w-lg overflow-hidden border border-zinc-800 bg-zinc-950 p-6 shadow-2xl corner-border space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="px-2.5 py-0.5 border text-[11px] font-bold uppercase tracking-wider border-amber-500/50 bg-amber-500/10 text-amber-400">
                🔑 PRODUCTION API KEY REQUIRED
              </span>
              <button
                onClick={() => setShowKeyWarningModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 uppercase tracking-wider"
              >
                [ ESC ]
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-zinc-100 tracking-wide">
                Custom API Key Required for Live Widgets
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                You are currently using the{' '}
                <strong className="text-amber-300">free API key ({activeProvider})</strong>, which
                is enabled for Playground testing only.
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                To generate and host live embeddable website widgets for external visitors, please
                configure your own production API key in Settings.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={navigateToSettingsAPIKeys}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg"
              >
                [ CONFIGURE API KEY IN SETTINGS ]
              </button>
              <button
                onClick={() => setShowKeyWarningModal(false)}
                className="px-4 py-2.5 border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-xs">
          <thead className="bg-zinc-950/90">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Public Key
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Status
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
            {widgets.map((w) => (
              <tr key={w.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4 font-bold text-zinc-100 font-mono">{w.publicKey}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                      w.enabled
                        ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                        : 'border-red-900/60 bg-red-950/40 text-red-400'
                    }`}
                  >
                    {w.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {new Date(w.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <a
                    href={`/chat/${w.publicKey}`}
                    target="_blank"
                    className="text-zinc-200 hover:text-white underline text-[11px] font-bold"
                  >
                    Test Hosted Chat →
                  </a>
                </td>
              </tr>
            ))}
            {widgets.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  No chat widgets generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
