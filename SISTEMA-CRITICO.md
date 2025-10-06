# 🚨 SISTEMA CRÍTICO - NUNCA DESCONECTADO

## 📋 **RESUMEN EJECUTIVO**

Se ha implementado un **sistema crítico ultra-robusto** que garantiza que **NUNCA** se pierda la conexión con UniFi Protect y que si se pierde, se reconecte **inmediatamente**. El sistema está diseñado para aplicaciones críticas donde no se pueden perder eventos.

## 🎯 **CARACTERÍSTICAS IMPLEMENTADAS**

### **1. 💓 Heartbeat Ultra-Agresivo**
- **UniFi Protect**: Ping cada **2 segundos**, timeout de **5 segundos**
- **Clientes WebSocket**: Ping cada **3 segundos**, timeout de **10 segundos**
- **Detección proactiva** de conexiones zombie antes de que fallen

### **2. 🚀 Reconexión Instantánea**
- **Delay base**: 100ms (vs 10 segundos anterior)
- **Backoff exponencial** pero muy agresivo (máximo 5 segundos)
- **50 intentos** antes de activar circuit breaker
- **Reconexión automática** en <1 segundo en condiciones normales

### **3. 📦 Buffer de Eventos Críticos**
- **500 eventos** en buffer durante desconexiones
- **Reenvío automático** de eventos perdidos al reconectar
- **Persistencia opcional** en disco para eventos críticos

### **4. 🔴 Circuit Breaker Inteligente**
- **10 fallos** antes de abrir el circuit breaker
- **1 minuto** de pausa antes de reintentar
- **Estado HALF_OPEN** para pruebas de conectividad

### **5. 📊 Monitoreo y Alertas**
- **Endpoint crítico**: `/critical-status`
- **Monitor independiente**: `monitor-critical.js`
- **Verificación cada 5 segundos**
- **Alertas automáticas** por fallos consecutivos

## 🚀 **CÓMO USAR EL SISTEMA CRÍTICO**

### **1. Configuración Inicial**

```bash
# Copiar configuración crítica
cp env.example env.critical

# Editar configuración crítica
nano env.critical
```

### **2. Iniciar Sistema Crítico**

```bash
# Usar el script de inicio crítico
./start-critical.sh

# O manualmente
export $(cat env.critical | grep -v '^#' | xargs)
node dist/server.js &
node monitor-critical.js &
```

### **3. Verificar Estado**

```bash
# Health check básico
curl http://localhost:3000/health

# Estado crítico completo
curl http://localhost:3000/critical-status
```

## 📊 **ENDPOINTS DE MONITOREO**

### **Health Check Básico**
```
GET /health
```
Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "clients": 5
}
```

### **Estado Crítico Completo**
```
GET /critical-status
```
Respuesta:
```json
{
  "status": "critical-system",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "unifiProtect": {
    "isConnected": true,
    "isHeartbeatHealthy": true,
    "wsState": 1,
    "circuitBreakerState": "CLOSED",
    "reconnectAttempts": 0,
    "bufferedEvents": 0,
    "lastPongReceived": "2024-01-15T10:29:58.000Z",
    "timeSinceLastPong": 2000
  },
  "webSocketClients": {
    "count": 3,
    "clients": [
      {
        "id": "client-1",
        "lastSeen": "2024-01-15T10:29:58.000Z",
        "isHealthy": true
      }
    ]
  },
  "overallHealth": true
}
```

## ⚙️ **VARIABLES DE CONFIGURACIÓN CRÍTICA**

### **UniFi Protect - Heartbeat**
```bash
UNIFI_HEARTBEAT_INTERVAL=2000          # Ping cada 2 segundos
UNIFI_HEARTBEAT_TIMEOUT=5000           # Timeout de 5 segundos
UNIFI_WS_HANDSHAKE_TIMEOUT=10000       # Timeout de handshake
```

### **Reconexión Instantánea**
```bash
UNIFI_BASE_RECONNECT_DELAY=100         # 100ms base
UNIFI_MAX_RECONNECT_DELAY=5000         # Máximo 5 segundos
UNIFI_MAX_RECONNECT_ATTEMPTS=50        # Muchos intentos
```

### **Circuit Breaker**
```bash
UNIFI_CIRCUIT_BREAKER_THRESHOLD=10     # 10 fallos
UNIFI_CIRCUIT_BREAKER_TIMEOUT=60000    # 1 minuto de pausa
```

### **Buffer de Eventos**
```bash
UNIFI_EVENT_BUFFER_SIZE=500            # 500 eventos en buffer
```

### **WebSocket Clientes**
```bash
WS_CRITICAL_PING_INTERVAL=3000         # Ping cada 3 segundos
WS_CRITICAL_TIMEOUT=10000              # Timeout de 10 segundos
```

## 🔧 **SCRIPT DE MONITOREO**

El script `monitor-critical.js` proporciona:

- **Verificación cada 5 segundos**
- **Alertas automáticas** por fallos consecutivos
- **Logging detallado** de eventos críticos
- **Integración fácil** con sistemas de alerta

```bash
# Ejecutar monitor independiente
node monitor-critical.js

