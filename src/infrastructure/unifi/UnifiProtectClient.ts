import { UnifiEvent, EventType, EventSeverity, CameraInfo } from '../../domain/events/UnifiEvent';
import axios from 'axios';
import WebSocket from 'ws';
import https from 'https';

export interface UnifiProtectConfig {
  host: string;
  port: number;
  apiKey: string;
  sslVerify: boolean;
}

export interface IUnifiProtectClient {
  connect(): Promise<void>;
  disconnect(): void;
  getCameras(): Promise<CameraInfo[]>;
  subscribeToEvents(callback: (event: UnifiEvent) => void): void;
  unsubscribeFromEvents(): void;
}

// Interfaces basadas en la documentación oficial de UniFi Protect API
interface UnifiProtectCamera {
  id: string;
  modelKey: string;
  state: string;
  name: string;
  isMicEnabled: boolean;
  osdSettings: {
    isNameEnabled: boolean;
    isDateEnabled: boolean;
    isLogoEnabled: boolean;
    isDebugEnabled: boolean;
    overlayLocation: string;
  };
  ledSettings: {
    isEnabled: boolean;
  };
  lcdMessage: {
    type: string;
    resetAt: number;
    text?: string;
  };
  micVolume: number;
  activePatrolSlot: number;
  videoMode: string;
  hdrType: string;
  featureFlags: {
    supportFullHdSnapshot: boolean;
    hasHdr: boolean;
    smartDetectTypes: string[];
    smartDetectAudioTypes: string[];
    videoModes: string[];
    hasMic: boolean;
    hasLedStatus: boolean;
    hasSpeaker: boolean;
  };
  smartDetectSettings: {
    objectTypes: string[];
    audioTypes: string[];
  };
}

// Tipos de eventos específicos según la documentación
interface RingEvent {
  id: string;
  modelKey: string;
  type: 'ring';
  start: number;
  end: number;
  device: string;
  score?: number;
  thumbnail?: string;
}

interface SensorExtremeValueEvent {
  id: string;
  modelKey: string;
  type: 'sensorExtremeValue';
  start: number;
  end: number;
  device: string;
  value: number;
  unit: string;
}

interface SensorWaterLeakEvent {
  id: string;
  modelKey: string;
  type: 'sensorWaterLeak';
  start: number;
  end: number;
  device: string;
  isInternal: boolean;
  isExternal: boolean;
}

interface SensorTamperEvent {
  id: string;
  modelKey: string;
  type: 'sensorTamper';
  start: number;
  end: number;
  device: string;
}

interface SensorBatteryLowEvent {
  id: string;
  modelKey: string;
  type: 'sensorBatteryLow';
  start: number;
  end: number;
  device: string;
  batteryLevel: number;
}

interface SensorAlarmEvent {
  id: string;
  modelKey: string;
  type: 'sensorAlarm';
  start: number;
  end: number;
  device: string;
  alarmType: string;
}

interface SensorOpenEvent {
  id: string;
  modelKey: string;
  type: 'sensorOpen';
  start: number;
  end: number;
  device: string;
}

interface SensorClosedEvent {
  id: string;
  modelKey: string;
  type: 'sensorClosed';
  start: number;
  end: number;
  device: string;
}

interface SensorMotionEvent {
  id: string;
  modelKey: string;
  type: 'sensorMotion';
  start: number;
  end: number;
  device: string;
  sensitivity: number;
}

interface LightMotionEvent {
  id: string;
  modelKey: string;
  type: 'lightMotion';
  start: number;
  end: number;
  device: string;
  lightLevel: number;
}

interface CameraMotionEvent {
  id: string;
  modelKey: string;
  type: 'cameraMotion';
  start: number;
  end: number;
  device: string;
  score: number;
  thumbnail?: string;
  zones?: string[];
}

interface CameraSmartDetectAudioEvent {
  id: string;
  modelKey: string;
  type: 'cameraSmartDetectAudio';
  start: number;
  end: number;
  device: string;
  score: number;
  audioType: string;
  thumbnail?: string;
}

