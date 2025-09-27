class PopupManager {
  private statusUpdateInterval: number | null = null;
  private eventCount = 0;
  private startTime = Date.now();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('Inicializando popup...');
    
    this.setupEventListeners();
    await this.updateStatus();
    this.startStatusUpdates();
    
    console.log('Popup inicializado');
  }

  private setupEventListeners(): void {
    // Toggle de notificaciones
    const toggle = document.getElementById('notificationToggle') as HTMLInputElement;
    toggle?.addEventListener('change', async (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      await this.updateNotificationSetting(enabled);
    });

    // Botón de prueba de notificación
    document.getElementById('testNotification')?.addEventListener('click', () => {
      this.sendTestNotification();
    });

    // Botón de actualizar estado
    document.getElementById('refreshStatus')?.addEventListener('click', () => {
      this.updateStatus();
    });

    // Enlaces del footer
    document.getElementById('openOptions')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    document.getElementById('openHelp')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });
  }

  private async updateStatus(): Promise<void> {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusDetails = document.getElementById('statusDetails');
    const eventCountElement = document.getElementById('eventCount');
    const uptimeElement = document.getElementById('uptime');

    if (!statusDot || !statusText || !statusDetails) return;

    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      
      if (result && result.connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Conectado';
        statusDetails.textContent = `Backend: ${result.config?.backendUrl || 'N/A'}`;
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Desconectado';
        statusDetails.textContent = `Intentos de reconexión: ${result?.reconnectAttempts || 0}`;
      }

      // Actualizar toggle de notificaciones
      const toggle = document.getElementById('notificationToggle') as HTMLInputElement;
      if (toggle && result?.config) {
        toggle.checked = result.config.enabled;
      }

    } catch (error) {
      console.error('Error obteniendo estado:', error);
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Error';
      statusDetails.textContent = 'No se pudo conectar con el service worker';
    }

    // Actualizar contadores
    this.updateCounters(eventCountElement, uptimeElement);
  }

  private updateCounters(eventCountElement: HTMLElement | null, uptimeElement: HTMLElement | null): void {
    // Simular contador de eventos (en una implementación real, esto vendría del backend)
    if (eventCountElement) {
      eventCountElement.textContent = this.eventCount.toString();
    }

    // Calcular tiempo activo
    if (uptimeElement) {
      const uptimeMs = Date.now() - this.startTime;
      const minutes = Math.floor(uptimeMs / 60000);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        uptimeElement.textContent = `${hours}h ${minutes % 60}m`;
      } else {
        uptimeElement.textContent = `${minutes}m`;
      }
    }
  }

  private async updateNotificationSetting(enabled: boolean): Promise<void> {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_CONFIG',
        config: { enabled }
      });

      if (result && result.success) {
        this.showStatusMessage(enabled ? 'Notificaciones habilitadas' : 'Notificaciones deshabilitadas', 'success');
      } else {
        this.showStatusMessage('Error actualizando configuración', 'error');
      }
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      this.showStatusMessage('Error actualizando configuración', 'error');
    }
  }

  private async sendTestNotification(): Promise<void> {
    try {
      // Crear notificación de prueba
      const testEvent = {
        id: `test-${Date.now()}`,
        type: 'person',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        camera: {
          id: 'cam-test',
          name: 'Cámara de Prueba',
          type: 'Test',
          location: 'Ubicación de Prueba'
        },
        description: 'Esta es una notificación de prueba para verificar que el sistema funciona correctamente.',
        metadata: {
          confidence: 95,
          zone: 'Zona de Prueba'
        }
      };

      // Simular envío de notificación
      chrome.notifications.create(`test-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/person.png',
        title: '🧪 Prueba de Notificación',
        message: `${testEvent.camera.name} - ${testEvent.description}`,
        contextMessage: 'Notificación de prueba',
        buttons: [
          { title: 'Aceptar' }
        ]
      });

      this.eventCount++;
      this.showStatusMessage('Notificación de prueba enviada', 'success');
      
    } catch (error) {
      console.error('Error enviando notificación de prueba:', error);
      this.showStatusMessage('Error enviando notificación de prueba', 'error');
    }
  }

  private startStatusUpdates(): void {
    // Actualizar estado cada 5 segundos
    this.statusUpdateInterval = window.setInterval(() => {
      this.updateStatus();
    }, 5000);
  }

  private stopStatusUpdates(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  private showStatusMessage(message: string, type: 'success' | 'error' | 'info'): void {
    // Crear mensaje temporal
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      padding: 10px;
      border-radius: 6px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      z-index: 1000;
      animation: slideDown 0.3s ease-out;
    `;

    switch (type) {
      case 'success':
        messageElement.style.background = '#4CAF50';
        break;
      case 'error':
        messageElement.style.background = '#F44336';
        break;
      case 'info':
        messageElement.style.background = '#2196F3';
        break;
    }

    messageElement.textContent = message;
    document.body.appendChild(messageElement);

    // Remover después de 3 segundos
    setTimeout(() => {
      messageElement.style.animation = 'slideUp 0.3s ease-in';
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }
      }, 300);
    }, 3000);
  }

  private openHelp(): void {
    // Crear ventana de ayuda
    const helpWindow = window.open('', '_blank', 'width=600,height=400,scrollbars=yes');
    if (helpWindow) {
      helpWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ayuda - UniFi Protect Notifications</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #333; }
            h2 { color: #666; margin-top: 20px; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
            .step { margin: 10px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>🔔 Ayuda - UniFi Protect Notifications</h1>
          
          <h2>Configuración Inicial</h2>
          <div class="step">
            <strong>1. Configurar Backend:</strong><br>
            Asegúrate de que el backend esté ejecutándose en <code>http://localhost:3000</code>
          </div>
          
          <div class="step">
            <strong>2. Configurar UniFi Protect:</strong><br>
            Actualiza las credenciales en el archivo <code>.env</code> del backend
          </div>
          
          <div class="step">
            <strong>3. Habilitar Notificaciones:</strong><br>
            Usa el toggle en el popup o ve a Configuración > Conexión al Backend
          </div>
          
          <h2>Funcionalidades</h2>
          <ul>
            <li><strong>Notificaciones en Tiempo Real:</strong> Recibe alertas instantáneas de eventos</li>
            <li><strong>Filtros Avanzados:</strong> Configura qué eventos y cámaras monitorear</li>
            <li><strong>Notificaciones Nativas:</strong> Funciona incluso con el navegador cerrado</li>
            <li><strong>Reconexión Automática:</strong> Se reconecta automáticamente si se pierde la conexión</li>
          </ul>
          
          <h2>Solución de Problemas</h2>
          <div class="step">
            <strong>No se reciben notificaciones:</strong><br>
            • Verifica que el backend esté ejecutándose<br>
            • Comprueba la URL del backend en configuración<br>
            • Asegúrate de que las notificaciones estén habilitadas
          </div>
          
          <div class="step">
            <strong>Error de conexión:</strong><br>
            • Verifica que el puerto 3000 esté libre<br>
            • Comprueba la configuración de UniFi Protect<br>
            • Revisa los logs del backend
          </div>
          
          <h2>Contacto</h2>
          <p>Para soporte técnico o reportar bugs, contacta al desarrollador.</p>
        </body>
        </html>
      `);
      helpWindow.document.close();
    }
  }

  // Limpiar cuando se cierre el popup
  public destroy(): void {
    this.stopStatusUpdates();
  }
}

// Agregar estilos de animación
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Inicializar cuando el DOM esté listo
let popupManager: PopupManager;

document.addEventListener('DOMContentLoaded', () => {
  popupManager = new PopupManager();
});

// Limpiar cuando se cierre la ventana
window.addEventListener('beforeunload', () => {
  if (popupManager) {
    popupManager.destroy();
  }
});

