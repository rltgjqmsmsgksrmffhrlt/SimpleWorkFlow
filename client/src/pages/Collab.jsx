import React, { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { BellIcon, TrashIcon } from "../components/Icons.jsx";
import { playBell } from "../sound";

const STATUS_LABEL = {
  pending: "조율 중",
  confirmed: "확정됨",
  declined: "거절됨",
};

export const MEETING_MINUTES = 60;

const PLATFORMS = [
  { id: "discord", name: "디스코드", unit: "번방" },
  { id: "zep", name: "Zep", unit: "번 미팅룸" },
  { id: "other", name: "기타", unit: "" },
];

export function formatPlace(req) {
  if (!req.placePlatform) return "";
  const p = PLATFORMS.find((x) => x.id === req.placePlatform);
  if (!p) return "";
  const room = (req.placeRoom || "").trim();
  if (!room) return p.name;
  return p.unit ? `${p.name} ${room}${p.unit}` : `${p.name} ${room}`;
}

function formatMeetingTime(value) {
  if (!value) return "미정";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function RequestCard({ req, teamName, myTeam, onDecline, onDelete, onRemind, onPatch }) {
  // The requesting team owns place + agenda; the receiving team owns the time.
  const isRequester = req.fromTeam === myTeam;
  const isRequestee = req.toTeam === myTeam;
  const isOpen = req.status !== "declined";
  const hasTime = Boolean(req.meetingTime);
  const [declining, setDeclining] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [agendaDraft, setAgendaDraft] = useState(req.agenda || "");
  const [roomDraft, setRoomDraft] = useState(req.placeRoom || "");

  useEffect(() => {
    setAgendaDraft(req.agenda || "");
    setRoomDraft(req.placeRoom || "");
  }, [req.agenda, req.placeRoom]);

  function submitDecline() {
    onDecline(req.id, declineNote);
    setDeclining(false);
  }

  const place = formatPlace(req);

  return (
    <div className={`collab-card status-${req.status} ${isRequestee && req.status === "pending" ? "highlight" : ""}`}>
      <div className="collab-card-top">
        <div className="collab-route">
          <span className="team-pill">{teamName(req.fromTeam)}</span>
          <span className="route-arrow">→</span>
          <span className="team-pill">{teamName(req.toTeam)}</span>
        </div>
        <span className={`status-badge ${req.status}`}>{STATUS_LABEL[req.status]}</span>
      </div>

      {isOpen && (
        <div className="collab-fields">
          <div className="collab-field">
            <span className="collab-field-label">시간 {isRequestee && <em>내가 정함</em>}</span>
            {isRequestee ? (
              <input
                type="datetime-local"
                value={req.meetingTime || ""}
                onChange={(e) => onPatch(req.id, { meetingTime: e.target.value })}
              />
            ) : (
              <span className={`collab-field-value ${hasTime ? "" : "empty"}`}>
                {hasTime ? formatMeetingTime(req.meetingTime) : "상대 팀이 정하는 중"}
              </span>
            )}
          </div>

          <div className="collab-field">
            <span className="collab-field-label">장소 {isRequester && <em>내가 정함</em>}</span>
            {isRequester ? (
              <span className="collab-place-inputs">
                <select
                  value={req.placePlatform || ""}
                  onChange={(e) => onPatch(req.id, { placePlatform: e.target.value })}
                >
                  <option value="">선택</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={roomDraft}
                  onChange={(e) => setRoomDraft(e.target.value)}
                  onBlur={() => {
                    if (roomDraft !== (req.placeRoom || "")) onPatch(req.id, { placeRoom: roomDraft });
                  }}
                  placeholder="방 번호"
                  maxLength={60}
                />
              </span>
            ) : (
              <span className={`collab-field-value ${place ? "" : "empty"}`}>{place || "미정"}</span>
            )}
          </div>

          <div className="collab-field wide">
            <span className="collab-field-label">안건 {isRequester && <em>내가 정함</em>}</span>
            {isRequester ? (
              <input
                type="text"
                value={agendaDraft}
                onChange={(e) => setAgendaDraft(e.target.value)}
                onBlur={() => {
                  if (agendaDraft !== (req.agenda || "")) onPatch(req.id, { agenda: agendaDraft });
                }}
                placeholder="어떤 안건으로 볼까요?"
                maxLength={1000}
              />
            ) : (
              <span className={`collab-field-value ${req.agenda ? "" : "empty"}`}>{req.agenda || "미정"}</span>
            )}
          </div>
        </div>
      )}

      {req.status === "declined" && req.declineNote && (
        <div className="collab-decline-note">{req.declineNote}</div>
      )}

      {declining && (
        <div className="collab-decline-form">
          <input
            type="text"
            value={declineNote}
            onChange={(e) => setDeclineNote(e.target.value)}
            placeholder="거절 사유 (선택)"
            maxLength={500}
          />
          <div className="collab-decline-actions">
            <button type="button" className="btn-ghost small" onClick={() => setDeclining(false)}>
              취소
            </button>
            <button type="button" className="btn-primary small" onClick={submitDecline}>
              거절하기
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
          {isRequestee && isOpen && !declining && (
            <button className="btn-ghost small" onClick={() => setDeclining(true)}>
              거절
            </button>
          )}
          {isRequester && req.status === "pending" && (
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
            onDecline={(id, declineNote) => updateCollab(id, { status: "declined", declineNote })}
            onDelete={deleteCollab}
            onRemind={(id) => {
              remindCollab(id);
              playBell();
            }}
            onPatch={updateCollab}
          />
        ))}
      </div>
    </div>
  );
}
