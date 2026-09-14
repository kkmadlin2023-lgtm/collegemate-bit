import { supabase } from '../lib/supabase';
import { showLocalDeviceNotification } from '../lib/firebase';

type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

interface GreetingInfo {
  slot: TimeSlot;
  title: string;
  body: string;
}

export function getCurrentTimeSlot(): GreetingInfo {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      slot: 'MORNING',
      title: '🌅 Good Morning, CampusMate!',
      body: 'Have a productive day! Check your classes and scheduled tasks for today.',
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      slot: 'AFTERNOON',
      title: '☀️ Good Afternoon!',
      body: 'Stay energized! Check your afternoon classes, reminders, and campus updates.',
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      slot: 'EVENING',
      title: '🌆 Good Evening!',
      body: 'Great job today! Review completed tasks and prepare for tomorrow’s classes.',
    };
  } else {
    return {
      slot: 'NIGHT',
      title: '🌙 Good Night!',
      body: 'Rest well! Your schedules and tasks are ready for tomorrow morning.',
    };
  }
}

/**
 * Checks and delivers the automated Morning / Afternoon / Evening / Night greeting
 * to the user's device and notification drawer (once per slot per day).
 */
export async function triggerDailyGreetingIfDue(userId: string, userName?: string): Promise<void> {
  if (!userId || typeof window === 'undefined') return;

  const todayStr = new Date().toISOString().split('T')[0];
  const { slot, title, body } = getCurrentTimeSlot();
  const storageKey = `daily_greeting_${userId}_${todayStr}_${slot}`;

  // Check if already delivered for this slot today
  if (localStorage.getItem(storageKey)) {
    return;
  }

  // Mark as delivered
  localStorage.setItem(storageKey, Date.now().toString());

  const personalizedTitle = userName ? `${title.split(',')[0]}, ${userName.split(' ')[0]}!` : title;

  // 1. Show immediate device push notification
  showLocalDeviceNotification(personalizedTitle, body);

  // 2. Persist in user's in-app notification drawer with 7-day retention
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase.from('notifications').insert({
      user_id: userId,
      title: personalizedTitle,
      body,
      type: 'DAILY_BRIEFING',
      data: { slot, date: todayStr },
      expires_at: expiresAt.toISOString(),
    } as any);
  } catch (err) {
    console.warn('Could not save daily greeting notification to database:', err);
  }
}
 
