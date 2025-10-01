// Background script para la extensión de UniFi Protect
/**
 * TIPOS DE EVENTOS UNIFI (desde UnifiProtectClient.ts):
 * - 'motion': Movimiento detectado (cámara, sensor, luz)
 * - 'person': Persona detectada
 * - 'vehicle': Vehículo detectado
 * - 'package': Paquete detectado
 * - 'doorbell': Timbre presionado
 * - 'smart_detect': Detección inteligente (audio, zona, línea, merodeo)
 * - 'sensor': Eventos de sensores (batería baja, agua, alarma, apertura, cierre, etc.)
 * 
 * SEVERIDADES:
 * - 'low': Baja (< 50 score)
 * - 'medium': Media (50-69 score)
 * - 'high': Alta (70-89 score)
 * - 'critical': Crítica (>= 90 score)
 * 
 * ESTRUCTURA DEL EVENTO (UnifiEvent):
 * {
 *   id: string,
 *   type: EventType,
 *   severity: EventSeverity,
 *   timestamp: Date,
 *   camera: { id, name, type, location? },
 *   description: string,
 *   thumbnailUrl?: string,
 *   metadata?: { score, zone, audioType, batteryLevel, etc. }
 * }
 */
class UnifiProtectExtension {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.clientId = this.generateClientId();
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity; // Intentar reconectar siempre
    this.reconnectDelay = 5000;
    this.connectionEnabled = true; // Por defecto, mantener conexión activa
    
