// Script para el popup de la extensión UniFi Protect
class PopupController {
  constructor() {
    this.stats = {
      totalEvents: 0,
      activeCameras: 0,
      notificationsSent: 0
    };
    
    this.recentEvents = [];
    this.maxRecentEvents = 5;
    
    this.init();
  }

  async init() {
    console.log('🚀 Inicializando popup');
    
    // Cargar estado inicial
    await this.loadInitialState();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Actualizar UI
    this.updateUI();
    
    // Iniciar actualizaciones periódicas
    this.startPeriodicUpdates();
  }

  async loadInitialState() {
    try {
      // Obtener estado del background script
      const response = await this.sendMessage({ type: 'getStatus' });
      
      if (response) {
        this.updateConnectionStatus(response);
      }
      
      // Cargar configuración guardada
      const settings = await chrome.storage.sync.get([
        'notificationsEnabled',
        'soundEnabled',
        'eventFilters'
      ]);
      
      // Actualizar toggles
      document.getElementById('notificationsToggle').checked = 
        settings.notificationsEnabled !== false;
      document.getElementById('soundToggle').checked = 
        settings.soundEnabled !== false;
      
      // Cargar estadísticas
      const savedStats = await chrome.storage.local.get(['stats']);
      if (savedStats.stats) {
        this.stats = { ...this.stats, ...savedStats.stats };
      }
      
      // Cargar eventos recientes
      const savedEvents = await chrome.storage.local.get(['recentEvents']);
      if (savedEvents.recentEvents) {
        this.recentEvents = savedEvents.recentEvents;
      }
      
    } catch (error) {
      console.error('❌ Error cargando estado inicial:', error);
    }
  }

