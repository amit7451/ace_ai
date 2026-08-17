'use client';

import { useState } from 'react';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any | null>(null);

  const getOrgId = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('organizationId') || '';
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': getOrgId(),
        },
        credentials: 'include',
        body: JSON.stringify({
          query: query.trim(),
          topK: Number(topK),
          scoreThreshold: Number(scoreThreshold),
        }),
      });

      const json = await response.json();
      if (json.success) {
        setResults(json.data);
      } else {
        setError(json.error?.message || 'Search request failed.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err?.message || 'Failed to connect to search service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 font-mono text-zinc-200">
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
          KNOWLEDGE RETRIEVAL DEBUGGER
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Directly inspect vector similarity search and retrieved context chunks from Qdrant
        </p>
      </div>

      {/* Search Input Box */}
      <div className="modbit-card p-6 border border-zinc-800 corner-border bg-zinc-950/80 space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
              Semantic Search Query
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask or search your knowledge base (e.g. tuition fees, refund policy)..."
                className="flex-1 px-4 py-2.5 modbit-input text-xs"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider disabled:opacity-50 shrink-0"
              >
                {loading ? '[ SEARCHING... ]' : '[ EXECUTE SEARCH ]'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-900 text-xs">
            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 uppercase tracking-wide">
                Top K Results: <span className="text-zinc-200 font-bold">{topK}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full accent-zinc-200 bg-zinc-800 h-1.5 rounded-none cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 uppercase tracking-wide">
                Min Score Threshold:{' '}
                <span className="text-zinc-200 font-bold">{Math.round(scoreThreshold * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(Number(e.target.value))}
                className="w-full accent-zinc-200 bg-zinc-800 h-1.5 rounded-none cursor-pointer"
              />
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 border border-red-900/60 bg-red-950/40 text-red-400 text-xs font-mono">
          ⚠️ {error}
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
            {results
              ? `RETRIEVED CHUNKS (${results.chunks?.length || 0}) — ${results.durationMs || 0}ms`
              : 'RETRIEVED CHUNKS'}
          </h2>
          {results?.totalCandidateCount !== undefined && (
            <span className="text-[10px] text-zinc-500">
              Evaluated {results.totalCandidateCount} candidates | {results.totalTokenCount || 0}{' '}
              tokens
            </span>
          )}
        </div>

        {!results && !loading && (
          <div className="modbit-card p-8 border border-zinc-800 corner-border text-center text-zinc-500 text-xs">
            Enter a query above to execute direct semantic search against your organization&apos;s
            vector database.
          </div>
        )}

        {results && results.chunks?.length === 0 && (
          <div className="modbit-card p-8 border border-zinc-800 corner-border text-center text-zinc-500 text-xs">
            No chunks matched the query with the current threshold (
            {Math.round(scoreThreshold * 100)}%). Try lowering the threshold or adjusting the query.
          </div>
        )}

        {results && results.chunks?.length > 0 && (
          <div className="space-y-3">
            {results.chunks.map((chunk: any, idx: number) => (
              <div
                key={chunk.chunkId || idx}
                className="modbit-card p-4 border border-zinc-800 corner-border bg-zinc-950/60 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-800/80 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100">
                      #{idx + 1}{' '}
                      {chunk.metadata?.title || chunk.metadata?.url
                        ? chunk.metadata?.title || chunk.metadata?.url
                        : `Chunk ${chunk.chunkId?.slice(0, 8)}`}
                    </span>
                    {chunk.sourceType && (
                      <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 uppercase">
                        {chunk.sourceType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-[10px]">
                      Tokens: {chunk.tokenCount ?? 'N/A'}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                        chunk.score >= 0.8
                          ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                          : chunk.score >= 0.6
                            ? 'border-yellow-800/80 bg-yellow-950/40 text-yellow-400'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {Math.round(chunk.score * 100)}% Match
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/50 border border-zinc-900 text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {chunk.text}
                </div>

                {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                  <details className="text-[10px] text-zinc-500 cursor-pointer pt-1">
                    <summary className="hover:text-zinc-400">[ View Metadata ]</summary>
                    <pre className="mt-1 p-2 bg-zinc-950 border border-zinc-900 text-zinc-400 overflow-x-auto">
                      {JSON.stringify(chunk.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
