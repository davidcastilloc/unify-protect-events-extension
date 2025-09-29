// Background script para la extensión de UniFi Protect
class UnifiProtectExtension {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.clientId = this.generateClientId();
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    
    this.init();
  }

  init() {
    console.log('🚀 Iniciando extensión UniFi Protect');
    
    // Cargar configuración guardada
    this.loadSettings();
    
    // Configurar listeners de eventos
    this.setupEventListeners();
    
    // Iniciar heartbeat para mantener conexión
    this.startHeartbeat();
    
    // Conectar al servidor
    this.connectToServer();
  }

  generateClientId() {
    return 'chrome-extension-' + Math.random().toString(36).substr(2, 9);
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'serverUrl',
        'notificationsEnabled',
        'eventFilters',
        'soundEnabled'
      ]);
      
      this.serverUrl = result.serverUrl || 'http://localhost:3001';
      this.notificationsEnabled = result.notificationsEnabled !== false;
      this.eventFilters = result.eventFilters || {
        enabled: true,
        types: ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart_detect', 'sensor'],
        severity: ['low', 'medium', 'high', 'critical'],
        cameras: []
      };
      this.soundEnabled = result.soundEnabled !== false;
      
      console.log('⚙️ Configuración cargada:', {
        serverUrl: this.serverUrl,
        notificationsEnabled: this.notificationsEnabled,
        soundEnabled: this.soundEnabled
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
          await this.connectToServer();
          sendResponse({ success: this.isConnected });
          break;

        case 'disconnect':
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
      
      // Obtener token de autenticación
      await this.getAuthToken();
      
      if (!this.token) {
        throw new Error('No se pudo obtener token de autenticación');
      }

      // Conectar WebSocket
      await this.connectWebSocket();
      
    } catch (error) {
      console.error('❌ Error conectando al servidor:', error);
      this.handleConnectionError(error);
    }
  }

  async getAuthToken() {
    try {
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
        
        this.ws.onopen = () => {
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
          console.log('🔌 WebSocket desconectado:', event.code, event.reason);
          this.isConnected = false;
          this.updateBadge('OFF', '#F44336');
          
          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
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

      switch (message.type) {
        case 'connected':
          console.log('✅ Conectado al servidor:', message.clientId);
          break;

        case 'event':
          this.handleUnifiEvent(message.data);
          break;

        case 'pong':
          console.log('🏓 Pong recibido');
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
    
    // Verificar si debemos mostrar notificación
    if (this.shouldShowNotification(event)) {
      this.showNotification(event);
    }
    
    // También enviar el evento a cualquier ventana abierta del popup
    this.broadcastEventToPopup(event);
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
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: iconUrl,
        title: title,
        message: message,
        contextMessage: event.camera.name,
        priority: this.getNotificationPriority(event.severity),
        requireInteraction: event.severity === 'critical'
      });

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
    const titleMap = {
      'motion': 'Movimiento Detectado',
      'person': 'Persona Detectada',
      'vehicle': 'Vehículo Detectado',
      'package': 'Paquete Detectado',
      'doorbell': 'Timbre Presionado',
      'smart_detect': 'Detección Inteligente',
      'sensor': 'Evento de Sensor'
    };
    
    return titleMap[event.type] || 'Evento UniFi';
  }

  getEventMessage(event) {
    const timestamp = new Date(event.timestamp).toLocaleString('es-ES');
    return `${event.description}\nCámara: ${event.camera.name}\nHora: ${timestamp}`;
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
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connectToServer();
      }
    }, delay);
  }

  handleConnectionError(error) {
    console.error('❌ Error de conexión:', error);
    this.updateBadge('ERR', '#FF9800');
    
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
    this.updateBadge('OFF', '#F44336');
    console.log('🔌 Desconectado del servidor');
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
}

// Inicializar la extensión
const unifiExtension = new UnifiProtectExtension();
