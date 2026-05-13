import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

console.log("feed.js loaded");

onAuthStateChanged(auth, (user) => {
    console.log("Feed user:", user);

    if (!user) {
        window.location.href = "login.html";
    }
});