'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

export default function Sidebar() {
  const pathname = usePathname();
  const { institutions, exitInstitution, logout } = useAuth();
  const [orgName, setOrgName] = useState<string>('');

  useEffect(() => {
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
    if (!orgId) return;

    if (institutions && institutions.length > 0) {
      const current = institutions.find((i) => i.id === orgId);
      if (current) {
        setOrgName(current.name);
        return;
      }
    }

    // Fallback: Fetch directly from API if institutions list hasn't populated yet
    fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}`, {
      headers: { 'x-organization-id': orgId },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.name) {
          setOrgName(data.data.name);
        }
      })
      .catch(() => {});
  }, [institutions]);

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/signup' ||
    pathname === '/institution' ||
    pathname === '/profile' ||
    pathname === '/';
  const isWidgetPage = pathname.startsWith('/chat/');

  if (isAuthPage || isWidgetPage) return null;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Playground', href: '/playground' },
    { name: 'Knowledge Base', href: '/knowledge' },
    { name: 'Crawlers', href: '/crawlers' },
    { name: 'Ingestion Jobs', href: '/jobs' },
    { name: 'Members', href: '/members' },
    { name: 'Widgets', href: '/widgets' },
    { name: 'Audit Logs', href: '/audit-logs' },
    { name: 'Settings', href: '/settings' },
    { name: 'Institution Details', href: '/institution-details' },
  ];

  return (
    <aside className="w-64 bg-[#0c0c0f] text-zinc-200 border-r border-zinc-800 flex flex-col hidden sm:flex font-mono select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800 space-y-3">
        <Link href="/dashboard" className="flex items-center justify-between group">
          <div className="flex items-center gap-2.5">
            <Image
              src="/modbit.webp"
              alt="ModBit Logo"
              width={24}
              height={24}
              priority
              className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-200"
            />
            <span className="font-bold text-xl tracking-[0.2em] text-zinc-100 uppercase">
              ModBit
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-normal">{'// DASH'}</span>
        </Link>

        {/* Organization Name Display */}
        <div className="pt-2.5 border-t border-zinc-800/60 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span
              className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider truncate"
              title={orgName || 'Active Organization'}
            >
              {orgName || 'ORGANIZATION'}
            </span>
          </div>
          <span className="text-[9px] text-zinc-500 border border-zinc-800 px-1 py-0.5 rounded bg-zinc-950/60 shrink-0 uppercase tracking-widest font-mono">
            ORG
          </span>
        </div>
      </div>

      {/* Nav Menu Items */}
      <nav className="flex-1 p-4 space-y-1.5 text-xs">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' &&
              item.href !== '/playground' &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`block px-4 py-2.5 text-xs tracking-wider transition-all border ${
                isActive
                  ? 'border-zinc-500 text-zinc-100 bg-zinc-900/80 font-bold shadow-sm'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 hover:border-zinc-800'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer Bottom Actions */}
      <div className="p-4 border-t border-zinc-800 text-xs space-y-2">
        <button
          onClick={exitInstitution}
          className="w-full block px-4 py-2 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-600 bg-zinc-950 hover:bg-zinc-900 text-center text-[11px] font-bold uppercase tracking-wider transition-colors"
        >
          [ EXIT INSTITUTION ]
        </button>

        <button
          onClick={logout}
          className="w-full block px-4 py-1.5 text-zinc-500 hover:text-zinc-300 text-center text-[10px] uppercase tracking-wider transition-colors"
        >
          Account Sign Out
        </button>
      </div>
    </aside>
  );
}
