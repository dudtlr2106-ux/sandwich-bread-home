"use client";

import { useCallback, useEffect, useState } from "react";
import type { LogEntry } from "@/lib/types";

export default function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="page-wrap logs-page">
      <section className="hero compact">
        <div><p className="eyebrow">EVENT LOG</p><h1>로그</h1><p>장치 조회와 명령 전송 결과를 확인합니다.</p></div>
        <button className="refresh-button" onClick={() => void load()}>새로고침</button>
      </section>
      <div className="log-notice">현재 로그 저장은 개발 편의를 위한 메모리 기반입니다. Vercel 등 서버리스 배포에서는 영구 보관되지 않습니다.</div>
      {error && <div className="alert">{error}</div>}
      <div className="log-table-wrap">
        <table className="log-table">
          <thead><tr><th>시간</th><th>레벨</th><th>이벤트</th><th>내용</th></tr></thead>
          <tbody>
            {logs.length === 0 ? <tr><td colSpan={4} className="empty-cell">아직 로그가 없습니다.</td></tr> : logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString("ko-KR")}</td>
                <td><span className={`level-chip ${log.level}`}>{log.level}</span></td>
                <td><code>{log.event}</code></td>
                <td>{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
