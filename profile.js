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
const postsGrid = document.querySelector(".posts-grid");

const { data: { user } } = await supabase.auth.getUser();

async function loadProfile() {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) { console.error(error); return; }

    if (data) {
        usernameEl.textContent = data.username || "User";
        profileImageEl.src = data.profile_image || DEFAULT_PROFILE_IMAGE;
    }

    // Follower / Following counts
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("followed_id", user.id),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);

    followersEl.textContent = followersCount ?? 0;
    followingEl.textContent = followingCount ?? 0;

    // Posts
    const { data: posts, count: postsCount } = await supabase
        .from("posts")
        .select("post_id, content, image_url", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    postsEl.textContent = postsCount ?? 0;

    // Render posts grid
    if (!posts?.length) {
        postsGrid.innerHTML = `<p style="color:white; opacity:0.6; grid-column:1/-1; text-align:center;">No posts yet.</p>`;
    } else {
        postsGrid.innerHTML = posts.map(post => {
            if (post.image_url) {
                return `<div class="post-box image-post"><img src="${post.image_url}" alt="post"></div>`;
            }
            return `<div class="post-box text-post">${escapeHtml(post.content || "")}</div>`;
        }).join("");
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

profileImageInput.addEventListener("change", async () => {
    const file = profileImageInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    try {
        const ext = file.name.split(".").pop();
        const filePath = `${user.id}/profile-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
        const imageUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
            .from("users").update({ profile_image: imageUrl }).eq("id", user.id);

        if (updateError) throw updateError;

        profileImageEl.src = imageUrl;

        const headerImg = document.getElementById("header-profile-img");
        if (headerImg) headerImg.src = imageUrl;

    } catch (error) {
        console.error(error);
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
});

loadProfile();