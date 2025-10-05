// Script for the UniFi Protect extension options page
class OptionsController {
  constructor() {
    this.defaultSettings = {
      serverUrl: 'http://localhost:3001',
      connectionTimeout: 30,
      reconnectAttempts: 5,
      notificationsEnabled: true,
      soundEnabled: true,
      notificationDuration: 5,
      maxNotifications: 5,
      filtersEnabled: true,
      eventTypes: {
        motion: true,
        person: true,
        vehicle: true,
        package: true,
        doorbell: true,
        smart_detect: true,
        sensor: true
      },
      severityLevels: {
        low: true,
        medium: true,
        high: true,
        critical: true
      },
      selectedCameras: [],
      debugMode: false,
      autoReconnect: true,
      heartbeatInterval: 30,
      eventHistorySize: 50
    };
    
    this.init();
  }

  async init() {
    console.log('🚀 Initializing options page');
    
    // Load saved configuration
    await this.loadSettings();
    
    // Configure event listeners
    this.setupEventListeners();
    
    // Load available cameras
    await this.loadCameras();
    
    // Update UI
    this.updateUI();
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(Object.keys(this.defaultSettings));
      
      // Apply loaded configuration or use default values
      Object.keys(this.defaultSettings).forEach(key => {
        if (settings[key] !== undefined) {
          this.defaultSettings[key] = settings[key];
        }
      });
      
      console.log('⚙️ Configuration loaded:', this.defaultSettings);
      
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      this.showToast('Error loading configuration', 'error');
    }
  }

  setupEventListeners() {
    // Main buttons with safe event handling
    this.safeAddEventListener('saveBtn', 'click', () => {
      this.saveSettings();
    });
    
    this.safeAddEventListener('resetBtn', 'click', () => {
      this.resetSettings();
    });
    
    // Test buttons with safe event handling
    this.safeAddEventListener('testConnectionBtn', 'click', () => {
      this.testConnection();
    });
    
    this.safeAddEventListener('testNotificationBtn', 'click', () => {
      this.testNotification();
    });
    
    this.safeAddEventListener('clearHistoryBtn', 'click', () => {
      this.clearHistory();
    });
    
    this.safeAddEventListener('exportConfigBtn', 'click', () => {
      this.exportConfig();
    });
    
    this.safeAddEventListener('importConfigBtn', 'click', () => {
      this.importConfig();
    });
    
    // Footer links with safe event handling
    this.safeAddEventListener('helpLink', 'click', (e) => {
      e.preventDefault();
      this.showHelp();
    });
    
    this.safeAddEventListener('feedbackLink', 'click', (e) => {
      e.preventDefault();
      this.showFeedback();
    });
    
    // File input for importing with safe event handling
    this.safeAddEventListener('importFileInput', 'change', (e) => {
      try {
        this.handleImportFile(e.target.files[0]);
      } catch (error) {
        console.error('❌ Error handling file import:', error);
        this.showToast('Error importing file', 'error');
      }
    });
    
    // Auto-save on changes
    this.setupAutoSave();
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
            this.showToast(`Error in ${elementId} action`, 'error');
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
        testconnection: {
          idle: { text: 'Test Connection', disabled: false, icon: '🧪' },
          loading: { text: 'Testing...', disabled: true, icon: '⏳' },
          success: { text: 'Connection OK', disabled: false, icon: '✅' },
          error: { text: 'Test Connection', disabled: false, icon: '❌' }
        },
        testnotification: {
          idle: { text: 'Test Notification', disabled: false, icon: '🔔' },
          loading: { text: 'Testing...', disabled: true, icon: '⏳' },
          success: { text: 'Notification Sent', disabled: false, icon: '✅' },
          error: { text: 'Test Notification', disabled: false, icon: '❌' }
        },
        clearhistory: {
          idle: { text: 'Clear History', disabled: false, icon: '🗑️' },
          loading: { text: 'Clearing...', disabled: true, icon: '⏳' },
          success: { text: 'History Cleared', disabled: false, icon: '✅' },
          error: { text: 'Clear History', disabled: false, icon: '❌' }
        },
        exportconfig: {
          idle: { text: 'Export Config', disabled: false, icon: '📤' },
          loading: { text: 'Exporting...', disabled: true, icon: '⏳' },
          success: { text: 'Config Exported', disabled: false, icon: '✅' },
          error: { text: 'Export Config', disabled: false, icon: '❌' }
        }
      };

      const buttonType = buttonId.replace('Btn', '').toLowerCase();
      const buttonStates = defaultStates[buttonType] || defaultStates.testconnection;
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

  setupAutoSave() {
    // Auto-save when values change
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.debounce(() => {
          this.saveSettings(false); // false = don't show toast
        }, 1000)();
      });
    });
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  updateUI() {
    // Server configuration
    document.getElementById('serverUrl').value = this.defaultSettings.serverUrl;
    document.getElementById('connectionTimeout').value = this.defaultSettings.connectionTimeout;
    document.getElementById('reconnectAttempts').value = this.defaultSettings.reconnectAttempts;
    
    // Notification configuration
    document.getElementById('notificationsEnabled').checked = this.defaultSettings.notificationsEnabled;
    document.getElementById('soundEnabled').checked = this.defaultSettings.soundEnabled;
    document.getElementById('notificationDuration').value = this.defaultSettings.notificationDuration;
    document.getElementById('maxNotifications').value = this.defaultSettings.maxNotifications;
    
    // Filtros de eventos
    document.getElementById('filtersEnabled').checked = this.defaultSettings.filtersEnabled;
    
    // Tipos de eventos
    Object.keys(this.defaultSettings.eventTypes).forEach(type => {
      const checkbox = document.getElementById(`filter${type.charAt(0).toUpperCase() + type.slice(1)}`);
      if (checkbox) {
        checkbox.checked = this.defaultSettings.eventTypes[type];
      }
    });
    
    // Niveles de severidad
    Object.keys(this.defaultSettings.severityLevels).forEach(level => {
      const checkbox = document.getElementById(`filter${level.charAt(0).toUpperCase() + level.slice(1)}`);
      if (checkbox) {
        checkbox.checked = this.defaultSettings.severityLevels[level];
      }
    });
    
    // Advanced configuration
    document.getElementById('debugMode').checked = this.defaultSettings.debugMode;
    document.getElementById('autoReconnect').checked = this.defaultSettings.autoReconnect;
    document.getElementById('heartbeatInterval').value = this.defaultSettings.heartbeatInterval;
    document.getElementById('eventHistorySize').value = this.defaultSettings.eventHistorySize;
  }

  async loadCameras() {
    try {
      const serverUrl = this.defaultSettings.serverUrl;
      const response = await fetch(`${serverUrl}/api/cameras`);
      
      if (response.ok) {
        const cameras = await response.json();
        this.populateCameraSelect(cameras);
      } else {
        this.addTestResult('Could not load cameras from server', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error loading cameras:', error);
      this.addTestResult('Error connecting to server to get cameras', 'error');
    }
  }

  populateCameraSelect(cameras) {
    const select = document.getElementById('cameraFilter');
    select.innerHTML = '<option value="">All cameras</option>';
    
    cameras.forEach(camera => {
      const option = document.createElement('option');
      option.value = camera.id;
      option.textContent = camera.name;
      option.selected = this.defaultSettings.selectedCameras.includes(camera.id);
      select.appendChild(option);
    });
  }

  async saveSettings(showToast = true) {
    try {
      const settings = this.collectFormData();
      
      await chrome.storage.sync.set(settings);
      
      // Send updated configuration to background script
      await this.sendMessageToBackground({
        type: 'updateSettings',
        settings: settings
      });
      
      if (showToast) {
        this.showToast('Configuration saved successfully', 'success');
      }
      
      console.log('💾 Configuration saved:', settings);
      
    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      this.showToast('Error saving configuration', 'error');
    }
  }

  collectFormData() {
    const settings = {
      serverUrl: document.getElementById('serverUrl').value,
      connectionTimeout: parseInt(document.getElementById('connectionTimeout').value),
      reconnectAttempts: parseInt(document.getElementById('reconnectAttempts').value),
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      soundEnabled: document.getElementById('soundEnabled').checked,
      notificationDuration: parseInt(document.getElementById('notificationDuration').value),
      maxNotifications: parseInt(document.getElementById('maxNotifications').value),
      filtersEnabled: document.getElementById('filtersEnabled').checked,
      eventTypes: {
        motion: document.getElementById('filterMotion').checked,
        person: document.getElementById('filterPerson').checked,
        vehicle: document.getElementById('filterVehicle').checked,
        package: document.getElementById('filterPackage').checked,
        doorbell: document.getElementById('filterDoorbell').checked,
        smart_detect: document.getElementById('filterSmartDetect').checked,
        sensor: document.getElementById('filterSensor').checked
      },
      severityLevels: {
        low: document.getElementById('filterLow').checked,
        medium: document.getElementById('filterMedium').checked,
        high: document.getElementById('filterHigh').checked,
        critical: document.getElementById('filterCritical').checked
      },
      selectedCameras: Array.from(document.getElementById('cameraFilter').selectedOptions)
        .map(option => option.value)
        .filter(value => value !== ''),
      debugMode: document.getElementById('debugMode').checked,
      autoReconnect: document.getElementById('autoReconnect').checked,
      heartbeatInterval: parseInt(document.getElementById('heartbeatInterval').value),
      eventHistorySize: parseInt(document.getElementById('eventHistorySize').value)
    };
    
    return settings;
  }

  async resetSettings() {
    if (confirm('Are you sure you want to restore all default values?')) {
      try {
        await chrome.storage.sync.clear();
        this.defaultSettings = { ...this.defaultSettings };
        this.updateUI();
        this.showToast('Configuration restored to default values', 'info');
      } catch (error) {
        console.error('❌ Error restoring configuration:', error);
        this.showToast('Error restoring configuration', 'error');
      }
    }
  }

  async testConnection() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('testConnectionBtn', 'loading');
    
    try {
      const serverUrl = document.getElementById('serverUrl').value;
      
      // Validate URL before making request
      if (!serverUrl || !serverUrl.trim()) {
        throw new Error('Server URL is required');
      }
      
      const response = await fetch(`${serverUrl}/health`, {
        method: 'GET',
        timeout: 10000 // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        this.updateButtonState('testConnectionBtn', 'success');
        this.addTestResult(`✅ Connection successful - Connected clients: ${data.clients}`, 'success');
        
        // Reset to idle state after showing success
        setTimeout(() => {
          this.updateButtonState('testConnectionBtn', 'idle');
        }, 2000);
      } else {
        this.updateButtonState('testConnectionBtn', 'error');
        this.addTestResult(`❌ HTTP Error: ${response.status} ${response.statusText}`, 'error');
        
        // Reset to idle state after showing error
        setTimeout(() => {
          this.updateButtonState('testConnectionBtn', 'idle');
        }, 2000);
      }
      
    } catch (error) {
      console.error('❌ Connection test error:', error);
      this.updateButtonState('testConnectionBtn', 'error');
      this.addTestResult(`❌ Connection error: ${error.message}`, 'error');
      
      // Reset to idle state after showing error
      setTimeout(() => {
        this.updateButtonState('testConnectionBtn', 'idle');
      }, 2000);
    }
  }

  async testNotification() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('testNotificationBtn', 'loading');
    
    try {
      await chrome.notifications.create('test-notification', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Test Notification',
        message: 'This is a test notification from UniFi Protect',
        priority: 1
      });
      
      this.updateButtonState('testNotificationBtn', 'success');
      this.addTestResult('✅ Test notification sent', 'success');
      
      // Reset to idle state after showing success
      setTimeout(() => {
        this.updateButtonState('testNotificationBtn', 'idle');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Notification test error:', error);
      this.updateButtonState('testNotificationBtn', 'error');
      this.addTestResult(`❌ Error sending notification: ${error.message}`, 'error');
      
      // Reset to idle state after showing error
      setTimeout(() => {
        this.updateButtonState('testNotificationBtn', 'idle');
      }, 2000);
    }
  }

  async clearHistory() {
    if (confirm('Are you sure you want to clear all event history?')) {
      // Optimistic UI: Update UI immediately
      this.updateButtonState('clearHistoryBtn', 'loading');
      
      try {
        await chrome.storage.local.remove(['recentEvents', 'stats']);
        this.updateButtonState('clearHistoryBtn', 'success');
        this.addTestResult('✅ History cleared successfully', 'success');
        
        // Reset to idle state after showing success
        setTimeout(() => {
          this.updateButtonState('clearHistoryBtn', 'idle');
        }, 2000);
        
      } catch (error) {
        console.error('❌ Clear history error:', error);
        this.updateButtonState('clearHistoryBtn', 'error');
        this.addTestResult(`❌ Error clearing history: ${error.message}`, 'error');
        
        // Reset to idle state after showing error
        setTimeout(() => {
          this.updateButtonState('clearHistoryBtn', 'idle');
        }, 2000);
      }
    }
  }

  exportConfig() {
    // Optimistic UI: Update UI immediately
    this.updateButtonState('exportConfigBtn', 'loading');
    
    try {
      const config = this.collectFormData();
      const configJson = JSON.stringify(config, null, 2);
      
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'unifi-protect-config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.updateButtonState('exportConfigBtn', 'success');
      this.addTestResult('✅ Configuration exported successfully', 'success');
      
      // Reset to idle state after showing success
      setTimeout(() => {
        this.updateButtonState('exportConfigBtn', 'idle');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Export config error:', error);
      this.updateButtonState('exportConfigBtn', 'error');
      this.addTestResult(`❌ Error exporting configuration: ${error.message}`, 'error');
      
      // Reset to idle state after showing error
      setTimeout(() => {
        this.updateButtonState('exportConfigBtn', 'idle');
      }, 2000);
    }
  }

  importConfig() {
    document.getElementById('importFileInput').click();
  }

  async handleImportFile(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      // Validate configuration
      if (this.validateConfig(config)) {
        // Apply configuration
        Object.assign(this.defaultSettings, config);
        this.updateUI();
        
        // Save configuration
        await chrome.storage.sync.set(config);
        
        this.addTestResult('✅ Configuration imported successfully', 'success');
      } else {
        this.addTestResult('❌ Invalid configuration file', 'error');
      }
      
    } catch (error) {
      this.addTestResult(`❌ Error importing configuration: ${error.message}`, 'error');
    }
  }

  validateConfig(config) {
    // Basic validations
    const requiredFields = ['serverUrl', 'notificationsEnabled', 'soundEnabled'];
    
    for (const field of requiredFields) {
      if (!(field in config)) {
        return false;
      }
    }
    
    // Validate server URL
    try {
      new URL(config.serverUrl);
    } catch {
      return false;
    }
    
    return true;
  }

  showHelp() {
    const helpContent = `
      <h3>Help - UniFi Protect Notifications</h3>
      <h4>Server Configuration:</h4>
      <p>Enter the complete URL of your UniFi Protect server (e.g.: http://192.168.1.100:3001)</p>
      
      <h4>Event Filters:</h4>
      <p>Select which types of events you want to receive. You can filter by event type, severity and specific cameras.</p>
      
      <h4>Notifications:</h4>
      <p>Notifications will appear on your operating system when events are detected according to your configured filters.</p>
      
      <h4>Troubleshooting:</h4>
      <p>If you don't receive notifications, verify that the server is running and that the URL is correct.</p>
    `;
    
    this.showModal('Help', helpContent);
  }

  showFeedback() {
    const feedbackContent = `
      <h3>Send Feedback</h3>
      <p>Do you have suggestions or found a problem?</p>
      <p>Send an email to: <a href="mailto:feedback@example.com">feedback@example.com</a></p>
      <p>Or create an issue in the project repository.</p>
    `;
    
    this.showModal('Feedback', feedbackContent);
  }

  showModal(title, content) {
    // Create simple modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    modalContent.innerHTML = `
      <h2>${title}</h2>
      <div style="margin-top: 16px;">${content}</div>
      <button onclick="this.closest('.modal').remove()" 
              style="margin-top: 16px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
        Close
      </button>
    `;
    
    modal.className = 'modal';
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close when clicking outside the modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  addTestResult(message, type) {
    const resultsContainer = document.getElementById('testResults');
    const result = document.createElement('div');
    result.className = `test-result ${type}`;
    result.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;
    
    resultsContainer.appendChild(result);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (result.parentNode) {
        result.parentNode.removeChild(result);
      }
    }, 10000);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  sendMessageToBackground(message) {
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
}

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
