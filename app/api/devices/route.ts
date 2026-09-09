import { NextResponse } from "next/server";
import { getIoTAdapter } from "@/lib/iot-service";
import { getIoTMode } from "@/lib/mode";
import { writeLog } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const devices = await getIoTAdapter().listDevices();
    await writeLog("info", "devices.list", `Loaded ${devices.length} devices`, { mode: getIoTMode() });
    return NextResponse.json({ mode: getIoTMode(), devices });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeLog("error", "devices.list", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
