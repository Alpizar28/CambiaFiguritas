import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBmLBa3BKnKsjYg2YObBWuatsaXjtGYwz8',
  authDomain: 'cambiafiguritas.firebaseapp.com',
  projectId: 'cambiafiguritas',
  storageBucket: 'cambiafiguritas.firebasestorage.app',
  messagingSenderId: '1058576446766',
  appId: '1:1058576446766:web:09c796fe7b48a3625576bf',
  measurementId: 'G-0LZD40JTWT',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
