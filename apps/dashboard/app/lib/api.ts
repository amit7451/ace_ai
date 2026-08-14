/**
 * Centralized API base URL configuration for the Dashboard.
 * In development: defaults to 'http://localhost:3001'
 * In production: reads from NEXT_PUBLIC_API_URL environment variable
 */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}
