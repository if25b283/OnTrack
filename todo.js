import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}

const DEFAULT_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%238faebf'/%3E%3Ccircle cx='50' cy='37' r='22' fill='rgba(255,255,255,0.6)'/%3E%3Cellipse cx='50' cy='92' rx='35' ry='28' fill='rgba(255,255,255,0.6)'/%3E%3C/svg%3E";

const todoList = document.getElementById("todo-list");
const sortSelect = document.getElementById("sort-select");

const openAddBtn = document.getElementById("open-add-modal");
const closeAddBtn = document.getElementById("close-add-modal");
const addModal = document.getElementById("add-task-modal");

const titleInput = document.getElementById("task-title-input");
const dueInput = document.getElementById("task-due-input");
const priorityInput = document.getElementById("task-priority-input");
const saveTaskBtn = document.getElementById("save-task-btn");

const deleteModal = document.getElementById("delete-task-modal");
const closeDeleteBtn = document.getElementById("close-delete-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

const assigneeSearch = document.getElementById("assignee-search-input");
const assigneeResults = document.getElementById("assignee-search-results");
const selectedAssignees = document.getElementById("selected-assignees");

const taskDetailModal = document.getElementById("task-detail-modal");
const taskDetailTitle = document.getElementById("task-detail-title");
const taskDetailBody = document.getElementById("task-detail-body");
const closeDetailBtn = document.getElementById("close-task-detail");
const editFromDetailBtn = document.getElementById("edit-task-from-detail-btn");
const deleteFromDetail = document.getElementById("delete-task-from-detail-btn");

const editModal = document.getElementById("edit-task-modal");
const closeEditBtn = document.getElementById("close-edit-modal");
const cancelEditBtn = document.getElementById("cancel-edit-task-btn");
const updateTaskBtn = document.getElementById("update-task-btn");
const editTitleInput = document.getElementById("edit-task-title-input");
const editDueInput = document.getElementById("edit-task-due-input");
const editPriorityInput = document.getElementById("edit-task-priority-input");

let currentDeleteId = null;
let currentEditId = null;
let assignees = [];

function openModal(modal) {
    modal.classList.add("active");
}

function closeModal(modal) {
    modal.classList.remove("active");
}

function resetAddModal() {
    titleInput.value = "";
    dueInput.value = "";
    priorityInput.value = "important";
    assigneeSearch.value = "";
    assigneeResults.innerHTML = "";
    assigneeResults.classList.remove("visible");
    assignees = [];
    renderAssignees();
}

openAddBtn.addEventListener("click", () => {
    resetAddModal();
    openModal(addModal);
    setTimeout(() => titleInput.focus(), 100);
});

closeAddBtn.addEventListener("click", () => {
    closeModal(addModal);
});

addModal.addEventListener("click", e => {
    if (e.target === addModal) {
        closeModal(addModal);
    }
});

closeDeleteBtn.addEventListener("click", () => {
    closeModal(deleteModal);
});

deleteModal.addEventListener("click", e => {
    if (e.target === deleteModal) {
        closeModal(deleteModal);
    }
});

closeDetailBtn.addEventListener("click", () => {
    closeModal(taskDetailModal);
});

taskDetailModal.addEventListener("click", e => {
    if (e.target === taskDetailModal) {
        closeModal(taskDetailModal);
    }
});

closeEditBtn.addEventListener("click", closeEditModal);
cancelEditBtn.addEventListener("click", closeEditModal);

editModal.addEventListener("click", e => {
    if (e.target === editModal) {
        closeEditModal();
    }
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        closeModal(addModal);
        closeModal(deleteModal);
        closeModal(taskDetailModal);
        closeEditModal();
    }
});

let assigneeDebounce;

assigneeSearch.addEventListener("input", () => {
    clearTimeout(assigneeDebounce);

    const q = assigneeSearch.value.trim();

    if (!q) {
        assigneeResults.innerHTML = "";
        assigneeResults.classList.remove("visible");
        return;
    }

    assigneeDebounce = setTimeout(() => {
        searchAssignees(q);
    }, 300);
});

