import type { DeviceKind, HomeDevice, HomeDeviceState, VentilationLevel } from "@/lib/types";
import type { SmartThingsDevice, SmartThingsStatus } from "@/smartthings/types";

function capabilityIds(device: SmartThingsDevice) {
  return Array.from(new Set((device.components ?? []).flatMap((component) => (component.capabilities ?? []).map((capability) => capability.id))));
}

function categoryNames(device: SmartThingsDevice) {
  return (device.components ?? []).flatMap((component) => (component.categories ?? []).map((category) => category.name.toLowerCase()));
}

function getStatusValue(status: SmartThingsStatus | undefined, capability: string, attribute: string) {
  const value = status?.components?.main?.[capability]?.[attribute];
  return value;
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
    online: device.health?.state ? device.health.state === "ONLINE" : true,
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
  const hasSupportedControl = capabilities.includes("switch") || capabilities.includes("thermostatHeatingSetpoint") || capabilities.includes("fanSpeed");

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
      switch: capabilities.includes("switch"),
      temperatureMeasurement: capabilities.includes("temperatureMeasurement"),
      thermostatHeatingSetpoint: capabilities.includes("thermostatHeatingSetpoint"),
      fanSpeed: capabilities.includes("fanSpeed"),
      lock: capabilities.includes("lock"),
      raw: capabilities,
    },
    state,
    controllable: !isDoorLock && hasSupportedControl,
    disabledReason: isDoorLock
      ? "도어락/문열기는 capability 확인 및 별도 검증 전까지 비활성입니다."
      : hasSupportedControl
        ? undefined
        : "현재 1차 버전에서 안전하게 매핑된 제어 capability가 없습니다.",
  };
}
