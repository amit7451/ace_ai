'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function ProfileDropdown() {
  const { user, institutions, exitInstitution, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const activeOrgId = typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
  const activeOrg = institutions.find((inst) => inst.id === activeOrgId) || institutions[0];

  // Get User Initials for Avatar
  const getInitials = () => {
    if (!user) return 'U';
    if (user.name) {
      const parts = user.name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.name.slice(0, 2).toUpperCase();
    }
    return user.email ? user.email.slice(0, 2).toUpperCase() : 'AI';
  };

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-none border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-900/80 hover:border-zinc-700 transition-all text-xs font-mono group"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar Circle / Badge */}
        <div className="w-7 h-7 rounded-none bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-zinc-100 group-hover:border-zinc-400 group-hover:text-white transition-colors text-[11px] tracking-tighter">
          {getInitials()}
        </div>

        {/* User Short Label */}
        <span className="hidden sm:inline font-mono text-zinc-300 group-hover:text-zinc-100 max-w-[120px] truncate">
          {user?.name || user?.email?.split('@')[0]}
        </span>

        {/* Chevron Arrow */}
        <svg
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-zinc-300' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Popup - Positioned safely below header */}
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] w-64 bg-[#0d0d10] border border-zinc-800 shadow-2xl rounded-none py-2 z-[100] font-mono text-xs corner-border">
          {/* User Header Section */}
          <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/60">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-zinc-100 truncate block text-sm">
                {user?.name || 'Account User'}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 border border-emerald-800/80 bg-emerald-950/40 text-emerald-400 font-bold uppercase tracking-wider">
                ACTIVE
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 truncate block">{user?.email}</span>
            {activeOrg && (
              <div className="mt-2 text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-900 flex items-center justify-between">
                <span>ACTIVE ORG:</span>
                <span className="text-zinc-300 font-bold truncate max-w-[130px]">
                  {activeOrg.name}
                </span>
              </div>
            )}
          </div>

          {/* Actions List */}
          <div className="py-1">
            {/* 1. Profile & Settings -> Dedicated /profile Page */}
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/profile');
              }}
              className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/60 transition-colors"
            >
              <svg
                className="w-4 h-4 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>[ PROFILE & SETTINGS ]</span>
            </button>

            {/* 2. Select Institution -> Opens /institution Page */}
            <button
              onClick={() => {
                setIsOpen(false);
                exitInstitution();
              }}
              className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900/60 transition-colors"
            >
              <svg
                className="w-4 h-4 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m3 0v-4a1 1 0 011-1h2a1 1 0 011 1v4m-4 0h4"
                />
              </svg>
              <span>[ SELECT INSTITUTION ]</span>
            </button>
          </div>

          {/* 3. Global Account Sign Out Button */}
          <div className="pt-1 mt-1 border-t border-zinc-800/80 px-2">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors uppercase tracking-wider text-[11px]"
            >
              <svg
                className="w-4 h-4 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span>Sign Out of Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
