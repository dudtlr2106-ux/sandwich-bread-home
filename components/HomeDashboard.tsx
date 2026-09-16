"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bulkTargets, parseFavorites, summarizeCommands } from "@/lib/dashboard";
import DeviceCard from "@/components/DeviceCard";
import type { CommandResult, DeviceCommand, HomeDevice, IoTMode } from "@/lib/types";

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
  const [mode, setMode] = useState<IoTMode>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>();
  const [stale, setStale] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string>();
  const refreshing = useRef(false);
  const operating = useRef(false);
  const [error, setError] = useState<string>();
  const [commandMessages, setCommandMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string>();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [elevatorBusy, setElevatorBusy] = useState(false);
  const [elevatorMessage, setElevatorMessage] = useState<string>();

  const load = useCallback(async (afterCommand = false) => {
    if (refreshing.current || (operating.current && !afterCommand)) return;
    refreshing.current = true;
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/devices", { cache: "no-store", signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "장치 목록을 불러오지 못했습니다.");
      setDevices(data.devices);
      setMode(data.mode);
      setUpdatedAt(new Date().toLocaleTimeString("ko-KR"));
      setStale(false);
    } catch (cause) {
      setStale(true);
      setError(cause instanceof Error ? cause.message : "장치 목록을 불러오지 못했습니다.");
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try { setFavorites(parseFavorites(localStorage.getItem("ourhome.favorites.v1"))); }
    catch { /* Storage can be disabled; in-session favorites still work. */ }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [autoRefresh, load]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem("ourhome.favorites.v1", JSON.stringify(next)); } catch { /* Keep in memory. */ }
  }

  const filteredDevices = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return devices.filter(device => (category === "all" || categoryForDevice(device) === category) &&
      (!favoritesOnly || favorites.includes(device.id)) &&
      (!search || `${device.label} ${device.roomName}`.toLocaleLowerCase().includes(search)));
  }, [category, devices, query, favoritesOnly, favorites]);

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
      signal: AbortSignal.timeout(60000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error ?? `${device.label} 명령 전송에 실패했습니다.`);
    return data as CommandResult;
  }

  async function command(device: HomeDevice, payload: DeviceCommand) {
    if (operating.current || refreshing.current || stale) return;
    operating.current = true;
    setBusyId(device.id);
    setError(undefined);
    try {
      setCommandMessages((previous) => ({ ...previous, [device.id]: "명령 전송 및 상태 확인 중…" }));
      const result = await sendCommand(device, payload);
      if (result.device) setDevices((previous) => previous.map((item) => item.id === device.id ? result.device! : item));
      else await load(true);
      setCommandMessages((previous) => ({ ...previous, [device.id]: result.message }));
    } catch (cause) {
      setCommandMessages((previous) => ({ ...previous, [device.id]: cause instanceof Error ? cause.message : "명령 전송에 실패했습니다." }));
    } finally {
      operating.current = false;
      setBusyId(undefined);
    }
  }

  async function bulkSwitch(target: "home" | "light" | "thermostat", value: "on" | "off") {
    if (operating.current || refreshing.current || stale) return;
    operating.current = true;
    setBulkBusy(true);
    setBulkMessage(undefined);
    setError(undefined);

    const targets = bulkTargets(devices, target);
    if (targets.length === 0) {
      operating.current = false;
      setBulkBusy(false);
      setBulkMessage("제어할 수 있는 연결 장치가 없습니다.");
      return;
    }

    try {
      const results = await Promise.allSettled(targets.map((device) => sendCommand(device, { action: "switch.set", value })));
      const summary = summarizeCommands(results);
      setBulkMessage(`${targets.length}개 요청 · 반영 확인 ${summary.confirmed} · 확인 대기 ${summary.pending} · 실패 ${summary.failed}`);
      setCommandMessages(previous => {
        const next = { ...previous };
        results.forEach((result, index) => {
          next[targets[index].id] = result.status === "fulfilled" ? result.value.message :
            result.reason instanceof Error ? result.reason.message : "명령 전송 실패";
        });
        return next;
      });
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "일괄 제어에 실패했습니다.");
    } finally {
      operating.current = false;
      setBulkBusy(false);
    }
  }

  async function callElevator() {
    setElevatorBusy(true);
    try {
      const response = await fetch("/api/elevator", { method: "POST" });
      const data = await response.json();
      setElevatorMessage(data.message ?? "엘리베이터 호출에 실패했습니다.");
    } catch {
      setElevatorMessage("엘리베이터 호출 서버에 연결하지 못했습니다.");
    } finally {
      setElevatorBusy(false);
    }
  }

  const allTargets = bulkTargets(devices, "home");
  const controlsDisabled = bulkBusy || loading || Boolean(busyId) || stale;
  const onlineCount = devices.filter((device) => device.state.online === true).length;
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
          {mode === undefined ? "연결 확인 중" : mode === "mock" ? "모의 체험" : "SmartThings 연결"}
        </div>
      </section>

      <section className="quick-control" aria-label="빠른 제어">
        <div className="quick-control-title">
          <p>QUICK CONTROL</p>
          <h2>자주 쓰는 기능</h2>
        </div>
        <div className="quick-control-buttons">
          <button className="quick-button primary" disabled={controlsDisabled || allTargets.length === 0} onClick={() => bulkSwitch("home", "on")}>전체 켜기</button>
          <button className="quick-button" disabled={controlsDisabled || allTargets.length === 0} onClick={() => bulkSwitch("home", "off")}>전체 끄기</button>
          <button className="quick-button elevator" disabled={elevatorBusy || mode !== "mock"} onClick={() => void callElevator()}>엘베 부르기 <span>{mode === "mock" ? "MOCK" : "아직 연결되지 않음"}</span></button>
        </div>
        <small>전체 제어 대상 {allTargets.length}개 · 조명·난방·콘센트만 제어합니다. 엘리베이터는 실제 연결 전까지 사용할 수 없습니다.</small>
      </section>

      {bulkMessage && <div className="log-notice" role="status">{bulkMessage}</div>}
      {elevatorMessage && <div className="toast" role="status">{elevatorMessage}</div>}

      <section className="summary-grid" aria-label="홈 요약">
        <article className="summary-card"><span>등록 장치</span><strong>{devices.length}</strong><small>전체 장치</small></article>
        <article className="summary-card"><span>온라인</span><strong>{onlineCount}</strong><small>현재 연결됨</small></article>
        <article className="summary-card"><span>켜짐</span><strong>{activeCount}</strong><small>확인된 전원 상태</small></article>
        <article className="summary-card safety"><span>확인 필요</span><strong>{devices.filter(device => device.state.statusError || device.state.online === false).length}</strong><small>오프라인 또는 조회 실패</small></article>
      </section>

      <section className="dashboard-tools" aria-label="장치 찾기와 상태 갱신">
        <label className="search-field">장치 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="장치 또는 방 이름" /></label>
        <button className={`filter-button ${favoritesOnly ? "selected" : ""}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>★ 즐겨찾기만</button>
        <button className="refresh-button" disabled={loading || bulkBusy || Boolean(busyId)} onClick={() => void load()}>{loading ? "상태 확인 중…" : "상태 새로고침"}</button>
        <label className="auto-refresh"><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} />1분마다 갱신</label>
        <small className="last-updated">{updatedAt ? `마지막 목록 확인 ${updatedAt}` : "아직 상태를 확인하지 못했습니다."}{stale ? " · 이전 정보 표시 중" : ""}</small>
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
          {category === "light" && <div className="category-bulk"><button disabled={controlsDisabled || bulkTargets(devices, "light").length === 0} onClick={() => bulkSwitch("light", "on")}>조명 전체 켜기</button><button disabled={controlsDisabled || bulkTargets(devices, "light").length === 0} onClick={() => bulkSwitch("light", "off")}>조명 전체 끄기</button></div>}
          {category === "thermostat" && <div className="category-bulk"><button disabled={controlsDisabled || bulkTargets(devices, "thermostat").length === 0} onClick={() => bulkSwitch("thermostat", "on")}>난방 전체 켜기</button><button disabled={controlsDisabled || bulkTargets(devices, "thermostat").length === 0} onClick={() => bulkSwitch("thermostat", "off")}>난방 전체 끄기</button></div>}
        </div>
      </section>

      {error && <div className="alert" role="alert">{error}{stale && devices.length > 0 && " 이전 상태를 표시하고 있습니다. 새로고침 성공 후 제어할 수 있습니다."}</div>}
      {!loading && filteredDevices.length === 0 && <div className="empty-state">
        <h2>{query || favoritesOnly ? "조건에 맞는 장치가 없습니다" : "아직 연결된 장치가 없습니다"}</h2>
        <p>{favoritesOnly ? "장치 카드의 별을 누르면 이 브라우저에 즐겨찾기로 저장됩니다." : query ? "장치 이름이나 방 이름을 바꿔 검색해주세요." : "SmartThings에 장치를 연결하면 이곳에 표시됩니다. KOCOM 조명·난방은 월패드와 별도 연동이 필요합니다."}</p>
        {(query || favoritesOnly) && <button className="refresh-button" onClick={() => { setQuery(""); setFavoritesOnly(false); }}>필터 초기화</button>}
      </div>}

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
                    busy={controlsDisabled}
                    favorite={favorites.includes(device.id)}
                    onFavorite={() => toggleFavorite(device.id)}
                    message={commandMessages[device.id]}
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
