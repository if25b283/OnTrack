import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const form = document.getElementById("register-form");
const message = document.getElementById("register-message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            username: username,
            email: email,
            createdAt: new Date().toISOString()
        });

        message.textContent = "Registration successful!";
        window.location.href = "login.html";
    } catch (error) {
        message.textContent = error.message;
    }
});