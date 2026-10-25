/* firebase-messaging-sw.js — يعمل في الخلفية ويعرض الإشعار حتى والتطبيق مغلق (يوضع في جذر المشروع) */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDNMQXIqXHqtQSkBskA9V-R7fXEYLhrIUQ',
  authDomain: 'souk-nsa-1df82.firebaseapp.com',
  projectId: 'souk-nsa-1df82',
  storageBucket: 'souk-nsa-1df82.firebasestorage.app',
  messagingSenderId: '1050290395122',
  appId: '1:1050290395122:web:cd3225105ce58e73bf3d6b'
});

firebase.messaging(); // الإشعارات ذات الحقل notification يعرضها المتصفح تلقائيًا

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.openWindow(url));
});