interface CameraSmartDetectZoneEvent {
  id: string;
  modelKey: string;
  type: 'cameraSmartDetectZone';
  start: number;
  end: number;
  device: string;
  score: number;
  zone: string;
  thumbnail?: string;
}

interface CameraSmartDetectLineEvent {
  id: string;
  modelKey: string;
  type: 'cameraSmartDetectLine';
  start: number;
  end: number;
  device: string;
  score: number;
  line: string;
  direction: string;
  thumbnail?: string;
}

interface CameraSmartDetectLoiterEvent {
  id: string;
  modelKey: string;
  type: 'cameraSmartDetectLoiter';
  start: number;
  end: number;
  device: string;
  score: number;
  duration: number;
  thumbnail?: string;
}

// Union type para todos los eventos
type UnifiProtectEvent = 
  | RingEvent
  | SensorExtremeValueEvent
  | SensorWaterLeakEvent
  | SensorTamperEvent
  | SensorBatteryLowEvent
  | SensorAlarmEvent
  | SensorOpenEvent
  | SensorClosedEvent
  | SensorMotionEvent
  | LightMotionEvent
  | CameraMotionEvent
  | CameraSmartDetectAudioEvent
  | CameraSmartDetectZoneEvent
  | CameraSmartDetectLineEvent
  | CameraSmartDetectLoiterEvent;

interface UnifiProtectUpdateMessage {
  type: 'add' | 'update' | 'delete';
  item: UnifiProtectEvent | UnifiProtectCamera;
}

interface UnifiProtectErrorMessage {
  error: string;
  name: string;
  cause?: any;
}

interface UnifiProtectBootstrap {
  cameras: UnifiProtectCamera[];
  events: UnifiProtectEvent[];
  nvr: {
    id: string;
    modelKey: string;
    name: string;
    doorbellSettings: any;
  };
}

export class UnifiProtectClient implements IUnifiProtectClient {
  private config: UnifiProtectConfig;
  private isConnected = false;
  private eventCallback?: (event: UnifiEvent) => void;
  private httpClient: any;
  private wsClient?: WebSocket;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: UnifiProtectConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.baseUrl = `${config.sslVerify ? 'https' : 'http'}://${config.host}:${config.port}`;
    
