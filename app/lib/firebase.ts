import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = {
  apiKey: "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo",
  authDomain: "eurus-lifestyle.firebaseapp.com",
  databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "eurus-lifestyle",
  storageBucket: "eurus-lifestyle.firebasestorage.app",
  messagingSenderId: "678618926664",
  appId: "1:678618926664:web:b533b8985f7b96af02d27d",
  measurementId: "G-N9EYS3V4PQ",
};

import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getDatabase(app);
export const storage = getStorage(app);

// Messaging is only supported in certain environments (browsers)
export const messaging = async () => {
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
};

export default app;

