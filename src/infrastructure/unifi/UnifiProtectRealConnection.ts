// IMPLEMENTACIÓN REAL DE CONEXIÓN CON UNIFI PROTECT
// Este archivo contiene la implementación completa para conexión real
// Copia este código a UnifiProtectClient.ts cuando quieras activar la conexión real

import { UnifiEvent, EventType, EventSeverity, CameraInfo } from '../../domain/events/UnifiEvent';
import { ProtectApi } from 'unifi-protect';

export class UnifiProtectRealConnection {
  private protectApi: ProtectApi | null = null;
  private isConnected = false;

  async connectReal(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    sslVerify: boolean;
  }): Promise<void> {
    try {
      console.log(`🔗 Conectando REALMENTE a UniFi Protect en ${config.host}:${config.port}`);
      
      // Crear instancia de UniFi Protect
      this.protectApi = new ProtectApi();
      
      // Configurar credenciales (usando casting para acceder a propiedades privadas)
      (this.protectApi as any).nvrAddress = `${config.sslVerify ? 'https' : 'http'}://${config.host}:${config.port}`;
      (this.protectApi as any).username = config.username;
      (this.protectApi as any).password = config.password;
      
      // Conectar y autenticar
      await (this.protectApi as any).login();
      
      // Obtener datos iniciales
      const bootstrap = await this.protectApi.getBootstrap();
      
      this.isConnected = true;
      console.log('✅ Conexión REAL establecida con UniFi Protect');
      console.log(`📊 Bootstrap: ${Object.keys(bootstrap).length} propiedades`);
      
      // Bootstrap obtenido exitosamente
      
    } catch (error) {
      console.error('❌ Error en conexión real:', error);
      throw error;
    }
  }

  async getRealCameras(): Promise<CameraInfo[]> {
    if (!this.protectApi || !this.isConnected) {
      throw new Error('No conectado a UniFi Protect');
    }

    try {
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
      
      return [];
    } catch (error) {
      console.error('Error obteniendo cámaras reales:', error);
      throw error;
    }
  }

  setupRealEventListeners(callback: (event: UnifiEvent) => void): void {
    if (!this.protectApi || !this.isConnected) return;

    console.log('🔗 Configurando listeners de eventos REALES...');

    // Escuchar eventos generales
    this.protectApi.on('update', (event: any) => {
      console.log('📡 Evento REAL recibido:', event.type, event.action);
      
      if (event.type === 'event' && event.action === 'add') {
        this.processRealEvent(event.new, callback);
      }
    });

    // Escuchar eventos específicos
    this.protectApi.on('motion', (event: any) => {
      console.log('🏃 Movimiento REAL:', event);
      this.processMotionEvent(event, callback);
    });

    this.protectApi.on('person', (event: any) => {
      console.log('👤 Persona REAL detectada:', event);
      this.processPersonEvent(event, callback);
    });

    this.protectApi.on('vehicle', (event: any) => {
      console.log('🚗 Vehículo REAL detectado:', event);
      this.processVehicleEvent(event, callback);
    });

    this.protectApi.on('doorbell', (event: any) => {
      console.log('🔔 Timbre REAL presionado:', event);
      this.processDoorbellEvent(event, callback);
    });

    console.log('✅ Listeners de eventos REALES configurados');
  }

  private processRealEvent(event: any, callback: (event: UnifiEvent) => void): void {
    const unifiEvent: UnifiEvent = {
      id: event.id || `real-event-${Date.now()}`,
      type: this.mapUnifiEventType(event.type),
      severity: this.mapEventSeverity(event.score || 50),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi Real',
        type: 'UniFi Camera',
        location: undefined
      },
      description: `Evento REAL detectado: ${event.type}`,
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        zone: event.zones,
        real: true
      }
    };

    callback(unifiEvent);
  }

  private processMotionEvent(event: any, callback: (event: UnifiEvent) => void): void {
    const unifiEvent: UnifiEvent = {
      id: event.id || `real-motion-${Date.now()}`,
      type: EventType.MOTION,
      severity: this.mapEventSeverity(event.score || 0),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi Real',
        type: 'UniFi Camera',
        location: undefined
      },
      description: `Movimiento REAL detectado (score: ${event.score || 0})`,
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        zone: event.zones,
        real: true
      }
    };

    callback(unifiEvent);
  }

  private processPersonEvent(event: any, callback: (event: UnifiEvent) => void): void {
    const unifiEvent: UnifiEvent = {
      id: event.id || `real-person-${Date.now()}`,
      type: EventType.PERSON,
      severity: this.mapEventSeverity(event.score || 80),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi Real',
        type: 'UniFi Camera',
        location: undefined
      },
      description: 'Persona REAL detectada',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        real: true
      }
    };

    callback(unifiEvent);
  }

  private processVehicleEvent(event: any, callback: (event: UnifiEvent) => void): void {
    const unifiEvent: UnifiEvent = {
      id: event.id || `real-vehicle-${Date.now()}`,
      type: EventType.VEHICLE,
      severity: this.mapEventSeverity(event.score || 70),
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Cámara UniFi Real',
        type: 'UniFi Camera',
        location: undefined
      },
      description: 'Vehículo REAL detectado',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score,
        duration: event.end ? event.end - event.start : undefined,
        real: true
      }
    };

    callback(unifiEvent);
  }

  private processDoorbellEvent(event: any, callback: (event: UnifiEvent) => void): void {
    const unifiEvent: UnifiEvent = {
      id: event.id || `real-doorbell-${Date.now()}`,
      type: EventType.DOORBELL,
      severity: EventSeverity.HIGH,
      timestamp: new Date(event.start || Date.now()),
      camera: {
        id: event.camera || 'unknown',
        name: 'Timbre UniFi Real',
        type: 'UniFi Doorbell',
        location: undefined
      },
      description: 'Timbre REAL presionado',
      thumbnailUrl: event.thumbnail,
      metadata: {
        score: event.score || 100,
        duration: event.end ? event.end - event.start : undefined,
        real: true
      }
    };

    callback(unifiEvent);
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

  disconnect(): void {
    if (this.protectApi) {
      this.protectApi.logout();
      this.protectApi = null;
    }
    this.isConnected = false;
    console.log('🔌 Desconectado de UniFi Protect');
  }
}

// INSTRUCCIONES PARA ACTIVAR LA CONEXIÓN REAL:
// 
// 1. Copia el método connectReal() a UnifiProtectClient.ts
// 2. Reemplaza el método connect() con la implementación real
// 3. Actualiza getCameras() para usar getRealCameras()
// 4. Actualiza setupRealEventListeners() para usar setupRealEventListeners()
// 5. Configura las credenciales correctas en .env
// 6. Reinicia el servidor
//
// La librería unifi-protect@4.27.3 ya está instalada y lista para usar.
