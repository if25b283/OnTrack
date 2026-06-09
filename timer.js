import { supabase } from "./supabase-config.js";

const { data: { user } } = await supabase.auth.getUser();
if (!user) { window.location.href = "login.html"; }

// ---- State ----
let timer = null;
let isRunning = false;
let currentMode = "study";
let studyTime = 25;
let breakTime = 5;
let remainingSeconds = studyTime * 60;
let originalTitle = document.title;
let blinkInterval = null;

// ---- Elements ----
const display = document.getElementById("display");
const startPauseBtn = document.getElementById("startPauseBtn");
const playPauseIcon = document.getElementById("playPauseIcon");
const startPauseLabel = document.getElementById("startPauseLabel");
const resetBtn = document.getElementById("resetBtn");
const settingsBtn = document.getElementById("settingsBtn");
const studyBtn = document.getElementById("studyBtn");
const breakBtn = document.getElementById("breakBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettingsBtn");
const saveSettings = document.getElementById("saveSettingsBtn");
const studyInput = document.getElementById("studyTimeInput");
const breakInput = document.getElementById("breakTimeInput");

// ---- Audio (Web Audio API beep) ----
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
    } catch (e) { }
}

// ---- Display ----
function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    document.title = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} – OnTrack`;
}

function setPlayIcon() {
    playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    startPauseLabel.textContent = "Start";
}

function setPauseIcon() {
    playPauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    startPauseLabel.textContent = "Pause";
}

// ---- Title blink ----
function startBlinkingTitle() {
    if (blinkInterval) clearInterval(blinkInterval);
    blinkInterval = setInterval(() => {
        document.title = document.title === "⏰ TIME'S UP!" ? originalTitle : "⏰ TIME'S UP!";
    }, 500);
}

function stopBlinkingTitle() {
    if (blinkInterval) clearInterval(blinkInterval);
    document.title = originalTitle;
}

// ---- Mode switch ----
function setMode(mode) {
    currentMode = mode;
    studyBtn.classList.toggle("active", mode === "study");
    breakBtn.classList.toggle("active", mode === "break");
    resetTimer();
}

// ---- Timer logic ----
function startPause() {
    stopBlinkingTitle();
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
        // Save to Supabase
        await supabase.from("pomodoro_time_tracking").insert({
            user_id: user.id,
            subject: "Study Session",
            minutes_studied: studyTime,
        });

        // Switch to break after 3 seconds
        setTimeout(() => {
            setMode("break");
            startPause();
        }, 3000);

    } else {
        // Break done → back to study, don't auto-start
        setTimeout(() => {
            setMode("study");
        }, 3000);
    }

    updateDisplay();
}

function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    stopBlinkingTitle();
    remainingSeconds = (currentMode === "study" ? studyTime : breakTime) * 60;
    setPlayIcon();
    updateDisplay();
}

// ---- Event Listeners ----
startPauseBtn.addEventListener("click", startPause);
resetBtn.addEventListener("click", resetTimer);
studyBtn.addEventListener("click", () => setMode("study"));
breakBtn.addEventListener("click", () => setMode("break"));

settingsBtn.addEventListener("click", () => {
    studyInput.value = studyTime;
    breakInput.value = breakTime;
    settingsModal.classList.add("active");
});

closeSettings.addEventListener("click", () => settingsModal.classList.remove("active"));
settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove("active");
});

saveSettings.addEventListener("click", () => {
    studyTime = parseInt(studyInput.value) || 25;
    breakTime = parseInt(breakInput.value) || 5;
    settingsModal.classList.remove("active");
    resetTimer();
});

// ---- Init ----
updateDisplay();