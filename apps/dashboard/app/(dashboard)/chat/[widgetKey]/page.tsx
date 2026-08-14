'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default function HostedChatPage({ params }: { params: { widgetKey: string } }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [institutionName, setInstitutionName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Fetch widget configuration and institution name
    const fetchConfig = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/chat/config?widgetKey=${params.widgetKey}`
        );
        const json = await response.json();
        if (json.success && json.data?.institutionName) {
          setInstitutionName(json.data.institutionName);
        }
      } catch (err) {
        console.error('Failed to fetch widget config', err);
      }
    };

    fetchConfig();
  }, [params.widgetKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          widgetKey: params.widgetKey,
          ...(conversationId ? { conversationId } : {}),
        }),
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

  const headerTitle = institutionName
    ? `${institutionName.toUpperCase()} CHAT SUPPORT`
    : 'INSTITUTION CHAT SUPPORT';

  return (
    <div className="min-h-screen w-full bg-[#08080a] flex items-center justify-center p-4 sm:p-6 font-mono text-zinc-200">
      <div className="w-full max-w-3xl h-[88vh] flex flex-col modbit-card border border-zinc-800 corner-border overflow-hidden bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="bg-zinc-950/90 border-b border-zinc-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Image
                src="/modbit.webp"
                alt="ModBit Logo"
                width={20}
                height={20}
                className="w-5 h-5 object-contain"
              />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-[0.15em] text-zinc-100 uppercase">
                {headerTitle}
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                PUBLIC KEY: {params.widgetKey.slice(0, 12)}...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
              LIVE WIDGET
            </span>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#08080a]/60">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                💬
              </div>
              <h2 className="text-xs font-bold text-zinc-200 tracking-widest uppercase">
                {institutionName ? `${institutionName.toUpperCase()} ASSISTANT` : 'ASSISTANT READY'}
              </h2>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                Ask a question to query institution knowledge base sources and retrieve instant
                answers.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-4 max-w-[85%] text-xs font-mono transition-all ${
                m.role === 'user'
                  ? 'bg-zinc-100 text-zinc-950 font-bold ml-auto border border-zinc-200 shadow-sm'
                  : 'bg-zinc-950 text-zinc-200 border border-zinc-800 corner-border'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              )}
            </div>
          ))}

          {loading && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-400 max-w-xs animate-pulse">
              [ AGENT AGGREGATING KNOWLEDGE RESPONSE... ]
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-2">
          <div className="flex gap-3">
            <input
              className="flex-1 px-4 py-3 modbit-input text-xs font-mono bg-zinc-950"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type query to test hosted widget..."
              disabled={loading}
            />
            <button
              className="modbit-btn-primary px-6 py-3 text-xs uppercase tracking-wider disabled:opacity-50 shrink-0"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              [ SEND ]
            </button>
          </div>
          <div className="text-center text-[10px] text-zinc-600 tracking-widest uppercase pt-1 font-mono">
            POWERED BY MODBIT AI ENGINE
          </div>
        </div>
      </div>
    </div>
  );
}
