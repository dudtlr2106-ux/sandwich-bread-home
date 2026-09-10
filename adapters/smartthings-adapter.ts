import "server-only";
import type { IoTAdapter } from "@/adapters/iot-adapter";
import type { CommandResult, DeviceCommand } from "@/lib/types";
import {
  executeSmartThingsCommands,
  getSmartThingsCapability,
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

    return Promise.all(
      devices.map(async (device) => {
        const status = await getSmartThingsDeviceStatus(device.deviceId);
        return normalizeSmartThingsDevice(device, roomNameById, status);
      }),
    );
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
    if (command.action === "appliance.start") {
      const raw = (await listSmartThingsDevices()).find((item) => item.deviceId === deviceId);
      for (const mapped of commands) {
        const ref = raw?.components?.find((item) => item.id === mapped.component)?.capabilities?.find((item) => item.id === mapped.capability);
        if (!ref) throw new Error("기기의 해당 구성요소에서 시작 기능을 찾을 수 없습니다.");
        const definition = await getSmartThingsCapability(ref.id, ref.version);
        const start = definition.commands?.[mapped.command];
        if (!start || (start.arguments ?? []).some((argument) => !argument.optional)) {
          throw new Error("이 기기의 시작 명령 정의가 변경되었습니다. capability 확인이 필요합니다.");
        }
      }
    }
    await executeSmartThingsCommands(deviceId, commands);
    return { ok: true, deviceId, command, message: "SmartThings command accepted" };
  }
}
