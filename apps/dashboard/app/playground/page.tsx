'use client';

import { useState } from 'react';

export default function PlaygroundPage() {
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
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-4xl mx-auto border rounded-lg bg-white overflow-hidden shadow-sm mt-8">
      <div className="bg-blue-600 text-white p-4 font-semibold text-lg">
        Playground Debug Console
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-blue-100 self-end ml-auto' : 'bg-gray-100'}`}
          >
            <span className="font-bold mb-1 block text-sm text-gray-500">
              {m.role === 'user' ? 'You' : 'AI'}
            </span>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && <div className="text-gray-400 italic">Thinking...</div>}
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
          className="bg-blue-600 text-white px-6 py-2 rounded-md disabled:opacity-50"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
