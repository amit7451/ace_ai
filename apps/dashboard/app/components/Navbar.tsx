'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/80 bg-[#08080a]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="w-2.5 h-2.5 bg-zinc-100 rounded-none group-hover:bg-zinc-400 transition-colors"></span>
          <span className="font-bold text-xl tracking-[0.25em] text-zinc-100 uppercase">
            ModBit
          </span>
        </Link>

        {/* Right Actions */}
        <div>
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-xs font-mono text-zinc-400">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 modbit-btn-secondary text-xs tracking-wider"
              >
                [ LOGOUT ]
              </button>
            </div>
          ) : (
            <Link href="/login" className="px-4 py-2 modbit-btn-secondary text-xs tracking-wider">
              [ LOGIN / SIGNUP ]
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
