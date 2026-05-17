import { supabase } from "./supabase-config.js";

const DEFAULT_IMAGE =
    "https://media.istockphoto.com/id/2151669184/vector/vector-flat-illustration-in-grayscale-avatar-user-profile-person-icon-gender-neutral.jpg?s=612x612&w=0&k=20&c=UEa7oHoOL30ynvmJzSCIPrwwopJdfqzBs0q69ezQoM8=";

const NAV_LINKS = [
    { href: "todo.html", label: "To-Do" },
    { href: "calendar.html", label: "Calendar" },
    { href: "feed.html", label: "Home" },
    { href: "timer.html", label: "Timer" },
    { href: "groups.html", label: "Groups" },
];

function getCurrentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
}

function buildHeader() {
    const currentPage = getCurrentPage();

    const navItems = NAV_LINKS.map(({ href, label }) => {
        const isActive = href === currentPage ? ' class="active"' : "";
        return `<a href="${href}"${isActive}>${label}</a>`;
    }).join("\n            ");

    const profileBtn = currentPage !== "profile.html" ? `
            <a href="profile.html" class="profile-btn">
                <img id="header-profile-img" src="${DEFAULT_IMAGE}" alt="Profile" class="profile-btn-img">
            </a>` : "";

    return `
        <header class="main-header">
            <div class="header-logo">
                <img src="images/logo.png" alt="OnTrack Logo" class="small-logo">
            </div>

            <nav class="main-nav">
                ${navItems}
            </nav>

            <div class="header-right">
                <div class="search-wrapper" id="search-wrapper">
                    <button class="search-toggle-btn" id="search-toggle" aria-label="Search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                    </button>
                    <input type="text" class="search-input" id="search-input" placeholder="Search users…" autocomplete="off">
                    <div class="search-results" id="search-results"></div>
                </div>
                ${profileBtn}
            </div>
        </header>
    `;
}

async function loadProfileImage(user) {
    const { data } = await supabase
        .from("users")
        .select("profile_image")
        .eq("id", user.id)
        .single();

    const img = document.getElementById("header-profile-img");
    if (img && data?.profile_image) {
        img.src = data.profile_image;
    }
}

function initSearch(user) {
    const wrapper = document.getElementById("search-wrapper");
    const toggle = document.getElementById("search-toggle");
    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");

    let debounceTimer;

    toggle.addEventListener("click", () => {
        const isOpen = wrapper.classList.toggle("active");
        if (isOpen) {
            input.focus();
        } else {
            input.value = "";
            results.innerHTML = "";
            results.classList.remove("visible");
        }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove("active");
            input.value = "";
            results.innerHTML = "";
            results.classList.remove("visible");
        }
    });

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();

        if (!query) {
            results.innerHTML = "";
            results.classList.remove("visible");
            return;
        }

        debounceTimer = setTimeout(() => searchUsers(query, user, results), 300);
    });
}

async function searchUsers(query, currentUser, resultsEl) {
    const { data: users, error } = await supabase
        .from("users")
        .select("id, username, profile_image")
        .ilike("username", `%${query}%`)
        .neq("id", currentUser.id)
        .limit(6);

    if (error || !users?.length) {
        resultsEl.innerHTML = `<div class="search-no-results">No users found</div>`;
        resultsEl.classList.add("visible");
        return;
    }

    // Check which ones we already follow
    const { data: following } = await supabase
        .from("followers")
        .select("followed_id")
        .eq("follower_id", currentUser.id);

    const followingSet = new Set((following || []).map(f => f.followed_id));

    resultsEl.innerHTML = users.map(u => {
        const isFollowing = followingSet.has(u.id);
        const avatar = u.profile_image || DEFAULT_IMAGE;
        return `
            <div class="search-result-item">
                <a href="profile.html?id=${u.id}" class="search-result-info">
                    <img src="${avatar}" alt="${u.username}" class="search-result-avatar">
                    <span class="search-result-username">${u.username}</span>
                </a>
                <button class="follow-btn ${isFollowing ? "following" : ""}"
                    data-uid="${u.id}"
                    data-following="${isFollowing}">
                    ${isFollowing ? "Following" : "Follow"}
                </button>
            </div>
        `;
    }).join("");

    resultsEl.classList.add("visible");

    // Follow/unfollow handlers
    resultsEl.querySelectorAll(".follow-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const uid = btn.dataset.uid;
            const isFollowing = btn.dataset.following === "true";

            if (isFollowing) {
                await supabase.from("followers").delete()
                    .eq("follower_id", currentUser.id)
                    .eq("followed_id", uid);
                btn.textContent = "Follow";
                btn.classList.remove("following");
                btn.dataset.following = "false";
            } else {
                await supabase.from("followers").insert({
                    follower_id: currentUser.id,
                    followed_id: uid
                });
                btn.textContent = "Following";
                btn.classList.add("following");
                btn.dataset.following = "true";
            }
        });
    });
}

// --- Init ---
const container = document.getElementById("main-header");
if (container) {
    container.outerHTML = buildHeader();
}

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
} else {
    loadProfileImage(user);
    initSearch(user);
}