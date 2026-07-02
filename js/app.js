/* ==========================================================================
   Life Dashboard — App Logic
   Vanilla JS, no frameworks. All data persisted in Local Storage.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Storage keys
     --------------------------------------------------------------------- */
  const KEYS = {
    NAME: "dashboard_user_name",
    THEME: "dashboard_theme",
    TASKS: "dashboard_tasks",
    LINKS: "dashboard_links",
    POMODORO_MIN: "dashboard_pomodoro_minutes",
    SORT_DIR: "dashboard_sort_dir"
  };

  const DEFAULT_LINKS = [
    { name: "Google", url: "https://www.google.com" },
    { name: "Gmail", url: "https://mail.google.com" },
    { name: "Calendar", url: "https://calendar.google.com" }
  ];

  /* ---------------------------------------------------------------------
     Utilities
     --------------------------------------------------------------------- */
  function pad(n) { return String(n).padStart(2, "0"); }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeUrl(url) {
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return url;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* =======================================================================
     1. GREETING CARD — clock, date, time-of-day greeting, custom name
     ======================================================================= */

  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("dateLine");
  const greetingEl = document.getElementById("greeting");
  const editNameBtn = document.getElementById("editNameBtn");

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function getGreetingWord(hour) {
    if (hour < 5) return "Good Night";
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }

  function getUserName() {
    return localStorage.getItem(KEYS.NAME) || "";
  }

  function renderGreeting() {
    const now = new Date();

    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dateEl.textContent = `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

    const name = getUserName();
    greetingEl.textContent = name ? `${getGreetingWord(now.getHours())}, ${name}` : getGreetingWord(now.getHours());
  }

  editNameBtn.addEventListener("click", () => {
    const current = getUserName();
    const input = window.prompt("What should we call you?", current);
    if (input === null) return; // cancelled
    const trimmed = input.trim();
    if (trimmed) {
      localStorage.setItem(KEYS.NAME, trimmed);
    } else {
      localStorage.removeItem(KEYS.NAME);
    }
    renderGreeting();
  });

  renderGreeting();
  setInterval(renderGreeting, 1000);

  /* =======================================================================
     2. THEME — light / dark mode toggle (Challenge)
     ======================================================================= */

  const themeToggleBtn = document.getElementById("themeToggle");
  const sunIcon = document.getElementById("themeIconSun");
  const moonIcon = document.getElementById("themeIconMoon");

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    sunIcon.style.display = theme === "dark" ? "none" : "block";
    moonIcon.style.display = theme === "dark" ? "block" : "none";
  }

  function initTheme() {
    const saved = localStorage.getItem(KEYS.THEME);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }

  themeToggleBtn.addEventListener("click", () => {
    const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(KEYS.THEME, next);
  });

  initTheme();

  /* =======================================================================
     3. FOCUS TIMER — 25 min default, start/stop/reset, editable length
     ======================================================================= */

  const timerDisplay = document.getElementById("timerDisplay");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");
  const editDurationBtn = document.getElementById("editDurationBtn");

  let pomodoroMinutes = parseInt(localStorage.getItem(KEYS.POMODORO_MIN), 10) || 25;
  let remainingSeconds = pomodoroMinutes * 60;
  let timerInterval = null;
  let isRunning = false;

  function renderTimer() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    timerDisplay.textContent = `${pad(m)}:${pad(s)}`;
  }

  function setRunningState(running) {
    isRunning = running;
    startBtn.disabled = running;
    stopBtn.disabled = !running;
  }

  function tick() {
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      setRunningState(false);
      timerDisplay.textContent = "00:00";
      return;
    }
    remainingSeconds -= 1;
    renderTimer();
  }

  startBtn.addEventListener("click", () => {
    if (isRunning || remainingSeconds <= 0) return;
    setRunningState(true);
    timerInterval = setInterval(tick, 1000);
  });

  stopBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    setRunningState(false);
  });

  resetBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    setRunningState(false);
    remainingSeconds = pomodoroMinutes * 60;
    renderTimer();
  });

  editDurationBtn.addEventListener("click", () => {
    const input = window.prompt("Set focus timer length in minutes:", pomodoroMinutes);
    if (input === null) return;
    const minutes = parseInt(input, 10);
    if (!minutes || minutes <= 0 || minutes > 180) {
      window.alert("Please enter a number between 1 and 180.");
      return;
    }
    pomodoroMinutes = minutes;
    localStorage.setItem(KEYS.POMODORO_MIN, String(minutes));
    clearInterval(timerInterval);
    setRunningState(false);
    remainingSeconds = pomodoroMinutes * 60;
    renderTimer();
  });

  setRunningState(false);
  renderTimer();

  /* =======================================================================
     4. TASKS — add / edit / complete / delete, duplicate guard, sort
     ======================================================================= */

  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const taskList = document.getElementById("taskList");
  const taskWarning = document.getElementById("taskWarning");
  const taskEmpty = document.getElementById("taskEmpty");
  const sortTasksBtn = document.getElementById("sortTasksBtn");

  let tasks = loadJSON(KEYS.TASKS, []);
  let sortDir = localStorage.getItem(KEYS.SORT_DIR) || "none"; // 'none' | 'asc' | 'desc'

  function persistTasks() {
    saveJSON(KEYS.TASKS, tasks);
  }

  function getVisibleTasks() {
    const list = tasks.slice();
    if (sortDir === "asc") {
      list.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: "base" }));
    } else if (sortDir === "desc") {
      list.sort((a, b) => b.text.localeCompare(a.text, undefined, { sensitivity: "base" }));
    }
    return list;
  }

  function renderTasks() {
    const visible = getVisibleTasks();
    taskList.innerHTML = "";
    taskEmpty.style.display = tasks.length === 0 ? "block" : "none";

    visible.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.done ? " done" : "");
      li.dataset.id = task.id;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "task-checkbox";
      checkbox.checked = task.done;
      checkbox.addEventListener("change", () => toggleDone(task.id));

      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = task.text;
      text.contentEditable = "true";
      text.spellcheck = false;

      text.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          text.blur();
        }
      });
      text.addEventListener("blur", () => saveEditedText(task.id, text));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "task-delete";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => deleteTask(task.id));

      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(deleteBtn);
      taskList.appendChild(li);
    });
  }

  function isDuplicate(text, excludeId) {
    const normalized = text.trim().toLowerCase();
    return tasks.some((t) => t.id !== excludeId && t.text.trim().toLowerCase() === normalized);
  }

  function showWarning(msg) {
    taskWarning.textContent = msg;
    clearTimeout(showWarning._t);
    showWarning._t = setTimeout(() => { taskWarning.textContent = ""; }, 2500);
  }

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isDuplicate(trimmed, null)) {
      showWarning("That task is already on your list.");
      return;
    }
    tasks.push({ id: uid(), text: trimmed, done: false });
    persistTasks();
    renderTasks();
  }

  function toggleDone(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    persistTasks();
    renderTasks();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    persistTasks();
    renderTasks();
  }

  function saveEditedText(id, element) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newText = element.textContent.trim();

    if (!newText) {
      deleteTask(id);
      return;
    }
    if (isDuplicate(newText, id)) {
      showWarning("Another task already has that name.");
      element.textContent = task.text; // revert
      return;
    }
    task.text = newText;
    persistTasks();
    renderTasks();
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(taskInput.value);
    taskInput.value = "";
    taskInput.focus();
  });

  sortTasksBtn.addEventListener("click", () => {
    sortDir = sortDir === "asc" ? "desc" : sortDir === "desc" ? "none" : "asc";
    localStorage.setItem(KEYS.SORT_DIR, sortDir);
    sortTasksBtn.textContent = sortDir === "asc" ? "sort: a-z" : sortDir === "desc" ? "sort: z-a" : "sort";
    renderTasks();
  });

  sortTasksBtn.textContent = sortDir === "asc" ? "sort: a-z" : sortDir === "desc" ? "sort: z-a" : "sort";
  renderTasks();

  /* =======================================================================
     5. QUICK LINKS — add / delete, seeded defaults on first run
     ======================================================================= */

  const linkForm = document.getElementById("linkForm");
  const linkNameInput = document.getElementById("linkName");
  const linkUrlInput = document.getElementById("linkUrl");
  const linkList = document.getElementById("linkList");

  let links = loadJSON(KEYS.LINKS, null);
  if (links === null) {
    links = DEFAULT_LINKS.map((l) => ({ id: uid(), ...l }));
    saveJSON(KEYS.LINKS, links);
  }

  function persistLinks() {
    saveJSON(KEYS.LINKS, links);
  }

  function renderLinks() {
    linkList.innerHTML = "";
    links.forEach((link) => {
      const a = document.createElement("a");
      a.className = "link-chip";
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      const label = document.createElement("span");
      label.textContent = link.name;

      const removeBtn = document.createElement("button");
      removeBtn.className = "link-remove";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove link";
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteLink(link.id);
      });

      a.appendChild(label);
      a.appendChild(removeBtn);
      linkList.appendChild(a);
    });
  }

  function deleteLink(id) {
    links = links.filter((l) => l.id !== id);
    persistLinks();
    renderLinks();
  }

  linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = linkNameInput.value.trim();
    const rawUrl = linkUrlInput.value.trim();
    if (!name || !rawUrl) return;

    links.push({ id: uid(), name, url: normalizeUrl(rawUrl) });
    persistLinks();
    renderLinks();

    linkNameInput.value = "";
    linkUrlInput.value = "";
    linkNameInput.focus();
  });

  renderLinks();

})();
