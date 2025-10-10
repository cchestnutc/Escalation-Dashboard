// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJbqiqDDoWv7-ttxOwFhLdmLxyPg1cdNM",
  authDomain: "escalation-d5b63.firebaseapp.com",
  projectId: "escalation-d5b63",
  storageBucket: "escalation-d5b63.firebasestorage.app",
  messagingSenderId: "11718024278",
  appId: "1:11718024278:web:90c7dc6ee6203ccd64aff7",
  measurementId: "G-3BVQRWCENJ",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Anonymous auth so Firestore reads work under auth-required rules
export const auth = getAuth(app);
signInAnonymously(auth).catch((err) => {
  console.error("Anonymous sign-in failed:", err);
});

export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (u) => {
    if (u) console.log("Signed in (anon):", u.uid);
    resolve(true);
  });
});