  setupEventListeners() {
    // Botones de conexión
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connect();
    });
    
    document.getElementById('disconnectBtn').addEventListener('click', () => {
      this.disconnect();
    });
    
    // Toggles
    document.getElementById('notificationsToggle').addEventListener('change', (e) => {
      this.toggleNotifications(e.target.checked);
    });
    
    document.getElementById('soundToggle').addEventListener('change', (e) => {
      this.toggleSound(e.target.checked);
    });
    
    // Botones de acción
    document.getElementById('optionsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    document.getElementById('testBtn').addEventListener('click', () => {
      this.testConnection();
    });
    
    // Listener para mensajes del background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message);
    });
  }

  async connect() {
    try {
      const connectBtn = document.getElementById('connectBtn');
      
      connectBtn.disabled = true;
      connectBtn.textContent = 'Conectando...';
      
      const response = await this.sendMessage({ type: 'connect' });
      
      if (response && response.success) {
        this.updateConnectionStatus({ isConnected: true });
        this.showToast('Conectado exitosamente', 'success');
      } else {
        this.showToast('Error al conectar', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error conectando:', error);
      this.showToast('Error al conectar: ' + error.message, 'error');
    } finally {
      const connectBtn = document.getElementById('connectBtn');
      connectBtn.disabled = false;
      connectBtn.textContent = 'Conectar';
    }
  }

  async disconnect() {
    try {
      const response = await this.sendMessage({ type: 'disconnect' });
      
      if (response && response.success) {
        this.updateConnectionStatus({ isConnected: false });
        this.showToast('Desconectado', 'info');
      }
      
    } catch (error) {
      console.error('❌ Error desconectando:', error);
      this.showToast('Error al desconectar', 'error');
    }
  }

  async toggleNotifications(enabled) {
    try {
      await this.sendMessage({ 
        type: 'toggleNotifications', 
        enabled: enabled 
      });
      
      await chrome.storage.sync.set({ notificationsEnabled: enabled });
      
      this.showToast(
        enabled ? 'Notificaciones habilitadas' : 'Notificaciones deshabilitadas',
        'info'
      );
      
    } catch (error) {
      console.error('❌ Error actualizando notificaciones:', error);
    }
  }

  async toggleSound(enabled) {
    try {
      await chrome.storage.sync.set({ soundEnabled: enabled });
      
      this.showToast(
        enabled ? 'Sonido habilitado' : 'Sonido deshabilitado',
        'info'
      );
      
    } catch (error) {
      console.error('❌ Error actualizando sonido:', error);
    }
  }

  async testConnection() {
    try {
      const testBtn = document.getElementById('testBtn');
      const originalText = testBtn.innerHTML;
      
      testBtn.innerHTML = '<span class="btn-icon">⏳</span> Probando...';
      testBtn.disabled = true;
      
      // Simular prueba de conexión
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await this.sendMessage({ type: 'getStatus' });
      
      if (response && response.isConnected) {
        this.showToast('Conexión exitosa', 'success');
      } else {
        this.showToast('Sin conexión', 'warning');
      }
      
    } catch (error) {
      console.error('❌ Error probando conexión:', error);
      this.showToast('Error en la prueba', 'error');
    } finally {
      const testBtn = document.getElementById('testBtn');
      testBtn.innerHTML = '<span class="btn-icon">🧪</span> Probar Conexión';
      testBtn.disabled = false;
    }
  }

  updateConnectionStatus(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const connectionStatus = document.getElementById('connectionStatus');
    const serverUrl = document.getElementById('serverUrl');
    const clientId = document.getElementById('clientId');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    
    if (status.isConnected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Conectado';
      connectionStatus.textContent = 'Conectado';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Desconectado';
      connectionStatus.textContent = 'Desconectado';
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
    
    if (status.serverUrl) {
      serverUrl.textContent = status.serverUrl.replace('http://', '').replace('https://', '');
    }
    
    if (status.clientId) {
      clientId.textContent = status.clientId.substring(0, 8) + '...';
    }
  }

  updateUI() {
    this.updateStats();
    this.updateRecentEvents();
    this.updateLastUpdate();
  }

  updateStats() {
    document.getElementById('totalEvents').textContent = this.stats.totalEvents;
    document.getElementById('activeCameras').textContent = this.stats.activeCameras;
    document.getElementById('notificationsSent').textContent = this.stats.notificationsSent;
  }

  /**
   * ACTUALIZACIÓN CLAVE: Muestra la descripción y gravedad del evento.
   */
  updateRecentEvents() {
    const eventsList = document.getElementById('eventsList');
    
    if (this.recentEvents.length === 0) {
      eventsList.innerHTML = `
        <div class="no-events">
          <div class="no-events-icon">📭</div>
          <p>No hay eventos recientes</p>
        </div>
      `;
      return;
    }
    
    eventsList.innerHTML = this.recentEvents.map(event => `
      <div class="event-item severity-${event.severity.toLowerCase()}">
        <div class="event-header">
          <span class="event-icon">${this.getSeverityIcon(event.severity)}</span>
          <span class="event-type">${this.getEventTypeLabel(event.type)}</span>
          <span class="event-time">${this.formatTime(event.timestamp)}</span>
        </div>
        <div class="event-details">
          <div class="event-camera">${event.camera.name}</div>
          <div class="event-description">${event.description}</div>
        </div>
      </div>
    `).join('');
  }

  updateLastUpdate() {
    const lastUpdate = document.getElementById('lastUpdate');
    const now = new Date();
    lastUpdate.textContent = now.toLocaleTimeString('es-ES');
  }

  getEventTypeLabel(eventType) {
    const labels = {
      'motion': 'Movimiento',
      'person': 'Persona',
      'vehicle': 'Vehículo',
      'package': 'Paquete',
      'doorbell': 'Timbre',
      'smart_detect': 'Smart Detect',
      'sensor': 'Sensor'
    };
    
    return labels[eventType.toLowerCase()] || eventType;
  }

  /**
   * FUNCIÓN NUEVA: Retorna un ícono basado en la gravedad (severity) del evento.
   */
  getSeverityIcon(severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return '🚨';
      case 'HIGH':
        return '⚠️';
      case 'MEDIUM':
        return '🔸';
      case 'LOW':
        return '🔹';
      default:
        return 'ℹ️';
    }
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Menos de 1 minuto
      return 'Ahora';
    } else if (diff < 3600000) { // Menos de 1 hora
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    } else if (diff < 86400000) { // Menos de 1 día
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    } else {
      return date.toLocaleDateString('es-ES');
    }
  }

  addRecentEvent(event) {
    this.recentEvents.unshift(event);
    
    // Mantener solo los eventos más recientes
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxRecentEvents);
    }
    
    // Guardar en storage
    chrome.storage.local.set({ recentEvents: this.recentEvents });
    
    // Actualizar UI
    this.updateRecentEvents();
  }

  updateStatsFromEvent(event) {
    this.stats.totalEvents++;
    this.stats.notificationsSent++;
    
    // Guardar en storage
    chrome.storage.local.set({ stats: this.stats });
    
    // Actualizar UI
    this.updateStats();
  }

  handleBackgroundMessage(message) {
    switch (message.type) {
      case 'unifiEvent':
        this.addRecentEvent(message.event);
        this.updateStatsFromEvent(message.event);
        break;
        
      case 'status':
        this.updateConnectionStatus(message.data);
        break;
        
      default:
        console.log('Mensaje no manejado:', message);
    }
  }

  startPeriodicUpdates() {
    // Actualizar estado cada 5 segundos
    setInterval(async () => {
      try {
        const response = await this.sendMessage({ type: 'getStatus' });
        if (response) {
          this.updateConnectionStatus(response);
        }
      } catch (error) {
        console.error('❌ Error actualizando estado:', error);
      }
    }, 5000);
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  showToast(message, type = 'info') {
    // Crear toast temporal
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Remover después de 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Inicializar el popup cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});