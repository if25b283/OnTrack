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
        const isActive = href === currentPage ? ' class="active"' : '';
        return `<a href="${href}"${isActive}>${label}</a>`;
    }).join("\n            ");

    return `
        <header class="main-header">
            <div class="header-logo">
                <img src="images/logo.png" alt="OnTrack Logo" class="small-logo">
            </div>

            <nav class="main-nav">
                ${navItems}
            </nav>

            <a href="profile.html" class="profile-btn">
                <img id="header-profile-img" src="${DEFAULT_IMAGE}" alt="Profile" class="profile-btn-img">
            </a>
        </header>
    `;
}

async function loadProfileImage() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = "login.html";
        return;
    }

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

const container = document.getElementById("main-header");
if (container) {
    container.outerHTML = buildHeader();
}

loadProfileImage();