async function searchAssignees(q) {
    const { data } = await supabase
        .from("users")
        .select("id, username, profile_image")
        .ilike("username", `%${q}%`)
        .neq("id", user.id)
        .limit(5);

    if (!data || data.length === 0) {
        assigneeResults.innerHTML = `<div class="search-no-results">No users found</div>`;
        assigneeResults.classList.add("visible");
        return;
    }

    assigneeResults.innerHTML = data.map(u => `
        <div class="member-result-item" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-img="${u.profile_image || ""}">
            <img src="${u.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
            <span>${escapeHtml(u.username)}</span>
        </div>
    `).join("");

    assigneeResults.classList.add("visible");

    assigneeResults.querySelectorAll(".member-result-item").forEach(item => {
        item.addEventListener("click", () => {
            if (assignees.find(a => a.id === item.dataset.id)) {
                return;
            }

            assignees.push({
                id: item.dataset.id,
                username: item.dataset.username,
                profile_image: item.dataset.img
            });

            renderAssignees();

            assigneeSearch.value = "";
            assigneeResults.innerHTML = "";
            assigneeResults.classList.remove("visible");
        });
    });
}

document.addEventListener("click", e => {
    if (!assigneeResults.contains(e.target) && e.target !== assigneeSearch) {
        assigneeResults.classList.remove("visible");
    }
});

