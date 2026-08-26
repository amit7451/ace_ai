'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '../lib/api';

interface DeleteOrganizationModalProps {
  isOpen: boolean;
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteOrganizationModal({
  isOpen,
  organizationId,
  organizationName,
  onClose,
  onSuccess,
}: DeleteOrganizationModalProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isMatched = confirmInput.trim() === organizationName.trim();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched || isDeleting) return;

    setIsDeleting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${organizationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': organizationId,
        },
        credentials: 'include',
        body: JSON.stringify({
          confirmationName: confirmInput.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error?.message || data.message || 'Failed to delete institution workspace'
        );
      }

      // Cleanup local state
      const currentOrgId =
        typeof window !== 'undefined' ? localStorage.getItem('organizationId') : null;
      if (currentOrgId === organizationId) {
        localStorage.removeItem('organizationId');
      }

      const saved =
        typeof window !== 'undefined' ? localStorage.getItem('user_institutions') : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((i: any) => i.id !== organizationId);
          localStorage.setItem('user_institutions', JSON.stringify(filtered));
        } catch {
          // ignore parsing error
        }
      }

      setConfirmInput('');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the institution workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in font-mono text-zinc-100">
      <div className="relative w-full max-w-lg overflow-hidden border border-red-900/80 bg-zinc-950 p-6 shadow-2xl corner-border space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 border border-red-800 bg-red-950/60 text-red-400 text-[11px] font-bold uppercase tracking-wider">
              ⚠️ DANGER ZONE
            </span>
            <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
              PERMANENT DELETION
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 uppercase tracking-wider border border-transparent hover:border-zinc-800 disabled:opacity-50"
          >
            [ ESC ]
          </button>
        </div>

        {/* Warning Details */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
            Delete institution workspace?
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This action <strong className="text-red-400">CANNOT</strong> be undone. This will
            permanently delete the{' '}
            <strong className="text-zinc-100 font-bold underline decoration-red-500/50">
              {organizationName}
            </strong>{' '}
            workspace and all of its associated data:
          </p>

          <div className="p-3 bg-red-950/20 border border-red-900/40 text-[11px] text-zinc-300 space-y-1.5 font-mono">
            <div className="text-red-400 font-bold uppercase text-[10px] tracking-wider mb-1">
              Data scheduled for permanent deletion:
            </div>
            <div>• All Knowledge Bases, Documents, and Qdrant vector embeddings</div>
            <div>• All Website Crawlers and background ingestion pipelines</div>
            <div>• All Chatbot Widgets, Conversations, and Audit Logs</div>
            <div>• All Member access credentials and configured API keys</div>
          </div>
        </div>

        {error && (
          <div className="p-3 border border-red-900/80 bg-red-950/60 text-red-300 text-xs font-mono tracking-wide">
            ! {error}
          </div>
        )}

        {/* Confirmation Form */}
        <form onSubmit={handleDelete} className="space-y-4 pt-1">
          <div>
            <label className="block text-[11px] tracking-wider text-zinc-400 uppercase mb-2">
              To confirm, type{' '}
              <span className="text-red-400 font-bold select-all bg-red-950/40 px-1.5 py-0.5 border border-red-900/60">
                {organizationName}
              </span>{' '}
              below:
            </label>
            <input
              type="text"
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Type "${organizationName}" to confirm`}
              disabled={isDeleting}
              className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-zinc-600 font-mono"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50 order-2 sm:order-1"
            >
              [ CANCEL ]
            </button>
            <button
              type="submit"
              disabled={!isMatched || isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-800 hover:bg-red-700 disabled:bg-red-950/40 disabled:border-red-900/30 disabled:text-red-800/60 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all border border-red-700 disabled:cursor-not-allowed shadow-lg order-1 sm:order-2"
            >
              {isDeleting ? '[ DELETING WORKSPACE... ]' : '[ PERMANENTLY DELETE WORKSPACE ]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
