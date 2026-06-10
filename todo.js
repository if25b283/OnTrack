import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238faebf'/%3E%3Ccircle cx='50' cy='37' r='22' fill='rgba(255,255,255,0.6)'/%3E%3Cellipse cx='50' cy='92' rx='35' ry='28' fill='rgba(255,255,255,0.6)'/%3E%3C/svg%3E";

// ---- Elements ----
const todoList = document.getElementById("todo-list");
const sortSelect = document.getElementById("sort-select");
const openAddBtn = document.getElementById("open-add-modal");
const closeAddBtn = document.getElementById("close-add-modal");
const addModal = document.getElementById("add-task-modal");
const titleInput = document.getElementById("task-title-input");
const dueInput = document.getElementById("task-due-input");
const saveTaskBtn = document.getElementById("save-task-btn");
const deleteModal = document.getElementById("delete-task-modal");
const closeDeleteBtn = document.getElementById("close-delete-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

// Assignee search
const assigneeSearch = document.getElementById("assignee-search-input");
const assigneeResults = document.getElementById("assignee-search-results");
const selectedAssignees = document.getElementById("selected-assignees");

// Task detail modal
const taskDetailModal = document.getElementById("task-detail-modal");
const taskDetailTitle = document.getElementById("task-detail-title");
const taskDetailBody = document.getElementById("task-detail-body");
const closeDetailBtn = document.getElementById("close-task-detail");
const createGroupBtn = document.getElementById("create-group-from-task-btn");
const deleteFromDetail = document.getElementById("delete-task-from-detail-btn");

let currentDeleteId = null;
let currentDetailId = null;
let assignees = []; // { id, username, profile_image }

// ---- Modals ----
function openModal(m) { m.classList.add("active"); }
function closeModal(m) { m.classList.remove("active"); }

openAddBtn.addEventListener("click", () => {
    titleInput.value = ""; dueInput.value = "";
    assignees = []; renderAssignees();
    openModal(addModal);
    setTimeout(() => titleInput.focus(), 100);
});

closeAddBtn.addEventListener("click", () => closeModal(addModal));
addModal.addEventListener("click", (e) => { if (e.target === addModal) closeModal(addModal); });
closeDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) closeModal(deleteModal); });
closeDetailBtn.addEventListener("click", () => closeModal(taskDetailModal));
taskDetailModal.addEventListener("click", (e) => { if (e.target === taskDetailModal) closeModal(taskDetailModal); });
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(addModal); closeModal(deleteModal); closeModal(taskDetailModal); }
});

// ---- Assignee search ----
let assigneeDebounce;
assigneeSearch.addEventListener("input", () => {
    clearTimeout(assigneeDebounce);
    const q = assigneeSearch.value.trim();
    if (!q) { assigneeResults.innerHTML = ""; assigneeResults.classList.remove("visible"); return; }
    assigneeDebounce = setTimeout(() => searchAssignees(q), 300);
});

async function searchAssignees(q) {
    const { data } = await supabase.from("users")
        .select("id, username, profile_image")
        .ilike("username", `%${q}%`)
        .neq("id", user.id).limit(5);

    if (!data?.length) {
        assigneeResults.innerHTML = `<div class="search-no-results">No users found</div>`;
        assigneeResults.classList.add("visible");
        return;
    }

    assigneeResults.innerHTML = data.map(u => `
        <div class="member-result-item" data-id="${u.id}" data-username="${u.username}" data-img="${u.profile_image || ""}">
            <img src="${u.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
            <span>${u.username}</span>
        </div>
    `).join("");
    assigneeResults.classList.add("visible");

    assigneeResults.querySelectorAll(".member-result-item").forEach(item => {
        item.addEventListener("click", () => {
            if (assignees.find(a => a.id === item.dataset.id)) return;
            assignees.push({ id: item.dataset.id, username: item.dataset.username, profile_image: item.dataset.img });
            renderAssignees();
            assigneeSearch.value = "";
            assigneeResults.innerHTML = "";
            assigneeResults.classList.remove("visible");
        });
    });
}

