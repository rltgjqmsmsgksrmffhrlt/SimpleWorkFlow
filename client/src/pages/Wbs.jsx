import React, { useEffect, useMemo, useState } from "react";
import { useWorkflow } from "../store.jsx";
import { todayStr } from "../date";
import ExportMarkdown from "../components/ExportMarkdown.jsx";

// Where the WBS is actually edited. This screen is read-only on purpose.
const EDITOR_URL = "https://rad-babka-6c8427.netlify.app/";

// The WBS calls the courses by short names; line them up with our team ids.
// "준비" is shared setup work with no owning course, so everyone sees it.
const PART_TO_TEAM = {
  PM: "management",
  디자인: "design",
  FE: "frontend",
  BE: "backend",
  네이티브: "native",
  인프라: "infra",
  보안: "security",
  AI: "genai",
};

const STATUS_LABEL = { todo: "예정", doing: "진행 중", done: "완료" };

function buildWbsMarkdown(parts, weekStartStr, weekEndStr) {
  const out = [`# WBS ${weekStartStr} ~ ${weekEndStr}`, ""];
  let any = false;
  for (const p of parts) {
    if (!p.bars.length) continue;
    any = true;
    out.push(`## ${p.name}`, "");
    for (const b of p.bars.slice().sort((x, y) => x.start.localeCompare(y.start))) {
      const mark = b.status === "done" ? "[x]" : "[ ]";
      const span = b.start === b.end ? b.start : `${b.start} ~ ${b.end}`;
      const pct = b.fields?.["예상진척도"];
      out.push(`- ${mark} ${span} · ${b.title}${pct ? ` (예상 ${pct})` : ""}`);
    }
    out.push("");
  }
  if (!any) out.push("_이번 주에 예정된 항목이 없습니다._", "");
  return out.join(String.fromCharCode(10));
}

const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mondayOf(dateStr, weekOffset) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
  return d;
}

// Pack bars into lanes so overlapping items never sit on top of each other.
function assignLanes(items) {
  const lanes = [];
  for (const it of items) {
    let lane = lanes.findIndex((end) => end < it.startIdx);
    if (lane === -1) {
      lanes.push(it.endIdx);
      lane = lanes.length - 1;
    } else {
      lanes[lane] = it.endIdx;
    }
    it.lane = lane;
  }
  return lanes.length;
}

