'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '../lib/api';

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newOrg: { id: string; name: string; slug?: string }) => void;
}

export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    // Auto-generate slug from name if user hasn't manually edited slug
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error?.message || data.message || 'Failed to create institution workspace'
        );
      }

      setName('');
      setSlug('');
      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while creating the institution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-fadeIn">
      <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 shadow-2xl corner-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-sm font-bold tracking-widest text-zinc-100 uppercase">
              // CREATE NEW INSTITUTION
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 border border-red-900/60 bg-red-950/40 text-red-400 text-xs tracking-wide">
            ! {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-zinc-400 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Research Labs"
              value={name}
              onChange={handleNameChange}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 modbit-input text-xs"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-widest text-zinc-400 mb-1">
              Institution Slug (URL Identifier)
            </label>
            <input
              type="text"
              placeholder="e.g. acme-research-labs"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 modbit-input text-xs font-mono"
            />
            <span className="text-[10px] text-zinc-500 mt-1 block">
              Unique slug used for tenant routing & isolation.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 modbit-btn-secondary text-xs uppercase tracking-wider disabled:opacity-50"
            >
              [ CANCEL ]
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {isSubmitting ? '[ CREATING... ]' : '[ CREATE INSTITUTION ]'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
