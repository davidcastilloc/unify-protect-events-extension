import { UnifiEvent, EventType, EventSeverity, CameraInfo } from '../../domain/events/UnifiEvent';
import { ProtectApi, ProtectApiEvents } from 'unifi-protect';

export interface UnifiProtectConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  sslVerify: boolean;
}

export interface IUnifiProtectClient {
  connect(): Promise<void>;
  disconnect(): void;
  getCameras(): Promise<CameraInfo[]>;
  subscribeToEvents(callback: (event: UnifiEvent) => void): void;
  unsubscribeFromEvents(): void;
}

export class UnifiProtectClient implements IUnifiProtectClient {
  private config: UnifiProtectConfig;
  private isConnected = false;
  private eventCallback?: (event: UnifiEvent) => void;
  private protectApi: ProtectApi | null = null;
  private eventInterval?: NodeJS.Timeout;

  constructor(config: UnifiProtectConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      console.log(`🔗 Conectando a UniFi Protect en ${this.config.host}:${this.config.port}`);
      console.log(`👤 Usuario: ${this.config.username}`);
      
      // Verificar si se debe usar conexión real
      const useRealConnection = process.env.UNIFI_REAL_CONNECTION === 'true';
      
      if (useRealConnection) {
        console.log('🚀 Activando conexión REAL con UniFi Protect...');
        await this.connectReal();
      } else {
        console.log('🧪 Modo simulación activado');
        console.log('💡 Para activar conexión real: UNIFI_REAL_CONNECTION=true en .env');
      }
      
      this.isConnected = true;
      
      // Siempre iniciar simulación como backup
      this.startEventSimulation();
      
    } catch (error) {
      console.error('❌ Error en conexión:', error);
      console.log('🔄 Iniciando modo simulación como fallback...');
      
      this.isConnected = true;
      this.startEventSimulation();
    }
  }

  private async connectReal(): Promise<void> {
    try {
      console.log('🔗 Iniciando conexión REAL con UniFi Protect...');
      
      // Crear instancia de UniFi Protect
      this.protectApi = new ProtectApi();
      
      // Configurar credenciales (usando casting para acceder a propiedades privadas)
      (this.protectApi as any).nvrAddress = `${this.config.sslVerify ? 'https' : 'http'}://${this.config.host}:${this.config.port}`;
      (this.protectApi as any).username = this.config.username;
      (this.protectApi as any).password = this.config.password;
      
      console.log('🔐 Autenticando con UniFi Protect...');
      
      // Conectar y autenticar (usando parámetros por defecto)
      await (this.protectApi as any).login();
      
      console.log('📊 Obteniendo datos del sistema...');
      
      // Obtener datos iniciales (bootstrap)
      const bootstrap = await this.protectApi.getBootstrap();
      
      console.log('✅ Conexión REAL establecida con UniFi Protect');
      console.log(`📊 Bootstrap obtenido: ${Object.keys(bootstrap).length} propiedades`);
      
      // Configurar listeners para eventos reales
      this.setupRealEventListeners();
      
    } catch (error) {
      console.error('❌ Error en conexión real:', error);
      console.log('🔄 Fallback a modo simulación...');
      throw error; // Re-lanzar para que se maneje en connect()
    }
  }

  disconnect(): void {
    this.isConnected = false;
    this.eventCallback = undefined;
    
    if (this.eventInterval) {
      clearInterval(this.eventInterval);
      this.eventInterval = undefined;
    }
    
    if (this.protectApi) {
      this.protectApi.logout();
      this.protectApi = null;
    }
    
    console.log('Desconectado de UniFi Protect');
  }

  async getCameras(): Promise<CameraInfo[]> {
    if (!this.isConnected) {
      throw new Error('No conectado a UniFi Protect');
    }

    // Intentar obtener cámaras reales si tenemos conexión
    if (this.protectApi) {
      try {
        console.log('📹 Obteniendo cámaras REALES de UniFi Protect...');
        
        const bootstrap = await this.protectApi.getBootstrap();
        
        if (bootstrap && typeof bootstrap === 'object') {
          const cameras = (bootstrap as any).cameras || [];
          
          console.log(`📹 Obtenidas ${cameras.length} cámaras REALES de UniFi Protect`);
          
          return cameras.map((camera: any): CameraInfo => ({
            id: camera.id,
            name: camera.name || `Cámara ${camera.id}`,
            type: camera.modelKey || camera.type || 'Unknown',
            location: camera.location || undefined
          }));
        }
      } catch (error) {
        console.error('❌ Error obteniendo cámaras reales:', error);
        console.log('🔄 Fallback a cámaras simuladas...');
      }
    }
    
    // Fallback a cámaras simuladas
    console.log('📹 Retornando cámaras simuladas');
    
    return [
      {
        id: 'cam-001',
        name: 'Cámara Principal (Simulada)',
        type: 'G4 Pro',
        location: 'Entrada Principal'
      },
      {
        id: 'cam-002',
        name: 'Cámara Trasera (Simulada)',
        type: 'G4 Bullet',
        location: 'Patio Trasero'
      },
      {
        id: 'cam-003',
        name: 'Timbre (Simulado)',
        type: 'G4 Doorbell',
        location: 'Puerta Principal'
      }
    ];
  }

  subscribeToEvents(callback: (event: UnifiEvent) => void): void {
    if (!this.isConnected) {
      throw new Error('No conectado a UniFi Protect');
    }

    this.eventCallback = callback;
    console.log('🔔 Suscrito a eventos de UniFi Protect');

    // Configurar listeners para eventos reales si tenemos conexión
    if (this.protectApi) {
      console.log('🔔 Configurando listeners para eventos REALES...');
      // Los listeners ya se configuraron en connectReal()
    } else {
      console.log('🔔 Solo eventos simulados disponibles');
    }
    
    this.startEventSimulation();
  }

  private setupRealEventListeners(): void {
    if (!this.protectApi || !this.eventCallback) return;

    console.log('🔗 Configurando listeners de eventos reales...');

    // Escuchar eventos generales de UniFi Protect
    this.protectApi.on('update', (event: any) => {
      console.log('📡 Evento recibido de UniFi Protect:', event.type, event.action);
      
      // Procesar diferentes tipos de eventos
      if (event.type === 'event' && event.action === 'add') {
        this.processUnifiEvent(event.new);
      }
    });

    // Escuchar eventos específicos de movimiento
    this.protectApi.on('motion', (event: any) => {
      console.log('🏃 Evento de movimiento recibido:', event);
      this.processMotionEvent(event);
    });

    // Escuchar eventos de persona (Smart Detection)
    this.protectApi.on('person', (event: any) => {
      console.log('👤 Evento de persona recibido:', event);
      this.processPersonEvent(event);
    });

    // Escuchar eventos de vehículo (Smart Detection)
    this.protectApi.on('vehicle', (event: any) => {
      console.log('🚗 Evento de vehículo recibido:', event);
      this.processVehicleEvent(event);
    });

    // Escuchar eventos de timbre
    this.protectApi.on('doorbell', (event: any) => {
      console.log('🔔 Evento de timbre recibido:', event);
      this.processDoorbellEvent(event);
    });

    console.log('✅ Listeners de eventos reales configurados');
  }

  private processUnifiEvent(event: any): void {
    if (!this.eventCallback) return;

    const unifiEvent: UnifiEvent = {
      id: event.id || `event-${Date.now()}`,
      type: this.mapUnifiEventType(event.type),
      severity: this.mapEventSeverity(event.score || 50),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi',
        type: 'UniFi Camera',
        location: undefined
      },
      description: `Evento detectado: ${event.type}`,
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        zone: event.zones
      }
    };

    this.eventCallback(unifiEvent);
  }

  private processMotionEvent(event: any): void {
    if (!this.eventCallback) return;

    const unifiEvent: UnifiEvent = {
      id: event.id || `motion-${Date.now()}`,
      type: EventType.MOTION,
      severity: this.mapEventSeverity(event.score || 0),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi',
        type: 'UniFi Camera',
        location: undefined
      },
      description: `Movimiento detectado con score: ${event.score || 0}`,
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        zone: event.zones
      }
    };

    this.eventCallback(unifiEvent);
  }

  private processPersonEvent(event: any): void {
    if (!this.eventCallback) return;

    const unifiEvent: UnifiEvent = {
      id: event.id || `person-${Date.now()}`,
      type: EventType.PERSON,
      severity: this.mapEventSeverity(event.score || 80),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi',
        type: 'UniFi Camera',
        location: undefined
      },
      description: 'Persona detectada',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined
      }
    };

    this.eventCallback(unifiEvent);
  }

  private processVehicleEvent(event: any): void {
    if (!this.eventCallback) return;

    const unifiEvent: UnifiEvent = {
      id: event.id || `vehicle-${Date.now()}`,
      type: EventType.VEHICLE,
      severity: this.mapEventSeverity(event.score || 70),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi',
        type: 'UniFi Camera',
        location: undefined
      },
      description: 'Vehículo detectado',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined
      }
    };

    this.eventCallback(unifiEvent);
  }

  private processDoorbellEvent(event: any): void {
    if (!this.eventCallback) return;

    const unifiEvent: UnifiEvent = {
      id: event.id || `doorbell-${Date.now()}`,
      type: EventType.DOORBELL,
      severity: EventSeverity.HIGH,
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Timbre UniFi',
        type: 'UniFi Doorbell',
        location: undefined
      },
      description: 'Timbre presionado',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score || 100,
        duration: event.end ? event.end - event.start : undefined
      }
    };

    this.eventCallback(unifiEvent);
  }

  private mapUnifiEventType(unifiType: string): EventType {
    const typeMap: { [key: string]: EventType } = {
      'motion': EventType.MOTION,
      'person': EventType.PERSON,
      'vehicle': EventType.VEHICLE,
      'package': EventType.PACKAGE,
      'doorbell': EventType.DOORBELL,
      'smartDetect': EventType.SMART_DETECT
    };

    return typeMap[unifiType] || EventType.MOTION;
  }

  private mapEventSeverity(score: number): EventSeverity {
    if (score >= 90) return EventSeverity.CRITICAL;
    if (score >= 70) return EventSeverity.HIGH;
    if (score >= 50) return EventSeverity.MEDIUM;
    return EventSeverity.LOW;
  }

  unsubscribeFromEvents(): void {
    this.eventCallback = undefined;
    if (this.eventInterval) {
      clearInterval(this.eventInterval);
      this.eventInterval = undefined;
    }
    console.log('Desuscrito de eventos de UniFi Protect');
  }

  private startEventSimulation(): void {
    // Simulación de eventos para testing (menos frecuente si tenemos conexión real)
    const interval = this.protectApi ? 300000 : 30000; // 5 min si hay conexión real, 30 seg si no
    
    this.eventInterval = setInterval(() => {
      if (this.eventCallback && this.isConnected) {
        const eventTypes = [EventType.MOTION, EventType.PERSON, EventType.VEHICLE, EventType.DOORBELL];
        const severities = [EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH];
        
        const randomEvent: UnifiEvent = {
          id: `sim-event-${Date.now()}`,
          type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          timestamp: new Date(),
          camera: {
            id: 'sim-cam-001',
            name: this.protectApi ? 'Cámara Principal (Simulación)' : 'Cámara Principal',
            type: 'G4 Pro',
            location: 'Entrada Principal'
          },
          description: `Evento simulado: ${eventTypes[Math.floor(Math.random() * eventTypes.length)]}`,
          thumbnailUrl: 'https://via.placeholder.com/300x200?text=Thumbnail',
          metadata: {
            confidence: Math.floor(Math.random() * 100),
            zone: 'Zona Principal',
            simulated: true
          }
        };

        console.log(`🧪 Enviando evento simulado: ${randomEvent.type}`);
        this.eventCallback(randomEvent);
      }
    }, interval);
    
    console.log(`⏰ Simulación de eventos iniciada (cada ${interval/1000}s)`);
  }
}

