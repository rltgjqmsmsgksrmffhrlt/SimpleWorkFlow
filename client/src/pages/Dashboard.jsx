import React, { useMemo, useState, useEffect } from "react";
import { useWorkflow } from "../store.jsx";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${y}년 ${m}월 ${d}일 (${days[date.getDay()]})`;
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Dashboard({ onNavigate }) {
  const { goal, setGoal, teams, tasks, collabRequests, myTeam } = useWorkflow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.content || "");

  useEffect(() => {
    if (!editing) setDraft(goal.content || "");
  }, [goal.content, editing]);

  const teamStats = useMemo(() => {
    return teams.map((t) => {
      const teamTasks = tasks.filter((task) => task.teamId === t.id);
      const done = teamTasks.filter((task) => task.status === "done").length;
      return { ...t, total: teamTasks.length, done };
    });
  }, [teams, tasks]);

  const totalTasks = teamStats.reduce((sum, t) => sum + t.total, 0);
  const totalDone = teamStats.reduce((sum, t) => sum + t.done, 0);
  const overallPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

  const pendingCollab = collabRequests.filter((r) => r.status === "pending").length;
  const myPending = collabRequests.filter((r) => r.status === "pending" && r.toTeam === myTeam).length;

  function save() {
    setGoal(draft.trim());
    setEditing(false);
  }

  return (
    <div className="page dashboard-page">
      <section className="goal-hero">
        <div className="goal-date">{formatDate(goal.date)}</div>
        {!editing ? (
          <>
            <h1 className={`goal-text ${!goal.content ? "empty" : ""}`} onClick={() => setEditing(true)}>
              {goal.content || "오늘 우리 팀들이 함께 달성할 궁극의 목표를 적어주세요"}
            </h1>
            <div className="goal-meta">
              {goal.updatedBy && (
                <span>
                  마지막 수정: {goal.updatedBy} · {formatTime(goal.updatedAt)}
                </span>
              )}
              <button className="btn-primary" onClick={() => setEditing(true)}>
                목표 수정하기
              </button>
            </div>
          </>
        ) : (
          <div className="goal-edit">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="오늘의 궁극 목표를 입력하세요"
              rows={3}
              maxLength={2000}
            />
            <div className="goal-edit-actions">
              <button className="btn-ghost" onClick={() => { setEditing(false); setDraft(goal.content || ""); }}>
                취소
              </button>
              <button className="btn-primary" onClick={save}>
                저장
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="summary-grid">
        <div className="summary-tile">
          <div className="summary-label">전체 진행률</div>
          <div className="summary-value">{overallPct}%</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${overallPct}%` }} />
          </div>
          <div className="summary-sub">{totalDone} / {totalTasks} 과업 완료</div>
        </div>
        <div className="summary-tile clickable" onClick={() => onNavigate?.("board")}>
          <div className="summary-label">등록된 과업</div>
          <div className="summary-value">{totalTasks}</div>
          <div className="summary-sub">8개 팀 보드 바로가기 →</div>
        </div>
        <div className="summary-tile clickable" onClick={() => onNavigate?.("collab")}>
          <div className="summary-label">대기 중인 협업 요청</div>
          <div className="summary-value">{pendingCollab}</div>
          <div className="summary-sub">{myPending > 0 ? `내 팀 앞: ${myPending}건` : "협업 요청 보기 →"}</div>
        </div>
      </section>

      <section className="team-progress-grid">
        {teamStats.map((t) => {
          const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
          return (
            <div key={t.id} className="team-progress-card">
              <div className="team-progress-head">
                <span className="team-name">{t.name}</span>
                <span className="team-count">{t.done}/{t.total}</span>
              </div>
              <div className="progress-bar small">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
