# UniFi Protect Notifications - Extensión de Chrome

Una extensión de Chrome que te permite recibir notificaciones en tiempo real de eventos de tu sistema UniFi Protect.

## 🚀 Características

- **Notificaciones en Tiempo Real**: Recibe notificaciones instantáneas cuando se detectan eventos en tus cámaras UniFi Protect
- **🎯 Popups Flotantes Interactivos**: Notificaciones visuales que aparecen en cualquier página web con diseño moderno
- **📱 Modal de Detalles**: Click en los popups para ver información completa del evento
- **🎨 Diseño por Severidad**: Colores y gradientes que cambian según la importancia del evento
- **⏰ Auto-cierre Inteligente**: Los popups se cierran automáticamente (excepto eventos críticos)
- **Filtros Personalizables**: Configura qué tipos de eventos quieres recibir (movimiento, persona, vehículo, paquete, timbre, etc.)
- **Filtros por Severidad**: Selecciona los niveles de severidad que te interesan (baja, media, alta, crítica)
- **Filtros por Cámara**: Elige recibir notificaciones solo de cámaras específicas
- **Sonidos Personalizados**: Diferentes sonidos para cada tipo de evento
- **Interfaz Intuitiva**: Popup fácil de usar con estadísticas en tiempo real
- **Configuración Avanzada**: Página de opciones completa para personalizar la experiencia

## 📋 Requisitos

- **Navegador**: Google Chrome o cualquier navegador basado en Chromium
- **Backend**: El servidor UniFi Protect Notifications debe estar ejecutándose
- **Permisos**: La extensión requiere permisos para notificaciones y acceso a la red local

## 🔧 Instalación

### Método 1: Instalación desde Archivos (Desarrollo)

1. **Descarga o clona el proyecto**:
   ```bash
   git clone <repository-url>
   cd unifi/chrome-extension
   ```

2. **Abre Chrome y ve a las extensiones**:
   - Abre Chrome
   - Ve a `chrome://extensions/`
   - Activa el "Modo de desarrollador" en la esquina superior derecha

3. **Carga la extensión**:
   - Haz clic en "Cargar extensión sin empaquetar"
   - Selecciona la carpeta `chrome-extension`
   - La extensión aparecerá en tu lista de extensiones

4. **Configura la extensión**:
   - Haz clic en el icono de la extensión en la barra de herramientas
   - Haz clic en "Configuración" para abrir la página de opciones
   - Configura la URL de tu servidor UniFi Protect

### Método 2: Instalación desde Chrome Web Store (Próximamente)

La extensión estará disponible en Chrome Web Store próximamente.

## ⚙️ Configuración

### Configuración del Servidor

1. **URL del Servidor**: Ingresa la URL completa de tu servidor UniFi Protect
   - Ejemplo: `http://192.168.1.100:3001`
   - Ejemplo: `https://tu-servidor.com:3001`

2. **Timeout de Conexión**: Configura el tiempo máximo para establecer conexión (5-60 segundos)

3. **Intentos de Reconexión**: Define cuántas veces intentar reconectar automáticamente (1-10)

### Configuración de Notificaciones

1. **Habilitar Notificaciones**: Activa/desactiva las notificaciones del navegador
2. **Habilitar Sonidos**: Activa/desactiva los sonidos de notificación
3. **Duración**: Configura cuánto tiempo permanece visible la notificación (3-30 segundos)
4. **Máximo Simultáneas**: Define cuántas notificaciones se pueden mostrar al mismo tiempo (1-10)

### Filtros de Eventos

#### Tipos de Eventos
- **Movimiento**: Detección de movimiento general
- **Persona**: Detección de personas
- **Vehículo**: Detección de vehículos
- **Paquete**: Detección de paquetes
- **Timbre**: Eventos del timbre
- **Detección Inteligente**: Eventos de detección inteligente
- **Sensor**: Eventos de sensores

#### Niveles de Severidad
- **Baja**: Eventos de baja prioridad
- **Media**: Eventos de prioridad media
- **Alta**: Eventos de alta prioridad
- **Crítica**: Eventos críticos que requieren atención inmediata

