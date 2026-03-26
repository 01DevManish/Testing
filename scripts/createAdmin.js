const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");
const { getDatabase, ref, set } = require("firebase/database");
const crypto = require("crypto");

// Polyfill for fetch/undici needed by firebase auth in Node
if (!globalThis.fetch) {
  globalThis.fetch = require("node-fetch");
}

const firebaseConfig = {
  apiKey: "AIzaSyBZCDXLDGVCylL8mGCx6AAzp4Y2ngyd_zo",
  authDomain: "eurus-lifestyle.firebaseapp.com",
  databaseURL: "https://eurus-lifestyle-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "eurus-lifestyle",
  storageBucket: "eurus-lifestyle.firebasestorage.app",
  messagingSenderId: "678618926664",
  appId: "1:678618926664:web:b533b8985f7b96af02d27d",
  measurementId: "G-N9EYS3V4PQ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function createAdmin() {
  const email = "manish.yadav@euruslifestyle.in";
  const password = "My8572839479#";
  const name = "Manish Yadav";
  const role = "admin";
  const permissions = ["dispatch", "inventory", "reports", "settings"];

  try {
    let user;
    try {
      const uc = await createUserWithEmailAndPassword(auth, email, password);
      user = uc.user;
      console.log("Created new auth user");
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        const uc = await signInWithEmailAndPassword(auth, email, password);
        user = uc.user;
        console.log("Logged into existing user");
      } else {
        throw e;
      }
    }

    const userData = {
      uid: user.uid,
      email,
      name,
      role,
      permissions
    };

    await set(ref(db, `users/${user.uid}`), userData);
    console.log("User data set in database successfully as admin!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating super admin:", err);
    process.exit(1);
  }
}

createAdmin();
