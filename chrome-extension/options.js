// Script para la página de opciones de la extensión UniFi Protect
class OptionsController {
  constructor() {
    this.defaultSettings = {
      serverUrl: 'http://localhost:3001',
      connectionTimeout: 30,
      reconnectAttempts: 5,
      notificationsEnabled: true,
      soundEnabled: true,
      notificationDuration: 10,
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
    console.log('🚀 Inicializando página de opciones');
    
    // Cargar configuración guardada
    await this.loadSettings();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Cargar cámaras disponibles
    await this.loadCameras();
    
    // Actualizar UI
    this.updateUI();
  }

  async loadSettings() {
    try {
      const settings = await chrome.storage.sync.get(Object.keys(this.defaultSettings));
      
      // Aplicar configuración cargada o usar valores por defecto
      Object.keys(this.defaultSettings).forEach(key => {
        if (settings[key] !== undefined) {
          this.defaultSettings[key] = settings[key];
        }
      });
      
      console.log('⚙️ Configuration loaded:', this.defaultSettings);
      
    } catch (error) {
      console.error('❌ Error cargando configuración:', error);
      this.showToast('Error cargando configuración', 'error');
    }
  }

  setupEventListeners() {
    // Botones principales
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveSettings();
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetSettings();
    });
    
    // Botones de prueba
    document.getElementById('testConnectionBtn').addEventListener('click', () => {
      this.testConnection();
    });
    
