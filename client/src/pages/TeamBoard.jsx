import React, { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { CheckIcon, PencilIcon, TrashIcon } from "../components/Icons.jsx";
import { MEETING_MINUTES, formatPlace } from "./Collab.jsx";
import { todayStr } from "../date";
import { LUNCH, fixedMeetingsFor } from "../schedule-rules";
import ExportMarkdown from "../components/ExportMarkdown.jsx";

const DURATION_PRESETS = [60, 180, 360];
const STATUS_ORDER = ["pending", "in_progress", "done"];

function nextStatus(status) {
  const idx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}
const STATUS_LABEL = { pending: "시작 전", in_progress: "진행 중", done: "완료" };

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const SNAP_MIN = 10;

function snap(min) {
  return Math.round(min / SNAP_MIN) * SNAP_MIN;
}

// Pure formatter — rounding here would misreport times that are already stored.
function minutesToLabel(min) {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function useNowHHMM() {
  const [now, setNow] = useState(nowHHMM);
  useEffect(() => {
    const id = setInterval(() => setNow(nowHHMM()), 15000);
    return () => clearInterval(id);
  }, []);
  return now;
}


// Typing a time is slow when you just want "a bit later". Each half is a wheel:
// drag it up/down or spin the mouse wheel over it. Typing still works.
function TimeWheel({ value, onChange }) {
  const [h, m] = (value || "00:00").split(":").map(Number);

  function bump(field, steps) {
    if (!steps) return;
    const cur = (h || 0) * 60 + (m || 0);
    const delta = field === "h" ? steps * 60 : steps * SNAP_MIN;
    const next = (((cur + delta) % 1440) + 1440) % 1440;
    onChange(minutesToLabel(field === "h" ? next : snap(next)));
  }

  function startDrag(e, field) {
    if (e.button !== 0) return;
    e.preventDefault();
    let lastY = e.clientY;
    function onMove(ev) {
      // One notch per 12px of travel; upward increases.
      const steps = Math.trunc((lastY - ev.clientY) / 12);
      if (steps) {
        bump(field, steps);
        lastY -= steps * 12;
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <span className="time-wheel">
      <span
        className="tw-part"
        onMouseDown={(e) => startDrag(e, "h")}
        onWheel={(e) => bump("h", e.deltaY < 0 ? 1 : -1)}
        title="드래그하거나 휠을 돌려 시간 변경"
      >
        {pad2(h || 0)}
      </span>
      <span className="tw-sep">:</span>
      <span
        className="tw-part"
        onMouseDown={(e) => startDrag(e, "m")}
        onWheel={(e) => bump("m", e.deltaY < 0 ? 1 : -1)}
        title={`드래그하거나 휠을 돌려 분 변경 (${SNAP_MIN}분 단위)`}
      >
        {pad2(m || 0)}
      </span>
      <input
        type="time"
        className="tw-native"
        value={value}
        step={SNAP_MIN * 60}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        tabIndex={-1}
        aria-label="시간 직접 입력"
      />
    </span>
  );
}

function TimeRangeField({ time, endTime, onChangeTime, onChangeEndTime }) {
  function applyPreset(minutes) {
    const start = time || nowHHMM();
    if (!time) onChangeTime(start);
    onChangeEndTime(addMinutes(start, minutes));
  }

  return (
    <div className="duration-field">
      <div className="task-time-range">
        <TimeWheel value={time} onChange={onChangeTime} />
        <span className="time-range-sep">~</span>
        <TimeWheel value={endTime} onChange={onChangeEndTime} />
      </div>
      <div className="duration-presets">
        {DURATION_PRESETS.map((m) => (
          <button key={m} type="button" className="duration-preset-btn" onClick={() => applyPreset(m)}>
            {m >= 60 ? `${m / 60}시간` : `${m}분`}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubtaskPanel({ task, addSubtask, toggleSubtask, deleteSubtask }) {
  const [text, setText] = useState("");
  const subtasks = task.subtasks || [];

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addSubtask(task.id, text.trim());
    setText("");
  }

  return (
    <div className="subtask-panel">
      {subtasks.map((s) => (
        <div key={s.id} className="subtask-row">
          <button
            className={`subtask-check ${s.done ? "checked" : ""}`}
            onClick={() => toggleSubtask(task.id, s.id)}
            title={s.done ? "완료 취소" : "완료 처리"}
          >
            {s.done && <CheckIcon size={9} />}
          </button>
          <span className={`subtask-title ${s.done ? "done" : ""}`}>{s.title}</span>
          <button className="subtask-del" onClick={() => deleteSubtask(task.id, s.id)} title="삭제">
            <TrashIcon size={11} />
          </button>
        </div>
      ))}
      <form className="subtask-add-form" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="하위 과업 추가"
          maxLength={150}
        />
        <button type="submit" className="btn-ghost small">
          추가
        </button>
      </form>
    </div>
  );
}



function CreateTaskPopup({ teamLabel, initialTime, initialEndTime, onClose, onCreate }) {
  const [time, setTime] = useState(initialTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [title, setTitle] = useState("");
  const [subtaskDrafts, setSubtaskDrafts] = useState([]);
  const [subtaskText, setSubtaskText] = useState("");
  const [saving, setSaving] = useState(false);

  function addSubtaskDraft() {
    if (!subtaskText.trim()) return;
    setSubtaskDrafts((prev) => [...prev, subtaskText.trim()]);
    setSubtaskText("");
  }

  function removeSubtaskDraft(idx) {
    setSubtaskDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !time || !endTime || saving) return;
    setSaving(true);
    await onCreate({ time, endTime, title: title.trim(), subtasks: subtaskDrafts });
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{teamLabel} · 새 과업</h3>
          <button type="button" className="modal-close" onClick={onClose} title="닫기">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <TimeRangeField
            time={time}
            endTime={endTime}
            onChangeTime={setTime}
            onChangeEndTime={setEndTime}
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="과업 이름"
            maxLength={200}
            autoFocus
          />
          <div className="modal-subtasks">
            <div className="modal-subtasks-label">하위 과업 (선택)</div>
            {subtaskDrafts.map((s, i) => (
              <div key={i} className="subtask-draft-row">
                <span>{s}</span>
                <button type="button" className="subtask-del" onClick={() => removeSubtaskDraft(i)}>
                  <TrashIcon size={11} />
                </button>
              </div>
            ))}
            <div className="subtask-add-form">
              <input
                type="text"
                value={subtaskText}
                onChange={(e) => setSubtaskText(e.target.value)}
                placeholder="하위 과업 입력 후 추가"
                maxLength={150}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubtaskDraft();
                  }
                }}
              />
              <button type="button" className="btn-ghost small" onClick={addSubtaskDraft}>
                추가
              </button>
            </div>
          </div>
          <div className="task-add-actions">
            <button type="button" className="btn-ghost small" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary small" disabled={saving}>
              {saving ? "저장 중..." : "저장하고 닫기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTaskPopup({ task, teamLabel, onClose }) {
  const { updateTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask } = useWorkflow();
  const [time, setTime] = useState(task.time);
  const [endTime, setEndTime] = useState(task.endTime);
  const [title, setTitle] = useState(task.title);

  function save(e) {
    e.preventDefault();
    if (!title.trim() || !time || !endTime) return;
    updateTask(task.id, { title: title.trim(), time, endTime });
    onClose();
  }

  function remove() {
    deleteTask(task.id);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{teamLabel} · 과업 수정</h3>
          <button type="button" className="modal-close" onClick={onClose} title="닫기">
            ×
          </button>
        </div>
        <form onSubmit={save} className="modal-body">
          <TimeRangeField time={time} endTime={endTime} onChangeTime={setTime} onChangeEndTime={setEndTime} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="과업 이름"
            maxLength={200}
            autoFocus
          />

          <div className="modal-status-row">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`status-pick ${s} ${task.status === s ? "active" : ""}`}
                onClick={() => updateTask(task.id, { status: s })}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="modal-subtasks">
            <div className="modal-subtasks-label">하위 과업</div>
            <SubtaskPanel
              task={task}
              addSubtask={addSubtask}
              toggleSubtask={toggleSubtask}
              deleteSubtask={deleteSubtask}
            />
          </div>

          <div className="task-add-actions">
            <button type="button" className="btn-ghost small danger" onClick={remove}>
              삭제
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-ghost small" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary small">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Everything in the chart is positioned as a percentage of the day, so the whole
// day always fills exactly the height the layout gives it — it can never overflow,
// at any window size, with no measurement to fall out of sync.

// A confirmed collab request is not stored as a task — it is drawn straight from
// the request, on BOTH teams' columns, so the two sides can never drift apart.
function useMeetingBlocks(collabRequests) {
  return useMemo(() => {
    const today = todayStr();
    const blocks = [];
    for (const r of collabRequests) {
      if (r.status !== "confirmed" || !r.meetingTime) continue;
      const m = r.meetingTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
      if (!m || m[1] !== today) continue;
      const startMin = Number(m[2]) * 60 + Number(m[3]);
      blocks.push({
        id: r.id,
        startMin,
        endMin: startMin + MEETING_MINUTES,
        agenda: r.agenda,
        place: formatPlace(r),
        fromTeam: r.fromTeam,
        toTeam: r.toTeam,
      });
    }
    return blocks;
  }, [collabRequests]);
}

// Schedules usually arrive pasted from meeting notes or a WBS, so accept that
// shape directly instead of making people retype them one form at a time.
// Deliberately permissive — the modal shows exactly what was understood before
// anything is created, so a wrong guess is visible rather than silent.
export function parsePastedSchedule(text) {
  const raws = text.split(/\r?\n/);
  const parsed = [];

  for (const raw of raws) {
    if (!raw.trim()) continue;
    const indent = (raw.match(/^[ \t]*/)[0] || "").replace(/\t/g, "  ").length;
    const line = raw
      .trim()
      .replace(/`/g, "")
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^\[[ xX]\]\s*/, "")
      .trim();
    if (!line) continue;

    const range = line.match(/^(\d{1,2}):(\d{2})\s*(?:[~\-–—]|to)\s*(\d{1,2}):(\d{2})\s*(.*)$/);
    if (range) {
      const title = range[5].trim();
      parsed.push({
        kind: title ? "task" : "text",
        raw,
        indent,
        startMin: Number(range[1]) * 60 + Number(range[2]),
        endMin: Number(range[3]) * 60 + Number(range[4]),
        title,
      });
      continue;
    }

    const startOnly = line.match(/^(\d{1,2}):(\d{2})\s*[~\-–—]?\s*(.*)$/);
    if (startOnly && startOnly[3].trim()) {
      parsed.push({
        kind: "task",
        raw,
        indent,
        startMin: Number(startOnly[1]) * 60 + Number(startOnly[2]),
        endMin: null,
        title: startOnly[3].trim(),
      });
      continue;
    }

    parsed.push({ kind: "text", raw, indent, title: line });
  }

  // A line with no time belongs to the task above it when it is indented further.
  const rows = [];
  let lastTask = null;
  for (const p of parsed) {
    if (p.kind === "task") {
      lastTask = p;
      p.subtasks = [];
      rows.push(p);
    } else if (lastTask && p.indent > lastTask.indent) {
      lastTask.subtasks.push(p.title);
      rows.push({ kind: "subtask", raw: p.raw, title: p.title });
    } else {
      rows.push({ kind: "skip", raw: p.raw, title: p.title });
    }
  }

  // An open-ended task runs until the next one starts; the last one runs an hour.
  const tasks = rows.filter((r) => r.kind === "task");
  tasks.forEach((t, i) => {
    if (t.endMin !== null) return;
    const next = tasks[i + 1];
    t.endMin = next && next.startMin > t.startMin ? next.startMin : t.startMin + 60;
    t.inferredEnd = true;
  });
  tasks.forEach((t) => {
    if (t.endMin <= t.startMin) t.endMin = t.startMin + 60;
  });

  return rows;
}

function PasteImportPopup({ teamId, teamLabel, onClose }) {
  const { createTask, addSubtask } = useWorkflow();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => (text.trim() ? parsePastedSchedule(text) : []), [text]);
  const tasks = rows.filter((r) => r.kind === "task");
  const skipped = rows.filter((r) => r.kind === "skip").length;

  async function submit() {
    if (!tasks.length || saving) return;
    setSaving(true);
    for (const t of tasks) {
      const created = await createTask(teamId, minutesToLabel(t.startMin), minutesToLabel(t.endMin), t.title, "");
      if (created) {
        for (const sub of t.subtasks || []) addSubtask(created.id, sub, "");
      }
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{teamLabel} · 붙여넣기로 추가</h3>
          <button type="button" className="modal-close" onClick={onClose} title="닫기">
            ×
          </button>
        </div>
        <div className="paste-body">
          <div className="paste-left">
            <textarea
              className="paste-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"09:30 ~ 09:50 데일리 스크럼\n10:00 팀 회의\n    안건 정리\n11:00-12:00 코드리뷰"}
              autoFocus
            />
            <p className="paste-tip">
              끝시간을 안 적으면 다음 줄 시작까지로 잡습니다 · 들여쓴 줄은 위 과업의 하위 작업이 됩니다
            </p>
          </div>
          <div className="paste-right">
            {rows.length === 0 ? (
              <div className="empty-hint small">붙여넣으면 여기에 결과가 보입니다</div>
            ) : (
              <div className="paste-preview">
                {rows.map((r, i) => {
                  if (r.kind === "task") {
                    return (
                      <div key={i} className="paste-row task">
                        <span className="paste-time">
                          {minutesToLabel(r.startMin)}–{minutesToLabel(r.endMin)}
                          {r.inferredEnd && <em>추정</em>}
                        </span>
                        <span className="paste-title">{r.title}</span>
                      </div>
                    );
                  }
                  if (r.kind === "subtask") {
                    return (
                      <div key={i} className="paste-row subtask">
                        <span className="paste-title">↳ {r.title}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="paste-row skip">
                      <span className="paste-title">{r.raw.trim()}</span>
                      <span className="paste-skip-tag">인식 안 됨</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="task-add-actions paste-actions">
          <span className="paste-count">
            과업 {tasks.length}개{skipped > 0 && ` · 인식 안 됨 ${skipped}줄`}
          </span>
          <button type="button" className="btn-ghost small" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary small" onClick={submit} disabled={!tasks.length || saving}>
            {saving ? "등록 중…" : `${tasks.length}개 등록`}
          </button>
        </div>
      </div>
    </div>
  );
}

// The time+title form here is what the paste importer reads, so a day exported
// and pasted back lands in the same place.
function buildScheduleMarkdown({ dateStr, tracks, tasks, meetings, fixedBands, teamName }) {
  const d = new Date(dateStr);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const out = [`# ${dateStr} (${dow}) 일정`, ""];

  if (fixedBands.length > 0) {
    out.push("## 고정 일정", "");
    const ordered = fixedBands.slice().sort((a, b) => a.start.localeCompare(b.start));
    for (const b of ordered) out.push(`- \`${b.start} ~ ${b.end}\` ${b.label}`);
    out.push("");
  }

  for (const tr of tracks) {
    const rows = tasks.filter(tr.match).slice().sort((a, b) => a.time.localeCompare(b.time));
    const trMeetings = tr.showMeetings
      ? meetings.filter((m) => m.fromTeam === tr.teamId || m.toTeam === tr.teamId)
      : [];
    if (rows.length === 0 && trMeetings.length === 0) continue;

    out.push(`## ${tr.label}`, "");
    for (const m of trMeetings) {
      const other = m.fromTeam === tr.teamId ? m.toTeam : m.fromTeam;
      const extra = [m.place, m.agenda].filter(Boolean).join(" · ");
      out.push(
        `- \`${minutesToLabel(m.startMin)} ~ ${minutesToLabel(m.endMin)}\` ${teamName(other)} 미팅` +
          (extra ? ` (${extra})` : "")
      );
    }
    for (const t of rows) {
      const mark = t.status === "done" ? "[x]" : "[ ]";
      const who = t.assignee ? ` — ${t.assignee}` : "";
      const state = t.status === "in_progress" ? " *(진행 중)*" : "";
      out.push(`- ${mark} \`${t.time} ~ ${t.endTime}\` ${t.title}${who}${state}`);
      for (const s of t.subtasks || []) {
        const sm = s.done ? "[x]" : "[ ]";
        const sw = s.assignee ? ` — ${s.assignee}` : "";
        out.push(`    - ${sm} ${s.title}${sw}`);
      }
    }
    out.push("");
  }

  if (out.length <= 2) out.push("_등록된 과업이 없습니다._", "");
  return out.join("\n");
}

function GanttChart({ visibleTeams }) {
  const { tasks, collabRequests, createTask, updateTask, addSubtask, teamName, dayStart, dayEnd, boardColumns, setTeamColumns } =
    useWorkflow();
  const now = useNowHHMM();
  const meetings = useMeetingBlocks(collabRequests);
  const teams = visibleTeams;

  const [drag, setDrag] = useState(null);
  const [moveDrag, setMoveDrag] = useState(null);
  const [createPopup, setCreatePopup] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [pasteTeam, setPasteTeam] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { minStart, maxEnd, hourMarks } = useMemo(() => {
    const dayEndMin = timeToMinutes(dayEnd);
    const known = [timeToMinutes(dayStart), timeToMinutes(now)];
    tasks.forEach((t) => {
      if (t.time) known.push(timeToMinutes(t.time));
    });
    meetings.forEach((m) => known.push(m.startMin));
    const min = Math.floor(Math.min(...known) / 60) * 60;
    const max = Math.ceil(Math.max(dayEndMin, ...meetings.map((m) => m.endMin)) / 60) * 60;
    const marks = [];
    for (let m = min; m <= max; m += 60) marks.push(m);
    return { minStart: min, maxEnd: max, hourMarks: marks };
  }, [tasks, meetings, dayStart, dayEnd, now]);

  const fixedBands = useMemo(() => {
    const date = todayStr();
    return [
      { ...LUNCH, id: "lunch", kind: "lunch" },
      ...fixedMeetingsFor(date).map((m) => ({ ...m, kind: "fixed" })),
    ];
  }, []);

  // One course is split into parallel columns; the all-course view collapses
  // them so eight courses stay readable.
  const single = teams.length === 1 ? teams[0] : null;
  const columnCount = single ? Math.max(boardColumns[single.id] || 1, 1) : 0;
  const tracks = useMemo(() => {
    if (single) {
      return Array.from({ length: columnCount }, (_, i) => ({
        key: `${single.id}:${i}`,
        teamId: single.id,
        column: i,
        label: i === 0 ? single.name : `추가 열${i}`,
        match: (t) => t.teamId === single.id && (t.column || 0) === i,
        showMeetings: i === 0,
      }));
    }
    return teams.map((team) => ({
      key: team.id,
      teamId: team.id,
      column: null,
      label: team.name,
      match: (t) => t.teamId === team.id,
      showMeetings: true,
    }));
  }, [teams, single, columnCount]);

  const totalMinutes = Math.max(maxEnd - minStart, 1);
  // Position/size as a share of the day rather than in pixels.
  const topPct = (min) => `${((min - minStart) / totalMinutes) * 100}%`;
  const heightPct = (dur) => `${(dur / totalMinutes) * 100}%`;
  const nowMinutes = timeToMinutes(now);
  const nowVisible = nowMinutes >= minStart && nowMinutes <= maxEnd;

  function minutesFromClientY(clientY, trackEl) {
    const rect = trackEl.getBoundingClientRect();
    const raw = minStart + ((clientY - rect.top) / rect.height) * totalMinutes;
    return Math.max(minStart, Math.min(maxEnd, snap(raw)));
  }

  // Dragging a block moves it in time; a click that barely moves opens the editor.
  function handleBlockMouseDown(e, task) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const trackRect = e.currentTarget.parentElement.getBoundingClientRect();
    const minPerPx = totalMinutes / Math.max(trackRect.height, 1);
    const startY = e.clientY;
    const origStart = timeToMinutes(task.time);
    const duration = timeToMinutes(task.endTime) - origStart;
    let moved = false;
    let finalStart = origStart;

    function onMove(ev) {
      const delta = snap((ev.clientY - startY) * minPerPx);
      if (Math.abs(ev.clientY - startY) > 4) moved = true;
      finalStart = Math.max(minStart, Math.min(maxEnd - duration, origStart + delta));
      setMoveDrag({ id: task.id, startMin: finalStart, duration });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMoveDrag(null);
      if (!moved) {
        // A plain click advances the status; editing is on right-click.
        updateTask(task.id, { status: nextStatus(task.status) });
        return;
      }
      if (finalStart !== origStart) {
        updateTask(task.id, {
          time: minutesToLabel(finalStart),
          endTime: minutesToLabel(finalStart + duration),
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleTrackMouseDown(e, teamId, column) {
    if (e.button !== 0 || e.target.closest(".gantt-block")) return;
    e.preventDefault();
    const trackEl = e.currentTarget;
    const startMin = minutesFromClientY(e.clientY, trackEl);
    setDrag({ teamId, column, startMin, curMin: startMin, clientX: e.clientX, clientY: e.clientY });

    function onMove(ev) {
      const curMin = minutesFromClientY(ev.clientY, trackEl);
      setDrag((d) => (d ? { ...d, curMin, clientX: ev.clientX, clientY: ev.clientY } : d));
    }
    function onUp(ev) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const curMin = minutesFromClientY(ev.clientY, trackEl);
      const start = Math.min(startMin, curMin);
      const rawEnd = Math.max(startMin, curMin);
      const end = rawEnd - start < 10 ? start + 30 : rawEnd;
      setDrag(null);
      setCreatePopup({ teamId, column, time: minutesToLabel(start), endTime: minutesToLabel(end) });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }


  // Dragging an edge changes length; dragging the body moves it.
  function handleResizeMouseDown(e, task, edge) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const trackRect = e.currentTarget.parentElement.parentElement.getBoundingClientRect();
    const minPerPx = totalMinutes / Math.max(trackRect.height, 1);
    const startY = e.clientY;
    const origStart = timeToMinutes(task.time);
    const origEnd = timeToMinutes(task.endTime);
    let next = { start: origStart, end: origEnd };

    function onMove(ev) {
      const delta = snap((ev.clientY - startY) * minPerPx);
      if (edge === "top") {
        next = { start: Math.max(minStart, Math.min(origEnd - SNAP_MIN, origStart + delta)), end: origEnd };
      } else {
        next = { start: origStart, end: Math.min(maxEnd, Math.max(origStart + SNAP_MIN, origEnd + delta)) };
      }
      setMoveDrag({ id: task.id, startMin: next.start, duration: next.end - next.start });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMoveDrag(null);
      if (next.start !== origStart || next.end !== origEnd) {
        updateTask(task.id, { time: minutesToLabel(next.start), endTime: minutesToLabel(next.end) });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function handleCreate({ time, endTime, title, subtasks }) {
    const task = await createTask(createPopup.teamId, time, endTime, title, "", "", createPopup.column || 0);
    if (task) {
      subtasks.forEach((s) => addSubtask(task.id, s));
    }
    setCreatePopup(null);
  }

  return (
    <div className="gantt-scroll">
      <div className="gantt-topbar">
        <div className="gantt-legend">
          <span className="legend-item"><i className="swatch pending" />미진행</span>
          <span className="legend-item"><i className="swatch in_progress" />진행 중</span>
          <span className="legend-item"><i className="swatch overdue" />지연 중</span>
          <span className="legend-item"><i className="swatch meeting" />미팅 예정</span>
          <span className="legend-item"><i className="swatch done" />완료</span>
        </div>
        <div className="gantt-topbar-right">
          <p className="gantt-hint">빈 곳 드래그 = 과업 생성 · 블록 클릭 = 상태 변경 · 끌기 = 시간 이동 · 우클릭 = 수정</p>
          {single && (
            <button className="btn-ghost small" onClick={() => setPasteTeam(single)}>
              붙여넣기로 추가
            </button>
          )}
          <button className="btn-ghost small" onClick={() => setExporting(true)}>
            MD로 내보내기
          </button>
        </div>
      </div>
      <div className={`gantt-header ${single ? "narrow" : ""}`}>
        <div className="gantt-axis-spacer" />
        {tracks.map((tr) => {
          const trTasks = tasks.filter(tr.match);
          const done = trTasks.filter((t) => t.status === "done").length;
          const removable = single && tr.column > 0 && tr.column === columnCount - 1 && trTasks.length === 0;
          return (
            <div key={tr.key} className="gantt-col-head">
              <span className="team-name">{tr.label}</span>
              <span className="team-count">
                {done}/{trTasks.length}
                {removable && (
                  <button
                    className="col-remove"
                    onClick={() => setTeamColumns(single.id, columnCount - 1)}
                    title="빈 열 제거"
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {single && columnCount < 6 && (
          <button
            className="col-add"
            onClick={() => setTeamColumns(single.id, columnCount + 1)}
            title="열 추가"
          >
            +
          </button>
        )}
      </div>
      <div className="gantt-body">
        {/* Lunch and the standing meetings apply to every course, so they are drawn
            once as a band across all columns rather than repeated per column. */}
        {fixedBands.map((b) => (
          <div
            key={b.id}
            className={`gantt-fixed-band ${b.kind}`}
            style={{ top: topPct(timeToMinutes(b.start)), height: heightPct(timeToMinutes(b.end) - timeToMinutes(b.start)) }}
            title={`${b.start}–${b.end} ${b.label}`}
          >
            <span className="gantt-fixed-label">{b.label}</span>
          </div>
        ))}
        <div className="gantt-axis">
          {hourMarks.map((m) => (
            <span key={m} className="gantt-hour-label" style={{ top: topPct(m) }}>
              {pad2(Math.floor(m / 60))}:00
            </span>
          ))}
        </div>
        {tracks.map((tr) => {
          const teamTasks = tasks.filter((t) => tr.match(t) && t.time && t.endTime);
          const showDrag = drag && drag.teamId === tr.teamId && drag.column === tr.column;
          const dragTop = showDrag ? topPct(Math.min(drag.startMin, drag.curMin)) : 0;
          const dragHeight = showDrag ? heightPct(Math.abs(drag.curMin - drag.startMin)) : 0;
          return (
            <div
              key={tr.key}
              className={`gantt-col-track ${single ? "narrow" : ""}`}
              onMouseDown={(e) => handleTrackMouseDown(e, tr.teamId, tr.column)}
            >
              {teamTasks.map((t) => {
                const dragging = moveDrag && moveDrag.id === t.id;
                const startMin = dragging ? moveDrag.startMin : timeToMinutes(t.time);
                const durMin = timeToMinutes(t.endTime) - timeToMinutes(t.time);
                const top = topPct(startMin);
                const height = heightPct(durMin);
                // Overdue = the end time has passed and it still is not done.
                const overdue = t.status !== "done" && t.endTime < now;
                const needsAssignee =
                  t.subtasks && t.subtasks.length > 0
                    ? t.subtasks.some((s) => !s.assignee)
                    : !t.assignee;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    className={`gantt-block status-${t.status} ${overdue ? "overdue" : ""} ${
                      dragging ? "dragging" : ""
                    }`}
                    style={{ top, height }}
                    title={`${minutesToLabel(startMin)}–${minutesToLabel(startMin + durMin)} ${t.title} (${
                      overdue ? "지연 중" : STATUS_LABEL[t.status] || ""
                    })${needsAssignee ? " · 담당자 미지정" : ""}`}
                    onMouseDown={(e) => handleBlockMouseDown(e, t)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditTask(t);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setEditTask(t)}
                  >
                    <span className="gantt-block-time">
                      {minutesToLabel(startMin)}
                      {needsAssignee && <b className="assignee-warn" title="담당자 미지정">!</b>}
                    </span>
                    <span className="gantt-block-title">{t.title}</span>
                    <span
                      className="gantt-resize top"
                      onMouseDown={(e) => handleResizeMouseDown(e, t, "top")}
                      title="시작 시간 조절"
                    />
                    <span
                      className="gantt-resize bottom"
                      onMouseDown={(e) => handleResizeMouseDown(e, t, "bottom")}
                      title="종료 시간 조절"
                    />
                  </div>
                );
              })}
              {(tr.showMeetings ? meetings.filter((m) => m.fromTeam === tr.teamId || m.toTeam === tr.teamId) : []).map(
                (m) => {
                  const other = m.fromTeam === tr.teamId ? m.toTeam : m.fromTeam;
                  const label = minutesToLabel(m.startMin);
                  return (
                    <div
                      key={`meeting-${m.id}`}
                      className="gantt-block meeting"
                      style={{ top: topPct(m.startMin), height: heightPct(MEETING_MINUTES) }}
                      title={`${label}–${minutesToLabel(m.endMin)} ${teamName(other)}팀 미팅${
                        m.place ? ` · ${m.place}` : ""
                      }${m.agenda ? ` · ${m.agenda}` : ""}`}
                    >
                      <span className="gantt-block-time">{label}</span>
                      <span className="gantt-block-title">
                        {teamName(other)} 미팅{m.place ? ` · ${m.place}` : ""}
                      </span>
                    </div>
                  );
                })}
              {showDrag && <div className="gantt-drag-select" style={{ top: dragTop, height: dragHeight }} />}
            </div>
          );
        })}
        {nowVisible && (
          <div className="gantt-now-line" style={{ top: topPct(nowMinutes) }}>
            <span className="gantt-now-label">{now}</span>
          </div>
        )}
      </div>
      {drag && (
        <div className="gantt-drag-bubble" style={{ left: drag.clientX + 14, top: drag.clientY - 12 }}>
          {minutesToLabel(Math.min(drag.startMin, drag.curMin))}
          {Math.abs(drag.curMin - drag.startMin) >= 10 && (
            <> ~ {minutesToLabel(Math.max(drag.startMin, drag.curMin))}</>
          )}
        </div>
      )}
      {createPopup && (
        <CreateTaskPopup
          teamLabel={teams.find((t) => t.id === createPopup.teamId)?.name || ""}
          initialTime={createPopup.time}
          initialEndTime={createPopup.endTime}
          onClose={() => setCreatePopup(null)}
          onCreate={handleCreate}
        />
      )}
      {exporting && (
        <ExportMarkdown
          title="일정 · MD로 내보내기"
          filename={`${todayStr()}-일정.md`}
          markdown={buildScheduleMarkdown({
            dateStr: todayStr(),
            tracks,
            tasks,
            meetings,
            fixedBands,
            teamName,
          })}
          onClose={() => setExporting(false)}
        />
      )}
      {pasteTeam && (
        <PasteImportPopup
          teamId={pasteTeam.id}
          teamLabel={pasteTeam.name}
          onClose={() => setPasteTeam(null)}
        />
      )}
      {editTask && (
        <EditTaskPopup
          task={tasks.find((t) => t.id === editTask.id) || editTask}
          teamLabel={teamName(editTask.teamId)}
          onClose={() => setEditTask(null)}
        />
      )}
    </div>
  );
}

// Right-hand pane: every one of today's tasks with its subtasks, so the owner of
// each piece of work is visible (and its absence obvious) without leaving the page.
// Assignees come from a fixed roster so the same person is always spelled the
// same way. The task's own course is listed first; the rest stay reachable for
// cross-course help.
function AssigneeSelect({ value, teamId, onChange, className }) {
  const { members } = useWorkflow();
  const own = members.filter((m) => m.teamId === teamId);
  // Keep a name that is no longer on the roster selectable rather than silently blank.
  const missing = value && !own.some((m) => m.name === value);

  return (
    <select className={className} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">미지정</option>
      {missing && <option value={value}>{value}</option>}
      {own.map((m) => (
        <option key={m.name} value={m.name}>
          {m.lead ? `${m.name} (팀장)` : m.name}
        </option>
      ))}
    </select>
  );
}

function AssigneePane({ teamId }) {
  const { tasks, updateTask, addSubtask, toggleSubtask, updateSubtask, deleteSubtask } = useWorkflow();
  const [drafts, setDrafts] = useState({});

  const teamTasks = useMemo(
    () => tasks.filter((t) => t.teamId === teamId).slice().sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [tasks, teamId]
  );

  if (teamTasks.length === 0) {
    return (
      <aside className="assignee-pane">
        <div className="assignee-pane-head">하위 작업 · 담당자</div>
        <div className="empty-hint small">아직 등록된 과업이 없습니다</div>
      </aside>
    );
  }

  return (
    <aside className="assignee-pane">
      <div className="assignee-pane-head">하위 작업 · 담당자</div>
      <div className="assignee-pane-body">
        {teamTasks.map((t) => {
          const subs = t.subtasks || [];
          const draft = drafts[t.id] || "";
          return (
            <div key={t.id} className="ap-task">
              <div className="ap-task-head">
                <span className="ap-task-time">{t.time}</span>
                <span className="ap-task-title">{t.title}</span>
              </div>

              {subs.length === 0 ? (
                <div className="ap-row">
                  <span className="ap-row-label">과업 담당자</span>
                  <AssigneeSelect
                    className={`ap-assignee ${t.assignee ? "" : "missing"}`}
                    value={t.assignee}
                    teamId={t.teamId}
                    onChange={(v) => updateTask(t.id, { assignee: v })}
                  />
                </div>
              ) : (
                subs.map((s) => (
                  <div key={s.id} className="ap-row">
                    <button
                      type="button"
                      className={`ap-check ${s.done ? "done" : ""}`}
                      onClick={() => toggleSubtask(t.id, s.id)}
                      title={s.done ? "완료 취소" : "완료"}
                    >
                      {s.done && <CheckIcon size={10} />}
                    </button>
                    <span className={`ap-sub-title ${s.done ? "done" : ""}`}>{s.title}</span>
                    <AssigneeSelect
                      className={`ap-assignee ${s.assignee ? "" : "missing"}`}
                      value={s.assignee}
                      teamId={t.teamId}
                      onChange={(v) => updateSubtask(t.id, s.id, { assignee: v })}
                    />
                    <button
                      type="button"
                      className="ap-del"
                      onClick={() => deleteSubtask(t.id, s.id)}
                      title="하위 작업 삭제"
                    >
                      <TrashIcon size={10} />
                    </button>
                  </div>
                ))
              )}

              <div className="ap-add">
                <input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                  placeholder="하위 작업 추가"
                  maxLength={150}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      addSubtask(t.id, draft.trim(), "");
                      setDrafts((d) => ({ ...d, [t.id]: "" }));
                    }
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function TeamBoard() {
  const { teams, myTeam, isLeader } = useWorkflow();
  // Everyone sees only their own course. The PM team can flip to the all-course view.
  const [showAll, setShowAll] = useState(false);

  const visibleTeams = useMemo(() => {
    if (isLeader && showAll) return teams;
    return teams.filter((t) => t.id === myTeam);
  }, [teams, myTeam, isLeader, showAll]);

  const singleTeam = visibleTeams.length === 1 ? visibleTeams[0] : null;

  return (
    <div className="page board-page">
      <div className="page-head board-page-head">
        <div>
          <h2>오늘의 일정</h2>
          <p className="page-sub">
            {isLeader && showAll
              ? "전체 과정의 일정을 보고 있습니다"
              : "내 과정의 일정을 시간 순서대로 정리합니다"}
          </p>
        </div>
        {isLeader && (
          <div className="view-toggle">
            <button className={`view-toggle-btn ${showAll ? "" : "active"}`} onClick={() => setShowAll(false)}>
              내 과정
            </button>
            <button className={`view-toggle-btn ${showAll ? "active" : ""}`} onClick={() => setShowAll(true)}>
              전체 과정
            </button>
          </div>
        )}
      </div>
      {visibleTeams.length === 0 ? (
        <div className="empty-hint">먼저 우측 상단에서 내 과정을 선택해주세요</div>
      ) : (
        <div className={`board-split ${singleTeam ? "with-pane" : ""}`}>
          <GanttChart visibleTeams={visibleTeams} />
          {singleTeam && <AssigneePane teamId={singleTeam.id} />}
        </div>
      )}
    </div>
  );
}
