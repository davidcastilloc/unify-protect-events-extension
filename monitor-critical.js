#!/usr/bin/env node

/**
 * 🚨 MONITOR CRÍTICO - SISTEMA NUNCA DESCONECTADO
 * Script para monitorear la salud del sistema crítico
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class CriticalMonitor {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3000';
    this.checkInterval = config.checkInterval || 5000; // Cada 5 segundos
    this.alertThreshold = config.alertThreshold || 2; // 2 fallos consecutivos
    this.logFile = config.logFile || './logs/critical-monitor.log';
    this.consecutiveFailures = 0;
    this.isMonitoring = false;
    this.lastHealthCheck = null;
    
    // Crear directorio de logs si no existe
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    console.log(logMessage);
    
    // Escribir a archivo
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async checkCriticalStatus() {
    try {
      const response = await this.makeRequest('/critical-status');
      const data = JSON.parse(response);
      
      this.lastHealthCheck = {
        timestamp: new Date(),
        data: data
      };
      
      // Verificar salud general
      if (data.overallHealth) {
        this.log('✅ Sistema crítico saludable', 'SUCCESS');
        this.consecutiveFailures = 0;
        return true;
      } else {
        this.log('⚠️ Sistema crítico con problemas', 'WARNING');
        this.consecutiveFailures++;
        return false;
      }
      
    } catch (error) {
      this.log(`❌ Error verificando estado crítico: ${error.message}`, 'ERROR');
      this.consecutiveFailures++;
      return false;
    }
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(this.serverUrl).hostname,
        port: new URL(this.serverUrl).port,
        path: endpoint,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async sendAlert(message) {
    this.log(`🚨 ALERTA CRÍTICA: ${message}`, 'CRITICAL');
    
    // Aquí puedes agregar más métodos de alerta:
    // - Enviar email
    // - Enviar SMS
    // - Webhook a Slack/Discord
    // - Llamada telefónica
    // - etc.
    
    console.log('🚨 ALERTA CRÍTICA DETECTADA - ACCIÓN REQUERIDA');
  }

  async start() {
    if (this.isMonitoring) {
      this.log('Monitor ya está ejecutándose', 'WARNING');
      return;
    }

    this.isMonitoring = true;
    this.log('🚨 Monitor crítico iniciado', 'INFO');
    this.log(`📊 Verificando cada ${this.checkInterval/1000} segundos`, 'INFO');
    this.log(`🎯 Umbral de alerta: ${this.alertThreshold} fallos consecutivos`, 'INFO');

    const monitorLoop = async () => {
      if (!this.isMonitoring) return;

      const isHealthy = await this.checkCriticalStatus();
      
      // Verificar si necesitamos enviar alerta
      if (this.consecutiveFailures >= this.alertThreshold) {
        await this.sendAlert(`Sistema crítico fallando por ${this.consecutiveFailures} verificaciones consecutivas`);
      }

      // Programar siguiente verificación
      setTimeout(monitorLoop, this.checkInterval);
    };

    // Iniciar loop de monitoreo
    monitorLoop();
  }

  stop() {
    this.isMonitoring = false;
    this.log('🛑 Monitor crítico detenido', 'INFO');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      consecutiveFailures: this.consecutiveFailures,
      lastHealthCheck: this.lastHealthCheck,
      alertThreshold: this.alertThreshold
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const config = {
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    checkInterval: parseInt(process.env.MONITOR_INTERVAL || '5000'),
    alertThreshold: parseInt(process.env.ALERT_THRESHOLD || '2'),
    logFile: process.env.MONITOR_LOG_FILE || './logs/critical-monitor.log'
  };

  const monitor = new CriticalMonitor(config);

  // Manejar señales de terminación
  process.on('SIGINT', () => {
    console.log('\n🛑 Recibida señal SIGINT, deteniendo monitor...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Recibida señal SIGTERM, deteniendo monitor...');
    monitor.stop();
    process.exit(0);
  });

  // Iniciar monitor
  monitor.start().catch(error => {
    console.error('❌ Error iniciando monitor crítico:', error);
    process.exit(1);
  });
}

module.exports = CriticalMonitor;