export default function Wbs() {
  const { myTeam, isLeader } = useWorkflow();
  const [state, setState] = useState({ loading: true });
  const [weekOffset, setWeekOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wbs")
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled) setState({ loading: false, ...res });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: "fetch-failed", detail: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const weekStart = useMemo(() => mondayOf(todayStr(), weekOffset), [weekOffset]);
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [weekStart]);

  const weekStartStr = toStr(days[0]);
  const weekEndStr = toStr(days[6]);
  const today = todayStr();

  const visibleParts = useMemo(() => {
    const parts = state.data?.parts || [];
    const scoped = parts.filter((p) => {
      const owner = PART_TO_TEAM[p.name];
      if (!owner) return true; // shared streams like 준비
      return isLeader || owner === myTeam;
    });
    return scoped.map((p) => {
      const bars = (p.nodes || [])
        .filter((n) => n.start && n.end && n.start <= weekEndStr && n.end >= weekStartStr)
        .map((n) => {
          const startIdx = Math.max(0, days.findIndex((d) => toStr(d) === n.start));
          const rawEnd = days.findIndex((d) => toStr(d) === n.end);
          return {
            ...n,
            startIdx: n.start < weekStartStr ? 0 : startIdx,
            endIdx: n.end > weekEndStr ? 6 : rawEnd === -1 ? 6 : rawEnd,
            clippedLeft: n.start < weekStartStr,
            clippedRight: n.end > weekEndStr,
          };
        })
        .sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);
      const laneCount = assignLanes(bars);
      return { ...p, bars, laneCount: Math.max(laneCount, 1) };
    });
  }, [state.data, isLeader, myTeam, days, weekStartStr, weekEndStr]);

  const totalInWeek = visibleParts.reduce((sum, p) => sum + p.bars.length, 0);

  function renderBody() {
    if (state.loading) return <div className="empty-hint">WBS를 불러오는 중…</div>;

    if (state.error) {
      const messages = {
        "no-folder": "exe 옆에 WBS 폴더가 없습니다. 폴더를 만들고 WBS JSON 파일을 넣어주세요.",
        "no-file": "WBS 폴더에 JSON 파일이 없습니다. 변환된 WBS JSON을 넣어주세요.",
        "parse-failed": `WBS 파일을 읽지 못했습니다 (${state.sourceFile}). JSON 형식을 확인해주세요.`,
        "fetch-failed": "서버에서 WBS를 가져오지 못했습니다.",
      };
      return <div className="empty-hint">{messages[state.error] || "WBS를 불러오지 못했습니다."}</div>;
    }

    if (!myTeam) return <div className="empty-hint">먼저 우측 상단에서 내 과정을 선택해주세요</div>;

    return (
      <div className="wbs-grid">
        <div className="wbs-head-row">
          <div className="wbs-part-col" />
          {days.map((d) => {
            const ds = toStr(d);
            const dow = (d.getDay() + 6) % 7;
            return (
              <div
                key={ds}
                className={`wbs-day-head ${ds === today ? "today" : ""} ${dow >= 5 ? "weekend" : ""}`}
              >
                <span className="wbs-dow">{DAY_NAMES[dow]}</span>
                <span className="wbs-date">{d.getMonth() + 1}/{d.getDate()}</span>
              </div>
            );
          })}
        </div>

        <div className="wbs-body">
          {visibleParts.map((p) => (
            <div key={p.id} className="wbs-part-row" style={{ minHeight: 26 + p.laneCount * 22 }}>
              <div className="wbs-part-col">
                <span className="wbs-part-dot" style={{ background: p.color }} />
                <span className="wbs-part-name">{p.name}</span>
                <span className="wbs-part-count">{p.bars.length}</span>
              </div>
              <div className="wbs-lanes">
                {days.map((d, i) => {
                  const dow = (d.getDay() + 6) % 7;
                  return (
                    <div
                      key={i}
                      className={`wbs-daycell ${toStr(d) === today ? "today" : ""} ${dow >= 5 ? "weekend" : ""}`}
                      style={{ left: `${(i / 7) * 100}%`, width: `${(1 / 7) * 100}%` }}
                    />
                  );
                })}
                {p.bars.map((b) => (
                  <div
                    key={b.id}
                    className={`wbs-bar status-${b.status} ${b.clippedLeft ? "clip-l" : ""} ${
                      b.clippedRight ? "clip-r" : ""
                    }`}
                    style={{
                      left: `${(b.startIdx / 7) * 100}%`,
                      width: `${((b.endIdx - b.startIdx + 1) / 7) * 100}%`,
                      top: 4 + b.lane * 22,
                      borderLeftColor: p.color,
                    }}
                    title={`${b.title}\n${b.start} ~ ${b.end} · ${STATUS_LABEL[b.status] || b.status}${
                      b.fields?.["예상진척도"] ? ` · 예상진척도 ${b.fields["예상진척도"]}` : ""
                    }`}
                  >
                    <span className="wbs-bar-title">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {totalInWeek === 0 && <div className="empty-hint small">이번 주에 예정된 WBS 항목이 없습니다</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="page wbs-page">
      <div className="page-head wbs-head">
        <div>
          <h2>WBS 주간 보기</h2>
          <p className="page-sub">
            {state.sourceFile ? `${state.sourceFile} 기준 · 읽기 전용` : "읽기 전용"}
          </p>
        </div>
        <div className="wbs-controls">
          <div className="view-toggle">
            <button className="view-toggle-btn" onClick={() => setWeekOffset((w) => w - 1)} title="이전 주">
              ←
            </button>
            <button className="view-toggle-btn" onClick={() => setWeekOffset(0)}>
              이번 주
            </button>
            <button className="view-toggle-btn" onClick={() => setWeekOffset((w) => w + 1)} title="다음 주">
              →
            </button>
          </div>
          <button className="btn-ghost small" onClick={() => setExporting(true)}>
            MD로 내보내기
          </button>
          <a className="btn-ghost small" href={EDITOR_URL} target="_blank" rel="noreferrer">
            WBS 편집하기 ↗
          </a>
        </div>
      </div>

      <div className="wbs-weeklabel">
        {days[0].getFullYear()}. {days[0].getMonth() + 1}/{days[0].getDate()} ~ {days[6].getMonth() + 1}/
        {days[6].getDate()}
        {weekOffset === 0 && <span className="wbs-thisweek">이번 주</span>}
      </div>

      {renderBody()}

      {exporting && (
        <ExportMarkdown
          title="WBS · MD로 내보내기"
          filename={`WBS-${weekStartStr}.md`}
          markdown={buildWbsMarkdown(visibleParts, weekStartStr, weekEndStr)}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}
