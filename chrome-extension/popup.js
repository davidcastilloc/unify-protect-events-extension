// Script for the UniFi Protect extension popup
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
    console.log('🚀 Initializing popup');
    
    // Load initial state
    await this.loadInitialState();
    
    // Configure event listeners
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
    // Connection buttons with safe event handling
    this.safeAddEventListener('connectBtn', 'click', () => {
      this.connect();
    });
    
    this.safeAddEventListener('disconnectBtn', 'click', () => {
      this.disconnect();
    });
    
    // Toggles with safe event handling
    this.safeAddEventListener('notificationsToggle', 'change', (e) => {
      this.toggleNotifications(e.target.checked);
    });
    
    this.safeAddEventListener('soundToggle', 'change', (e) => {
      this.toggleSound(e.target.checked);
    });
    
    // Action buttons with safe event handling
    this.safeAddEventListener('optionsBtn', 'click', () => {
      try {
        chrome.runtime.openOptionsPage();
      } catch (error) {
        console.error('❌ Error opening options page:', error);
        this.showToast('Error opening options', 'error');
      }
    });
    
    this.safeAddEventListener('testBtn', 'click', () => {
      this.testConnection();
    });
    
    // Listener for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        this.handleBackgroundMessage(message);
      } catch (error) {
        console.error('❌ Error handling background message:', error);
      }
    });
  }

  // Safe event listener helper
  safeAddEventListener(elementId, eventType, handler) {
    try {
      const element = document.getElementById(elementId);
      if (element) {
        element.addEventListener(eventType, (e) => {
          try {
            handler(e);
          } catch (error) {
            console.error(`❌ Error in ${elementId} ${eventType} handler:`, error);
          }
        });
      } else {
        console.warn(`⚠️ Element with id '${elementId}' not found`);
      }
    } catch (error) {
      console.error(`❌ Error adding event listener to '${elementId}':`, error);
    }
  }

  // Centralized button state management
  updateButtonState(buttonId, state, options = {}) {
    try {
      const button = document.getElementById(buttonId);
      if (!button) {
        console.warn(`⚠️ Button with id '${buttonId}' not found`);
        return;
      }

      const defaultStates = {
        connect: {
          idle: { text: 'Connect', disabled: false, icon: '🔗' },
          loading: { text: 'Connecting...', disabled: true, icon: '⏳' },
          connected: { text: 'Connected', disabled: true, icon: '✅' },
          error: { text: 'Connect', disabled: false, icon: '❌' }
        },
        disconnect: {
          idle: { text: 'Disconnect', disabled: false, icon: '🔌' },
          loading: { text: 'Disconnecting...', disabled: true, icon: '⏳' },
          disconnected: { text: 'Disconnected', disabled: true, icon: '✅' },
          error: { text: 'Disconnect', disabled: false, icon: '❌' }
        },
        test: {
          idle: { text: 'Test Connection', disabled: false, icon: '🧪' },
          loading: { text: 'Testing...', disabled: true, icon: '⏳' },
          success: { text: 'Test Connection', disabled: false, icon: '✅' },
          error: { text: 'Test Connection', disabled: false, icon: '❌' }
        }
      };

      const buttonType = buttonId.replace('Btn', '').toLowerCase();
      const buttonStates = defaultStates[buttonType] || defaultStates.test;
      const buttonState = buttonStates[state] || buttonStates.idle;

      // Update button properties
      button.disabled = buttonState.disabled;
      
      // Update text content (preserve HTML structure if it exists)
      if (button.innerHTML.includes('<span class="btn-icon">')) {
        button.innerHTML = `<span class="btn-icon">${buttonState.icon}</span> ${buttonState.text}`;
      } else {
        button.textContent = buttonState.text;
      }

      // Apply custom options if provided
      if (options.customText) {
        if (button.innerHTML.includes('<span class="btn-icon">')) {
          button.innerHTML = `<span class="btn-icon">${options.icon || buttonState.icon}</span> ${options.customText}`;
        } else {
          button.textContent = options.customText;
        }
      }

      if (options.disabled !== undefined) {
        button.disabled = options.disabled;
      }

      console.log(`🔄 Button '${buttonId}' updated to state: ${state}`);
      
    } catch (error) {
      console.error(`❌ Error updating button '${buttonId}' state:`, error);
    }
  }

  async connect() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('connectBtn', 'loading');
    this.updateButtonState('disconnectBtn', 'idle', { disabled: true });
    
    try {
      const response = await this.sendMessage({ type: 'connect' });
      
      if (response && response.success) {
        // Success: Update to connected state
        this.updateButtonState('connectBtn', 'connected');
        this.updateButtonState('disconnectBtn', 'idle');
        this.updateConnectionStatus({ isConnected: true });
        this.showToast('Connected successfully', 'success');
      } else {
        // Revert optimistic UI on failure
        this.updateButtonState('connectBtn', 'error');
        this.updateButtonState('disconnectBtn', 'idle');
        this.showToast('Error connecting', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error connecting:', error);
      // Revert optimistic UI on error
      this.updateButtonState('connectBtn', 'error');
      this.updateButtonState('disconnectBtn', 'idle');
      this.showToast('Error connecting: ' + error.message, 'error');
    }
  }

  async disconnect() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('disconnectBtn', 'loading');
    this.updateButtonState('connectBtn', 'idle', { disabled: true });
    
    try {
      const response = await this.sendMessage({ type: 'disconnect' });
      
      if (response && response.success) {
        // Success: Update to disconnected state
        this.updateButtonState('disconnectBtn', 'disconnected');
        this.updateButtonState('connectBtn', 'idle');
        this.updateConnectionStatus({ isConnected: false });
        this.showToast('Disconnected', 'info');
      } else {
        // Revert optimistic UI on failure
        this.updateButtonState('disconnectBtn', 'error');
        this.updateButtonState('connectBtn', 'idle');
        this.showToast('Error disconnecting', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      // Revert optimistic UI on error
      this.updateButtonState('disconnectBtn', 'error');
      this.updateButtonState('connectBtn', 'idle');
      this.showToast('Error disconnecting', 'error');
    }
  }

  async toggleNotifications(enabled) {
    const toggle = document.getElementById('notificationsToggle');
    
    // Optimistic UI: Update UI immediately
    toggle.disabled = true;
    
    try {
      await this.sendMessage({ 
        type: 'toggleNotifications', 
        enabled: enabled 
      });
      
      await chrome.storage.sync.set({ notificationsEnabled: enabled });
      
      this.showToast(
        enabled ? 'Notifications enabled' : 'Notifications disabled',
        'success'
      );
      
    } catch (error) {
      console.error('❌ Error updating notifications:', error);
      // Revert optimistic UI on error
      toggle.checked = !enabled;
      this.showToast('Error updating notifications', 'error');
    } finally {
      // Re-enable toggle after operation
      toggle.disabled = false;
    }
  }

  async toggleSound(enabled) {
    const toggle = document.getElementById('soundToggle');
    
    // Optimistic UI: Update UI immediately
    toggle.disabled = true;
    
    try {
      await chrome.storage.sync.set({ soundEnabled: enabled });
      
      this.showToast(
        enabled ? 'Sound enabled' : 'Sound disabled',
        'success'
      );
      
    } catch (error) {
      console.error('❌ Error updating sound:', error);
      // Revert optimistic UI on error
      toggle.checked = !enabled;
      this.showToast('Error updating sound', 'error');
    } finally {
      // Re-enable toggle after operation
      toggle.disabled = false;
    }
  }

  async testConnection() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('testBtn', 'loading');
    
    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await this.sendMessage({ type: 'getStatus' });
      
      if (response && response.isConnected) {
        this.updateButtonState('testBtn', 'success');
        this.showToast('Connection successful', 'success');
        
        // Reset to idle state after showing success
        setTimeout(() => {
          this.updateButtonState('testBtn', 'idle');
        }, 2000);
      } else {
        this.updateButtonState('testBtn', 'error');
        this.showToast('No connection', 'warning');
        
        // Reset to idle state after showing error
        setTimeout(() => {
          this.updateButtonState('testBtn', 'idle');
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Error testing connection:', error);
      this.updateButtonState('testBtn', 'error');
      this.showToast('Test error', 'error');
      
      // Reset to idle state after showing error
      setTimeout(() => {
        this.updateButtonState('testBtn', 'idle');
      }, 2000);
    }
  }

  updateConnectionStatus(status) {
    try {
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      const connectionStatus = document.getElementById('connectionStatus');
      const serverUrl = document.getElementById('serverUrl');
      const clientId = document.getElementById('clientId');
      
      if (status.isConnected) {
        // Update status indicators
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = 'Connected';
        if (connectionStatus) connectionStatus.textContent = 'Connected';
        
        // Update button states using centralized system
        this.updateButtonState('connectBtn', 'connected');
        this.updateButtonState('disconnectBtn', 'idle');
      } else {
        // Update status indicators
        if (statusDot) statusDot.className = 'status-dot';
        if (statusText) statusText.textContent = 'Disconnected';
        if (connectionStatus) connectionStatus.textContent = 'Disconnected';
        
        // Update button states using centralized system
        this.updateButtonState('connectBtn', 'idle');
        this.updateButtonState('disconnectBtn', 'idle', { disabled: true });
      }
      
      // Update server info
      if (status.serverUrl && serverUrl) {
        serverUrl.textContent = status.serverUrl.replace('http://', '').replace('https://', '');
      }
      
      if (status.clientId && clientId) {
        clientId.textContent = status.clientId.substring(0, 8) + '...';
      }
      
    } catch (error) {
      console.error('❌ Error updating connection status:', error);
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
      return 'Now';
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
    
    // Animate entrance
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

// Inicializar el popup cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});