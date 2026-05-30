"use client";

import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function PushNotificationInit({ userId }: { userId: string }) {
  usePushNotifications(userId);
  return null;
}
