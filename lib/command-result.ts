import type { DeviceCommand, HomeDeviceState } from "./types";

export function commandMatchesState(command: DeviceCommand, state: HomeDeviceState): boolean {
  switch (command.action) {
    case "switch.set": return state.switch === command.value;
    case "appliance.start": return state.operatingState === "run" || state.operatingState === "running";
    case "heating.setSetpoint": return state.heatingSetpoint === command.value;
    case "ventilation.setLevel": return state.ventilationLevel === command.value;
  }
}
