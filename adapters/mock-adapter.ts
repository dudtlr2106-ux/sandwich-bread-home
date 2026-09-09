import type { IoTAdapter } from "@/adapters/iot-adapter";
import type { CommandResult, DeviceCommand, HomeDevice, VentilationLevel } from "@/lib/types";

const switchCapability = { switch: true, raw: ["switch"] } as const;

const thermostatCapabilities = {
  switch: true,
  temperatureMeasurement: true,
  thermostatHeatingSetpoint: true,
  raw: ["switch", "temperatureMeasurement", "thermostatHeatingSetpoint"],
} as const;

const mockDevices: HomeDevice[] = [
  {
    id: "mock-living-light",
    name: "living-light",
    label: "거실 메인 조명",
    roomName: "거실",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "on", online: true },
    controllable: true,
  },
  {
    id: "mock-bed1-light",
    name: "bedroom1-light",
    label: "침실 1 조명",
    roomName: "침실 1",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "off", online: true },
    controllable: true,
  },
  {
    id: "mock-bed2-light",
    name: "bedroom2-light",
    label: "침실 2 조명",
    roomName: "침실 2",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "on", online: true },
    controllable: true,
  },
  {
    id: "mock-bed3-light",
    name: "bedroom3-light",
    label: "침실 3 조명",
    roomName: "침실 3",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "off", online: true },
    controllable: true,
  },
  {
    id: "mock-bathroom-light",
    name: "bathroom-light",
    label: "화장실 조명",
    roomName: "화장실",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "off", online: true },
    controllable: true,
  },
  {
    id: "mock-hallway-light",
    name: "hallway-light",
    label: "복도 조명",
    roomName: "복도",
    kind: "light",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "off", online: true },
    controllable: true,
  },
  {
    id: "mock-bed1-thermostat",
    name: "bedroom1-thermostat",
    label: "침실 1 난방",
    roomName: "침실 1",
    kind: "thermostat",
    source: "mock",
    capabilities: thermostatCapabilities,
    state: {
      switch: "on",
      temperature: 23.4,
      temperatureUnit: "C",
      heatingSetpoint: 24,
      heatingSetpointUnit: "C",
      online: true,
    },
    controllable: true,
  },
  {
    id: "mock-bed2-thermostat",
    name: "bedroom2-thermostat",
    label: "침실 2 난방",
    roomName: "침실 2",
    kind: "thermostat",
    source: "mock",
    capabilities: thermostatCapabilities,
    state: {
      switch: "off",
      temperature: 22.8,
      temperatureUnit: "C",
      heatingSetpoint: 23,
      heatingSetpointUnit: "C",
      online: true,
    },
    controllable: true,
  },
  {
    id: "mock-bed3-thermostat",
    name: "bedroom3-thermostat",
    label: "침실 3 난방",
    roomName: "침실 3",
    kind: "thermostat",
    source: "mock",
    capabilities: thermostatCapabilities,
    state: {
      switch: "off",
      temperature: 23.0,
      temperatureUnit: "C",
      heatingSetpoint: 23,
      heatingSetpointUnit: "C",
      online: true,
    },
    controllable: true,
  },
  {
    id: "mock-living-vent",
    name: "living-ventilation",
    label: "전열교환 환기",
    roomName: "거실",
    kind: "ventilation",
    source: "mock",
    capabilities: { switch: true, fanSpeed: true, raw: ["switch", "fanSpeed"] },
    state: { switch: "on", fanSpeed: 2, ventilationLevel: "medium", online: true },
    controllable: true,
  },
  {
    id: "mock-living-outlet",
    name: "living-outlet",
    label: "거실 콘센트",
    roomName: "거실",
    kind: "outlet",
    source: "mock",
    capabilities: switchCapability,
    state: { switch: "off", online: true },
    controllable: true,
  },
  {
    id: "mock-samsung-tv",
    name: "samsung-tv",
    label: "삼성 TV",
    roomName: "거실",
    kind: "appliance",
    source: "mock",
    capabilities: { switch: true, raw: ["switch", "mediaPlayback", "audioVolume"] },
    state: { switch: "off", online: true, detail: "SmartThings 등록 가전 예시" },
    controllable: true,
  },
  {
    id: "mock-washer",
    name: "samsung-washer",
    label: "세탁기",
    roomName: "세탁실",
    kind: "appliance",
    source: "mock",
    capabilities: { raw: ["washerMode", "washerOperatingState"] },
    state: { online: true, detail: "실제 SmartThings capability 확인 후 코스/시작 제어 연결" },
    controllable: false,
    disabledReason: "세탁기는 단순 ON/OFF가 아닌 실제 capability 확인 후 제어합니다.",
  },
  {
    id: "mock-dishwasher",
    name: "samsung-dishwasher",
    label: "식기세척기",
    roomName: "주방",
    kind: "appliance",
    source: "mock",
    capabilities: { raw: ["dishwasherOperatingState"] },
    state: { online: true, detail: "실제 SmartThings capability 확인 후 코스/시작 제어 연결" },
    controllable: false,
    disabledReason: "식기세척기는 실제 capability 확인 후 제어합니다.",
  },
  {
    id: "mock-doorlock",
    name: "doorlock-placeholder",
    label: "현관 도어락",
    roomName: "현관",
    kind: "doorlock",
    source: "mock",
    capabilities: { lock: true, raw: ["lock"] },
    state: { online: true, detail: "SmartThings capability 확인 전 비활성" },
    controllable: false,
    disabledReason: "도어락/문열기는 capability 확인 및 별도 검증 전까지 제어하지 않습니다.",
  },
];

function cloneDevice(device: HomeDevice): HomeDevice {
  return structuredClone(device);
}

function fanSpeedForLevel(level: VentilationLevel) {
  return { off: 0, low: 1, medium: 2, high: 3 }[level];
}

export class MockAdapter implements IoTAdapter {
  async listDevices() {
    return mockDevices.map(cloneDevice);
  }

  async getDeviceStatus(deviceId: string) {
    const device = mockDevices.find((item) => item.id === deviceId);
    if (!device) throw new Error("Mock device not found");
    return cloneDevice(device);
  }

  async sendCommand(deviceId: string, command: DeviceCommand): Promise<CommandResult> {
    const device = mockDevices.find((item) => item.id === deviceId);
    if (!device) throw new Error("Mock device not found");
    if (!device.controllable || device.kind === "doorlock") throw new Error(device.disabledReason ?? "Device is not controllable");

    if (command.action === "switch.set") {
      if (!device.capabilities.switch) throw new Error("switch capability is not available");
      device.state.switch = command.value;
    }

    if (command.action === "heating.setSetpoint") {
      if (!device.capabilities.thermostatHeatingSetpoint) throw new Error("thermostatHeatingSetpoint capability is not available");
      if (command.value < 5 || command.value > 40) throw new Error("Heating setpoint must be between 5°C and 40°C");
      device.state.heatingSetpoint = command.value;
    }

    if (command.action === "ventilation.setLevel") {
      if (!device.capabilities.fanSpeed) throw new Error("fanSpeed capability is not available");
      device.state.ventilationLevel = command.value;
      device.state.fanSpeed = fanSpeedForLevel(command.value);
      device.state.switch = command.value === "off" ? "off" : "on";
    }

    return { ok: true, deviceId, command, message: "Mock command applied" };
  }
}
