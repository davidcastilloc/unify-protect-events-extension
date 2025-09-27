interface NotificationConfig {
  backendUrl: string;
  clientId: string;
  enabled: boolean;
  filters: {
    types: string[];
    severity: string[];
    cameras: string[];
  };
}

interface UnifiEvent {
  id: string;
  type: string;
  severity: string;
  timestamp: string;
  camera: {
    id: string;
    name: string;
    type: string;
    location?: string;
  };
  description: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

class UnifiNotificationBackground {
  private ws: WebSocket | null = null;
  private config: NotificationConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 segundo inicial

  constructor() {
    this.config = {
      backendUrl: 'http://localhost:3000',
      clientId: `chrome-extension-${Date.now()}`,
      enabled: true,
      filters: {
        types: ['motion', 'person', 'vehicle', 'doorbell'],
        severity: ['low', 'medium', 'high', 'critical'],
        cameras: []
      }
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('Inicializando UniFi Protect Notifications...');
    
    // Cargar configuración guardada
    await this.loadConfig();
    
    // Configurar listeners de Chrome
    this.setupChromeListeners();
    
    // Conectar al WebSocket si está habilitado
    if (this.config.enabled) {
      await this.connectToBackend();
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['notificationConfig']);
      if (result.notificationConfig) {
        this.config = { ...this.config, ...result.notificationConfig };
        console.log('Configuración cargada:', this.config);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.sync.set({ notificationConfig: this.config });
      console.log('Configuración guardada');
    } catch (error) {
      console.error('Error guardando configuración:', error);
    }
  }

  private setupChromeListeners(): void {
    // Listener para mensajes desde popup/options
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Mantener canal abierto para respuesta asíncrona
    });

    // Listener para clics en notificaciones
    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });

    // Listener para cuando se instala/actualiza la extensión
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('Extensión instalada/actualizada:', details);
      this.showWelcomeNotification();
    });
  }

  private async handleMessage(message: any, sender: any, sendResponse: (response: any) => void): Promise<void> {
    switch (message.type) {
      case 'GET_CONFIG':
        sendResponse({ config: this.config });
        break;

      case 'UPDATE_CONFIG':
        this.config = { ...this.config, ...message.config };
        await this.saveConfig();
        
        // Reconectar si cambió la URL del backend
        if (message.config.backendUrl || message.config.enabled !== undefined) {
          await this.reconnect();
        }
        
        sendResponse({ success: true });
        break;

      case 'TEST_CONNECTION':
        const isConnected = await this.testConnection();
        sendResponse({ connected: isConnected });
        break;

      case 'GET_STATUS':
        sendResponse({
          connected: this.ws?.readyState === WebSocket.OPEN,
          config: this.config,
          reconnectAttempts: this.reconnectAttempts
        });
        break;
    }
  }

  private async connectToBackend(): Promise<void> {
    try {
      // Obtener token de autenticación
      const token = await this.getAuthToken();
      if (!token) {
        console.error('No se pudo obtener token de autenticación');
        return;
      }

      // Conectar al WebSocket
      const wsUrl = `${this.config.backendUrl.replace('http', 'ws')}/ws?token=${token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Conectado al backend UniFi Protect');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.updateBadge('ON', '#4CAF50');
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onclose = () => {
        console.log('Conexión WebSocket cerrada');
        this.updateBadge('OFF', '#F44336');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        this.updateBadge('ERR', '#FF9800');
      };

    } catch (error) {
      console.error('Error conectando al backend:', error);
      this.scheduleReconnect();
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.backendUrl}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId: this.config.clientId })
      });

      if (response.ok) {
        const data = await response.json();
        return data.token;
      } else {
        console.error('Error obteniendo token:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Error en request de token:', error);
      return null;
    }
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          console.log('Confirmación de conexión recibida');
          break;

        case 'notification':
          this.handleNotification(message.payload);
          break;

        case 'pong':
          // Respuesta a ping - conexión viva
          break;

        default:
          console.log('Mensaje WebSocket no reconocido:', message.type);
      }
    } catch (error) {
      console.error('Error procesando mensaje WebSocket:', error);
    }
  }

  private handleNotification(payload: any): void {
    const event: UnifiEvent = payload.event;
    
    // Aplicar filtros
    if (!this.shouldShowNotification(event)) {
      console.log(`Notificación filtrada para evento ${event.id}`);
      return;
    }

    // Crear notificación nativa
    this.createNotification(event);
  }

  private shouldShowNotification(event: UnifiEvent): boolean {
    const filters = this.config.filters;

    // Verificar tipo de evento
    if (filters.types.length > 0 && !filters.types.includes(event.type)) {
      return false;
    }

    // Verificar severidad
    if (filters.severity.length > 0 && !filters.severity.includes(event.severity)) {
      return false;
    }

    // Verificar cámaras específicas
    if (filters.cameras.length > 0 && !filters.cameras.includes(event.camera.id)) {
      return false;
    }

    return true;
  }

  private createNotification(event: UnifiEvent): void {
    const notificationId = `unifi-${event.id}`;
    const iconUrl = this.getEventIcon(event.type);
    
    const notificationOptions: chrome.notifications.NotificationOptions = {
      type: 'basic',
      iconUrl: iconUrl,
      title: `${event.camera.name} - ${this.getEventTitle(event.type)}`,
      message: `${event.description}\n${event.camera.location || 'Ubicación no especificada'}`,
      contextMessage: `Severidad: ${event.severity.toUpperCase()}`,
      buttons: [
        { title: 'Ver Detalles' },
        { title: 'Abrir Cámara' }
      ],
      requireInteraction: event.severity === 'critical',
      silent: event.severity === 'low'
    };

    chrome.notifications.create(notificationId, notificationOptions, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Error creando notificación:', chrome.runtime.lastError);
      } else {
        console.log(`Notificación creada: ${notificationId}`);
      }
    });
  }

  private getEventIcon(eventType: string): string {
    const icons = {
      motion: 'icons/motion.png',
      person: 'icons/person.png',
      vehicle: 'icons/vehicle.png',
      package: 'icons/package.png',
      doorbell: 'icons/doorbell.png',
      smart_detect: 'icons/smart-detect.png'
    };
    
    return icons[eventType as keyof typeof icons] || 'icons/icon48.png';
  }

  private getEventTitle(eventType: string): string {
    const titles = {
      motion: 'Movimiento Detectado',
      person: 'Persona Detectada',
      vehicle: 'Vehículo Detectado',
      package: 'Paquete Detectado',
      doorbell: 'Timbre Presionado',
      smart_detect: 'Detección Inteligente'
    };
    
    return titles[eventType as keyof typeof titles] || 'Evento Detectado';
  }

  private handleNotificationClick(notificationId: string): void {
    console.log('Notificación clickeada:', notificationId);
    
    // Aquí podrías abrir una página con detalles del evento
    // o abrir la interfaz de UniFi Protect
    chrome.notifications.clear(notificationId);
  }

  private updateBadge(text: string, color: string): void {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Máximo número de intentos de reconexión alcanzado');
      this.updateBadge('FAIL', '#F44336');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponencial
    
    console.log(`Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.config.enabled) {
        this.connectToBackend();
      }
    }, delay);
  }

  private async reconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.config.enabled) {
      await this.connectToBackend();
    }
  }

  private async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.backendUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private showWelcomeNotification(): void {
    chrome.notifications.create('welcome', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'UniFi Protect Notifications',
      message: 'Extensión instalada correctamente. Configura la conexión en las opciones.',
      buttons: [
        { title: 'Configurar' }
      ]
    });
  }
}

// Inicializar el service worker
new UnifiNotificationBackground();

