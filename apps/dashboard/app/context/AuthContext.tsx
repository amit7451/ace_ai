'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Institution {
  id: string;
  name: string;
  slug?: string;
}

interface AuthContextType {
  user: User | null;
  institutions: Institution[];
  loading: boolean;
  isAuthenticated: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  institutions: [],
  loading: true,
  isAuthenticated: false,
  refreshAuth: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshAuth = useCallback(async () => {
    try {
      // 1. Verify user JWT token session
      const userRes = await fetch('http://localhost:3001/api/v1/auth/me', {
        credentials: 'include',
      });

      if (!userRes.ok) {
        setUser(null);
        setInstitutions([]);
        setLoading(false);
        return;
      }

      const userData = await userRes.json();
      if (userData.success && userData.data) {
        setUser(userData.data);

        // 2. Fetch user's attached institutions
        const orgsRes = await fetch('http://localhost:3001/api/v1/organizations', {
          credentials: 'include',
        });
        if (orgsRes.ok) {
          const orgsData = await orgsRes.json();
          if (orgsData.success && Array.isArray(orgsData.data)) {
            setInstitutions(orgsData.data);
            localStorage.setItem('user_institutions', JSON.stringify(orgsData.data));
          }
        }
      } else {
        setUser(null);
        setInstitutions([]);
      }
    } catch (err) {
      // Fallback for prototype / local state
      const savedUser = localStorage.getItem('auth_user');
      const savedOrgs = localStorage.getItem('user_institutions');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      if (savedOrgs) {
        setInstitutions(JSON.parse(savedOrgs));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const logout = async () => {
    try {
      await fetch('http://localhost:3001/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      setInstitutions([]);
      localStorage.removeItem('organizationId');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('user_institutions');
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        institutions,
        loading,
        isAuthenticated: !!user,
        refreshAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
