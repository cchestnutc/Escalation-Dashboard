import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJbqiqDDoWv7-ttxOwFhLdmLxyPg1cdNM",
  authDomain: "escalation-d5b63.firebaseapp.com",
  projectId: "escalation-d5b63",
  storageBucket: "escalation-d5b63.firebasestorage.app",
  messagingSenderId: "11718024278",
  appId: "1:11718024278:web:90c7dc6ee6203ccd64aff7",
  measurementId: "G-3BVQRWCENJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);  // <-- This initializes Firestore

export { db };  // <-- Export db so other files can use Firestore
