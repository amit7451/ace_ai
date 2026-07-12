'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
}

export default function SelectOrgPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/organizations', {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setOrganizations(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch organizations');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (id: string) => {
    localStorage.setItem('organizationId', id);
    router.push('/playground');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading organizations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md border">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Select Organization
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Choose which workspace you want to access.
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm text-center font-medium bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
            {filteredOrgs.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {filteredOrgs.map((org) => (
                  <li key={org.id}>
                    <button
                      onClick={() => handleSelect(org.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
                    >
                      <span className="block text-sm font-medium text-gray-900">{org.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">No organizations found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
