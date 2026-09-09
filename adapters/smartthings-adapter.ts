import "server-only";
import type { IoTAdapter } from "@/adapters/iot-adapter";
import type { CommandResult, DeviceCommand, HomeDevice } from "@/lib/types";
import {
  executeSmartThingsCommands,
  getSmartThingsDeviceStatus,
  listSmartThingsDevices,
  listSmartThingsRooms,
} from "@/smartthings/client";
import { mapDeviceCommand } from "@/smartthings/command-mapper";
import { normalizeSmartThingsDevice } from "@/smartthings/normalizer";

export class SmartThingsAdapter implements IoTAdapter {
  private async loadDevices() {
    const devices = await listSmartThingsDevices();
    const locationIds = Array.from(new Set(devices.map((device) => device.locationId).filter((id): id is string => Boolean(id))));
    const roomGroups = await Promise.all(
      locationIds.map(async (locationId) => {
        const rooms = await listSmartThingsRooms(locationId);
        return rooms.map((room) => [room.roomId, room.name] as const);
      }),
    );
    const roomNameById = new Map(roomGroups.flat());
    return devices.map((device) => normalizeSmartThingsDevice(device, roomNameById));
  }

  async listDevices() {
    return this.loadDevices();
  }

  async getDeviceStatus(deviceId: string) {
    const devices = await listSmartThingsDevices();
    const raw = devices.find((device) => device.deviceId === deviceId);
    if (!raw) throw new Error("SmartThings device not found");

    const rooms = raw.locationId ? await listSmartThingsRooms(raw.locationId) : [];
    const roomNameById = new Map(rooms.map((room) => [room.roomId, room.name]));
    const status = await getSmartThingsDeviceStatus(deviceId);
    return normalizeSmartThingsDevice(raw, roomNameById, status);
  }

  async sendCommand(deviceId: string, command: DeviceCommand): Promise<CommandResult> {
    const device = await this.getDeviceStatus(deviceId);
    if (!device.controllable) throw new Error(device.disabledReason ?? "Device is not controllable");

    const commands = mapDeviceCommand(device, command);
    await executeSmartThingsCommands(deviceId, commands);
    return { ok: true, deviceId, command, message: "SmartThings command accepted" };
  }
}
