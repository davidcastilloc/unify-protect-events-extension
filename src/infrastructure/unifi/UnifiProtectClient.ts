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
  
  // 🚨 SISTEMA CRÍTICO - CONEXIÓN ULTRA-ROBUSTA
  private heartbeatInterval?: NodeJS.Timeout;
  private lastPongReceived = Date.now();
  private heartbeatTimeout = parseInt(process.env.UNIFI_HEARTBEAT_TIMEOUT || '5000'); // 5 segundos
  private heartbeatIntervalMs = parseInt(process.env.UNIFI_HEARTBEAT_INTERVAL || '2000'); // Cada 2 segundos
  private isHeartbeatHealthy = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = parseInt(process.env.UNIFI_MAX_RECONNECT_ATTEMPTS || '50'); // Muchos intentos
  private baseReconnectDelay = parseInt(process.env.UNIFI_BASE_RECONNECT_DELAY || '100'); // 100ms base
  private maxReconnectDelay = parseInt(process.env.UNIFI_MAX_RECONNECT_DELAY || '5000'); // Máximo 5s
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerFailures = 0;
  private circuitBreakerThreshold = parseInt(process.env.UNIFI_CIRCUIT_BREAKER_THRESHOLD || '10');
  private circuitBreakerTimeout = parseInt(process.env.UNIFI_CIRCUIT_BREAKER_TIMEOUT || '60000'); // 1 minuto
  private criticalEventBuffer: UnifiEvent[] = [];
  private maxBufferSize = parseInt(process.env.UNIFI_EVENT_BUFFER_SIZE || '500');

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
          console.log('❌ Invalid or expired API Key');
          console.log(error.response);
          throw new Error('Invalid or expired API Key');
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
      console.log(`🔗 Connecting to UniFi Protect at ${this.config.host}:${this.config.port || 443}`);
      console.log(`🔑 API Key: ${this.apiKey.substring(0, 8)}...`);
      
      console.log('🚀 Connecting to UniFi Protect...');
      await this.connectReal();
      
      this.isConnected = true;
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      throw error;
    }
  }

  private async connectReal(): Promise<void> {
    try {
      console.log('🔗 Starting connection to UniFi Protect...');
      
      await this.validateApiKey();
      
      const appInfo = await this.getApplicationInfo();
      console.log(`📊 Application version: ${appInfo.applicationVersion}`);
      
      // Llenar el cache de cámaras para obtener nombres reales
      await this.loadCameraCache(); 
      
      await this.connectWebSocket();
      
      console.log('✅ Connection established with UniFi Protect');
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      throw error;
    }
  }

  private async validateApiKey(): Promise<void> {
    try {
      console.log('🔐 Validating API Key...');
      const response = await this.httpClient.get('/proxy/protect/integration/v1/liveviews');
      
      if (response.status === 200) {
        console.log('✅ API Key valid');
      } else {
        throw new Error(`Invalid API Key: ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Error validating API Key:', error);
      throw new Error('Invalid or expired API Key');
    }
  }

  private async getApplicationInfo(): Promise<{ applicationVersion: string }> {
    try {
      const response = await this.httpClient.get('/proxy/protect/integration/v1/nvrs');
      return { applicationVersion: response.data.version || 'unknown' };
    } catch (error) {
      console.error('❌ Error getting application information:', error);
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
          
          console.log(`📹 Camera cache loaded: ${cameras.length} devices.`);
      } catch (error) {
          console.error('❌ Error loading camera cache:', error);
      }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      const wsUrl = `wss://${this.config.host}/proxy/protect/integration/v1/subscribe/events`;
      console.log(`🔌 Connecting WebSocket: ${wsUrl}`);
      
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
          console.log('⏰ Timeout connecting to UniFi Protect WebSocket');
          this.wsClient.close();
        }
      }, parseInt(process.env.UNIFI_WS_HANDSHAKE_TIMEOUT || '15000'));

      this.wsClient.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected successfully');
        console.log('🔔 Waiting for UniFi Protect events...');
        
        // 🚨 INICIAR HEARTBEAT ULTRA-AGRESIVO PARA SISTEMA CRÍTICO
        this.startCriticalHeartbeat();
        
        // 🚨 PROCESAR EVENTOS BUFFEREADOS SI LOS HAY
        this.processBufferedEvents();
        
        // Resetear contadores de reconexión en conexión exitosa
        this.reconnectAttempts = 0;
        this.circuitBreakerFailures = 0;
        this.circuitBreakerState = 'CLOSED';
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        try {
          // 🚨 ACTUALIZAR TIMESTAMP EN CADA MENSAJE RECIBIDO
          this.lastPongReceived = Date.now();
          this.isHeartbeatHealthy = true;
          
          const message = JSON.parse(data.toString());
          const updateMessage: UnifiProtectUpdateMessage = message;
          this.handleWebSocketMessage(updateMessage);
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      });

      // 🚨 MANEJAR RESPUESTAS PONG DEL HEARTBEAT
      this.wsClient.on('pong', () => {
        this.lastPongReceived = Date.now();
        this.isHeartbeatHealthy = true;
        console.log('💓 Pong recibido - conexión UniFi Protect saludable');
      });

      this.wsClient.on('error', (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
      });

      this.wsClient.on('close', (code: number, reason: string) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 WebSocket disconnected - Code: ${code}, Reason: ${reason}`);
        
        // 🚨 DETENER HEARTBEAT INMEDIATAMENTE
        this.stopHeartbeat();
        
        if (code !== 1000 && this.isConnected) {
          // 🚨 RECONEXIÓN INSTANTÁNEA PARA SISTEMA CRÍTICO
          this.scheduleCriticalReconnect();
        }
      });

    } catch (error) {
      console.error('❌ Error connecting WebSocket:', error);
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
      console.log('ℹ️ Message is not an event - type:', message.type, 'modelKey:', message.item?.modelKey);
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
    
    // 🚨 SISTEMA CRÍTICO: BUFFEREO SI NO ESTÁ CONECTADO
    if (!this.isConnectionHealthy()) {
      console.log('🚨 Conexión no saludable - bufferando evento crítico');
      this.addToCriticalBuffer(unifiEvent);
    } else {
      // Enviar evento inmediatamente si la conexión está saludable
      this.eventCallback(unifiEvent);
    }
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
          'ring': 'UniFi Doorbell',
          'sensorExtremeValue': 'UniFi Sensor',
          'sensorWaterLeak': 'UniFi Water Sensor',
          'sensorTamper': 'UniFi Tamper Sensor',
          'sensorBatteryLow': 'UniFi Sensor (Low Battery)',
          'sensorAlarm': 'UniFi Alarm Sensor',
          'sensorOpen': 'UniFi Open Sensor',
          'sensorClosed': 'UniFi Closed Sensor',
          'sensorMotion': 'UniFi Motion Sensor',
          'lightMotion': 'UniFi Light',
          'cameraMotion': 'UniFi Camera (Motion)',
          'cameraSmartDetectAudio': 'Camera - Smart Audio',
          'cameraSmartDetectZone': 'Camera - Zone Detection',
          'smartDetectZone': 'Camera - Zone Detection',
          'cameraSmartDetectLine': 'Camera - Line Crossing',
          'cameraSmartDetectLoiter': 'Camera - Loitering',
      };
      return deviceTypeMap[event.type] || 'UniFi Device';
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
  // private getEventDescription(event: UnifiProtectEvent): string {
  //     let description = '';
      
  //     const baseEvent = event as BaseEvent;
      
  //     switch (baseEvent.type) {
  //         case 'ring':
  //             description = '🔔 ¡Timbre presionado!';
  //             break;

  //         case 'cameraMotion':
  //             const motionEvent = event as CameraMotionEvent;
  //             const motionScore = motionEvent.score ?? 'N/A';
  //             description = `Movimiento detectado por la cámara. Confianza: ${motionScore}%.`;
  //             break;
              
  //         case 'cameraSmartDetectZone':
  //         case 'smartDetectZone': 
  //         case 'cameraSmartDetectLine':
  //         case 'cameraSmartDetectLoiter':
  //             const smartBaseEvent = event as BaseEvent;
  //             const score = smartBaseEvent.score ?? 'N/A';
  //             let detail = '';

  //             if (baseEvent.type === 'cameraSmartDetectZone' || baseEvent.type === 'smartDetectZone') {
  //                 const zoneEvent = event as CameraSmartDetectZoneEvent;
  //                 detail = `en la Zona: ${zoneEvent.zone ?? 'Desconocida'}.`;
  //             } else if (baseEvent.type === 'cameraSmartDetectLine') {
  //                 const lineEvent = event as CameraSmartDetectLineEvent;
  //                 detail = `Línea cruzada: ${lineEvent.line ?? 'N/A'}. Dirección: ${lineEvent.direction ?? 'N/A'}.`;
  //             } else if (baseEvent.type === 'cameraSmartDetectLoiter') {
  //                 const loiterEvent = event as CameraSmartDetectLoiterEvent;
  //                 detail = `(Merodeo detectado por ${loiterEvent.duration ?? 'N/A'} segundos).`;
  //             } else {
  //                 detail = 'detectado.';
  //             }
              
  //             description = `🚨 Detección Inteligente ${detail} Confianza: ${score}%.`;
  //             break;

  //         case 'cameraSmartDetectAudio':
  //             const audioEvent = event as CameraSmartDetectAudioEvent;
  //             description = `🔊 Audio detectado: ${audioEvent.audioType ?? 'Desconocido'}. Confianza: ${audioEvent.score ?? 'N/A'}%.`;
  //             break;
              
  //         case 'sensorWaterLeak':
  //             description = '💧 ¡ALERTA! Fuga de agua detectada.';
  //             break;
              
  //         case 'sensorBatteryLow':
  //             const batteryEvent = event as SensorBatteryLowEvent;
  //             description = `🔋 Batería baja. Nivel: ${batteryEvent.batteryLevel ?? 'N/A'}%.`;
  //             break;

  //         default:
  //             const defaultDescriptions: { [key: string]: string } = {
  //                 'sensorExtremeValue': `Valor extremo detectado: ${'value' in event ? (event as SensorExtremeValueEvent).value : 'N/A'}`,
  //                 'sensorTamper': 'Manipulación del sensor detectada',
  //                 'sensorAlarm': `Alarma activada: ${'alarmType' in event ? (event as SensorAlarmEvent).alarmType : 'N/A'}`,
  //                 'sensorOpen': 'Sensor abierto',
  //                 'sensorClosed': 'Sensor cerrado',
  //                 'sensorMotion': 'Movimiento detectado por sensor',
  //                 'lightMotion': 'Movimiento detectado por luz'
  //             };
  //             description = defaultDescriptions[baseEvent.type] || `Evento desconocido: ${baseEvent.type}`;
  //             break;
  //     }
      
  //     return description;
  // }
  // En la clase UnifiProtectClient

// Lógica de descripción enriquecida (VERSION FINAL CORREGIDA PARA TYPESCRIPT)
private getEventDescription(event: UnifiProtectEvent): string {
    let description = '';
    
    // Casteamos el evento a 'any' aquí para evitar conflictos de tipo en el switch/case
    const smartEventData = event as any; 
    const baseEvent = event as BaseEvent;
    
    switch (baseEvent.type) {
        case 'ring':
            description = '🔔 Doorbell pressed!';
            break;

        case 'cameraMotion':
            const motionEvent = event as CameraMotionEvent;
            const motionScore = motionEvent.score ?? 'N/A';
            description = `Motion detected by camera. Confidence: ${motionScore}%.`;
            break;
            
        case 'cameraSmartDetectZone':
        case 'smartDetectZone': 
        case 'cameraSmartDetectLine':
        case 'cameraSmartDetectLoiter':
            
            const score = this.getEventScore(event); 
            let detail = '';

            // 1. Manejo de SmartDetectZone
            if (baseEvent.type === 'cameraSmartDetectZone' || baseEvent.type === 'smartDetectZone') {
                
                let detectedTypes = 'Detection';
                
                // Usamos smartEventData (que es 'any') para acceder a la propiedad
                if (smartEventData.smartDetectTypes && smartEventData.smartDetectTypes.length > 0) {
                    // Capitalizamos el tipo (ej. person -> Person)
                    detectedTypes = smartEventData.smartDetectTypes.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
                }
                
                detail = `Detection of ${detectedTypes}.`;

                // Intentamos añadir la zona si existe
                if (smartEventData.zone) {
                    detail += ` In Zone: ${smartEventData.zone}.`;
                } else {
                    detail += ` (In detection area).`;
                }

            // 2. Manejo de SmartDetectLine
            } else if (baseEvent.type === 'cameraSmartDetectLine') {
                const lineEvent = event as CameraSmartDetectLineEvent;
                detail = `Line crossed: ${lineEvent.line ?? 'N/A'}. Direction: ${lineEvent.direction ?? 'N/A'}.`;

            // 3. Manejo de SmartDetectLoiter
            } else if (baseEvent.type === 'cameraSmartDetectLoiter') {
                // Usamos smartEventData (que es 'any') para acceder a la duración
                detail = `(Loitering detected for ${smartEventData.duration ?? 'N/A'} seconds).`;
            }
            
            description = `🚨 Smart Detection ${detail} Confidence: ${score}%.`;
            break;

        case 'cameraSmartDetectAudio':
            const audioEvent = event as CameraSmartDetectAudioEvent;
            description = `🔊 Audio detected: ${audioEvent.audioType ?? 'Unknown'}. Confidence: ${audioEvent.score ?? 'N/A'}%.`;
            break;
            
        case 'sensorWaterLeak':
            description = '💧 ALERT! Water leak detected.';
            break;
            
        case 'sensorBatteryLow':
            const batteryEvent = event as SensorBatteryLowEvent;
            description = `🔋 Low battery. Level: ${batteryEvent.batteryLevel ?? 'N/A'}%.`;
            break;

        default:
            const defaultDescriptions: { [key: string]: string } = {
                'sensorExtremeValue': `Extreme value detected: ${'value' in event ? (event as SensorExtremeValueEvent).value : 'N/A'}`,
                'sensorTamper': 'Sensor tampering detected',
                'sensorAlarm': `Alarm activated: ${'alarmType' in event ? (event as SensorAlarmEvent).alarmType : 'N/A'}`,
                'sensorOpen': 'Sensor opened',
                'sensorClosed': 'Sensor closed',
                'sensorMotion': 'Motion detected by sensor',
                'lightMotion': 'Motion detected by light'
            };
            description = defaultDescriptions[baseEvent.type] || `Unknown event: ${baseEvent.type}`;
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
    
    // 🚨 DETENER HEARTBEAT CRÍTICO
    this.stopHeartbeat();
    
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
    
    console.log('Disconnected from UniFi Protect');
  }

  async getCameras(): Promise<CameraInfo[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to UniFi Protect');
    }

    try {
      const response = await this.httpClient.get('/proxy/protect/integration/v1/cameras');
      const cameras: UnifiProtectCamera[] = response.data;
      
      return cameras.map((camera): CameraInfo => ({
        id: camera.id,
        name: camera.name || `Camera ${camera.id}`,
        type: camera.modelKey || 'Unknown',
        location: undefined
      }));
      
    } catch (error) {
      console.error('❌ Error getting cameras:', error);
      throw new Error('Could not get cameras from UniFi Protect');
    }
  }

  subscribeToEvents(callback: (event: UnifiEvent) => void): void {
    if (!this.isConnected) {
      throw new Error('Not connected to UniFi Protect');
    }

    this.eventCallback = callback;
    console.log('🔔 Subscribed to UniFi Protect events');
  }

  unsubscribeFromEvents(): void {
    this.eventCallback = undefined;
    console.log('Unsubscribed from UniFi Protect events');
  }

  // ----------------------------------------------------------------------
  // --- SISTEMA CRÍTICO - MÉTODOS DE CONEXIÓN ULTRA-ROBUSTA ---
  // ----------------------------------------------------------------------

  /**
   * 🚨 HEARTBEAT ULTRA-AGRESIVO PARA SISTEMA CRÍTICO
   * Ping cada 2 segundos, timeout de 5 segundos
   */
  private startCriticalHeartbeat(): void {
    // Limpiar heartbeat anterior si existe
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
        console.log('💔 WebSocket UniFi no está abierto - deteniendo heartbeat');
        this.stopHeartbeat();
        return;
      }

      // Verificar si recibimos respuesta recientemente
      const timeSinceLastPong = Date.now() - this.lastPongReceived;
      
      if (timeSinceLastPong > this.heartbeatTimeout) {
        console.log(`💔 Heartbeat UniFi perdido (${Math.round(timeSinceLastPong/1000)}s sin respuesta) - forzando reconexión crítica`);
        this.isHeartbeatHealthy = false;
        this.circuitBreakerFailures++;
        
        // Cerrar conexión para forzar reconexión inmediata
        this.wsClient.close(1000, 'Critical heartbeat timeout');
        return;
      }

      // Enviar ping para mantener conexión viva
      try {
        this.wsClient.ping();
        console.log('💓 Ping crítico enviado a UniFi Protect');
      } catch (error) {
        console.error('❌ Error enviando ping crítico:', error);
        this.isHeartbeatHealthy = false;
        this.circuitBreakerFailures++;
      }
    }, this.heartbeatIntervalMs);
    
    console.log(`💓 Heartbeat crítico iniciado - ping cada ${this.heartbeatIntervalMs/1000}s, timeout ${this.heartbeatTimeout/1000}s`);
  }

  /**
   * 🚨 DETENER HEARTBEAT CRÍTICO
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      console.log('💓 Heartbeat crítico detenido');
    }
  }

  /**
   * 🚨 RECONEXIÓN INSTANTÁNEA PARA SISTEMA CRÍTICO
   * Con backoff exponencial pero muy agresivo
   */
  private scheduleCriticalReconnect(): void {
    if (this.circuitBreakerState === 'OPEN') {
      console.log('🔴 Circuit breaker abierto - esperando para reintentar...');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Máximo de intentos de reconexión crítica alcanzado. Activando circuit breaker...');
      this.enableCriticalCircuitBreaker();
      return;
    }

    // Backoff exponencial pero muy agresivo para sistema crítico
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 100,
      this.maxReconnectDelay
    );

    console.log(`🚨 RECONEXIÓN CRÍTICA en ${Math.round(delay)}ms (intento ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isConnected && this.circuitBreakerState !== 'OPEN') {
        this.connectWebSocket();
      }
    }, delay);
    
    this.reconnectAttempts++;
  }

  /**
   * 🚨 CIRCUIT BREAKER PARA SISTEMA CRÍTICO
   */
  private enableCriticalCircuitBreaker(): void {
    this.circuitBreakerState = 'OPEN';
    console.log('🔴 Circuit breaker crítico activado - pausando intentos de reconexión');
    
    setTimeout(() => {
      this.circuitBreakerState = 'HALF_OPEN';
      this.circuitBreakerFailures = 0;
      this.reconnectAttempts = 0;
      console.log('🟡 Circuit breaker crítico en estado HALF_OPEN - probando conexión');
      if (this.isConnected) {
        this.connectWebSocket();
      }
    }, this.circuitBreakerTimeout);
  }

  /**
   * 🚨 BUFFER DE EVENTOS CRÍTICOS DURANTE DESCONEXIONES
   */
  private addToCriticalBuffer(event: UnifiEvent): void {
    this.criticalEventBuffer.push({
      ...event,
      bufferedAt: new Date(),
      isBuffered: true
    } as any);

    // Mantener solo los eventos más recientes
    if (this.criticalEventBuffer.length > this.maxBufferSize) {
      this.criticalEventBuffer = this.criticalEventBuffer.slice(-this.maxBufferSize);
    }

    console.log(`📦 Evento crítico buffereado: ${event.type} desde ${event.camera.name} (buffer: ${this.criticalEventBuffer.length}/${this.maxBufferSize})`);
  }

  /**
   * 🚨 PROCESAR EVENTOS BUFFEREADOS AL RECONECTAR
   */
  private processBufferedEvents(): void {
    if (this.criticalEventBuffer.length > 0) {
      console.log(`🔄 Procesando ${this.criticalEventBuffer.length} eventos críticos buffereados...`);
      
      this.criticalEventBuffer.forEach(event => {
        if (this.eventCallback) {
          console.log(`📤 Reenviando evento crítico: ${event.type} desde ${event.camera.name}`);
          this.eventCallback(event);
        }
      });
      
      this.criticalEventBuffer = [];
      console.log('✅ Todos los eventos críticos buffereados procesados');
    }
  }

  /**
   * 🚨 VERIFICAR SALUD DE CONEXIÓN CRÍTICA
   */
  public isConnectionHealthy(): boolean {
    return this.isConnected && 
           this.isHeartbeatHealthy && 
           this.wsClient?.readyState === WebSocket.OPEN &&
           this.circuitBreakerState === 'CLOSED';
  }

  /**
   * 🚨 OBTENER ESTADO CRÍTICO DE CONEXIÓN
   */
  public getCriticalStatus(): any {
    return {
      isConnected: this.isConnected,
      isHeartbeatHealthy: this.isHeartbeatHealthy,
      wsState: this.wsClient?.readyState,
      circuitBreakerState: this.circuitBreakerState,
      reconnectAttempts: this.reconnectAttempts,
      bufferedEvents: this.criticalEventBuffer.length,
      lastPongReceived: new Date(this.lastPongReceived).toISOString(),
      timeSinceLastPong: Date.now() - this.lastPongReceived
    };
  }

  // ----------------------------------------------------------------------
  // --- MÉTODOS ADICIONALES (SNAPSHOTS, STREAMS, ETC.) ---
  // ----------------------------------------------------------------------
  
  async getCameraDetails(cameraId: string): Promise<UnifiProtectCamera | null> {
    try {
      const response = await this.httpClient.get(`/proxy/protect/integration/v1/cameras/${cameraId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error getting camera details ${cameraId}:`, error);
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
      console.error(`❌ Error getting camera snapshot ${cameraId}:`, error);
      return null;
    }
  }
}