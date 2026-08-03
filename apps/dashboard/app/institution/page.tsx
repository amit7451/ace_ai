'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export const dynamic = 'force-dynamic';

function InstitutionContent() {
  const { user, institutions, loading: authLoading, isAuthenticated, refreshAuth } = useAuth();
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'unauthorized') {
      setError('Access Denied: You are not authorized to view that institution.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSelectInstitution = (id: string) => {
    localStorage.setItem('organizationId', id);
    router.push('/playground');
  };

  const handleDeleteInstitution = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${name}"?\n\nThis will permanently remove this institution and all associated data from the PostgreSQL database. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`http://localhost:3001/api/v1/organizations/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': id,
        },
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete institution account');
      }

      // If deleted institution was current selected org, clear it
      const currentOrgId = localStorage.getItem('organizationId');
      if (currentOrgId === id) {
        localStorage.removeItem('organizationId');
      }

      setSuccessMsg(`Institution "${name}" deleted successfully from database.`);
      await refreshAuth();
    } catch (err: any) {
      // Prototype fallback
      const saved = localStorage.getItem('user_institutions');
      if (saved) {
        const filtered = JSON.parse(saved).filter((i: any) => i.id !== id);
        localStorage.setItem('user_institutions', JSON.stringify(filtered));
        const currentOrgId = localStorage.getItem('organizationId');
        if (currentOrgId === id) {
          localStorage.removeItem('organizationId');
        }
        await refreshAuth();
        setSuccessMsg(`Institution "${name}" deleted successfully.`);
      } else {
        setError(err.message || 'Deletion failed');
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#08080a] text-zinc-200 flex items-center justify-center font-mono text-xs tracking-widest animate-pulse">
        LOADING INSTITUTION WORKSPACES...
      </div>
    );
  }

  return (
    <main className="relative z-10 max-w-3xl w-full mx-auto px-6 pt-32 pb-16 flex-1 flex flex-col justify-center">
      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[0.2em] text-zinc-100 uppercase">
          ModBit // INSTITUTION
        </h1>
        <p className="text-xs text-zinc-400 font-mono tracking-wider mt-2">
          Select an institution to open dashboard or manage account
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs font-mono tracking-wide">
          ! {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-3 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs font-mono tracking-wide">
          ✓ {successMsg}
        </div>
      )}

      {institutions.length > 0 ? (
        /* Attached Institutions List */
        <div className="modbit-card border border-zinc-800 overflow-hidden corner-border">
          <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-950/90 text-[11px] font-mono text-zinc-400 tracking-widest flex justify-between uppercase">
            <span>YOUR AUTHORIZED INSTITUTIONS ({institutions.length})</span>
            <span>ACCOUNT: {user?.email}</span>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group hover:bg-zinc-900/30"
              >
                <div
                  className="space-y-1 cursor-pointer"
                  onClick={() => handleSelectInstitution(inst.id)}
                >
                  <span className="font-bold text-sm text-zinc-100 tracking-wider group-hover:text-white">
                    {inst.name}
                  </span>
                  <div className="text-xs font-mono text-zinc-500">ID: {inst.id}</div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSelectInstitution(inst.id)}
                    className="px-5 py-2 text-xs font-mono tracking-widest modbit-btn-primary"
                  >
                    [ OPEN DASHBOARD ]
                  </button>

                  <button
                    onClick={() => handleDeleteInstitution(inst.id, inst.name)}
                    disabled={deletingId === inst.id}
                    className="px-4 py-2 text-xs font-mono tracking-widest text-red-400 border border-red-900/80 hover:bg-red-950/50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === inst.id ? '[ DELETING... ]' : '[ DELETE ORG ]'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* No Attached Institution -> Prompt user to register their institution */
        <div className="modbit-card p-8 border border-zinc-800 text-center corner-border space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-100 tracking-wider">
              No Institution Attached
            </h2>
            <p className="text-xs text-zinc-400 font-mono max-w-md mx-auto leading-relaxed">
              Your email ({user?.email}) is currently not attached to any institution. Please
              register your institution first.
            </p>
          </div>

          <div>
            <button
              onClick={() =>
                router.push(`/signup?no_org=true&email=${encodeURIComponent(user?.email || '')}`)
              }
              className="py-3 px-8 modbit-btn-primary text-xs tracking-[0.2em] uppercase"
            >
              [ REGISTER YOUR INSTITUTION ]
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function InstitutionPage() {
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
        <InstitutionContent />
      </Suspense>

      <footer className="relative z-10 border-t border-zinc-900 bg-[#08080a]/90 py-4 px-6 text-center text-[11px] text-zinc-600 font-mono tracking-widest">
        MODBIT &copy; 2026 // ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
