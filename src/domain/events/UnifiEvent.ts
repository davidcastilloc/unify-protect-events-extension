export enum EventType {
  MOTION = 'motion',
  PERSON = 'person',
  VEHICLE = 'vehicle',
  PACKAGE = 'package',
  DOORBELL = 'doorbell',
  SMART_DETECT = 'smart_detect',
  SENSOR = 'sensor'
}

export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CameraInfo {
  id: string;
  name: string;
  type: string;
  location?: string;
}

export interface UnifiEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  timestamp: Date;
  camera: CameraInfo;
  description: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface EventFilter {
  types?: EventType[];
  severity?: EventSeverity[];
  cameras?: string[];
  enabled: boolean;
}

