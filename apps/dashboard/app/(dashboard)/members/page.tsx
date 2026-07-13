'use client';

import { useEffect, useState, useRef } from 'react';

interface Member {
  id: string; // the organizationMember ID or user ID?
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
      const res = await fetch('http://localhost:3001/api/v1/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUserId(data.data.sub);
      }
    } catch (err) {}
  };

  const fetchMembers = async () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      const res = await fetch(`http://localhost:3001/api/v1/organizations/${orgId}/members`, {
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
      const res = await fetch(
        `http://localhost:3001/api/v1/organizations/${orgId}/members/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-organization-id': orgId || '',
          },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
          credentials: 'include',
        }
      );
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
      const res = await fetch(
        `http://localhost:3001/api/v1/organizations/${orgId}/members/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'x-organization-id': orgId || '',
          },
          credentials: 'include',
        }
      );
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
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Organization Members</h1>

      {error && <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

      {inviteSuccess && (
        <div className="mb-8 p-4 bg-green-50 text-green-700 rounded-md">{inviteSuccess}</div>
      )}

      {canManage && (
        <div className="bg-white p-6 rounded-lg shadow border mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Invite New Member</h2>
          <form onSubmit={handleInvite} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
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
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Joined
              </th>
              {canManage && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {member.user?.name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{member.user?.email || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      member.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                {canManage && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {member.userId !== currentUserId && member.role !== 'OWNER' && (
                      <button
                        onClick={() => handleRemove(member.userId)}
                        className="text-red-600 hover:text-red-900"
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
                <td colSpan={canManage ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
