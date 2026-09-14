import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, CheckSquare, Search, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth, SUPER_ADMIN_EMAIL } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (user) {
      const destination = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [user, navigate, location]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setAuthError(error.message || 'Failed to initiate Google sign in.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto p-6 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/40">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CampusMate</h1>
            <p className="text-xs text-indigo-300">Smart Student Life Platform</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Web & Android APK
        </span>
      </header>

      {/* Main Hero & Auth Section */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        {/* Left column: Value Proposition */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            🎓 Built exclusively for students and campus life
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Manage your schedule, tasks, & lost items in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              one unified hub.
            </span>
          </h2>
          <p className="text-base text-slate-400 max-w-xl leading-relaxed">
            Never miss another lecture, track deadlines with customizable alarms, and recover or return lost campus items with our verified claims system.
          </p>

          {/* Key Feature Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">Class Timetable</h3>
              <p className="text-xs text-slate-400 mt-1">Day/week view with room numbers & recurrence.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">Smart Reminders</h3>
              <p className="text-xs text-slate-400 mt-1">Priority flags and push notifications.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">Lost & Found</h3>
              <p className="text-xs text-slate-400 mt-1">Photo reports and secure ownership claims.</p>
            </div>
          </div>
        </div>

        {/* Right column: Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl shadow-indigo-950/50 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">Welcome to CampusMate</h3>
              <p className="text-xs text-slate-400">
                Sign in with your Google account to access your personalized campus dashboard.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={signingIn}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-slate-100 active:scale-[0.98] transition-all shadow-lg shadow-white/5 disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Initial Super Admin:</span>
                  <span className="text-indigo-400 font-mono text-[10px]">{SUPER_ADMIN_EMAIL}</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Signing in with this account automatically grants full administrative rights.
                </p>
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-500">
              By signing in, you agree to CampusMate community guidelines and data privacy terms.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto p-6 text-center text-xs text-slate-500 border-t border-white/5 relative z-10">
        CampusMate System • PostgreSQL & Supabase Powered • 7-Day Notification Center
      </footer>
    </div>
  );
};
