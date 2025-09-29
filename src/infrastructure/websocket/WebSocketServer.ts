import { WebSocketServer as WSWebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { NotificationClient } from '../../domain/notifications/NotificationService';
import { INotificationService } from '../../domain/notifications/NotificationService';

export interface WebSocketConfig {
  port: number;
  jwtSecret: string;
  corsOrigin: string;
}

export class WebSocketServer {
  private wss: WSWebSocketServer;
  private clients: Map<string, NotificationClient> = new Map();
  private jwtSecret: string;
  private notificationService?: INotificationService;

  constructor(server: Server, config: WebSocketConfig) {
    this.jwtSecret = config.jwtSecret;
    
    this.wss = new WSWebSocketServer({
      server,
      path: '/ws'
    });

    this.setupWebSocketHandlers();
    this.startPingInterval();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('Nueva conexión WebSocket intentada');

      // Verificar autenticación
      const token = this.extractTokenFromRequest(request);
      if (!token) {
        ws.close(1008, 'Token de autenticación requerido');
        return;
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        const clientId = decoded.clientId;

        const client: NotificationClient = {
          id: clientId,
          socket: ws,
          filters: {},
          lastSeen: new Date()
        };

        this.clients.set(clientId, client);
        
        // Registrar cliente en el servicio de notificaciones
        if (this.notificationService) {
          this.notificationService.addClient(client);
          console.log(`✅ Cliente ${clientId} registrado en el servicio de notificaciones`);
        } else {
          console.warn(`⚠️ NotificationService no disponible para cliente ${clientId}`);
        }
        
        console.log(`🔌 Cliente ${clientId} conectado. Total clientes: ${this.clients.size}`);

        // Enviar mensaje de bienvenida
        ws.send(JSON.stringify({
          type: 'connected',
          clientId: clientId,
          timestamp: new Date().toISOString()
        }));

        // Configurar handlers del WebSocket
        this.setupClientHandlers(client);

      } catch (error) {
        console.error('Error de autenticación:', error);
        ws.close(1008, 'Token inválido');
      }
    });
  }

  private extractTokenFromRequest(request: any): string | null {
    // Buscar token en query parameters o headers
    const url = new URL(request.url, `http://${request.headers.host}`);
    return url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');
  }

  private setupClientHandlers(client: NotificationClient): void {
    const ws = client.socket;

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(client, message);
      } catch (error) {
        console.error('Error procesando mensaje del cliente:', error);
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.clients.delete(client.id);
      
      // Remover cliente del servicio de notificaciones
      if (this.notificationService) {
        this.notificationService.removeClient(client.id);
      }
      
      console.log(`🔌 Cliente ${client.id} desconectado. Código: ${code}, Razón: ${reason?.toString() || 'N/A'}. Total clientes: ${this.clients.size}`);
    });

    ws.on('error', (error: Error) => {
      console.error(`❌ Error en WebSocket del cliente ${client.id}:`, error);
      this.clients.delete(client.id);
      
      // Remover cliente del servicio de notificaciones
      if (this.notificationService) {
        this.notificationService.removeClient(client.id);
      }
    });

    // Ping/pong para mantener conexión viva
    ws.on('pong', () => {
      client.lastSeen = new Date();
    });
  }

  private handleClientMessage(client: NotificationClient, message: any): void {
    switch (message.type) {
      case 'update_filters':
        client.filters = message.filters;
        
        // Actualizar filtros en el servicio de notificaciones
        if (this.notificationService && 'updateClientFilters' in this.notificationService) {
          (this.notificationService as any).updateClientFilters(client.id, message.filters);
        }
        
        console.log(`Filtros actualizados para cliente ${client.id}`);
        break;
      
      case 'ping':
        client.lastSeen = new Date();
        client.socket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
      
      default:
        console.log(`Tipo de mensaje no reconocido: ${message.type}`);
    }
  }

  public broadcastEvent(event: any): void {
    const message = JSON.stringify({
      type: 'event',
      data: event,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((client) => {
      if (this.shouldSendEventToClient(client, event)) {
        try {
          client.socket.send(message);
        } catch (error) {
          console.error(`Error enviando evento a cliente ${client.id}:`, error);
          this.clients.delete(client.id);
        }
      }
    });
  }

  private shouldSendEventToClient(client: NotificationClient, event: any): boolean {
    // Aplicar filtros del cliente
    if (!client.filters.enabled) {
      return false;
    }

    if (client.filters.types && !client.filters.types.includes(event.type)) {
      return false;
    }

    if (client.filters.severity && !client.filters.severity.includes(event.severity)) {
      return false;
    }

    if (client.filters.cameras && !client.filters.cameras.includes(event.camera.id)) {
      return false;
    }

    return true;
  }

  public getConnectedClients(): NotificationClient[] {
    return Array.from(this.clients.values());
  }

  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.socket.close();
      this.clients.delete(clientId);
    }
  }

  public generateClientToken(clientId: string): string {
    return jwt.sign(
      { clientId, iat: Math.floor(Date.now() / 1000) },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  public setNotificationService(notificationService: INotificationService): void {
    this.notificationService = notificationService;
  }

  private startPingInterval(): void {
    setInterval(() => {
      this.clients.forEach((client) => {
        if (client.socket.readyState === 1) { // WebSocket.OPEN
          client.socket.ping();
        } else {
          // Cliente desconectado, removerlo
          this.clients.delete(client.id);
          if (this.notificationService) {
            this.notificationService.removeClient(client.id);
          }
        }
      });
    }, 30000); // Ping cada 30 segundos
  }
}

