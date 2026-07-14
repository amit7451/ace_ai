'use client';

import { useState, useEffect, useRef } from 'react';

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [llmProvider, setLlmProvider] = useState('testing');
  const [embeddingProvider, setEmbeddingProvider] = useState('testing');
  const [syncEmbeddingProvider, setSyncEmbeddingProvider] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | ''>('');
  const [topK, setTopK] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // API Key State
  const [newKeyProvider, setNewKeyProvider] = useState('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      if (!orgId) return;

      const [configRes, keysRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/configuration', {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
        fetch('http://localhost:3001/api/v1/configuration/apikeys', {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
      ]);

      const configData = await configRes.json();
      const keysData = await keysRes.json();

      if (configData.success) {
        const c = configData.data;
        setConfig(c);
        setLlmProvider(c.llmProvider || 'testing');
        setEmbeddingProvider(c.embeddingProvider || 'testing');
        setSyncEmbeddingProvider(
          (c.llmProvider || 'testing') === (c.embeddingProvider || 'testing')
        );
        setTemperature(c.temperature ?? 0.7);
        setMaxTokens(c.maxTokens || '');
        setTopK(c.topK ?? 5);
        setScoreThreshold(c.scoreThreshold ?? 0.7);
        setSystemPrompt(c.systemPrompt || '');
        setWelcomeMessage(c.welcomeMessage || '');
      }

      if (keysData.success) {
        setApiKeys(keysData.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch('http://localhost:3001/api/v1/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          llmProvider,
          embeddingProvider,
          temperature: Number(temperature),
          maxTokens: maxTokens === '' ? undefined : Number(maxTokens),
          topK: Number(topK),
          scoreThreshold: Number(scoreThreshold),
          systemPrompt,
          welcomeMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Configuration saved successfully.');
      } else {
        setError(data.error?.message || 'Failed to save configuration.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKey(true);
    setError('');
    setSuccess('');

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch('http://localhost:3001/api/v1/configuration/apikeys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          provider: newKeyProvider,
          apiKey: newKeyValue,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('API key saved successfully.');
        setNewKeyValue('');
        fetchData(); // Refresh keys
      } else {
        setError(data.error?.message || 'Failed to save API key.');
      }
    } catch (err) {
      setError('An unexpected error occurred while saving API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!window.confirm(`Are you sure you want to delete the API key for ${provider}?`)) return;
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(
        `http://localhost:3001/api/v1/configuration/apikeys?provider=${provider}`,
        {
          method: 'DELETE',
          headers: {
            'x-organization-id': orgId || '',
          },
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (data.success) {
        setSuccess('API key deleted successfully.');
        fetchData();
      } else {
        setError(data.error?.message || 'Failed to delete API key.');
      }
    } catch (err) {
      setError('An unexpected error occurred while deleting API key.');
    }
  };

  const llmProvidersList = [
    { id: 'testing', name: 'Testing Tier (Playground Only)' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'groq', name: 'Groq' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'ollama', name: 'Ollama' },
  ];

  const embeddingProvidersList = [
    { id: 'testing', name: 'Testing Tier (Playground Only)' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'cohere', name: 'Cohere' },
    { id: 'ollama', name: 'Ollama' },
  ];

  const hasLlmKey = llmProvider === 'testing' || apiKeys.some((k) => k.provider === llmProvider);
  const hasEmbeddingKey =
    embeddingProvider === 'testing' || apiKeys.some((k) => k.provider === embeddingProvider);

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}
      {success && <div className="p-4 bg-green-50 text-green-700 rounded-md">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: LLM & Retrieval Params */}
        <div className="space-y-8">
          <form
            onSubmit={handleSaveConfig}
            className="bg-white rounded-lg shadow border p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold">AI Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chat Provider (LLM)
                </label>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLlmProvider(val);
                    if (syncEmbeddingProvider) {
                      setEmbeddingProvider(val);
                    }
                  }}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                >
                  {llmProvidersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {llmProvider === 'testing' && (
                  <p className="text-xs text-yellow-600 mt-1">
                    Note: Live widgets will not function with the testing provider.
                  </p>
                )}
                {!hasLlmKey && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    Warning: Please add an API key for {llmProvider} on the right, or switch to the
                    default (Testing Tier).
                  </p>
                )}
                <div className="mt-2 flex items-center">
                  <input
                    type="checkbox"
                    id="syncEmbedding"
                    checked={syncEmbeddingProvider}
                    onChange={(e) => {
                      setSyncEmbeddingProvider(e.target.checked);
                      if (e.target.checked) setEmbeddingProvider(llmProvider);
                    }}
                    className="mr-2"
                  />
                  <label htmlFor="syncEmbedding" className="text-sm text-gray-700">
                    Use same provider for embeddings
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Embedding Provider
                </label>
                <select
                  value={embeddingProvider}
                  onChange={(e) => {
                    setEmbeddingProvider(e.target.value);
                    if (e.target.value !== llmProvider) {
                      setSyncEmbeddingProvider(false);
                    }
                  }}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                >
                  {embeddingProvidersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {!hasEmbeddingKey && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    Warning: Please add an API key for {embeddingProvider} on the right, or switch
                    to the default (Testing Tier).
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Tokens (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1024"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retrieval Top K ({topK})
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score Threshold ({scoreThreshold})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={scoreThreshold}
                  onChange={(e) => setScoreThreshold(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleSaveConfig}
            className="bg-white rounded-lg shadow border p-6 space-y-6"
          >
            <h2 className="text-xl font-semibold">Widget Behavior</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="You are a helpful assistant..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Welcome Message
              </label>
              <input
                type="text"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                placeholder="Hi there! How can I help?"
              />
            </div>
            <div className="pt-4 border-t">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Behavior'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: API Keys */}
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow border p-6 space-y-6">
            <h2 className="text-xl font-semibold">Configured API Keys</h2>
            {apiKeys.length === 0 ? (
              <p className="text-sm text-gray-500">No custom API keys configured.</p>
            ) : (
              <ul className="space-y-3">
                {apiKeys.map((key) => (
                  <li
                    key={key.provider}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded border"
                  >
                    <div>
                      <span className="font-medium capitalize">{key.provider}</span>
                      <p className="text-xs text-gray-500">Configured API Key</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-green-600 text-sm font-medium px-2 py-1 bg-green-100 rounded">
                        Active
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(key.provider)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleSaveKey} className="pt-6 border-t space-y-4">
              <h3 className="text-md font-semibold">Add / Update API Key</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={newKeyProvider}
                  onChange={(e) => setNewKeyProvider(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                >
                  {Array.from(
                    new Set(
                      [...llmProvidersList, ...embeddingProvidersList].map((p) => JSON.stringify(p))
                    )
                  )
                    .map((s) => JSON.parse(s))
                    .filter((p: any) => p.id !== 'testing')
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  required
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                  placeholder="sk-..."
                />
              </div>
              <button
                type="submit"
                disabled={savingKey}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50"
              >
                {savingKey ? 'Saving Key...' : 'Save API Key'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
