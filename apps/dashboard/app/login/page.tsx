'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { refreshAuth } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Authenticate with API
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Invalid email or password.');
      }

      // Refresh global auth state and navigate to institution workspace selection
      await refreshAuth();
      router.push('/institution');
    } catch (err: any) {
      setError(
        err.message ||
          'Invalid email or password. If your account was deleted, please register below.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#08080a] text-zinc-200 overflow-hidden flex flex-col justify-between">
      <Dotfield />
      <Navbar />

      <main className="relative z-10 max-w-md w-full mx-auto px-6 pt-32 pb-16 flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <Image
              src="/modbit.webp"
              alt="ModBit Logo"
              width={36}
              height={36}
              priority
              className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            />
            <h1 className="text-3xl font-bold tracking-[0.2em] text-zinc-100 uppercase">ModBit</h1>
          </div>
          <p className="text-xs text-zinc-400 font-mono tracking-wider">Sign in to your account</p>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className="flex border border-zinc-800 bg-zinc-950/80 mb-6 text-xs font-mono">
          <Link
            href="/login"
            className="flex-1 py-2.5 text-center font-bold border-b-2 border-zinc-200 text-zinc-100 bg-zinc-900/60 tracking-wider"
          >
            SIGN IN
          </Link>
          <Link
            href="/signup"
            className="flex-1 py-2.5 text-center text-zinc-500 hover:text-zinc-300 tracking-wider transition-colors"
          >
            REGISTER
          </Link>
        </div>

        {/* Card Form */}
        <div className="modbit-card p-8 border border-zinc-800 corner-border">
          {error && (
            <div className="mb-6 p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs font-mono tracking-wide">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-3.5 py-2.5 modbit-input text-xs"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 modbit-input text-xs"
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
                {loading ? '[ SIGNING IN... ]' : '[ SIGN IN ]'}
              </button>
            </div>

            <div className="text-center pt-2 text-[11px] text-zinc-500 font-mono tracking-wider">
              Need an account?{' '}
              <Link href="/signup" className="text-zinc-300 underline hover:text-zinc-100">
                Register here
              </Link>
            </div>
          </form>
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-4 px-6 text-center text-[11px] text-zinc-600 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
