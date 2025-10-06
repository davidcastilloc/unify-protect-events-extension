#!/usr/bin/env node

/**
 * 🧪 TEST DEL SISTEMA CRÍTICO
 * Script para verificar que todas las funcionalidades críticas funcionan
 */

const http = require('http');
const WebSocket = require('ws');

class CriticalSystemTester {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.wsUrl = serverUrl.replace('http', 'ws');
    this.testResults = [];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
  }

  async makeRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.serverUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  async testHealthCheck() {
    try {
      this.log('🧪 Probando health check...');
      const response = await this.makeRequest('/health');
      
      if (response.status === 'ok') {
        this.testResults.push({ test: 'Health Check', status: '✅ PASS', details: response });
        this.log('✅ Health check funcionando correctamente', 'SUCCESS');
        return true;
      } else {
        this.testResults.push({ test: 'Health Check', status: '❌ FAIL', details: response });
        this.log('❌ Health check falló', 'ERROR');
        return false;
      }
    } catch (error) {
      this.testResults.push({ test: 'Health Check', status: '❌ ERROR', details: error.message });
      this.log(`❌ Error en health check: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testCriticalStatus() {
    try {
      this.log('🧪 Probando estado crítico...');
      const response = await this.makeRequest('/critical-status');
      
      if (response.status === 'critical-system') {
        this.testResults.push({ test: 'Critical Status', status: '✅ PASS', details: response });
        this.log('✅ Estado crítico funcionando correctamente', 'SUCCESS');
        this.log(`📊 UniFi Connectado: ${response.unifiProtect?.isConnected}`, 'INFO');
        this.log(`💓 Heartbeat Saludable: ${response.unifiProtect?.isHeartbeatHealthy}`, 'INFO');
        this.log(`🔴 Circuit Breaker: ${response.unifiProtect?.circuitBreakerState}`, 'INFO');
        this.log(`👥 Clientes WebSocket: ${response.webSocketClients?.count}`, 'INFO');
        return true;
      } else {
        this.testResults.push({ test: 'Critical Status', status: '❌ FAIL', details: response });
        this.log('❌ Estado crítico falló', 'ERROR');
        return false;
      }
    } catch (error) {
      this.testResults.push({ test: 'Critical Status', status: '❌ ERROR', details: error.message });
      this.log(`❌ Error en estado crítico: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve) => {
      try {
        this.log('🧪 Probando conexión WebSocket...');
        
        // Obtener token primero
        this.makeRequest('/auth/token')
          .then(response => {
            const token = response.token;
            if (!token) {
              this.testResults.push({ test: 'WebSocket Connection', status: '❌ FAIL', details: 'No token received' });
              this.log('❌ No se pudo obtener token para WebSocket', 'ERROR');
              resolve(false);
              return;
            }

            // Conectar WebSocket
            const ws = new WebSocket(`${this.wsUrl}/ws?token=${token}`);
            
            const timeout = setTimeout(() => {
              this.testResults.push({ test: 'WebSocket Connection', status: '❌ TIMEOUT', details: 'Connection timeout' });
              this.log('❌ Timeout en conexión WebSocket', 'ERROR');
              ws.close();
              resolve(false);
            }, 10000);

            ws.on('open', () => {
              clearTimeout(timeout);
              this.testResults.push({ test: 'WebSocket Connection', status: '✅ PASS', details: 'Connected successfully' });
              this.log('✅ WebSocket conectado correctamente', 'SUCCESS');
              ws.close();
              resolve(true);
            });

            ws.on('error', (error) => {
              clearTimeout(timeout);
              this.testResults.push({ test: 'WebSocket Connection', status: '❌ ERROR', details: error.message });
              this.log(`❌ Error en WebSocket: ${error.message}`, 'ERROR');
              resolve(false);
            });

          })
          .catch(error => {
            this.testResults.push({ test: 'WebSocket Connection', status: '❌ ERROR', details: error.message });
            this.log(`❌ Error obteniendo token: ${error.message}`, 'ERROR');
            resolve(false);
          });

      } catch (error) {
        this.testResults.push({ test: 'WebSocket Connection', status: '❌ ERROR', details: error.message });
        this.log(`❌ Error en test WebSocket: ${error.message}`, 'ERROR');
        resolve(false);
      }
    });
  }

  async testHeartbeatStress() {
    try {
      this.log('🧪 Probando stress de heartbeat (10 verificaciones)...');
      
      let successCount = 0;
      const totalTests = 10;
      
      for (let i = 0; i < totalTests; i++) {
        try {
          const response = await this.makeRequest('/critical-status');
          if (response.unifiProtect?.isHeartbeatHealthy) {
            successCount++;
          }
          
          // Esperar 1 segundo entre tests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          this.log(`⚠️ Verificación ${i+1} falló: ${error.message}`, 'WARNING');
        }
      }
      
      const successRate = (successCount / totalTests) * 100;
      
      if (successRate >= 90) {
        this.testResults.push({ 
          test: 'Heartbeat Stress Test', 
          status: '✅ PASS', 
          details: `${successCount}/${totalTests} (${successRate.toFixed(1)}%)` 
        });
        this.log(`✅ Stress test de heartbeat exitoso: ${successCount}/${totalTests} (${successRate.toFixed(1)}%)`, 'SUCCESS');
        return true;
      } else {
        this.testResults.push({ 
          test: 'Heartbeat Stress Test', 
          status: '❌ FAIL', 
          details: `${successCount}/${totalTests} (${successRate.toFixed(1)}%)` 
        });
        this.log(`❌ Stress test de heartbeat falló: ${successCount}/${totalTests} (${successRate.toFixed(1)}%)`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.testResults.push({ test: 'Heartbeat Stress Test', status: '❌ ERROR', details: error.message });
      this.log(`❌ Error en stress test: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runAllTests() {
    this.log('🚨 INICIANDO TESTS DEL SISTEMA CRÍTICO');
    this.log('=====================================');
    
    const tests = [
      { name: 'Health Check', fn: () => this.testHealthCheck() },
      { name: 'Critical Status', fn: () => this.testCriticalStatus() },
      { name: 'WebSocket Connection', fn: () => this.testWebSocketConnection() },
      { name: 'Heartbeat Stress Test', fn: () => this.testHeartbeatStress() }
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
      this.log(`\n🧪 Ejecutando: ${test.name}`);
      try {
        const result = await test.fn();
        if (result) passedTests++;
      } catch (error) {
        this.log(`❌ Error ejecutando ${test.name}: ${error.message}`, 'ERROR');
      }
    }
    
    // Mostrar resumen
    this.log('\n📊 RESUMEN DE TESTS');
    this.log('==================');
    
    this.testResults.forEach(result => {
      this.log(`${result.status} ${result.test}: ${result.details}`, result.status.includes('✅') ? 'SUCCESS' : 'ERROR');
    });
    
    const totalTests = tests.length;
    const passRate = (passedTests / totalTests) * 100;
    
    this.log(`\n📈 RESULTADO FINAL: ${passedTests}/${totalTests} tests pasaron (${passRate.toFixed(1)}%)`);
    
    if (passRate >= 75) {
      this.log('🎉 SISTEMA CRÍTICO FUNCIONANDO CORRECTAMENTE', 'SUCCESS');
      return true;
    } else {
      this.log('❌ SISTEMA CRÍTICO TIENE PROBLEMAS', 'ERROR');
      return false;
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const serverUrl = process.env.TEST_SERVER_URL || 'http://localhost:3000';
  const tester = new CriticalSystemTester(serverUrl);
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Error ejecutando tests:', error);
      process.exit(1);
    });
}

module.exports = CriticalSystemTester;
