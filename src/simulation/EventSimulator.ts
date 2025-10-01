import { EventEmitter } from 'events';
import { UnifiEvent, EventType, EventSeverity, CameraInfo } from '../domain/events/UnifiEvent';

export interface SimulationConfig {
  isActive: boolean;
  interval: number; // milisegundos entre eventos
  eventTypes: EventType[];
  cameras: CameraInfo[];
  severityLevels: EventSeverity[];
}

export interface SimulationEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  timestamp: Date;
  camera: CameraInfo;
  description: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export class EventSimulator extends EventEmitter {
  private config: SimulationConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private eventCounter: number = 0;

  constructor(config: Partial<SimulationConfig> = {}) {
    super();
    this.config = {
      isActive: false,
      interval: 5000, // 5 segundos por defecto
      eventTypes: [EventType.MOTION, EventType.PERSON, EventType.VEHICLE],
      cameras: this.getDefaultCameras(),
      severityLevels: [EventSeverity.LOW, EventSeverity.MEDIUM, EventSeverity.HIGH],
      ...config
    };
  }

  private getDefaultCameras(): CameraInfo[] {
    return [
      {
        id: 'cam-001',
        name: 'Cámara Principal',
        type: 'G4 Pro',
        location: 'Entrada Principal'
      },
      {
        id: 'cam-002',
        name: 'Cámara Trasera',
        type: 'G4 Bullet',
        location: 'Patio Trasero'
      },
      {
        id: 'cam-003',
        name: 'Cámara Lateral',
        type: 'G3 Flex',
        location: 'Lado Derecho'
      },
      {
        id: 'doorbell-001',
        name: 'Timbre Inteligente',
        type: 'G4 Doorbell',
        location: 'Puerta Principal'
      }
    ];
  }

  public start(): void {
    if (this.isActive()) {
      console.log('⚠️ Simulador ya está activo');
      return;
    }

    this.config.isActive = true;
    console.log(`🎭 Iniciando simulador de eventos (intervalo: ${this.config.interval}ms)`);
    
    this.intervalId = setInterval(() => {
      this.generateRandomEvent();
    }, this.config.interval);

    this.emit('simulationStarted');
  }

  public stop(): void {
    if (!this.isActive()) {
      console.log('⚠️ Simulador ya está detenido');
      return;
    }

    this.config.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🛑 Simulador de eventos detenido');
    this.emit('simulationStopped');
  }

  public isActive(): boolean {
    return this.config.isActive;
  }

  public getConfig(): SimulationConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SimulationConfig>): void {
    const wasActive = this.config.isActive;
    
    // Si estaba activo, detener temporalmente
    if (wasActive) {
      this.stop();
    }

    // Actualizar configuración
    this.config = { ...this.config, ...newConfig };

    // Si estaba activo, reiniciar con nueva configuración
    if (wasActive) {
      this.start();
    }

    this.emit('configUpdated', this.config);
  }

  public generateSingleEvent(eventType?: EventType): SimulationEvent {
    const type = eventType || this.getRandomEventType();
    const camera = this.getRandomCamera();
    const severity = this.getRandomSeverity();
    
    const event: SimulationEvent = {
      id: `sim-${++this.eventCounter}-${Date.now()}`,
      type,
      severity,
      timestamp: new Date(),
      camera,
      description: this.generateDescription(type, camera),
      thumbnailUrl: this.generateThumbnailUrl(type),
      metadata: this.generateMetadata(type, camera)
    };

    console.log(`🎭 Evento simulado generado: ${event.type} desde ${event.camera.name}`);
    this.emit('eventGenerated', event);
    
    return event;
  }

  private generateRandomEvent(): void {
    this.generateSingleEvent();
  }

  private getRandomEventType(): EventType {
    const types = this.config.eventTypes;
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomCamera(): CameraInfo {
    const cameras = this.config.cameras;
    return cameras[Math.floor(Math.random() * cameras.length)];
  }

  private getRandomSeverity(): EventSeverity {
    const severities = this.config.severityLevels;
    return severities[Math.floor(Math.random() * severities.length)];
  }

  private generateDescription(type: EventType, camera: CameraInfo): string {
    const descriptions = {
      [EventType.MOTION]: [
        `Movimiento detectado en ${camera.location}`,
        `Actividad detectada por ${camera.name}`,
        `Sensor de movimiento activado en ${camera.location}`
      ],
      [EventType.PERSON]: [
        `Persona detectada en ${camera.location}`,
        `Reconocimiento facial exitoso en ${camera.name}`,
        `Individuo identificado cerca de ${camera.location}`
      ],
      [EventType.VEHICLE]: [
        `Vehículo detectado en ${camera.location}`,
        `Automóvil identificado por ${camera.name}`,
        `Tráfico detectado en ${camera.location}`
      ],
      [EventType.PACKAGE]: [
        `Paquete detectado en ${camera.location}`,
        `Entrega identificada por ${camera.name}`,
        `Objeto dejado en ${camera.location}`
      ],
      [EventType.DOORBELL]: [
        `Timbre presionado en ${camera.location}`,
        `Llamada en puerta detectada`,
        `Visitante en ${camera.location}`
      ],
      [EventType.SMART_DETECT]: [
        `Detección inteligente activada en ${camera.location}`,
        `Algoritmo de IA detectó actividad en ${camera.name}`,
        `Smart Detect: Actividad inusual en ${camera.location}`
      ],
      [EventType.SENSOR]: [
        `Sensor activado en ${camera.location}`,
        `Alerta de sensor desde ${camera.name}`,
        `Dispositivo sensor detectó actividad en ${camera.location}`
      ]
    };

    const typeDescriptions = descriptions[type] || ['Evento detectado'];
    return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
  }

  private generateThumbnailUrl(type: EventType): string {
    // URLs de ejemplo para thumbnails
    const baseUrl = 'https://via.placeholder.com/320x240';
    const colors = {
      [EventType.MOTION]: '4CAF50', // Verde
      [EventType.PERSON]: '2196F3', // Azul
      [EventType.VEHICLE]: 'FF9800', // Naranja
      [EventType.PACKAGE]: '9C27B0', // Púrpura
      [EventType.DOORBELL]: 'F44336', // Rojo
      [EventType.SMART_DETECT]: '00BCD4', // Cian
      [EventType.SENSOR]: '795548' // Marrón
    };

    const color = colors[type] || '607D8B';
    return `${baseUrl}/${color}/FFFFFF?text=${type.toUpperCase()}`;
  }

  private generateMetadata(type: EventType, camera: CameraInfo): Record<string, any> {
    const baseMetadata = {
      simulation: true,
      confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
      temperature: Math.floor(Math.random() * 30) + 15, // 15-45°C
      humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
    };

    // Metadatos específicos por tipo
    switch (type) {
      case EventType.PERSON:
        return {
          ...baseMetadata,
          faceDetected: true,
          ageEstimate: Math.floor(Math.random() * 50) + 20,
          gender: Math.random() > 0.5 ? 'male' : 'female'
        };
      
      case EventType.VEHICLE:
        return {
          ...baseMetadata,
          licensePlate: this.generateLicensePlate(),
          vehicleType: ['car', 'truck', 'motorcycle'][Math.floor(Math.random() * 3)],
          speed: Math.floor(Math.random() * 50) + 10 // 10-60 km/h
        };
      
      case EventType.PACKAGE:
        return {
          ...baseMetadata,
          packageSize: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)],
          deliveryTime: new Date().toISOString(),
          estimatedWeight: Math.floor(Math.random() * 10) + 1 // 1-10 kg
        };
      
      case EventType.DOORBELL:
        return {
          ...baseMetadata,
          buttonPressed: true,
          audioDetected: true,
          visitorDetected: Math.random() > 0.3
        };
      
      default:
        return baseMetadata;
    }
  }

  private generateLicensePlate(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let plate = '';
    for (let i = 0; i < 3; i++) {
      plate += letters[Math.floor(Math.random() * letters.length)];
    }
    plate += '-';
    for (let i = 0; i < 3; i++) {
      plate += numbers[Math.floor(Math.random() * numbers.length)];
    }
    
    return plate;
  }

  public getStats(): { totalEvents: number; isActive: boolean; config: SimulationConfig } {
    return {
      totalEvents: this.eventCounter,
      isActive: this.isActive(),
      config: this.getConfig()
    };
  }

  public reset(): void {
    this.stop();
    this.eventCounter = 0;
    this.emit('simulationReset');
  }
}
