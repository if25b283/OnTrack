import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const usernameEl = document.getElementById("profile-username");
const emailEl = document.getElementById("profile-email");
const followersEl = document.getElementById("followers-count");
const followingEl = document.getElementById("following-count");
const profileImageEl = document.getElementById("profile-image");
const logoutBtn = document.getElementById("logout-btn");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            usernameEl.textContent = userData.username || "User";
            emailEl.textContent = userData.email || user.email || "No email";

            followersEl.textContent = userData.followersCount ?? 0;
            followingEl.textContent = userData.followingCount ?? 0;

            if (userData.profileImage) {
                profileImageEl.src = userData.profileImage;
            }
        } else {
            usernameEl.textContent = "User";
            emailEl.textContent = user.email || "No email";
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout failed:", error);
    }
});