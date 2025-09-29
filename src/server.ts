import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { WebSocketServer } from './infrastructure/websocket/WebSocketServer';
import { UnifiProtectClient } from './infrastructure/unifi/UnifiProtectClient';
import { NotificationService } from './application/NotificationService';
import { UnifiEvent } from './domain/events/UnifiEvent';
import winston from 'winston';

// Cargar variables de entorno
dotenv.config();

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class UnifiNotificationServer {
  private app: express.Application;
  private server: any;
  private wsServer!: WebSocketServer;
  private unifiClient!: UnifiProtectClient;
  private notificationService!: NotificationService;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.server = createServer(this.app);
    this.setupNotificationService(); // Mover antes del WebSocketServer
    this.setupWebSocketServer();
    this.setupUnifiClient();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        clients: this.notificationService?.getClientCount() || 0
      });
    });

    // Generar token para cliente
    this.app.post('/auth/token', (req, res) => {
      const { clientId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ error: 'clientId es requerido' });
      }

      const token = this.wsServer.generateClientToken(clientId);
      return res.json({ token });
    });

    // Obtener cámaras disponibles
    this.app.get('/api/cameras', async (req, res) => {
      try {
        const cameras = await this.unifiClient.getCameras();
        res.json(cameras);
      } catch (error) {
        logger.error('Error obteniendo cámaras:', error);
        res.status(500).json({ error: 'Error obteniendo cámaras' });
      }
    });

    // WebSocket endpoint info
    this.app.get('/api/ws-info', (req, res) => {
      res.json({
        endpoint: `ws://${req.get('host')}/ws`,
        clients: this.notificationService?.getClientCount() || 0
      });
    });

  }

  private setupWebSocketServer(): void {
    const config = {
      port: parseInt(process.env.PORT || '3001'),
      jwtSecret: process.env.JWT_SECRET || 'default-secret',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001'
    };

    this.wsServer = new WebSocketServer(this.server, config);
    
    // Conectar el WebSocketServer con el NotificationService
    this.wsServer.setNotificationService(this.notificationService);
    
    logger.info('Servidor WebSocket configurado');
  }

  private setupUnifiClient(): void {
    const config = {
      host: process.env.UNIFI_HOST || '192.168.1.100',
      port: parseInt(process.env.UNIFI_PORT || '443'),
      apiKey: process.env.UNIFI_API_KEY || '',
      sslVerify: process.env.UNIFI_SSL_VERIFY === 'true'
    };

    this.unifiClient = new UnifiProtectClient(config);
    logger.info('Cliente UniFi Protect configurado');
  }

  private setupNotificationService(): void {
    this.notificationService = new NotificationService();
    logger.info('Servicio de notificaciones configurado');
  }

  private async startUnifiConnection(): Promise<void> {
    try {
      await this.unifiClient.connect();
      
      // Suscribirse a eventos
      this.unifiClient.subscribeToEvents((event: UnifiEvent) => {
        logger.info(`Evento recibido: ${event.type} desde ${event.camera.name}`);
        this.notificationService.broadcastEvent(event);
      });

      logger.info('Conexión con UniFi Protect establecida');
    } catch (error) {
      logger.error('Error conectando con UniFi Protect:', error);
      // Reintentar conexión después de 30 segundos
      setTimeout(() => this.startUnifiConnection(), 30000);
    }
  }

  public async start(): Promise<void> {
    const port = process.env.PORT || 3001;

    try {
      // Iniciar servidor HTTP
      this.server.listen(port, () => {
        logger.info(`Servidor iniciado en puerto ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`WebSocket: ws://localhost:${port}/ws`);
      });

      // Conectar con UniFi Protect
      await this.startUnifiConnection();

    } catch (error) {
      logger.error('Error iniciando servidor:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Deteniendo servidor...');
    
    this.unifiClient.disconnect();
    this.server.close(() => {
      logger.info('Servidor detenido');
      process.exit(0);
    });
  }
}

// Manejar señales de terminación
const server = new UnifiNotificationServer();

process.on('SIGINT', async () => {
  await server.stop();
});

process.on('SIGTERM', async () => {
  await server.stop();
});

// Iniciar servidor
server.start().catch((error) => {
  logger.error('Error fatal:', error);
  process.exit(1);
});

