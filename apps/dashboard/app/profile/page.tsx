'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const {
    user,
    institutions,
    updateProfile,
    logout,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const activeOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const success = await updateProfile({ name });
      if (success) {
        setSaveSuccess('Profile name updated successfully.');
      } else {
        setSaveError('Failed to update profile name.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08080a] text-zinc-200 flex items-center justify-center font-mono text-xs tracking-widest animate-pulse">
        LOADING PROFILE...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#08080a] text-zinc-200 overflow-x-hidden flex flex-col justify-between font-mono">
      <Dotfield />
      <Navbar />

      <main className="relative z-10 max-w-3xl w-full mx-auto px-6 pt-28 pb-16 flex-1 flex flex-col justify-center">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/modbit.webp"
              alt="ModBit Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-[0.2em] text-zinc-100 uppercase">
                USER PROFILE
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5 tracking-wider">
                Manage your account display name and workspace access
              </p>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 p-3 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs tracking-wide">
            ✓ {saveSuccess}
          </div>
        )}

        {saveError && (
          <div className="mb-6 p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs tracking-wide">
            ! {saveError}
          </div>
        )}

        <div className="space-y-6">
          {/* Card 1: Account Information */}
          <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-6">
            <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">
                ACCOUNT DETAILS
              </h2>
              <span className="text-[10px] text-zinc-500">
                // USER ID: {user?.id?.slice(0, 10)}...
              </span>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Full Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 modbit-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2.5 modbit-input text-xs opacity-60 bg-zinc-950 cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 modbit-btn-primary text-xs tracking-[0.15em] uppercase disabled:opacity-50"
                >
                  {saving ? '[ SAVING... ]' : '[ SAVE CHANGES ]'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Workspaces / Institutions */}
          <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-4">
            <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">
                AUTHORIZED WORKSPACES ({institutions.length})
              </h2>
              <button
                onClick={() => router.push('/institution')}
                className="px-4 py-1.5 modbit-btn-secondary text-xs uppercase tracking-wider"
              >
                [ SELECT INSTITUTION ]
              </button>
            </div>

            <div className="space-y-3">
              {institutions.map((inst) => {
                const isActive = inst.id === activeOrgId;
                return (
                  <div
                    key={inst.id}
                    className={`p-4 border transition-colors flex items-center justify-between gap-4 ${
                      isActive
                        ? 'border-zinc-600 bg-zinc-900/60'
                        : 'border-zinc-800/80 bg-zinc-950/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-100">{inst.name}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 border border-emerald-800/80 bg-emerald-950/50 text-emerald-400 font-bold uppercase">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">ID: {inst.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Account Sign Out */}
          <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">
                  ACCOUNT SIGN OUT
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sign out of your account on this device
                </p>
              </div>

              <button
                onClick={() => logout()}
                className="px-5 py-2 text-xs font-mono text-red-400 hover:text-red-300 border border-red-900/60 hover:bg-red-950/40 tracking-wider uppercase transition-colors"
              >
                [ SIGN OUT ]
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-4 px-6 text-center text-[11px] text-zinc-600 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
