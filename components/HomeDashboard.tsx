"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeviceCard from "@/components/DeviceCard";
import type { DeviceCommand, HomeDevice, IoTMode } from "@/lib/types";

export default function HomeDashboard() {
  const [devices, setDevices] = useState<HomeDevice[]>([]);
  const [mode, setMode] = useState<IoTMode>("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/devices", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "장치 목록을 불러오지 못했습니다.");
      setDevices(data.devices);
      setMode(data.mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "장치 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rooms = useMemo(() => {
    const grouped = new Map<string, HomeDevice[]>();
    for (const device of devices) {
      const room = device.roomName || "미지정 방";
      grouped.set(room, [...(grouped.get(room) ?? []), device]);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [devices]);

  async function command(device: HomeDevice, payload: DeviceCommand) {
    setBusyId(device.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "명령 전송에 실패했습니다.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "명령 전송에 실패했습니다.");
    } finally {
      setBusyId(undefined);
    }
  }

  const onlineCount = devices.filter((device) => device.state.online !== false).length;
  const activeCount = devices.filter((device) => device.state.switch === "on").length;

  return (
    <div className="page-wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">HOME CONTROL</p>
          <h1>우리집 상태를 한눈에</h1>
          <p>SmartThings에 등록된 KOCOM 장치와 삼성 가전을 같은 화면에서 관리합니다.</p>
        </div>
        <div className={`mode-badge ${mode === "mock" ? "mock" : "live"}`}>
          <span className="status-dot" />
          {mode === "mock" ? "MOCK MODE" : "SMARTTHINGS LIVE"}
        </div>
      </section>

      <section className="summary-grid" aria-label="홈 요약">
        <article className="summary-card"><span>등록 장치</span><strong>{devices.length}</strong><small>전체 장치</small></article>
        <article className="summary-card"><span>온라인</span><strong>{onlineCount}</strong><small>현재 연결됨</small></article>
        <article className="summary-card"><span>켜짐</span><strong>{activeCount}</strong><small>switch 기준</small></article>
        <article className="summary-card safety"><span>도어락</span><strong>비활성</strong><small>검증 전 제어 금지</small></article>
      </section>

      {error && <div className="alert" role="alert">{error}</div>}

      {loading && devices.length === 0 ? (
        <div className="loading-grid">장치 정보를 불러오는 중입니다.</div>
      ) : (
        <div className="rooms-stack">
          {rooms.map(([roomName, roomDevices]) => (
            <section className="room-section" key={roomName}>
              <div className="section-title">
                <div><p>ROOM</p><h2>{roomName}</h2></div>
                <span>{roomDevices.length}개 장치</span>
              </div>
              <div className="device-grid">
                {roomDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    busy={busyId === device.id || loading}
                    onCommand={(payload) => command(device, payload)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
