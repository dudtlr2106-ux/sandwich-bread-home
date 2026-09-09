import { NextResponse } from "next/server";
import { getIoTAdapter } from "@/lib/iot-service";
import { writeLog } from "@/lib/logger";
import type { DeviceCommand, VentilationLevel } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ deviceId: string }> };

function parseCommand(value: unknown): DeviceCommand {
  if (!value || typeof value !== "object") throw new Error("Command body must be an object");
  const body = value as Record<string, unknown>;

  if (body.action === "switch.set" && (body.value === "on" || body.value === "off")) {
    return { action: "switch.set", value: body.value };
  }

  if (body.action === "heating.setSetpoint" && typeof body.value === "number" && Number.isFinite(body.value)) {
    return { action: "heating.setSetpoint", value: body.value };
  }

  const ventilationValues: VentilationLevel[] = ["off", "low", "medium", "high"];
  if (body.action === "ventilation.setLevel" && ventilationValues.includes(body.value as VentilationLevel)) {
    return { action: "ventilation.setLevel", value: body.value as VentilationLevel };
  }

  throw new Error("Unsupported or invalid command payload");
}

export async function POST(request: Request, context: Context) {
  const { deviceId } = await context.params;
  try {
    const command = parseCommand(await request.json());
    const result = await getIoTAdapter().sendCommand(deviceId, command);
    await writeLog("info", "device.command", result.message, { deviceId, command });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeLog("error", "device.command", message, { deviceId });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
