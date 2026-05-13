import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC79krteknuNAsoVNM-bzbgrDKUE9DazUg",
    authDomain: "ontrack-projekt.firebaseapp.com",
    projectId: "ontrack-projekt",
    storageBucket: "ontrack-projekt.firebasestorage.app",
    messagingSenderId: "115436168063",
    appId: "1:115436168063:web:24b1e29f8e4111824af04a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };