"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogEntry } from "@/lib/types";

export default function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/logs?limit=150", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "로그를 불러오지 못했습니다.");
      setLogs(data.logs);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그를 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  const filtered = logs.filter(log => (level === "all" || log.level === level) && `${log.message} ${log.event} ${log.meta?.deviceId ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="page-wrap logs-page">
      <section className="hero compact">
        <div><p className="eyebrow">EVENT LOG</p><h1>로그</h1><p>장치 조회와 명령 전송 결과를 확인합니다.</p></div>
        <button className="refresh-button" onClick={() => void load()}>새로고침</button>
      </section>
      <div className="log-notice">현재 로그 저장은 개발 편의를 위한 메모리 기반입니다. Vercel 등 서버리스 배포에서는 영구 보관되지 않습니다.</div>
      {error && <div className="alert">{error}</div>}
      <div className="log-filters">
        <label>검색<input type="search" placeholder="내용 또는 장치 ID" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label>종류<select value={level} onChange={event => setLevel(event.target.value)}><option value="all">전체</option><option value="error">오류</option><option value="warn">주의</option><option value="info">일반</option></select></label>
        <small>{filtered.length}개 표시</small>
      </div>
      <div className="log-table-wrap">
        <table className="log-table">
          <thead><tr><th>시간</th><th>레벨</th><th>이벤트</th><th>내용</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={4} className="empty-cell">표시할 로그가 없습니다.</td></tr> : filtered.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString("ko-KR")}</td>
                <td><span className={`level-chip ${log.level}`}>{log.level}</span></td>
                <td><code>{log.event}</code></td>
                <td>{log.message}{typeof log.meta?.deviceId === "string" && <small className="device-detail"> · 장치 {log.meta.deviceId}</small>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