    document.getElementById('testNotificationBtn').addEventListener('click', () => {
      this.testNotification();
    });
    
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      this.clearHistory();
    });
    
    document.getElementById('exportConfigBtn').addEventListener('click', () => {
      this.exportConfig();
    });
    
    document.getElementById('importConfigBtn').addEventListener('click', () => {
      this.importConfig();
    });
    
    // Links del footer
    document.getElementById('helpLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showHelp();
    });
    
    document.getElementById('feedbackLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showFeedback();
    });
    
    // File input para importar
    document.getElementById('importFileInput').addEventListener('change', (e) => {
      this.handleImportFile(e.target.files[0]);
    });
    
    // Auto-save en cambios
    this.setupAutoSave();
  }

  setupAutoSave() {
    // Auto-guardar cuando cambien los valores
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        this.debounce(() => {
          this.saveSettings(false); // false = no mostrar toast
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
        this.addTestResult('No se pudieron cargar las cámaras del servidor', 'error');
      }
      
    } catch (error) {
      console.error('❌ Error cargando cámaras:', error);
      this.addTestResult('Error conectando al servidor para obtener cámaras', 'error');
    }
  }

  populateCameraSelect(cameras) {
    const select = document.getElementById('cameraFilter');
    select.innerHTML = '<option value="">Todas las cámaras</option>';
    
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
      
      // Enviar configuración actualizada al background script
      await this.sendMessageToBackground({
        type: 'updateSettings',
        settings: settings
      });
      
      if (showToast) {
        this.showToast('Configuration saved successfully', 'success');
      }
      
      console.log('💾 Configuration saved:', settings);
      
    } catch (error) {
      console.error('❌ Error guardando configuración:', error);
      this.showToast('Error guardando configuración', 'error');
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
    if (confirm('¿Estás seguro de que quieres restaurar todos los valores por defecto?')) {
      try {
        await chrome.storage.sync.clear();
        this.defaultSettings = { ...this.defaultSettings };
        this.updateUI();
        this.showToast('Configuration restored to default values', 'info');
      } catch (error) {
        console.error('❌ Error restaurando configuración:', error);
        this.showToast('Error restaurando configuración', 'error');
      }
    }
  }

  async testConnection() {
    const testBtn = document.getElementById('testConnectionBtn');
    const originalText = testBtn.innerHTML;
    
    testBtn.innerHTML = '<span class="btn-icon">⏳</span> Probando...';
    testBtn.disabled = true;
    
    try {
      const serverUrl = document.getElementById('serverUrl').value;
      const response = await fetch(`${serverUrl}/health`);
      
      if (response.ok) {
        const data = await response.json();
        this.addTestResult(`✅ Connection successful - Connected clients: ${data.clients}`, 'success');
      } else {
        this.addTestResult(`❌ Error HTTP: ${response.status}`, 'error');
      }
      
    } catch (error) {
      this.addTestResult(`❌ Error de conexión: ${error.message}`, 'error');
    } finally {
      testBtn.innerHTML = originalText;
      testBtn.disabled = false;
    }
  }

  async testNotification() {
    try {
      await chrome.notifications.create('test-notification', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Prueba de Notificación',
        message: 'Esta es una notificación de prueba de UniFi Protect',
        priority: 1
      });
      
      this.addTestResult('✅ Notificación de prueba enviada', 'success');
      
    } catch (error) {
      this.addTestResult(`❌ Error enviando notificación: ${error.message}`, 'error');
    }
  }

  async clearHistory() {
    if (confirm('¿Estás seguro de que quieres limpiar todo el historial de eventos?')) {
      try {
        await chrome.storage.local.remove(['recentEvents', 'stats']);
        this.addTestResult('✅ Historial limpiado exitosamente', 'success');
      } catch (error) {
        this.addTestResult(`❌ Error limpiando historial: ${error.message}`, 'error');
      }
    }
  }

  exportConfig() {
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
      
      this.addTestResult('✅ Configuration exported successfully', 'success');
      
    } catch (error) {
      this.addTestResult(`❌ Error exportando configuración: ${error.message}`, 'error');
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
      
      // Validar configuración
      if (this.validateConfig(config)) {
        // Aplicar configuración
        Object.assign(this.defaultSettings, config);
        this.updateUI();
        
        // Guardar configuración
        await chrome.storage.sync.set(config);
        
        this.addTestResult('✅ Configuration imported successfully', 'success');
      } else {
        this.addTestResult('❌ Archivo de configuración inválido', 'error');
      }
      
    } catch (error) {
      this.addTestResult(`❌ Error importando configuración: ${error.message}`, 'error');
    }
  }

  validateConfig(config) {
    // Validaciones básicas
    const requiredFields = ['serverUrl', 'notificationsEnabled', 'soundEnabled'];
    
    for (const field of requiredFields) {
      if (!(field in config)) {
        return false;
      }
    }
    
    // Validar URL del servidor
    try {
      new URL(config.serverUrl);
    } catch {
      return false;
    }
    
    return true;
  }

  showHelp() {
    const helpContent = `
      <h3>Ayuda - UniFi Protect Notifications</h3>
      <h4>Server Configuration:</h4>
      <p>Ingresa la URL completa de tu servidor UniFi Protect (ej: http://192.168.1.100:3001)</p>
      
      <h4>Event Filters:</h4>
      <p>Selecciona qué tipos de eventos quieres recibir. Puedes filtrar por tipo de evento, severidad y cámaras específicas.</p>
      
      <h4>Notifications:</h4>
      <p>Las notificaciones aparecerán en tu sistema operativo cuando se detecten eventos según tus filtros configurados.</p>
      
      <h4>Solución de Problemas:</h4>
      <p>Si no recibes notificaciones, verifica que el servidor esté ejecutándose y que la URL sea correcta.</p>
    `;
    
    this.showModal('Ayuda', helpContent);
  }

  showFeedback() {
    const feedbackContent = `
      <h3>Enviar Feedback</h3>
      <p>¿Tienes sugerencias o encontraste un problema?</p>
      <p>Envía un email a: <a href="mailto:feedback@example.com">feedback@example.com</a></p>
      <p>O crea un issue en el repositorio del proyecto.</p>
    `;
    
    this.showModal('Feedback', feedbackContent);
  }

  showModal(title, content) {
    // Crear modal simple
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
        Cerrar
      </button>
    `;
    
    modal.className = 'modal';
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Cerrar al hacer click fuera del modal
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
    
    // Auto-remover después de 10 segundos
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
    
    // Remover después de 3 segundos
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
