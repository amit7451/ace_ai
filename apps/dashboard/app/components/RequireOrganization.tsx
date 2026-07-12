'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function RequireOrganization({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) {
      router.push('/select-org');
    }
  }, [router, pathname]);

  if (!mounted) {
    return null; // Prevents hydration mismatch
  }

  const orgId = localStorage.getItem('organizationId');
  if (!orgId) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
