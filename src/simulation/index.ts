// Exportar todas las clases y tipos del módulo de simulación
export { EventSimulator } from './EventSimulator';
export { SimulationController } from './SimulationController';

export type {
  SimulationConfig,
  SimulationEvent
} from './EventSimulator';

// Re-exportar tipos del dominio para conveniencia
export type {
  UnifiEvent,
  EventType,
  EventSeverity,
  CameraInfo,
  EventFilter
} from '../domain/events/UnifiEvent';
