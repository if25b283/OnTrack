const calendarTitle = document.getElementById("calendarTitle");
const calendarGrid = document.getElementById("calendarGrid");

const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

const modal = document.getElementById("eventModal");
const closeModal = document.getElementById("closeModal");
const saveEvent = document.getElementById("saveEvent");
const eventTitle = document.getElementById("eventTitle");
const eventDate = document.getElementById("eventDate");

let today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

let events = JSON.parse(localStorage.getItem("calendarEvents")) || [];

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDate(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  calendarTitle.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const totalCells = Math.ceil((startDay + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < startDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "day muted";
    calendarGrid.appendChild(emptyDay);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateString = formatDate(currentYear, currentMonth, day);

    const dayBox = document.createElement("div");
    dayBox.className = "day";

    dayBox.innerHTML = `
      <span>${day}</span>
      <button class="add-event" data-date="${dateString}">+</button>
    `;

    events
      .filter(event => event.date === dateString)
      .forEach(event => {
        const eventElement = document.createElement("div");
        eventElement.className = "event-text";
        eventElement.textContent = event.title;
        dayBox.appendChild(eventElement);
      });

    calendarGrid.appendChild(dayBox);
  }

  const usedCells = startDay + lastDay.getDate();

  for (let i = usedCells; i < totalCells; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "day muted";
    calendarGrid.appendChild(emptyDay);
  }
}

document.addEventListener("click", function (e) {
  if (e.target.classList.contains("add-event")) {
    eventDate.value = e.target.dataset.date;
    eventTitle.value = "";
    modal.style.display = "flex";
  }
});

saveEvent.addEventListener("click", () => {
  const title = eventTitle.value.trim();
  const date = eventDate.value;

  if (title === "" || date === "") {
    alert("Bitte Titel und Datum eingeben!");
    return;
  }

  events.push({
    title: title,
    date: date
  });

  localStorage.setItem("calendarEvents", JSON.stringify(events));

  const selectedDate = new Date(date);
  currentYear = selectedDate.getFullYear();
  currentMonth = selectedDate.getMonth();

  modal.style.display = "none";
  renderCalendar();
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

prevMonth.addEventListener("click", () => {
  currentMonth--;

  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }

  renderCalendar();
});

nextMonth.addEventListener("click", () => {
  currentMonth++;

  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  renderCalendar();
});

renderCalendar();