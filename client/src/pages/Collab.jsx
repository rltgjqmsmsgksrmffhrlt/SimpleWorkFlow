import React, { useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { BellIcon, TrashIcon } from "../components/Icons.jsx";
import { playBell } from "../sound";

const STATUS_LABEL = {
  pending: "조율 중",
  confirmed: "확정됨",
  declined: "거절됨",
};

function nowLocalInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMeetingTime(value) {
  if (!value) return "미정";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RequestCard({ req, teamName, myTeam, onConfirm, onDecline, onDelete, onRemind }) {
  const isMine = req.toTeam === myTeam;
  const isPending = req.status === "pending";
  const [declining, setDeclining] = useState(false);
  const [altTime, setAltTime] = useState(nowLocalInputValue);
  const [declineNote, setDeclineNote] = useState("");

  function startDecline() {
    setAltTime(nowLocalInputValue());
    setDeclineNote("");
    setDeclining(true);
  }

  function submitDecline() {
    onDecline(req.id, altTime, declineNote);
    setDeclining(false);
  }

  return (
    <div className={`collab-card status-${req.status} ${isMine && isPending ? "highlight" : ""}`}>
      <div className="collab-card-top">
        <div className="collab-route">
          <span className="team-pill">{teamName(req.fromTeam)}</span>
          <span className="route-arrow">→</span>
          <span className="team-pill">{teamName(req.toTeam)}</span>
        </div>
        <span className={`status-badge ${req.status}`}>{STATUS_LABEL[req.status]}</span>
      </div>

      <div className="collab-meeting-time">회의 예정: {formatMeetingTime(req.meetingTime)}</div>

      {req.agenda && <div className="collab-agenda">{req.agenda}</div>}

      {req.status === "declined" && (
        <div className="collab-decline-note">
          {req.suggestedTime && <div>제안된 시간: {formatMeetingTime(req.suggestedTime)}</div>}
          {req.declineNote && <div>{req.declineNote}</div>}
        </div>
      )}

      {declining && (
        <div className="collab-decline-form">
          <label>
            가능한 시간을 제안해주세요
            <input type="datetime-local" value={altTime} onChange={(e) => setAltTime(e.target.value)} />
          </label>
          <input
            type="text"
            value={declineNote}
            onChange={(e) => setDeclineNote(e.target.value)}
            placeholder="메모 (선택)"
            maxLength={500}
          />
          <div className="collab-decline-actions">
            <button type="button" className="btn-ghost small" onClick={() => setDeclining(false)}>
              취소
            </button>
            <button type="button" className="btn-primary small" onClick={submitDecline}>
              제안 보내기
            </button>
          </div>
        </div>
      )}

      <div className="collab-card-bottom">
        <span className="collab-requester">
          {req.requestedBy || "익명"} 요청
          {req.remindCount > 0 && ` · 재알림 ${req.remindCount}회`}
        </span>
        <div className="collab-actions">
          {isPending && isMine && !declining && (
            <>
              <button className="btn-primary small" onClick={() => onConfirm(req.id)}>
                확정
              </button>
              <button className="btn-ghost small" onClick={startDecline}>
                거절
              </button>
            </>
          )}
          {isPending && !isMine && (
            <button className="btn-ghost small" onClick={() => onRemind(req.id)} title="상대 팀에게 다시 종을 울립니다">
              다시 알림
            </button>
          )}
          <button className="icon-btn" onClick={() => onDelete(req.id)} title="삭제">
            <TrashIcon size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Collab() {
  const { teams, teamName, myTeam, collabRequests, createCollab, updateCollab, deleteCollab, remindCollab } =
    useWorkflow();
  const [formOpen, setFormOpen] = useState(false);
  const [fromTeam, setFromTeam] = useState(myTeam || "");
  const [toTeam, setToTeam] = useState("");
  const [meetingTime, setMeetingTime] = useState(nowLocalInputValue);
  const [agenda, setAgenda] = useState("");

  const sorted = useMemo(
    () => collabRequests.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [collabRequests]
  );

  function openForm() {
    setFromTeam(myTeam || "");
    setMeetingTime(nowLocalInputValue());
    setFormOpen(true);
  }

  function submit(e) {
    e.preventDefault();
    if (!fromTeam || !toTeam || fromTeam === toTeam) return;
    createCollab(fromTeam, toTeam, meetingTime, agenda);
    playBell();
    setToTeam("");
    setMeetingTime(nowLocalInputValue());
    setAgenda("");
    setFormOpen(false);
  }

  return (
    <div className="page">
      <div className="page-head collab-head">
        <div>
          <h2>협업 요청 &amp; 회의 조율</h2>
          <p className="page-sub">다른 팀과 협업이 필요하면 종을 울리고, 회의 시간과 안건을 조율하세요</p>
        </div>
        <button className="btn-bell" onClick={openForm}>
          <BellIcon size={18} />
          종 울리기
        </button>
      </div>

      {formOpen && (
        <form className="collab-form" onSubmit={submit}>
          <div className="collab-form-row">
            <label>
              보내는 팀
              <select value={fromTeam} onChange={(e) => setFromTeam(e.target.value)} required>
                <option value="">선택</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="route-arrow">→</span>
            <label>
              받는 팀
              <select value={toTeam} onChange={(e) => setToTeam(e.target.value)} required>
                <option value="">선택</option>
                {teams.filter((t) => t.id !== fromTeam).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              희망 회의 시간
              <input
                type="datetime-local"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
              />
            </label>
          </div>
          <label className="agenda-label">
            어떤 내용을 논의할까요?
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="안건, 질문하고 싶은 내용을 적어주세요"
              rows={3}
              maxLength={1000}
            />
          </label>
          <div className="collab-form-actions">
            <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              요청 보내기
            </button>
          </div>
        </form>
      )}

      <div className="collab-list">
        {sorted.length === 0 && <div className="empty-hint">아직 협업 요청이 없습니다</div>}
        {sorted.map((req) => (
          <RequestCard
            key={req.id}
            req={req}
            teamName={teamName}
            myTeam={myTeam}
            onConfirm={(id) => updateCollab(id, { status: "confirmed" })}
            onDecline={(id, suggestedTime, declineNote) =>
              updateCollab(id, { status: "declined", suggestedTime, declineNote })
            }
            onDelete={deleteCollab}
            onRemind={(id) => {
              remindCollab(id);
              playBell();
            }}
          />
        ))}
      </div>
    </div>
  );
}
