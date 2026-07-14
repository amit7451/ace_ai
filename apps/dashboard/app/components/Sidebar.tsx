'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
  const isWidgetPage = pathname.startsWith('/chat/'); // Hosted widget page

  if (isAuthPage || isWidgetPage) return null;

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      localStorage.removeItem('organizationId');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const navItems = [
    { name: 'Playground', href: '/playground' },
    { name: 'Knowledge Base', href: '/knowledge' },
    { name: 'Crawlers', href: '/crawlers' },
    { name: 'Ingestion Jobs', href: '/jobs' },
    { name: 'Members', href: '/members' },
    { name: 'Widgets', href: '/widgets' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r flex flex-col hidden sm:flex">
      <div className="p-6 border-b font-bold text-2xl text-blue-600">ION AI</div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium ${pathname === item.href ? 'bg-gray-100' : ''}`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t text-sm text-gray-500">
        <button
          onClick={handleLogout}
          className="w-full block px-4 py-2 rounded hover:bg-gray-100 text-red-600 font-medium text-center"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
