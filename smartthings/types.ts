export type SmartThingsCapabilityRef = { id: string; version: number };

export type SmartThingsDevice = {
  deviceId: string;
  name: string;
  label?: string;
  manufacturerName?: string;
  locationId?: string;
  roomId?: string;
  components?: Array<{
    id: string;
    label?: string;
    capabilities?: SmartThingsCapabilityRef[];
    categories?: Array<{ name: string; categoryType?: string }>;
  }>;
  status?: SmartThingsStatus;
  health?: { state?: string; lastUpdatedDate?: string };
};

export type SmartThingsStatusValue = {
  value?: unknown;
  unit?: string;
  timestamp?: string;
};

export type SmartThingsStatus = {
  components?: Record<string, Record<string, Record<string, SmartThingsStatusValue>>>;
};

export type SmartThingsRoom = {
  roomId: string;
  locationId?: string;
  name: string;
};

export type SmartThingsCommand = {
  component: string;
  capability: string;
  command: string;
  arguments?: unknown[];
};
