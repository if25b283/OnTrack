import { supabase } from "./supabase-config.js";

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginInput = document.getElementById("login-input").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    try {
        let email = loginInput;

        if (!loginInput.includes("@")) {
            const { data, error } = await supabase
                .from("users")
                .select("email")
                .eq("username", loginInput)
                .single();

            if (error || !data) {
                throw new Error("Username not found");
            }

            email = data.email;
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (loginError) throw loginError;

        window.location.href = "feed.html";

    } catch (error) {
        message.textContent = error.message;
    }
});