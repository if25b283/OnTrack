import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238faebf'/%3E%3Ccircle cx='50' cy='37' r='22' fill='rgba(255,255,255,0.6)'/%3E%3Cellipse cx='50' cy='92' rx='35' ry='28' fill='rgba(255,255,255,0.6)'/%3E%3C/svg%3E";

// ---- Elements ----
const groupsGrid = document.getElementById("groups-grid");
const openCreateBtn = document.getElementById("open-create-group");
const closeCreateBtn = document.getElementById("close-create-group");
const createModal = document.getElementById("create-group-modal");
const groupNameInput = document.getElementById("group-name-input");
const memberSearchInput = document.getElementById("member-search-input");
const memberSearchResults = document.getElementById("member-search-results");
const selectedMembersEl = document.getElementById("selected-members");
const saveGroupBtn = document.getElementById("save-group-btn");

const groupDetailModal = document.getElementById("group-detail-modal");
const closeDetailBtn = document.getElementById("close-group-detail");
const groupDetailAvatar = document.getElementById("group-detail-avatar");
const groupDetailName = document.getElementById("group-detail-name");
const groupDetailCount = document.getElementById("group-detail-members-count");
const messagesEl = document.getElementById("group-messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-message-btn");
const groupMembersList = document.getElementById("group-members-list");
const groupTasksList = document.getElementById("group-tasks-list");
const openEditGroupBtn = document.getElementById("open-edit-group-btn");
const editGroupModal = document.getElementById("edit-group-modal");
const closeEditGroupBtn = document.getElementById("close-edit-group");
const editGroupNameInput = document.getElementById("edit-group-name-input");
const editMemberSearchInput = document.getElementById("edit-member-search-input");
const editMemberSearchResults = document.getElementById("edit-member-search-results");
const editGroupMembersList = document.getElementById("edit-group-members-list");
const saveEditGroupBtn = document.getElementById("save-edit-group-btn");
const deleteGroupBtn = document.getElementById("delete-group-btn");

let currentGroupData = null;
let selectedMembers = []; // { id, username, profile_image }
let currentGroupId = null;
let messageDebounce = null;

// ---- Group colors ----
const GROUP_COLORS = ["#4a7fa5", "#5a9a7a", "#8a6aad", "#c07840", "#3d8a9a", "#a05060"];
function groupColor(name) {
    let hash = 0;
    for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}
function groupInitials(name) {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ---- Load groups ----
async function loadGroups() {
    groupsGrid.innerHTML = `<div class="todo-loading">Loading…</div>`;

    const { data: memberRows } = await supabase
        .from("group_members").select("group_id").eq("user_id", user.id);
    const { data: createdGroups } = await supabase
        .from("study_groups").select("*").eq("created_by", user.id);

    const memberGroupIds = (memberRows || []).map(r => r.group_id);
    const allGroupIds = [...new Set([...memberGroupIds, ...(createdGroups || []).map(g => g.group_id)])];

    if (!allGroupIds.length && !createdGroups?.length) {
        groupsGrid.innerHTML = `<div class="todo-empty">No groups yet – create one!</div>`;
        return;
    }

    const { data: groups } = await supabase
        .from("study_groups").select("*")
        .or(`created_by.eq.${user.id},group_id.in.(${allGroupIds.join(",")})`);

    if (!groups?.length) {
        groupsGrid.innerHTML = `<div class="todo-empty">No groups yet – create one!</div>`;
        return;
    }

    // Get member counts
    const counts = {};
    await Promise.all(groups.map(async g => {
        const { count } = await supabase.from("group_members")
            .select("*", { count: "exact", head: true }).eq("group_id", g.group_id);
        counts[g.group_id] = count || 0;
    }));

    groupsGrid.innerHTML = groups.map(g => {
        const color = groupColor(g.group_name);
        const initials = groupInitials(g.group_name);
        const memberCount = counts[g.group_id] || 0;
        return `
            <div class="group-card" data-id="${g.group_id}" data-name="${g.group_name}">
                <div class="group-card-avatar" style="background:${color};">${initials}</div>
                <div class="group-card-info">
                    <span class="group-card-name">${g.group_name}</span>
                    <span class="group-card-meta">${memberCount} member${memberCount !== 1 ? "s" : ""}</span>
                </div>
                <div class="group-card-actions">
                    <button class="group-open-btn" data-id="${g.group_id}">Open</button>
                </div>
            </div>
        `;
    }).join("");

    groupsGrid.querySelectorAll(".group-open-btn").forEach(btn => {
        btn.addEventListener("click", () => openGroupDetail(parseInt(btn.dataset.id)));
    });
}

// ---- Create Group Modal ----
openCreateBtn.addEventListener("click", () => {
    groupNameInput.value = "";
    memberSearchInput.value = "";
    selectedMembers = [];
    renderSelectedMembers();
    createModal.classList.add("active");
    setTimeout(() => groupNameInput.focus(), 100);
});

closeCreateBtn.addEventListener("click", () => createModal.classList.remove("active"));
createModal.addEventListener("click", (e) => { if (e.target === createModal) createModal.classList.remove("active"); });

// Member search
let searchDebounce;
memberSearchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const q = memberSearchInput.value.trim();
    if (!q) { memberSearchResults.innerHTML = ""; memberSearchResults.classList.remove("visible"); return; }
    searchDebounce = setTimeout(() => searchMembers(q), 300);
});

