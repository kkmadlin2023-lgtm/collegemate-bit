import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppRole, Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isStudent: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SUPER_ADMIN_EMAIL = 'kkmadlin2023@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = async (userId: string, userEmail?: string) => {
    try {
      // 1. Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      if (profileData) {
        setProfile(profileData);
      } else if (userEmail) {
        // Fallback profile representation if newly authenticated
        const isSuper = userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        const fallbackProfile: Profile = {
          id: userId,
          email: userEmail,
          full_name: userEmail.split('@')[0],
          avatar_url: null,
          student_id: null,
          department: null,
          phone_number: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        setRole(isSuper ? 'SUPER_ADMIN' : 'STUDENT');
      }

      // 2. Fetch user role
      const { data: userRoleData, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      }

      if (userRoleData && userRoleData.roles) {
        // Supabase returns related table as object or array
        const roleRecord = userRoleData.roles as unknown as { name: AppRole };
        setRole(roleRecord.name);
      } else if (userEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        setRole('SUPER_ADMIN');
      } else {
        setRole('STUDENT');
      }
    } catch (err) {
      console.error('Unexpected error loading auth state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id, session.user.email);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id, session.user.email);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    setIsLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id, user.email);
    }
  };

  const isSuperAdmin = useMemo(() => role === 'SUPER_ADMIN', [role]);
  const isAdmin = useMemo(() => role === 'ADMIN' || role === 'SUPER_ADMIN', [role]);
  const isModerator = useMemo(
    () => role === 'MODERATOR' || role === 'ADMIN' || role === 'SUPER_ADMIN',
    [role]
  );
  const isStudent = useMemo(() => role === 'STUDENT', [role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isLoading,
        isSuperAdmin,
        isAdmin,
        isModerator,
        isStudent,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
