import { NextResponse } from "next/server";
import { getIoTAdapter } from "@/lib/iot-service";
import { writeLog } from "@/lib/logger";

export const runtime = "nodejs";

type Context = { params: Promise<{ deviceId: string }> };

export async function GET(_request: Request, context: Context) {
  const { deviceId } = await context.params;
  try {
    const device = await getIoTAdapter().getDeviceStatus(deviceId);
    await writeLog("info", "device.status", `Loaded status for ${device.label}`, { deviceId });
    return NextResponse.json({ device });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeLog("error", "device.status", message, { deviceId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
