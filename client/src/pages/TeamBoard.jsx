import React, { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { CheckIcon, PencilIcon, TrashIcon } from "../components/Icons.jsx";

const DURATION_PRESETS = [15, 30, 60, 90];
const STATUS_ORDER = ["pending", "in_progress", "done"];
const STATUS_LABEL = { pending: "시작 전", in_progress: "진행 중", done: "완료" };

function nextStatus(status) {
  const idx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

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

function sortByTime(a, b) {
  if (!a.time && !b.time) return 0;
  if (!a.time) return 1;
  if (!b.time) return -1;
  return a.time.localeCompare(b.time);
}

function latestEndTime(teamTasks) {
  return teamTasks.reduce((latest, t) => {
    const end = t.endTime || t.time || "";
    return end > latest ? end : latest;
  }, "");
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

function NowMarker({ now }) {
  return (
    <div className="now-marker">
      <span className="now-marker-dot" />
      <span className="now-marker-line" />
      <span className="now-marker-time">지금 {now}</span>
    </div>
  );
}

function TeamColumn({ team }) {
  const { tasks, createTask, updateTask, deleteTask, addSubtask, toggleSubtask, deleteSubtask, teamName } =
    useWorkflow();

  const now = useNowHHMM();

  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const teamTasks = useMemo(
    () => tasks.filter((t) => t.teamId === team.id).slice().sort(sortByTime),
    [tasks, team.id]
  );
  const done = teamTasks.filter((t) => t.status === "done").length;

  const nowIndex = useMemo(() => {
    const idx = teamTasks.findIndex((t) => t.time && t.time > now);
    return idx === -1 ? teamTasks.length : idx;
  }, [teamTasks, now]);

  function startAdding() {
    const prevEnd = latestEndTime(teamTasks);
    const defaultStart = prevEnd || nowHHMM();
    setTime(defaultStart);
    setEndTime(addMinutes(defaultStart, 30));
    setTitle("");
    setAdding(true);
  }

  function submit(e) {
    e.preventDefault();
    if (!title.trim() || !time || !endTime) return;
    createTask(team.id, time, endTime, title, "");
    setTitle("");
    setAdding(false);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditTime(t.time || "");
    setEditEndTime(t.endTime || "");
    setEditTitle(t.title);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!editTitle.trim() || !editTime || !editEndTime) return;
    updateTask(editingId, { time: editTime, endTime: editEndTime, title: editTitle });
    setEditingId(null);
  }

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="team-col">
      <div className="team-col-head">
        <span className="team-name">{team.name}</span>
        <span className="team-count">{done}/{teamTasks.length}</span>
      </div>

      <div className="team-col-body">
        {teamTasks.length === 0 && <div className="empty-hint">오늘 등록된 과업이 없습니다</div>}
        {nowIndex === 0 && teamTasks.length > 0 && <NowMarker now={now} />}
        {teamTasks.map((t, idx) => {
          const overdue = t.status !== "done" && t.endTime && t.endTime < now;
          const isExpanded = expandedIds.has(t.id);
          const subtasks = t.subtasks || [];
          const subDone = subtasks.filter((s) => s.done).length;

          if (editingId === t.id) {
            return (
              <form key={t.id} className="task-edit-form" onSubmit={saveEdit}>
                <TimeRangeField
                  time={editTime}
                  endTime={editEndTime}
                  onChangeTime={setEditTime}
                  onChangeEndTime={setEditEndTime}
                />
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="할 일을 입력하세요"
                  maxLength={200}
                  autoFocus
                />
                <div className="task-add-actions">
                  <button type="button" className="btn-ghost small" onClick={cancelEdit}>
                    취소
                  </button>
                  <button type="submit" className="btn-primary small">
                    저장
                  </button>
                </div>
              </form>
            );
          }

          return (
            <React.Fragment key={t.id}>
              <div
                className={`task-item ${t.status === "done" ? "done" : ""} ${
                  t.status === "in_progress" ? "in-progress" : ""
                } ${overdue ? "overdue" : ""}`}
              >
                <div className="task-row">
                  <button
                    className={`task-check status-${t.status}`}
                    onClick={() => updateTask(t.id, { status: nextStatus(t.status) })}
                    title={`${STATUS_LABEL[t.status] || STATUS_LABEL.pending} · 클릭해서 상태 변경`}
                  >
                    {t.status === "done" && <CheckIcon size={12} />}
                    {t.status === "in_progress" && <span className="status-dot" />}
                  </button>
                  <div className="task-body">
                    {t.collabWith ? (
                      <div className="task-meta-stack">
                        <span className="task-time task-time-collab">
                          {t.time}
                          {t.endTime ? `–${t.endTime}` : ""}
                        </span>
                        <span className="task-collab-tag">↔ {teamName(t.collabWith)}</span>
                      </div>
                    ) : (
                      t.time && (
                        <span className="task-time">
                          {t.time}
                          {t.endTime ? `–${t.endTime}` : ""}
                        </span>
                      )
                    )}
                    <div className="task-title-col">
                      <span className="task-title">{t.title}</span>
                      <button className="subtask-toggle" onClick={() => toggleExpanded(t.id)}>
                        {subtasks.length > 0 ? `☑ ${subDone}/${subtasks.length} 하위 과업` : "+ 하위 과업"}
                      </button>
                    </div>
                  </div>
                  <button className="task-edit" onClick={() => startEdit(t)} title="수정">
                    <PencilIcon size={13} />
                  </button>
                  <button className="task-del" onClick={() => deleteTask(t.id)} title="삭제">
                    <TrashIcon size={13} />
                  </button>
                </div>
                {isExpanded && (
                  <SubtaskPanel
                    task={t}
                    addSubtask={addSubtask}
                    toggleSubtask={toggleSubtask}
                    deleteSubtask={deleteSubtask}
                  />
                )}
              </div>
              {nowIndex === idx + 1 && <NowMarker now={now} />}
            </React.Fragment>
          );
        })}
      </div>

      {adding ? (
        <form className="task-add-form" onSubmit={submit}>
          <TimeRangeField time={time} endTime={endTime} onChangeTime={setTime} onChangeEndTime={setEndTime} />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="할 일을 입력하세요"
            autoFocus
            maxLength={200}
          />
          <div className="task-add-actions">
            <button type="button" className="btn-ghost small" onClick={() => setAdding(false)}>
              취소
            </button>
            <button type="submit" className="btn-primary small">
              추가
            </button>
          </div>
        </form>
      ) : (
        <button className="task-add-trigger" onClick={startAdding}>
          + 과업 추가
        </button>
      )}
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

const PX_PER_MIN = 1;

function GanttChart() {
  const { teams, tasks, createTask, updateTask, addSubtask, teamName, dayStart, dayEnd } = useWorkflow();
  const now = useNowHHMM();

  const [drag, setDrag] = useState(null);
  const [createPopup, setCreatePopup] = useState(null);

  const { minStart, maxEnd, hourMarks } = useMemo(() => {
    const dayEndMin = timeToMinutes(dayEnd);
    const known = [timeToMinutes(dayStart), timeToMinutes(now)];
    tasks.forEach((t) => {
      if (t.time) known.push(timeToMinutes(t.time));
    });
    const min = Math.floor(Math.min(...known) / 60) * 60;
    const max = Math.ceil(dayEndMin / 60) * 60;
    const marks = [];
    for (let m = min; m <= max; m += 60) marks.push(m);
    return { minStart: min, maxEnd: max, hourMarks: marks };
  }, [tasks, dayStart, dayEnd, now]);

  const totalHeight = (maxEnd - minStart) * PX_PER_MIN;
  const nowMinutes = timeToMinutes(now);
  const nowVisible = nowMinutes >= minStart && nowMinutes <= maxEnd;
  const nowOffset = (nowMinutes - minStart) * PX_PER_MIN;

  function minutesFromClientY(clientY, trackEl) {
    const rect = trackEl.getBoundingClientRect();
    const raw = minStart + (clientY - rect.top) / PX_PER_MIN;
    return Math.max(minStart, Math.min(maxEnd, Math.round(raw / 5) * 5));
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
      <p className="gantt-hint">팀 열의 빈 공간을 드래그하면 시간을 선택해 바로 과업을 만들 수 있어요.</p>
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
      <div className="gantt-body" style={{ height: totalHeight }}>
        <div className="gantt-axis">
          {hourMarks.map((m) => (
            <span key={m} className="gantt-hour-label" style={{ top: (m - minStart) * PX_PER_MIN }}>
              {pad2(Math.floor(m / 60))}:00
            </span>
          ))}
        </div>
        {teams.map((team) => {
          const teamTasks = tasks.filter((t) => t.teamId === team.id && t.time && t.endTime);
          const showDrag = drag && drag.teamId === team.id;
          const dragTop = showDrag ? (Math.min(drag.startMin, drag.curMin) - minStart) * PX_PER_MIN : 0;
          const dragHeight = showDrag ? Math.abs(drag.curMin - drag.startMin) * PX_PER_MIN : 0;
          return (
            <div
              key={team.id}
              className="gantt-col-track"
              onMouseDown={(e) => handleTrackMouseDown(e, team.id)}
            >
              {teamTasks.map((t) => {
                const top = (timeToMinutes(t.time) - minStart) * PX_PER_MIN;
                const height = Math.max((timeToMinutes(t.endTime) - timeToMinutes(t.time)) * PX_PER_MIN, 18);
                return (
                  <button
                    key={t.id}
                    className={`gantt-block status-${t.status} ${t.collabWith ? "collab" : ""}`}
                    style={{ top, height }}
                    title={`${t.time}–${t.endTime} ${t.title} (${STATUS_LABEL[t.status] || ""})${
                      t.collabWith ? ` · ↔ ${teamName(t.collabWith)}` : ""
                    }`}
                    onClick={() => updateTask(t.id, { status: nextStatus(t.status) })}
                  >
                    <span className="gantt-block-time">{t.time}</span>
                    <span className="gantt-block-title">{t.title}</span>
                  </button>
                );
              })}
              {showDrag && <div className="gantt-drag-select" style={{ top: dragTop, height: dragHeight }} />}
            </div>
          );
        })}
        {nowVisible && (
          <div className="gantt-now-line" style={{ top: nowOffset }}>
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
    </div>
  );
}

export default function TeamBoard() {
  const { teams } = useWorkflow();
  const [view, setView] = useState("list");

  return (
    <div className="page">
      <div className="page-head board-page-head">
        <div>
          <h2>오늘의 팀별 과업 보드</h2>
          <p className="page-sub">각 팀이 오늘 처리할 일을 시간 순서대로 정리합니다</p>
        </div>
        <div className="view-toggle">
          <button className={`view-toggle-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>
            목록 보기
          </button>
          <button className={`view-toggle-btn ${view === "gantt" ? "active" : ""}`} onClick={() => setView("gantt")}>
            간트차트 보기
          </button>
        </div>
      </div>
      {view === "list" ? (
        <div className="team-grid">
          {teams.map((team) => (
            <TeamColumn key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <GanttChart />
      )}
    </div>
  );
}
