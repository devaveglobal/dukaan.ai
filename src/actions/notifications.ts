  "use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Save FCM token for the current user
export async function saveFcmToken(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("fcm_tokens").upsert(
    { user_id: user.id, token, updated_at: new Date().toISOString() },
    { onConflict: "user_id,token" }
  );
}

// Send notification to a specific user (by user_id)
export async function sendNotificationToUser(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const service = getServiceClient();

  const { data: tokens } = await service
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens || tokens.length === 0) return;

  await Promise.all(tokens.map((t) => sendFcmMessage(t.token, notification)));
}

// Send notification to all admins
export async function sendNotificationToAdmins(
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const service = getServiceClient();

  const { data: admins } = await service
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins) return;

  await Promise.all(admins.map((a) => sendNotificationToUser(a.id, notification)));
}

// Core FCM send via HTTP v1 API
async function sendFcmMessage(
  token: string,
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const accessToken = await getFirebaseAccessToken();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: notification.title, body: notification.body },
        data: notification.data ?? {},
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
          },
        },
      },
    }),
  });
}

// Get Firebase access token using service account via google-auth-library pattern
// We use the Firebase REST API with a server key stored in env
async function getFirebaseAccessToken(): Promise<string> {
  // Use Firebase Server Key (Legacy) for simplicity
  // Get it from Firebase Console → Project Settings → Cloud Messaging → Server key
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) throw new Error("FIREBASE_SERVER_KEY not set");
  return serverKey;
}

// Override sendFcmMessage to use legacy API (simpler, no OAuth needed)
// Replace the above sendFcmMessage with this legacy approach
async function sendFcmLegacy(
  token: string,
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) throw new Error("FIREBASE_SERVER_KEY not set in env");

  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`,
    },
    body: JSON.stringify({
      to: token,
      notification: { title: notification.title, body: notification.body },
      data: notification.data ?? {},
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: "/favicon.ico",
        },
      },
    }),
  });
}

// Public send functions using legacy API
export async function notifyAdmins(notification: { title: string; body: string; data?: Record<string, string> }) {
  const service = getServiceClient();
  const { data: admins } = await service
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins) return;

  for (const admin of admins) {
    const { data: tokens } = await service
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", admin.id);

    if (!tokens) continue;
    await Promise.all(tokens.map((t) => sendFcmLegacy(t.token, notification)));
  }
}

export async function notifyUser(
  userId: string,
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  const service = getServiceClient();
  const { data: tokens } = await service
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", userId);

  if (!tokens) return;
  await Promise.all(tokens.map((t) => sendFcmLegacy(t.token, notification)));
}
