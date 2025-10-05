// Background script for the UniFi Protect extension
/**
 * TIPOS DE EVENTOS UNIFI (desde UnifiProtectClient.ts):
 * - 'motion': Motion detected (camera, sensor, light)
 * - 'person': Person detected
 * - 'vehicle': Vehicle detected
 * - 'package': Package detected
 * - 'doorbell': Doorbell pressed
 * - 'smart_detect': Smart detection (audio, zone, line, loitering)
 * - 'sensor': Sensor events (low battery, water, alarm, open, close, etc.)
 * 
 * SEVERIDADES:
 * - 'low': Low (< 50 score)
 * - 'medium': Medium (50-69 score)
 * - 'high': High (70-89 score)
 * - 'critical': Critical (>= 90 score)
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
    this.maxReconnectAttempts = Infinity; // Always try to reconnect
    this.reconnectDelay = 5000;
    this.connectionEnabled = true; // By default, keep connection active
    
    this.init();
  }

  async init() {
    console.log('🚀 Starting UniFi Protect extension (Service Worker)');
    
    // Load saved configuration
    await this.loadSettings();
    
    // Configure event listeners
    this.setupEventListeners();
    
    // Configure alarms to keep service worker active
    this.setupKeepAlive();
    
    // Start heartbeat to maintain WebSocket connection
    this.startHeartbeat();
    
    // Connect automatically if it was connected before
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
      
      console.log('⚙️ Configuration loaded:', {
        serverUrl: this.serverUrl,
        notificationsEnabled: this.notificationsEnabled,
        soundEnabled: this.soundEnabled,
        connectionEnabled: this.connectionEnabled
      });
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
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
      console.log('📦 Extension installed');
      this.showWelcomeNotification();
    });

    // Listener para notificaciones clickeadas
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    // Listener para cuando las notificaciones se cierran
    chrome.notifications.onClosed.addListener((notificationId, byUser) => {
      console.log('🔔 Notification closed:', notificationId, 'byUser:', byUser);
      // Clear timeout if notification is closed before auto-close
      if (this.notificationTimeouts && this.notificationTimeouts.has(notificationId)) {
        clearTimeout(this.notificationTimeouts.get(notificationId));
        this.notificationTimeouts.delete(notificationId);
        console.log('🔔 Notification timeout cleared:', notificationId);
      }
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
      console.log('🔗 Connecting to server...');
      
      // Verificar si el servidor está disponible antes de obtener token
      if (!await this.isServerAvailable()) {
        throw new Error('Server is not available');
      }
      
      // Obtener token de autenticación solo si es necesario
      if (!this.token) {
        await this.getAuthToken();
        
        if (!this.token) {
          throw new Error('Could not obtain authentication token');
        }
      }

      // Connect WebSocket
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
      console.log(isAvailable ? '✅ Server available' : '❌ Server not available');
      return isAvailable;
      
    } catch (error) {
      console.log('❌ Server not available:', error.message);
      return false;
    }
  }

  async getAuthToken() {
    try {
      console.log('🔑 Obtaining authentication token...');
      
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
        console.log('🔌 Connecting WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        // Configurar timeout de conexión
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log('⏰ WebSocket connection timeout');
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 segundos de timeout
        
        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket conectado');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.updateBadge('ON', '#4CAF50');
          
          // Send filters to server
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
          
          // Try to reconnect if it was not an intentional closure
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
      console.log('📨 Message received:', message);

      // List of valid UniFi event types
      const validEventTypes = ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart_detect', 'sensor'];

      switch (message.type) {
        case 'connected':
          console.log('✅ Connected to server');
          // Don't process 'connected' as event, just logging
          break;

        case 'event':
          this.handleUnifiEvent(message.data);
          break;

        case 'pong':
          console.log('🏓 Pong received');
          // Don't process 'pong' as event, just logging
          break;

        case 'motion':
        case 'person':
        case 'vehicle':
        case 'package':
        case 'doorbell':
        case 'smart_detect':
        case 'sensor':
          // Simple format events coming directly from backend
          console.log('📦 Simple format event received:', message.type);
          this.handleUnifiEvent(message);
          break;

        default:
          console.log('❓ Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
    }
  }

  handleUnifiEvent(event) {
    console.log('🎯 UniFi event received:', event);
    
    // Normalize the event to ensure it has the correct format
    const normalizedEvent = this.normalizeEvent(event);
    console.log('✅ Event normalized:', normalizedEvent);
    
    // Check if we should show notification
    if (this.shouldShowNotification(normalizedEvent)) {
      this.showNotification(normalizedEvent);
    }
    
    // Send the event to content scripts for floating popup
    this.sendEventToContentScript(normalizedEvent);
    
    // Also send the event to any open popup window
    this.broadcastEventToPopup(normalizedEvent);
  }

  normalizeEvent(event) {
    // Asegurarse de que el evento tenga el formato correcto
    // El timestamp puede venir como Date o como string ISO del servidor
    const timestamp = event.timestamp instanceof Date 
      ? event.timestamp 
      : new Date(event.timestamp);
    
    // Check if it is a simple format event (new format)
    // In simple format, additional fields are in metadata
    const isSimpleFormat = !event.id && event.metadata;
    
    if (isSimpleFormat) {
      // Simple format: extract data from metadata
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
        description: event.metadata.description || `${event.type} event detected`,
        thumbnailUrl: event.metadata.thumbnailUrl,
        metadata: event.metadata || {}
      };
    } else {
      // Full format (legacy or old events)
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
        description: event.description || `${event.type} event detected`,
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
    
    // Check if notifications are enabled
    if (!filters.enabled) {
      return false;
    }

    // Check event type
    if (filters.types && filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Check severity
    if (filters.severity && filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      return false;
    }

    // Check specific cameras
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
      
      // Show system notification
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: iconUrl,
        title: title,
        message: message,
        contextMessage: event.camera.name,
        priority: this.getNotificationPriority(event.severity),
        requireInteraction: event.severity === 'critical'
      });

      // Send event to content script to show floating popup
      this.sendEventToContentScript(event);

      // Audio is now handled by HTML5 audio in popups for 100% reliability
      // This ensures the security guard is always alerted with guaranteed sound
      console.log('🔊 Audio will be played via HTML5 audio in popup for guaranteed playback');

      console.log('🔔 Notification shown:', notificationId);
      
      // Auto-close notification after 5 seconds (except for critical events)
      if (event.severity !== 'critical') {
        const notificationTimeout = setTimeout(async () => {
          try {
            await chrome.notifications.clear(notificationId);
            console.log('🔔 Notification auto-closed:', notificationId);
          } catch (error) {
            console.log('Notification already closed or not found:', notificationId);
          }
        }, 5000); // 5 seconds
        
        // Store timeout reference for potential cleanup
        this.notificationTimeouts = this.notificationTimeouts || new Map();
        this.notificationTimeouts.set(notificationId, notificationTimeout);
      }
      
    } catch (error) {
      console.error('❌ Error showing notification:', error);
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
    // Base titles for each type
    const titleMap = {
      'motion': 'Movimiento Detectado',
      'person': 'Persona Detectada',
      'vehicle': 'Vehicle Detected',
      'package': 'Paquete Detectado',
      'doorbell': 'Timbre Presionado',
      'smart_detect': 'Smart Detection',
      'sensor': 'Evento de Sensor'
    };
    
    let title = titleMap[event.type] || 'Evento UniFi';
    
    // Add additional context based on metadata
    if (event.metadata) {
      // For smart detect, specify the type
      if (event.type === 'smart_detect') {
        if (event.metadata.audioType) {
          title = `Audio: ${event.metadata.audioType}`;
        } else if (event.metadata.zone) {
          title = 'Zone Detection';
        } else if (event.metadata.line) {
          title = 'Line Crossed';
        } else if (event.metadata.duration) {
          title = 'Merodeo Detectado';
        }
      }
      
      // For sensors, specify the subtype
      if (event.type === 'sensor') {
        if (event.metadata.batteryLevel !== undefined) {
          title = 'Low Battery';
        } else if (event.metadata.alarmType) {
          title = 'Alarma Activada';
        } else if (event.description.includes('water')) {
          title = 'Water Leak';
        } else if (event.description.includes('manipulation')) {
          title = 'Sensor Tampered';
        }
      }
    }
    
    // Add severity indicator for critical events
    if (event.severity === 'critical') {
      title = '🚨 ' + title;
    } else if (event.severity === 'high') {
      title = '⚠️ ' + title;
    }
    
    return title;
  }

  getEventMessage(event) {
    // The timestamp is already normalized as Date object
    const timestamp = event.timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    let message = event.description;
    
    // Add additional information based on event type
    if (event.metadata) {
      if (event.metadata.score) {
        message += `\nConfidence: ${Math.round(event.metadata.score)}%`;
      }
      if (event.metadata.audioType) {
        message += `\nAudio type: ${event.metadata.audioType}`;
      }
      if (event.metadata.zone) {
        message += `\nZone: ${event.metadata.zone}`;
      }
      if (event.metadata.batteryLevel !== undefined) {
        message += `\nBattery: ${event.metadata.batteryLevel}%`;
      }
    }
    
    message += `\n\nCamera: ${event.camera.name}`;
    if (event.camera.location) {
      message += `\nLocation: ${event.camera.location}`;
    }
    message += `\nTime: ${timestamp}`;
    
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
    // Create audio context for security alert sounds
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Security-focused frequency mapping - more distinctive sounds
      const frequencyMap = {
        'doorbell': 1000,    // High priority - clear bell sound
        'person': 800,       // Person detected - attention-grabbing
        'vehicle': 600,      // Vehicle - medium priority
        'motion': 500,       // General motion - standard alert
        'sensor': 400,       // Sensor events - lower priority
        'package': 700,      // Package delivery - distinct
        'smart_detect': 900  // Smart detection - high priority
      };
      
      const frequency = frequencyMap[eventType] || 500;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'square'; // More attention-grabbing than sine
      
      // Increased volume for security awareness (0.2 instead of 0.1)
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.05, audioContext.currentTime + 0.8);
      
      // Longer duration for better awareness (0.8 seconds instead of 0.5)
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.8);
      
      console.log(`🔊 Security alert sound played: ${eventType} (${frequency}Hz)`);
      
    } catch (error) {
      console.error('❌ Error playing notification sound:', error);
      // Fallback: try to play system notification sound
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OSdTgwOUarm7blmGgU7k9n0unEiBS13yO/eizEIHWq+8+OWT');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Fallback audio also failed:', e));
      } catch (fallbackError) {
        console.error('Fallback audio failed:', fallbackError);
      }
    }
  }

  handleNotificationClick(notificationId) {
    console.log('👆 Notification clicked:', notificationId);
    
    // Clear timeout if notification is clicked before auto-close
    if (this.notificationTimeouts && this.notificationTimeouts.has(notificationId)) {
      clearTimeout(this.notificationTimeouts.get(notificationId));
      this.notificationTimeouts.delete(notificationId);
      console.log('🔔 Notification timeout cleared:', notificationId);
    }
    
    // Open UniFi Protect page or popup
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
      console.log('📹 Cameras obtained:', cameras);
      return cameras;
      
    } catch (error) {
      console.error('❌ Error getting cameras:', error);
      return [];
    }
  }

  scheduleReconnect() {
    // Only reconnect if connection is enabled
    if (!this.connectionEnabled) {
      console.log('🚫 Reconnection disabled by user');
      return;
    }
    
    this.reconnectAttempts++;
    
    // Exponential backoff with maximum limit
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      60000 // Maximum 60 seconds
    );
    
    console.log(`🔄 Retrying connection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      // Check if connection should still be maintained
      if (!this.connectionEnabled) {
        console.log('🚫 Connection disabled, canceling reconnection');
        return;
      }
      
      // Check server availability before reconnecting
      if (await this.isServerAvailable()) {
        try {
          await this.connectToServer();
        } catch (error) {
          console.error('❌ Error in reconnection:', error);
          this.scheduleReconnect();
        }
      } else {
        console.log('⏳ Server not available, waiting before next attempt...');
        this.scheduleReconnect();
      }
    }, delay);
  }

  handleConnectionError(error) {
    console.error('❌ Connection error:', error);
    this.updateBadge('ERR', '#FF9800');
    
    // Clear token if there are authentication errors
    if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('401') || error.message.includes('403')) {
      this.clearToken();
    }
    
    // Show error notification
    chrome.notifications.create('connection-error', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'UniFi Connection Error',
      message: `Could not connect to server: ${error.message}`,
      priority: 1
    });
    
    // Always play error sound for security awareness
    this.playNotificationSound('sensor'); // Use sensor sound for errors
  }

  updateBadge(text, color) {
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: color });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Intentional disconnection');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.clearToken(); // Clear token when disconnecting
    this.updateBadge('OFF', '#F44336');
    console.log('🔌 Disconnected from server');
  }

  clearToken() {
    this.token = null;
    console.log('🗑️ Token cleared');
  }

  showWelcomeNotification() {
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'UniFi Protect Notifications',
      message: 'Extension installed correctly. Configure the server in options.',
      priority: 0
    });
    
    // Play welcome sound (gentle tone)
    this.playNotificationSound('motion'); // Use motion sound for welcome (gentle)
  }

  broadcastEventToPopup(event) {
    // Send event to all open popup windows
    chrome.runtime.sendMessage({
      type: 'unifiEvent',
      event: event
    }).catch(() => {
      // Ignore errors if no popup is open
    });
  }

  // Method to keep connection active
  startHeartbeat() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, 30000); // Ping every 30 seconds
  }

  sendEventToContentScript(event) {
    try {
      console.log('📤 Sending event to content script:', event);
      // Send message to all active tabs
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'showPopup',
            event: event
          }).catch(error => {
            // Ignore errors if there's no content script in the tab
            console.log('Could not send message to tab:', tab.id, error.message);
          });
        });
      });
      
      console.log('📤 Event sent to content scripts to show popup:', event.id);
      
    } catch (error) {
      console.error('❌ Error sending event to content script:', error);
    }
  }

  // Configure alarm to keep service worker active
  setupKeepAlive() {
    console.log('⏰ Configuring keep-alive alarm to keep service worker active');
    
    // Create alarm that runs every 25 seconds (before Chrome suspends the service worker)
    chrome.alarms.create('keepAlive', {
      periodInMinutes: 0.4 // ~24 seconds (minimum allowed is 0.4 min in Chrome)
    });
  }

  // Check and reconnect if necessary
  async checkConnection() {
    console.log('🔍 Checking connection status...');
    
    // If connection is disabled, do nothing
    if (!this.connectionEnabled) {
      console.log('🚫 Connection disabled');
      return;
    }
    
    // If not connected, try to reconnect
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('🔄 Connection lost, reconnecting...');
      try {
        await this.connectToServer();
      } catch (error) {
        console.error('❌ Error reconnecting:', error);
      }
    } else {
      console.log('✅ Connection active');
    }
  }

  // Reconnect if it was connected before
  async reconnectIfNeeded() {
    console.log('🔄 Checking if reconnection is needed...');
    
    // Load configuration first
    await this.loadSettings();
    
    // If connection was enabled, reconnect
    if (this.connectionEnabled) {
      console.log('🔗 Reconnecting to server...');
      setTimeout(() => this.connectToServer(), 2000); // Wait 2 seconds before reconnecting
    } else {
      console.log('🚫 Connection was not enabled, not reconnecting');
    }
  }

}

// Initialize the extension
const unifiExtension = new UnifiProtectExtension();