async function searchMembers(q) {
    const { data } = await supabase.from("users")
        .select("id, username, profile_image")
        .ilike("username", `%${q}%`)
        .neq("id", user.id).limit(5);

    if (!data?.length) {
        memberSearchResults.innerHTML = `<div class="search-no-results">No users found</div>`;
        memberSearchResults.classList.add("visible");
        return;
    }

    memberSearchResults.innerHTML = data.map(u => `
        <div class="member-result-item" data-id="${u.id}" data-username="${u.username}" data-img="${u.profile_image || ""}">
            <img src="${u.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
            <span>${u.username}</span>
        </div>
    `).join("");
    memberSearchResults.classList.add("visible");

    memberSearchResults.querySelectorAll(".member-result-item").forEach(item => {
        item.addEventListener("click", () => {
            const id = item.dataset.id;
            if (selectedMembers.find(m => m.id === id)) return;
            selectedMembers.push({ id, username: item.dataset.username, profile_image: item.dataset.img });
            renderSelectedMembers();
            memberSearchInput.value = "";
            memberSearchResults.innerHTML = "";
            memberSearchResults.classList.remove("visible");
        });
    });
}

function renderSelectedMembers() {
    if (!selectedMembers.length) {
        selectedMembersEl.innerHTML = `<span style="color:rgba(255,255,255,0.4);font-size:13px;">No members added yet</span>`;
        return;
    }
    selectedMembersEl.innerHTML = selectedMembers.map(m => `
        <div class="selected-member-chip">
            <img src="${m.profile_image || DEFAULT_IMAGE}" class="chip-avatar">
            <span>${m.username}</span>
            <button class="chip-remove" data-id="${m.id}">✕</button>
        </div>
    `).join("");
    selectedMembersEl.querySelectorAll(".chip-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            selectedMembers = selectedMembers.filter(m => m.id !== btn.dataset.id);
            renderSelectedMembers();
        });
    });
}

// Close search on outside click
document.addEventListener("click", (e) => {
    if (!memberSearchResults.contains(e.target) && e.target !== memberSearchInput) {
        memberSearchResults.classList.remove("visible");
    }
});

saveGroupBtn.addEventListener("click", async () => {
    const name = groupNameInput.value.trim();
    if (!name) return;

    saveGroupBtn.disabled = true;
    saveGroupBtn.textContent = "Creating…";

    const { data: group, error } = await supabase.from("study_groups").insert({
        group_name: name, created_by: user.id
    }).select().single();

    if (error || !group) {
        console.error("Group creation error:", error);
        alert("Could not create group: " + (error?.message || "Unknown error"));
        saveGroupBtn.disabled = false;
        saveGroupBtn.textContent = "Create";
        return;
    }

    // Add creator + selected members
    const members = [{ group_id: group.group_id, user_id: user.id },
    ...selectedMembers.map(m => ({ group_id: group.group_id, user_id: m.id }))];
    await supabase.from("group_members").insert(members);

    createModal.classList.remove("active");
    saveGroupBtn.disabled = false;
    saveGroupBtn.textContent = "Create";
    loadGroups();
});

