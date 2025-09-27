# 🔔 UniFi Protect Notifications

Sistema de notificaciones en tiempo real para eventos de UniFi Protect con extensión de Chrome, replicando la experiencia de Avigilon.

## 📋 Características

- ✅ **Notificaciones nativas en Chrome** - Funciona incluso con el navegador cerrado
- ✅ **Tiempo real** - WebSockets para comunicación instantánea
- ✅ **Filtros avanzados** - Configura qué eventos y cámaras monitorear
- ✅ **Reconexión automática** - Se reconecta automáticamente si se pierde la conexión
- ✅ **Arquitectura limpia** - Backend con Clean Architecture / hexagonal
- ✅ **Seguridad** - Autenticación JWT y comunicación cifrada
- ✅ **Escalable** - Preparado para múltiples clientes

## 🏗️ Arquitectura

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Chrome        │ ◄──────────────► │   Backend       │
│   Extension     │                  │   Node.js       │
│                 │                  │                 │
│ ┌─────────────┐ │                  │ ┌─────────────┐ │
│ │ Background  │ │                  │ │ WebSocket   │ │
│ │ Service     │ │                  │ │ Server      │ │
│ │ Worker      │ │                  │ │             │ │
│ └─────────────┘ │                  │ └─────────────┘ │
│                 │                  │                 │
│ ┌─────────────┐ │                  │ ┌─────────────┐ │
│ │ Options     │ │                  │ │ UniFi       │ │
│ │ Page        │ │                  │ │ Protect     │ │
│ │             │ │                  │ │ Client      │ │
│ └─────────────┘ │                  │ └─────────────┘ │
└─────────────────┘                  └─────────────────┘
```

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ 
- Chrome Browser
- UniFi Protect Controller accesible

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd unifi-protect-notifications
```

### 2. Configurar el Backend

```bash
# Instalar dependencias
npm install

# Copiar archivo de configuración
cp env.example .env

# Editar configuración
nano .env
```

Configurar las variables en `.env`:

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración UniFi Protect
UNIFI_HOST=192.168.1.100
UNIFI_PORT=443
UNIFI_USERNAME=admin
UNIFI_PASSWORD=tu_password_seguro
UNIFI_SSL_VERIFY=false

# Configuración de seguridad
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui
CORS_ORIGIN=http://localhost:3000

# Configuración de logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 3. Compilar y Ejecutar el Backend

```bash
# Compilar TypeScript
npm run build

# Ejecutar en producción
npm start

# O ejecutar en modo desarrollo
npm run dev
```

El backend estará disponible en `http://localhost:3000`

### 4. Instalar la Extensión de Chrome

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** en la esquina superior derecha
3. Haz clic en **"Cargar extensión descomprimida"**
4. Selecciona la carpeta `chrome-extension/`
5. La extensión se instalará y aparecerá en la barra de herramientas

## ⚙️ Configuración

### Configurar la Extensión

1. Haz clic en el icono de la extensión en Chrome
2. Haz clic en **"⚙️ Configuración"** para abrir las opciones
3. Configura:
   - **URL del Backend**: `http://localhost:3000` (o tu servidor)
   - **Filtros de eventos**: Selecciona qué tipos de eventos recibir
   - **Filtros de severidad**: Configura niveles mínimos de alerta
   - **Cámaras**: Elige qué cámaras monitorear

### Configurar UniFi Protect

1. Asegúrate de que tu UniFi Protect Controller sea accesible desde el servidor
2. Usa credenciales con permisos de lectura
3. Verifica que el puerto y SSL estén configurados correctamente

## 🔧 Uso

### Notificaciones Automáticas

Una vez configurado, el sistema:

1. Se conecta automáticamente al UniFi Protect Controller
2. Escucha eventos en tiempo real (movimiento, personas, vehículos, etc.)
3. Aplica los filtros configurados
4. Muestra notificaciones nativas en Chrome
5. Se reconecta automáticamente si se pierde la conexión

### Tipos de Eventos Soportados

- 🏃 **Movimiento** - Detección de movimiento general
- 👤 **Persona** - Reconocimiento de personas
- 🚗 **Vehículo** - Detección de vehículos
- 📦 **Paquete** - Detección de paquetes
- 🔔 **Timbre** - Activación de timbre
- 🧠 **Detección Inteligente** - Eventos de IA

