import { NextResponse } from "next/server";
import { getIoTMode } from "@/lib/mode";
import { writeLog } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST() {
  const mock = getIoTMode() === "mock";
  const message = mock
    ? "엘리베이터 호출 완료 (MOCK)"
    : "KOCOM 월패드·RS485 호출 패킷과 브리지 연결을 확인 중입니다.";
  await writeLog(mock ? "info" : "warn", "elevator.call", message, { mode: getIoTMode(), provider: "kocom-rs485", sent: false });
  return NextResponse.json({ ok: mock, message, code: mock ? "MOCK_CALL" : "KOCOM_NOT_CONFIGURED" }, { status: mock ? 200 : 501 });
}
