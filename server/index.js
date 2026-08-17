const http = require("http");
const path = require("path");
const fs = require("fs");
const { spawn, exec } = require("child_process");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const { TEAMS } = require("./teams");
const store = require("./store");
const { baseDir } = require("./paths");

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

const clientDist = path.join(__dirname, "public");
app.use(express.static(clientDist));

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

const TASK_STATUSES = ["pending", "in_progress", "done"];

const PLACE_PLATFORMS = ["discord", "zep", "other"];

io.on("connection", (socket) => {
  socket.emit("state:init", {
    teams: TEAMS,
    dayStart: store.DAY_START,
    dayEnd: store.DAY_END,
    ...store.getState(),
  });

  socket.on("goal:set", ({ content, updatedBy }) => {
    if (typeof content !== "string") return;
    const goal = store.setGoal(content, updatedBy);
    io.emit("goal:update", goal);
  });

  socket.on("task:create", ({ teamId, time, endTime, title, memo, assignee }, callback) => {
    const ack = typeof callback === "function" ? callback : () => {};
    if (!isValidTeam(teamId)) return ack(null);
    if (typeof title !== "string" || !title.trim()) return ack(null);
    if (!isValidTimeStr(time) || !isValidTimeStr(endTime)) return ack(null);
    const task = {
      id: nanoid(10),
      teamId,
      date: store.todayStr(),
      time,
      endTime,
      title: title.trim().slice(0, 200),
      memo: typeof memo === "string" ? memo.slice(0, 500) : "",
      assignee: typeof assignee === "string" ? assignee.trim().slice(0, 60) : "",
      subtasks: [],
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    store.addTask(task);
    io.emit("task:create", task);
    ack(task);
  });

  socket.on("task:update", ({ id, patch }) => {
    if (typeof id !== "string" || !patch || typeof patch !== "object") return;
    const allowed = {};
    if (typeof patch.title === "string") allowed.title = patch.title.trim().slice(0, 200);
    if (isValidTimeStr(patch.time)) allowed.time = patch.time;
    if (isValidTimeStr(patch.endTime)) allowed.endTime = patch.endTime;
    if (typeof patch.memo === "string") allowed.memo = patch.memo.slice(0, 500);
    if (typeof patch.status === "string" && TASK_STATUSES.includes(patch.status)) allowed.status = patch.status;
    if (typeof patch.assignee === "string") allowed.assignee = patch.assignee.trim().slice(0, 60);
    const updated = store.updateTask(id, allowed);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("task:delete", ({ id }) => {
    if (typeof id !== "string") return;
    const removed = store.deleteTask(id);
    if (removed) io.emit("task:delete", { id: removed.id });
  });

  socket.on("task:subtask:add", ({ taskId, title, assignee }) => {
    if (typeof taskId !== "string" || typeof title !== "string" || !title.trim()) return;
    const sub = {
      id: nanoid(8),
      title: title.trim().slice(0, 150),
      assignee: typeof assignee === "string" ? assignee.trim().slice(0, 60) : "",
      done: false,
    };
    const updated = store.addSubtask(taskId, sub);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("task:subtask:update", ({ taskId, subtaskId, patch }) => {
    if (typeof taskId !== "string" || typeof subtaskId !== "string" || !patch) return;
    const allowed = {};
    if (typeof patch.title === "string" && patch.title.trim()) allowed.title = patch.title.trim().slice(0, 150);
    if (typeof patch.assignee === "string") allowed.assignee = patch.assignee.trim().slice(0, 60);
    const updated = store.updateSubtask(taskId, subtaskId, allowed);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("task:subtask:toggle", ({ taskId, subtaskId }) => {
    if (typeof taskId !== "string" || typeof subtaskId !== "string") return;
    const updated = store.toggleSubtask(taskId, subtaskId);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("task:subtask:delete", ({ taskId, subtaskId }) => {
    if (typeof taskId !== "string" || typeof subtaskId !== "string") return;
    const updated = store.deleteSubtask(taskId, subtaskId);
    if (updated) io.emit("task:update", updated);
  });

  socket.on("collab:create", ({ fromTeam, toTeam, meetingTime, agenda, requestedBy }) => {
    if (!isValidTeam(fromTeam) || !isValidTeam(toTeam)) return;
    if (fromTeam === toTeam) return;
    const date = store.todayStr();

    // Ringing the same team's bell again while a request is still pending just
    // stacks onto that one card (reminds them) instead of creating a duplicate.
    const existing = store
      .getState()
      .collabRequests.find(
        (r) => r.fromTeam === fromTeam && r.toTeam === toTeam && r.status === "pending" && r.date === date
      );
    if (existing) {
      const updated = store.remindCollabRequest(existing.id);
      if (updated) {
        io.emit("collab:update", updated);
        io.emit("collab:remind", { id: updated.id, toTeam: updated.toTeam });
      }
      return;
    }

    const reqObj = {
      id: nanoid(10),
      date,
      fromTeam,
      toTeam,
      meetingTime: typeof meetingTime === "string" ? meetingTime.slice(0, 40) : "",
      agenda: typeof agenda === "string" ? agenda.trim().slice(0, 1000) : "",
      // Place is chosen by the requesting team, time by the receiving team.
      placePlatform: "",
      placeRoom: "",
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
    if (typeof patch.declineNote === "string") allowed.declineNote = patch.declineNote.trim().slice(0, 500);
    if (typeof patch.placePlatform === "string" && (patch.placePlatform === "" || PLACE_PLATFORMS.includes(patch.placePlatform))) {
      allowed.placePlatform = patch.placePlatform;
    }
    if (typeof patch.placeRoom === "string") allowed.placeRoom = patch.placeRoom.trim().slice(0, 60);

    // The receiving team owns the time, and setting it IS the confirmation —
    // clearing it drops the request back to pending.
    if (typeof allowed.meetingTime === "string" && allowed.status === undefined) {
      const nextStatus = allowed.meetingTime ? "confirmed" : "pending";
      allowed.status = nextStatus;
      allowed.respondedAt = allowed.meetingTime ? new Date().toISOString() : null;
    }

    const updated = store.updateCollabRequest(id, allowed);
    if (!updated) return;
    io.emit("collab:update", updated);
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

// Only the packaged .exe auto-starts a public tunnel and opens the browser;
// plain `npm run dev` leaves that to the developer's own workflow.
//
// Two tunnel modes:
//  - ngrok, when ngrok-domain.txt holds a domain. The URL is FIXED across restarts,
//    but ngrok must be installed separately (Microsoft Store) — we deliberately do
//    NOT bundle its binary, because Windows Defender flags the standalone download.
//  - cloudflared quick tunnel otherwise. Zero setup, but a NEW random URL each launch.
const NGROK_DOMAIN_FILE = "ngrok-domain.txt";

const NGROK_SETUP_HELP = [
  "  1) Microsoft Store 에서 ngrok 설치",
  "  2) ngrok config add-authtoken <본인 authtoken>",
  `  3) ${NGROK_DOMAIN_FILE} 에 본인 고정 도메인 적기`,
].join("\n");

function announceUrl(url, isFixed) {
  console.log("\n=======================================================");
  console.log(` 외부 공유 주소: ${url}`);
  console.log(isFixed ? " (고정 주소 — 재시작해도 바뀌지 않습니다)" : " (임시 주소 — 재시작하면 바뀝니다)");
  console.log(" 이 주소를 다른 사람에게 보내면 인터넷으로 접속할 수 있습니다.");
  console.log("=======================================================\n");
}

function readNgrokDomain() {
  const file = path.join(baseDir, NGROK_DOMAIN_FILE);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      [
        "# 이 파일 맨 아래에 ngrok 무료 고정 도메인을 한 줄로 적으세요.",
        "# 예: lymphatolytic-suitably-derick.ngrok-free.dev",
        "#",
        "# 최초 1회 준비:",
        ...NGROK_SETUP_HELP.split("\n").map((l) => `#${l}`),
        "#",
        "# 비워두면 실행할 때마다 주소가 바뀌는 임시 터널을 씁니다.",
        "",
      ].join("\r\n"),
      "utf-8"
    );
    return null;
  }
  const line = fs
    .readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  if (!line) return null;
  const domain = line.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  // This value reaches a shell, so keep it strictly hostname-shaped.
  if (!/^[a-z0-9.-]+$/i.test(domain)) {
    console.log(`\n[알림] ${NGROK_DOMAIN_FILE} 의 도메인 형식이 올바르지 않습니다: ${line}\n`);
    return null;
  }
  return domain;
}

function startQuickTunnel(port) {
  const dest = path.join(baseDir, "cloudflared.exe");
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, fs.readFileSync(path.join(__dirname, "bin", "cloudflared.exe")));
  }
  const child = spawn(dest, ["tunnel", "--url", `http://localhost:${port}`]);
  let announced = false;
  const onOutput = (chunk) => {
    if (announced) return;
    const match = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      announced = true;
      announceUrl(match[0], false);
    }
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);
  process.on("exit", () => child.kill());
  return child;
}

function startNgrokTunnel(port, domain, onUnavailable) {
  // shell:true so the Microsoft Store app-execution alias resolves off PATH.
  const child = spawn("ngrok", ["http", `--url=${domain}`, String(port), "--log", "stdout"], {
    shell: true,
  });
  let settled = false;
  const giveUp = (reason) => {
    if (settled) return;
    settled = true;
    console.log(`\n[알림] ngrok을 실행하지 못했습니다 (${reason}). 임시 주소로 대체합니다.`);
    console.log(NGROK_SETUP_HELP + "\n");
    onUnavailable();
  };

  const onOutput = (chunk) => {
    const text = chunk.toString();
    if (!settled && /url=https:\/\//.test(text)) {
      settled = true;
      announceUrl(`https://${domain}`, true);
      return;
    }
    const err = text.match(/ERR_NGROK_\d+|ERROR:.*/);
    if (err) console.log(`[ngrok] ${err[0]}`);
  };
  child.stdout.on("data", onOutput);
  child.stderr.on("data", onOutput);
  child.on("error", () => giveUp("설치되지 않음"));
  child.on("exit", (code) => {
    if (code !== 0) giveUp(`종료 코드 ${code}`);
  });
  process.on("exit", () => child.kill());
  return child;
}

function startTunnel(port) {
  const domain = readNgrokDomain();
  if (domain) {
    startNgrokTunnel(port, domain, () => startQuickTunnel(port));
    return;
  }
  console.log(`\n[알림] ${NGROK_DOMAIN_FILE} 에 고정 도메인을 적으면 항상 같은 주소를 쓸 수 있습니다.`);
  console.log(NGROK_SETUP_HELP + "\n");
  startQuickTunnel(port);
}

function openBrowser(url) {
  if (process.platform === "win32") exec(`start "" "${url}"`);
}

server.listen(PORT, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log(`SimpleWorkFlow server listening on ${localUrl}`);
  if (process.pkg) {
    startTunnel(PORT);
    openBrowser(localUrl);
  }
});