#### Filtros por Cámara
- Selecciona cámaras específicas para recibir notificaciones solo de esas fuentes
- Mantén presionado Ctrl (Cmd en Mac) para seleccionar múltiples cámaras

## 🎯 Uso

### Popup Principal

El popup de la extensión muestra:

- **Estado de Conexión**: Indica si estás conectado al servidor
- **Estadísticas**: Número total de eventos, cámaras activas y notificaciones enviadas
- **Eventos Recientes**: Lista de los últimos eventos detectados
- **Controles Rápidos**: Toggle para habilitar/deshabilitar notificaciones y sonidos

### Notificaciones

Las notificaciones incluyen:

- **Icono del Tipo de Evento**: Diferentes iconos para cada tipo de evento
- **Título Descriptivo**: Nombre del tipo de evento detectado
- **Descripción**: Detalles del evento y cámara que lo detectó
- **Timestamp**: Hora exacta del evento
- **Sonido**: Sonido específico según el tipo de evento

### 🎯 Popups Flotantes Interactivos

Los popups flotantes aparecen en la esquina superior derecha de cualquier página web:

#### Características Visuales
- **Posición**: Esquina superior derecha de la página
- **Tamaño**: 320px de ancho, altura adaptativa
- **Animaciones**: Entrada suave desde la derecha, salida suave
- **Colores**: Gradientes según la severidad del evento:
  - 🟢 **Verde**: Eventos de baja severidad
  - 🟡 **Naranja**: Eventos de severidad media
  - 🔴 **Rojo**: Eventos de alta severidad
  - 🟣 **Morado**: Eventos críticos

#### Funcionalidad Interactiva
- **Click en Header**: Abre modal con detalles completos del evento
- **Botón "Ver Detalles"**: Abre modal con información completa
- **Botón "Cerrar"**: Cierra el popup inmediatamente
- **Botón X**: Cierra el popup inmediatamente
- **Auto-cierre**: 10 segundos (excepto eventos críticos que permanecen hasta cerrar manualmente)

#### Modal de Detalles
El modal muestra información completa organizada en secciones:

- **Información General**: ID del evento, tipo, severidad, descripción
- **Información de Cámara**: Nombre, ID, modelo de la cámara
- **Información Temporal**: Timestamp formateado e ISO string
- **Diseño Responsivo**: Se adapta al tamaño de pantalla

### Página de Opciones

Accede a la configuración completa:

1. **Haz clic derecho** en el icono de la extensión
2. **Selecciona "Opciones"** del menú contextual
3. **O haz clic** en "Configuración" desde el popup

## 🧪 Pruebas y Diagnóstico

La página de opciones incluye herramientas de diagnóstico:

- **Probar Conexión**: Verifica la conectividad con el servidor
- **Probar Notificación**: Envía una notificación de prueba
- **Limpiar Historial**: Borra el historial de eventos local
- **Exportar/Importar Configuración**: Guarda y restaura configuraciones

## 🔧 Solución de Problemas

### No Recibo Notificaciones

1. **Verifica la conexión**:
   - Asegúrate de que el servidor esté ejecutándose
   - Comprueba que la URL del servidor sea correcta
   - Usa la función "Probar Conexión" en las opciones

2. **Verifica los permisos**:
   - Asegúrate de que Chrome tenga permisos para mostrar notificaciones
   - Ve a `chrome://settings/content/notifications` y permite notificaciones

3. **Verifica los filtros**:
   - Comprueba que los filtros de eventos estén configurados correctamente
   - Asegúrate de que las notificaciones estén habilitadas

### Problemas de Conexión

1. **Verifica la red**:
   - Asegúrate de que el servidor sea accesible desde tu navegador
   - Comprueba que no haya firewalls bloqueando la conexión

2. **Verifica la configuración del servidor**:
   - Asegúrate de que el servidor esté configurado correctamente
   - Comprueba los logs del servidor para errores

### La Extensión No Se Conecta

1. **Reinicia la extensión**:
   - Ve a `chrome://extensions/`
   - Desactiva y reactiva la extensión

2. **Verifica la configuración**:
   - Comprueba que la URL del servidor sea correcta
   - Asegúrate de que el servidor esté ejecutándose

