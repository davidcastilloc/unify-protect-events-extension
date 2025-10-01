# 🎭 Módulo de Simulación de Eventos UniFi

Este módulo proporciona un sistema completo de simulación de eventos para probar la extensión de Chrome sin necesidad de tener un sistema UniFi Protect real funcionando.

## 📁 Estructura del Módulo

```
src/simulation/
├── EventSimulator.ts          # Motor principal de simulación
├── SimulationController.ts    # Controlador que conecta con el sistema
├── SimulationRoutes.ts        # Rutas HTTP para controlar la simulación
├── index.ts                   # Exportaciones del módulo
├── public/
│   └── simulation.html        # Interfaz web para controlar la simulación
└── README.md                  # Este archivo
```

## 🚀 Características

### ✅ Completamente Desacoplado
- **Sin dependencias** del código principal de UniFi
- **No interfiere** con la lógica existente
- **Fácil de activar/desactivar** sin afectar el sistema

### 🎲 Tipos de Eventos Simulados
- **Movimiento** - Detección de movimiento general
- **Persona** - Reconocimiento de personas con metadatos
- **Vehículo** - Detección de vehículos con placas simuladas
- **Paquete** - Detección de paquetes/entregas
- **Timbre** - Activación de timbre inteligente
- **Smart Detect** - Detecciones avanzadas de IA
- **Sensor** - Alertas de sensores

### ⚙️ Configuración Flexible
- **Intervalo personalizable** entre eventos (1-60 segundos)
- **Filtros por tipo** de evento
- **Niveles de severidad** configurables
- **Múltiples cámaras** simuladas

### 🌐 Interfaz Web Completa
- **Panel de control** intuitivo
- **Estado en tiempo real** del sistema
- **Generación manual** de eventos específicos
- **Configuración visual** de parámetros
- **Logs en tiempo real** de actividad

## 🛠️ Uso

### 1. Acceso a la Interfaz Web
```
http://localhost:3001/simulation
```

### 2. API REST Endpoints

#### Obtener Estado
```http
GET /api/simulation/status
```

#### Iniciar Simulación
```http
POST /api/simulation/start
Content-Type: application/json

{
  "config": {
    "interval": 5000,
    "eventTypes": ["motion", "person", "vehicle"],
    "severityLevels": ["low", "medium", "high"]
  }
}
```

#### Detener Simulación
```http
POST /api/simulation/stop
```

#### Generar Evento Único
```http
POST /api/simulation/generate-event
Content-Type: application/json

{
  "eventType": "person"
}
```

#### Actualizar Configuración
```http
PUT /api/simulation/config
Content-Type: application/json

{
  "interval": 3000,
  "eventTypes": ["motion", "doorbell"],
  "severityLevels": ["high", "critical"]
}
```

### 3. Programático (TypeScript)

```typescript
import { SimulationController } from './simulation';

const controller = new SimulationController();

// Conectar con el servicio de notificaciones
controller.setNotificationService(notificationService);

// Iniciar simulación con configuración personalizada
controller.startSimulation({
  interval: 3000,
  eventTypes: ['person', 'vehicle'],
  severityLevels: ['medium', 'high']
});

// Generar evento específico
controller.generateSingleEvent('doorbell');

// Obtener estado
const status = controller.getSimulationStatus();
console.log('Eventos generados:', status.stats.totalEvents);
```

## 🎯 Casos de Uso

### 1. Pruebas de la Extensión
- **Simular diferentes tipos** de eventos para probar filtros
- **Generar eventos masivos** para probar rendimiento
- **Probar escenarios específicos** como timbres o paquetes

### 2. Desarrollo y Debugging
- **Probar nuevas funcionalidades** sin hardware real
- **Simular condiciones extremas** (muchos eventos simultáneos)
- **Validar comportamientos** de la extensión

### 3. Demostraciones
- **Mostrar capacidades** del sistema sin configuración compleja
- **Crear escenarios controlados** para presentaciones
- **Probar diferentes configuraciones** fácilmente

## 🔧 Configuración Avanzada

### Eventos Personalizados
El simulador puede generar eventos con metadatos específicos:

```typescript
// Evento de persona con información detallada
{
  type: 'person',
  severity: 'high',
  camera: { id: 'cam-001', name: 'Entrada Principal' },
  metadata: {
    simulation: true,
    confidence: 95,
    ageEstimate: 35,
    gender: 'male',
    faceDetected: true
  }
}
```

### Cámaras Simuladas
```typescript
const cameras = [
  {
    id: 'cam-001',
    name: 'Cámara Principal',
    type: 'G4 Pro',
    location: 'Entrada Principal'
  },
  {
    id: 'doorbell-001',
    name: 'Timbre Inteligente',
    type: 'G4 Doorbell',
    location: 'Puerta Principal'
  }
];
```

## 🔒 Seguridad

- **Completamente aislado** del sistema real de UniFi
- **No requiere credenciales** de UniFi Protect
- **Solo funciona en modo desarrollo** (recomendado)
- **Fácil de desactivar** en producción

## 📊 Monitoreo

### Métricas Disponibles
- **Total de eventos** generados
- **Estado de conexión** con el sistema de notificaciones
- **Configuración actual** activa
- **Tiempo de actividad** de la simulación

### Logs en Tiempo Real
La interfaz web muestra logs detallados de:
- Inicio/detención de simulación
- Eventos generados
- Errores de configuración
- Cambios de estado

## 🚨 Limitaciones

1. **Solo para desarrollo/testing** - No usar en producción
2. **Eventos simulados** - No reflejan condiciones reales
3. **Metadatos ficticios** - Información generada aleatoriamente
4. **Sin video real** - Solo thumbnails de placeholder

## 🔄 Integración

El módulo se integra automáticamente con:
- ✅ **Servicio de Notificaciones** - Para enviar eventos a clientes
- ✅ **WebSocket Server** - Para comunicación en tiempo real
- ✅ **Sistema de Logging** - Para registro de actividad

## 📝 Notas de Desarrollo

- **EventEmitter** para comunicación interna
- **Configuración reactiva** - Cambios se aplican inmediatamente
- **Gestión de memoria** - Limpieza automática de recursos
- **Manejo de errores** - Recuperación robusta ante fallos

---

**¡El módulo de simulación está listo para usar! 🎉**

Simplemente accede a `http://localhost:3001/simulation` y comienza a probar tu extensión con eventos simulados.