    this.init();
  }

  async init() {
    console.log('🚀 Iniciando extensión UniFi Protect (Service Worker)');
    
    // Cargar configuración guardada
    await this.loadSettings();
    
    // Configurar listeners de eventos
    this.setupEventListeners();
    
    // Configurar alarmas para mantener service worker activo
    this.setupKeepAlive();
    
    // Iniciar heartbeat para mantener conexión WebSocket
    this.startHeartbeat();
    
    // Conectar automáticamente si estaba conectado antes
    if (this.connectionEnabled) {
      console.log('🔄 Auto-conectando al servidor...');
      setTimeout(() => this.connectToServer(), 1000); // Dar tiempo para que se cargue todo
    }
  }

  generateClientId() {
    return 'chrome-extension-' + Math.random().toString(36).substr(2, 9);
  }

  async loadSettings() {
    try {
      const syncResult = await chrome.storage.sync.get([
        'serverUrl',
        'notificationsEnabled',
        'eventFilters',
        'soundEnabled'
      ]);
      
      const localResult = await chrome.storage.local.get([
        'connectionEnabled'
      ]);
      
      this.serverUrl = syncResult.serverUrl || 'http://localhost:3001';
      this.notificationsEnabled = syncResult.notificationsEnabled !== false;
      this.eventFilters = syncResult.eventFilters || {
        enabled: true,
        types: ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart_detect', 'sensor'],
        severity: ['low', 'medium', 'high', 'critical'],
        cameras: []
      };
      this.soundEnabled = syncResult.soundEnabled !== false;
      this.connectionEnabled = localResult.connectionEnabled !== false; // Por defecto true
      
      console.log('⚙️ Configuración cargada:', {
        serverUrl: this.serverUrl,
        notificationsEnabled: this.notificationsEnabled,
        soundEnabled: this.soundEnabled,
        connectionEnabled: this.connectionEnabled
      });
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
    }
  }

  setupEventListeners() {
    // Listener para mensajes del popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Mantener el canal abierto para respuesta asíncrona
    });

    // Listener para cuando se instala la extensión
    chrome.runtime.onInstalled.addListener(() => {
      console.log('📦 Extensión instalada');
      this.showWelcomeNotification();
    });

    // Listener para notificaciones clickeadas
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    // Listener para cuando se inicia el service worker
    chrome.runtime.onStartup.addListener(() => {
      console.log('🚀 Service worker iniciado - reconectando...');
      this.reconnectIfNeeded();
    });

    // Listener para alarmas (mantener service worker activo)
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'keepAlive') {
        console.log('⏰ Keep-alive alarm triggered');
        this.checkConnection();
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'getStatus':
          sendResponse({
            isConnected: this.isConnected,
            clientId: this.clientId,
            serverUrl: this.serverUrl
          });
          break;

        case 'connect':
          this.connectionEnabled = true;
          await chrome.storage.local.set({ connectionEnabled: true });
          await this.connectToServer();
          sendResponse({ success: this.isConnected });
          break;

        case 'disconnect':
          this.connectionEnabled = false;
          await chrome.storage.local.set({ connectionEnabled: false });
          this.disconnect();
          sendResponse({ success: true });
          break;

        case 'updateFilters':
          this.eventFilters = message.filters;
          await chrome.storage.sync.set({ eventFilters: this.eventFilters });
          this.sendFiltersToServer();
          sendResponse({ success: true });
          break;

        case 'toggleNotifications':
          this.notificationsEnabled = message.enabled;
          await chrome.storage.sync.set({ notificationsEnabled: this.notificationsEnabled });
          sendResponse({ success: true });
          break;

        case 'getCameras':
          const cameras = await this.getCameras();
          sendResponse({ cameras });
          break;

        default:
          sendResponse({ error: 'Tipo de mensaje no reconocido' });
      }
    } catch (error) {
      console.error('❌ Error manejando mensaje:', error);
      sendResponse({ error: error.message });
    }
  }

  async connectToServer() {
    try {
      console.log('🔗 Conectando al servidor...');
      
      // Verificar si el servidor está disponible antes de obtener token
      if (!await this.isServerAvailable()) {
        throw new Error('El servidor no está disponible');
      }
      
      // Obtener token de autenticación solo si es necesario
      if (!this.token) {
        await this.getAuthToken();
        
        if (!this.token) {
          throw new Error('No se pudo obtener token de autenticación');
        }
      }

      // Conectar WebSocket
      await this.connectWebSocket();
      
    } catch (error) {
      console.error('❌ Error conectando al servidor:', error);
      this.handleConnectionError(error);
    }
  }

  async isServerAvailable() {
    try {
      console.log('🔍 Verificando disponibilidad del servidor...');
      
      // Hacer una petición simple para verificar si el servidor responde
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        timeout: 5000 // 5 segundos de timeout
      });
      
      const isAvailable = response.ok;
      console.log(isAvailable ? '✅ Servidor disponible' : '❌ Servidor no disponible');
      return isAvailable;
      
    } catch (error) {
      console.log('❌ Servidor no disponible:', error.message);
      return false;
    }
  }

  async getAuthToken() {
    try {
      console.log('🔑 Obteniendo token de autenticación...');
      
      const response = await fetch(`${this.serverUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId: this.clientId })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.token;
      console.log('🔑 Token obtenido exitosamente');
      
    } catch (error) {
      console.error('❌ Error obteniendo token:', error);
      throw error;
    }
  }

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.serverUrl.replace('http', 'ws')}/ws?token=${this.token}`;
        console.log('🔌 Conectando WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        // Configurar timeout de conexión
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log('⏰ Timeout de conexión WebSocket');
            this.ws.close();
            reject(new Error('Timeout de conexión WebSocket'));
          }
        }, 10000); // 10 segundos de timeout
        
        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket conectado');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.updateBadge('ON', '#4CAF50');
          
          // Enviar filtros al servidor
          this.sendFiltersToServer();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('🔌 WebSocket desconectado:', event.code, event.reason);
          this.isConnected = false;
          this.updateBadge('OFF', '#F44336');
          
          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ Error en WebSocket:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  handleWebSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('📨 Mensaje recibido:', message);

      // Lista de tipos de eventos válidos de UniFi
      const validEventTypes = ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart_detect', 'sensor'];

      switch (message.type) {
        case 'connected':
          console.log('✅ Conectado al servidor');
          // No procesar 'connected' como evento, solo logging
          break;

        case 'event':
          this.handleUnifiEvent(message.data);
          break;

        case 'pong':
          console.log('🏓 Pong recibido');
          // No procesar 'pong' como evento, solo logging
          break;

        case 'motion':
        case 'person':
        case 'vehicle':
        case 'package':
        case 'doorbell':
        case 'smart_detect':
        case 'sensor':
          // Eventos en formato simple que vienen directamente del backend
          console.log('📦 Evento en formato simple recibido:', message.type);
          this.handleUnifiEvent(message);
          break;

        default:
          console.log('❓ Tipo de mensaje desconocido:', message.type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
    }
  }

  handleUnifiEvent(event) {
    console.log('🎯 Evento UniFi recibido:', event);
    
    // Normalizar el evento para asegurarnos de que tenga el formato correcto
    const normalizedEvent = this.normalizeEvent(event);
    console.log('✅ Evento normalizado:', normalizedEvent);
    
    // Verificar si debemos mostrar notificación
    if (this.shouldShowNotification(normalizedEvent)) {
      this.showNotification(normalizedEvent);
    }
    
    // Enviar el evento a content scripts para popup flotante
    this.sendEventToContentScript(normalizedEvent);
    
    // También enviar el evento a cualquier ventana abierta del popup
    this.broadcastEventToPopup(normalizedEvent);
  }

  normalizeEvent(event) {
    // Asegurarse de que el evento tenga el formato correcto
    // El timestamp puede venir como Date o como string ISO del servidor
    const timestamp = event.timestamp instanceof Date 
      ? event.timestamp 
      : new Date(event.timestamp);
    
    // Verificar si es un evento en formato simple (nuevo formato)
    // En formato simple, los campos adicionales están en metadata
    const isSimpleFormat = !event.id && event.metadata;
    
    if (isSimpleFormat) {
      // Formato simple: extraer datos de metadata
      return {
        id: event.metadata.id || `event-${Date.now()}`,
        type: event.type,
        severity: event.metadata.severity || 'medium',
        timestamp: timestamp,
        camera: {
          id: event.metadata.cameraId || 'unknown',
          name: event.camera.name,
          type: event.metadata.cameraType || 'unknown',
          location: event.metadata.cameraLocation
        },
        description: event.metadata.description || `Evento ${event.type} detectado`,
        thumbnailUrl: event.metadata.thumbnailUrl,
        metadata: event.metadata || {}
      };
    } else {
      // Formato completo (legacy o eventos viejos)
      return {
        id: event.id || `event-${Date.now()}`,
        type: event.type,
        severity: event.severity || 'medium',
        timestamp: timestamp,
        camera: {
          id: event.camera.id || 'unknown',
          name: event.camera.name,
          type: event.camera.type || 'unknown',
          location: event.camera.location
        },
        description: event.description || `Evento ${event.type} detectado`,
        thumbnailUrl: event.thumbnailUrl,
        metadata: event.metadata || {}
      };
    }
  }

  shouldShowNotification(event) {
    if (!this.notificationsEnabled) {
      return false;
    }

    const filters = this.eventFilters;
    
    // Verificar si las notificaciones están habilitadas
    if (!filters.enabled) {
      return false;
    }

    // Verificar tipo de evento
    if (filters.types && filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Verificar severidad
    if (filters.severity && filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      return false;
    }

    // Verificar cámaras específicas
    if (filters.cameras && filters.cameras.length > 0 && !filters.cameras.includes(event.camera.id)) {
      return false;
    }

    return true;
  }

  async showNotification(event) {
    try {
      const iconUrl = this.getEventIcon(event.type);
      const title = this.getEventTitle(event);
      const message = this.getEventMessage(event);
      
      const notificationId = `unifi-event-${event.id}`;
      
      // Mostrar notificación del sistema
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: iconUrl,
        title: title,
        message: message,
        contextMessage: event.camera.name,
        priority: this.getNotificationPriority(event.severity),
        requireInteraction: event.severity === 'critical'
      });

      // Enviar evento al content script para mostrar popup flotante
      this.sendEventToContentScript(event);

      // Reproducir sonido si está habilitado
      if (this.soundEnabled) {
        this.playNotificationSound(event.type);
      }

      console.log('🔔 Notificación mostrada:', notificationId);
      
    } catch (error) {
      console.error('❌ Error mostrando notificación:', error);
    }
  }

  getEventIcon(eventType) {
    const iconMap = {
      'motion': 'icons/motion.png',
      'person': 'icons/person.png',
      'vehicle': 'icons/vehicle.png',
      'package': 'icons/package.png',
      'doorbell': 'icons/doorbell.png',
      'smart_detect': 'icons/smart-detect.png',
      'sensor': 'icons/sensor.png'
    };
    
    return iconMap[eventType] || 'icons/icon48.png';
  }

  getEventTitle(event) {
    // Títulos base para cada tipo
    const titleMap = {
      'motion': 'Movimiento Detectado',
      'person': 'Persona Detectada',
      'vehicle': 'Vehículo Detectado',
      'package': 'Paquete Detectado',
      'doorbell': 'Timbre Presionado',
      'smart_detect': 'Detección Inteligente',
      'sensor': 'Evento de Sensor'
    };
    
    let title = titleMap[event.type] || 'Evento UniFi';
    
    // Agregar contexto adicional según los metadatos
    if (event.metadata) {
      // Para smart detect, especificar el tipo
      if (event.type === 'smart_detect') {
        if (event.metadata.audioType) {
          title = `Audio: ${event.metadata.audioType}`;
        } else if (event.metadata.zone) {
          title = 'Detección en Zona';
        } else if (event.metadata.line) {
          title = 'Línea Cruzada';
        } else if (event.metadata.duration) {
          title = 'Merodeo Detectado';
        }
      }
      
      // Para sensores, especificar el subtipo
      if (event.type === 'sensor') {
        if (event.metadata.batteryLevel !== undefined) {
          title = 'Batería Baja';
        } else if (event.metadata.alarmType) {
          title = 'Alarma Activada';
        } else if (event.description.includes('agua')) {
          title = 'Fuga de Agua';
        } else if (event.description.includes('manipulación')) {
          title = 'Sensor Manipulado';
        }
      }
    }
    
    // Agregar indicador de severidad para eventos críticos
    if (event.severity === 'critical') {
      title = '🚨 ' + title;
    } else if (event.severity === 'high') {
      title = '⚠️ ' + title;
    }
    
    return title;
  }

  getEventMessage(event) {
    // El timestamp ya está normalizado como Date object
    const timestamp = event.timestamp.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    let message = event.description;
    
    // Agregar información adicional según el tipo de evento
    if (event.metadata) {
      if (event.metadata.score) {
        message += `\nConfianza: ${Math.round(event.metadata.score)}%`;
      }
      if (event.metadata.audioType) {
        message += `\nTipo de audio: ${event.metadata.audioType}`;
      }
      if (event.metadata.zone) {
        message += `\nZona: ${event.metadata.zone}`;
      }
      if (event.metadata.batteryLevel !== undefined) {
        message += `\nBatería: ${event.metadata.batteryLevel}%`;
      }
    }
    
    message += `\n\nCámara: ${event.camera.name}`;
    if (event.camera.location) {
      message += `\nUbicación: ${event.camera.location}`;
    }
    message += `\nHora: ${timestamp}`;
    
    return message;
  }

  getNotificationPriority(severity) {
    const priorityMap = {
      'low': 0,
      'medium': 1,
      'high': 2,
      'critical': 2
    };
    
    return priorityMap[severity] || 1;
  }

  playNotificationSound(eventType) {
    // Crear un audio context para reproducir sonidos
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Diferentes frecuencias según el tipo de evento
      const frequencyMap = {
        'doorbell': 800,
        'person': 600,
        'vehicle': 500,
        'motion': 400,
        'sensor': 300
      };
      
      oscillator.frequency.setValueAtTime(frequencyMap[eventType] || 500, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
    } catch (error) {
      console.error('❌ Error reproduciendo sonido:', error);
    }
  }

  handleNotificationClick(notificationId) {
    console.log('👆 Notificación clickeada:', notificationId);
    
    // Abrir la página de UniFi Protect o el popup
    chrome.action.openPopup();
  }

  sendFiltersToServer() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'update_filters',
        filters: this.eventFilters
      };
      
      this.ws.send(JSON.stringify(message));
      console.log('📤 Filtros enviados al servidor');
    }
  }

  async getCameras() {
    try {
      const response = await fetch(`${this.serverUrl}/api/cameras`);
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const cameras = await response.json();
      console.log('📹 Cámaras obtenidas:', cameras);
      return cameras;
      
    } catch (error) {
      console.error('❌ Error obteniendo cámaras:', error);
      return [];
    }
  }

  scheduleReconnect() {
    // Solo reconectar si la conexión está habilitada
    if (!this.connectionEnabled) {
      console.log('🚫 Reconexión deshabilitada por el usuario');
      return;
    }
    
    this.reconnectAttempts++;
    
    // Backoff exponencial con límite máximo
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000 // Máximo 60 segundos
    );
    
    console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      // Verificar si todavía se debe mantener la conexión
      if (!this.connectionEnabled) {
        console.log('🚫 Conexión deshabilitada, cancelando reconexión');
        return;
      }
      
      // Verificar disponibilidad del servidor antes de reconectar
      if (await this.isServerAvailable()) {
        try {
          await this.connectToServer();
        } catch (error) {
          console.error('❌ Error en reconexión:', error);
          this.scheduleReconnect();
        }
      } else {
        console.log('⏳ Servidor no disponible, esperando antes del siguiente intento...');
        this.scheduleReconnect();
      }
    }, delay);
  }

  handleConnectionError(error) {
    console.error('❌ Error de conexión:', error);
    this.updateBadge('ERR', '#FF9800');
    
    // Limpiar token si hay errores de autenticación
    if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
      this.clearToken();
    }
    
    // Mostrar notificación de error
    chrome.notifications.create('connection-error', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Error de Conexión UniFi',
      message: `No se pudo conectar al servidor: ${error.message}`,
      priority: 1
    });
  }

  updateBadge(text, color) {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Desconexión intencional');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.clearToken(); // Limpiar token al desconectar
    this.updateBadge('OFF', '#F44336');
    console.log('🔌 Desconectado del servidor');
  }

  clearToken() {
    this.token = null;
    console.log('🗑️ Token limpiado');
  }

  showWelcomeNotification() {
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'UniFi Protect Notifications',
      message: 'Extensión instalada correctamente. Configura el servidor en las opciones.',
      priority: 0
    });
  }

  broadcastEventToPopup(event) {
    // Enviar evento a todas las ventanas abiertas del popup
    chrome.runtime.sendMessage({
      type: 'unifiEvent',
      event: event
    }).catch(() => {
      // Ignorar errores si no hay popup abierto
    });
  }

  // Método para mantener la conexión activa
  startHeartbeat() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, 30000); // Ping cada 30 segundos
  }

  sendEventToContentScript(event) {
    try {
      console.log('📤 Enviando evento a content script:', event);
      // Enviar mensaje a todas las pestañas activas
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'showPopup',
            event: event
          }).catch(error => {
            // Ignorar errores si no hay content script en la pestaña
            console.log('No se pudo enviar mensaje a la pestaña:', tab.id, error.message);
          });
        });
      });
      
      console.log('📤 Evento enviado a content scripts para mostrar popup:', event.id);
      
    } catch (error) {
      console.error('❌ Error enviando evento a content script:', error);
    }
  }

  // Configurar alarma para mantener service worker activo
  setupKeepAlive() {
    console.log('⏰ Configurando alarma keep-alive para mantener service worker activo');
    
    // Crear alarma que se ejecuta cada 25 segundos (antes de que Chrome suspenda el service worker)
    chrome.alarms.create('keepAlive', {
      periodInMinutes: 0.4 // ~24 segundos (mínimo permitido es 0.4 min en Chrome)
    });
  }

  // Verificar y reconectar si es necesario
  async checkConnection() {
    console.log('🔍 Verificando estado de conexión...');
    
    // Si la conexión está deshabilitada, no hacer nada
    if (!this.connectionEnabled) {
      console.log('🚫 Conexión deshabilitada');
      return;
    }
    
    // Si no está conectado, intentar reconectar
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('🔄 Conexión perdida, reconectando...');
      try {
        await this.connectToServer();
      } catch (error) {
        console.error('❌ Error al reconectar:', error);
      }
    } else {
      console.log('✅ Conexión activa');
    }
  }

  // Reconectar si estaba conectado antes
  async reconnectIfNeeded() {
    console.log('🔄 Verificando si se necesita reconectar...');
    
    // Cargar configuración primero
    await this.loadSettings();
    
    // Si la conexión estaba habilitada, reconectar
    if (this.connectionEnabled) {
      console.log('🔗 Reconectando al servidor...');
      setTimeout(() => this.connectToServer(), 2000); // Esperar 2 segundos antes de reconectar
    } else {
      console.log('🚫 Conexión no estaba habilitada, no reconectar');
    }
  }

}

// Inicializar la extensión
const unifiExtension = new UnifiProtectExtension();
