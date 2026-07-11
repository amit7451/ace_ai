'use client';

import { useState, useEffect } from 'react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/jobs', {
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setJobs(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Auto refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Ingestion Jobs</h1>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Job ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created At
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {j.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{j.jobType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${j.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : j.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(j.createdAt).toLocaleDateString()}{' '}
                  {new Date(j.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No jobs queued.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
