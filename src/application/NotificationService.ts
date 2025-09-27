import { INotificationService, NotificationClient, NotificationPayload } from '../domain/notifications/NotificationService';
import { UnifiEvent } from '../domain/events/UnifiEvent';

export class NotificationService implements INotificationService {
  private clients: Map<string, NotificationClient> = new Map();

  addClient(client: NotificationClient): void {
    this.clients.set(client.id, client);
    console.log(`Cliente ${client.id} agregado al servicio de notificaciones`);
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`Cliente ${clientId} removido del servicio de notificaciones`);
    }
  }

  broadcastEvent(event: UnifiEvent): void {
    const payload: NotificationPayload = {
      event,
      clientId: 'broadcast'
    };

    console.log(`Transmitiendo evento ${event.id} a ${this.clients.size} clientes`);

    this.clients.forEach((client) => {
      if (this.shouldNotifyClient(client, event)) {
        this.sendNotificationToClient(client, payload);
      }
    });
  }

  private shouldNotifyClient(client: NotificationClient, event: UnifiEvent): boolean {
    const filters = client.filters;

    // Si las notificaciones están deshabilitadas
    if (!filters.enabled) {
      return false;
    }

    // Filtrar por tipo de evento
    if (filters.types && filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Filtrar por severidad
    if (filters.severity && filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      return false;
    }

    // Filtrar por cámaras específicas
    if (filters.cameras && filters.cameras.length > 0 && !filters.cameras.includes(event.camera.id)) {
      return false;
    }

    return true;
  }

  private sendNotificationToClient(client: NotificationClient, payload: NotificationPayload): void {
    try {
      const message = JSON.stringify({
        type: 'notification',
        payload,
        timestamp: new Date().toISOString()
      });

      if (client.socket.readyState === 1) { // WebSocket.OPEN
        client.socket.send(message);
        console.log(`Notificación enviada a cliente ${client.id}`);
      } else {
        console.warn(`Cliente ${client.id} no está conectado, removiendo...`);
        this.removeClient(client.id);
      }
    } catch (error) {
      console.error(`Error enviando notificación a cliente ${client.id}:`, error);
      this.removeClient(client.id);
    }
  }

  getConnectedClients(): NotificationClient[] {
    return Array.from(this.clients.values());
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public updateClientFilters(clientId: string, filters: any): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.filters = filters;
      console.log(`Filtros actualizados para cliente ${clientId}`);
    }
  }
}

