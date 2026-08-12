import React, { useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { CheckIcon, TrashIcon } from "../components/Icons.jsx";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  let total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
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

function TeamColumn({ team }) {
  const { tasks, createTask, updateTask, deleteTask, teamName } = useWorkflow();
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const teamTasks = useMemo(
    () => tasks.filter((t) => t.teamId === team.id).slice().sort(sortByTime),
    [tasks, team.id]
  );
  const done = teamTasks.filter((t) => t.done).length;

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

  return (
    <div className="team-col">
      <div className="team-col-head">
        <span className="team-name">{team.name}</span>
        <span className="team-count">{done}/{teamTasks.length}</span>
      </div>

      <div className="team-col-body">
        {teamTasks.length === 0 && <div className="empty-hint">오늘 등록된 과업이 없습니다</div>}
        {teamTasks.map((t) => (
          <div key={t.id} className={`task-row ${t.done ? "done" : ""}`}>
            <button
              className={`task-check ${t.done ? "checked" : ""}`}
              onClick={() => updateTask(t.id, { done: !t.done })}
              title={t.done ? "완료 취소" : "완료 처리"}
            >
              {t.done && <CheckIcon size={12} />}
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
              <span className="task-title">{t.title}</span>
            </div>
            <button className="task-del" onClick={() => deleteTask(t.id)} title="삭제">
              <TrashIcon size={13} />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <form className="task-add-form" onSubmit={submit}>
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

export default function TeamBoard() {
  const { teams } = useWorkflow();
  return (
    <div className="page">
      <div className="page-head">
        <h2>오늘의 팀별 과업 보드</h2>
        <p className="page-sub">각 팀이 오늘 처리할 일을 시간 순서대로 정리합니다</p>
      </div>
      <div className="team-grid">
        {teams.map((team) => (
          <TeamColumn key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}
