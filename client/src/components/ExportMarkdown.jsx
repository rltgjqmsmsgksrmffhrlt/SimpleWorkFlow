import React, { useState } from "react";

// Shows generated markdown with copy/download. Kept dumb on purpose — each page
// builds its own text and passes it in.
export default function ExportMarkdown({ title, filename, markdown, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the textarea below is always selectable.
      const ta = document.querySelector(".export-text");
      if (ta) {
        ta.focus();
        ta.select();
      }
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} title="닫기">
            ×
          </button>
        </div>
        <div className="export-body">
          <textarea className="export-text" value={markdown} readOnly spellCheck={false} />
        </div>
        <div className="task-add-actions paste-actions">
          <span className="paste-count">{markdown.split("\n").length}줄</span>
          <button type="button" className="btn-ghost small" onClick={download}>
            .md 다운로드
          </button>
          <button type="button" className="btn-primary small" onClick={copy}>
            {copied ? "복사됨" : "클립보드로 복사"}
          </button>
        </div>
      </div>
    </div>
  );
}
