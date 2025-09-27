import { UnifiEvent } from '../events/UnifiEvent';

export interface NotificationPayload {
  event: UnifiEvent;
  clientId: string;
}

export interface NotificationClient {
  id: string;
  socket: any; // WebSocket
  filters: any; // EventFilter
  lastSeen: Date;
}

export interface INotificationService {
  addClient(client: NotificationClient): void;
  removeClient(clientId: string): void;
  broadcastEvent(event: UnifiEvent): void;
  getConnectedClients(): NotificationClient[];
}

