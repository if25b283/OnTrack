import { supabase } from "./supabase-config.js";

const form = document.getElementById("register-form");
const message = document.getElementById("register-message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) throw error;

        message.textContent = "Registration successful!";
        window.location.href = "feed.html";

    } catch (error) {
        message.textContent = error.message;
    }
});