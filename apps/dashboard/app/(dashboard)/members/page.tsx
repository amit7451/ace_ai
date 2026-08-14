'use client';

import { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../../lib/api';

export const dynamic = 'force-dynamic';

interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchMe();
      fetchMembers();
    }
  }, []);

  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUserId(data.data.sub);
      }
    } catch (err) {}
  };

  const fetchMembers = async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/members`, {
        headers: {
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to load members');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteSuccess('');
    setError('');

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/members/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-organization-id': orgId || '',
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        setInviteSuccess(data.message || 'Invitation sent successfully');
        setInviteEmail('');
        fetchMembers();
      } else {
        throw new Error(data.error?.message || 'Failed to send invitation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`${API_BASE_URL}/api/v1/organizations/${orgId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': orgId || '',
        },
        credentials: 'include',
      });
      const data = await res.json();

      if (data.success) {
        fetchMembers();
      } else {
        throw new Error(data.error?.message || 'Failed to remove member');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentUserMember = members.find((m) => m.userId === currentUserId);
  const canManage = currentUserMember?.role === 'OWNER' || currentUserMember?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh] font-mono text-xs text-zinc-500 animate-pulse">
        LOADING MEMBERS...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 font-mono text-zinc-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-[0.15em] text-zinc-100 uppercase">
            ORGANIZATION MEMBERS
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage team access roles and member invitations
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 border border-red-900/60 bg-red-950/30 text-red-400 text-xs">
          {error}
        </div>
      )}
      {inviteSuccess && (
        <div className="p-3 border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs">
          ✓ {inviteSuccess}
        </div>
      )}

      {canManage && (
        <div className="modbit-card p-6 border border-zinc-800 corner-border space-y-4">
          <h2 className="text-xs font-bold text-zinc-100 uppercase tracking-wider border-b border-zinc-800 pb-3">
            INVITE NEW TEAM MEMBER
          </h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-3.5 py-2.5 modbit-input text-xs"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-[11px] tracking-widest text-zinc-400 uppercase mb-1">
                Role Access
              </label>
              <select
                className="w-full px-3.5 py-2.5 modbit-input text-xs bg-zinc-950"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="VIEWER">Viewer</option>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="px-6 py-2.5 modbit-btn-primary text-xs uppercase tracking-wider disabled:opacity-50 w-full sm:w-auto shrink-0"
            >
              {inviting ? '[ SENDING... ]' : '[ SEND INVITE ]'}
            </button>
          </form>
        </div>
      )}

      <div className="modbit-card border border-zinc-800 corner-border overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-800 text-xs">
          <thead className="bg-zinc-950/90">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Member User
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Role
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Status
              </th>
              <th className="px-6 py-3 text-left font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                Joined Date
              </th>
              {canManage && (
                <th className="px-6 py-3 text-right font-bold text-zinc-400 uppercase tracking-widest text-[11px]">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 bg-zinc-950/40">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-zinc-100">
                    {member.user?.name || 'Unknown User'}
                  </div>
                  <div className="text-zinc-500 text-[11px]">{member.user?.email || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 text-[10px] font-bold border border-zinc-700 bg-zinc-900 text-zinc-300 uppercase tracking-wider">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                      member.status === 'ACTIVE'
                        ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-400'
                        : 'border-yellow-800/80 bg-yellow-950/40 text-yellow-400'
                    }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-500">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                {canManage && (
                  <td className="px-6 py-4 text-right">
                    {member.userId !== currentUserId && member.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemove(member.userId)}
                        className="text-red-400 hover:text-red-300 underline text-[11px]"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-6 py-8 text-center text-zinc-500">
                  No members found for this workspace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
