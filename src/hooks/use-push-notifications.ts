"use client";

import { useEffect, useRef } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase";
import { saveFcmToken } from "@/actions/notifications";
import { toast } from "sonner";

export function usePushNotifications(userId: string | null) {
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const init = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          await saveFcmToken(token);
          registered.current = true;
        }

        // Handle foreground messages
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification ?? {};
          toast(title ?? "Notification", {
            description: body,
          });
        });
      } catch (err) {
        console.error("Push notification setup failed:", err);
      }
    };

    init();
  }, [userId]);
}
