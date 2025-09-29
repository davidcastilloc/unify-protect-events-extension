// Content script para mostrar popups flotantes en las páginas web
class UnifiContentScript {
  constructor() {
    this.popups = new Map();
    this.init();
  }

  init() {
    console.log('🚀 Inicializando content script UniFi Protect');
    
    // Escuchar mensajes del background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'showPopup':
        this.createFloatingPopup(message.event);
        break;
      case 'removePopup':
        this.removePopup(message.eventId);
        break;
      default:
        console.log('Mensaje no manejado en content script:', message);
    }
  }

  createFloatingPopup(event) {
    try {
      // Verificar si ya existe un popup para este evento
      if (this.popups.has(event.id)) {
        return;
      }

      // Crear el popup flotante
      const popup = document.createElement('div');
      popup.id = `unifi-popup-${event.id}`;
      popup.className = 'unifi-floating-popup';
      
      // Configurar el contenido del popup
      const timestamp = new Date(event.timestamp).toLocaleString('es-ES');
      const severityClass = this.getSeverityClass(event.severity);
      const eventIcon = this.getEventIcon(event.type);
      
      popup.innerHTML = `
        <div class="popup-header ${severityClass}">
          <div class="popup-icon">
            <img src="${chrome.runtime.getURL(eventIcon)}" alt="${event.type}" class="event-icon">
          </div>
          <div class="popup-title">
            <h3>${this.getEventTitle(event)}</h3>
            <span class="popup-camera">${event.camera.name}</span>
          </div>
          <button class="popup-close">×</button>
        </div>
        <div class="popup-content">
          <div class="popup-description">${event.description}</div>
          <div class="popup-details">
            <div class="detail-item">
              <span class="detail-label">Hora:</span>
              <span class="detail-value">${timestamp}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Severidad:</span>
              <span class="detail-value severity-${event.severity}">${this.getSeverityLabel(event.severity)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Tipo:</span>
              <span class="detail-value">${this.getEventTypeLabel(event.type)}</span>
            </div>
          </div>
        </div>
        <div class="popup-actions">
          <button class="popup-btn popup-btn-primary">Ver Detalles</button>
          <button class="popup-btn popup-btn-secondary">Cerrar</button>
        </div>
      `;
      
      // Agregar estilos CSS si no existen
      this.ensurePopupStyles();
      
      // Agregar event listeners
      this.setupPopupEventListeners(popup, event);
      
      // Agregar el popup al DOM
      document.body.appendChild(popup);
      
      // Guardar referencia
      this.popups.set(event.id, popup);
      
      // Animar entrada
      setTimeout(() => {
        popup.classList.add('popup-visible');
      }, 10);
      
      // Auto-cerrar después de 10 segundos (excepto para eventos críticos)
      if (event.severity !== 'critical') {
        setTimeout(() => {
          this.removePopup(event.id);
        }, 10000);
      }
      
      console.log('🎯 Popup flotante creado para evento:', event.id);
      
    } catch (error) {
      console.error('❌ Error creando popup flotante:', error);
    }
  }

  setupPopupEventListeners(popup, event) {
    // Botón de cerrar
    const closeBtn = popup.querySelector('.popup-close');
    closeBtn.addEventListener('click', () => {
      this.removePopup(event.id);
    });

    // Botón de cerrar secundario
    const closeBtnSecondary = popup.querySelector('.popup-btn-secondary');
    closeBtnSecondary.addEventListener('click', () => {
      this.removePopup(event.id);
    });

    // Botón de ver detalles
    const detailsBtn = popup.querySelector('.popup-btn-primary');
    detailsBtn.addEventListener('click', () => {
      this.showEventDetails(event);
    });

    // Click en el header para mostrar detalles
    const header = popup.querySelector('.popup-header');
    header.addEventListener('click', () => {
      this.showEventDetails(event);
    });
  }

  removePopup(eventId) {
    const popup = this.popups.get(eventId);
    if (popup && popup.parentNode) {
      popup.classList.remove('popup-visible');
      setTimeout(() => {
        if (popup.parentNode) {
          popup.remove();
        }
        this.popups.delete(eventId);
      }, 300);
    }
  }

  showEventDetails(event) {
    // Crear un modal con detalles completos del evento
    const modal = document.createElement('div');
    modal.className = 'unifi-event-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Detalles del Evento</h2>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div class="event-detail-grid">
              <div class="detail-section">
                <h3>Información General</h3>
                <div class="detail-row">
                  <span class="label">ID del Evento:</span>
                  <span class="value">${event.id}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Tipo:</span>
                  <span class="value">${this.getEventTypeLabel(event.type)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Severidad:</span>
                  <span class="value severity-${event.severity}">${this.getSeverityLabel(event.severity)}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Descripción:</span>
                  <span class="value">${event.description}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Información de la Cámara</h3>
                <div class="detail-row">
                  <span class="label">Nombre:</span>
                  <span class="value">${event.camera.name}</span>
                </div>
                <div class="detail-row">
                  <span class="label">ID:</span>
                  <span class="value">${event.camera.id}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Modelo:</span>
                  <span class="value">${event.camera.model || 'N/A'}</span>
                </div>
              </div>
              
              <div class="detail-section">
                <h3>Información Temporal</h3>
                <div class="detail-row">
                  <span class="label">Timestamp:</span>
                  <span class="value">${new Date(event.timestamp).toLocaleString('es-ES')}</span>
                </div>
                <div class="detail-row">
                  <span class="label">ISO String:</span>
                  <span class="value">${event.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="modal-btn modal-btn-primary">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    
    // Agregar estilos del modal si no existen
    this.ensureModalStyles();
    
    // Agregar event listeners del modal
    const modalClose = modal.querySelector('.modal-close');
    const modalBtn = modal.querySelector('.modal-btn-primary');
    const modalOverlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
      modal.classList.remove('modal-visible');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 300);
    };
    
    modalClose.addEventListener('click', closeModal);
    modalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    
    document.body.appendChild(modal);
    
    // Animar entrada
    setTimeout(() => {
      modal.classList.add('modal-visible');
    }, 10);
  }

  ensurePopupStyles() {
    // Verificar si los estilos ya existen
    if (document.getElementById('unifi-popup-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'unifi-popup-styles';
    style.textContent = `
      .unifi-floating-popup {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      
      .unifi-floating-popup.popup-visible {
        opacity: 1;
        transform: translateX(0);
      }
      
      .popup-header {
        display: flex;
        align-items: center;
        padding: 16px;
        border-radius: 12px 12px 0 0;
        position: relative;
        cursor: pointer;
      }
      
      .popup-header.severity-low { background: linear-gradient(135deg, #4CAF50, #45a049); }
      .popup-header.severity-medium { background: linear-gradient(135deg, #FF9800, #F57C00); }
      .popup-header.severity-high { background: linear-gradient(135deg, #F44336, #D32F2F); }
      .popup-header.severity-critical { background: linear-gradient(135deg, #9C27B0, #7B1FA2); }
      
      .popup-icon {
        margin-right: 12px;
      }
      
      .event-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        padding: 6px;
      }
      
      .popup-title {
        flex: 1;
        color: white;
      }
      
      .popup-title h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
      }
      
      .popup-camera {
        font-size: 12px;
        opacity: 0.9;
        display: block;
        margin-top: 2px;
      }
      
      .popup-close {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s ease;
      }
      
      .popup-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      .popup-content {
        padding: 16px;
      }
      
      .popup-description {
        font-size: 14px;
        color: #333;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      
      .popup-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
      }
      
      .detail-label {
        color: #666;
        font-weight: 500;
      }
      
      .detail-value {
        color: #333;
        font-weight: 600;
      }
      
      .detail-value.severity-low { color: #4CAF50; }
      .detail-value.severity-medium { color: #FF9800; }
      .detail-value.severity-high { color: #F44336; }
      .detail-value.severity-critical { color: #9C27B0; }
      
      .popup-actions {
        padding: 12px 16px 16px;
        display: flex;
        gap: 8px;
      }
      
      .popup-btn {
        flex: 1;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .popup-btn-primary {
        background: #667eea;
        color: white;
      }
      
      .popup-btn-primary:hover {
        background: #5a6fd8;
      }
      
      .popup-btn-secondary {
        background: #f5f5f5;
        color: #666;
        border: 1px solid #ddd;
      }
      
      .popup-btn-secondary:hover {
        background: #e9e9e9;
      }
    `;
    
    document.head.appendChild(style);
  }

  ensureModalStyles() {
    if (document.getElementById('unifi-modal-styles')) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = 'unifi-modal-styles';
    style.textContent = `
      .unifi-event-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2147483648;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .unifi-event-modal.modal-visible {
        opacity: 1;
      }
      
      .modal-overlay {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      
      .modal-content {
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        transform: scale(0.9);
        transition: transform 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .unifi-event-modal.modal-visible .modal-content {
        transform: scale(1);
      }
      
      .modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .modal-header h2 {
        margin: 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
      }
      
      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .modal-close:hover {
        background: #f5f5f5;
        color: #333;
      }
      
      .modal-body {
        padding: 20px;
      }
      
      .event-detail-grid {
        display: grid;
        gap: 24px;
      }
      
      .detail-section h3 {
        margin: 0 0 12px 0;
        color: #333;
        font-size: 16px;
        font-weight: 600;
        border-bottom: 2px solid #667eea;
        padding-bottom: 4px;
      }
      
      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .detail-row:last-child {
        border-bottom: none;
      }
      
      .detail-row .label {
        color: #666;
        font-weight: 500;
        min-width: 120px;
      }
      
      .detail-row .value {
        color: #333;
        font-weight: 600;
        text-align: right;
        flex: 1;
        margin-left: 16px;
      }
      
      .detail-row .value.severity-low { color: #4CAF50; }
      .detail-row .value.severity-medium { color: #FF9800; }
      .detail-row .value.severity-high { color: #F44336; }
      .detail-row .value.severity-critical { color: #9C27B0; }
      
      .modal-footer {
        padding: 20px;
        border-top: 1px solid #eee;
        display: flex;
        justify-content: flex-end;
      }
      
      .modal-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .modal-btn-primary {
        background: #667eea;
        color: white;
      }
      
      .modal-btn-primary:hover {
        background: #5a6fd8;
      }
    `;
    
    document.head.appendChild(style);
  }

  getSeverityClass(severity) {
    return `severity-${severity}`;
  }

  getSeverityLabel(severity) {
    const labels = {
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta',
      'critical': 'Crítica'
    };
    return labels[severity] || severity;
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
    return labels[eventType] || eventType;
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
}

// Inicializar el content script
const unifiContentScript = new UnifiContentScript();
