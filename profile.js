import { supabase } from "./supabase-config.js";

const DEFAULT_PROFILE_IMAGE =
    "https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg?s=612x612&w=0&k=20&c=UEa7oHoOL30ynvmJzSCIPrwwopJdfqzBs0q69ezQoM8=";

const usernameEl = document.getElementById("profile-username");
const followersEl = document.getElementById("followers-count");
const followingEl = document.getElementById("following-count");
const postsEl = document.getElementById("posts-count");
const profileImageEl = document.getElementById("profile-image");
const profileImageInput = document.getElementById("profile-image-input");
const logoutBtn = document.getElementById("logout-btn");

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}

async function loadProfile() {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    if (data) {
        usernameEl.textContent = data.username || "User";
        postsEl.textContent = 0;
        followersEl.textContent = 0;
        followingEl.textContent = 0;
        profileImageEl.src = data.profile_image || DEFAULT_PROFILE_IMAGE;
    }
}

profileImageInput.addEventListener("change", async () => {
    const file = profileImageInput.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        return;
    }

    try {
        const fileExtension = file.name.split(".").pop();
        const filePath = `${user.id}/profile-${Date.now()}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const imageUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
            .from("users")
            .update({
                profile_image: imageUrl
            })
            .eq("id", user.id);

        if (updateError) throw updateError;

        profileImageEl.src = imageUrl;
    } catch (error) {
        console.error(error);
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});

loadProfile();