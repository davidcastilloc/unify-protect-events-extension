// Script for the UniFi Protect extension popup
class PopupController {
  constructor() {
    this.stats = {
      totalEvents: 0,
      activeCameras: 0,
      notificationsSent: 0
    };
    
    // Instancia de AudioContext (debe ser creada al inicio, pero manejada para el desbloqueo)
    this.audioContext = null; 
    
    this.recentEvents = [];
    this.maxRecentEvents = 5;
    
    this.init();
  }

  async init() {
    console.log('🚀 Initializing popup');
    
    // Load initial state
    await this.loadInitialState();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateUI();
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }

  async loadInitialState() {
    try {
      // Get state from background script
      const response = await this.sendMessage({ type: 'getStatus' });
      
      if (response) {
        this.updateConnectionStatus(response);
      }
      
      // Load saved configuration
      const settings = await chrome.storage.sync.get([
        'notificationsEnabled',
        'soundEnabled',
        'eventFilters'
      ]);
      
      // Update toggles
      document.getElementById('notificationsToggle').checked = 
        settings.notificationsEnabled !== false;
      document.getElementById('soundToggle').checked = 
        settings.soundEnabled !== false;
      
      // Load statistics
      const savedStats = await chrome.storage.local.get(['stats']);
      if (savedStats.stats) {
        this.stats = { ...this.stats, ...savedStats.stats };
      }
      
      // Load recent events
      const savedEvents = await chrome.storage.local.get(['recentEvents']);
      if (savedEvents.recentEvents) {
        this.recentEvents = savedEvents.recentEvents;
      }
      
    } catch (error) {
      console.error('❌ Error loading initial state:', error);
    }
  }

  setupEventListeners() {
    // AÑADIR LISTENER CLAVE PARA DESBLOQUEAR EL AUDIO
    // Al hacer clic en cualquier parte del body, se inicia AudioContext
    document.body.addEventListener('click', this.unlockAudio.bind(this), { once: true });
    
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
    
    // Action buttons
    document.getElementById('optionsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    document.getElementById('testBtn').addEventListener('click', () => {
      this.testConnection();
    });
    
