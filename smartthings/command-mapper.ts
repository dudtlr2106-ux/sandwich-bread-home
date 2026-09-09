import type { DeviceCommand, HomeDevice } from "@/lib/types";
import type { SmartThingsCommand } from "@/smartthings/types";

export function mapDeviceCommand(device: HomeDevice, command: DeviceCommand): SmartThingsCommand[] {
  if (device.kind === "doorlock" || device.capabilities.lock) {
    throw new Error("Door lock commands are intentionally disabled until the SmartThings capability is explicitly verified.");
  }

  if (command.action === "switch.set") {
    if (!device.capabilities.switch) throw new Error("Device does not expose the SmartThings switch capability.");
    return [{ component: "main", capability: "switch", command: command.value }];
  }

  if (command.action === "heating.setSetpoint") {
    if (!device.capabilities.thermostatHeatingSetpoint) {
      throw new Error("Device does not expose thermostatHeatingSetpoint.");
    }
    if (command.value < 5 || command.value > 40) throw new Error("Heating setpoint must be between 5°C and 40°C.");
    return [
      {
        component: "main",
        capability: "thermostatHeatingSetpoint",
        command: "setHeatingSetpoint",
        arguments: [command.value],
      },
    ];
  }

  if (command.action === "ventilation.setLevel") {
    if (!device.capabilities.fanSpeed) throw new Error("Device does not expose fanSpeed.");
    const speed = { off: 0, low: 1, medium: 2, high: 3 }[command.value];
    const commands: SmartThingsCommand[] = [];

    if (device.capabilities.switch) {
      commands.push({ component: "main", capability: "switch", command: command.value === "off" ? "off" : "on" });
    }

    commands.push({ component: "main", capability: "fanSpeed", command: "setFanSpeed", arguments: [speed] });
    return commands;
  }

  if (command.action === "appliance.start") {
    if (device.kind !== "appliance") throw new Error("This command is only available for supported appliances.");
    if (device.state.remoteControlEnabled !== true) {
      throw new Error("기기에서 Smart Control(원격제어)을 먼저 켜주세요.");
    }

    if (device.capabilities.raw.includes("samsungce.washerOperatingState")) {
      return [{ component: "main", capability: "samsungce.washerOperatingState", command: "start" }];
    }

    if (device.capabilities.raw.includes("samsungce.dishwasherOperation")) {
      return [{ component: "main", capability: "samsungce.dishwasherOperation", command: "start" }];
    }

    throw new Error("이 가전은 아직 검증된 원격 시작 명령이 없습니다.");
  }

  const neverCommand: never = command;
  throw new Error(`Unsupported command: ${JSON.stringify(neverCommand)}`);
}
