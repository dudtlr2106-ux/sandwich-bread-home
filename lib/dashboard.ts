import type { CommandResult, HomeDevice } from "./types";

export function bulkTargets(devices: HomeDevice[], target: "home" | "light" | "thermostat") {
  return devices.filter(device => device.controllable && device.state.online !== false &&
    !device.state.statusError && device.capabilities.switch &&
    (target === "home" ? ["light", "thermostat", "outlet"].includes(device.kind) : device.kind === target));
}

export function summarizeCommands(results: PromiseSettledResult<CommandResult>[]) {
  let confirmed = 0, pending = 0, failed = 0;
  for (const result of results) {
    if (result.status === "rejected" || !result.value.ok) failed++;
    else if (result.value.outcome === "confirmed") confirmed++;
    else pending++;
  }
  return { confirmed, pending, failed };
}

export function parseFavorites(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string"))].slice(0, 500) : [];
  } catch { return []; }
}