    // Configurar SSL GLOBALMENTE para Node.js
    if (!this.config.sslVerify) {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
      // Configurar también el agente HTTPS global
      const https = require('https');
      https.globalAgent.options.rejectUnauthorized = false;
      console.log('🔓 SSL verification disabled globally for self-signed certificates');
    }
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'UniFi-Protect-Client/1.0.0',
        'X-API-KEY': this.apiKey
      }
    });

    // Interceptor para manejar errores de autenticación
    this.httpClient.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        if (error.response?.status === 401) {
          console.log('❌ API Key inválida o expirada');
          console.log(error.response);
          throw new Error('API Key inválida o expirada');
        }
        return Promise.reject(error);
      }
    );
  }

  async connect(): Promise<void> {
    try {
      console.log(`🔗 Conectando a UniFi Protect en ${this.config.host}:${this.config.port}`);
      console.log(`🔑 API Key: ${this.apiKey.substring(0, 8)}...`);
      
      console.log('🚀 Conectando con UniFi Protect...');
        await this.connectReal();
      
      this.isConnected = true;
      
    } catch (error) {
      console.error('❌ Error en conexión:', error);
      throw error;
    }
  }

  private async connectReal(): Promise<void> {
    try {
      console.log('🔗 Iniciando conexión con UniFi Protect...');
      
      // Verificar que la API key funciona
      await this.validateApiKey();
      
      // Obtener información de la aplicación
      const appInfo = await this.getApplicationInfo();
      console.log(`📊 Versión de aplicación: ${appInfo.applicationVersion}`);
      
      // Conectar WebSocket para eventos en tiempo real
      await this.connectWebSocket();
      
      console.log('✅ Conexión establecida con UniFi Protect');
      
    } catch (error) {
      console.error('❌ Error en conexión:', error);
      throw error;
    }
  }

  private async validateApiKey(): Promise<void> {
    try {
      console.log('🔐 Validando API Key...');
      
      // Probar la API key con el cliente HTTP configurado
      const response = await this.httpClient.get('/proxy/protect/integration/v1/liveviews');
      
      if (response.status === 200) {
        console.log('✅ API Key válida');
        console.log(`📊 Respuesta: ${JSON.stringify(response.data).substring(0, 100)}...`);
      } else {
        throw new Error(`API Key inválida: ${response.status}`);
      }
      
    } catch (error: any) {
      console.error('❌ Error validando API Key:', error);
      throw new Error('API Key inválida o expirada');
    }
  }

  private async getApplicationInfo(): Promise<{ applicationVersion: string }> {
    try {
      // Usar el endpoint correcto para obtener información del NVR
      const response = await this.httpClient.get('/proxy/protect/integration/v1/nvr');
      return { applicationVersion: response.data.version || 'unknown' };
    } catch (error) {
      console.error('❌ Error obteniendo información de aplicación:', error);
      return { applicationVersion: 'unknown' };
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      // Usar el endpoint correcto para eventos de UniFi Protect
      const wsUrl = `${this.baseUrl.replace('http', 'ws')}/proxy/protect/integration/v1/subscribe/events`;
      console.log(`🔌 Conectando WebSocket: ${wsUrl}`);
      
      // Configurar opciones WebSocket con SSL y autenticación
      const wsOptions: any = {
        headers: {
          'X-API-KEY': this.apiKey
        }
      };
      
      // Si SSL está deshabilitado, configurar WebSocket para ignorar certificados
      if (!this.config.sslVerify) {
        wsOptions.rejectUnauthorized = false;
        console.log('🔓 WebSocket SSL verification disabled');
      }
      
      this.wsClient = new WebSocket(wsUrl, wsOptions);

      this.wsClient.on('open', () => {
        console.log('✅ WebSocket conectado exitosamente');
        console.log('🔔 Esperando eventos de UniFi Protect...');
        console.log('💡 Para generar eventos, puedes:');
        console.log('   - Moverte frente a una cámara');
        console.log('   - Presionar el timbre');
        console.log('   - Activar sensores de movimiento');
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Verificar si es un mensaje de error
          if (message.error) {
            const errorMessage: UnifiProtectErrorMessage = message;
            console.error('❌ Error WebSocket:', errorMessage.error, errorMessage.name);
            return;
          }
          
          // Procesar mensaje de actualización
          const updateMessage: UnifiProtectUpdateMessage = message;
          this.handleWebSocketMessage(updateMessage);
        } catch (error) {
          console.error('❌ Error procesando mensaje WebSocket:', error);
        }
      });

      this.wsClient.on('error', (error) => {
        console.error('❌ Error en WebSocket:', error);
        console.error('❌ Detalles del error:', error.message);
      });

      this.wsClient.on('close', () => {
        console.log('🔌 WebSocket desconectado');
        // Reconectar después de 5 segundos
        setTimeout(() => {
          if (this.isConnected) {
            this.connectWebSocket();
          }
        }, 5000);
      });

    } catch (error) {
      console.error('❌ Error conectando WebSocket:', error);
    }
  }

  private handleWebSocketMessage(message: UnifiProtectUpdateMessage): void {
    if (!this.eventCallback) return;

    console.log(`📡 Mensaje WebSocket recibido: ${message.type}`);
    console.log('📊 Datos completos del mensaje:', JSON.stringify(message, null, 2));

    if (message.type === 'add' && message.item.modelKey === 'event') {
      const event = message.item as UnifiProtectEvent;
      console.log('🎯 Evento detectado:', event.type);
      console.log('📋 Detalles del evento:', JSON.stringify(event, null, 2));
      this.processUnifiEvent(event);
    } else {
      console.log('ℹ️ Mensaje no es un evento - tipo:', message.type, 'modelKey:', message.item?.modelKey);
    }
  }

  private processUnifiEvent(event: UnifiProtectEvent): void {
    if (!this.eventCallback) return;

    console.log('🔄 Procesando evento UniFi Protect...');
    console.log('📝 Tipo original:', event.type);
    console.log('🆔 ID del evento:', event.id);
    console.log('📅 Timestamp:', event.start);

    const unifiEvent: UnifiEvent = {
      id: event.id,
      type: this.mapUnifiEventType(event.type),
      severity: this.mapEventSeverity(this.getEventScore(event)),
      timestamp: new Date(event.start),
      camera: {
        id: event.device,
        name: this.getDeviceName(event),
        type: this.getDeviceType(event),
        location: undefined
      },
      description: this.getEventDescription(event),
      thumbnailUrl: this.getEventThumbnail(event),
      metadata: this.getEventMetadata(event)
    };

    console.log('✅ Evento procesado exitosamente:');
    console.log('🎯 Tipo mapeado:', unifiEvent.type);
    console.log('⚠️ Severidad:', unifiEvent.severity);
    console.log('📷 Cámara:', unifiEvent.camera.name);
    console.log('📝 Descripción:', unifiEvent.description);
    console.log('📊 Metadatos:', JSON.stringify(unifiEvent.metadata, null, 2));
    
    this.eventCallback(unifiEvent);
  }

  private mapUnifiEventType(unifiType: string): EventType {
    const typeMap: { [key: string]: EventType } = {
      // Eventos de timbre
      'ring': EventType.DOORBELL,
      
      // Eventos de sensores
      'sensorExtremeValue': EventType.SENSOR,
      'sensorWaterLeak': EventType.SENSOR,
      'sensorTamper': EventType.SENSOR,
      'sensorBatteryLow': EventType.SENSOR,
      'sensorAlarm': EventType.SENSOR,
      'sensorOpen': EventType.SENSOR,
      'sensorClosed': EventType.SENSOR,
      'sensorMotion': EventType.MOTION,
      
      // Eventos de luces
      'lightMotion': EventType.MOTION,
      
      // Eventos de cámaras
      'cameraMotion': EventType.MOTION,
      'cameraSmartDetectAudio': EventType.SMART_DETECT,
      'cameraSmartDetectZone': EventType.SMART_DETECT,
      'cameraSmartDetectLine': EventType.SMART_DETECT,
      'cameraSmartDetectLoiter': EventType.SMART_DETECT,
      
      // Tipos legacy (por compatibilidad)
      'motion': EventType.MOTION,
      'person': EventType.PERSON,
      'vehicle': EventType.VEHICLE,
      'package': EventType.PACKAGE,
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

  private getEventScore(event: UnifiProtectEvent): number {
    if ('score' in event && typeof event.score === 'number') return event.score;
    if ('value' in event && typeof event.value === 'number') return event.value;
    if ('batteryLevel' in event && typeof event.batteryLevel === 'number') return event.batteryLevel;
    if ('sensitivity' in event && typeof event.sensitivity === 'number') return event.sensitivity;
    if ('lightLevel' in event && typeof event.lightLevel === 'number') return event.lightLevel;
    if ('duration' in event && typeof event.duration === 'number') return event.duration;
    return 50; // Score por defecto
  }

  private getDeviceName(event: UnifiProtectEvent): string {
    const deviceTypeMap: { [key: string]: string } = {
      'ring': 'Timbre UniFi',
      'sensorExtremeValue': 'Sensor UniFi',
      'sensorWaterLeak': 'Sensor de Agua UniFi',
      'sensorTamper': 'Sensor Anti-manipulación UniFi',
      'sensorBatteryLow': 'Sensor UniFi (Batería Baja)',
      'sensorAlarm': 'Sensor de Alarma UniFi',
      'sensorOpen': 'Sensor de Apertura UniFi',
      'sensorClosed': 'Sensor de Cierre UniFi',
      'sensorMotion': 'Sensor de Movimiento UniFi',
      'lightMotion': 'Luz UniFi',
      'cameraMotion': 'Cámara UniFi',
      'cameraSmartDetectAudio': 'Cámara UniFi (Audio)',
      'cameraSmartDetectZone': 'Cámara UniFi (Zona)',
      'cameraSmartDetectLine': 'Cámara UniFi (Línea)',
      'cameraSmartDetectLoiter': 'Cámara UniFi (Merodeo)'
    };
    return deviceTypeMap[event.type] || 'Dispositivo UniFi';
  }

  private getDeviceType(event: UnifiProtectEvent): string {
    const deviceTypeMap: { [key: string]: string } = {
      'ring': 'UniFi Doorbell',
      'sensorExtremeValue': 'UniFi Sensor',
      'sensorWaterLeak': 'UniFi Water Sensor',
      'sensorTamper': 'UniFi Tamper Sensor',
      'sensorBatteryLow': 'UniFi Sensor',
      'sensorAlarm': 'UniFi Alarm Sensor',
      'sensorOpen': 'UniFi Contact Sensor',
      'sensorClosed': 'UniFi Contact Sensor',
      'sensorMotion': 'UniFi Motion Sensor',
      'lightMotion': 'UniFi Light',
      'cameraMotion': 'UniFi Camera',
      'cameraSmartDetectAudio': 'UniFi Camera',
      'cameraSmartDetectZone': 'UniFi Camera',
      'cameraSmartDetectLine': 'UniFi Camera',
      'cameraSmartDetectLoiter': 'UniFi Camera'
    };
    return deviceTypeMap[event.type] || 'UniFi Device';
  }

  private getEventDescription(event: UnifiProtectEvent): string {
    const descriptions: { [key: string]: string } = {
      'ring': 'Timbre presionado',
      'sensorExtremeValue': `Valor extremo detectado: ${'value' in event ? event.value : 'N/A'} ${'unit' in event ? event.unit : ''}`,
      'sensorWaterLeak': 'Fuga de agua detectada',
      'sensorTamper': 'Manipulación del sensor detectada',
      'sensorBatteryLow': `Batería baja: ${'batteryLevel' in event ? event.batteryLevel : 'N/A'}%`,
      'sensorAlarm': `Alarma activada: ${'alarmType' in event ? event.alarmType : 'N/A'}`,
      'sensorOpen': 'Sensor abierto',
      'sensorClosed': 'Sensor cerrado',
      'sensorMotion': 'Movimiento detectado por sensor',
      'lightMotion': 'Movimiento detectado por luz',
      'cameraMotion': 'Movimiento detectado por cámara',
      'cameraSmartDetectAudio': `Audio detectado: ${'audioType' in event ? event.audioType : 'N/A'}`,
      'cameraSmartDetectZone': `Zona detectada: ${'zone' in event ? event.zone : 'N/A'}`,
      'cameraSmartDetectLine': `Línea cruzada: ${'line' in event ? event.line : 'N/A'} (${'direction' in event ? event.direction : 'N/A'})`,
      'cameraSmartDetectLoiter': `Merodeo detectado: ${'duration' in event ? event.duration : 'N/A'}s`
    };
    return descriptions[event.type] || `Evento detectado: ${event.type}`;
  }

  private getEventThumbnail(event: UnifiProtectEvent): string | undefined {
    if ('thumbnail' in event) return event.thumbnail;
    return undefined;
  }

  private getEventMetadata(event: UnifiProtectEvent): any {
    const metadata: any = {
      duration: event.end ? event.end - event.start : undefined,
      eventType: event.type
    };

    // Agregar metadatos específicos según el tipo de evento
    if ('score' in event) metadata.score = event.score;
    if ('value' in event) metadata.value = event.value;
    if ('unit' in event) metadata.unit = event.unit;
    if ('isInternal' in event) metadata.isInternal = event.isInternal;
    if ('isExternal' in event) metadata.isExternal = event.isExternal;
    if ('batteryLevel' in event) metadata.batteryLevel = event.batteryLevel;
    if ('alarmType' in event) metadata.alarmType = event.alarmType;
    if ('sensitivity' in event) metadata.sensitivity = event.sensitivity;
    if ('lightLevel' in event) metadata.lightLevel = event.lightLevel;
    if ('zones' in event) metadata.zones = event.zones;
    if ('audioType' in event) metadata.audioType = event.audioType;
    if ('zone' in event) metadata.zone = event.zone;
    if ('line' in event) metadata.line = event.line;
    if ('direction' in event) metadata.direction = event.direction;
    if ('duration' in event) metadata.duration = event.duration;

    return metadata;
  }

  disconnect(): void {
    this.isConnected = false;
    this.eventCallback = undefined;
    
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
    
    console.log('Desconectado de UniFi Protect');
  }

  async getCameras(): Promise<CameraInfo[]> {
    if (!this.isConnected) {
      throw new Error('No conectado a UniFi Protect');
    }

    try {
      console.log('📹 Obteniendo cámaras de UniFi Protect...');
      
      const response = await this.httpClient.get('/proxy/protect/integration/v1/cameras');
      const cameras: UnifiProtectCamera[] = response.data;
      
      console.log(`📹 Obtenidas ${cameras.length} cámaras de UniFi Protect`);
      
      return cameras.map((camera): CameraInfo => ({
        id: camera.id,
        name: camera.name || `Cámara ${camera.id}`,
        type: camera.modelKey || 'Unknown',
        location: undefined // La API no proporciona ubicación directamente
      }));
      
    } catch (error) {
      console.error('❌ Error obteniendo cámaras:', error);
      throw new Error('No se pudieron obtener las cámaras de UniFi Protect');
    }
  }

  subscribeToEvents(callback: (event: UnifiEvent) => void): void {
    if (!this.isConnected) {
      throw new Error('No conectado a UniFi Protect');
    }

    this.eventCallback = callback;
    console.log('🔔 Suscrito a eventos de UniFi Protect');

    // Los eventos se manejan automáticamente via WebSocket
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      console.log('🔔 Escuchando eventos via WebSocket...');
    } else {
      console.log('⚠️ WebSocket no conectado, eventos no disponibles');
    }
  }

  unsubscribeFromEvents(): void {
    this.eventCallback = undefined;
    console.log('Desuscrito de eventos de UniFi Protect');
  }

  // Métodos adicionales basados en la documentación oficial
  
  async getCameraDetails(cameraId: string): Promise<UnifiProtectCamera | null> {
    try {
      const response = await this.httpClient.get(`/proxy/protect/integration/v1/cameras/${cameraId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error obteniendo detalles de cámara ${cameraId}:`, error);
      return null;
    }
  }

  async getCameraSnapshot(cameraId: string, highQuality: boolean = false): Promise<Buffer | null> {
    try {
      const response = await this.httpClient.get(`/proxy/protect/integration/v1/cameras/${cameraId}/snapshot`, {
        params: { highQuality: highQuality.toString() },
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error(`❌ Error obteniendo snapshot de cámara ${cameraId}:`, error);
      return null;
    }
  }

  async createRTSPSStream(cameraId: string, qualities: string[]): Promise<{ [key: string]: string } | null> {
    try {
      const response = await this.httpClient.post(`/proxy/protect/integration/v1/cameras/${cameraId}/streams`, {
        qualities
      });
      return response.data;
    } catch (error) {
      console.error(`❌ Error creando stream RTSPS para cámara ${cameraId}:`, error);
      return null;
    }
  }

  async getNVRDetails(): Promise<any> {
    try {
      const response = await this.httpClient.get('/proxy/protect/integration/v1/nvr');
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo detalles del NVR:', error);
      return null;
    }
  }
}