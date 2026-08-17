import React, { useEffect, useMemo, useState } from "react";
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

function RequestCard({ req, teamName, myTeam, onConfirm, onDecline, onDelete, onRemind, onSchedule }) {
  const isMine = req.toTeam === myTeam;
  const involvesMe = req.fromTeam === myTeam || req.toTeam === myTeam;
  const isPending = req.status === "pending";
  const hasSchedule = Boolean(req.meetingTime);
  const canEdit = involvesMe && isPending;
  const [declining, setDeclining] = useState(false);
  const [altTime, setAltTime] = useState(nowLocalInputValue);
  const [declineNote, setDeclineNote] = useState("");
  const [timeDraft, setTimeDraft] = useState(req.meetingTime || "");
  const [agendaDraft, setAgendaDraft] = useState(req.agenda || "");

  useEffect(() => {
    setTimeDraft(req.meetingTime || "");
    setAgendaDraft(req.agenda || "");
  }, [req.meetingTime, req.agenda]);

  function startDecline() {
    setAltTime(nowLocalInputValue());
    setDeclineNote("");
    setDeclining(true);
  }

  function submitDecline() {
    onDecline(req.id, altTime, declineNote);
    setDeclining(false);
  }

  function commitTime(value) {
    setTimeDraft(value);
    onSchedule(req.id, value, agendaDraft);
  }

  function commitAgenda() {
    if (agendaDraft !== (req.agenda || "")) onSchedule(req.id, timeDraft, agendaDraft);
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

      {canEdit ? (
        <div className="collab-inline-fields">
          <input
            type="datetime-local"
            value={timeDraft}
            onChange={(e) => commitTime(e.target.value)}
            title="회의 시간"
          />
          <input
            type="text"
            value={agendaDraft}
            onChange={(e) => setAgendaDraft(e.target.value)}
            onBlur={commitAgenda}
            placeholder="어떤 안건으로 볼까요?"
            maxLength={1000}
          />
        </div>
      ) : (
        <>
          <div className="collab-meeting-time">
            회의 예정: {formatMeetingTime(req.meetingTime)}
            {!hasSchedule && isPending && <span className="collab-unscheduled-tag">일정 미정</span>}
          </div>
          {req.agenda && <div className="collab-agenda">{req.agenda}</div>}
        </>
      )}

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
          {canEdit && isMine && hasSchedule && !declining && (
            <>
              <button className="btn-primary small" onClick={() => onConfirm(req.id)}>
                확정
              </button>
              <button className="btn-ghost small" onClick={startDecline}>
                거절
              </button>
            </>
          )}
          {canEdit && !isMine && (
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
  const {
    teams,
    teamName,
    myTeam,
    isLeader,
    collabRequests,
    createCollab,
    updateCollab,
    deleteCollab,
    remindCollab,
    triggerTeamAlert,
  } = useWorkflow();

  const scopedRequests = useMemo(
    () =>
      isLeader ? collabRequests : collabRequests.filter((r) => r.fromTeam === myTeam || r.toTeam === myTeam),
    [collabRequests, isLeader, myTeam]
  );

  const sorted = useMemo(
    () => scopedRequests.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [scopedRequests]
  );

  function ringBellFor(teamId) {
    if (!myTeam) {
      triggerTeamAlert();
      return;
    }
    if (teamId === myTeam) return;
    createCollab(myTeam, teamId, "", "");
    playBell();
  }

  return (
    <div className="page collab-page">
      <div className="page-head collab-head">
        <div>
          <h2>협업 요청 &amp; 회의 조율</h2>
          <p className="page-sub">
            {isLeader
              ? "협업이 필요한 팀의 종을 울려보세요. 팀장으로서 모든 팀의 협업 요청 현황도 함께 볼 수 있습니다."
              : "협업이 필요한 팀의 종을 울려보세요. 시간과 안건은 카드에서 바로 적으면 됩니다."}
          </p>
        </div>
      </div>

      <div className="bell-grid">
        {teams.map((team) => {
          const isMe = team.id === myTeam;
          return (
            <button
              key={team.id}
              className={`team-bell-btn ${isMe ? "is-me" : ""}`}
              onClick={() => ringBellFor(team.id)}
              disabled={isMe}
              title={isMe ? "내 팀" : `${team.name} 종 울리기`}
            >
              <BellIcon size={isMe ? 16 : 22} />
              <span>{team.name}</span>
            </button>
          );
        })}
      </div>

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
            onSchedule={(id, meetingTime, agenda) => updateCollab(id, { meetingTime, agenda })}
          />
        ))}
      </div>
    </div>
  );
}
