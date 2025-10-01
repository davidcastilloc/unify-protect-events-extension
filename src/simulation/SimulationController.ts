import { EventSimulator, SimulationConfig, SimulationEvent } from './EventSimulator';
import { UnifiEvent } from '../domain/events/UnifiEvent';
import { INotificationService } from '../domain/notifications/NotificationService';

export class SimulationController {
  private simulator: EventSimulator;
  private notificationService?: INotificationService;
  private isConnected: boolean = false;

  constructor() {
    this.simulator = new EventSimulator();
    this.setupEventListeners();
  }

  public setNotificationService(notificationService: INotificationService): void {
    this.notificationService = notificationService;
    this.isConnected = true;
    console.log('🔗 Controlador de simulación conectado al servicio de notificaciones');
  }

  public disconnect(): void {
    this.notificationService = undefined;
    this.isConnected = false;
    this.stopSimulation();
    console.log('🔌 Controlador de simulación desconectado');
  }

  private setupEventListeners(): void {
    // Escuchar eventos generados por el simulador
    this.simulator.on('eventGenerated', (event: SimulationEvent) => {
      if (this.isConnected && this.notificationService) {
        // Convertir evento de simulación a formato simple
        const simpleEvent = {
          type: event.type,
          timestamp: event.timestamp.toISOString(),
          camera: {
            name: event.camera.name
          },
          metadata: {
            ...event.metadata,
            simulation: true // Marcar como evento simulado
          }
        };

        // Enviar evento a través del servicio de notificaciones
        (this.notificationService as any).broadcastSimpleEvent(simpleEvent);
        console.log(`📡 Evento simulado enviado a clientes: ${event.type} desde ${event.camera.name}`);
      } else {
        console.warn('⚠️ No hay servicio de notificaciones conectado para enviar evento simulado');
      }
    });

    this.simulator.on('simulationStarted', () => {
      console.log('🎭 Simulación iniciada');
    });

    this.simulator.on('simulationStopped', () => {
      console.log('🛑 Simulación detenida');
    });

    this.simulator.on('configUpdated', (config: SimulationConfig) => {
      console.log('⚙️ Configuración de simulación actualizada');
    });

    this.simulator.on('simulationReset', () => {
      console.log('🔄 Simulación reiniciada');
    });
  }

  // Métodos de control público
  public startSimulation(config?: Partial<SimulationConfig>): boolean {
    if (!this.isConnected) {
      console.error('❌ No se puede iniciar simulación: servicio de notificaciones no conectado');
      return false;
    }

    if (config) {
      this.simulator.updateConfig(config);
    }

    this.simulator.start();
    return true;
  }

  public stopSimulation(): boolean {
    this.simulator.stop();
    return true;
  }

  public pauseSimulation(): boolean {
    if (this.simulator.isActive()) {
      this.simulator.stop();
      return true;
    }
    return false;
  }

  public resumeSimulation(): boolean {
    if (!this.simulator.isActive()) {
      this.simulator.start();
      return true;
    }
    return false;
  }

  public generateSingleEvent(eventType?: any): SimulationEvent | null {
    if (!this.isConnected) {
      console.error('❌ No se puede generar evento: servicio de notificaciones no conectado');
      return null;
    }

    // Convertir string a EventType si es necesario
    let enumEventType = eventType;
    if (typeof eventType === 'string') {
      switch (eventType) {
        case 'motion':
          enumEventType = 'motion' as any;
          break;
        case 'person':
          enumEventType = 'person' as any;
          break;
        case 'vehicle':
          enumEventType = 'vehicle' as any;
          break;
        case 'package':
          enumEventType = 'package' as any;
          break;
        case 'doorbell':
          enumEventType = 'doorbell' as any;
          break;
        case 'smart_detect':
          enumEventType = 'smart_detect' as any;
          break;
        case 'sensor':
          enumEventType = 'sensor' as any;
          break;
        default:
          console.warn(`Tipo de evento desconocido: ${eventType}`);
          return null;
      }
    }

    return this.simulator.generateSingleEvent(enumEventType);
  }

  public updateSimulationConfig(config: Partial<SimulationConfig>): boolean {
    try {
      this.simulator.updateConfig(config);
      return true;
    } catch (error) {
      console.error('❌ Error actualizando configuración de simulación:', error);
      return false;
    }
  }

  public getSimulationStatus(): {
    isActive: boolean;
    isConnected: boolean;
    stats: any;
    config: SimulationConfig;
  } {
    return {
      isActive: this.simulator.isActive(),
      isConnected: this.isConnected,
      stats: this.simulator.getStats(),
      config: this.simulator.getConfig()
    };
  }

  public resetSimulation(): boolean {
    this.simulator.reset();
    return true;
  }

  // Métodos para obtener información
  public getAvailableEventTypes(): string[] {
    return ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart_detect', 'sensor'];
  }

  public getAvailableSeverities(): string[] {
    return ['low', 'medium', 'high', 'critical'];
  }

  public getAvailableCameras(): any[] {
    return this.simulator.getConfig().cameras;
  }

  // Métodos de utilidad
  public isSimulationActive(): boolean {
    return this.simulator.isActive();
  }

  public isConnectedToNotificationService(): boolean {
    return this.isConnected;
  }

  public getEventCount(): number {
    return this.simulator.getStats().totalEvents;
  }
}
