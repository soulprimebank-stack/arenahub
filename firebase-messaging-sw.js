// Firebase Cloud Messaging Service Worker
// Responsável por receber push notifications quando o app está em background/fechado

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAWQ3wQ-hLJDgYEBm56lGuZZ3IjgmIhW2w",
  authDomain: "arenahub-e3fef.firebaseapp.com",
  projectId: "arenahub-e3fef",
  storageBucket: "arenahub-e3fef.firebasestorage.app",
  messagingSenderId: "297395803747",
  appId: "1:297395803747:web:91c7fe8563b2d2f0b18a56"
});

const messaging = firebase.messaging();

// Handler de push em background
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM SW] Push recebido:', payload);

  const notifTitle = (payload.notification && payload.notification.title) || 'FutStory';
  const notifBody = (payload.notification && payload.notification.body) || 'Nova notificação';
  const notifIcon = '/arenahub/icon-192.png';
  const notifData = payload.data || {};

  return self.registration.showNotification(notifTitle, {
    body: notifBody,
    icon: notifIcon,
    badge: notifIcon,
    tag: notifData.tag || 'futstory',
    data: notifData,
    vibrate: [200, 100, 200],
    requireInteraction: false
  });
});

// Quando usuário clica na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/arenahub/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se já tem app aberto, foca nele
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/arenahub/') !== -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
