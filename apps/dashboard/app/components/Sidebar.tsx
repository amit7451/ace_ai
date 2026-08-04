'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/signup' ||
    pathname === '/institution' ||
    pathname === '/';
  const isWidgetPage = pathname.startsWith('/chat/'); // Hosted widget page

  if (isAuthPage || isWidgetPage) return null;

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      localStorage.removeItem('organizationId');
      router.push('/login');
    }
  };

  const handleDeleteOrg = async () => {
    const orgId = localStorage.getItem('organizationId');
    if (!orgId) return;

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this institution?\n\nThis action CANNOT be undone and will permanently remove all data, users, and database records from PostgreSQL.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`http://localhost:3001/api/v1/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': orgId,
        },
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem('organizationId');
        router.push('/signup?not_registered=true');
      } else {
        alert(data.error?.message || 'Failed to delete institution');
      }
    } catch (err) {
      alert('Error deleting institution');
    }
  };

  const navItems = [
    { name: 'Playground', href: '/playground' },
    { name: 'Knowledge Base', href: '/knowledge' },
    { name: 'Crawlers', href: '/crawlers' },
    { name: 'Ingestion Jobs', href: '/jobs' },
    { name: 'Members', href: '/members' },
    { name: 'Widgets', href: '/widgets' },
    { name: 'Audit Logs', href: '/audit-logs' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <aside className="w-64 bg-zinc-950 text-zinc-200 border-r border-zinc-800 flex flex-col hidden sm:flex font-mono">
      <div className="p-6 border-b border-zinc-800 font-bold text-xl tracking-[0.2em] text-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src="/modbit.webp"
            alt="ModBit Logo"
            width={24}
            height={24}
            className="w-6 h-6 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]"
          />
          <span>ModBit</span>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono font-normal">// DASHBOARD</span>
      </div>

      <nav className="flex-1 p-4 space-y-1 text-xs">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`block px-4 py-2.5 rounded-none transition-colors border ${
              pathname === item.href
                ? 'border-zinc-200 text-zinc-100 bg-zinc-900 font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800 text-xs space-y-2">
        <button
          onClick={handleDeleteOrg}
          className="w-full block px-4 py-2 text-red-400 border border-red-900/60 hover:bg-red-950/40 text-center text-[11px] uppercase tracking-wider transition-colors"
        >
          [ DELETE INSTITUTION ]
        </button>

        <button
          onClick={handleLogout}
          className="w-full block px-4 py-2 text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-900 text-center text-[11px] uppercase tracking-wider transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
