import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDZtRV7ZgsgrhwnjntaNAf0dqBUEmYtQgE",
  authDomain: "preploner.firebaseapp.com",
  databaseURL: "https://preploner-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "preploner",
  storageBucket: "preploner.firebasestorage.app",
  messagingSenderId: "104475352938",
  appId: "1:104475352938:web:5e0a7376605bc5a0d08f13",
  measurementId: "G-KFK5JLGWEB",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
