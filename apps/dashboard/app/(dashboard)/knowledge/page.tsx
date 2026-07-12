'use client';

import { useState, useEffect } from 'react';

export default function KnowledgePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchSources = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/knowledge', {
        headers: { 'x-organization-id': localStorage.getItem('organizationId') || '' },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) setSources(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const response = await fetch('http://localhost:3001/api/v1/knowledge/upload', {
        method: 'POST',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        fetchSources();
      } else {
        alert('Upload failed: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/knowledge/${id}/retry`, {
        method: 'POST',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        alert('Retry initiated successfully.');
        fetchSources();
      } else {
        alert('Failed to retry: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger retry.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/v1/knowledge/${id}`, {
        method: 'DELETE',
        headers: {
          'x-organization-id': localStorage.getItem('organizationId') || '',
        },
        credentials: 'include',
      });
      const json = await response.json();
      if (json.success) {
        fetchSources();
      } else {
        alert('Failed to delete: ' + json.error?.message);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to trigger deletion.');
    }
  };

  useEffect(() => {
    fetchSources();
    const interval = setInterval(fetchSources, 5000); // Auto refresh for status updates
    return () => clearInterval(interval);
  }, []);

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const extractFilename = (storageKey?: string) => {
    if (!storageKey) return 'Unknown Document';
    const parts = storageKey.split('-');
    if (parts.length > 1) {
      return parts.slice(1).join('-'); // removes the uuid prefix
    }
    return storageKey;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Sources</h1>

        <label
          className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 ${uploading ? 'opacity-50' : ''}`}
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.txt,.md,.docx"
          />
        </label>
      </div>

      <div className="bg-white rounded-lg shadow border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Uploaded
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {extractFilename(s.document?.storageKey)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {s.sourceType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatSize(s.document?.sizeBytes)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      s.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : s.status === 'FAILED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium space-x-4">
                  {s.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(s.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {sources.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No knowledge sources uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
