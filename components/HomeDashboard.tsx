"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DeviceCard from "@/components/DeviceCard";
import type { DeviceCommand, HomeDevice, IoTMode } from "@/lib/types";

type CategoryKey = "all" | "light" | "thermostat" | "appliance" | "other";

const categoryMeta: Record<CategoryKey, { label: string; icon: string; description: string }> = {
  all: { label: "전체", icon: "⌂", description: "집 전체 장치를 한 번에 봅니다." },
  light: { label: "조명", icon: "◉", description: "거실·침실·화장실·복도 조명을 모아봅니다." },
  thermostat: { label: "난방", icon: "℃", description: "침실 1·2·3 난방을 한 곳에서 제어합니다." },
  appliance: { label: "가전", icon: "◇", description: "TV·세탁기·식기세척기 등 SmartThings 가전을 모아봅니다." },
  other: { label: "기타", icon: "≡", description: "환기·콘센트·도어락 등 기타 설비입니다." },
};

function categoryForDevice(device: HomeDevice): CategoryKey {
  if (device.kind === "light") return "light";
  if (device.kind === "thermostat") return "thermostat";
  if (device.kind === "appliance") return "appliance";
  return "other";
}

export default function HomeDashboard() {
  const [devices, setDevices] = useState<HomeDevice[]>([]);
  const [mode, setMode] = useState<IoTMode>("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [elevatorMessage, setElevatorMessage] = useState<string>();

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

  const filteredDevices = useMemo(() => {
    if (category === "all") return devices;
    return devices.filter((device) => categoryForDevice(device) === category);
  }, [category, devices]);

  const rooms = useMemo(() => {
    const grouped = new Map<string, HomeDevice[]>();
    for (const device of filteredDevices) {
      const room = device.roomName || "미지정 방";
      grouped.set(room, [...(grouped.get(room) ?? []), device]);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [filteredDevices]);

  async function sendCommand(device: HomeDevice, payload: DeviceCommand) {
    const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `${device.label} 명령 전송에 실패했습니다.`);
  }

  async function command(device: HomeDevice, payload: DeviceCommand) {
    setBusyId(device.id);
    setError(undefined);
    try {
      await sendCommand(device, payload);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "명령 전송에 실패했습니다.");
    } finally {
      setBusyId(undefined);
    }
  }

  async function bulkSwitch(target: "home" | "light" | "thermostat", value: "on" | "off") {
    setBulkBusy(true);
    setError(undefined);

    const targets = devices.filter((device) => {
      if (!device.controllable || !device.capabilities.switch || device.kind === "doorlock" || device.kind === "appliance" || device.kind === "ventilation") return false;
      if (target === "light") return device.kind === "light";
      if (target === "thermostat") return device.kind === "thermostat";
      return device.kind === "light" || device.kind === "thermostat" || device.kind === "outlet";
    });

    try {
      const results = await Promise.allSettled(targets.map((device) => sendCommand(device, { action: "switch.set", value })));
      const failed = results.filter((result) => result.status === "rejected").length;
      await load();
      if (failed > 0) setError(`${targets.length}개 중 ${failed}개 장치 명령이 실패했습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "일괄 제어에 실패했습니다.");
    } finally {
      setBulkBusy(false);
    }
  }

  function callElevator() {
    setElevatorMessage(mode === "mock" ? "엘리베이터 호출 완료 (MOCK)" : "엘리베이터 연동 방식 확인 전에는 실제 호출하지 않습니다.");
    window.setTimeout(() => setElevatorMessage(undefined), 3200);
  }

  const onlineCount = devices.filter((device) => device.state.online !== false).length;
  const activeCount = devices.filter((device) => device.state.switch === "on").length;

  const counts = useMemo(() => ({
    all: devices.length,
    light: devices.filter((device) => categoryForDevice(device) === "light").length,
    thermostat: devices.filter((device) => categoryForDevice(device) === "thermostat").length,
    appliance: devices.filter((device) => categoryForDevice(device) === "appliance").length,
    other: devices.filter((device) => categoryForDevice(device) === "other").length,
  }), [devices]);

  return (
    <div className="page-wrap">
      <section className="hero">
        <div>
          <p className="eyebrow">HOME CONTROL</p>
          <h1>우리집 상태를 한눈에</h1>
          <p>카테고리별로 빠르게 들어가고, 자주 쓰는 기능은 상단에서 한 번에 제어합니다.</p>
        </div>
        <div className={`mode-badge ${mode === "mock" ? "mock" : "live"}`}>
          <span className="status-dot" />
          {mode === "mock" ? "MOCK MODE" : "SMARTTHINGS LIVE"}
        </div>
      </section>

      <section className="quick-control" aria-label="빠른 제어">
        <div className="quick-control-title">
          <p>QUICK CONTROL</p>
          <h2>자주 쓰는 기능</h2>
        </div>
        <div className="quick-control-buttons">
          <button className="quick-button primary" disabled={bulkBusy} onClick={() => bulkSwitch("home", "on")}>전체 켜기</button>
          <button className="quick-button" disabled={bulkBusy} onClick={() => bulkSwitch("home", "off")}>전체 끄기</button>
          <button className="quick-button elevator" onClick={callElevator}>엘베 부르기 <span>{mode === "mock" ? "MOCK" : "준비중"}</span></button>
        </div>
        <small>전체 제어는 조명·난방·콘센트만 대상으로 하며 세탁기·식기세척기·도어락은 제외합니다.</small>
      </section>

      {elevatorMessage && <div className="toast" role="status">{elevatorMessage}</div>}

      <section className="summary-grid" aria-label="홈 요약">
        <article className="summary-card"><span>등록 장치</span><strong>{devices.length}</strong><small>전체 장치</small></article>
        <article className="summary-card"><span>온라인</span><strong>{onlineCount}</strong><small>현재 연결됨</small></article>
        <article className="summary-card"><span>켜짐</span><strong>{activeCount}</strong><small>switch 기준</small></article>
        <article className="summary-card safety"><span>도어락</span><strong>비활성</strong><small>검증 전 제어 금지</small></article>
      </section>

      <section className="category-panel" aria-label="장치 카테고리">
        <div className="category-tabs">
          {(Object.keys(categoryMeta) as CategoryKey[]).map((key) => (
            <button key={key} className={`category-tab ${category === key ? "selected" : ""}`} onClick={() => setCategory(key)}>
              <span className="category-icon">{categoryMeta[key].icon}</span>
              <span><strong>{categoryMeta[key].label}</strong><small>{counts[key]}개</small></span>
            </button>
          ))}
        </div>
        <div className="category-description">
          <div><p>{categoryMeta[category].label}</p><strong>{categoryMeta[category].description}</strong></div>
          {category === "light" && <div className="category-bulk"><button disabled={bulkBusy} onClick={() => bulkSwitch("light", "on")}>조명 전체 켜기</button><button disabled={bulkBusy} onClick={() => bulkSwitch("light", "off")}>조명 전체 끄기</button></div>}
          {category === "thermostat" && <div className="category-bulk"><button disabled={bulkBusy} onClick={() => bulkSwitch("thermostat", "on")}>난방 전체 켜기</button><button disabled={bulkBusy} onClick={() => bulkSwitch("thermostat", "off")}>난방 전체 끄기</button></div>}
        </div>
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
                    busy={bulkBusy || busyId === device.id || loading}
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
