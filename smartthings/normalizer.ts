import type { DeviceKind, HomeDevice, HomeDeviceState, VentilationLevel } from "@/lib/types";
import type { SmartThingsDevice, SmartThingsStatus } from "@/smartthings/types";

function capabilityIds(device: SmartThingsDevice) {
  return Array.from(new Set((device.components ?? []).filter((component) => component.id === "main").flatMap((component) => (component.capabilities ?? []).map((capability) => capability.id))));
}

function categoryNames(device: SmartThingsDevice) {
  return (device.components ?? []).flatMap((component) => (component.categories ?? []).map((category) => category.name.toLowerCase()));
}

function getStatusValue(status: SmartThingsStatus | undefined, capability: string, attribute: string) {
  return status?.components?.main?.[capability]?.[attribute];
}

function boolValue(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function classify(device: SmartThingsDevice, capabilities: string[]): DeviceKind {
  const labels = `${device.label ?? ""} ${device.name}`.toLowerCase();
  const categories = categoryNames(device);

  if (capabilities.includes("lock")) return "doorlock";
  if (capabilities.includes("thermostatHeatingSetpoint")) return "thermostat";
  if (capabilities.includes("fanSpeed") && /(환기|vent|fan|공조)/i.test(labels)) return "ventilation";
  if (categories.some((name) => name.includes("light")) || /(조명|light|lamp)/i.test(labels)) return "light";
  if (categories.some((name) => name.includes("outlet")) || /(콘센트|outlet|plug)/i.test(labels)) return "outlet";
  return "appliance";
}

function ventilationLevel(speed: unknown, switchState: unknown): VentilationLevel | undefined {
  if (switchState === "off") return "off";
  if (typeof speed !== "number") return undefined;
  if (speed <= 0) return "off";
  if (speed === 1) return "low";
  if (speed === 2) return "medium";
  return "high";
}

export function normalizeSmartThingsDevice(
  device: SmartThingsDevice,
  roomNameById: Map<string, string>,
  statusOverride?: SmartThingsStatus,
): HomeDevice {
  const capabilities = capabilityIds(device);
  const status = statusOverride ?? device.status;
  const kind = classify(device, capabilities);

  const switchValue = getStatusValue(status, "switch", "switch")?.value;
  const temperature = getStatusValue(status, "temperatureMeasurement", "temperature");
  const heatingSetpoint = getStatusValue(status, "thermostatHeatingSetpoint", "heatingSetpoint");
  const fanSpeed = getStatusValue(status, "fanSpeed", "fanSpeed")?.value;

  const state: HomeDeviceState = {
    online: device.health?.state ? device.health.state === "ONLINE" : undefined,
  };

  if (switchValue === "on" || switchValue === "off") state.switch = switchValue;
  if (typeof temperature?.value === "number") {
    state.temperature = temperature.value;
    state.temperatureUnit = temperature.unit;
  }
  if (typeof heatingSetpoint?.value === "number") {
    state.heatingSetpoint = heatingSetpoint.value;
    state.heatingSetpointUnit = heatingSetpoint.unit;
  }
  if (typeof fanSpeed === "number") {
    state.fanSpeed = fanSpeed;
    state.ventilationLevel = ventilationLevel(fanSpeed, switchValue);
  }

  const isDoorLock = kind === "doorlock";
  const isAppliance = kind === "appliance";
  const isWasher = capabilities.includes("samsungce.washerOperatingState");
  const isDishwasher = capabilities.includes("samsungce.dishwasherOperation");
  const hasSafeApplianceStart = isWasher || isDishwasher;
  const hasMappedControl = isAppliance
    ? hasSafeApplianceStart
    : capabilities.includes("switch") || capabilities.includes("thermostatHeatingSetpoint") || capabilities.includes("fanSpeed");

  if (isWasher || isDishwasher) {
    const remote = boolValue(getStatusValue(status, "remoteControlStatus", "remoteControlEnabled")?.value);
    if (remote !== undefined) state.remoteControlEnabled = remote;

    const operationCapability = isWasher ? "samsungce.washerOperatingState" : "samsungce.dishwasherOperation";
    const operatingState = getStatusValue(status, operationCapability, "operatingState")?.value;
    if (typeof operatingState === "string") state.operatingState = operatingState;

    const jobAttribute = isWasher ? "washerJobState" : "dishwasherJobState";
    const jobState = getStatusValue(status, operationCapability, jobAttribute)?.value
      ?? (isDishwasher ? getStatusValue(status, "samsungce.dishwasherJobState", "dishwasherJobState")?.value : undefined);
    if (typeof jobState === "string") state.jobState = jobState;

    const progress = getStatusValue(status, operationCapability, "progress")?.value
      ?? getStatusValue(status, operationCapability, "progressPercentage")?.value
      ?? (isDishwasher ? getStatusValue(status, "custom.dishwasherOperatingPercentage", "operatingPercentage")?.value : undefined);
    if (typeof progress === "number") state.progress = progress;

    const remainingText = getStatusValue(status, operationCapability, "remainingTimeStr")?.value;
    if (typeof remainingText === "string") state.remainingTimeText = remainingText;

    const remaining = getStatusValue(status, operationCapability, "remainingTime");
    if (typeof remaining?.value === "number") {
      state.remainingTime = remaining.value;
      state.remainingTimeUnit = remaining.unit;
    }

    const remoteText = state.remoteControlEnabled === true ? "원격제어 준비됨" : state.remoteControlEnabled === false ? "기기에서 Smart Control을 켜야 원격 시작 가능" : "원격제어 상태 확인 중";
    state.detail = `${remoteText}${state.operatingState ? ` · 상태 ${state.operatingState}` : ""}${state.remainingTimeText ? ` · 남은 시간 ${state.remainingTimeText}` : ""}`;
  } else if (isAppliance) {
    state.detail = "SmartThings 연결됨 · 상태 조회 가능 · 기기별 전용 제어 명령 확인 후 연결합니다.";
  }

  return {
    id: device.deviceId,
    name: device.name,
    label: device.label ?? device.name,
    roomId: device.roomId,
    roomName: device.roomId ? roomNameById.get(device.roomId) ?? "미지정 방" : "미지정 방",
    locationId: device.locationId,
    kind,
    source: "smartthings",
    capabilities: {
      // Power is separate from cycle start; expose it for the supported washer/dishwasher only.
      switch: (!isAppliance || hasSafeApplianceStart) && capabilities.includes("switch"),
      temperatureMeasurement: capabilities.includes("temperatureMeasurement"),
      thermostatHeatingSetpoint: capabilities.includes("thermostatHeatingSetpoint"),
      fanSpeed: capabilities.includes("fanSpeed"),
      lock: capabilities.includes("lock"),
      raw: capabilities,
    },
    state,
    controllable: !isDoorLock && hasMappedControl,
    disabledReason: isDoorLock
      ? "도어락/문열기는 capability 확인 및 별도 검증 전까지 비활성입니다."
      : isAppliance && !hasSafeApplianceStart
        ? "이 가전은 아직 안전하게 매핑된 원격 제어 명령이 없습니다."
        : hasMappedControl
          ? undefined
          : "현재 1차 버전에서 안전하게 매핑된 제어 capability가 없습니다.",
  };
}
