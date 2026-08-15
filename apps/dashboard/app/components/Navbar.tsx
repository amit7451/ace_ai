'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import ProfileDropdown from './ProfileDropdown';

export default function Navbar() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/80 bg-[#08080a]/90 backdrop-blur-md font-mono">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/modbit.webp"
            alt="ModBit Logo"
            width={28}
            height={28}
            priority
            style={{ width: 'auto', height: 'auto' }}
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:scale-110 transition-transform duration-200"
          />
          <span className="font-bold text-xl tracking-[0.25em] text-zinc-100 uppercase">
            ModBit
          </span>
        </Link>

        {/* Right Actions - Single Consistent Component */}
        <div className="flex items-center">
          {!loading && (
            <>
              {isAuthenticated ? (
                <ProfileDropdown />
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 modbit-btn-secondary text-xs tracking-wider uppercase"
                >
                  [ SIGN IN / REGISTER ]
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
