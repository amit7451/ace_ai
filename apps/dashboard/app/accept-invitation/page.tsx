'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Dotfield from '../components/Dotfield';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

export const dynamic = 'force-dynamic';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  expiresAt: string;
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { user, isAuthenticated, loading: authLoading, refreshAuth } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invitation token was provided.');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/invitations/${token}`);
        const data = await res.json();
        if (data.success && data.data) {
          setInvitation(data.data);
        } else {
          setError(data.error?.message || data.error || 'Invalid or expired invitation token');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify invitation');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Successfully joined ${data.data?.organizationName || 'the workspace'}!`);
        if (data.data?.organizationId) {
          localStorage.setItem('organizationId', data.data.organizationId);
        }
        await refreshAuth();
        setTimeout(() => {
          router.push('/playground');
        }, 1200);
      } else {
        throw new Error(data.error?.message || data.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-zinc-100 flex flex-col font-mono selection:bg-zinc-800">
      <Navbar />
      <Dotfield />

      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg modbit-card p-8 border border-zinc-800 corner-border bg-zinc-950/80 backdrop-blur-md shadow-2xl space-y-6">
          <div className="border-b border-zinc-800 pb-4 text-center">
            <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-bold block mb-1">
              TEAM INVITATION
            </span>
            <h1 className="text-xl font-bold tracking-widest text-zinc-100 uppercase">
              JOIN WORKSPACE
            </h1>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500 animate-pulse tracking-widest">
              [ VERIFYING INVITATION TOKEN... ]
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="p-4 border border-red-900/60 bg-red-950/30 text-red-400 text-xs">
                {error}
              </div>
              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="px-6 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider inline-block"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs">
                ✓ {success}
              </div>
              <p className="text-xs text-zinc-400">Redirecting to your workspace...</p>
            </div>
          ) : invitation ? (
            <div className="space-y-6">
              <div className="space-y-3 bg-zinc-900/40 p-4 border border-zinc-800/80 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500 uppercase">Workspace:</span>
                  <span className="font-bold text-zinc-100 text-sm">
                    {invitation.organizationName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500 uppercase">Invited By:</span>
                  <span className="text-zinc-300">{invitation.inviterName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-800/60">
                  <span className="text-zinc-500 uppercase">Assigned Role:</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold border border-cyan-800/80 bg-cyan-950/40 text-cyan-300 uppercase tracking-wider">
                    {invitation.role}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-500 uppercase">Expires:</span>
                  <span className="text-zinc-400">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {authLoading ? (
                <div className="text-center text-xs text-zinc-500 animate-pulse">
                  Checking authentication...
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-3">
                  <div className="text-[11px] text-zinc-400 text-center">
                    Signed in as <span className="text-zinc-200 font-bold">{user?.email}</span>
                  </div>
                  <button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full py-3 modbit-btn-primary text-xs uppercase tracking-widest font-bold disabled:opacity-50"
                  >
                    {accepting ? '[ ACCEPTING... ]' : '[ ACCEPT INVITATION & JOIN ]'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] text-zinc-400 text-center">
                    Please log in or create an account to accept this invitation.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href={`/login?redirect=/accept-invitation?token=${token}`}
                      className="flex-1 py-2.5 modbit-btn-primary text-xs text-center uppercase tracking-wider"
                    >
                      Log In
                    </Link>
                    <Link
                      href={`/signup?redirect=/accept-invitation?token=${token}`}
                      className="flex-1 py-2.5 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-500 text-xs text-center uppercase tracking-wider transition-colors"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-xs font-mono text-zinc-500">
          LOADING...
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
