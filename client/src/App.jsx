import React, { useEffect, useState } from "react";
import { useWorkflow } from "./store.jsx";
import { BellIcon } from "./components/Icons.jsx";
import { primeAudio } from "./sound";
import Dashboard from "./pages/Dashboard.jsx";
import TeamBoard from "./pages/TeamBoard.jsx";
import Collab from "./pages/Collab.jsx";

const TABS = [
  { key: "dashboard", label: "대시보드" },
  { key: "board", label: "팀 보드" },
  { key: "collab", label: "협업 요청" },
];

function formatMeetingTime(value) {
  if (!value) return "미정";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function IdentityGateOverlay({ teams, myName, setMyName, onChooseTeam }) {
  return (
    <div className="identity-gate-overlay">
      <div className="identity-gate-card">
        <h2>먼저 본인 과정을 선택해주세요</h2>
        <p className="page-sub">선택한 과정에 대한 협업 요청과 알림만 표시됩니다. (매니지먼트 팀은 팀장으로서 모든 팀의 현황을 볼 수 있습니다)</p>
        <label className="identity-gate-name">
          이름 (선택)
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="예: 김동찬"
            autoFocus
          />
        </label>
        <div className="identity-gate-grid">
          {teams.map((t) => (
            <button key={t.id} className="identity-gate-btn" onClick={() => onChooseTeam(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IncomingAlertBanner({ alert, teamName, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(alert.id), 10000);
    return () => clearTimeout(id);
  }, [alert.id, onDismiss]);

  return (
    <div className="incoming-alert">
      <div className="incoming-alert-icon">
        <BellIcon size={26} />
      </div>
      <div className="incoming-alert-body">
        <div className="incoming-alert-title">
          {teamName(alert.fromTeam)}팀이 협업을 요청했어요
        </div>
        <div className="incoming-alert-time">{formatMeetingTime(alert.meetingTime)}</div>
        {alert.agenda && <div className="incoming-alert-agenda">{alert.agenda}</div>}
      </div>
      <button className="incoming-alert-close" onClick={() => onDismiss(alert.id)}>
        확인
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const {
    connected,
    teams,
    myTeam,
    myName,
    isLeader,
    identityChosen,
    setMyTeam,
    setMyName,
    collabRequests,
    teamName,
    teamAlert,
    incomingAlerts,
    dismissAlert,
  } = useWorkflow();
  const [identityOpen, setIdentityOpen] = useState(false);

  useEffect(() => {
    const unlock = () => primeAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (teamAlert) setIdentityOpen(true);
  }, [teamAlert]);

  const pendingForMe = isLeader
    ? collabRequests.filter((r) => r.status === "pending").length
    : collabRequests.filter((r) => r.status === "pending" && r.toTeam === myTeam).length;

  return (
    <div className="app-shell">
      {!identityChosen && (
        <IdentityGateOverlay
          teams={teams}
          myName={myName}
          setMyName={setMyName}
          onChooseTeam={setMyTeam}
        />
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">SimpleWorkFlow</span>
          <span className={`conn-dot ${connected ? "on" : "off"}`} title={connected ? "실시간 연결됨" : "연결 끊김"} />
        </div>

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === "collab" && pendingForMe > 0 && (
                <span className="tab-badge">{pendingForMe}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="identity">
          <button
            className={`identity-btn ${teamAlert ? "shake alert" : ""}`}
            onClick={() => setIdentityOpen((v) => !v)}
          >
            <BellIcon size={16} />
            <span>
              {myTeam ? teams.find((t) => t.id === myTeam)?.name || "팀 선택" : "팀 선택"}
              {isLeader && " · 팀장"}
            </span>
            {pendingForMe > 0 && <span className="dot-badge">{pendingForMe}</span>}
          </button>
          {teamAlert && <div className="team-alert-tip">먼저 내 팀을 선택해주세요!</div>}
          {identityOpen && (
            <div className="identity-pop">
              <label>
                내 이름
                <input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder="예: 김동찬"
                />
              </label>
              <label>
                내 팀
                <select value={myTeam} onChange={(e) => setMyTeam(e.target.value)}>
                  <option value="">선택 안 함</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary small" onClick={() => setIdentityOpen(false)}>
                닫기
              </button>
            </div>
          )}
        </div>
      </header>

      {incomingAlerts.length > 0 && (
        <div className="incoming-alert-stack">
          {incomingAlerts.map((alert) => (
            <IncomingAlertBanner key={alert.id} alert={alert} teamName={teamName} onDismiss={dismissAlert} />
          ))}
        </div>
      )}

      <main className="content">
        {tab === "dashboard" && <Dashboard onNavigate={setTab} />}
        {tab === "board" && <TeamBoard />}
        {tab === "collab" && <Collab />}
      </main>
    </div>
  );
}
