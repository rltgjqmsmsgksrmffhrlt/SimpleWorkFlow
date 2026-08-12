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

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const { connected, teams, myTeam, myName, setMyTeam, setMyName, collabRequests } = useWorkflow();
  const [identityOpen, setIdentityOpen] = useState(false);

  useEffect(() => {
    const unlock = () => primeAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const pendingForMe = collabRequests.filter(
    (r) => r.status === "pending" && r.toTeam === myTeam
  ).length;

  return (
    <div className="app-shell">
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
          <button className="identity-btn" onClick={() => setIdentityOpen((v) => !v)}>
            <BellIcon size={16} />
            <span>{myTeam ? teams.find((t) => t.id === myTeam)?.name || "팀 선택" : "팀 선택"}</span>
            {pendingForMe > 0 && <span className="dot-badge">{pendingForMe}</span>}
          </button>
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

      <main className="content">
        {tab === "dashboard" && <Dashboard onNavigate={setTab} />}
        {tab === "board" && <TeamBoard />}
        {tab === "collab" && <Collab />}
      </main>
    </div>
  );
}
