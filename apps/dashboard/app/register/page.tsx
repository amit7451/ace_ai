'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

export const dynamic = 'force-dynamic';

function RegisterForm() {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState('');

  // Step 2 Configuration Fields
  const [createdOrgId, setCreatedOrgId] = useState<string>('');
  const [tier, setTier] = useState<'TEST' | 'CUSTOM'>('TEST');
  const [llmProvider, setLlmProvider] = useState('gemini');
  const [embeddingProvider, setEmbeddingProvider] = useState('gemini');
  const [temperature, setTemperature] = useState(0.7);
  const [customApiKey, setCustomApiKey] = useState('');
  const [customEmbeddingApiKey, setCustomEmbeddingApiKey] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshAuth } = useAuth();

  useEffect(() => {
    const noOrg = searchParams.get('no_org');
    const notReg = searchParams.get('not_registered');
    const paramEmail = searchParams.get('email');

    if (noOrg === 'true') {
      setNotice('No institution attached to your account. Please register your institution below.');
    } else if (notReg === 'true') {
      setNotice(
        'No account or institution found for this email. Please register your institution below.'
      );
    }

    if (paramEmail) {
      setEmail(paramEmail);
    }
  }, [searchParams]);

  // Step 1 Submit: Register User + Institution in PostgreSQL
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, organizationName }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Registration failed.');
      }

      await refreshAuth();

      // Fetch newly created organization ID from DB
      const orgsRes = await fetch(`${API_BASE_URL}/api/v1/organizations`, {
        credentials: 'include',
      });
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        if (orgsData.success && orgsData.data && orgsData.data.length > 0) {
          const newOrg = orgsData.data[orgsData.data.length - 1];
          setCreatedOrgId(newOrg.id);
          localStorage.setItem('organizationId', newOrg.id);
        }
      }

      // Move to Step 2: Institution Configuration Screen
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit: Save Institution Model & Key Configuration and Open Dashboard
  const handleSaveConfigAndOpenDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const activeOrgId = createdOrgId || localStorage.getItem('organizationId') || '';

    try {
      // If Test tier selected, configure to use global testing tier
      const finalLlmProvider = tier === 'TEST' ? 'testing' : llmProvider;
      const finalEmbeddingProvider = tier === 'TEST' ? 'testing' : embeddingProvider;

      // 1. Update Institution Configuration
      if (activeOrgId) {
        await fetch(`${API_BASE_URL}/api/v1/configuration`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-organization-id': activeOrgId,
          },
          body: JSON.stringify({
            llmProvider: finalLlmProvider,
            embeddingProvider: finalEmbeddingProvider,
            temperature,
          }),
          credentials: 'include',
        });

        // 2. Save Custom LLM API Key if Custom tier is selected
        if (tier === 'CUSTOM' && customApiKey.trim() && finalLlmProvider !== 'ollama') {
          await fetch(`${API_BASE_URL}/api/v1/configuration/apikeys`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-organization-id': activeOrgId,
            },
            body: JSON.stringify({
              provider: finalLlmProvider,
              apiKey: customApiKey.trim(),
            }),
            credentials: 'include',
          });
        }

        // 3. Save Custom Embedding API Key if different from LLM provider
        if (
          tier === 'CUSTOM' &&
          customEmbeddingApiKey.trim() &&
          finalEmbeddingProvider !== finalLlmProvider &&
          finalEmbeddingProvider !== 'ollama'
        ) {
          await fetch(`${API_BASE_URL}/api/v1/configuration/apikeys`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-organization-id': activeOrgId,
            },
            body: JSON.stringify({
              provider: finalEmbeddingProvider,
              apiKey: customEmbeddingApiKey.trim(),
            }),
            credentials: 'include',
          });
        }
      }

      if (activeOrgId) {
        localStorage.setItem('organizationId', activeOrgId);
      }
      await refreshAuth();

      // Open Institution Dashboard
      router.push('/dashboard');
    } catch (err: any) {
      if (activeOrgId) {
        localStorage.setItem('organizationId', activeOrgId);
      }
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const llmProvidersList = [
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openai', name: 'OpenAI (GPT-4o / GPT-4)' },
    { id: 'anthropic', name: 'Anthropic Claude 3.5' },
    { id: 'groq', name: 'Groq' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'ollama', name: 'Ollama' },
  ];

  const embeddingProvidersList = [
    { id: 'gemini', name: 'Google Gemini Embeddings' },
    { id: 'openai', name: 'OpenAI text-embedding-3' },
    { id: 'cohere', name: 'Cohere Embeddings' },
    { id: 'openrouter', name: 'OpenRouter Embeddings' },
    { id: 'ollama', name: 'Ollama Embeddings' },
  ];

  return (
    <main className="relative z-10 max-w-lg w-full mx-auto px-6 pt-28 pb-16 flex-1 flex flex-col justify-center">
      {/* Header */}
      <div className="text-center mb-6 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-2">
          <Image
            src="/modbit.webp"
            alt="ModBit Logo"
            width={36}
            height={36}
            className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
          />
          <h1 className="text-3xl font-bold tracking-[0.2em] text-zinc-100 uppercase">ModBit</h1>
        </div>
        <p className="text-xs text-zinc-400 font-mono tracking-wider">
          {step === 1
            ? 'Step 1 of 2: Create Account & Institution'
            : 'Step 2 of 2: Institution AI Configuration'}
        </p>
      </div>

      {step === 1 ? (
        /* STEP 1: Registration Form */
        <div>
          <div className="flex border border-zinc-800 bg-zinc-950/80 mb-6 text-xs font-mono">
            <Link
              href="/login"
              className="flex-1 py-2.5 text-center text-zinc-500 hover:text-zinc-300 tracking-wider transition-colors"
            >
              SIGN IN
            </Link>
            <Link
              href="/signup"
              className="flex-1 py-2.5 text-center font-bold border-b-2 border-zinc-200 text-zinc-100 bg-zinc-900/60 tracking-wider"
            >
              REGISTER
            </Link>
          </div>

          <div className="modbit-card p-8 border border-zinc-800 corner-border">
            {notice && (
              <div className="mb-6 p-3 border border-amber-800/80 bg-amber-950/40 text-amber-300 text-xs font-mono tracking-wide">
                ! {notice}
              </div>
            )}

            {error && (
              <div className="mb-6 p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs font-mono tracking-wide">
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterUser} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 modbit-input text-xs"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
                  Institution Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 modbit-input text-xs"
                  placeholder="e.g. Acme University or ModBit Labs"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3.5 py-2 modbit-input text-xs"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="w-full px-3.5 py-2 pr-10 modbit-input text-xs"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors p-1 flex items-center justify-center focus:outline-none"
                  >
                    {showPassword ? (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 modbit-btn-primary text-xs tracking-[0.2em] uppercase disabled:opacity-50"
                >
                  {loading ? '[ REGISTERING... ]' : '[ NEXT: CONFIGURE KEYS & AI ]'}
                </button>
              </div>

              <div className="text-center pt-2 text-[11px] text-zinc-500 font-mono tracking-wider">
                Already registered?{' '}
                <Link href="/login" className="text-zinc-300 underline hover:text-zinc-100">
                  Sign in here
                </Link>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* STEP 2: Institution Settings Configuration Screen */
        <div className="modbit-card p-8 border border-zinc-800 corner-border space-y-6">
          <div className="space-y-1 text-center sm:text-left border-b border-zinc-800 pb-4">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">
              INSTITUTION AI CONFIGURATION
            </h2>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed">
              Configure model tiers &amp; keys for{' '}
              <strong className="text-white">{organizationName}</strong>.
            </p>
          </div>

          {error && (
            <div className="p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs font-mono tracking-wide">
              {error}
            </div>
          )}

          <form onSubmit={handleSaveConfigAndOpenDashboard} className="space-y-5">
            {/* TIER SELECTION */}
            <div>
              <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-2">
                TIER SELECTION
              </label>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setTier('TEST')}
                  className={`p-3 border text-left transition-colors ${
                    tier === 'TEST'
                      ? 'border-zinc-200 bg-zinc-900 text-white font-bold'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-bold mb-1">[ TEST TIER ]</div>
                  <div className="text-[10px] text-zinc-400">
                    Use global System Gemini keys shared for all institutions
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTier('CUSTOM')}
                  className={`p-3 border text-left transition-colors ${
                    tier === 'CUSTOM'
                      ? 'border-zinc-200 bg-zinc-900 text-white font-bold'
                      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-xs font-bold mb-1">[ CUSTOM KEYS ]</div>
                  <div className="text-[10px] text-zinc-400">
                    Configure custom OpenAI, Anthropic, Gemini, Groq, OpenRouter or Ollama API keys
                  </div>
                </button>
              </div>
            </div>

            {/* MODEL PROVIDERS */}
            {tier === 'TEST' ? (
              <div className="p-4 border border-zinc-800 bg-zinc-950/80 text-xs font-mono space-y-2">
                <div className="text-emerald-400 font-bold tracking-wider">
                  ✓ GLOBAL TESTING TIER ACTIVE
                </div>
                <p className="text-zinc-400 text-[11px]">
                  All LLM and vector embedding requests for{' '}
                  {organizationName || 'your organization'} will use the global server environment
                  configuration. (You can configure custom production keys anytime in Settings).
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                    LLM Provider (Chat)
                  </label>
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 modbit-input text-xs"
                  >
                    {llmProvidersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {llmProvider === 'ollama' ? (
                  <div className="p-3 border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-400 font-mono">
                    ✦ Ollama runs locally at http://localhost:11434 with zero key required.
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                      {llmProvider.toUpperCase()} API Key
                    </label>
                    <input
                      type="password"
                      placeholder={`Enter your ${llmProvider} API key...`}
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 modbit-input text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                    Embedding Provider
                  </label>
                  <select
                    value={embeddingProvider}
                    onChange={(e) => setEmbeddingProvider(e.target.value)}
                    className="w-full px-3.5 py-2.5 modbit-input text-xs"
                  >
                    {embeddingProvidersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {embeddingProvider !== 'ollama' && embeddingProvider !== llmProvider && (
                  <div>
                    <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                      {embeddingProvider.toUpperCase()} API Key (For Embeddings)
                    </label>
                    <input
                      type="password"
                      placeholder={`Enter your ${embeddingProvider} API key for vector embeddings...`}
                      value={customEmbeddingApiKey}
                      onChange={(e) => setCustomEmbeddingApiKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 modbit-input text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* TEMPERATURE SLIDER */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 mb-1">
                <span className="uppercase tracking-widest">Temperature</span>
                <span>{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-zinc-200 cursor-pointer"
              />
            </div>

            {/* OPEN DASHBOARD BUTTON */}
            <div className="pt-4 border-t border-zinc-800">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 modbit-btn-primary text-xs sm:text-sm tracking-[0.2em] uppercase disabled:opacity-50"
              >
                {loading ? '[ SAVING & INITIALIZING... ]' : '[ OPEN DASHBOARD ]'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen bg-[#08080a] text-zinc-200 overflow-hidden flex flex-col justify-between">
      <Dotfield />
      <Navbar />

      <Suspense
        fallback={
          <div className="min-h-screen bg-[#08080a] text-zinc-200 flex items-center justify-center font-mono text-xs tracking-widest animate-pulse">
            LOADING...
          </div>
        }
      >
        <RegisterForm />
      </Suspense>

      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-4 px-6 text-center text-[11px] text-zinc-600 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
