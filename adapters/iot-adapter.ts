import type { CommandResult, DeviceCommand, HomeDevice } from "@/lib/types";

export interface IoTAdapter {
  listDevices(): Promise<HomeDevice[]>;
  getDeviceStatus(deviceId: string): Promise<HomeDevice>;
  sendCommand(deviceId: string, command: DeviceCommand): Promise<CommandResult>;
}
