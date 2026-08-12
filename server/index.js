const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const { TEAMS } = require("./teams");
const store = require("./store");

const PORT = process.env.PORT || 4000;
const TEAM_IDS = new Set(TEAMS.map((t) => t.id));

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/teams", (_req, res) => {
  res.json(TEAMS);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

function isValidTeam(teamId) {
  return TEAM_IDS.has(teamId);
}

function isValidTimeStr(v) {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function teamNameOf(teamId) {
  return TEAMS.find((t) => t.id === teamId)?.name || teamId;
}

function extractHHMM(meetingTimeStr) {
  if (typeof meetingTimeStr !== "string") return null;
  const m = meetingTimeStr.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  const hhmm = `${m[1]}:${m[2]}`;
  return isValidTimeStr(hhmm) ? hhmm : null;
}

function addMinutesStr(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

io.on("connection", (socket) => {
  socket.emit("state:init", { teams: TEAMS, ...store.getState() });

  socket.on("goal:set", ({ content, updatedBy }) => {
    if (typeof content !== "string") return;
    const goal = store.setGoal(content, updatedBy);
    io.emit("goal:update", goal);
  });

  socket.on("task:create", ({ teamId, time, endTime, title, memo }) => {
    if (!isValidTeam(teamId)) return;
    if (typeof title !== "string" || !title.trim()) return;
    if (!isValidTimeStr(time) || !isValidTimeStr(endTime)) return;
    const task = {
      id: nanoid(10),
      teamId,
      date: store.todayStr(),
      time,
      endTime,
      title: title.trim().slice(0, 200),
      memo: typeof memo === "string" ? memo.slice(0, 500) : "",
      done: false,
      createdAt: new Date().toISOString(),
    };
    store.addTask(task);
    io.emit("task:create", task);
  });

  socket.on("task:update", ({ id, patch }) => {
    if (typeof id !== "string" || !patch || typeof patch !== "object") return;
    const allowed = {};
    if (typeof patch.title === "string") allowed.title = patch.title.trim().slice(0, 200);
    if (isValidTimeStr(patch.time)) allowed.time = patch.time;
    if (isValidTimeStr(patch.endTime)) allowed.endTime = patch.endTime;
    if (typeof patch.memo === "string") allowed.memo = patch.memo.slice(0, 500);
    if (typeof patch.done === "boolean") allowed.done = patch.done;
    const updated = store.updateTask(id, allowed);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("task:delete", ({ id }) => {
    if (typeof id !== "string") return;
    const removed = store.deleteTask(id);
    if (removed) io.emit("task:delete", { id });
  });

  socket.on("collab:create", ({ fromTeam, toTeam, meetingTime, agenda, requestedBy }) => {
    if (!isValidTeam(fromTeam) || !isValidTeam(toTeam)) return;
    if (fromTeam === toTeam) return;
    const reqObj = {
      id: nanoid(10),
      date: store.todayStr(),
      fromTeam,
      toTeam,
      meetingTime: typeof meetingTime === "string" ? meetingTime.slice(0, 40) : "",
      agenda: typeof agenda === "string" ? agenda.trim().slice(0, 1000) : "",
      requestedBy: typeof requestedBy === "string" ? requestedBy.slice(0, 100) : "",
      status: "pending",
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    store.addCollabRequest(reqObj);
    io.emit("collab:create", reqObj);
  });

  socket.on("collab:update", ({ id, patch }) => {
    if (typeof id !== "string" || !patch || typeof patch !== "object") return;
    const allowed = {};
    if (typeof patch.status === "string" && ["pending", "confirmed", "declined"].includes(patch.status)) {
      allowed.status = patch.status;
      allowed.respondedAt = new Date().toISOString();
    }
    if (typeof patch.meetingTime === "string") allowed.meetingTime = patch.meetingTime.slice(0, 40);
    if (typeof patch.agenda === "string") allowed.agenda = patch.agenda.trim().slice(0, 1000);
    if (typeof patch.suggestedTime === "string") allowed.suggestedTime = patch.suggestedTime.slice(0, 40);
    if (typeof patch.declineNote === "string") allowed.declineNote = patch.declineNote.trim().slice(0, 500);
    const updated = store.updateCollabRequest(id, allowed);
    if (!updated) return;
    io.emit("collab:update", updated);

    if (allowed.status === "confirmed") {
      const hhmm = extractHHMM(updated.meetingTime);
      if (hhmm) {
        const task = {
          id: nanoid(10),
          teamId: updated.toTeam,
          date: store.todayStr(),
          time: hhmm,
          endTime: addMinutesStr(hhmm, 30),
          title: updated.agenda ? updated.agenda.slice(0, 200) : `${teamNameOf(updated.fromTeam)} 협업 미팅`,
          memo: `${teamNameOf(updated.fromTeam)}과의 협업 요청에서 자동 생성됨`,
          collabWith: updated.fromTeam,
          done: false,
          createdAt: new Date().toISOString(),
        };
        store.addTask(task);
        io.emit("task:create", task);
      }
    }
  });

  socket.on("collab:remind", ({ id }) => {
    if (typeof id !== "string") return;
    const updated = store.remindCollabRequest(id);
    if (!updated) return;
    io.emit("collab:update", updated);
    io.emit("collab:remind", { id, toTeam: updated.toTeam });
  });

  socket.on("collab:delete", ({ id }) => {
    if (typeof id !== "string") return;
    const removed = store.deleteCollabRequest(id);
    if (removed) io.emit("collab:delete", { id });
  });
});

server.listen(PORT, () => {
  console.log(`SimpleWorkFlow server listening on http://localhost:${PORT}`);
});