// ---- Group Detail ----
async function openGroupDetail(groupId) {
    currentGroupId = groupId;

    const { data: group } = await supabase.from("study_groups")
        .select("*").eq("group_id", groupId).single();

    currentGroupData = group;

    const color = groupColor(group.group_name);
    groupDetailAvatar.textContent = groupInitials(group.group_name);
    groupDetailAvatar.style.background = color;
    groupDetailName.textContent = group.group_name;

    // Reset tabs
    document.querySelectorAll(".group-tab").forEach(t => t.classList.remove("active"));
    document.querySelector('[data-tab="chat"]').classList.add("active");
    document.querySelectorAll(".group-tab-content").forEach(c => c.classList.add("hidden"));
    document.getElementById("tab-chat").classList.remove("hidden");

    groupDetailModal.classList.add("active");
    await loadMessages();
    await loadGroupMembers(groupId);
    await loadGroupTasks(groupId);
}

closeDetailBtn.addEventListener("click", () => {
    groupDetailModal.classList.remove("active");
    currentGroupId = null;
    currentGroupData = null;
});
groupDetailModal.addEventListener("click", (e) => {
    if (e.target === groupDetailModal) {
        groupDetailModal.classList.remove("active");
        currentGroupId = null;
        currentGroupData = null;
    }
});

// Tabs
document.querySelectorAll(".group-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".group-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".group-tab-content").forEach(c => c.classList.add("hidden"));
        tab.classList.add("active");
        document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
        if (tab.dataset.tab === "chat") loadMessages();
    });
});

// ---- Chat ----
async function loadMessages() {
    if (!currentGroupId) return;

    const { data: messages } = await supabase.from("group_messages")
        .select("*")
        .eq("group_id", currentGroupId)
        .order("sent_at", { ascending: true });

    if (!messages?.length) {
        messagesEl.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">No messages yet</div>`;
        return;
    }

    // Fetch user info for all senders
    const senderIds = [...new Set(messages.map(m => m.user_id))];
    const { data: senders } = await supabase.from("users")
        .select("id, username, profile_image")
        .in("id", senderIds);

    messagesEl.innerHTML = messages.map(m => {
        const isMe = m.user_id === user.id;
        const sender = (senders || []).find(s => s.id === m.user_id);
        const avatar = sender?.profile_image || DEFAULT_IMAGE;
        const name = sender?.username || "Unknown";
        const time = new Date(m.sent_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
        return `
            <div class="group-message ${isMe ? "own" : ""}">
                ${!isMe ? `<img src="${avatar}" class="msg-avatar">` : ""}
                <div class="msg-bubble">
                    ${!isMe ? `<span class="msg-name">${name}</span>` : ""}
                    <p>${escapeHtml(m.message_text)}</p>
                    <span class="msg-time">${time}</span>
                </div>
            </div>
        `;
    }).join("");

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentGroupId) return;
    messageInput.value = "";
    await supabase.from("group_messages").insert({
        group_id: currentGroupId, user_id: user.id, message_text: text
    });
    await loadMessages();
}

// ---- Members Tab ----
let currentGroupMemberIds = [];

async function loadGroupMembers(groupId) {
    const { data: members } = await supabase.from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

    currentGroupMemberIds = (members || []).map(m => m.user_id);

    groupDetailCount.textContent = `${currentGroupMemberIds.length} member${currentGroupMemberIds.length !== 1 ? "s" : ""}`;

    if (!currentGroupMemberIds.length) { groupMembersList.innerHTML = ""; return; }

    const { data: users } = await supabase.from("users")
        .select("id, username, profile_image")
        .in("id", currentGroupMemberIds);

    groupMembersList.innerHTML = (users || []).map(u => `
        <div class="group-member-item">
            <img src="${u.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
            <span>${u.username || "Unknown"}</span>
            ${u.id === user.id ? `<span class="day-entry-tag">You</span>` : ""}
        </div>
    `).join("");
}

