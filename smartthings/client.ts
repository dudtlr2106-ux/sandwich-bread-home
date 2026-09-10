import "server-only";
import type { SmartThingsCommand, SmartThingsDevice, SmartThingsRoom, SmartThingsStatus } from "@/smartthings/types";

export class SmartThingsApiError extends Error {}

function config() {
  const token = process.env.SMARTTHINGS_TOKEN;
  if (!token) throw new Error("SMARTTHINGS_TOKEN is missing. Keep it in a server-only environment variable.");

  return {
    token,
    baseUrl: (process.env.SMARTTHINGS_BASE_URL ?? "https://api.smartthings.com/v1").replace(/\/$/, ""),
  };
}

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const { token, baseUrl } = config();
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new SmartThingsApiError(`SmartThings API ${response.status}: ${body.replaceAll(token, "[redacted]").slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export async function listSmartThingsDevices() {
  const locationId = process.env.SMARTTHINGS_LOCATION_ID;
  const params = new URLSearchParams({ includeStatus: "true", includeHealth: "true" });
  if (locationId) params.set("locationId", locationId);
  const response = await request<{ items: SmartThingsDevice[] }>(`/devices?${params.toString()}`);
  return response.items ?? [];
}

export async function getSmartThingsDeviceStatus(deviceId: string) {
  return request<SmartThingsStatus>(`/devices/${encodeURIComponent(deviceId)}/status`);
}

export async function listSmartThingsRooms(locationId: string) {
  const response = await request<{ items: SmartThingsRoom[] }>(`/locations/${encodeURIComponent(locationId)}/rooms`);
  return response.items ?? [];
}

export async function executeSmartThingsCommands(deviceId: string, commands: SmartThingsCommand[]) {
  return request<unknown>(`/devices/${encodeURIComponent(deviceId)}/commands`, {
    method: "POST",
    body: JSON.stringify({ commands }),
  });
}

export async function getSmartThingsCapability(id: string, version: number) {
  return request<{ commands?: Record<string, { arguments?: Array<{ optional?: boolean }> }> }>(
    `/capabilities/${encodeURIComponent(id)}/${version}`,
  );
}
