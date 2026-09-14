import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { triggerDailyGreetingIfDue } from '../../services/DailyGreetingService';
import { checkAndNotifyDueSchedulesAndTasks } from '../../services/ScheduleReminderWatcher';
import { registerPushNotificationToken, getNotificationPermissionState } from '../../lib/firebase';

export const CampusNotificationScheduler: React.FC = () => {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. If user has granted push permissions, automatically collect & refresh FCM device token in Supabase
    if (getNotificationPermissionState() === 'granted') {
      registerPushNotificationToken(user.id, { silent: true }).catch((err) => {
        console.warn('Background FCM token sync notice:', err);
      });
    }

    // 2. Run immediate check on login / load
    triggerDailyGreetingIfDue(user.id, profile?.full_name);
    checkAndNotifyDueSchedulesAndTasks(user.id);

    // 3. Poll every 60 seconds for due schedules, tasks, and time-slot greetings
    const interval = setInterval(() => {
      triggerDailyGreetingIfDue(user.id, profile?.full_name);
      checkAndNotifyDueSchedulesAndTasks(user.id);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, profile?.full_name]);

  return null;
};
