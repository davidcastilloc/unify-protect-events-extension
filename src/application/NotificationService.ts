import { INotificationService, NotificationClient, NotificationPayload } from '../domain/notifications/NotificationService';
import { UnifiEvent } from '../domain/events/UnifiEvent';

export class NotificationService implements INotificationService {
  private clients: Map<string, NotificationClient> = new Map();

  addClient(client: NotificationClient): void {
    this.clients.set(client.id, client);
    console.log(`✅ Cliente ${client.id} agregado al servicio de notificaciones. Total clientes: ${this.clients.size}`);
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`🔌 Cliente ${clientId} removido del servicio de notificaciones. Total clientes: ${this.clients.size}`);
    }
  }

  broadcastEvent(event: UnifiEvent): void {
    console.log(`📡 Transmitiendo evento ${event.id} (${event.type}) a ${this.clients.size} clientes conectados`);

    // Convertir UnifiEvent al formato simple
    const simpleEvent = {
      type: event.type,
      timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
      camera: {
        name: event.camera.name
      },
      metadata: {
        ...event.metadata,
        id: event.id,
        severity: event.severity,
        description: event.description,
        thumbnailUrl: event.thumbnailUrl,
        cameraId: event.camera.id,
        cameraType: event.camera.type,
        cameraLocation: event.camera.location
      }
    };

    let notifiedClients = 0;
    this.clients.forEach((client) => {
      if (this.shouldNotifyClient(client, event)) {
        this.sendSimpleEventToClient(client, simpleEvent);
        notifiedClients++;
      }
    });
    
    console.log(`📤 Evento enviado a ${notifiedClients} de ${this.clients.size} clientes`);
  }

  broadcastSimpleEvent(event: any): void {
    console.log(`📡 Transmitiendo evento simple (${event.type}) a ${this.clients.size} clientes conectados`);

    let notifiedClients = 0;
    this.clients.forEach((client) => {
      // Para eventos simples del simulador, enviamos directamente sin filtros complejos
      if (client.filters.enabled) {
        this.sendSimpleEventToClient(client, event);
        notifiedClients++;
      }
    });
    
    console.log(`📤 Evento simple enviado a ${notifiedClients} de ${this.clients.size} clientes`);
  }

  private shouldNotifyClient(client: NotificationClient, event: UnifiEvent): boolean {
    const filters = client.filters;

    // Si las notificaciones están deshabilitadas
    if (!filters.enabled) {
      console.log(`🔕 Cliente ${client.id}: notificaciones deshabilitadas`);
      return false;
    }

    // Filtrar por tipo de evento
    if (filters.types && filters.types.length > 0 && !filters.types.includes(event.type)) {
      console.log(`🔕 Cliente ${client.id}: tipo de evento ${event.type} no incluido en filtros [${filters.types.join(', ')}]`);
      return false;
    }

    // Filtrar por severidad
    if (filters.severity && filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      console.log(`🔕 Cliente ${client.id}: severidad ${event.severity} no incluida en filtros [${filters.severity.join(', ')}]`);
      return false;
    }

    // Filtrar por cámaras específicas
    if (filters.cameras && filters.cameras.length > 0 && !filters.cameras.includes(event.camera.id)) {
      console.log(`🔕 Cliente ${client.id}: cámara ${event.camera.id} no incluida en filtros [${filters.cameras.join(', ')}]`);
      return false;
    }

    console.log(`✅ Cliente ${client.id}: evento aprobado por filtros`);
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

  private sendSimpleEventToClient(client: NotificationClient, event: any): void {
    try {
      const message = JSON.stringify(event);

      if (client.socket.readyState === 1) { // WebSocket.OPEN
        client.socket.send(message);
        console.log(`Evento simple enviado a cliente ${client.id}`);
      } else {
        console.warn(`Cliente ${client.id} no está conectado, removiendo...`);
        this.removeClient(client.id);
      }
    } catch (error) {
      console.error(`Error enviando evento simple a cliente ${client.id}:`, error);
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

