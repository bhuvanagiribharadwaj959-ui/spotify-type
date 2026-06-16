import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCT-JLgRKXFhEKrwDWFpzIj_VFhfcUSyEc",
  authDomain: "spotify-type-shi.firebaseapp.com",
  projectId: "spotify-type-shi",
  storageBucket: "spotify-type-shi.firebasestorage.app",
  messagingSenderId: "535850800740",
  appId: "1:535850800740:web:240e2753b7cc451e3db171",
  measurementId: "G-LRHEYP6X4R"
};


// Handle HMR safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;export const db = getFirestore(app);
