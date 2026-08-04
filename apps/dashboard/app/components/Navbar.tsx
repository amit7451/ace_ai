'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/80 bg-[#08080a]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/modbit.webp"
            alt="ModBit Logo"
            width={28}
            height={28}
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-200"
          />
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
