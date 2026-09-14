// Supabase Edge Function: send-fcm-push
// Sends real FCM push notifications via Firebase HTTP v1 API
// Works even when the browser/app is CLOSED

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const FIREBASE_PROJECT_ID = 'collegemate-bit';
const FCM_ENDPOINT = https://fcm.googleapis.com/v1/projects//messages:send;

// Get a short-lived OAuth2 Bearer token for Firebase using service account key
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  // Sign the JWT with the private key
  const signingInput = ${header}.;
  const privateKeyPem = sa.private_key;

  // Import the private key
  const keyData = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = ${signingInput}.;

  // Exchange JWT for access token
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(Failed to get access token: );
  }
  return tokenData.access_token;
}

serve(async (req: Request) => {
  // Allow CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = await req.json();
    const { tokens, title, message, data, type } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return new Response(JSON.stringify({ error: 'No FCM tokens provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON secret not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getAccessToken(serviceAccountJson);
    const results: any[] = [];

    for (const token of tokens) {
      const fcmPayload = {
        message: {
          token,
          notification: {
            title: title || 'CampusMate',
            body: message || 'You have a new campus notification.',
          },
          data: {
            type: type || 'GENERAL',
            ...(data || {}),
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              default_vibrate_timings: true,
              notification_priority: 'PRIORITY_HIGH',
              visibility: 'PUBLIC',
              channel_id: 'campusmate_alerts',
            },
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: {
              aps: {
                alert: { title: title || 'CampusMate', body: message || '' },
                sound: 'default',
                badge: 1,
                'content-available': 1,
              },
            },
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              title: title || 'CampusMate',
              body: message || '',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              vibrate: [200, 100, 200, 100, 200],
              requireInteraction: type === 'REMINDER_ALARM',
              tag: type || 'campusmate',
              renotify: true,
            },
          },
        },
      };

      const resp = await fetch(FCM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': Bearer ,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      });

      const result = await resp.json();
      results.push({ token: token.slice(0, 20) + '...', status: resp.status, result });
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
