'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { DeleteOrganizationModal } from '../components/DeleteOrganizationModal';
import { CreateOrganizationModal } from '../components/CreateOrganizationModal';

export const dynamic = 'force-dynamic';

function InstitutionContent() {
  const { user, institutions, loading: authLoading, isAuthenticated, refreshAuth } = useAuth();
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    const isMember = institutions.some((inst) => inst.id === id);
    if (!isMember) {
      setError('Access Denied: You are not authorized to access that institution workspace.');
      return;
    }
    localStorage.setItem('organizationId', id);
    router.push('/playground');
  };

  const handleCreateSuccess = async (newOrg: { id: string; name: string; slug?: string }) => {
    setIsCreateOpen(false);
    setSuccessMsg(`Institution "${newOrg.name}" created successfully.`);
    await refreshAuth();
    localStorage.setItem('organizationId', newOrg.id);
    router.push('/playground');
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/modbit.webp"
              alt="ModBit Logo"
              width={36}
              height={36}
              priority
              className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]"
            />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[0.2em] text-zinc-100 uppercase">
              ModBit // INSTITUTION
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-mono tracking-wider mt-2">
            Select an institution workspace or create a new one
          </p>
        </div>

        {institutions.length > 0 && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 modbit-btn-secondary text-xs uppercase tracking-wider font-mono self-start sm:self-auto"
          >
            [ + NEW INSTITUTION ]
          </button>
        )}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: inst.id, name: inst.name });
                    }}
                    className="px-3.5 py-2 text-xs font-mono tracking-wider text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-700 bg-red-950/20 hover:bg-red-950/60 transition-colors uppercase"
                    title="Delete institution workspace"
                  >
                    [ DELETE ]
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* No Attached Institution -> Prompt user to create their first institution */
        <div className="modbit-card p-8 border border-zinc-800 text-center corner-border space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-100 tracking-wider">
              No Institution Attached
            </h2>
            <p className="text-xs text-zinc-400 font-mono max-w-md mx-auto leading-relaxed">
              Your account ({user?.email}) is not currently attached to any active institution
              workspace. Create an institution below to get started.
            </p>
          </div>

          <div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="py-3 px-8 modbit-btn-primary text-xs tracking-[0.2em] uppercase"
            >
              [ + CREATE INSTITUTION ]
            </button>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <CreateOrganizationModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {deleteTarget && (
        <DeleteOrganizationModal
          isOpen={Boolean(deleteTarget)}
          organizationId={deleteTarget.id}
          organizationName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onSuccess={async () => {
            const deletedName = deleteTarget.name;
            setDeleteTarget(null);
            setSuccessMsg(`Institution "${deletedName}" deleted successfully.`);
            await refreshAuth();
          }}
        />
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
