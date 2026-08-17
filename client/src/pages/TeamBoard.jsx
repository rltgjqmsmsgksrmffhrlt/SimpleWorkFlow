import React, { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { CheckIcon, PencilIcon, TrashIcon } from "../components/Icons.jsx";
import { MEETING_MINUTES, formatPlace } from "./Collab.jsx";
import { todayStr } from "../date";
import { LUNCH, fixedMeetingsFor } from "../schedule-rules";

const DURATION_PRESETS = [15, 30, 60, 90];
const STATUS_ORDER = ["pending", "in_progress", "done"];
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

function minutesToLabel(min) {
  const clamped = Math.max(0, Math.min(1439, Math.round(min / 5) * 5));
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


function TimeRangeField({ time, endTime, onChangeTime, onChangeEndTime }) {
  function applyPreset(minutes) {
    const start = time || nowHHMM();
    if (!time) onChangeTime(start);
    onChangeEndTime(addMinutes(start, minutes));
  }

  return (
    <div className="duration-field">
      <div className="task-time-range">
        <input
          type="time"
          value={time}
          onChange={(e) => onChangeTime(e.target.value)}
          className="task-time-input"
          required
        />
        <span className="time-range-sep">~</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => onChangeEndTime(e.target.value)}
          className="task-time-input"
          required
        />
      </div>
      <div className="duration-presets">
        {DURATION_PRESETS.map((m) => (
          <button key={m} type="button" className="duration-preset-btn" onClick={() => applyPreset(m)}>
            {m}분
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
          <div className="task-time-range">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="task-time-input"
              required
            />
            <span className="time-range-sep">~</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="task-time-input"
              required
            />
          </div>
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

function GanttChart({ visibleTeams }) {
  const { tasks, collabRequests, createTask, updateTask, addSubtask, teamName, dayStart, dayEnd } = useWorkflow();
  const now = useNowHHMM();
  const meetings = useMeetingBlocks(collabRequests);
  const teams = visibleTeams;

  const [drag, setDrag] = useState(null);
  const [moveDrag, setMoveDrag] = useState(null);
  const [createPopup, setCreatePopup] = useState(null);
  const [editTask, setEditTask] = useState(null);

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

  const totalMinutes = Math.max(maxEnd - minStart, 1);
  // Position/size as a share of the day rather than in pixels.
  const topPct = (min) => `${((min - minStart) / totalMinutes) * 100}%`;
  const heightPct = (dur) => `${(dur / totalMinutes) * 100}%`;
  const nowMinutes = timeToMinutes(now);
  const nowVisible = nowMinutes >= minStart && nowMinutes <= maxEnd;

  function minutesFromClientY(clientY, trackEl) {
    const rect = trackEl.getBoundingClientRect();
    const raw = minStart + ((clientY - rect.top) / rect.height) * totalMinutes;
    return Math.max(minStart, Math.min(maxEnd, Math.round(raw / 5) * 5));
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
      const delta = Math.round(((ev.clientY - startY) * minPerPx) / 5) * 5;
      if (Math.abs(ev.clientY - startY) > 4) moved = true;
      finalStart = Math.max(minStart, Math.min(maxEnd - duration, origStart + delta));
      setMoveDrag({ id: task.id, startMin: finalStart, duration });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setMoveDrag(null);
      if (!moved) {
        setEditTask(task);
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

  function handleTrackMouseDown(e, teamId) {
    if (e.button !== 0 || e.target.closest(".gantt-block")) return;
    e.preventDefault();
    const trackEl = e.currentTarget;
    const startMin = minutesFromClientY(e.clientY, trackEl);
    setDrag({ teamId, startMin, curMin: startMin, clientX: e.clientX, clientY: e.clientY });

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
      setCreatePopup({ teamId, time: minutesToLabel(start), endTime: minutesToLabel(end) });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function handleCreate({ time, endTime, title, subtasks }) {
    const task = await createTask(createPopup.teamId, time, endTime, title, "");
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
        <p className="gantt-hint">빈 곳을 드래그해 과업 생성 · 블록을 끌면 시간 이동 · 클릭하면 수정</p>
      </div>
      <div className="gantt-header">
        <div className="gantt-axis-spacer" />
        {teams.map((team) => {
          const teamTasks = tasks.filter((t) => t.teamId === team.id);
          const done = teamTasks.filter((t) => t.status === "done").length;
          return (
            <div key={team.id} className="gantt-col-head">
              <span className="team-name">{team.name}</span>
              <span className="team-count">{done}/{teamTasks.length}</span>
            </div>
          );
        })}
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
        {teams.map((team) => {
          const teamTasks = tasks.filter((t) => t.teamId === team.id && t.time && t.endTime);
          const showDrag = drag && drag.teamId === team.id;
          const dragTop = showDrag ? topPct(Math.min(drag.startMin, drag.curMin)) : 0;
          const dragHeight = showDrag ? heightPct(Math.abs(drag.curMin - drag.startMin)) : 0;
          return (
            <div
              key={team.id}
              className="gantt-col-track"
              onMouseDown={(e) => handleTrackMouseDown(e, team.id)}
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
                    onKeyDown={(e) => e.key === "Enter" && setEditTask(t)}
                  >
                    <span className="gantt-block-time">
                      {minutesToLabel(startMin)}
                      {needsAssignee && <b className="assignee-warn" title="담당자 미지정">!</b>}
                    </span>
                    <span className="gantt-block-title">{t.title}</span>
                  </div>
                );
              })}
              {meetings
                .filter((m) => m.fromTeam === team.id || m.toTeam === team.id)
                .map((m) => {
                  const other = m.fromTeam === team.id ? m.toTeam : m.fromTeam;
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
                  <input
                    className={`ap-assignee ${t.assignee ? "" : "missing"}`}
                    defaultValue={t.assignee || ""}
                    placeholder="담당자 필수"
                    maxLength={60}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (t.assignee || "")) {
                        updateTask(t.id, { assignee: e.target.value });
                      }
                    }}
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
                    <input
                      className={`ap-assignee ${s.assignee ? "" : "missing"}`}
                      defaultValue={s.assignee || ""}
                      placeholder="담당자 필수"
                      maxLength={60}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (s.assignee || "")) {
                          updateSubtask(t.id, s.id, { assignee: e.target.value });
                        }
                      }}
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