## 📁 Estructura del Proyecto

```
chrome-extension/
├── manifest.json          # Configuración de la extensión
├── background.js          # Script de fondo (service worker)
├── content.js             # Content script para popups flotantes
├── popup.html            # Interfaz del popup
├── popup.css             # Estilos del popup
├── popup.js              # Lógica del popup
├── options.html          # Página de opciones
├── options.css           # Estilos de opciones
├── options.js            # Lógica de opciones
├── icons/                # Iconos de la extensión
│   ├── icon.svg          # Icono principal
│   ├── icon16.png        # Icono 16x16
│   ├── icon32.png        # Icono 32x32
│   ├── icon48.png        # Icono 48x48
│   ├── icon128.png       # Icono 128x128
│   ├── motion.svg        # Icono de movimiento
│   ├── person.svg        # Icono de persona
│   ├── vehicle.svg       # Icono de vehículo
│   ├── package.svg       # Icono de paquete
│   ├── doorbell.svg      # Icono de timbre
│   ├── smart-detect.svg  # Icono de detección inteligente
│   ├── sensor.svg        # Icono de sensor
│   └── *.png             # Versiones PNG de los iconos
└── README.md             # Este archivo
```

## 🔒 Permisos

La extensión requiere los siguientes permisos:

- **notifications**: Para mostrar notificaciones del sistema
- **storage**: Para guardar configuraciones y preferencias
- **activeTab**: Para interactuar con pestañas activas
- **scripting**: Para inyectar content scripts en páginas web
- **host_permissions**: Para conectarse al servidor UniFi Protect

## 🚀 Desarrollo

### Estructura del Código

- **Background Script**: Maneja la conexión WebSocket y envía eventos a content scripts
- **Content Script**: Se ejecuta en todas las páginas web y crea los popups flotantes
- **Popup**: Interfaz de usuario principal con estadísticas
- **Options**: Página de configuración completa
- **Icons**: Iconos SVG y PNG para diferentes tipos de eventos

### Arquitectura de Popups Flotantes

1. **Background Script**: Recibe eventos del servidor WebSocket y los envía a content scripts
2. **Content Script**: Se ejecuta en todas las páginas web y crea los popups flotantes
3. **Popup de Extensión**: Muestra estadísticas y controles de la extensión
4. **Modal de Detalles**: Se abre desde los popups para mostrar información completa

### Tecnologías Utilizadas

- **Manifest V3**: Última versión del sistema de extensiones de Chrome
- **WebSocket**: Comunicación en tiempo real con el servidor
- **Chrome APIs**: Notificaciones, almacenamiento y gestión de extensiones
- **CSS Grid/Flexbox**: Diseño responsivo moderno
- **ES6+**: JavaScript moderno con async/await

## 📝 Changelog

### v1.1.0
- **🎯 Popups Flotantes Interactivos**: Notificaciones visuales que aparecen en cualquier página web
- **📱 Modal de Detalles**: Click en popups para ver información completa del evento
- **🎨 Diseño por Severidad**: Colores y gradientes que cambian según la importancia
- **⏰ Auto-cierre Inteligente**: Popups se cierran automáticamente (excepto eventos críticos)
- **🔧 Content Script**: Nuevo sistema para mostrar popups en páginas web
- **📱 Diseño Responsivo**: Popups y modales se adaptan a diferentes tamaños de pantalla

### v1.0.0
- Lanzamiento inicial
- Soporte completo para notificaciones en tiempo real
- Filtros personalizables por tipo, severidad y cámara
- Interfaz de usuario moderna y responsiva
- Página de opciones completa
- Herramientas de diagnóstico y prueba

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](../LICENSE) para detalles.

## 👨‍💻 Autor

**David** - Desarrollador principal

## 🙏 Agradecimientos

- UniFi Protect por la API y documentación
- Comunidad de desarrolladores de extensiones de Chrome
- Todos los contribuidores y usuarios que reportan bugs y sugieren mejoras

---

**Nota**: Esta extensión requiere que el servidor backend UniFi Protect Notifications esté ejecutándose y configurado correctamente.
