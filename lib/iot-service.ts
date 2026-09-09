import "server-only";
import { MockAdapter } from "@/adapters/mock-adapter";
import { SmartThingsAdapter } from "@/adapters/smartthings-adapter";
import type { IoTAdapter } from "@/adapters/iot-adapter";
import { getIoTMode } from "@/lib/mode";

let adapter: IoTAdapter | undefined;
let adapterMode: string | undefined;

export function getIoTAdapter(): IoTAdapter {
  const mode = getIoTMode();
  if (!adapter || adapterMode !== mode) {
    adapter = mode === "smartthings" ? new SmartThingsAdapter() : new MockAdapter();
    adapterMode = mode;
  }
  return adapter;
}
