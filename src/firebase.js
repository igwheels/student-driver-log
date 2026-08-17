import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCkf0lYqIF-GK3Eg3WT0vyLe_si1VYyM4M',
  authDomain: 'student-driver-log-b1924.firebaseapp.com',
  projectId: 'student-driver-log-b1924',
  storageBucket: 'student-driver-log-b1924.firebasestorage.app',
  messagingSenderId: '829898988631',
  appId: '1:829898988631:web:cca7973251680529eb9712',
  measurementId: 'G-NYHC3QJ5CN',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
