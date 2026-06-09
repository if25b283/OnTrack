import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

// ---- State ----
const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let allEvents = [];
let allTasks = [];
let selectedDate = null;

// ---- Elements ----
const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevBtn = document.getElementById("prevMonth");
const nextBtn = document.getElementById("nextMonth");

// Add event modal
const eventModal = document.getElementById("eventModal");
const closeModalBtn = document.getElementById("closeModal");
const saveEventBtn = document.getElementById("saveEvent");
const eventTitleEl = document.getElementById("eventTitle");
const eventDateEl = document.getElementById("eventDate");

// Day detail modal
const dayModal = document.getElementById("day-modal");
const closeDayModal = document.getElementById("close-day-modal");
const dayModalTitle = document.getElementById("day-modal-title");
const dayModalBody = document.getElementById("day-modal-body");
const dayAddBtn = document.getElementById("day-add-event-btn");

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ---- Load data ----
async function loadData() {
  const [eventsRes, tasksRes] = await Promise.all([
    supabase.from("calendar_events").select("*").eq("user_id", user.id),
    supabase.from("tasks").select("task_id, title, due_date, status").eq("created_by", user.id).not("due_date", "is", null)
  ]);
  allEvents = eventsRes.data || [];
  allTasks = tasksRes.data || [];
  renderCalendar();
}

// ---- Render calendar ----
function renderCalendar() {
  calendarGrid.innerHTML = "";
  calendarTitle.textContent = `${monthNames[currentMonth]}  ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const totalCells = Math.ceil((startDay + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < startDay; i++) {
    const el = document.createElement("div");
    el.className = "day muted";
    calendarGrid.appendChild(el);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = formatDate(currentYear, currentMonth, day);
    const dayEvents = allEvents.filter(e => e.start_datetime?.startsWith(dateStr));
    const dayTasks = allTasks.filter(t => t.due_date?.startsWith(dateStr));
    const total = dayEvents.length + dayTasks.length;

    const dayBox = document.createElement("div");
    dayBox.className = "day clickable-day";
    dayBox.dataset.date = dateStr;

    // Today highlight
    if (dateStr === formatDate(today.getFullYear(), today.getMonth(), today.getDate())) {
      dayBox.classList.add("today");
    }

    let html = `<span class="day-number">${day}</span>`;

    // Show up to 2 entries
    const visible = [...dayEvents.map(e => ({ title: e.title, type: "event" })),
    ...dayTasks.map(t => ({ title: t.title, type: "task", done: t.status === "done" }))];

    visible.slice(0, 2).forEach(entry => {
      html += `<div class="cal-entry ${entry.type} ${entry.done ? 'done' : ''}">${entry.title}</div>`;
    });

    if (total > 2) {
      html += `<div class="cal-more">+${total - 2} more</div>`;
    }

    html += `<button class="add-event" data-date="${dateStr}">+</button>`;
    dayBox.innerHTML = html;
    calendarGrid.appendChild(dayBox);
  }

  const usedCells = startDay + lastDay.getDate();
  for (let i = usedCells; i < totalCells; i++) {
    const el = document.createElement("div");
    el.className = "day muted";
    calendarGrid.appendChild(el);
  }

  // Click on + button → add event
  calendarGrid.querySelectorAll(".add-event").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      eventDateEl.value = btn.dataset.date;
      eventTitleEl.value = "";
      eventModal.style.display = "flex";
    });
  });

  // Click on day → day detail
  calendarGrid.querySelectorAll(".clickable-day").forEach(cell => {
    cell.addEventListener("click", (e) => {
      if (e.target.classList.contains("add-event")) return;
      openDayModal(cell.dataset.date);
    });
  });
}

// ---- Day detail modal ----
function openDayModal(dateStr) {
  selectedDate = dateStr;
  dayModalTitle.textContent = formatDisplayDate(dateStr);

  const dayEvents = allEvents.filter(e => e.start_datetime?.startsWith(dateStr));
  const dayTasks = allTasks.filter(t => t.due_date?.startsWith(dateStr));

  if (!dayEvents.length && !dayTasks.length) {
    dayModalBody.innerHTML = `<p style="color:rgba(255,255,255,0.6); margin:0;">No entries for this day.</p>`;
  } else {
    let html = "";
    dayEvents.forEach(e => {
      html += `<div class="day-entry-item">
                <span class="day-entry-dot event"></span>
                <span>${e.title}</span>
                <button class="day-entry-delete" data-type="event" data-id="${e.event_id}">✕</button>
            </div>`;
    });
    dayTasks.forEach(t => {
      html += `<div class="day-entry-item">
                <span class="day-entry-dot task ${t.status === "done" ? "done" : ""}"></span>
                <span style="${t.status === "done" ? "text-decoration:line-through;opacity:0.6;" : ""}">${t.title}</span>
                <span class="day-entry-tag">To-Do</span>
            </div>`;
    });
    dayModalBody.innerHTML = html;

    // Delete event handlers
    dayModalBody.querySelectorAll(".day-entry-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        await supabase.from("calendar_events").delete().eq("event_id", btn.dataset.id);
        await loadData();
        openDayModal(dateStr);
      });
    });
  }

  dayModal.classList.add("active");
}

closeDayModal.addEventListener("click", () => dayModal.classList.remove("active"));
dayModal.addEventListener("click", (e) => { if (e.target === dayModal) dayModal.classList.remove("active"); });

dayAddBtn.addEventListener("click", () => {
  dayModal.classList.remove("active");
  eventDateEl.value = selectedDate || "";
  eventTitleEl.value = "";
  eventModal.style.display = "flex";
});

// ---- Add event modal ----
closeModalBtn.addEventListener("click", () => { eventModal.style.display = "none"; });

saveEventBtn.addEventListener("click", async () => {
  const title = eventTitleEl.value.trim();
  const date = eventDateEl.value;
  if (!title || !date) return;

  await supabase.from("calendar_events").insert({
    user_id: user.id,
    title,
    start_datetime: date + "T00:00:00"
  });

  eventModal.style.display = "none";
  await loadData();
});

// ---- Nav ----
prevBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  loadData();
});

nextBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  loadData();
});

loadData();