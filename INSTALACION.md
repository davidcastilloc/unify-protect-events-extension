# 📦 Guía de Instalación - UniFi Protect Notifications

Esta guía te llevará paso a paso para instalar y configurar el sistema completo de notificaciones de UniFi Protect.

## 🎯 Objetivo

Al final de esta guía tendrás:
- ✅ Backend ejecutándose y conectado a UniFi Protect
- ✅ Extensión de Chrome instalada y configurada
- ✅ Notificaciones funcionando en tiempo real

## 📋 Prerrequisitos

### Software Requerido

- **Node.js 18+** - [Descargar aquí](https://nodejs.org/)
- **Chrome Browser** - Versión 88+ (para Manifest V3)
- **Git** - Para clonar el repositorio

### Hardware y Red

- **UniFi Protect Controller** accesible en la red
- **Acceso de red** entre el servidor y el UniFi Protect
- **Puerto 3000** libre en el servidor

### Credenciales Necesarias

- Usuario y contraseña de UniFi Protect
- IP/hostname del UniFi Protect Controller
- Puerto del UniFi Protect (generalmente 443)

## 🚀 Paso 1: Preparar el Entorno

### 1.1 Verificar Node.js

```bash
node --version
npm --version
```

Deberías ver versiones 18+ para Node.js y 9+ para npm.

### 1.2 Clonar el Repositorio

```bash
# Clonar el repositorio
git clone <repository-url>
cd unifi-protect-notifications

# Verificar estructura
ls -la
```

Deberías ver:
```
unifi-protect-notifications/
├── src/
├── chrome-extension/
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Paso 2: Configurar el Backend

### 2.1 Instalar Dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Verificar instalación
npm list --depth=0
```

### 2.2 Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp env.example .env

# Editar configuración
nano .env  # o usa tu editor preferido
```

### 2.3 Configuración del Archivo .env

Edita el archivo `.env` con tus datos:

```env
# ============================================
# CONFIGURACIÓN DEL SERVIDOR
# ============================================
PORT=3000
NODE_ENV=development

# ============================================
# CONFIGURACIÓN UNIFI PROTECT
# ============================================
UNIFI_HOST=192.168.1.100          # IP de tu UniFi Protect
UNIFI_PORT=443                     # Puerto (443 para HTTPS, 80 para HTTP)
UNIFI_USERNAME=admin               # Tu usuario de UniFi Protect
UNIFI_PASSWORD=tu_password_seguro  # Tu contraseña
UNIFI_SSL_VERIFY=false             # true si usas certificado válido

# ============================================
# CONFIGURACIÓN DE SEGURIDAD
# ============================================
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui_minimo_32_caracteres
CORS_ORIGIN=http://localhost:3000

# ============================================
# CONFIGURACIÓN DE LOGGING
# ============================================
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 2.4 Crear Directorio de Logs

```bash
mkdir -p logs
```

### 2.5 Compilar el Backend

```bash
# Compilar TypeScript a JavaScript
npm run build

# Verificar compilación
ls -la dist/
```

Deberías ver archivos `.js` en el directorio `dist/`.

## 🚀 Paso 3: Ejecutar el Backend

### 3.1 Iniciar el Servidor

```bash
# Opción 1: Ejecutar versión compilada
npm start

# Opción 2: Ejecutar en modo desarrollo (con hot-reload)
npm run dev
```

### 3.2 Verificar que el Backend Funciona

Abre otra terminal y ejecuta:

```bash
# Health check
curl http://localhost:3000/health

# Deberías ver algo como:
# {
#   "status": "ok",
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "clients": 0
# }
```

### 3.3 Verificar Logs

```bash
# Ver logs en tiempo real
tail -f logs/app.log

# Deberías ver mensajes como:
# [INFO] Servidor iniciado en puerto 3000
# [INFO] Cliente UniFi Protect configurado
# [INFO] Conexión establecida con UniFi Protect
```

## 🌐 Paso 4: Instalar la Extensión de Chrome

### 4.1 Abrir Chrome y Navegar a Extensiones

1. Abre Google Chrome
2. Navega a `chrome://extensions/`
3. Activa el **"Modo de desarrollador"** en la esquina superior derecha

### 4.2 Cargar la Extensión

1. Haz clic en **"Cargar extensión descomprimida"**
2. Navega a la carpeta del proyecto
3. Selecciona la carpeta `chrome-extension/`
4. Haz clic en **"Seleccionar carpeta"**

### 4.3 Verificar Instalación

Deberías ver:
- ✅ La extensión aparece en la lista
- ✅ Icono en la barra de herramientas de Chrome
- ✅ Notificación de bienvenida

## ⚙️ Paso 5: Configurar la Extensión

### 5.1 Abrir Configuración

1. Haz clic en el icono de la extensión en Chrome
2. Haz clic en **"⚙️ Configuración"** en el popup
3. Se abrirá la página de opciones

### 5.2 Configurar Conexión

En la sección **"🔗 Conexión al Backend"**:

- **URL del Backend**: `http://localhost:3000`
- **ID del Cliente**: Se genera automáticamente
- **Notificaciones**: ✅ Habilitadas

### 5.3 Probar Conexión

1. Haz clic en **"Probar Conexión"**
2. Deberías ver **"Estado: Conexión exitosa ✅"**
3. Haz clic en **"Actualizar Cámaras"** para cargar las cámaras disponibles

### 5.4 Configurar Filtros

En la sección **"🔍 Filtros de Eventos"**:

**Tipos de Eventos:**
- ✅ Movimiento
- ✅ Persona
- ✅ Vehículo
- ✅ Timbre

**Niveles de Severidad:**
- ✅ Baja
- ✅ Media
- ✅ Alta
- ✅ Crítica

### 5.5 Configurar Cámaras

En la sección **"📹 Filtros de Cámaras"**:

1. Las cámaras se cargan automáticamente
2. Selecciona las cámaras que quieres monitorear
3. O déjalas todas sin seleccionar para monitorear todas

### 5.6 Guardar Configuración

1. Haz clic en **"Guardar Configuración"**
2. Deberías ver un mensaje de confirmación
3. La extensión se reconectará automáticamente

## 🧪 Paso 6: Probar el Sistema

### 6.1 Verificar Estado de Conexión

1. Haz clic en el icono de la extensión
2. Verifica que muestre **"Conectado ✅"**
3. El badge debería mostrar **"ON"** en verde

### 6.2 Probar Notificación

1. En el popup, haz clic en **"Probar Notificación"**
2. Deberías ver una notificación nativa de Chrome
3. La notificación debería aparecer incluso con Chrome cerrado

### 6.3 Simular Eventos (Desarrollo)

El backend incluye simulación de eventos cada 30 segundos para testing:

1. Espera 30 segundos después de la instalación
2. Deberías recibir una notificación de evento simulado
3. Verifica que los filtros funcionen correctamente

### 6.4 Eventos Reales de UniFi Protect

Para eventos reales:

1. Asegúrate de que el UniFi Protect esté configurado correctamente
2. Los eventos aparecerán automáticamente cuando ocurran
3. Verifica los logs del backend para confirmar la conexión

## 🔍 Paso 7: Verificación Final

### 7.1 Checklist de Funcionamiento

- [ ] Backend ejecutándose en puerto 3000
- [ ] Health check responde correctamente
- [ ] Extensión instalada en Chrome
- [ ] Conexión WebSocket establecida
- [ ] Configuración guardada
- [ ] Notificaciones de prueba funcionando
- [ ] Badge de la extensión muestra "ON"
- [ ] Logs del backend sin errores

### 7.2 Comandos de Verificación

```bash
# Backend funcionando
curl http://localhost:3000/health

# Logs sin errores
tail -f logs/app.log

# Puerto libre
netstat -tulpn | grep :3000

# Verificar procesos Node.js
ps aux | grep node
```

## 🐛 Solución de Problemas Comunes

### Backend no inicia

**Problema**: Error al iniciar el servidor
**Solución**:
```bash
# Verificar puerto libre
lsof -i :3000

# Verificar configuración
cat .env

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Extensión no se conecta

**Problema**: Estado "Desconectado" en la extensión
**Solución**:
1. Verificar que el backend esté ejecutándose
2. Comprobar la URL en configuración
3. Verificar permisos de notificación en Chrome
4. Revisar la consola del navegador (F12)

### No se reciben eventos

**Problema**: No llegan notificaciones de eventos
**Solución**:
1. Verificar credenciales de UniFi Protect
2. Comprobar conectividad de red
3. Revisar filtros configurados
4. Verificar logs del backend

### Notificaciones no aparecen

**Problema**: Las notificaciones no se muestran
**Solución**:
1. Verificar permisos de notificación en Chrome
2. Ir a `chrome://settings/content/notifications`
3. Asegurar que Chrome puede mostrar notificaciones
4. Probar con "Probar Notificación"

## 📞 Soporte Adicional

Si encuentras problemas:

1. **Revisa los logs**: `tail -f logs/app.log`
2. **Verifica la configuración**: Archivo `.env`
3. **Comprueba la consola**: F12 en Chrome
4. **Consulta la documentación**: README.md
5. **Reporta el problema**: Abre un issue en GitHub

## 🎉 ¡Listo!

¡Felicidades! Has instalado y configurado exitosamente el sistema de notificaciones de UniFi Protect. Ahora recibirás alertas en tiempo real de todos los eventos de tu sistema de seguridad.

### Próximos Pasos

- Configura notificaciones específicas por cámara
- Ajusta los filtros según tus necesidades
- Monitorea los logs para optimizar el rendimiento
- Considera configurar integraciones adicionales

---

**¿Necesitas ayuda?** Consulta la documentación completa en README.md o abre un issue en GitHub.
