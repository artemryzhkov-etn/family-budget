import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

const app = initializeApp(
  useEmulator
    ? { apiKey: 'demo', authDomain: 'demo.firebaseapp.com', projectId: 'demo-budget' }
    : firebaseConfig,
);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
