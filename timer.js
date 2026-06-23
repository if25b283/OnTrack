import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();

if (!user) {
    window.location.href = "login.html";
}

let timer = null;
let isRunning = false;
let currentMode = "study";
let studyTime = 25;
let breakTime = 5;
let remainingSeconds = studyTime * 60;
let originalTitle = document.title;
let blinkInterval = null;

let subjects = [];
let selectedSubject = localStorage.getItem(`selectedSubject_${user.id}`) || "";
let subjectStats = {};

const display = document.getElementById("display");
const startPauseBtn = document.getElementById("startPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");
const startPauseLabel = document.getElementById("startPauseLabel");
const resetBtn = document.getElementById("resetBtn");
const settingsBtn = document.getElementById("settingsBtn");
const studyBtn = document.getElementById("studyBtn");
const breakBtn = document.getElementById("breakBtn");

const settingsPopup = document.getElementById("settingsPopup");
const closeSettings = document.getElementById("closeSettingsBtn");
const saveSettings = document.getElementById("saveSettingsBtn");
const studyInput = document.getElementById("studyTimeInput");
const breakInput = document.getElementById("breakTimeInput");

const subjectButton = document.getElementById("subjectButton");
const subjectButtonTitle = document.getElementById("subjectButtonTitle");
const subjectButtonInfo = document.getElementById("subjectButtonInfo");
const subjectPopup = document.getElementById("subjectPopup");
const closeSubjectPopup = document.getElementById("closeSubjectPopup");
const newSubjectInput = document.getElementById("newSubjectInput");
const addSubjectBtn = document.getElementById("addSubjectBtn");
const subjectList = document.getElementById("subjectList");
const currentSubjectBox = document.getElementById("currentSubjectBox");