document.addEventListener("click", (e) => {
    if (!assigneeResults.contains(e.target) && e.target !== assigneeSearch) {
        assigneeResults.classList.remove("visible");
    }
});

function renderAssignees() {
    if (!assignees.length) {
        selectedAssignees.innerHTML = `<span style="color:rgba(255,255,255,0.4);font-size:13px;">No one assigned</span>`;
        return;
    }
    selectedAssignees.innerHTML = assignees.map(a => `
        <div class="selected-member-chip">
            <img src="${a.profile_image || DEFAULT_IMAGE}" class="chip-avatar">
            <span>${a.username}</span>
            <button class="chip-remove" data-id="${a.id}">✕</button>
        </div>
    `).join("");
    selectedAssignees.querySelectorAll(".chip-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            assignees = assignees.filter(a => a.id !== btn.dataset.id);
            renderAssignees();
        });
    });
}

// ---- Add task ----
saveTaskBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) return;

    saveTaskBtn.disabled = true;
    saveTaskBtn.textContent = "Adding…";

    const { data: task, error } = await supabase.from("tasks").insert({
        created_by: user.id, title,
        due_date: dueInput.value || null,
        status: "open"
    }).select().single();

    if (!error && task) {
        // Add assignees (including self)
        const allAssignees = [{ task_id: task.task_id, user_id: user.id },
        ...assignees.map(a => ({ task_id: task.task_id, user_id: a.id }))];
        await supabase.from("task_assignees").insert(allAssignees);
    }

    saveTaskBtn.disabled = false;
    saveTaskBtn.textContent = "Add Task";

    if (!error) { closeModal(addModal); loadTasks(); }
});

// ---- Delete ----
confirmDeleteBtn.addEventListener("click", async () => {
    if (!currentDeleteId) return;
    await supabase.from("task_assignees").delete().eq("task_id", currentDeleteId);
    await supabase.from("tasks").delete().eq("task_id", currentDeleteId).eq("created_by", user.id);
    closeModal(deleteModal);
    currentDeleteId = null;
    loadTasks();
});

// ---- Toggle done ----
async function toggleDone(taskId, currentStatus) {
    const newStatus = currentStatus === "done" ? "open" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("task_id", taskId);
    loadTasks();
}

// ---- Task detail ----
async function openTaskDetail(taskId) {
    currentDetailId = taskId;
    const { data: task } = await supabase.from("tasks").select("*").eq("task_id", taskId).single();
    const { data: taskAssignees } = await supabase.from("task_assignees")
        .select("task_id, user_id")
        .eq("task_id", taskId);

    // Get user info for each assignee
    const assigneeUserIds = (taskAssignees || []).map(a => a.user_id);
    let assigneeUsers = [];
    if (assigneeUserIds.length) {
        const { data: users } = await supabase.from("users")
            .select("id, username, profile_image")
            .in("id", assigneeUserIds);
        assigneeUsers = users || [];
    }
    const taskAssigneesWithUsers = (taskAssignees || []).map(a => ({
        ...a,
        users: assigneeUsers.find(u => u.id === a.user_id) || null
    }));

    taskDetailTitle.textContent = task.title;

    const due = task.due_date ? new Date(task.due_date).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) : null;
    const isOwn = task.created_by === user.id;

    taskDetailBody.innerHTML = `
        ${due ? `<div class="day-entry-item"><span class="day-entry-dot event"></span><span>${due}</span><span class="day-entry-tag">Due Date</span></div>` : ""}
        ${taskAssigneesWithUsers?.length ? `
            <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:4px 0 4px;">Assigned to:</p>
            ${taskAssigneesWithUsers.map(a => `
                <div class="group-member-item">
                    <img src="${a.users?.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
                    <span>${a.users?.username || "Unknown"}</span>
                    ${a.users?.id === user.id ? `<span class="day-entry-tag">You</span>` : ""}
                </div>
            `).join("")}
        ` : ""}
    `;

    // Show "Create Group" if multiple assignees
    const otherAssignees = (taskAssigneesWithUsers || []).filter(a => a.user_id !== user.id);
    createGroupBtn.style.display = otherAssignees.length > 0 ? "block" : "none";
    createGroupBtn.onclick = () => createGroupFromTask(task, taskAssigneesWithUsers);

    deleteFromDetail.style.display = isOwn ? "block" : "none";
    deleteFromDetail.onclick = () => {
        closeModal(taskDetailModal);
        currentDeleteId = taskId;
        openModal(deleteModal);
    };

    openModal(taskDetailModal);
}

