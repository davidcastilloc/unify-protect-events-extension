import { UnifiEvent, EventType, EventSeverity, CameraInfo } from '../../domain/events/UnifiEvent';
import axios from 'axios';
import WebSocket from 'ws';
import https from 'https';

// ----------------------------------------------------------------------
// --- INTERFACES DEL CLIENTE ---
// ----------------------------------------------------------------------

export interface UnifiProtectConfig {
  host: string;
  port?: number;
  apiKey: string;
  sslVerify?: boolean;
}

export interface IUnifiProtectClient {
  connect(): Promise<void>;
  disconnect(): void;
  getCameras(): Promise<CameraInfo[]>;
  subscribeToEvents(callback: (event: UnifiEvent) => void): void;
  unsubscribeFromEvents(): void;
}

// ----------------------------------------------------------------------
// --- INTERFACES DE LA API DE UNIFI PROTECT ---
// ----------------------------------------------------------------------

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

// Interfaz base para permitir flexibilidad en los tipos de eventos
interface BaseEvent {
  id: string;
  modelKey: string;
  type: string;
  start: number;
  end: number;
  device: string;
  score?: number;
  thumbnail?: string;
}

interface RingEvent extends BaseEvent {
  type: 'ring';
}

interface SensorExtremeValueEvent extends BaseEvent {
  type: 'sensorExtremeValue';
  value: number;
  unit: string;
}

interface SensorWaterLeakEvent extends BaseEvent {
  type: 'sensorWaterLeak';
  isInternal: boolean;
  isExternal: boolean;
}

interface SensorTamperEvent extends BaseEvent {
  type: 'sensorTamper';
}

interface SensorBatteryLowEvent extends BaseEvent {
  type: 'sensorBatteryLow';
  batteryLevel: number;
}

interface SensorAlarmEvent extends BaseEvent {
  type: 'sensorAlarm';
  alarmType: string;
}

interface SensorOpenEvent extends BaseEvent {
  type: 'sensorOpen';
}

interface SensorClosedEvent extends BaseEvent {
  type: 'sensorClosed';
}

interface SensorMotionEvent extends BaseEvent {
  type: 'sensorMotion';
  sensitivity: number;
}

interface LightMotionEvent extends BaseEvent {
  type: 'lightMotion';
  lightLevel: number;
}

interface CameraMotionEvent extends BaseEvent {
  type: 'cameraMotion';
  zones?: string[];
}

interface CameraSmartDetectAudioEvent extends BaseEvent {
  type: 'cameraSmartDetectAudio';
  audioType: string;
}

interface CameraSmartDetectZoneEvent extends BaseEvent {
  type: 'cameraSmartDetectZone' | 'smartDetectZone'; 
  zone: string;
}

interface CameraSmartDetectLineEvent extends BaseEvent {
  type: 'cameraSmartDetectLine';
  line: string;
  direction: string;
}

interface CameraSmartDetectLoiterEvent extends BaseEvent {
  type: 'cameraSmartDetectLoiter';
  duration: number;
}

// Union type para todos los eventos, incluyendo el tipo BaseEvent como fallback.
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
  | CameraSmartDetectLoiterEvent
  | BaseEvent; 

interface UnifiProtectUpdateMessage {
  type: 'add' | 'update';
  item: UnifiProtectEvent | UnifiProtectCamera;
}

// ----------------------------------------------------------------------
// --- CLASE PRINCIPAL DEL CLIENTE DE UNIFI PROTECT ---
// ----------------------------------------------------------------------

export class UnifiProtectClient implements IUnifiProtectClient {
  private config: UnifiProtectConfig;
  private isConnected = false;
  private eventCallback?: (event: UnifiEvent) => void;
  private httpClient: any;
  private wsClient?: WebSocket;
  private apiKey: string;
  private baseUrl: string;
  private cameraCache: Record<string, UnifiProtectCamera> = {};

