import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/guards/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { LoginPage } from './modules/auth/LoginPage';
import { AuthCallback } from './modules/auth/AuthCallback';

// Student Modules
import { StudentDashboard } from './modules/student/StudentDashboard';
import { SchedulePage } from './modules/schedule/SchedulePage';
import { RemindersPage } from './modules/reminders/RemindersPage';
import { LostFoundPage } from './modules/lost-found/LostFoundPage';
import { EventsPage } from './modules/events/EventsPage';
import { FeedbackPage } from './modules/feedback/FeedbackPage';

// Admin Modules
import { AdminDashboard } from './modules/admin/AdminDashboard';
import { AdminUsersPage } from './modules/admin/AdminUsersPage';
import { AdminCollegesPage } from './modules/admin/AdminCollegesPage';
import { AdminEventsPage } from './modules/admin/AdminEventsPage';
import { AdminLostFoundPage } from './modules/admin/AdminLostFoundPage';
import { AdminNotificationsPage } from './modules/admin/AdminNotificationsPage';
import { AdminFeedbackPage } from './modules/admin/AdminFeedbackPage';
import { AdminCategoriesPage } from './modules/admin/AdminCategoriesPage';
import { AdminLogsPage } from './modules/admin/AdminLogsPage';
import { AdminSettingsPage } from './modules/admin/AdminSettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Student Hub */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/lost-found" element={<LostFoundPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />

            {/* Admin Command Center */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/colleges"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminCollegesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminEventsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/lost-found"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLostFoundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminNotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/feedback"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFeedbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminCategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
  );
}