### Niveles de Severidad

- 🟢 **Baja** - Eventos informativos
- 🟡 **Media** - Eventos importantes
- 🟠 **Alta** - Eventos críticos
- 🔴 **Crítica** - Eventos urgentes (requieren interacción)

## 🛠️ Desarrollo

### Estructura del Proyecto

```
unifi-protect-notifications/
├── src/                          # Backend TypeScript
│   ├── domain/                   # Lógica de dominio
│   │   ├── events/               # Modelos de eventos
│   │   └── notifications/        # Servicios de notificación
│   ├── infrastructure/           # Capa de infraestructura
│   │   ├── unifi/               # Cliente UniFi Protect
│   │   └── websocket/           # Servidor WebSocket
│   ├── application/             # Lógica de aplicación
│   └── server.ts                # Servidor principal
├── chrome-extension/             # Extensión de Chrome
│   ├── manifest.json            # Manifest V3
│   ├── background.js            # Service Worker
│   ├── options.html/js          # Página de configuración
│   ├── popup.html/js            # Popup de la extensión
│   └── icons/                   # Iconos de la extensión
├── dist/                        # Código compilado
└── logs/                        # Logs del servidor
```

### Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Ejecutar en modo desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm start            # Ejecutar versión compilada
npm run lint         # Ejecutar linter

# Testing
npm test             # Ejecutar tests (cuando estén implementados)
```

### API del Backend

#### Endpoints HTTP

- `GET /health` - Health check del servidor
- `POST /auth/token` - Generar token JWT para cliente
- `GET /api/cameras` - Obtener lista de cámaras
- `GET /api/ws-info` - Información del WebSocket

#### WebSocket

- **Endpoint**: `ws://localhost:3000/ws?token=<jwt_token>`
- **Mensajes de entrada**:
  - `update_filters` - Actualizar filtros del cliente
  - `ping` - Ping para mantener conexión viva
- **Mensajes de salida**:
  - `connected` - Confirmación de conexión
  - `notification` - Evento de notificación
  - `pong` - Respuesta a ping

## 🔒 Seguridad

### Medidas Implementadas

- **Autenticación JWT**: Tokens seguros con expiración
- **Validación de entrada**: Sanitización de todos los inputs
- **CORS configurado**: Orígenes permitidos específicos
- **Helmet.js**: Headers de seguridad HTTP
- **Variables de entorno**: Credenciales fuera del código
- **Reconexión segura**: Backoff exponencial en fallos

### Recomendaciones

- Usa HTTPS en producción
- Configura firewall para restringir acceso
- Rotar tokens JWT regularmente
- Monitorea logs de acceso
- Mantén credenciales seguras

## 🐛 Solución de Problemas

### Backend no inicia

```bash
# Verificar configuración
cat .env

# Verificar puerto libre
netstat -tulpn | grep :3000

# Verificar logs
tail -f logs/app.log
```

### Extensión no se conecta

1. Verifica que el backend esté ejecutándose
2. Comprueba la URL en configuración
3. Revisa la consola del navegador (F12)
4. Verifica permisos de notificación en Chrome

### No se reciben eventos

1. Verifica credenciales de UniFi Protect
2. Comprueba conectividad de red
3. Revisa filtros configurados
4. Verifica logs del backend

### Reconexión frecuente

1. Verifica estabilidad de red
2. Comprueba configuración de firewall
3. Revisa logs de WebSocket
4. Considera ajustar timeouts

## 📈 Escalabilidad

### Preparado para Múltiples Clientes

- Soporte para múltiples extensiones conectadas
- Filtros individuales por cliente
- Gestión de conexiones concurrentes
- Balanceo de carga compatible

### Integraciones Futuras

- Slack notifications
- Microsoft Teams
- Email alerts
- SMS notifications
- Webhook endpoints

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🙏 Agradecimientos

- UniFi Protect por la API
- Chrome Extensions team por Manifest V3
- Comunidad de desarrolladores de Node.js
- Contribuidores del proyecto

## 📞 Soporte

Para soporte técnico o reportar bugs:

- Abre un issue en GitHub
- Contacta al desarrollador
- Revisa la documentación
- Consulta los logs del sistema

---

**Desarrollado con ❤️ para la comunidad UniFi**
