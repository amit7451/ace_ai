'use client';

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { DeleteOrganizationModal } from '../../components/DeleteOrganizationModal';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const { institutions, refreshAuth } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form State
  const [llmProvider, setLlmProvider] = useState('testing');
  const [llmModel, setLlmModel] = useState('');
  const [availableLlmModels, setAvailableLlmModels] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [loadingLlmModels, setLoadingLlmModels] = useState(false);
  const [isLlmModelsLive, setIsLlmModelsLive] = useState(false);

  const [embeddingProvider, setEmbeddingProvider] = useState('testing');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loadingEmbeddingModels, setLoadingEmbeddingModels] = useState(false);
  const [isEmbeddingModelsLive, setIsEmbeddingModelsLive] = useState(false);

  const [syncEmbeddingProvider, setSyncEmbeddingProvider] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | ''>('');
  const [topK, setTopK] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Institution Details State
  const [institutionName, setInstitutionName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportWebsite, setSupportWebsite] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [introductoryMessage, setIntroductoryMessage] = useState('');

  // API Key State
  const [newKeyProvider, setNewKeyProvider] = useState('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

  const initialFetchDone = useRef(false);

  const fetchLlmModels = async (provider: string, currentModel?: string) => {
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;
    setLoadingLlmModels(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/configuration/models?provider=${provider}&type=llm`,
        {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (json.success && json.data?.models) {
        setAvailableLlmModels(json.data.models);
        setIsLlmModelsLive(Boolean(json.data.live));
        const found = json.data.models.some((m: any) => m.id === (currentModel || llmModel));
        if (!found && json.data.models.length > 0) {
          setLlmModel(json.data.models[0].id);
        } else if (currentModel) {
          setLlmModel(currentModel);
        }
      }
    } catch (err) {
      console.error('Failed to fetch LLM models', err);
    } finally {
      setLoadingLlmModels(false);
    }
  };

  const fetchEmbeddingModels = async (provider: string, currentModel?: string) => {
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;
    setLoadingEmbeddingModels(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/configuration/models?provider=${provider}&type=embedding`,
        {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }
      );
      const json = await res.json();
      if (json.success && json.data?.models) {
        setAvailableEmbeddingModels(json.data.models);
        setIsEmbeddingModelsLive(Boolean(json.data.live));
        const found = json.data.models.some((m: any) => m.id === (currentModel || embeddingModel));
        if (!found && json.data.models.length > 0) {
          setEmbeddingModel(json.data.models[0].id);
        } else if (currentModel) {
          setEmbeddingModel(currentModel);
        }
      }
    } catch (err) {
      console.error('Failed to fetch embedding models', err);
    } finally {
      setLoadingEmbeddingModels(false);
    }
  };

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
        fetch(`${API_BASE_URL}/api/v1/configuration`, {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
        fetch(`${API_BASE_URL}/api/v1/configuration/apikeys`, {
          headers: { 'x-organization-id': orgId },
          credentials: 'include',
        }),
      ]);

      const configData = await configRes.json();
      const keysData = await keysRes.json();

      if (configData.success) {
        const c = configData.data;
        setConfig(c);
        const lProv = c.llmProvider || 'testing';
        const eProv = c.embeddingProvider || 'testing';
        setLlmProvider(lProv);
        setLlmModel(c.llmModel || '');
        setEmbeddingProvider(eProv);
        setEmbeddingModel(c.embeddingModel || '');
        setSyncEmbeddingProvider(lProv === eProv);
        setTemperature(c.temperature ?? 0.7);
        setMaxTokens(c.maxTokens || '');
        setTopK(c.topK ?? 5);
        setScoreThreshold(c.scoreThreshold ?? 0.7);
        setSystemPrompt(c.systemPrompt || '');
        setWelcomeMessage(c.welcomeMessage || '');
        setInstitutionName(c.institutionName || '');
        setSupportEmail(c.supportEmail || '');
        setSupportWebsite(c.supportWebsite || '');
        setSupportPhone(c.supportPhone || '');
        setIntroductoryMessage(c.introductoryMessage || '');

        fetchLlmModels(lProv, c.llmModel);
        fetchEmbeddingModels(eProv, c.embeddingModel);
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

    // Case 2 validation: Verify selected providers have configured API keys
    const missingLlm = !hasLlmKey;
    const missingEmbedding = !hasEmbeddingKey;

    if (missingLlm || missingEmbedding) {
      const missingDetails: string[] = [];
      if (missingLlm) missingDetails.push(`Chat Provider (${llmProvider.toUpperCase()})`);
      if (missingEmbedding)
        missingDetails.push(`Embedding Provider (${embeddingProvider.toUpperCase()})`);

      setError(
        `Cannot save configuration: Missing API key for ${missingDetails.join(
          ' and '
        )}. Please add the required API key(s) in the Configured API Keys section on the right before activating, or select Testing Tier.`
      );
      setSaving(false);
      return;
    }

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_BASE_URL}/api/v1/configuration`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          llmProvider,
          llmModel: llmModel || undefined,
          embeddingProvider,
          embeddingModel: embeddingModel || undefined,
          temperature: Number(temperature),
          maxTokens: maxTokens === '' ? undefined : Number(maxTokens),
          topK: Number(topK),
          scoreThreshold: Number(scoreThreshold),
          systemPrompt,
          welcomeMessage,
          institutionName: institutionName || undefined,
          supportEmail: supportEmail || undefined,
          supportWebsite: supportWebsite || undefined,
          supportPhone: supportPhone || undefined,
          introductoryMessage: introductoryMessage || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Configuration saved successfully.');
        setIsConfigSaved(true);
        setTimeout(() => setIsConfigSaved(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to save configuration.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
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
      const res = await fetch(`${API_BASE_URL}/api/v1/configuration/apikeys`, {
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
        const shifted = data.data;
        const provLabel =
          allKeyProviders.find((p) => p.id === newKeyProvider)?.name ||
          newKeyProvider.toUpperCase();
        setSuccess(
          `✓ API key for ${provLabel} saved successfully! Active providers automatically shifted to ${
            shifted?.shiftedLlmProvider ? `Chat (${shifted.shiftedLlmProvider.toUpperCase()})` : ''
          }${shifted?.shiftedEmbeddingProvider ? ` and Embedding (${shifted.shiftedEmbeddingProvider.toUpperCase()})` : ''}.`
        );
        setIsKeySaved(true);
        setTimeout(() => setIsKeySaved(false), 3000);
        setNewKeyValue('');
        await fetchData();
      } else {
        setError(data.error?.message || 'Failed to save API key.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while saving API key.');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (
      !window.confirm(`Are you sure you want to delete the API key for ${provider.toUpperCase()}?`)
    )
      return;
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_BASE_URL}/api/v1/configuration/apikeys?provider=${provider}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(
          `✓ API key for ${provider.toUpperCase()} deleted. Active provider reverted safely.`
        );
        await fetchData();
      } else {
        setError(data.error?.message || 'Failed to delete API key.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred while deleting API key.');
    }
  };

  const handleDeleteInstitutionAccount = () => {
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;
    setShowDeleteModal(true);
  };

  const llmProvidersList = [
    { id: 'testing', name: 'Testing Tier (Playground Only - System Key)' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'groq', name: 'Groq (Ultra-Fast)' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'ollama', name: 'Ollama (Local)' },
  ];

  const embeddingProvidersList = [
    { id: 'testing', name: 'Testing Tier (Playground Only - System Key)' },
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openai', name: 'OpenAI' },
    { id: 'cohere', name: 'Cohere' },
    { id: 'openrouter', name: 'OpenRouter (Embeddings)' },
    { id: 'ollama', name: 'Ollama (Local)' },
  ];

  const allKeyProviders = [
    { id: 'openai', name: 'OpenAI (Chat & Embeddings)' },
    { id: 'gemini', name: 'Google Gemini (Chat & Embeddings)' },
    { id: 'anthropic', name: 'Anthropic (Chat Only)' },
    { id: 'groq', name: 'Groq (Ultra-Fast Chat Only)' },
    { id: 'openrouter', name: 'OpenRouter (Multi-Model Chat & Embeddings)' },
    { id: 'cohere', name: 'Cohere (Embeddings Only)' },
  ];

  const hasLlmKey =
    llmProvider === 'testing' ||
    llmProvider === 'ollama' ||
    apiKeys.some((k) => k.provider === llmProvider);

  const hasEmbeddingKey =
    embeddingProvider === 'testing' ||
    embeddingProvider === 'ollama' ||
    apiKeys.some((k) => k.provider === embeddingProvider);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto font-mono text-xs text-zinc-500 animate-pulse">
        LOADING SETTINGS...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            ORGANIZATION SETTINGS
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure LLM models, vector retrieval thresholds, and custom API keys
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs">
          ! {error}
        </div>
      )}
      {success && (
        <div className="p-3 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs">
          ✓ {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: LLM & Retrieval Params */}
        <div className="space-y-6">
          <form
            onSubmit={handleSaveConfig}
            className="modbit-card p-6 border border-zinc-800 corner-border space-y-6"
          >
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider border-b border-zinc-800 pb-3">
              AI MODEL CONFIGURATION
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Chat Provider (LLM)
                </label>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLlmProvider(val);
                    fetchLlmModels(val);
                    if (syncEmbeddingProvider) {
                      const canSync = embeddingProvidersList.some((p) => p.id === val);
                      if (canSync) {
                        setEmbeddingProvider(val);
                        fetchEmbeddingModels(val);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                >
                  {llmProvidersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {llmProvider === 'testing' ? (
                  <p className="text-[10px] text-emerald-400 mt-1">
                    ✓ Testing Tier active: Powered by global system keys (Playground access
                    enabled).
                  </p>
                ) : !hasLlmKey ? (
                  <div className="p-2.5 mt-2 border border-amber-900/60 bg-amber-950/30 text-amber-300 text-[11px] font-mono tracking-wide flex items-start gap-2">
                    <span>⚠️</span>
                    <div>
                      <strong>API Key Missing:</strong> You selected{' '}
                      <strong>{llmProvider.toUpperCase()}</strong> for Chat, but no API key is
                      configured. Please add your key in the <em>Configured API Keys</em> section on
                      the right, or switch to <strong>Testing Tier</strong>.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* DYNAMIC REAL-TIME CHAT MODEL SELECTION - Only visible when custom provider selected and API key configured */}
              {llmProvider !== 'testing' && hasLlmKey && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] tracking-widest text-zinc-400 uppercase">
                      Chat Model ({llmProvider.toUpperCase()})
                    </label>
                    {loadingLlmModels ? (
                      <span className="text-[10px] text-zinc-500 animate-pulse">
                        FETCHING MODELS...
                      </span>
                    ) : isLlmModelsLive ? (
                      <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                        ● LIVE API MODELS
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        ● DEFAULT LIST
                      </span>
                    )}
                  </div>
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    disabled={loadingLlmModels && availableLlmModels.length === 0}
                    className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                  >
                    {availableLlmModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Embedding Provider
                </label>
                <select
                  value={embeddingProvider}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmbeddingProvider(val);
                    fetchEmbeddingModels(val);
                    if (val !== llmProvider) {
                      setSyncEmbeddingProvider(false);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                >
                  {embeddingProvidersList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {embeddingProvider === 'testing' ? (
                  <p className="text-[10px] text-emerald-400 mt-1">
                    ✓ Testing Tier active: Powered by global system keys for vector embeddings.
                  </p>
                ) : !hasEmbeddingKey ? (
                  <div className="p-2.5 mt-2 border border-amber-900/60 bg-amber-950/30 text-amber-300 text-[11px] font-mono tracking-wide flex items-start gap-2">
                    <span>⚠️</span>
                    <div>
                      <strong>API Key Missing:</strong> You selected{' '}
                      <strong>{embeddingProvider.toUpperCase()}</strong> for Embeddings, but no API
                      key is configured. Please add your key in the <em>Configured API Keys</em>{' '}
                      section on the right, or switch to <strong>Testing Tier</strong>.
                    </div>
                  </div>
                ) : null}
              </div>

              {/* DYNAMIC REAL-TIME EMBEDDING MODEL SELECTION - Only visible when custom provider selected and API key configured */}
              {embeddingProvider !== 'testing' && hasEmbeddingKey && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[11px] tracking-widest text-zinc-400 uppercase">
                      Embedding Model ({embeddingProvider.toUpperCase()})
                    </label>
                    {loadingEmbeddingModels ? (
                      <span className="text-[10px] text-zinc-500 animate-pulse">
                        FETCHING MODELS...
                      </span>
                    ) : isEmbeddingModelsLive ? (
                      <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                        ● LIVE API MODELS
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
                        ● DEFAULT LIST
                      </span>
                    )}
                  </div>
                  <select
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    disabled={loadingEmbeddingModels && availableEmbeddingModels.length === 0}
                    className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                  >
                    {availableEmbeddingModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Temperature ({temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Max Tokens (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1024"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Retrieval Top K ({topK})
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full accent-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Score Threshold ({scoreThreshold})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={scoreThreshold}
                  onChange={(e) => setScoreThreshold(parseFloat(e.target.value))}
                  className="w-full accent-zinc-200"
                />
              </div>

              {/* Institution Details Card Link */}
              <div className="pt-4 border-t border-zinc-800 space-y-3">
                <div className="p-4 border border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      INSTITUTION DETAILS & SUPPORT CONTACT
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Configure support emails, phone numbers, portal URLs, and custom chatbot
                      greetings on a dedicated page.
                    </p>
                  </div>
                  <a
                    href="/institution-details"
                    className="px-4 py-2 modbit-btn-secondary text-[11px] uppercase tracking-wider font-bold whitespace-nowrap"
                  >
                    [ MANAGE DETAILS ]
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-zinc-800">
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2.5 text-xs uppercase tracking-wider font-bold transition-all duration-300 ${
                  isConfigSaved
                    ? 'bg-emerald-600 border border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-default'
                    : 'modbit-btn-primary disabled:opacity-50'
                }`}
              >
                {saving
                  ? '[ SAVING... ]'
                  : isConfigSaved
                    ? '✓ [ CONFIGURATION SAVED ]'
                    : '[ SAVE CONFIGURATION ]'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: API Keys & Danger Zone */}
        <div className="space-y-6">
          <div
            id="api-keys"
            className="modbit-card p-6 border border-zinc-800 corner-border space-y-6 transition-all duration-500 target:border-emerald-500 target:ring-2 target:ring-emerald-500/50"
          >
            <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider border-b border-zinc-800 pb-3 flex items-center justify-between">
              <span>CONFIGURED API KEYS</span>
              <span className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">
                REQUIRED FOR LIVE WIDGETS
              </span>
            </h2>
            {apiKeys.length === 0 ? (
              <p className="text-xs text-zinc-500">No custom API keys configured yet.</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.provider}
                    className="flex justify-between items-center p-3 bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-200 uppercase">{key.provider}</span>
                      <p className="text-[10px] text-zinc-500">Encrypted API Key</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">
                        ACTIVE
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(key.provider)}
                        className="text-red-400 hover:text-red-300 underline text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveKey} className="pt-4 border-t border-zinc-800 space-y-4">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Add / Update Provider Key
              </h3>
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  Provider
                </label>
                <select
                  value={newKeyProvider}
                  onChange={(e) => setNewKeyProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                >
                  {allKeyProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                  API Key Secret
                </label>
                <input
                  type="password"
                  required
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs"
                  placeholder="sk-..."
                />
              </div>
              <button
                type="submit"
                disabled={savingKey}
                className={`w-full py-2.5 text-xs uppercase tracking-wider font-bold transition-all duration-300 ${
                  isKeySaved
                    ? 'bg-emerald-600 border border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-default'
                    : 'modbit-btn-secondary disabled:opacity-50'
                }`}
              >
                {savingKey
                  ? '[ SAVING KEY... ]'
                  : isKeySaved
                    ? '✓ [ API KEY SAVED ]'
                    : '[ SAVE API KEY ]'}
              </button>
            </form>
          </div>

          {/* Danger Zone: Delete Institution Account */}
          <div className="modbit-card p-6 border border-red-900/60 bg-red-950/20 corner-border space-y-4">
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider border-b border-red-900/40 pb-2">
              DANGER ZONE
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Permanently delete this institution workspace and all associated knowledge bases,
              widgets, members, and database records.
            </p>
            <button
              type="button"
              onClick={handleDeleteInstitutionAccount}
              className="w-full py-2.5 text-xs text-red-400 hover:text-red-300 border border-red-900/80 hover:bg-red-950/60 uppercase tracking-wider transition-colors"
            >
              [ DELETE INSTITUTION WORKSPACE ]
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteOrganizationModal
          isOpen={showDeleteModal}
          organizationId={
            typeof window !== 'undefined' ? localStorage.getItem('organizationId') || '' : ''
          }
          organizationName={
            institutions?.find(
              (i) =>
                i.id ===
                (typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null)
            )?.name ||
            institutionName ||
            'Workspace'
          }
          onClose={() => setShowDeleteModal(false)}
          onSuccess={async () => {
            setShowDeleteModal(false);
            await refreshAuth();
            window.location.href = '/institution';
          }}
        />
      )}
    </div>
  );
}
