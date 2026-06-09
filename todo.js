import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

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

let currentDeleteId = null;

// ---- Modal helpers ----
function openModal(modal) { modal.classList.add("active"); }
function closeModal(modal) { modal.classList.remove("active"); }

openAddBtn.addEventListener("click", () => {
    titleInput.value = "";
    dueInput.value = "";
    openModal(addModal);
    setTimeout(() => titleInput.focus(), 100);
});

closeAddBtn.addEventListener("click", () => closeModal(addModal));
addModal.addEventListener("click", (e) => { if (e.target === addModal) closeModal(addModal); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(addModal); closeModal(deleteModal); } });

closeDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) closeModal(deleteModal); });

// ---- Add task ----
saveTaskBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    if (!title) return;

    saveTaskBtn.disabled = true;
    saveTaskBtn.textContent = "Adding…";

    const { error } = await supabase.from("tasks").insert({
        created_by: user.id,
        title,
        due_date: dueInput.value || null,
        status: "open"
    });

    saveTaskBtn.disabled = false;
    saveTaskBtn.textContent = "Add Task";

    if (!error) {
        closeModal(addModal);
        loadTasks();
    }
});

// ---- Delete task ----
confirmDeleteBtn.addEventListener("click", async () => {
    if (!currentDeleteId) return;
    await supabase.from("tasks").delete().eq("task_id", currentDeleteId).eq("created_by", user.id);
    closeModal(deleteModal);
    currentDeleteId = null;
    loadTasks();
});

// ---- Toggle done ----
async function toggleDone(taskId, currentStatus) {
    const newStatus = currentStatus === "done" ? "open" : "done";
    await supabase.from("tasks").update({ status: newStatus })
        .eq("task_id", taskId).eq("created_by", user.id);
    loadTasks();
}

// ---- Due date label ----
function dueDateLabel(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: "Today", overdue: false };
    if (diff === 1) return { text: "Tomorrow", overdue: false };
    return { text: `${diff} days`, overdue: false };
}

// ---- Render ----
function renderTasks(tasks) {
    if (!tasks?.length) {
        todoList.innerHTML = `<div class="todo-empty">No tasks yet – add one!</div>`;
        return;
    }

    todoList.innerHTML = tasks.map(task => {
        const done = task.status === "done";
        const due = dueDateLabel(task.due_date);
        return `
            <div class="todo-item ${done ? "done" : ""}" data-id="${task.task_id}">
                <button class="todo-checkbox" data-id="${task.task_id}" data-status="${task.status}">
                    ${done ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/></svg>` : ""}
                </button>
                <span class="todo-item-title">${escapeHtml(task.title)}</span>
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

    // Checkbox click → toggle
    todoList.querySelectorAll(".todo-checkbox").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleDone(parseInt(btn.dataset.id), btn.dataset.status);
        });
    });

    // Item click → delete modal
    todoList.querySelectorAll(".todo-item").forEach(item => {
        item.addEventListener("click", () => {
            currentDeleteId = parseInt(item.dataset.id);
            openModal(deleteModal);
        });
    });
}

// ---- Load ----
async function loadTasks() {
    todoList.innerHTML = `<div class="todo-loading">Loading…</div>`;

    const sort = sortSelect.value;
    let query = supabase.from("tasks")
        .select("*")
        .eq("created_by", user.id);

    if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "due") query = query.order("due_date", { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    if (error) { todoList.innerHTML = `<div class="todo-empty">Could not load tasks.</div>`; return; }

    // Sort: open first, done last
    const sorted = [...(data || [])].sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status === "done" ? 1 : -1;
    });

    renderTasks(sorted);
}

sortSelect.addEventListener("change", loadTasks);

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadTasks();