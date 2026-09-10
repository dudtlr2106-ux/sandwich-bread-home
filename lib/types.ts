export type IoTMode = "mock" | "smartthings";
export type DeviceKind = "light" | "thermostat" | "ventilation" | "outlet" | "appliance" | "doorlock";
export type SwitchValue = "on" | "off";
export type VentilationLevel = "off" | "low" | "medium" | "high";

export type DeviceCapabilities = {
  switch?: boolean;
  temperatureMeasurement?: boolean;
  thermostatHeatingSetpoint?: boolean;
  fanSpeed?: boolean;
  lock?: boolean;
  raw: readonly string[];
};

export type HomeDeviceState = {
  switch?: SwitchValue;
  temperature?: number;
  temperatureUnit?: string;
  heatingSetpoint?: number;
  heatingSetpointUnit?: string;
  fanSpeed?: number;
  ventilationLevel?: VentilationLevel;
  online?: boolean;
  detail?: string;
  remoteControlEnabled?: boolean;
  operatingState?: string;
  jobState?: string;
  progress?: number;
  remainingTime?: number;
  remainingTimeUnit?: string;
  remainingTimeText?: string;
};

export type HomeDevice = {
  id: string;
  name: string;
  label: string;
  roomId?: string;
  roomName: string;
  locationId?: string;
  kind: DeviceKind;
  source: "mock" | "smartthings";
  capabilities: DeviceCapabilities;
  state: HomeDeviceState;
  controllable: boolean;
  disabledReason?: string;
};

export type DeviceCommand =
  | { action: "switch.set"; value: SwitchValue }
  | { action: "heating.setSetpoint"; value: number }
  | { action: "ventilation.setLevel"; value: VentilationLevel }
  | { action: "appliance.start" };

export type CommandResult = {
  ok: boolean;
  outcome?: "confirmed" | "unconfirmed";
  device?: HomeDevice;
  deviceId: string;
  command: DeviceCommand;
  message: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  meta?: Record<string, unknown>;
};
