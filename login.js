import { auth, db } from "./firebase-config.js";

import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const loginInput = document.getElementById("login-input").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {

        let email = loginInput;

        // Wenn Username statt Email eingegeben wurde
        if (!loginInput.includes("@")) {

            const q = query(
                collection(db, "users"),
                where("username", "==", loginInput)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("Username not found");
            }

            email = querySnapshot.docs[0].data().email;
        }

        await signInWithEmailAndPassword(auth, email, password);

        window.location.href = "feed.html";

    } catch (error) {

        message.textContent = error.message;
    }
});