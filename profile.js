import { supabase } from "./supabase-config.js";

const DEFAULT_PROFILE_IMAGE =
    "https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg?s=612x612&w=0&k=20&c=UEa7oHoOL30ynvmJzSCIPrwwopJdfqzBs0q69ezQoM8=";

const usernameEl = document.getElementById("profile-username");
const followersEl = document.getElementById("followers-count");
const followingEl = document.getElementById("following-count");
const postsEl = document.getElementById("posts-count");
const profileImageEl = document.getElementById("profile-image");
const profileImageInput = document.getElementById("profile-image-input");
const profileImageLabel = document.querySelector(".profile-image-label");
const logoutBtn = document.getElementById("logout-btn");
const postsGrid = document.querySelector(".posts-grid");

const { data: { user } } = await supabase.auth.getUser();

// Check if viewing own profile or someone else's
const params = new URLSearchParams(window.location.search);
const viewId = params.get("id") || user.id;
const isOwnProfile = viewId === user.id;

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadProfile() {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", viewId)
        .single();

    if (error) { console.error(error); return; }

    if (data) {
        usernameEl.textContent = data.username || "User";
        profileImageEl.src = data.profile_image || DEFAULT_PROFILE_IMAGE;
    }

    // Follower / Following counts
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("followed_id", viewId),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", viewId),
    ]);

    followersEl.textContent = followersCount ?? 0;
    followingEl.textContent = followingCount ?? 0;

    // Posts
    const { data: posts, count: postsCount } = await supabase
        .from("posts")
        .select("post_id, content, image_url", { count: "exact" })
        .eq("user_id", viewId)
        .order("created_at", { ascending: false });

    postsEl.textContent = postsCount ?? 0;

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

    // Own profile: show edit + logout, hide follow
    if (isOwnProfile) {
        logoutBtn.style.display = "block";
        profileImageLabel.style.cursor = "pointer";
    } else {
        // Hide edit overlay and logout
        const overlay = document.querySelector(".profile-image-overlay");
        if (overlay) overlay.style.display = "none";
        profileImageLabel.style.cursor = "default";
        profileImageInput.disabled = true;
        logoutBtn.style.display = "none";

        // Show follow button instead
        const isFollowing = await checkFollowing();
        insertFollowButton(isFollowing);
    }
}

async function checkFollowing() {
    const { data } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("followed_id", viewId)
        .single();
    return !!data;
}

function insertFollowButton(isFollowing) {
    const wrapper = document.querySelector(".logout-wrapper");
    wrapper.innerHTML = `
        <button id="follow-btn" class="logout-btn follow-profile-btn ${isFollowing ? "following" : ""}">
            ${isFollowing ? "Following" : "Follow"}
        </button>
    `;

    document.getElementById("follow-btn").addEventListener("click", async () => {
        const btn = document.getElementById("follow-btn");
        const currently = btn.classList.contains("following");

        if (currently) {
            await supabase.from("followers").delete()
                .eq("follower_id", user.id)
                .eq("followed_id", viewId);
            btn.textContent = "Follow";
            btn.classList.remove("following");
            followersEl.textContent = (parseInt(followersEl.textContent) - 1);
        } else {
            await supabase.from("followers").insert({
                follower_id: user.id,
                followed_id: viewId
            });
            btn.textContent = "Following";
            btn.classList.add("following");
            followersEl.textContent = (parseInt(followersEl.textContent) + 1);
        }
    });
}

// Only allow image upload on own profile
if (isOwnProfile) {
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

        } catch (err) {
            console.error(err);
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });
}

loadProfile();