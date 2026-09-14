import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CollegeOnboardingModal } from '../profile/CollegeOnboardingModal';
import { PushNotificationPrompt } from '../notifications/PushNotificationPrompt';
import { RealtimeNotificationToast } from '../notifications/RealtimeNotificationToast';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col antialiased">
      {/* Mandatory College Onboarding Modal */}
      <CollegeOnboardingModal />

      {/* Proactive Push Notification Prompt Modal / Banner */}
      <PushNotificationPrompt />

      {/* Real-time Floating Notification Toast */}
      <RealtimeNotificationToast />

      {/* Top Navbar */}
      <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      {/* Main Body Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

