# 🔍 Guía de Diagnóstico de Conectividad

Esta guía te ayudará a diagnosticar problemas de conectividad entre la extensión de Chrome y el servidor WebSocket.

## ✅ Pre-requisitos

1. **Servidor corriendo**: Verifica que el servidor esté ejecutándose
   ```bash
   cd /home/davidc/unifi
   pgrep -f "node.*dist/server.js" && echo "✅ Servidor corriendo" || echo "❌ Servidor NO corriendo"
   ```
   
   Si no está corriendo:
   ```bash
   npm start
   ```

2. **Extensión instalada**: Asegúrate de que la extensión esté cargada en Chrome
   - Abre `chrome://extensions/`
   - Activa "Modo de desarrollador"
   - Carga la carpeta `/home/davidc/unifi/chrome-extension`

## 🔧 Métodos de Diagnóstico

### Método 1: Herramienta Visual de Diagnóstico (Recomendado)

1. Abre en Chrome: `file:///home/davidc/unifi/chrome-extension/diagnostic.html`
2. Presiona "🔄 Ejecutar Diagnóstico"
3. Observa los resultados de cada prueba:
   - ✅ Verde = Exitoso
   - ❌ Rojo = Error
   - ⚠️ Naranja = Advertencia

Esta herramienta prueba:
- 🌐 Conexión HTTP al servidor
- 🔑 Autenticación y generación de token
- 🔌 Conexión WebSocket
- 📨 Recepción de mensajes
- 🎭 Eventos de simulación

### Método 2: Script de Consola

1. Abre cualquier página web en Chrome
2. Abre DevTools (F12)
3. Ve a la pestaña "Console"
4. Copia y pega el contenido de `test-connection.js`
5. Observa los resultados en la consola

### Método 3: Logs de la Extensión

1. Abre `chrome://extensions/`
2. Encuentra "UniFi Protect Notifications"
3. Haz clic en "service worker" o "background page"
4. Observa los logs en la consola

**Logs esperados cuando funciona:**
```
🚀 Iniciando extensión UniFi Protect
⚙️ Configuración cargada
🔗 Conectando al servidor...
✅ WebSocket conectado
📨 Mensaje recibido: {type: 'connected'}
🎯 Evento UniFi recibido
📤 Evento enviado a content scripts para mostrar popup
```

### Método 4: Verificar Content Script

1. Abre cualquier página web
2. Abre DevTools (F12)
3. Ve a la pestaña "Console"
4. Busca el mensaje: `🚀 Inicializando content script UniFi Protect`

Si no ves este mensaje:
- Recarga la página
- Verifica que la extensión esté activa
- Verifica los permisos en el manifest.json

## 🐛 Problemas Comunes

### Problema 1: "Servidor no disponible"

**Síntomas:**
- ❌ Error en prueba HTTP
- No se puede conectar a localhost:3001

**Soluciones:**
```bash
# Verificar que el servidor esté corriendo
pgrep -f "node.*dist/server.js"

# Si no está corriendo, iniciarlo
cd /home/davidc/unifi
npm start

# Verificar que el puerto 3001 esté disponible
netstat -tuln | grep 3001
```

### Problema 2: "No se pudo obtener token"

**Síntomas:**
- ✅ Servidor HTTP disponible
- ❌ Error obteniendo token

**Soluciones:**
```bash
# Probar endpoint de token manualmente
curl -X POST http://localhost:3001/auth/token \
  -H "Content-Type: application/json" \
  -d '{"clientId":"test-123"}'
```

### Problema 3: "WebSocket no conecta"

**Síntomas:**
- ✅ Token obtenido
- ❌ Error en conexión WebSocket

**Soluciones:**
1. Verifica los permisos en `chrome-extension/manifest.json`:
   ```json
   "host_permissions": [
     "http://localhost:3001/*",
     "ws://localhost:3001/*"
   ]
   ```

2. Verifica los logs del servidor:
   ```bash
   # Los logs deberían mostrar:
   # Nueva conexión WebSocket intentada
   # Cliente XXX conectado
   ```

### Problema 4: "No se reciben eventos"

**Síntomas:**
- ✅ WebSocket conectado
- ✅ Mensaje de bienvenida recibido
- ❌ No se reciben eventos de simulación

**Soluciones:**

1. **Verifica que la simulación esté conectada:**
   - Revisa los logs del servidor al iniciar
   - Debería mostrar: "Módulo de simulación configurado y conectado"

2. **Genera un evento manualmente:**
   ```bash
   curl -X POST http://localhost:3001/api/simulation/generate \
     -H "Content-Type: application/json" \
     -d '{"eventType":"person"}'
   ```

3. **Verifica los filtros de la extensión:**
   - Abre el popup de la extensión
   - Asegúrate de que las notificaciones estén habilitadas
   - Ve a opciones y verifica los filtros

### Problema 5: "Notificaciones no aparecen en la página"

**Síntomas:**
- ✅ Eventos recibidos en background.js
- ❌ No aparecen popups flotantes en la página

**Soluciones:**

1. **Verifica que el content script esté cargado:**
   - Abre DevTools en la página
   - Busca: "🚀 Inicializando content script UniFi Protect"

2. **Verifica que se envíen mensajes al content script:**
   - Revisa logs del background.js
   - Debería mostrar: "📤 Evento enviado a content scripts para mostrar popup"

3. **Verifica que el mensaje sea del tipo correcto:**
   - El mensaje debe ser `type: 'showPopup'` (NO `showModal`)
   - Ya está corregido en la última versión

4. **Recarga la extensión:**
   - Ve a `chrome://extensions/`
   - Haz clic en el botón de recarga de la extensión
   - Recarga también la página web

## 📊 Comandos Útiles

### Verificar estado del servidor
```bash
curl http://localhost:3001/health | jq
```

### Generar evento de prueba
```bash
curl -X POST http://localhost:3001/api/simulation/generate \
  -H "Content-Type: application/json" \
  -d '{"eventType":"person"}' | jq
```

### Ver logs del servidor en tiempo real
```bash
cd /home/davidc/unifi
npm start
```

### Compilar cambios
```bash
cd /home/davidc/unifi
npm run build
```

## 🎯 Flujo Esperado Completo

Cuando todo funciona correctamente:

1. **Servidor inicia:**
   ```
   Servidor iniciado en puerto 3001
   WebSocket: ws://localhost:3001/ws
   Módulo de simulación configurado
   ```

2. **Extensión conecta:**
   ```
   🚀 Iniciando extensión UniFi Protect
   🔗 Conectando al servidor...
   🔑 Token obtenido exitosamente
   🔌 WebSocket conectado
   ✅ WebSocket conectado
   ```

3. **Evento generado:**
   ```
   Servidor: 📡 Evento simulado enviado a clientes
   Background: 📨 Mensaje recibido: event
   Background: 🎯 Evento UniFi recibido
   Background: 📤 Evento enviado a content scripts
   Content: 🎯 Popup flotante creado para evento
   ```

4. **Usuario ve:**
   - 🔔 Notificación nativa de Chrome
   - 🎨 Popup flotante en la página web

## 🆘 Soporte Adicional

Si ninguna de estas soluciones funciona:

1. Exporta los logs completos:
   - Background script logs
   - Content script logs
   - Server logs

2. Verifica versiones:
   ```bash
   node --version  # Debería ser v14+
   npm --version
   ```

3. Verifica que no haya errores de firewall bloqueando localhost:3001

