// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration (safe to expose for web apps)
const firebaseConfig = {
    apiKey: "AIzaSyAfSykYwGnHOqUJaAL-1O-OlLibBBpBkLU",
    authDomain: "testra-b60cf.firebaseapp.com",
    projectId: "testra-b60cf",
    storageBucket: "testra-b60cf.firebasestorage.app",
    messagingSenderId: "28747774090",
    appId: "1:28747774090:web:0bdd3043d245d916235573"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('Firebase initialized successfully');