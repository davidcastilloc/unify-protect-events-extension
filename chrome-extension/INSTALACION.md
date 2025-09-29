# 🚀 Guía de Instalación Rápida - UniFi Protect Notifications

## Instalación en 5 Pasos

### 1. Preparar el Backend
Asegúrate de que tu servidor UniFi Protect Notifications esté ejecutándose:
```bash
cd /home/davidc/unifi
npm run dev
```

### 2. Abrir Chrome Extensions
- Abre Google Chrome
- Ve a `chrome://extensions/`
- Activa el **"Modo de desarrollador"** (esquina superior derecha)

### 3. Cargar la Extensión
- Haz clic en **"Cargar extensión sin empaquetar"**
- Selecciona la carpeta: `/home/davidc/unifi/chrome-extension`
- La extensión aparecerá en tu lista

### 4. Configurar la Extensión
- Haz clic en el icono de la extensión en la barra de herramientas
- Haz clic en **"Configuración"**
- Configura la URL del servidor (por defecto: `http://localhost:3001`)

### 5. ¡Listo!
- Haz clic en **"Conectar"** en el popup
- ¡Recibirás notificaciones en tiempo real!

## 🔧 Configuración Rápida

### URL del Servidor
- **Local**: `http://localhost:3001`
- **Red Local**: `http://192.168.1.100:3001`
- **Remoto**: `https://tu-servidor.com:3001`

### Filtros Recomendados
- ✅ **Movimiento**: Para detectar actividad general
- ✅ **Persona**: Para detectar personas
- ✅ **Timbre**: Para eventos del timbre
- ✅ **Detección Inteligente**: Para eventos avanzados

## 🧪 Prueba Rápida

1. **Probar Conexión**: Usa el botón "Probar Conexión" en las opciones
2. **Probar Notificación**: Usa el botón "Probar Notificación"
3. **Generar Evento**: Muévete frente a una cámara o presiona el timbre

## ❗ Solución de Problemas Rápidos

### No Recibo Notificaciones
1. Verifica que el servidor esté ejecutándose
2. Comprueba la URL en las opciones
3. Asegúrate de que Chrome tenga permisos para notificaciones

### Error de Conexión
1. Verifica que la URL sea correcta
2. Comprueba que no haya firewalls bloqueando
3. Reinicia la extensión en `chrome://extensions/`

## 📱 Uso Diario

- **Popup**: Haz clic en el icono para ver estadísticas
- **Notificaciones**: Aparecerán automáticamente en tu sistema
- **Configuración**: Haz clic derecho en el icono → "Opciones"

¡Disfruta de tus notificaciones UniFi Protect! 🎉
