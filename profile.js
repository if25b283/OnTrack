import { supabase } from "./supabase-config.js";

const DEFAULT_PROFILE_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238faebf'/%3E%3Ccircle cx='50' cy='37' r='22' fill='rgba(255,255,255,0.6)'/%3E%3Cellipse cx='50' cy='92' rx='35' ry='28' fill='rgba(255,255,255,0.6)'/%3E%3C/svg%3E";

const usernameEl = document.getElementById("profile-username");
const followersEl = document.getElementById("followers-count");
const followingEl = document.getElementById("following-count");
const postsEl = document.getElementById("posts-count");
const profileImageEl = document.getElementById("profile-image");
const profileImageInput = document.getElementById("profile-image-input");
const profileImageLabel = document.querySelector(".profile-image-label");
const logoutBtn = document.getElementById("logout-btn");
const postsGrid = document.querySelector(".posts-grid");
const editProfileBtn = document.getElementById("edit-profile-btn");

// Edit modal
const editModal = document.getElementById("edit-modal");
const closeEditModal = document.getElementById("close-edit-modal");
const editUsernameInput = document.getElementById("edit-username");
const editPasswordInput = document.getElementById("edit-password");
const editImageInput = document.getElementById("edit-image-input");
const editPreviewImg = document.getElementById("edit-preview-img");
const removeImgBtn = document.getElementById("remove-profile-image-btn");
const saveEditBtn = document.getElementById("save-edit-btn");
const editMessage = document.getElementById("edit-message");

// Post view modal
const postViewModal = document.getElementById("post-view-modal");
const closePostModal = document.getElementById("close-post-modal");
const postViewContent = document.getElementById("post-view-content");
const deletePostBtn = document.getElementById("delete-post-btn");

const { data: { user } } = await supabase.auth.getUser();

const params = new URLSearchParams(window.location.search);
const viewId = params.get("id") || user.id;
const isOwnProfile = viewId === user.id;

let currentPostId = null;
let editImageFile = null;
let removeImage = false;

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---- Load Profile ----
async function loadProfile() {
    const { data, error } = await supabase
        .from("users").select("*").eq("id", viewId).single();

    if (error) { console.error(error); return; }

    usernameEl.textContent = data.username || "User";
    profileImageEl.src = data.profile_image || DEFAULT_PROFILE_IMAGE;

    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("followed_id", viewId),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", viewId),
    ]);

    followersEl.textContent = followersCount ?? 0;
    followingEl.textContent = followingCount ?? 0;

    const { data: posts, count: postsCount } = await supabase
        .from("posts")
        .select("post_id, content, image_url", { count: "exact" })
        .eq("user_id", viewId)
        .order("created_at", { ascending: false });

    postsEl.textContent = postsCount ?? 0;

    if (!posts?.length) {
        postsGrid.innerHTML = `<p style="color:white;opacity:0.6;grid-column:1/-1;text-align:center;">No posts yet.</p>`;
    } else {
        postsGrid.innerHTML = posts.map(post => {
            const content = post.image_url
                ? `<div class="post-box image-post" data-id="${post.post_id}" data-img="${post.image_url}" data-text="${escapeHtml(post.content || '')}"><img src="${post.image_url}" alt="post"></div>`
                : `<div class="post-box text-post" data-id="${post.post_id}" data-text="${escapeHtml(post.content || '')}">${escapeHtml(post.content || "")}</div>`;
            return content;
        }).join("");

        // Click to view post
        postsGrid.querySelectorAll(".post-box").forEach(box => {
            box.addEventListener("click", () => openPostView(box));
        });
    }

    if (isOwnProfile) {
        logoutBtn.style.display = "block";
        editProfileBtn.style.display = "flex";
        profileImageLabel.style.cursor = "pointer";
        // Pre-fill edit modal
        editUsernameInput.value = data.username || "";
        editPreviewImg.src = data.profile_image || DEFAULT_PROFILE_IMAGE;
    } else {
        const overlay = document.querySelector(".profile-image-overlay");
        if (overlay) overlay.style.display = "none";
        profileImageLabel.style.cursor = "default";
        profileImageInput.disabled = true;
        logoutBtn.style.display = "none";
        editProfileBtn.style.display = "none";
        const isFollowing = await checkFollowing();
        insertFollowButton(isFollowing);
    }
}

