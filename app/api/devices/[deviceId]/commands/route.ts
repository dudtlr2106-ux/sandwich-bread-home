import { NextResponse } from "next/server";
import { getIoTAdapter } from "@/lib/iot-service";
import { writeLog } from "@/lib/logger";
import { InvalidCommandError, parseCommand } from "@/lib/command-parser";
import { SmartThingsApiError } from "@/smartthings/client";

export const runtime = "nodejs";

type Context = { params: Promise<{ deviceId: string }> };

export async function POST(request: Request, context: Context) {
  const { deviceId } = await context.params;
  try {
    const command = parseCommand(await request.json());
    const result = await getIoTAdapter().sendCommand(deviceId, command);
    await writeLog("info", "device.command", result.message, { deviceId, command });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const invalid = error instanceof InvalidCommandError || error instanceof SyntaxError;
    const code = invalid ? "INVALID_COMMAND" : error instanceof SmartThingsApiError ? "SMARTTHINGS_API_ERROR" : "COMMAND_REJECTED";
    await writeLog("error", "device.command", message, { deviceId, code });
    return NextResponse.json({ error: message, code }, { status: error instanceof SmartThingsApiError ? 502 : 400 });
  }
}