function renderAssignees() {
    if (assignees.length === 0) {
        selectedAssignees.innerHTML = `<span class="no-assignees">No one assigned</span>`;
        return;
    }

    selectedAssignees.innerHTML = assignees.map(a => `
        <div class="selected-member-chip">
            <img src="${a.profile_image || DEFAULT_IMAGE}" class="chip-avatar">
            <span>${escapeHtml(a.username)}</span>
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

saveTaskBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const priority = priorityInput.value || "important";

    if (!title) {
        alert("Bitte Titel eingeben.");
        return;
    }

    saveTaskBtn.disabled = true;
    saveTaskBtn.textContent = "Adding…";

    const { data: task, error } = await supabase
        .from("tasks")
        .insert({
            created_by: user.id,
            title: title,
            due_date: dueInput.value || null,
            priority: priority,
            status: "open"
        })
        .select()
        .single();

    if (!error && task) {
        const allAssignees = [
            { task_id: task.task_id, user_id: user.id },
            ...assignees.map(a => ({
                task_id: task.task_id,
                user_id: a.id
            }))
        ];

        await supabase
            .from("task_assignees")
            .insert(allAssignees);
    }

    saveTaskBtn.disabled = false;
    saveTaskBtn.textContent = "Add Task";

    if (error) {
        console.error(error);
        alert("Task konnte nicht erstellt werden.");
        return;
    }

    closeModal(addModal);
    loadTasks();
});

confirmDeleteBtn.addEventListener("click", async () => {
    if (!currentDeleteId) {
        return;
    }

    await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", currentDeleteId);

    await supabase
        .from("tasks")
        .delete()
        .eq("task_id", currentDeleteId)
        .eq("created_by", user.id);

    closeModal(deleteModal);
    currentDeleteId = null;
    loadTasks();
});

async function toggleDone(taskId, currentStatus) {
    const newStatus = currentStatus === "done" ? "open" : "done";

    await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("task_id", taskId);

    loadTasks();
}

async function openTaskDetail(taskId) {
    const { data: task } = await supabase
        .from("tasks")
        .select("*")
        .eq("task_id", taskId)
        .single();

    if (!task) {
        return;
    }

    const { data: taskAssignees } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .eq("task_id", taskId);

    const assigneeUserIds = (taskAssignees || []).map(a => a.user_id);
    let assigneeUsers = [];

    if (assigneeUserIds.length > 0) {
        const { data: users } = await supabase
            .from("users")
            .select("id, username, profile_image")
            .in("id", assigneeUserIds);

        assigneeUsers = users || [];
    }

    const taskAssigneesWithUsers = (taskAssignees || []).map(a => ({
        ...a,
        users: assigneeUsers.find(u => u.id === a.user_id) || null
    }));

    const priority = normalizePriority(task.priority);

    const due = task.due_date
        ? new Date(task.due_date).toLocaleDateString("en", {
            weekday: "long",
            month: "long",
            day: "numeric"
        })
        : null;

    const isOwn = task.created_by === user.id;

    taskDetailTitle.textContent = task.title;

    taskDetailBody.innerHTML = `
        <div class="task-detail-priority priority-${priority}">
            <span class="priority-dot ${priority}"></span>
            <span>${priorityLabel(priority)}</span>
        </div>

        ${due ? `
            <div class="day-entry-item">
                <span class="day-entry-dot event"></span>
                <span>${due}</span>
                <span class="day-entry-tag">Due Date</span>
            </div>
        ` : ""}

        ${taskAssigneesWithUsers.length ? `
            <p class="assigned-label">Assigned to:</p>
            ${taskAssigneesWithUsers.map(a => `
                <div class="group-member-item">
                    <img src="${a.users?.profile_image || DEFAULT_IMAGE}" class="search-result-avatar">
                    <span>${escapeHtml(a.users?.username || "Unknown")}</span>
                    ${a.users?.id === user.id ? `<span class="day-entry-tag">You</span>` : ""}
                </div>
            `).join("")}
        ` : ""}
    `;

    editFromDetailBtn.style.display = isOwn ? "block" : "none";

    editFromDetailBtn.onclick = () => {
        openEditModal(task);
    };

    deleteFromDetail.style.display = isOwn ? "block" : "none";

    deleteFromDetail.onclick = () => {
        closeModal(taskDetailModal);
        currentDeleteId = taskId;
        openModal(deleteModal);
    };

    openModal(taskDetailModal);
}

function openEditModal(task) {
    currentEditId = task.task_id;
    editTitleInput.value = task.title || "";
    editDueInput.value = task.due_date ? task.due_date.slice(0, 10) : "";
    editPriorityInput.value = normalizePriority(task.priority);

    closeModal(taskDetailModal);
    openModal(editModal);

    setTimeout(() => editTitleInput.focus(), 100);
}

function closeEditModal() {
    closeModal(editModal);

    currentEditId = null;
    editTitleInput.value = "";
    editDueInput.value = "";
    editPriorityInput.value = "important";
}

updateTaskBtn.addEventListener("click", async () => {
    if (!currentEditId) {
        return;
    }

    const title = editTitleInput.value.trim();

    if (!title) {
        alert("Bitte Titel eingeben.");
        return;
    }

    updateTaskBtn.disabled = true;
    updateTaskBtn.textContent = "Saving…";

    const { error } = await supabase
        .from("tasks")
        .update({
            title: title,
            due_date: editDueInput.value || null,
            priority: editPriorityInput.value
        })
        .eq("task_id", currentEditId)
        .eq("created_by", user.id);

    updateTaskBtn.disabled = false;
    updateTaskBtn.textContent = "Save Changes";

    if (error) {
        console.error(error);
        alert("Task konnte nicht bearbeitet werden.");
        return;
    }

    closeEditModal();
    loadTasks();
});

function dueDateLabel(dateStr) {
    if (!dateStr) {
        return null;
    }

    const due = new Date(dateStr);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diff = Math.round((due - today) / 86400000);

    if (diff < 0) {
        return {
            text: `${Math.abs(diff)}d overdue`,
            overdue: true
        };
    }

    if (diff === 0) {
        return {
            text: "Today",
            overdue: false
        };
    }

    if (diff === 1) {
        return {
            text: "Tomorrow",
            overdue: false
        };
    }

    return {
        text: `${diff} days`,
        overdue: false
    };
}

function normalizePriority(priority) {
    if (priority === "urgent" || priority === "high") {
        return "urgent";
    }

    if (priority === "low") {
        return "low";
    }

    return "important";
}

function priorityLabel(priority) {
    if (priority === "urgent") {
        return "Dringend";
    }

    if (priority === "low") {
        return "Nicht so wichtig";
    }

    return "Wichtig";
}

function priorityWeight(priority) {
    const normalized = normalizePriority(priority);

    if (normalized === "urgent") {
        return 1;
    }

    if (normalized === "important") {
        return 2;
    }

    return 3;
}

function renderTasks(tasks, assigneeMap) {
    if (!tasks || tasks.length === 0) {
        todoList.innerHTML = `<div class="todo-empty">No tasks yet – add one!</div>`;
        return;
    }

    todoList.innerHTML = tasks.map(task => {
        const done = task.status === "done";
        const due = dueDateLabel(task.due_date);
        const priority = normalizePriority(task.priority);
        const others = (assigneeMap[task.task_id] || []).filter(a => a !== user.id);
        const isShared = others.length > 0;

        return `
            <div class="todo-item todo-priority-${priority} ${done ? "done" : ""}" data-id="${task.task_id}">
                <button class="todo-checkbox" data-id="${task.task_id}" data-status="${task.status}">
                    ${done ? `
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ` : ""}
                </button>

                <span class="todo-item-title">${escapeHtml(task.title)}</span>

                <span class="todo-priority-badge ${priority}">
                    ${priorityLabel(priority)}
                </span>

                ${isShared ? `
                    <svg class="todo-shared-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" title="Shared task">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                ` : ""}

                ${due ? `
                    <span class="todo-due ${due.overdue ? "overdue" : ""}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${due.text}
                    </span>
                ` : ""}
            </div>
        `;
    }).join("");

    todoList.querySelectorAll(".todo-checkbox").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            toggleDone(parseInt(btn.dataset.id), btn.dataset.status);
        });
    });

    todoList.querySelectorAll(".todo-item").forEach(item => {
        item.addEventListener("click", () => {
            openTaskDetail(parseInt(item.dataset.id));
        });
    });
}

async function loadTasks() {
    todoList.innerHTML = `<div class="todo-loading">Loading…</div>`;

    const { data: myAssignments } = await supabase
        .from("task_assignees")
        .select("task_id")
        .eq("user_id", user.id);

    const taskIds = (myAssignments || []).map(a => a.task_id);

    if (taskIds.length === 0) {
        todoList.innerHTML = `<div class="todo-empty">No tasks yet – add one!</div>`;
        return;
    }

    const sort = sortSelect.value;

    let query = supabase
        .from("tasks")
        .select("*")
        .in("task_id", taskIds);

    if (sort === "newest") {
        query = query.order("created_at", { ascending: false });
    } else if (sort === "oldest") {
        query = query.order("created_at", { ascending: true });
    } else if (sort === "due") {
        query = query.order("due_date", { ascending: true, nullsFirst: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        todoList.innerHTML = `<div class="todo-empty">Could not load tasks.</div>`;
        return;
    }

    const { data: allAssignees } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", taskIds);

    const assigneeMap = {};

    (allAssignees || []).forEach(a => {
        if (!assigneeMap[a.task_id]) {
            assigneeMap[a.task_id] = [];
        }

        assigneeMap[a.task_id].push(a.user_id);
    });

    let sorted = [...(data || [])].sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === "done" ? 1 : -1;
        }

        if (sort === "priority") {
            return priorityWeight(a.priority) - priorityWeight(b.priority);
        }

        return 0;
    });

    renderTasks(sorted, assigneeMap);
}

sortSelect.addEventListener("change", loadTasks);

function escapeHtml(str) {
    if (!str) {
        return "";
    }

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

loadTasks();