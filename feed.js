import { supabase } from "./supabase-config.js";

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238faebf'/%3E%3Ccircle cx='50' cy='37' r='22' fill='rgba(255,255,255,0.6)'/%3E%3Cellipse cx='50' cy='92' rx='35' ry='28' fill='rgba(255,255,255,0.6)'/%3E%3C/svg%3E";

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}

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
const editPostModal = document.getElementById("editPostModal");
const editPostText = document.getElementById("editPostText");
const saveEditPost = document.getElementById("saveEditPost");
const cancelEditPost = document.getElementById("cancelEditPost");

let selectedImageFile = null;
let editingPostId = null;

const { data: me } = await supabase
    .from("users")
    .select("profile_image")
    .eq("id", user.id)
    .single();

composerAvatar.src = me?.profile_image || DEFAULT_IMAGE;

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

function openEditModal(postId, oldContent) {
    editingPostId = postId;
    editPostText.value = oldContent;
    editPostModal.classList.add("active");
    editPostText.focus();
}

function closeEditModal() {
    editPostModal.classList.remove("active");
    editingPostId = null;
    editPostText.value = "";
}

fab.addEventListener("click", openModal);
closeBtn.addEventListener("click", closeModal);

cancelEditPost.addEventListener("click", closeEditModal);

editPostModal.addEventListener("click", (e) => {
    if (e.target === editPostModal) {
        closeEditModal();
    }
});

saveEditPost.addEventListener("click", async () => {
    const newContent = editPostText.value.trim();

    if (!editingPostId) return;

    const { error } = await supabase
        .from("posts")
        .update({ content: newContent || null })
        .eq("post_id", editingPostId)
        .eq("user_id", user.id);

    if (error) {
        console.error(error);
        alert("Post konnte nicht bearbeitet werden.");
        return;
    }

    closeEditModal();
    await loadFeed();
});

textAreaAutoResize(textarea);

function textAreaAutoResize(element) {
    element.addEventListener("input", () => {
        element.style.height = "auto";
        element.style.height = element.scrollHeight + "px";
    });
}

overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
        closeModal();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModal();
        closeEditModal();
        closeAllMenus();
    }
});

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

            const { data: urlData } = supabase.storage
                .from("posts")
                .getPublicUrl(path);

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
        alert("Post konnte nicht erstellt werden.");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Post";
});

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
            post_id,
            content,
            image_url,
            created_at,
            users!posts_user_id_fkey (
                id,
                username,
                profile_image
            ),
            post_likes (
                user_id
            ),
            post_comments (
                comment_id,
                comment_text,
                created_at,
                users!post_comments_user_id_fkey (
                    id,
                    username,
                    profile_image
                )
            )
        `)
        .in("user_id", ids)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        feedEl.innerHTML = `<div class="feed-loading">Posts konnten nicht geladen werden.</div>`;
        return;
    }

    if (!posts || posts.length === 0) {
        feedEl.innerHTML = `<div class="feed-empty">Noch keine Posts vorhanden.</div>`;
        return;
    }

    const followingSet = new Set((following || []).map(f => f.followed_id));

    feedEl.innerHTML = posts
        .map(post => renderPost(post, followingSet))
        .join("");
}

function renderPost(post, followingSet = new Set()) {
    const author = post.users;
    const avatar = author?.profile_image || DEFAULT_IMAGE;
    const username = author?.username || "Unknown";
    const likeCount = post.post_likes?.length || 0;
    const liked = post.post_likes?.some(like => like.user_id === user.id);
    const comments = post.post_comments || [];
    const commentCount = comments.length;
    const time = formatTime(post.created_at);
    const isOwn = author?.id === user.id;
    const isFollowing = followingSet.has(author?.id);

    return `
        <article class="post-card" data-id="${post.post_id}">
            <div class="post-header">
                <a href="profile.html?id=${author?.id}" class="post-author-link">
                    <img src="${avatar}" alt="${escapeHtml(username)}" class="post-avatar">
                    <div class="post-meta">
                        <span class="post-username">${escapeHtml(username)}</span>
                        <span class="post-time">${time}</span>
                    </div>
                </a>

                ${(!isOwn && !isFollowing) ? `<button class="post-follow-btn" data-uid="${author?.id}">+ Follow</button>` : ""}

                <div class="post-menu-wrapper">
                    <button class="post-menu-btn" aria-label="Post options">⋯</button>
                    <div class="post-menu">
                        ${isOwn ? `
                            <button class="edit-post-btn" data-post-id="${post.post_id}">Bearbeiten</button>
                            <button class="delete-post-btn" data-post-id="${post.post_id}">Löschen</button>
                        ` : `
                            <button class="report-post-btn">Melden</button>
                        `}
                    </div>
                </div>
            </div>

            ${post.image_url ? `<div class="post-image-wrapper"><img src="${post.image_url}" alt="Post image" class="post-image"></div>` : ""}

            ${post.content ? `<p class="post-content">${escapeHtml(post.content)}</p>` : ""}

            <div class="post-actions">
                <button class="like-btn ${liked ? "liked" : ""}" data-post-id="${post.post_id}" data-liked="${liked}">
                    <span class="heart-icon">♥</span>
                    <span class="like-count">${likeCount}</span>
                </button>

                <button class="comment-toggle-btn" data-post-id="${post.post_id}">
                    💬 <span>${commentCount}</span>
                </button>
            </div>

            <div class="comments-section">
                ${renderComments(comments)}
                <form class="comment-form" data-post-id="${post.post_id}">
                    <input type="text" class="comment-input" placeholder="Kommentar schreiben...">
                    <button type="submit" class="comment-send-btn">Senden</button>
                </form>
            </div>
        </article>
    `;
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        return `<div class="no-comments">Noch keine Kommentare.</div>`;
    }

    return comments
        .slice(-3)
        .map(comment => {
            const commentUser = comment.users;
            const commentUsername = commentUser?.username || "User";

            return `
                <div class="comment">
                    <span class="comment-user">${escapeHtml(commentUsername)}</span>
                    <span class="comment-text">${escapeHtml(comment.comment_text)}</span>
                </div>
            `;
        })
        .join("");
}

feedEl.addEventListener("click", async (e) => {
    const likeBtn = e.target.closest(".like-btn");
    const menuBtn = e.target.closest(".post-menu-btn");
    const editBtn = e.target.closest(".edit-post-btn");
    const deleteBtn = e.target.closest(".delete-post-btn");
    const reportBtn = e.target.closest(".report-post-btn");

    if (likeBtn) {
        await toggleLike(likeBtn);
        return;
    }

    if (menuBtn) {
        const wrapper = menuBtn.closest(".post-menu-wrapper");
        const menu = wrapper.querySelector(".post-menu");

        document.querySelectorAll(".post-menu.open").forEach(openMenu => {
            if (openMenu !== menu) openMenu.classList.remove("open");
        });

        menu.classList.toggle("open");
        return;
    }

    if (editBtn) {
        const postId = editBtn.dataset.postId;
        const card = editBtn.closest(".post-card");
        const oldContent = card.querySelector(".post-content")?.textContent || "";

        openEditModal(postId, oldContent);
        closeAllMenus();
        return;
    }

    if (deleteBtn) {
        const postId = deleteBtn.dataset.postId;
        const confirmDelete = confirm("Möchtest du diesen Post wirklich löschen?");

        if (!confirmDelete) return;

        await supabase.from("post_likes").delete().eq("post_id", postId);
        await supabase.from("post_comments").delete().eq("post_id", postId);

        const { error } = await supabase
            .from("posts")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);

        if (error) {
            console.error(error);
            alert("Post konnte nicht gelöscht werden.");
            return;
        }

        await loadFeed();
        return;
    }

    if (reportBtn) {
        alert("Post wurde gemeldet.");
        closeAllMenus();
    }
});

feedEl.addEventListener("submit", async (e) => {
    if (!e.target.classList.contains("comment-form")) return;

    e.preventDefault();

    const form = e.target;
    const postId = form.dataset.postId;
    const input = form.querySelector(".comment-input");
    const text = input.value.trim();

    if (!text) return;

    const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        user_id: user.id,
        comment_text: text
    });

    if (error) {
        console.error(error);
        alert("Kommentar konnte nicht gespeichert werden.");
        return;
    }

    input.value = "";
    await loadFeed();
});

async function toggleLike(btn) {
    const postId = parseInt(btn.dataset.postId);
    const liked = btn.dataset.liked === "true";
    const countEl = btn.querySelector(".like-count");

    const newLiked = !liked;
    const newCount = parseInt(countEl.textContent) + (newLiked ? 1 : -1);

    btn.dataset.liked = newLiked;
    btn.classList.toggle("liked", newLiked);
    countEl.textContent = newCount;

    if (liked) {
        await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", postId)
            .eq("user_id", user.id);
    } else {
        await supabase
            .from("post_likes")
            .insert({
                post_id: postId,
                user_id: user.id
            });
    }
}

function closeAllMenus() {
    document.querySelectorAll(".post-menu.open").forEach(menu => {
        menu.classList.remove("open");
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".post-menu-wrapper")) {
        closeAllMenus();
    }
});

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
    if (!str) return "";

    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

loadFeed();