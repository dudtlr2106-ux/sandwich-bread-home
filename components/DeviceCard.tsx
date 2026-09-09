"use client";

import { useState } from "react";
import type { DeviceCommand, HomeDevice, VentilationLevel } from "@/lib/types";

type Props = {
  device: HomeDevice;
  busy: boolean;
  onCommand: (command: DeviceCommand) => Promise<void> | void;
};

const kindLabel = {
  light: "조명",
  thermostat: "난방",
  ventilation: "환기",
  outlet: "콘센트",
  appliance: "가전",
  doorlock: "도어락",
} as const;

const icon = {
  light: "◉",
  thermostat: "℃",
  ventilation: "≋",
  outlet: "⌁",
  appliance: "◇",
  doorlock: "▣",
} as const;

function operationLabel(value?: string) {
  if (!value) return "상태 확인 중";
  return ({ ready: "준비", idle: "대기", running: "작동 중", run: "작동 중", paused: "일시정지", finished: "완료" } as Record<string, string>)[value] ?? value;
}

export default function DeviceCard({ device, busy, onCommand }: Props) {
  const [setpoint, setSetpoint] = useState(device.state.heatingSetpoint ?? 24);
  const isOn = device.state.switch === "on";
  const hasApplianceStart = device.kind === "appliance" && (
    device.capabilities.raw.includes("samsungce.washerOperatingState") ||
    device.capabilities.raw.includes("samsungce.dishwasherOperation")
  );
  const isRunning = device.state.operatingState === "running" || device.state.operatingState === "run";
  const canStart = hasApplianceStart && device.controllable && device.state.remoteControlEnabled === true && !isRunning;

  return (
    <article className={`device-card ${isOn ? "is-on" : ""} ${!device.controllable ? "disabled" : ""}`}>
      <div className="device-card-head">
        <div className="device-icon" aria-hidden="true">{icon[device.kind]}</div>
        <div className="device-main">
          <div className="device-meta"><span>{kindLabel[device.kind]}</span><span>·</span><span>{device.source}</span></div>
          <h3>{device.label}</h3>
        </div>
        <span className={`online-dot ${device.state.online === false ? "offline" : ""}`} title={device.state.online === false ? "오프라인" : "온라인"} />
      </div>

      {device.kind === "thermostat" && (
        <div className="thermostat-panel">
          <div className="temperature-readout">
            <span>현재</span>
            <strong>{device.state.temperature?.toFixed(1) ?? "--"}°</strong>
          </div>
          <div className="setpoint-row">
            <label htmlFor={`setpoint-${device.id}`}>설정 온도</label>
            <div>
              <input
                id={`setpoint-${device.id}`}
                type="number"
                min={5}
                max={40}
                step={0.5}
                value={setpoint}
                disabled={busy || !device.controllable}
                onChange={(event) => setSetpoint(Number(event.target.value))}
              />
              <button disabled={busy || !device.controllable} onClick={() => onCommand({ action: "heating.setSetpoint", value: setpoint })}>적용</button>
            </div>
          </div>
        </div>
      )}

      {device.kind === "ventilation" && (
        <div className="segmented-control" aria-label="환기 세기">
          {(["off", "low", "medium", "high"] as VentilationLevel[]).map((level) => (
            <button
              key={level}
              disabled={busy || !device.controllable}
              className={device.state.ventilationLevel === level ? "selected" : ""}
              onClick={() => onCommand({ action: "ventilation.setLevel", value: level })}
            >
              {{ off: "OFF", low: "약", medium: "중", high: "강" }[level]}
            </button>
          ))}
        </div>
      )}

      {hasApplianceStart && (
        <div className="appliance-control">
          <div className="appliance-status">
            <span>{operationLabel(device.state.operatingState)}</span>
            {typeof device.state.progress === "number" && <strong>{Math.round(device.state.progress)}%</strong>}
            {device.state.remainingTimeText && <small>남은 시간 {device.state.remainingTimeText}</small>}
          </div>
          <button
            className="refresh-button"
            disabled={busy || !canStart}
            onClick={() => onCommand({ action: "appliance.start" })}
          >
            {isRunning ? "작동 중" : device.state.remoteControlEnabled === true ? "시작" : "Smart Control 필요"}
          </button>
        </div>
      )}

      {(device.kind === "light" || device.kind === "outlet" || device.kind === "thermostat") && device.capabilities.switch && (
        <div className="switch-row">
          <span>{isOn ? "켜짐" : "꺼짐"}</span>
          <button
            className={`toggle ${isOn ? "on" : ""}`}
            disabled={busy || !device.controllable}
            onClick={() => onCommand({ action: "switch.set", value: isOn ? "off" : "on" })}
            aria-label={`${device.label} ${isOn ? "끄기" : "켜기"}`}
            aria-pressed={isOn}
          ><span /></button>
        </div>
      )}

      {!device.controllable && (
        <div className="disabled-note">{device.disabledReason ?? "현재 제어할 수 없는 장치입니다."}</div>
      )}

      {device.state.detail && <p className="device-detail">{device.state.detail}</p>}
    </article>
  );
}
