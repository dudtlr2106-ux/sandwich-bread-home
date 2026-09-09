import "server-only";
import type { IoTMode } from "@/lib/types";

export function getIoTMode(): IoTMode {
  return process.env.IOT_MODE === "smartthings" ? "smartthings" : "mock";
}
