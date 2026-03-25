import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo",
  authDomain: "eurus-lifestyle.firebaseapp.com",
  projectId: "eurus-lifestyle",
  storageBucket: "eurus-lifestyle.firebasestorage.app",
  messagingSenderId: "678618926664",
  appId: "1:678618926664:web:b533b8985f7b96af02d27d",
  measurementId: "G-N9EYS3V4PQ",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