// ---- Post View Modal ----
function openPostView(box) {
    currentPostId = parseInt(box.dataset.id);
    const img = box.dataset.img;
    const text = box.dataset.text;

    postViewContent.innerHTML = `
        ${img ? `<img src="${img}" alt="post" class="post-view-img">` : ""}
        ${text ? `<p class="post-view-text">${text}</p>` : ""}
    `;

    deletePostBtn.style.display = isOwnProfile ? "flex" : "none";
    postViewModal.classList.add("active");
}

closePostModal.addEventListener("click", () => {
    postViewModal.classList.remove("active");
    currentPostId = null;
});

postViewModal.addEventListener("click", (e) => {
    if (e.target === postViewModal) {
        postViewModal.classList.remove("active");
        currentPostId = null;
    }
});

deletePostBtn.addEventListener("click", async () => {
    if (!currentPostId) return;
    if (!confirm("Delete this post?")) return;

    const { error } = await supabase.from("posts").delete().eq("post_id", currentPostId);
    if (!error) {
        postViewModal.classList.remove("active");
        await loadProfile();
    }
});

// ---- Edit Profile Modal ----
editProfileBtn.addEventListener("click", () => {
    editMessage.textContent = "";
    editImageFile = null;
    removeImage = false;
    editModal.classList.add("active");
});

closeEditModal.addEventListener("click", () => editModal.classList.remove("active"));
editModal.addEventListener("click", (e) => { if (e.target === editModal) editModal.classList.remove("active"); });

editImageInput.addEventListener("change", () => {
    const file = editImageInput.files[0];
    if (!file) return;
    editImageFile = file;
    removeImage = false;
    editPreviewImg.src = URL.createObjectURL(file);
});

removeImgBtn.addEventListener("click", () => {
    editImageFile = null;
    removeImage = true;
    editPreviewImg.src = DEFAULT_PROFILE_IMAGE;
});

saveEditBtn.addEventListener("click", async () => {
    saveEditBtn.disabled = true;
    saveEditBtn.textContent = "Saving…";
    editMessage.textContent = "";

    try {
        const updates = {};
        const newUsername = editUsernameInput.value.trim();
        const newPassword = editPasswordInput.value;

        if (newUsername && newUsername !== usernameEl.textContent) {
            updates.username = newUsername;
        }

        if (removeImage) {
            updates.profile_image = null;
        } else if (editImageFile) {
            const ext = editImageFile.name.split(".").pop();
            const path = `${user.id}/profile-${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from("avatars").upload(path, editImageFile, { upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
            updates.profile_image = urlData.publicUrl;
        }

        if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from("users").update(updates).eq("id", user.id);
            if (error) throw error;
        }

        if (newPassword) {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
        }

        editModal.classList.remove("active");
        editPasswordInput.value = "";
        await loadProfile();

        const headerImg = document.getElementById("header-profile-img");
        if (headerImg && updates.profile_image !== undefined) {
            headerImg.src = updates.profile_image || DEFAULT_PROFILE_IMAGE;
        }

    } catch (err) {
        editMessage.textContent = err.message;
    }

    saveEditBtn.disabled = false;
    saveEditBtn.textContent = "Save";
});

// ---- Follow ----
async function checkFollowing() {
    const { data } = await supabase.from("followers").select("follower_id")
        .eq("follower_id", user.id).eq("followed_id", viewId).single();
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
                .eq("follower_id", user.id).eq("followed_id", viewId);
            btn.textContent = "Follow";
            btn.classList.remove("following");
            followersEl.textContent = parseInt(followersEl.textContent) - 1;
        } else {
            await supabase.from("followers").insert({ follower_id: user.id, followed_id: viewId });
            btn.textContent = "Following";
            btn.classList.add("following");
            followersEl.textContent = parseInt(followersEl.textContent) + 1;
        }
    });
}

// ---- Profile image upload (click on avatar) ----
if (isOwnProfile) {
    profileImageInput.addEventListener("change", async () => {
        const file = profileImageInput.files[0];
        if (!file || !file.type.startsWith("image/")) return;
        try {
            const ext = file.name.split(".").pop();
            const filePath = `${user.id}/profile-${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from("avatars").upload(filePath, file, { cacheControl: "3600", upsert: true });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const imageUrl = publicUrlData.publicUrl;
            await supabase.from("users").update({ profile_image: imageUrl }).eq("id", user.id);
            profileImageEl.src = imageUrl;
            editPreviewImg.src = imageUrl;
            const headerImg = document.getElementById("header-profile-img");
            if (headerImg) headerImg.src = imageUrl;
        } catch (err) { console.error(err); }
    });

    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "login.html";
    });
}

// Delete post RLS policy needed
// ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

loadProfile();