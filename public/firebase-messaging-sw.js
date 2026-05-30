importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCft2QjyL8W7w1ApqtFQFF2A8fiUHIaKso",
  authDomain: "dukaan-ai-584a4.firebaseapp.com",
  projectId: "dukaan-ai-584a4",
  storageBucket: "dukaan-ai-584a4.firebasestorage.app",
  messagingSenderId: "354847430250",
  appId: "1:354847430250:web:69755cc724cf33b6d6dc13",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "AI Sales", {
    body: body ?? "",
    icon: icon ?? "/favicon.ico",
    badge: "/favicon.ico",
    data: payload.data,
  });
});
