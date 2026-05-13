import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        message.textContent = "Login successful!";
        window.location.href = "feed.html";
    } catch (error) {
        message.textContent = error.message;
    }
});