// ---- Tasks Tab ----
async function loadGroupTasks(groupId) {
    const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

    if (membersError) {
        console.error(membersError);
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                Could not load group members
            </div>
        `;
        return;
    }

    const groupMemberIds = (members || [])
        .map(member => member.user_id)
        .sort();

    if (groupMemberIds.length === 0) {
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                No shared tasks
            </div>
        `;
        return;
    }

    const { data: candidateAssignees, error: candidateError } = await supabase
        .from("task_assignees")
        .select("task_id")
        .in("user_id", groupMemberIds);

    if (candidateError) {
        console.error(candidateError);
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                Could not load tasks
            </div>
        `;
        return;
    }

    const candidateTaskIds = [
        ...new Set((candidateAssignees || []).map(row => row.task_id))
    ];

    if (candidateTaskIds.length === 0) {
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                No shared tasks
            </div>
        `;
        return;
    }

    const { data: allAssignments, error: assignmentsError } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", candidateTaskIds);

    if (assignmentsError) {
        console.error(assignmentsError);
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                Could not load task assignments
            </div>
        `;
        return;
    }

    const assignmentsByTask = {};

    (allAssignments || []).forEach(row => {
        if (!assignmentsByTask[row.task_id]) {
            assignmentsByTask[row.task_id] = [];
        }

        assignmentsByTask[row.task_id].push(row.user_id);
    });

    const matchingTaskIds = Object.entries(assignmentsByTask)
        .filter(([taskId, assigneeIds]) => {
            const sortedAssignees = [...assigneeIds].sort();

            if (sortedAssignees.length !== groupMemberIds.length) {
                return false;
            }

            return sortedAssignees.every((id, index) => id === groupMemberIds[index]);
        })
        .map(([taskId]) => parseInt(taskId));

    if (matchingTaskIds.length === 0) {
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                No shared tasks
            </div>
        `;
        return;
    }

    const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .in("task_id", matchingTaskIds)
        .order("created_at", { ascending: false });

    if (tasksError) {
        console.error(tasksError);
        groupTasksList.innerHTML = `
            <div style="text-align:center;color:rgba(255,255,255,0.4);padding:20px;">
                Could not load group tasks
            </div>
        `;
        return;
    }

    groupTasksList.innerHTML = (tasks || []).map(task => `
        <div class="day-entry-item">
            <span class="day-entry-dot ${task.status === "done" ? "task done" : "task"}"></span>

            <span style="${task.status === "done" ? "text-decoration:line-through;opacity:0.6;" : ""}">
                ${escapeHtml(task.title)}
            </span>

            ${task.priority ? `
                <span class="day-entry-tag">
                    ${escapeHtml(task.priority)}
                </span>
            ` : ""}

            ${task.due_date ? `
                <span class="day-entry-tag">
                    ${new Date(task.due_date).toLocaleDateString("en", {
        month: "short",
        day: "numeric"
    })}
                </span>
            ` : ""}
        </div>
    `).join("");
}

function escapeHtml(str) {
    if (!str) {
        return "";
    }

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

openEditGroupBtn.addEventListener("click", async () => {
    if (!currentGroupId || !currentGroupData) {
        return;
    }

    editGroupNameInput.value = currentGroupData.group_name || "";
    editMemberSearchInput.value = "";
    editMemberSearchResults.innerHTML = "";
    editMemberSearchResults.classList.remove("visible");

    await loadEditGroupMembers();

    editGroupModal.classList.add("active");
});

closeEditGroupBtn.addEventListener("click", () => {
    editGroupModal.classList.remove("active");
});

editGroupModal.addEventListener("click", (e) => {
    if (e.target === editGroupModal) {
        editGroupModal.classList.remove("active");
    }
});

async function loadEditGroupMembers() {
    const { data: members, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", currentGroupId);

    if (error) {
        console.error(error);
        editGroupMembersList.innerHTML = `<p class="follow-empty-text">Could not load members.</p>`;
        return;
    }

    const ids = (members || []).map(m => m.user_id);

    if (ids.length === 0) {
        editGroupMembersList.innerHTML = `<p class="follow-empty-text">No members.</p>`;
        return;
    }

    const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, profile_image")
        .in("id", ids);

    if (usersError) {
        console.error(usersError);
        editGroupMembersList.innerHTML = `<p class="follow-empty-text">Could not load users.</p>`;
        return;
    }

    editGroupMembersList.innerHTML = (users || []).map(member => `
        <div class="edit-group-member-row">
            <div class="group-member-item">
                <img src="${member.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
                <span>${escapeHtml(member.username || "Unknown")}</span>
                ${member.id === user.id ? `<span class="day-entry-tag">You</span>` : ""}
            </div>

            ${member.id !== user.id ? `
                <button class="remove-group-member-btn" data-id="${member.id}">
                    Remove
                </button>
            ` : ""}
        </div>
    `).join("");

    editGroupMembersList.querySelectorAll(".remove-group-member-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const memberId = btn.dataset.id;

            const confirmRemove = confirm("Remove this member from the group?");
            if (!confirmRemove) {
                return;
            }

            const { error } = await supabase
                .from("group_members")
                .delete()
                .eq("group_id", currentGroupId)
                .eq("user_id", memberId);

            if (error) {
                console.error(error);
                alert("Member konnte nicht entfernt werden.");
                return;
            }

            await loadEditGroupMembers();
            await loadGroupMembers(currentGroupId);
            await loadGroupTasks(currentGroupId);
            await loadGroups();
        });
    });
}

