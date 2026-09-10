import type { DeviceCommand } from "./types";

export class InvalidCommandError extends Error {}

export function parseCommand(value: unknown): DeviceCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidCommandError("명령은 action 필드를 포함한 JSON 객체여야 합니다.");
  }
  const body = value as Record<string, unknown>;
  switch (body.action) {
    case "appliance.start":
      return { action: "appliance.start" };
    case "switch.set":
      if (body.value === "on" || body.value === "off") return { action: body.action, value: body.value };
      break;
    case "heating.setSetpoint":
      if (typeof body.value === "number" && Number.isFinite(body.value) && body.value >= 5 && body.value <= 40) {
        return { action: body.action, value: body.value };
      }
      break;
    case "ventilation.setLevel":
      if (body.value === "off" || body.value === "low" || body.value === "medium" || body.value === "high") {
        return { action: body.action, value: body.value };
      }
  }
  throw new InvalidCommandError("지원하지 않는 명령 형식입니다. 앱을 새로고침한 뒤 다시 시도해주세요.");
}
