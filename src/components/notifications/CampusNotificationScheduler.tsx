import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { triggerDailyGreetingIfDue } from '../../services/DailyGreetingService';
import { checkAndNotifyDueSchedulesAndTasks } from '../../services/ScheduleReminderWatcher';

export const CampusNotificationScheduler: React.FC = () => {
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    // 1. Run immediate check on login / load
    triggerDailyGreetingIfDue(user.id, profile?.full_name);
    checkAndNotifyDueSchedulesAndTasks(user.id);

    // 2. Poll every 60 seconds for due schedules and next time-slot greetings
    const interval = setInterval(() => {
      triggerDailyGreetingIfDue(user.id, profile?.full_name);
      checkAndNotifyDueSchedulesAndTasks(user.id);
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [user, profile?.full_name]);

  return null;
};
 
