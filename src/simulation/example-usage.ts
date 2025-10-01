/**
 * Ejemplo de uso del módulo de simulación
 * Este archivo muestra cómo usar el simulador programáticamente
 */

import { SimulationController } from './SimulationController';
import { SimulationConfig } from './EventSimulator';
import { NotificationService } from '../application/NotificationService';
import { EventType, EventSeverity } from '../domain/events/UnifiEvent';

// Ejemplo 1: Uso básico del controlador de simulación
export function ejemploBasico() {
  console.log('🎭 Ejemplo básico de simulación');
  
  // Crear instancia del controlador
  const simulationController = new SimulationController();
  
  // Simular que tenemos un servicio de notificaciones
  const notificationService = new NotificationService();
  simulationController.setNotificationService(notificationService);
  
  // Configuración básica
  const config: Partial<SimulationConfig> = {
    interval: 3000, // 3 segundos entre eventos
    eventTypes: [EventType.MOTION, EventType.PERSON],
    severityLevels: [EventSeverity.MEDIUM, EventSeverity.HIGH]
  };
  
  // Iniciar simulación
  console.log('Iniciando simulación...');
  const success = simulationController.startSimulation(config);
  
  if (success) {
    console.log('✅ Simulación iniciada correctamente');
    
    // Esperar 10 segundos y luego detener
    setTimeout(() => {
      simulationController.stopSimulation();
      console.log('🛑 Simulación detenida');
    }, 10000);
  }
}

// Ejemplo 2: Generación de eventos específicos
export function ejemploEventosEspecificos() {
  console.log('🎲 Ejemplo de eventos específicos');
  
  const simulationController = new SimulationController();
  const notificationService = new NotificationService();
  simulationController.setNotificationService(notificationService);
  
  // Generar diferentes tipos de eventos
  const eventos = [EventType.MOTION, EventType.PERSON, EventType.VEHICLE, EventType.DOORBELL];
  
  eventos.forEach((tipo, index) => {
    setTimeout(() => {
      const evento = simulationController.generateSingleEvent(tipo);
      if (evento) {
        console.log(`✅ Evento generado: ${evento.type} desde ${evento.camera.name}`);
      }
    }, index * 2000); // Un evento cada 2 segundos
  });
}

// Ejemplo 3: Configuración avanzada
export function ejemploConfiguracionAvanzada() {
  console.log('⚙️ Ejemplo de configuración avanzada');
  
  const simulationController = new SimulationController();
  const notificationService = new NotificationService();
  simulationController.setNotificationService(notificationService);
  
  // Configuración para simular alta actividad
  const configAltaActividad: Partial<SimulationConfig> = {
    interval: 1000, // 1 segundo entre eventos
    eventTypes: [EventType.MOTION, EventType.PERSON, EventType.VEHICLE, EventType.PACKAGE],
    severityLevels: [EventSeverity.HIGH, EventSeverity.CRITICAL]
  };
  
  // Configuración para simular actividad normal
  const configNormal: Partial<SimulationConfig> = {
    interval: 10000, // 10 segundos entre eventos
    eventTypes: [EventType.MOTION, EventType.PERSON],
    severityLevels: [EventSeverity.LOW, EventSeverity.MEDIUM]
  };
  
  console.log('Iniciando simulación de alta actividad...');
  simulationController.startSimulation(configAltaActividad);
  
  // Después de 15 segundos, cambiar a configuración normal
  setTimeout(() => {
    console.log('Cambiando a configuración normal...');
    simulationController.updateSimulationConfig(configNormal);
  }, 15000);
  
  // Detener después de 30 segundos
  setTimeout(() => {
    simulationController.stopSimulation();
    console.log('🛑 Simulación detenida');
  }, 30000);
}

// Ejemplo 4: Monitoreo de estadísticas
export function ejemploMonitoreo() {
  console.log('📊 Ejemplo de monitoreo');
  
  const simulationController = new SimulationController();
  const notificationService = new NotificationService();
  simulationController.setNotificationService(notificationService);
  
  // Iniciar simulación
  simulationController.startSimulation();
  
  // Monitorear estadísticas cada 5 segundos
  const intervalId = setInterval(() => {
    const status = simulationController.getSimulationStatus();
    
    console.log('📈 Estadísticas:');
    console.log(`  - Activa: ${status.isActive}`);
    console.log(`  - Conectada: ${status.isConnected}`);
    console.log(`  - Eventos generados: ${status.stats.totalEvents}`);
    console.log(`  - Intervalo: ${status.config.interval}ms`);
    console.log(`  - Tipos de eventos: ${status.config.eventTypes.join(', ')}`);
    
    // Detener después de 20 segundos
    if (status.stats.totalEvents >= 20) {
      clearInterval(intervalId);
      simulationController.stopSimulation();
      console.log('🛑 Simulación detenida después de 20 eventos');
    }
  }, 5000);
}

// Ejemplo 5: Escenarios de prueba específicos
export function ejemploEscenariosPrueba() {
  console.log('🧪 Ejemplo de escenarios de prueba');
  
  const simulationController = new SimulationController();
  const notificationService = new NotificationService();
  simulationController.setNotificationService(notificationService);
  
  // Escenario 1: Simular día normal (eventos espaciados)
  console.log('🌅 Simulando día normal...');
  simulationController.startSimulation({
    interval: 30000, // 30 segundos entre eventos
    eventTypes: [EventType.MOTION, EventType.PERSON],
    severityLevels: [EventSeverity.LOW, EventSeverity.MEDIUM]
  });
  
  setTimeout(() => {
    simulationController.stopSimulation();
    
    // Escenario 2: Simular evento de seguridad (muchos eventos críticos)
    console.log('🚨 Simulando evento de seguridad...');
    simulationController.startSimulation({
      interval: 2000, // 2 segundos entre eventos
      eventTypes: [EventType.MOTION, EventType.PERSON, EventType.VEHICLE],
      severityLevels: [EventSeverity.HIGH, EventSeverity.CRITICAL]
    });
    
    setTimeout(() => {
      simulationController.stopSimulation();
      
      // Escenario 3: Simular entrega de paquetes
      console.log('📦 Simulando entregas de paquetes...');
      simulationController.startSimulation({
        interval: 15000, // 15 segundos entre eventos
        eventTypes: [EventType.PACKAGE, EventType.DOORBELL],
        severityLevels: [EventSeverity.MEDIUM]
      });
      
      setTimeout(() => {
        simulationController.stopSimulation();
        console.log('✅ Todos los escenarios completados');
      }, 30000);
    }, 20000);
  }, 60000);
}

// Función principal para ejecutar ejemplos
export function ejecutarEjemplos() {
  console.log('🎭 Iniciando ejemplos del módulo de simulación\n');
  
  // Ejecutar ejemplos uno por uno
  setTimeout(() => ejemploBasico(), 1000);
  setTimeout(() => ejemploEventosEspecificos(), 15000);
  setTimeout(() => ejemploConfiguracionAvanzada(), 30000);
  setTimeout(() => ejemploMonitoreo(), 60000);
  setTimeout(() => ejemploEscenariosPrueba(), 90000);
}

// Si se ejecuta directamente este archivo
if (require.main === module) {
  ejecutarEjemplos();
}