function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;

    display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    if (isRunning) {
        document.title = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} – OnTrack`;
    }
}

function setPlayIcon() {
    playPauseIcon.textContent = "▶";
    startPauseLabel.textContent = "Start";
}

function setPauseIcon() {
    playPauseIcon.textContent = "⏸";
    startPauseLabel.textContent = "Pause";
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1.5);
    } catch (e) {
        console.error(e);
    }
}

function startBlinkingTitle() {
    if (blinkInterval) {
        clearInterval(blinkInterval);
    }

    blinkInterval = setInterval(() => {
        document.title = document.title === "Time is up!" ? originalTitle : "Time is up!";
    }, 500);
}

function stopBlinkingTitle() {
    if (blinkInterval) {
        clearInterval(blinkInterval);
    }

    document.title = originalTitle;
}

function setMode(mode) {
    currentMode = mode;

    studyBtn.classList.toggle("active", mode === "study");
    breakBtn.classList.toggle("active", mode === "break");

    resetTimer();
}

function startPause() {
    stopBlinkingTitle();

    if (!isRunning && currentMode === "study" && !selectedSubject) {
        openSubjectPopup();
        return;
    }

    if (!isRunning) {
        isRunning = true;
        setPauseIcon();

        timer = setInterval(() => {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                updateDisplay();
            } else {
                handleTimerEnd();
            }
        }, 1000);
    } else {
        clearInterval(timer);
        isRunning = false;
        setPlayIcon();
    }
}

async function handleTimerEnd() {
    clearInterval(timer);
    isRunning = false;
    setPlayIcon();
    playBeep();
    startBlinkingTitle();

    if (currentMode === "study") {
        await saveStudyTime();

        setTimeout(() => {
            setMode("break");
            startPause();
        }, 3000);
    } else {
        setTimeout(() => {
            setMode("study");
        }, 3000);
    }

    updateDisplay();
}

async function saveStudyTime() {
    if (!selectedSubject) {
        return;
    }

    const { error } = await supabase
        .from("pomodoro_time_tracking")
        .insert({
            user_id: user.id,
            subject: selectedSubject,
            minutes_studied: studyTime
        });

    if (error) {
        console.error(error);
        alert("Lernzeit konnte nicht gespeichert werden.");
        return;
    }

    if (!subjectStats[selectedSubject]) {
        subjectStats[selectedSubject] = {
            total: 0,
            today: 0
        };
    }

    subjectStats[selectedSubject].total += studyTime;
    subjectStats[selectedSubject].today += studyTime;

    updateSubjectButton();
    renderSubjects();
}

function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    stopBlinkingTitle();

    remainingSeconds = (currentMode === "study" ? studyTime : breakTime) * 60;

    setPlayIcon();
    updateDisplay();
}

function openSubjectPopup() {
    subjectPopup.classList.add("active");
    renderSubjects();
    setTimeout(() => newSubjectInput.focus(), 100);
}

function closeSubjectModal() {
    subjectPopup.classList.remove("active");
    newSubjectInput.value = "";
}

function getStoredSubjects() {
    return JSON.parse(localStorage.getItem(`timerSubjects_${user.id}`)) || [];
}

function saveStoredSubjects() {
    localStorage.setItem(`timerSubjects_${user.id}`, JSON.stringify(subjects));
}

async function loadSubjects() {
    subjects = getStoredSubjects();
    subjectStats = {};

    const { data, error } = await supabase
        .from("pomodoro_time_tracking")
        .select("subject, minutes_studied, tracked_at")
        .eq("user_id", user.id);

    if (!error && data) {
        const todayString = new Date().toDateString();

        data.forEach(entry => {
            const subject = entry.subject || "Study Session";
            const minutes = Number(entry.minutes_studied) || 0;
            const entryDate = new Date(entry.tracked_at).toDateString();

            if (!subjects.includes(subject)) {
                subjects.push(subject);
            }

            if (!subjectStats[subject]) {
                subjectStats[subject] = {
                    total: 0,
                    today: 0
                };
            }

            subjectStats[subject].total += minutes;

            if (entryDate === todayString) {
                subjectStats[subject].today += minutes;
            }
        });
    }

    subjects = [...new Set(subjects)];

    if (selectedSubject && !subjects.includes(selectedSubject)) {
        selectedSubject = "";
        localStorage.removeItem(`selectedSubject_${user.id}`);
    }

    saveStoredSubjects();
    updateSubjectButton();
    renderSubjects();
}

function addSubject() {
    const subject = newSubjectInput.value.trim();

    if (!subject) {
        return;
    }

    const existingSubject = subjects.find(s => s.toLowerCase() === subject.toLowerCase());

    if (existingSubject) {
        selectSubject(existingSubject);
    } else {
        subjects.push(subject);
        saveStoredSubjects();
        selectSubject(subject);
    }

    newSubjectInput.value = "";
    renderSubjects();
}

function selectSubject(subject) {
    selectedSubject = subject;
    localStorage.setItem(`selectedSubject_${user.id}`, selectedSubject);

    updateSubjectButton();
    renderSubjects();
    closeSubjectModal();
}

function updateSubjectButton() {
    if (!selectedSubject) {
        subjectButtonTitle.textContent = "📚 Lernfach auswählen";
        subjectButtonInfo.textContent = "Wähle ein Fach aus, bevor du lernst";
        currentSubjectBox.textContent = "Noch kein Fach ausgewählt";
        return;
    }

    const stats = subjectStats[selectedSubject] || {
        total: 0,
        today: 0
    };

    subjectButtonTitle.textContent = `📚 ${selectedSubject}`;
    subjectButtonInfo.textContent = `Heute: ${stats.today} min · Gesamt: ${stats.total} min`;
    currentSubjectBox.textContent = `Aktuelles Fach: ${selectedSubject}`;
}

function renderSubjects() {
    if (!subjectList) {
        return;
    }

    if (subjects.length === 0) {
        subjectList.innerHTML = `<p class="subject-empty">Noch keine Fächer vorhanden.</p>`;
        return;
    }

    subjectList.innerHTML = subjects.map(subject => {
        const stats = subjectStats[subject] || {
            total: 0,
            today: 0
        };

        return `
            <button class="subject-item ${subject === selectedSubject ? "active" : ""}" data-subject="${escapeHtml(subject)}">
                <span class="subject-name">${escapeHtml(subject)}</span>
                <span class="subject-time">Heute ${stats.today} min · Gesamt ${stats.total} min</span>
            </button>
        `;
    }).join("");

    subjectList.querySelectorAll(".subject-item").forEach(item => {
        item.addEventListener("click", () => {
            selectSubject(item.dataset.subject);
        });
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

startPauseBtn.addEventListener("click", startPause);
resetBtn.addEventListener("click", resetTimer);
studyBtn.addEventListener("click", () => setMode("study"));
breakBtn.addEventListener("click", () => setMode("break"));

settingsBtn.addEventListener("click", () => {
    studyInput.value = studyTime;
    breakInput.value = breakTime;
    settingsPopup.classList.add("active");
});

closeSettings.addEventListener("click", () => {
    settingsPopup.classList.remove("active");
});

saveSettings.addEventListener("click", () => {
    studyTime = parseInt(studyInput.value) || 25;
    breakTime = parseInt(breakInput.value) || 5;

    settingsPopup.classList.remove("active");
    resetTimer();
});

subjectButton.addEventListener("click", openSubjectPopup);
closeSubjectPopup.addEventListener("click", closeSubjectModal);
addSubjectBtn.addEventListener("click", addSubject);

newSubjectInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        addSubject();
    }
});

subjectPopup.addEventListener("click", e => {
    if (e.target === subjectPopup) {
        closeSubjectModal();
    }
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        settingsPopup.classList.remove("active");
        closeSubjectModal();
    }
});

await loadSubjects();
updateDisplay();