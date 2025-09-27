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

interface Camera {
  id: string;
  name: string;
  type: string;
  location?: string;
}

class OptionsManager {
  private config: NotificationConfig;
  private cameras: Camera[] = [];

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
    console.log('Inicializando página de opciones...');
    
    // Cargar configuración guardada
    await this.loadConfig();
    
    // Configurar elementos de la UI
    this.setupEventListeners();
    
    // Cargar datos iniciales
    await this.updateConnectionStatus();
    await this.loadCameras();
    
    console.log('Página de opciones inicializada');
  }

  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
      if (result && result.config) {
        this.config = result.config;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: this.config
      });
      
      if (result && result.success) {
        this.showNotification('Configuración guardada correctamente', 'success');
        await this.updateConnectionStatus();
      } else {
        this.showNotification('Error guardando configuración', 'error');
      }
    } catch (error) {
      console.error('Error guardando configuración:', error);
      this.showNotification('Error guardando configuración', 'error');
    }
  }

  private updateUI(): void {
    // Actualizar campos de conexión
    (document.getElementById('backendUrl') as HTMLInputElement).value = this.config.backendUrl;
    (document.getElementById('clientId') as HTMLInputElement).value = this.config.clientId;
    (document.getElementById('enabled') as HTMLInputElement).checked = this.config.enabled;

    // Actualizar filtros de tipos de eventos
    this.config.filters.types.forEach(type => {
      const checkbox = document.getElementById(`filter-${type}`) as HTMLInputElement;
      if (checkbox) checkbox.checked = true;
    });

    // Actualizar filtros de severidad
    this.config.filters.severity.forEach(severity => {
      const checkbox = document.getElementById(`filter-${severity}`) as HTMLInputElement;
      if (checkbox) checkbox.checked = true;
    });

    // Actualizar checkboxes visualmente
    this.updateCheckboxVisuals();
  }

  private setupEventListeners(): void {
    // Botones principales
    document.getElementById('saveConfig')?.addEventListener('click', () => {
      this.collectConfigFromUI();
      this.saveConfig();
    });

    document.getElementById('resetConfig')?.addEventListener('click', () => {
      this.resetConfig();
    });

    document.getElementById('testConnection')?.addEventListener('click', () => {
      this.testConnection();
    });

    document.getElementById('refreshCameras')?.addEventListener('click', () => {
      this.loadCameras();
    });

    // Toggle de habilitación
    document.getElementById('enabled')?.addEventListener('change', (e) => {
      this.config.enabled = (e.target as HTMLInputElement).checked;
      this.updateConnectionStatus();
    });

    // Checkboxes de filtros
    this.setupFilterCheckboxes();

    // Campos de texto
    document.getElementById('backendUrl')?.addEventListener('input', (e) => {
      this.config.backendUrl = (e.target as HTMLInputElement).value;
    });

    document.getElementById('clientId')?.addEventListener('input', (e) => {
      this.config.clientId = (e.target as HTMLInputElement).value;
    });
  }

  private setupFilterCheckboxes(): void {
    // Tipos de eventos
    ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart-detect'].forEach(type => {
      const checkbox = document.getElementById(`filter-${type}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateCheckboxVisuals();
        });
      }
    });

    // Niveles de severidad
    ['low', 'medium', 'high', 'critical'].forEach(severity => {
      const checkbox = document.getElementById(`filter-${severity}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateCheckboxVisuals();
        });
      }
    });
  }

  private updateCheckboxVisuals(): void {
    document.querySelectorAll('.checkbox-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        item.classList.add('checked');
      } else {
        item.classList.remove('checked');
      }
    });
  }

  private collectConfigFromUI(): void {
    // Conexión
    this.config.backendUrl = (document.getElementById('backendUrl') as HTMLInputElement).value;
    this.config.clientId = (document.getElementById('clientId') as HTMLInputElement).value;
    this.config.enabled = (document.getElementById('enabled') as HTMLInputElement).checked;

    // Filtros de tipos
    this.config.filters.types = [];
    ['motion', 'person', 'vehicle', 'package', 'doorbell', 'smart-detect'].forEach(type => {
      const checkbox = document.getElementById(`filter-${type}`) as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        this.config.filters.types.push(type === 'smart-detect' ? 'smart_detect' : type);
      }
    });

    // Filtros de severidad
    this.config.filters.severity = [];
    ['low', 'medium', 'high', 'critical'].forEach(severity => {
      const checkbox = document.getElementById(`filter-${severity}`) as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        this.config.filters.severity.push(severity);
      }
    });

    // Filtros de cámaras
    this.config.filters.cameras = [];
    document.querySelectorAll('#cameraList input[type="checkbox"]:checked').forEach(checkbox => {
      this.config.filters.cameras.push((checkbox as HTMLInputElement).value);
    });
  }

  private async updateConnectionStatus(): Promise<void> {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      if (result && result.connected) {
        statusElement.textContent = 'Estado: Conectado ✅';
        statusElement.className = 'status connected';
      } else {
        statusElement.textContent = `Estado: Desconectado ❌ (Intentos: ${result?.reconnectAttempts || 0})`;
        statusElement.className = 'status disconnected';
      }
    } catch (error) {
      statusElement.textContent = 'Estado: Error de conexión ❌';
      statusElement.className = 'status disconnected';
    }
  }

  private async testConnection(): Promise<void> {
    const statusElement = document.getElementById('connectionStatus');
    const testButton = document.getElementById('testConnection') as HTMLButtonElement;
    
    if (!statusElement || !testButton) return;

    statusElement.textContent = 'Probando conexión...';
    statusElement.className = 'status testing';
    testButton.disabled = true;
    testButton.textContent = 'Probando...';

    try {
      const result = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
      
      if (result && result.connected) {
        statusElement.textContent = 'Estado: Conexión exitosa ✅';
        statusElement.className = 'status connected';
      } else {
        statusElement.textContent = 'Estado: Error de conexión ❌';
        statusElement.className = 'status disconnected';
      }
    } catch (error) {
      statusElement.textContent = 'Estado: Error de conexión ❌';
      statusElement.className = 'status disconnected';
    } finally {
      testButton.disabled = false;
      testButton.textContent = 'Probar Conexión';
    }
  }

  private async loadCameras(): Promise<void> {
    const loadingElement = document.getElementById('cameraLoading');
    const cameraListElement = document.getElementById('cameraList');
    
    if (!loadingElement || !cameraListElement) return;

    loadingElement.style.display = 'block';
    cameraListElement.style.display = 'none';

    try {
      const response = await fetch(`${this.config.backendUrl}/api/cameras`);
      
      if (response.ok) {
        this.cameras = await response.json();
        this.renderCameraList();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error cargando cámaras:', error);
      cameraListElement.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">Error cargando cámaras. Verifica que el backend esté ejecutándose.</p>';
    } finally {
      loadingElement.style.display = 'none';
      cameraListElement.style.display = 'block';
    }
  }

  private renderCameraList(): void {
    const cameraListElement = document.getElementById('cameraList');
    if (!cameraListElement) return;

    if (this.cameras.length === 0) {
      cameraListElement.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No se encontraron cámaras.</p>';
      return;
    }

    const html = this.cameras.map(camera => `
      <div class="camera-item">
        <input type="checkbox" id="camera-${camera.id}" value="${camera.id}" ${this.config.filters.cameras.includes(camera.id) ? 'checked' : ''}>
        <label for="camera-${camera.id}">
          <strong>${camera.name}</strong>
          <br>
          <small>${camera.type}${camera.location ? ` - ${camera.location}` : ''}</small>
        </label>
      </div>
    `).join('');

    cameraListElement.innerHTML = html;

    // Configurar event listeners para las cámaras
    this.cameras.forEach(camera => {
      const checkbox = document.getElementById(`camera-${camera.id}`) as HTMLInputElement;
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateCheckboxVisuals();
        });
      }
    });

    this.updateCheckboxVisuals();
  }

  private async resetConfig(): Promise<void> {
    if (confirm('¿Estás seguro de que quieres restablecer toda la configuración?')) {
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

      this.updateUI();
      await this.saveConfig();
      this.showNotification('Configuración restablecida', 'success');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    switch (type) {
      case 'success':
        notification.style.background = '#28a745';
        break;
      case 'error':
        notification.style.background = '#dc3545';
        break;
      case 'info':
        notification.style.background = '#17a2b8';
        break;
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});

