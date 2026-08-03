'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function RequireOrganization({ children }: { children: React.ReactNode }) {
  const { user, institutions, loading, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (loading || !mounted) return;

    // 1. Strict Authentication Check
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // 2. Strict Institution Membership Check
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) {
      router.push('/institution');
      return;
    }

    // Check if the user is attached to this institution
    if (institutions.length > 0) {
      const isMember = institutions.some((inst) => inst.id === orgId);
      if (!isMember) {
        localStorage.removeItem('organizationId');
        router.push('/institution?error=unauthorized');
      }
    }
  }, [loading, mounted, isAuthenticated, institutions, router, pathname]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-[#08080a] text-zinc-200 flex items-center justify-center font-mono text-xs tracking-widest animate-pulse">
        VERIFYING AUTHENTICATION & INSTITUTION CLEARANCE...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
  if (!orgId) {
    return null;
  }

  return <>{children}</>;
}