// ---- Create group from task ----
async function createGroupFromTask(task, taskAssignees) {
    const groupName = `${task.title.slice(0, 30)}${task.title.length > 30 ? "…" : ""}`;

    const { data: group, error } = await supabase.from("study_groups").insert({
        group_name: groupName, created_by: user.id
    }).select().single();

    if (error || !group) return;

    const members = (taskAssignees || []).map(a => ({ group_id: group.group_id, user_id: a.user_id }));
    if (!members.find(m => m.user_id === user.id)) {
        members.push({ group_id: group.group_id, user_id: user.id });
    }
    await supabase.from("group_members").insert(members);

    closeModal(taskDetailModal);
    alert(`Group "${groupName}" created! Go to Groups to see it.`);
}

// ---- Due date label ----
function dueDateLabel(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr); const today = new Date();
    today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: "Today", overdue: false };
    if (diff === 1) return { text: "Tomorrow", overdue: false };
    return { text: `${diff} days`, overdue: false };
}

// ---- Render ----
function renderTasks(tasks, assigneeMap) {
    if (!tasks?.length) {
        todoList.innerHTML = `<div class="todo-empty">No tasks yet – add one!</div>`;
        return;
    }

    todoList.innerHTML = tasks.map(task => {
        const done = task.status === "done";
        const due = dueDateLabel(task.due_date);
        const others = (assigneeMap[task.task_id] || []).filter(a => a !== user.id);
        const isShared = others.length > 0;
        return `
            <div class="todo-item ${done ? "done" : ""}" data-id="${task.task_id}">
                <button class="todo-checkbox" data-id="${task.task_id}" data-status="${task.status}">
                    ${done ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/></svg>` : ""}
                </button>
                <span class="todo-item-title">${escapeHtml(task.title)}</span>
                ${isShared ? `<svg class="todo-shared-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Shared task">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>` : ""}
                ${due ? `<span class="todo-due ${due.overdue ? "overdue" : ""}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${due.text}
                </span>` : ""}
            </div>
        `;
    }).join("");

    todoList.querySelectorAll(".todo-checkbox").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDone(parseInt(btn.dataset.id), btn.dataset.status);
        });
    });

    todoList.querySelectorAll(".todo-item").forEach(item => {
        item.addEventListener("click", () => openTaskDetail(parseInt(item.dataset.id)));
    });
}

// ---- Load ----
async function loadTasks() {
    todoList.innerHTML = `<div class="todo-loading">Loading…</div>`;

    // Get tasks assigned to me
    const { data: myAssignments } = await supabase.from("task_assignees")
        .select("task_id").eq("user_id", user.id);
    const taskIds = (myAssignments || []).map(a => a.task_id);

    if (!taskIds.length) {
        todoList.innerHTML = `<div class="todo-empty">No tasks yet – add one!</div>`;
        return;
    }

    const sort = sortSelect.value;
    let query = supabase.from("tasks").select("*").in("task_id", taskIds);

    if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "due") query = query.order("due_date", { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    if (error) { todoList.innerHTML = `<div class="todo-empty">Could not load tasks.</div>`; return; }

    // Get all assignees for these tasks
    const { data: allAssignees } = await supabase.from("task_assignees")
        .select("task_id, user_id").in("task_id", taskIds);

    const assigneeMap = {};
    (allAssignees || []).forEach(a => {
        if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
        assigneeMap[a.task_id].push(a.user_id);
    });

    const sorted = [...(data || [])].sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === "done" ? 1 : -1;
    });

    renderTasks(sorted, assigneeMap);
}

sortSelect.addEventListener("change", loadTasks);

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadTasks();