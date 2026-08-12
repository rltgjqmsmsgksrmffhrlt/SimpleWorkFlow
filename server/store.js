const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "data.json");

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

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = emptyState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      goal: parsed.goal || emptyState().goal,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      collabRequests: Array.isArray(parsed.collabRequests) ? parsed.collabRequests : [],
    };
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
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
  return state.tasks.length !== before;
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
  todayStr,
  getState,
  setGoal,
  addTask,
  updateTask,
  deleteTask,
  addCollabRequest,
  updateCollabRequest,
  deleteCollabRequest,
  remindCollabRequest,
};
