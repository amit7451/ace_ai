'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Sidebar() {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';
  const isWidgetPage = pathname.startsWith('/chat/'); // Hosted widget page

  if (isAuthPage || isWidgetPage) return null;

  return (
    <aside className="w-64 bg-white border-r flex flex-col hidden sm:flex">
      <div className="p-6 border-b font-bold text-2xl text-blue-600">ION AI</div>
      <nav className="flex-1 p-4 space-y-1">
        <Link
          href="/playground"
          className="block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
        >
          Chat Playground
        </Link>
        <Link
          href="/widgets"
          className="block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
        >
          Widgets
        </Link>
        <Link
          href="/knowledge"
          className="block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
        >
          Knowledge Base
        </Link>
        <Link
          href="/crawlers"
          className="block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
        >
          Crawlers
        </Link>
        <Link
          href="/jobs"
          className="block px-4 py-2.5 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
        >
          Ingestion Jobs
        </Link>
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
