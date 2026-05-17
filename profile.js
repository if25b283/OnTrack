import { supabase } from "./supabase-config.js";

const usernameEl = document.getElementById("profile-username");
const emailEl = document.getElementById("profile-email");
const followersEl = document.getElementById("followers-count");
const followingEl = document.getElementById("following-count");
const profileImageEl = document.getElementById("profile-image");
const logoutBtn = document.getElementById("logout-btn");

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}

const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

if (error) {
    console.error(error);
}

if (data) {
    usernameEl.textContent = data.username || "User";
    emailEl.textContent = data.email || user.email;

    followersEl.textContent = 0;
    followingEl.textContent = 0;

    if (data.profile_image) {
        profileImageEl.src = data.profile_image;
    }
}

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});