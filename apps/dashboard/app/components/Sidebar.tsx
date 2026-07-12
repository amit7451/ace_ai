'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
  const isWidgetPage = pathname.startsWith('/chat/'); // Hosted widget page

  if (isAuthPage || isWidgetPage) return null;

  const navItems = [
    { name: 'Playground', href: '/playground' },
    { name: 'Knowledge Base', href: '/knowledge' },
    { name: 'Crawlers', href: '/crawlers' },
    { name: 'Ingestion Jobs', href: '/jobs' },
    { name: 'Members', href: '/members' },
    { name: 'Widgets', href: '/widgets' },
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
        <Link
          href="/login"
          className="block px-4 py-2 rounded hover:bg-gray-100 text-red-600 font-medium text-center"
        >
          Sign Out
        </Link>
      </div>
    </aside>
  );
}