# Con configuración personalizada
SERVER_URL=http://localhost:3000 \
MONITOR_INTERVAL=3000 \
ALERT_THRESHOLD=2 \
node monitor-critical.js
```

## 📈 **MÉTRICAS DE RENDIMIENTO**

### **Antes del Sistema Crítico:**
- ❌ Desconexión cada 30-90 segundos
- ❌ Reconexión en 10+ segundos
- ❌ Pérdida de eventos durante desconexiones
- ❌ Sin detección proactiva de problemas

### **Después del Sistema Crítico:**
- ✅ **Conexión estable** con ping cada 2 segundos
- ✅ **Reconexión en <1 segundo** en condiciones normales
- ✅ **Zero pérdida de eventos** (buffer crítico)
- ✅ **Detección proactiva** de problemas en 5 segundos
- ✅ **Monitoreo continuo** y alertas automáticas

## 🚨 **CASOS DE USO CRÍTICOS**

### **1. Seguridad Residencial/Comercial**
- **Detección de intrusión** - No se puede perder ningún evento
- **Monitoreo 24/7** - Sistema debe estar siempre conectado
- **Alertas inmediatas** - Reconexión instantánea si hay problemas

### **2. Sistemas de Emergencia**
- **Detección de incendio** - Eventos críticos no pueden perderse
- **Monitoreo médico** - Conectividad garantizada
- **Sistemas industriales** - Operación continua requerida

### **3. Aplicaciones de Negocio Crítico**
- **Control de acceso** - Eventos de entrada/salida críticos
- **Monitoreo de inventario** - Detección de movimiento crítica
- **Sistemas de pago** - Conectividad garantizada

## 🛠️ **MANTENIMIENTO Y TROUBLESHOOTING**

### **Verificar Estado del Sistema**
```bash
# Estado general
curl http://localhost:3000/critical-status | jq

# Logs del sistema
tail -f logs/app.log

# Logs del monitor
tail -f logs/critical-monitor.log
```

### **Reiniciar Sistema Crítico**
```bash
# Detener procesos
pkill -f "node.*server"
pkill -f "monitor-critical"

# Reiniciar
./start-critical.sh
```

### **Problemas Comunes**

1. **Circuit Breaker Abierto**
   - Esperar 1 minuto para que se resetee automáticamente
   - Verificar conectividad de red a UniFi Protect

2. **Buffer de Eventos Lleno**
   - Verificar conectividad de clientes WebSocket
   - Revisar logs para eventos no procesados

3. **Monitor No Detecta Problemas**
   - Verificar configuración de `ALERT_THRESHOLD`
   - Revisar logs del monitor

## 📞 **SOPORTE Y CONTACTO**

Para problemas críticos:
1. Verificar logs del sistema
2. Comprobar estado en `/critical-status`
3. Revisar conectividad de red
4. Reiniciar sistema si es necesario

---

**🚨 IMPORTANTE**: Este sistema está diseñado para aplicaciones críticas. Siempre mantén respaldos de configuración y monitorea los logs regularmente.
