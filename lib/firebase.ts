import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCIXqoRO5tdlwBh91NmxubzhQPCG18OPDM",
  authDomain: "app-from-ai.firebaseapp.com",
  projectId: "app-from-ai",
  storageBucket: "app-from-ai.firebasestorage.app",
  messagingSenderId: "895767442095",
  appId: "1:895767442095:web:0e187abfa31b87a9259a5a",
  measurementId: "G-NMM2QS6XP1"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
