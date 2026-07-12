'use client';

import { useState } from 'react';

export default function HostedChatPage({ params }: { params: { widgetKey: string } }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/v1/chat', {
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

  return (
    <div className="flex flex-col h-screen w-full max-w-3xl mx-auto bg-white sm:shadow-lg sm:border sm:rounded-lg overflow-hidden my-0 sm:my-8">
      <div className="bg-blue-600 text-white p-4 font-semibold text-lg flex items-center shadow-md">
        ION AI Chat Support
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-xl font-medium text-gray-700">How can we help you today?</p>
            <p className="mt-2">Send a message to start chatting.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl max-w-[85%] shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'}`}
          >
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {loading && <div className="text-gray-400 italic text-sm ml-2">Typing...</div>}
      </div>
      <div className="border-t p-4 bg-white">
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded-full px-6 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
          />
          <button
            className="bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
        <div className="text-center text-xs text-gray-400 mt-3">Powered by ION AI</div>
      </div>
    </div>
  );
}
