import { supabase } from '../lib/supabase';
import { showLocalDeviceNotification, sendServerPush } from '../lib/firebase';

const alertedItems = new Set<string>();

/**
 * Sends a notification both locally (if tab is open) AND via FCM server push
 * (works even when the page is completely CLOSED — true background alarm).
 */
async function pushAlarm(userId: string, title: string, body: string, type: string, data: Record<string, string> = {}) {
  // Local notification for when the app is open
  showLocalDeviceNotification(title, body);
  // Server push via FCM — delivered to device even when browser is closed
  await sendServerPush(userId, title, body, type, data);
}

/**
 * Checks if any of the user's classes or task reminders are due within the next 15 minutes,
 * and delivers real-time device push notifications & in-app alerts.
 */
export async function checkAndNotifyDueSchedulesAndTasks(userId: string): Promise<void> {
  if (!userId || typeof window === 'undefined') return;

  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday...
  const currentMinutesFromMidnight = now.getHours() * 60 + now.getMinutes();

  try {
    // 1. Check Today's Schedules (Classes)
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', currentDayOfWeek)
      .eq('is_active', true);

    if (schedules && schedules.length > 0) {
      for (const sched of schedules) {
        if (!sched.start_time) continue;
        const [h, m] = sched.start_time.split(':').map(Number);
        const schedMinutes = h * 60 + m;
        const diffMinutes = schedMinutes - currentMinutesFromMidnight;

        // Trigger if class starts within 15 minutes (or within the last 2 minutes if just started)
        if (diffMinutes >= -2 && diffMinutes <= 15) {
          const alertKey = `sched_${sched.id}_${now.toISOString().split('T')[0]}_${sched.start_time}`;
          if (!alertedItems.has(alertKey)) {
            alertedItems.add(alertKey);

            const title = `📚 Class Alert: ${sched.title}`;
            const body = diffMinutes > 0
              ? `Starts in ${diffMinutes} min at ${sched.start_time}${sched.location ? ` (${sched.location})` : ''}.`
              : `Starting now at ${sched.start_time}${sched.location ? ` (${sched.location})` : ''}.`;

            // Persist in-app notification with 7-day retention
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            await supabase.from('notifications').insert({
              user_id: userId,
              title,
              body,
              type: 'SCHEDULE_ALERT',
              data: { schedule_id: sched.id, location: sched.location },
              expires_at: expiresAt.toISOString(),
            } as any);

            // Fire FCM server push — works even when page is closed
            await pushAlarm(userId, title, body, 'SCHEDULE_ALERT', {
              schedule_id: sched.id,
              location: sched.location || '',
            });
          }
        }
      }
    }

    // 2. Check Upcoming Task Reminders
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const { data: reminders } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .gte('due_date', windowStart)
      .lte('due_date', windowEnd);

    if (reminders && reminders.length > 0) {
      for (const rem of reminders) {
        const alertKey = `rem_${rem.id}_${rem.due_date}`;
        if (!alertedItems.has(alertKey)) {
          alertedItems.add(alertKey);

          const title = `⏰ Reminder Due: ${rem.title}`;
          const body = rem.description
            ? `${rem.description} (Priority: ${rem.priority})`
            : `Your scheduled task is due now! Priority: ${rem.priority}`;

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          await supabase.from('notifications').insert({
            user_id: userId,
            title,
            body,
            type: 'TASK_ALERT',
            data: { reminder_id: rem.id, priority: rem.priority },
            expires_at: expiresAt.toISOString(),
          } as any);

          // Fire FCM server push (alarm-type) — works even when page is closed
          await pushAlarm(userId, title, body, 'REMINDER_ALARM', {
            reminder_id: rem.id,
            priority: rem.priority,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error checking schedule & task notifications:', err);
  }
}
 