  constructor(config: UnifiProtectConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.baseUrl = `https://${config.host}`;
    
    // Configuración de Axios
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

  // ----------------------------------------------------------------------
  // --- MÉTODOS DE CONEXIÓN ---
  // ----------------------------------------------------------------------

  async connect(): Promise<void> {
    try {
      console.log(`🔗 Conectando a UniFi Protect en ${this.config.host}:${this.config.port || 443}`);
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
      
      await this.validateApiKey();
      
      const appInfo = await this.getApplicationInfo();
      console.log(`📊 Versión de aplicación: ${appInfo.applicationVersion}`);
      
      // Llenar el cache de cámaras para obtener nombres reales
      await this.loadCameraCache(); 
      
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
      const response = await this.httpClient.get('/proxy/protect/integration/v1/liveviews');
      
      if (response.status === 200) {
        console.log('✅ API Key válida');
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
      const response = await this.httpClient.get('/proxy/protect/integration/v1/nvrs');
      return { applicationVersion: response.data.version || 'unknown' };
    } catch (error) {
      console.error('❌ Error obteniendo información de aplicación:', error);
      return { applicationVersion: 'unknown' };
    }
  }

  private async loadCameraCache(): Promise<void> {
      try {
          const response = await this.httpClient.get('/proxy/protect/integration/v1/cameras');
          const cameras: UnifiProtectCamera[] = response.data;
          
          this.cameraCache = cameras.reduce((acc, camera) => {
              acc[camera.id] = camera;
              return acc;
          }, {} as Record<string, UnifiProtectCamera>);
          
          console.log(`📹 Cache de cámaras cargado: ${cameras.length} dispositivos.`);
      } catch (error) {
          console.error('❌ Error cargando cache de cámaras:', error);
      }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      const wsUrl = `wss://${this.config.host}/proxy/protect/integration/v1/subscribe/events`;
      console.log(`🔌 Conectando WebSocket: ${wsUrl}`);
      
      const wsOptions: any = {
        headers: {
          'X-API-KEY': this.apiKey
        },
        handshakeTimeout: parseInt(process.env.UNIFI_WS_HANDSHAKE_TIMEOUT || '15000'),
        perMessageDeflate: false
      };
      
      this.wsClient = new WebSocket(wsUrl, wsOptions);

      const connectionTimeout = setTimeout(() => {
        if (this.wsClient && this.wsClient.readyState === WebSocket.CONNECTING) {
          console.log('⏰ Timeout conectando a UniFi Protect WebSocket');
          this.wsClient.close();
        }
      }, parseInt(process.env.UNIFI_WS_HANDSHAKE_TIMEOUT || '15000'));

      this.wsClient.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket conectado exitosamente');
        console.log('🔔 Esperando eventos de UniFi Protect...');
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          const updateMessage: UnifiProtectUpdateMessage = message;
          this.handleWebSocketMessage(updateMessage);
        } catch (error) {
          console.error('❌ Error procesando mensaje WebSocket:', error);
        }
      });

      this.wsClient.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Error en WebSocket:', error);
      });

      this.wsClient.on('close', (code: number, reason: string) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 WebSocket desconectado - Código: ${code}, Razón: ${reason}`);
        
        if (code !== 1000 && this.isConnected) {
          console.log('🔄 Reconectando en 10 segundos...');
          setTimeout(() => {
            if (this.isConnected) {
              this.connectWebSocket();
            }
          }, parseInt(process.env.UNIFI_WS_RECONNECT_DELAY || '10000'));
        }
      });

    } catch (error) {
      console.error('❌ Error conectando WebSocket:', error);
    }
  }

  // ----------------------------------------------------------------------
  // --- MANEJO Y PROCESAMIENTO DE EVENTOS ---
  // ----------------------------------------------------------------------

  private handleWebSocketMessage(message: UnifiProtectUpdateMessage): void {
    if (!this.eventCallback) return;

    if (message.type === 'add' || message.type === 'update') {
      const event = message.item as UnifiProtectEvent;
      this.processUnifiEvent(event);
    } else {
      console.log('ℹ️ Mensaje no es un evento - tipo:', message.type, 'modelKey:', message.item?.modelKey);
    }
  }

  private processUnifiEvent(event: UnifiProtectEvent): void {
    if (!this.eventCallback) return;

        // AÑADE ESTA LÍNEA AQUÍ PARA VER EL EVENTO CRUDO
    console.log('--- EVENTO UNIFI DETALLE ---');
    console.log(`TYPE: ${event.type}`);
    console.log(`JSON: ${JSON.stringify(event, null, 2)}`);
    console.log('----------------------------');
    
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
    
    this.eventCallback(unifiEvent);
  }

  // ----------------------------------------------------------------------
  // --- MÉTODOS DE MAPPING Y DETALLE DE EVENTOS ---
  // ----------------------------------------------------------------------

  private mapUnifiEventType(unifiType: string): EventType {
    const typeMap: { [key: string]: EventType } = {
      'ring': EventType.DOORBELL,
      'sensorExtremeValue': EventType.SENSOR,
      'sensorWaterLeak': EventType.SENSOR,
      'sensorTamper': EventType.SENSOR,
      'sensorBatteryLow': EventType.SENSOR,
      'sensorAlarm': EventType.SENSOR,
      'sensorOpen': EventType.SENSOR,
      'sensorClosed': EventType.SENSOR,
      'sensorMotion': EventType.MOTION,
      'lightMotion': EventType.MOTION,
      'cameraMotion': EventType.MOTION,
      'cameraSmartDetectAudio': EventType.SMART_DETECT,
      'cameraSmartDetectZone': EventType.SMART_DETECT,
      'smartDetectZone': EventType.SMART_DETECT,
      'cameraSmartDetectLine': EventType.SMART_DETECT,
      'cameraSmartDetectLoiter': EventType.SMART_DETECT,
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
    if ('duration' in event && typeof event.duration === 'number') return event.duration * 10 > 50 ? 80 : 50;
    return 50;
  }

  private getDeviceName(event: UnifiProtectEvent): string {
      const camera = this.cameraCache[event.device];
      if (camera && camera.name) {
          return camera.name;
      }
      
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
          'cameraMotion': 'Cámara UniFi (Movimiento)',
          'cameraSmartDetectAudio': 'Cámara - Audio Inteligente',
          'cameraSmartDetectZone': 'Cámara - Detección por Zona',
          'smartDetectZone': 'Cámara - Detección por Zona',
          'cameraSmartDetectLine': 'Cámara - Cruce de Línea',
          'cameraSmartDetectLoiter': 'Cámara - Merodeo',
      };
      return deviceTypeMap[event.type] || 'Dispositivo UniFi';
  }

  private getDeviceType(event: UnifiProtectEvent): string {
    const deviceTypeMap: { [key: string]: string } = {
      'ring': 'UniFi Doorbell',
      'sensorExtremeValue': 'UniFi Sensor',
      'cameraSmartDetectZone': 'UniFi Camera',
    };
    return deviceTypeMap[event.type] || 'UniFi Device';
  }

  // Lógica de descripción enriquecida (CORREGIDA)
  private getEventDescription(event: UnifiProtectEvent): string {
      let description = '';
      
      const baseEvent = event as BaseEvent;
      
      switch (baseEvent.type) {
          case 'ring':
              description = '🔔 ¡Timbre presionado!';
              break;

          case 'cameraMotion':
              const motionEvent = event as CameraMotionEvent;
              const motionScore = motionEvent.score ?? 'N/A';
              description = `Movimiento detectado por la cámara. Confianza: ${motionScore}%.`;
              break;
              
          case 'cameraSmartDetectZone':
          case 'smartDetectZone': 
          case 'cameraSmartDetectLine':
          case 'cameraSmartDetectLoiter':
              const smartBaseEvent = event as BaseEvent;
              const score = smartBaseEvent.score ?? 'N/A';
              let detail = '';

              if (baseEvent.type === 'cameraSmartDetectZone' || baseEvent.type === 'smartDetectZone') {
                  const zoneEvent = event as CameraSmartDetectZoneEvent;
                  detail = `en la Zona: ${zoneEvent.zone ?? 'Desconocida'}.`;
              } else if (baseEvent.type === 'cameraSmartDetectLine') {
                  const lineEvent = event as CameraSmartDetectLineEvent;
                  detail = `Línea cruzada: ${lineEvent.line ?? 'N/A'}. Dirección: ${lineEvent.direction ?? 'N/A'}.`;
              } else if (baseEvent.type === 'cameraSmartDetectLoiter') {
                  const loiterEvent = event as CameraSmartDetectLoiterEvent;
                  detail = `(Merodeo detectado por ${loiterEvent.duration ?? 'N/A'} segundos).`;
              } else {
                  detail = 'detectado.';
              }
              
              description = `🚨 Detección Inteligente ${detail} Confianza: ${score}%.`;
              break;

          case 'cameraSmartDetectAudio':
              const audioEvent = event as CameraSmartDetectAudioEvent;
              description = `🔊 Audio detectado: ${audioEvent.audioType ?? 'Desconocido'}. Confianza: ${audioEvent.score ?? 'N/A'}%.`;
              break;
              
          case 'sensorWaterLeak':
              description = '💧 ¡ALERTA! Fuga de agua detectada.';
              break;
              
          case 'sensorBatteryLow':
              const batteryEvent = event as SensorBatteryLowEvent;
              description = `🔋 Batería baja. Nivel: ${batteryEvent.batteryLevel ?? 'N/A'}%.`;
              break;

          default:
              const defaultDescriptions: { [key: string]: string } = {
                  'sensorExtremeValue': `Valor extremo detectado: ${'value' in event ? (event as SensorExtremeValueEvent).value : 'N/A'}`,
                  'sensorTamper': 'Manipulación del sensor detectada',
                  'sensorAlarm': `Alarma activada: ${'alarmType' in event ? (event as SensorAlarmEvent).alarmType : 'N/A'}`,
                  'sensorOpen': 'Sensor abierto',
                  'sensorClosed': 'Sensor cerrado',
                  'sensorMotion': 'Movimiento detectado por sensor',
                  'lightMotion': 'Movimiento detectado por luz'
              };
              description = defaultDescriptions[baseEvent.type] || `Evento desconocido: ${baseEvent.type}`;
              break;
      }
      
      return description;
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

    if ('duration' in event) metadata.duration = (event as CameraSmartDetectLoiterEvent).duration;

    return metadata;
  }

  // ----------------------------------------------------------------------
  // --- MÉTODOS PÚBLICOS ---
  // ----------------------------------------------------------------------

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
      const response = await this.httpClient.get('/proxy/protect/integration/v1/cameras');
      const cameras: UnifiProtectCamera[] = response.data;
      
      return cameras.map((camera): CameraInfo => ({
        id: camera.id,
        name: camera.name || `Cámara ${camera.id}`,
        type: camera.modelKey || 'Unknown',
        location: undefined
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
  }

  unsubscribeFromEvents(): void {
    this.eventCallback = undefined;
    console.log('Desuscrito de eventos de UniFi Protect');
  }

  // ----------------------------------------------------------------------
  // --- MÉTODOS ADICIONALES (SNAPSHOTS, STREAMS, ETC.) ---
  // ----------------------------------------------------------------------
  
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
}