    // Listener for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message);
    });
  }

  /**
   * Intenta crear o reanudar el AudioContext al interactuar el usuario (para Autoplay Policy).
   */
  unlockAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('✅ AudioContext reanudado con éxito.');
      }).catch(error => {
        console.warn('⚠️ No se pudo reanudar AudioContext:', error);
      });
    }
    
    // Se elimina el listener automáticamente gracias a { once: true }
  }

  async connect() {
    try {
      const connectBtn = document.getElementById('connectBtn');
      
      connectBtn.disabled = true;
      connectBtn.textContent = 'Connecting...';
      
      const response = await this.sendMessage({ type: 'connect' });
      
      if (response && response.success) {
        this.updateConnectionStatus({ isConnected: true });
        this.showToast('Connected successfully', 'success');
      } else {
        this.showToast('Error connecting', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error connecting:', error);
      this.showToast('Error connecting: ' + error.message, 'error');
    } finally {
      const connectBtn = document.getElementById('connectBtn');
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    }
  }

  async disconnect() {
    try {
      const response = await this.sendMessage({ type: 'disconnect' });
      
      if (response && response.success) {
        this.updateConnectionStatus({ isConnected: false });
        this.showToast('Disconnected', 'info');
      }
      
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      this.showToast('Error disconnecting', 'error');
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
        enabled ? 'Notifications enabled' : 'Notifications disabled',
        'info'
      );
      
    } catch (error) {
      console.error('❌ Error updating notifications:', error);
    }
  }

  async toggleSound(enabled) {
    try {
      // SOLO guarda el estado en storage (el background script lo usará para enviar el mensaje playSound)
      await chrome.storage.sync.set({ soundEnabled: enabled });
      
      this.showToast(
        enabled ? 'Sound enabled' : 'Sound disabled',
        'info'
      );
      
    } catch (error) {
      console.error('❌ Error updating sound:', error);
    }
  }

  async testConnection() {
    try {
      const testBtn = document.getElementById('testBtn');
      
      testBtn.innerHTML = '<span class="btn-icon">⏳</span> Testing...';
      testBtn.disabled = true;
      
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await this.sendMessage({ type: 'getStatus' });
      
      if (response && response.isConnected) {
        this.showToast('Connection successful', 'success');
      } else {
        this.showToast('No connection', 'warning');
      }
      
    } catch (error) {
      console.error('❌ Error testing connection:', error);
      this.showToast('Test error', 'error');
    } finally {
      const testBtn = document.getElementById('testBtn');
      testBtn.innerHTML = '<span class="btn-icon">🧪</span> Test Connection';
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
      statusText.textContent = 'Connected';
      connectionStatus.textContent = 'Connected';
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Disconnected';
      connectionStatus.textContent = 'Disconnected';
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

  updateRecentEvents() {
    const eventsList = document.getElementById('eventsList');
    
    if (this.recentEvents.length === 0) {
      eventsList.innerHTML = `
        <div class="no-events">
          <div class="no-events-icon">📭</div>
          <p>No recent events</p>
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
    lastUpdate.textContent = now.toLocaleTimeString('en-US');
  }

  getEventTypeLabel(eventType) {
    const labels = {
      'motion': 'Motion',
      'person': 'Person',
      'vehicle': 'Vehicle',
      'package': 'Package',
      'doorbell': 'Doorbell',
      'smart_detect': 'Smart Detect',
      'sensor': 'Sensor'
    };
    
    return labels[eventType.toLowerCase()] || eventType;
  }

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
    
    if (diff < 60000) { // Less than 1 minute
      return 'Now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    } else {
      return date.toLocaleDateString('en-US');
    }
  }

  addRecentEvent(event) {
    this.recentEvents.unshift(event);
    
    // Keep only the most recent events
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(0, this.maxRecentEvents);
    }
    
    // Save to storage
    chrome.storage.local.set({ recentEvents: this.recentEvents });
    
    // Update UI
    this.updateRecentEvents();
  }

  updateStatsFromEvent(event) {
    this.stats.totalEvents++;
    this.stats.notificationsSent++;
    
    // Save to storage
    chrome.storage.local.set({ stats: this.stats });
    
    // Update UI
    this.updateStats();
  }

  /**
   * Genera y reproduce un simple tono (beep) usando el Web Audio API.
   */
  // playGenericBeep() {
  //   try {
  //     console.log("Pasa por aquí")
  //     // Si el audioContext no se ha inicializado o está suspendido, no sonará.
  //     if (!this.audioContext || this.audioContext.state === 'suspended') {
  //        console.warn('AudioContext no está activo. El beep no sonará. El usuario debe hacer clic primero.');
  //        return;
  //     }
      
  //     const audioContext = this.audioContext;
      
  //     // 2. Crear un oscilador (generador de tono)
  //     const oscillator = audioContext.createOscillator();
      
  //     // 3. Crear un nodo de ganancia (volumen)
  //     const gainNode = audioContext.createGain();
      
  //     // Conectar los nodos: Oscilador -> Ganancia -> Destino (altavoces)
  //     oscillator.connect(gainNode);
  //     gainNode.connect(audioContext.destination);
      
  //     // Configuración del tono
  //     oscillator.type = 'sine'; // Tipo de onda (seno para un tono limpio)
  //     oscillator.frequency.setValueAtTime(500, audioContext.currentTime); // 500 Hz
      
  //     // Configuración del volumen (evita que sea muy ruidoso)
  //     gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
  //     // Configuración de la duración del tono (0.2 segundos)
  //     oscillator.start(audioContext.currentTime);
  //     oscillator.stop(audioContext.currentTime + 0.2); 
      
  //     console.log('🔊 Beep genérico reproducido.');
      
  //   } catch (error) {
  //     console.error('❌ Error reproduciendo el beep:', error);
  //   }
  // }
  /**
   * Genera y reproduce un simple tono (beep) usando el Web Audio API.
   * Mejora: Se asegura de que el AudioContext esté activo.
   */
  playGenericBeep() {
    try {
      console.log("Pasa por aquí: Intentando reproducir beep.");
      
      // 1. Asegurar que el AudioContext existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // 2. Intentar reanudar el contexto (CRUCIAL para Autoplay Policy)
      // Esto intenta arreglarlo si se llamó sin un clic reciente.
      if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(() => {
              console.log('✅ AudioContext reanudado al intentar sonar.');
              // Llama a la reproducción nuevamente después de reanudar
              this._generateTone(this.audioContext);
          }).catch(error => {
              console.warn('⚠️ No se pudo reanudar AudioContext antes de sonar:', error);
          });
          return; // Sale de esta llamada, la reproducción ocurrirá en el .then()
      }
      
      // Si ya está 'running', genera el tono inmediatamente
      this._generateTone(this.audioContext);
      
    } catch (error) {
      console.error('❌ Error general al intentar reproducir el beep:', error);
    }
  }

  /**
   * Sub-función interna para generar el tono real.
   */
  _generateTone(audioContext) {
      // 2. Crear un oscilador (generador de tono)
      const oscillator = audioContext.createOscillator();
      
      // 3. Crear un nodo de ganancia (volumen)
      const gainNode = audioContext.createGain();
      
      // Conectar los nodos: Oscilador -> Ganancia -> Destino (altavoces)
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configuración del tono
      oscillator.type = 'sine'; // Tipo de onda (seno para un tono limpio)
      oscillator.frequency.setValueAtTime(500, audioContext.currentTime); // 500 Hz
      
      // Configuración del volumen (evita que sea muy ruidoso)
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      // Configuración de la duración del tono (0.2 segundos)
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2); 
      
      console.log('🔊 Beep genérico reproducido.');
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
        
      case 'playSound':
        // El background script nos pidió que reproduzcamos el sonido
        this.playGenericBeep(); 
        break;
        
      default:
        console.log('Unhandled message:', message);
    }
  }

  startPeriodicUpdates() {
    // Update state every 5 seconds
    setInterval(async () => {
      try {
        const response = await this.sendMessage({ type: 'getStatus' });
        if (response) {
          this.updateConnectionStatus(response);
        }
      } catch (error) {
        console.error('❌ Error updating state:', error);
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
    // Create temporary toast
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
    
    // Animate entry
    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);
    
    // Remove after 3 seconds
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

// Initialize popup when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});