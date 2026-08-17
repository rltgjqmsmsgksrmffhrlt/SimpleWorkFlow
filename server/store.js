const fs = require("fs");
const path = require("path");
const { baseDir } = require("./paths");

const DATA_FILE = path.join(baseDir, "data.json");

const DAY_START = "09:00";
const DAY_END = "17:50";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyState() {
  return {
    goal: { date: todayStr(), content: "", updatedBy: "", updatedAt: null },
    tasks: [],
    collabRequests: [],
  };
}

// Backfill fields that may be missing on tasks created before subtasks/status existed.
function migrateTasks(tasks) {
  for (const t of tasks) {
    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    if (!t.status) t.status = t.done ? "done" : "pending";
    if (typeof t.assignee !== "string") t.assignee = "";
    for (const s of t.subtasks) {
      if (typeof s.assignee !== "string") s.assignee = "";
    }
  }
  return tasks;
}

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = emptyState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const loaded = {
      goal: parsed.goal || emptyState().goal,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      collabRequests: Array.isArray(parsed.collabRequests) ? parsed.collabRequests : [],
    };
    migrateTasks(loaded.tasks);
    fs.writeFileSync(DATA_FILE, JSON.stringify(loaded, null, 2), "utf-8");
    return loaded;
  } catch (err) {
    console.error("Failed to read data.json, starting fresh:", err.message);
    return emptyState();
  }
}

let state = load();

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function getState() {
  return state;
}

function setGoal(content, updatedBy) {
  state.goal = {
    date: todayStr(),
    content: String(content || "").slice(0, 2000),
    updatedBy: String(updatedBy || "").slice(0, 100),
    updatedAt: new Date().toISOString(),
  };
  save();
  return state.goal;
}

function addTask(task) {
  state.tasks.push(task);
  save();
  return task;
}

function updateTask(id, patch) {
  const idx = state.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  state.tasks[idx] = { ...state.tasks[idx], ...patch, id };
  save();
  return state.tasks[idx];
}

function deleteTask(id) {
  const idx = state.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const [removed] = state.tasks.splice(idx, 1);
  save();
  return removed;
}

function addSubtask(taskId, subtask) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) return null;
  if (!Array.isArray(t.subtasks)) t.subtasks = [];
  t.subtasks.push(subtask);
  save();
  return t;
}

function toggleSubtask(taskId, subtaskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return null;
  const s = t.subtasks.find((x) => x.id === subtaskId);
  if (!s) return null;
  s.done = !s.done;
  save();
  return t;
}

function updateSubtask(taskId, subtaskId, patch) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return null;
  const idx = t.subtasks.findIndex((x) => x.id === subtaskId);
  if (idx === -1) return null;
  t.subtasks[idx] = { ...t.subtasks[idx], ...patch, id: subtaskId };
  save();
  return t;
}

function deleteSubtask(taskId, subtaskId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return null;
  t.subtasks = t.subtasks.filter((x) => x.id !== subtaskId);
  save();
  return t;
}

function addCollabRequest(reqObj) {
  state.collabRequests.push(reqObj);
  save();
  return reqObj;
}

function updateCollabRequest(id, patch) {
  const idx = state.collabRequests.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  state.collabRequests[idx] = { ...state.collabRequests[idx], ...patch, id };
  save();
  return state.collabRequests[idx];
}

function deleteCollabRequest(id) {
  const before = state.collabRequests.length;
  state.collabRequests = state.collabRequests.filter((r) => r.id !== id);
  save();
  return state.collabRequests.length !== before;
}

function remindCollabRequest(id) {
  const idx = state.collabRequests.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  if (state.collabRequests[idx].status !== "pending") return null;
  state.collabRequests[idx] = {
    ...state.collabRequests[idx],
    remindCount: (state.collabRequests[idx].remindCount || 0) + 1,
    lastRemindAt: new Date().toISOString(),
  };
  save();
  return state.collabRequests[idx];
}

module.exports = {
  DAY_START,
  DAY_END,
  todayStr,
  getState,
  setGoal,
  addTask,
  updateTask,
  deleteTask,
  addSubtask,
  toggleSubtask,
  updateSubtask,
  deleteSubtask,
  addCollabRequest,
  updateCollabRequest,
  deleteCollabRequest,
  remindCollabRequest,
};