let editMemberDebounce;

editMemberSearchInput.addEventListener("input", () => {
    clearTimeout(editMemberDebounce);

    const q = editMemberSearchInput.value.trim();

    if (!q) {
        editMemberSearchResults.innerHTML = "";
        editMemberSearchResults.classList.remove("visible");
        return;
    }

    editMemberDebounce = setTimeout(() => {
        searchEditMembers(q);
    }, 300);
});

async function searchEditMembers(q) {
    const { data, error } = await supabase
        .from("users")
        .select("id, username, profile_image")
        .ilike("username", `%${q}%`)
        .neq("id", user.id)
        .limit(5);

    if (error || !data || data.length === 0) {
        editMemberSearchResults.innerHTML = `<div class="search-no-results">No users found</div>`;
        editMemberSearchResults.classList.add("visible");
        return;
    }

    editMemberSearchResults.innerHTML = data.map(u => `
        <div class="member-result-item" data-id="${u.id}" data-username="${escapeHtml(u.username || "Unknown")}">
            <img src="${u.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
            <span>${escapeHtml(u.username || "Unknown")}</span>
        </div>
    `).join("");

    editMemberSearchResults.classList.add("visible");

    editMemberSearchResults.querySelectorAll(".member-result-item").forEach(item => {
        item.addEventListener("click", async () => {
            const memberId = item.dataset.id;

            const { error } = await supabase
                .from("group_members")
                .insert({
                    group_id: currentGroupId,
                    user_id: memberId
                });

            if (error) {
                console.error(error);
                alert("Member konnte nicht hinzugefügt werden. Vielleicht ist diese Person schon in der Gruppe.");
                return;
            }

            editMemberSearchInput.value = "";
            editMemberSearchResults.innerHTML = "";
            editMemberSearchResults.classList.remove("visible");

            await loadEditGroupMembers();
            await loadGroupMembers(currentGroupId);
            await loadGroupTasks(currentGroupId);
            await loadGroups();
        });
    });
}

saveEditGroupBtn.addEventListener("click", async () => {
    if (!currentGroupId) {
        return;
    }

    const newName = editGroupNameInput.value.trim();

    if (!newName) {
        alert("Bitte Gruppennamen eingeben.");
        return;
    }

    saveEditGroupBtn.disabled = true;
    saveEditGroupBtn.textContent = "Saving…";

    const { error } = await supabase
        .from("study_groups")
        .update({
            group_name: newName
        })
        .eq("group_id", currentGroupId);

    saveEditGroupBtn.disabled = false;
    saveEditGroupBtn.textContent = "Save";

    if (error) {
        console.error(error);
        alert("Gruppe konnte nicht bearbeitet werden.");
        return;
    }

    currentGroupData.group_name = newName;
    groupDetailName.textContent = newName;
    groupDetailAvatar.textContent = groupInitials(newName);
    groupDetailAvatar.style.background = groupColor(newName);

    editGroupModal.classList.remove("active");
    await loadGroups();
});

deleteGroupBtn.addEventListener("click", async () => {
    if (!currentGroupId) {
        return;
    }

    const confirmDelete = confirm("Do you really want to delete this group?");
    if (!confirmDelete) {
        return;
    }

    const { error } = await supabase.rpc("delete_group_completely", {
        group_id_to_delete: currentGroupId
    });

    if (error) {
        console.error(error);
        alert("Gruppe konnte nicht gelöscht werden.");
        return;
    }

    editGroupModal.classList.remove("active");
    groupDetailModal.classList.remove("active");
    currentGroupId = null;
    currentGroupData = null;

    await loadGroups();
});

loadGroups();