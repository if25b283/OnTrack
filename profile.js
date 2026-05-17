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

const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

if (data) {
    usernameEl.textContent = data.username || "User";
    emailEl.textContent = data.email || user.email;
    followersEl.textContent = data.followersCount ?? 0;
    followingEl.textContent = data.followingCount ?? 0;

    if (data.profileImage) {
        profileImageEl.src = data.profileImage;
    }
}

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});