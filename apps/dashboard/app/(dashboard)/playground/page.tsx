'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAIError } from '../../context/AIErrorContext';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default function PlaygroundPage() {
  const { showAIErrorModal } = useAIError();
  const [messages, setMessages] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return [];
    const saved = sessionStorage.getItem(`playground_messages_${orgId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return null;
    return sessionStorage.getItem(`playground_conversationId_${orgId}`) || null;
  });
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return null;
    const savedMessages = sessionStorage.getItem(`playground_messages_${orgId}`);
    const savedMetrics = sessionStorage.getItem(`playground_metrics_${orgId}`);
    if (savedMessages && savedMetrics) {
      try {
        const parsedMsgs = JSON.parse(savedMessages);
        if (Array.isArray(parsedMsgs) && parsedMsgs.length > 0) {
          return JSON.parse(savedMetrics);
        }
      } catch {}
    }
    return null;
  });
  const [metricsWidth, setMetricsWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isHydratedRef = useRef(false);

  useEffect(() => {
    isHydratedRef.current = true;
    // Clean up any legacy un-scoped keys from previous versions
    sessionStorage.removeItem('playground_messages');
    sessionStorage.removeItem('playground_conversationId');
    sessionStorage.removeItem('playground_metrics');
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setMetricsWidth((w) => Math.max(250, Math.min(800, w - e.movementX)));
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Save to sessionStorage when updated
  useEffect(() => {
    if (!isHydratedRef.current) return;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;

    if (messages.length > 0) {
      sessionStorage.setItem(`playground_messages_${orgId}`, JSON.stringify(messages));
    } else {
      sessionStorage.removeItem(`playground_messages_${orgId}`);
      sessionStorage.removeItem(`playground_metrics_${orgId}`);
    }
  }, [messages]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;

    if (conversationId) {
      sessionStorage.setItem(`playground_conversationId_${orgId}`, conversationId);
    } else {
      sessionStorage.removeItem(`playground_conversationId_${orgId}`);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!isHydratedRef.current) return;
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;

    if (metrics && messages.length > 0) {
      sessionStorage.setItem(`playground_metrics_${orgId}`, JSON.stringify(metrics));
    } else {
      sessionStorage.removeItem(`playground_metrics_${orgId}`);
    }
  }, [metrics, messages.length]);

  const clearSession = () => {
    const orgId = localStorage.getItem('organizationId');
    if (orgId) {
      sessionStorage.removeItem(`playground_messages_${orgId}`);
      sessionStorage.removeItem(`playground_conversationId_${orgId}`);
      sessionStorage.removeItem(`playground_metrics_${orgId}`);
    }
    sessionStorage.removeItem('playground_messages');
    sessionStorage.removeItem('playground_conversationId');
    sessionStorage.removeItem('playground_metrics');
    setMessages([]);
    setConversationId(null);
    setMetrics(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setMetrics(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg, ...(conversationId ? { conversationId } : {}) }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'metadata' && data.conversationId) {
                setConversationId(data.conversationId);
              } else if (data.type === 'citation' && data.citations) {
                if (data.citations.length > 0) {
                  const topScore = data.citations[0].score;
                  setMetrics({
                    chunks: data.citations,
                    match: topScore ? Math.round(topScore * 100) : 0,
                  });
                } else {
                  setMetrics({ chunks: [], match: 0 });
                }
              } else if (data.type === 'chunk' && data.content) {
                assistantMsg += data.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantMsg;
                  return newMsgs;
                });
              } else if (data.type === 'error') {
                const errObj =
                  typeof data.error === 'object'
                    ? data.error
                    : {
                        code: 'CHAT_STREAM_ERROR',
                        category: 'UNKNOWN',
                        message: String(data.error || 'Stream error'),
                        keySource: 'SYSTEM_FREE_TIER',
                        provider: 'system',
                        actionableResolution: {
                          type: 'RETRY_NOW',
                          title: 'Stream Error',
                          description: String(
                            data.error || 'An error occurred during chat stream execution.'
                          ),
                          primaryButton: { label: 'Retry', action: 'RETRY_NOW' },
                        },
                      };

                showAIErrorModal(errObj, (action) => {
                  if (action === 'TRUNCATE_HISTORY') {
                    setMessages((prev) => prev.slice(-2));
                  }
                });

                assistantMsg += `\n\n⚠️ **[${errObj.actionableResolution?.title || 'Error'}]**: ${errObj.message}`;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantMsg;
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      showAIErrorModal({
        code: 'NETWORK_ERROR',
        category: 'UNKNOWN',
        message: err?.message || 'Failed to connect to AI service.',
        keySource: 'NONE',
        provider: 'system',
        actionableResolution: {
          type: 'RETRY_NOW',
          title: 'Connection Error',
          description:
            'Could not connect to the backend server. Please check your network connection.',
          primaryButton: { label: 'Retry', action: 'RETRY_NOW' },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-mono text-zinc-200 space-y-4">
      <div className="flex flex-col md:flex-row h-[calc(100vh-150px)] w-full border border-zinc-800 bg-zinc-950/80 corner-border overflow-hidden gap-0">
        {/* Left Chat Column */}
        <div className="flex flex-col flex-1 bg-zinc-950 border-r border-zinc-800 min-w-0">
          <div className="p-4 border-b border-zinc-800 bg-[#0c0c0f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-xs uppercase tracking-[0.15em] text-zinc-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AI PLAYGROUND CHAT
              </span>
              <span className="text-zinc-600 text-xs font-normal">|</span>
              <span className="text-[11px] text-zinc-400 font-normal tracking-wide">
                Preview what your user sees on chatbot
              </span>
            </div>
            <button
              onClick={clearSession}
              className="text-[11px] px-3 py-1 modbit-btn-secondary uppercase tracking-wider self-start sm:self-center"
            >
              [ CLEAR SESSION ]
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <span className="text-sm font-bold tracking-widest text-zinc-400">
                  {'// PLAYGROUND ACTIVE'}
                </span>
                <p className="text-xs text-center max-w-sm">
                  Query your institution&apos;s Knowledge Base in real time. Context chunks and
                  vector similarity scores will stream on the right pane.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-4 border transition-colors max-w-[85%] ${
                  m.role === 'user'
                    ? 'border-zinc-700 bg-zinc-900/90 text-zinc-100 self-end ml-auto'
                    : 'border-zinc-800 bg-zinc-950/80 text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-zinc-800/80 text-[10px] text-zinc-500 uppercase tracking-widest">
                  <span>{m.role === 'user' ? '► USER' : '✦ AI ASSISTANT'}</span>
                </div>
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-zinc-500 animate-pulse text-xs tracking-wider font-mono">
                ✦ GENERATING RESPONSE...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-800 bg-[#0c0c0f] flex gap-3">
            <input
              className="flex-1 px-3.5 py-2.5 modbit-input text-xs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask a question about your knowledge base..."
              disabled={loading}
            />
            <button
              className="px-6 py-2.5 modbit-btn-primary text-xs tracking-[0.15em] uppercase disabled:opacity-50 shrink-0"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              [ SEND ]
            </button>
          </div>
        </div>

        {/* Drag Resizer */}
        <div
          className="hidden md:flex w-1 cursor-col-resize hover:bg-zinc-600 bg-zinc-800 transition-colors shrink-0"
          onMouseDown={() => setIsDragging(true)}
        />

        {/* Right Metrics Column */}
        <div
          className="w-full md:w-[var(--metrics-width)] flex flex-col bg-zinc-950 shrink-0"
          style={{ '--metrics-width': `${metricsWidth}px` } as React.CSSProperties}
        >
          <div className="p-4 border-b border-zinc-800 bg-[#0c0c0f] text-xs font-bold uppercase tracking-[0.15em] text-zinc-100 flex justify-between items-center">
            <span>RETRIEVAL METRICS</span>
            <span className="text-[10px] text-zinc-500 font-normal">VECTOR RAG</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {metrics ? (
              <div className="space-y-4">
                {/* Confidence Card */}
                <div className="p-4 border border-zinc-800 bg-zinc-900/60 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest text-center">
                    Top Match Confidence
                  </span>
                  <span
                    className={`text-3xl font-bold mt-1.5 tracking-tight ${
                      metrics.match >= 80
                        ? 'text-emerald-400'
                        : metrics.match >= 50
                          ? 'text-yellow-400'
                          : 'text-zinc-400'
                    }`}
                  >
                    {metrics.match}%
                  </span>
                  <p className="text-[10px] text-zinc-500 mt-1 text-center">
                    Cosine similarity score from vector embeddings
                  </p>
                </div>

                {/* Context Chunks */}
                <div>
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                    Retrieved Chunks ({metrics.chunks.length})
                  </h3>

                  {metrics.chunks.length === 0 ? (
                    <div className="p-4 border border-zinc-800 bg-zinc-950 text-zinc-500 text-xs text-center">
                      No matching context chunks retrieved.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {metrics.chunks.map((chunk: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 border border-zinc-800 bg-zinc-900/40 space-y-2"
                        >
                          <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800/80">
                            <span className="text-[10px] text-zinc-300 truncate font-bold">
                              {chunk.sourceUrl ? new URL(chunk.sourceUrl).hostname : 'Document'}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                              {Math.round(chunk.score * 100)}%
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-300 leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap font-mono bg-zinc-950 p-2 border border-zinc-900">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-6 text-center space-y-2">
                <span className="text-xs uppercase tracking-widest text-zinc-400">
                  {'// NO ACTIVE METRICS'}
                </span>
                <p className="text-xs text-zinc-500">
                  Send a message in playground chat to view vector retrieval chunks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
