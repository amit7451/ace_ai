'use client';

import { useState, useEffect, useRef } from 'react';

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('playground_messages');
    const savedConvId = sessionStorage.getItem('playground_conversationId');
    const savedMetrics = sessionStorage.getItem('playground_metrics');

    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedConvId) setConversationId(savedConvId);
    if (savedMetrics) setMetrics(JSON.parse(savedMetrics));
  }, []);

  // Save to sessionStorage when updated
  useEffect(() => {
    sessionStorage.setItem('playground_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      sessionStorage.setItem('playground_conversationId', conversationId);
    } else {
      sessionStorage.removeItem('playground_conversationId');
    }
  }, [conversationId]);

  useEffect(() => {
    if (metrics) {
      sessionStorage.setItem('playground_metrics', JSON.stringify(metrics));
    } else {
      sessionStorage.removeItem('playground_metrics');
    }
  }, [metrics]);

  const clearSession = () => {
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

    try {
      const response = await fetch('http://localhost:3001/api/v1/chat', {
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
                assistantMsg += '\n\n*Error: ' + data.error + '*';
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] max-w-7xl mx-auto border rounded-lg bg-white overflow-hidden shadow-sm mt-8 gap-4 bg-gray-50 p-4">
      {/* Left Chat Column */}
      <div className="flex flex-col flex-1 bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="bg-blue-600 text-white p-4 font-semibold text-lg flex justify-between items-center">
          <span>Playground Chat</span>
          <button
            onClick={clearSession}
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            Clear Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg max-w-[85%] ${m.role === 'user' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-100'}`}
            >
              <span className="font-bold mb-1 block text-sm text-gray-500">
                {m.role === 'user' ? 'You' : 'AI'}
              </span>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-gray-400 italic">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-4 flex gap-2">
          <input
            className="flex-1 border rounded-md px-4 py-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {/* Right Metrics Column */}
      <div className="w-[400px] flex flex-col bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="bg-gray-800 text-white p-4 font-semibold text-lg">Retrieval Metrics</div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {metrics ? (
            <div className="space-y-6">
              {/* Match Score Card */}
              <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Top Match Confidence
                </span>
                <span
                  className={`text-4xl font-bold mt-2 ${metrics.match >= 80 ? 'text-green-600' : metrics.match >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
                >
                  {metrics.match}%
                </span>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Based on vector similarity score
                </p>
              </div>

              {/* Context Chunks */}
              <div>
                <h3 className="text-md font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Retrieved Context ({metrics.chunks.length})
                </h3>

                {metrics.chunks.length === 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-500 italic p-4 text-center border rounded border-dashed">
                      No context retrieved from Knowledge Base
                    </div>
                    <div className="text-xs text-blue-700 bg-blue-50 p-3 rounded border border-blue-100 flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">💡</span>
                      <p>
                        <strong>Why did the AI still answer?</strong>
                        <br />
                        When no documents match your specific query, the AI relies on its memory of
                        your <strong>Conversation History</strong> to answer follow-up questions, or
                        responds naturally to basic greetings.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {metrics.chunks.map((chunk: any, idx: number) => (
                      <div key={idx} className="bg-white border rounded p-3 shadow-sm text-sm">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b">
                          <span
                            className="font-medium text-xs text-blue-600 truncate mr-2"
                            title={chunk.sourceUrl || 'Unknown Source'}
                          >
                            {chunk.sourceType === 'url' && <span className="mr-1">🔗</span>}
                            {chunk.sourceUrl ? new URL(chunk.sourceUrl).hostname : 'Document'}
                          </span>
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            Match: {Math.round(chunk.score * 100)}%
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-xs max-h-32 overflow-y-auto whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
              <svg
                className="w-12 h-12 mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              <p>Send a message to see the retrieval metrics and context chunks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
