import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocketServer } from './infrastructure/websocket/WebSocketServer';
import { UnifiProtectClient } from './infrastructure/unifi/UnifiProtectClient';
import { NotificationService } from './application/NotificationService';
import { UnifiEvent } from './domain/events/UnifiEvent';
import { SimulationRoutes } from './simulation/SimulationRoutes';
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
  private simulationRoutes!: SimulationRoutes;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    
    this.server = createServer(this.app);
    this.setupNotificationService(); // Primero el servicio de notificaciones
    this.setupSimulation(); // Luego la simulación (necesita notificationService)
    this.setupRoutes(); // Después las rutas (necesita simulationRoutes)
    this.setupWebSocketServer();
    this.setupUnifiClient();
  }

  private setupMiddleware(): void {
    // Configurar Helmet con CSP más permisivo para simulación
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
    }));
    
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Servir archivos estáticos para la interfaz de simulación
    this.app.use('/simulation', express.static(path.join(__dirname, 'simulation/public')));
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

    // Rutas de simulación
    this.app.use('/api/simulation', this.simulationRoutes.getRouter());

    // Ruta para la interfaz web de simulación
    this.app.get('/simulation', (req, res) => {
      res.sendFile(path.join(__dirname, 'simulation/public/simulation.html'));
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

  private setupSimulation(): void {
    this.simulationRoutes = new SimulationRoutes();
    
    // Conectar el controlador de simulación con el servicio de notificaciones
    this.simulationRoutes.getSimulationController().setNotificationService(this.notificationService);
    
    logger.info('Módulo de simulación configurado y conectado');
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
        logger.info(`Interfaz de simulación: http://localhost:${port}/simulation`);
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
    
    // Desconectar simulación
    this.simulationRoutes.getSimulationController().disconnect();
    
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

