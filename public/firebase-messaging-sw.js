importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo",
  authDomain: "eurus-lifestyle.firebaseapp.com",
  databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "eurus-lifestyle",
  storageBucket: "eurus-lifestyle.firebasestorage.app",
  messagingSenderId: "678618926664",
  appId: "1:678618926664:web:b533b8985f7b96af02d27d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
