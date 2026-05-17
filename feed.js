import { supabase } from "./supabase-config.js";

const DEFAULT_IMAGE =
    "https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg?s=612x612&w=0&k=20&c=UEa7oHoOL30ynvmJzSCIPrwwopJdfqzBs0q69ezQoM8=";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

// ---- Elements ----
const feedEl = document.getElementById("feed-posts");
const composerAvatar = document.getElementById("composer-avatar");
const textarea = document.getElementById("post-content");
const imageInput = document.getElementById("post-image-input");
const previewWrapper = document.getElementById("image-preview-wrapper");
const imagePreview = document.getElementById("image-preview");
const removeImageBtn = document.getElementById("remove-image");
const submitBtn = document.getElementById("post-submit");
const fab = document.getElementById("open-composer");
const overlay = document.getElementById("modal-overlay");
const closeBtn = document.getElementById("close-composer");

let selectedImageFile = null;

// ---- Load composer avatar ----
const { data: me } = await supabase.from("users").select("profile_image").eq("id", user.id).single();
composerAvatar.src = me?.profile_image || DEFAULT_IMAGE;

// ---- Modal open / close ----
function openModal() {
    overlay.classList.add("active");
    textarea.focus();
}

function closeModal() {
    overlay.classList.remove("active");
    textarea.value = "";
    textarea.style.height = "auto";
    selectedImageFile = null;
    imageInput.value = "";
    imagePreview.src = "";
    previewWrapper.style.display = "none";
}

fab.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// ---- Auto-grow textarea ----
textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
});

// ---- Image selection ----
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    selectedImageFile = file;
    imagePreview.src = URL.createObjectURL(file);
    previewWrapper.style.display = "block";
});

removeImageBtn.addEventListener("click", () => {
    selectedImageFile = null;
    imageInput.value = "";
    imagePreview.src = "";
    previewWrapper.style.display = "none";
});

// ---- Submit post ----
submitBtn.addEventListener("click", async () => {
    const content = textarea.value.trim();
    if (!content && !selectedImageFile) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    let imageUrl = null;

    try {
        if (selectedImageFile) {
            const ext = selectedImageFile.name.split(".").pop();
            const path = `${user.id}/post-${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from("posts")
                .upload(path, selectedImageFile, { upsert: true });
            if (uploadErr) throw uploadErr;
            const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);
            imageUrl = urlData.publicUrl;
        }

        const { error } = await supabase.from("posts").insert({
            user_id: user.id,
            content: content || null,
            image_url: imageUrl
        });
        if (error) throw error;

        closeModal();
        await loadFeed();

    } catch (err) {
        console.error(err);
        alert("Could not post. Try again.");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Post";
});

// ---- Load feed ----
async function loadFeed() {
    feedEl.innerHTML = `<div class="feed-loading">Loading posts…</div>`;

    const { data: following } = await supabase
        .from("followers")
        .select("followed_id")
        .eq("follower_id", user.id);

    const ids = [user.id, ...(following || []).map(f => f.followed_id)];

    const { data: posts, error } = await supabase
        .from("posts")
        .select(`
            post_id, content, image_url, created_at,
            users!posts_user_id_fkey (id, username, profile_image),
            post_likes (user_id)
        `)
        .in("user_id", ids)
        .order("created_at", { ascending: false });

    if (error) {
        feedEl.innerHTML = `<div class="feed-loading">Could not load posts.</div>`;
        return;
    }

    if (!posts?.length) {
        feedEl.innerHTML = `<div class="feed-empty">No posts yet. Follow someone or make your first post!</div>`;
        return;
    }

    feedEl.innerHTML = posts.map(post => renderPost(post)).join("");

    feedEl.querySelectorAll(".like-btn").forEach(btn => {
        btn.addEventListener("click", () => toggleLike(btn));
    });
}

function renderPost(post) {
    const author = post.users;
    const avatar = author?.profile_image || DEFAULT_IMAGE;
    const username = author?.username || "Unknown";
    const likeCount = post.post_likes?.length || 0;
    const liked = post.post_likes?.some(l => l.user_id === user.id);
    const time = formatTime(post.created_at);

    return `
        <article class="post-card" data-id="${post.post_id}">
            <div class="post-header">
                <img src="${avatar}" alt="${username}" class="post-avatar">
                <div class="post-meta">
                    <span class="post-username">${username}</span>
                    <span class="post-time">${time}</span>
                </div>
            </div>

            ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ""}
            ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ""}

            <div class="post-actions">
                <button class="like-btn ${liked ? "liked" : ""}"
                    data-post-id="${post.post_id}"
                    data-liked="${liked}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                        fill="${liked ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span class="like-count">${likeCount}</span>
                </button>
            </div>
        </article>
    `;
}

async function toggleLike(btn) {
    const postId = parseInt(btn.dataset.postId);
    const liked = btn.dataset.liked === "true";
    const countEl = btn.querySelector(".like-count");
    const svg = btn.querySelector("svg path");

    const newLiked = !liked;
    const newCount = parseInt(countEl.textContent) + (newLiked ? 1 : -1);
    btn.dataset.liked = newLiked;
    btn.classList.toggle("liked", newLiked);
    countEl.textContent = newCount;
    svg.setAttribute("fill", newLiked ? "currentColor" : "none");

    if (liked) {
        await supabase.from("post_likes").delete()
            .eq("post_id", postId).eq("user_id", user.id);
    } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
    }
}

function formatTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadFeed();