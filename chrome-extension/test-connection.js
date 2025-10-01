// Script de diagnóstico para consola del navegador
// Copia y pega este código en la consola del DevTools de Chrome para diagnosticar la conexión

(async function diagnoseUnifiConnection() {
  console.log('%c🔍 DIAGNÓSTICO DE CONEXIÓN UNIFI', 'background: #667eea; color: white; padding: 10px; font-size: 16px; font-weight: bold;');
  
  const SERVER_URL = 'http://localhost:3001';
  const clientId = 'test-' + Math.random().toString(36).substr(2, 9);
  
  // Test 1: Verificar servidor HTTP
  console.log('\n%c📡 Test 1: Servidor HTTP', 'color: #667eea; font-weight: bold;');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Servidor disponible:', data);
    console.log(`   └─ Clientes conectados: ${data.clients}`);
  } catch (error) {
    console.error('❌ Error conectando al servidor:', error.message);
    console.log('%c⚠️ Asegúrate de que el servidor esté corriendo: npm start', 'color: orange; font-weight: bold;');
    return;
  }
  
  // Test 2: Obtener token
  console.log('\n%c🔑 Test 2: Autenticación', 'color: #667eea; font-weight: bold;');
  let token;
  try {
    const response = await fetch(`${SERVER_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId })
    });
    const data = await response.json();
    token = data.token;
    console.log('✅ Token obtenido:', token.substring(0, 30) + '...');
  } catch (error) {
    console.error('❌ Error obteniendo token:', error.message);
    return;
  }
  
  // Test 3: Conectar WebSocket
  console.log('\n%c🔌 Test 3: Conexión WebSocket', 'color: #667eea; font-weight: bold;');
  const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('✅ WebSocket conectado');
    console.log('   └─ Estado: OPEN');
    
    // Enviar ping
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'ping' }));
      console.log('📤 Ping enviado al servidor');
    }, 1000);
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log(`%c📨 Mensaje recibido: ${message.type}`, 'color: green; font-weight: bold;');
    console.log('   └─ Datos:', message);
    
    if (message.type === 'event') {
      console.log('%c🎯 EVENTO RECIBIDO:', 'background: #4CAF50; color: white; padding: 5px; font-weight: bold;');
      console.log('   ├─ Tipo:', message.data.type);
      console.log('   ├─ Cámara:', message.data.camera.name);
      console.log('   ├─ Severidad:', message.data.severity);
      console.log('   └─ Descripción:', message.data.description);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error en WebSocket:', error);
  };
  
  ws.onclose = (event) => {
    console.log(`🔌 WebSocket cerrado: ${event.code} - ${event.reason}`);
  };
  
  // Test 4: Generar evento de prueba
  console.log('\n%c🎭 Test 4: Generar evento de simulación', 'color: #667eea; font-weight: bold;');
  console.log('Esperando 3 segundos antes de generar evento...');
  
  setTimeout(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/simulation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'person' })
      });
      const data = await response.json();
      console.log('✅ Evento de simulación generado:', data);
      console.log('   └─ Deberías ver el evento en el WebSocket arriba ↑');
    } catch (error) {
      console.error('❌ Error generando evento:', error.message);
    }
  }, 3000);
  
  // Instrucciones finales
  console.log('\n%c💡 INSTRUCCIONES:', 'background: #2196F3; color: white; padding: 5px; font-weight: bold;');
  console.log('1. Si ves "WebSocket conectado" y "Mensaje recibido: connected", la conexión funciona');
  console.log('2. Si ves un evento después de 3 segundos, el servidor está enviando eventos correctamente');
  console.log('3. Para cerrar la conexión: ws.close()');
  console.log('4. Para generar más eventos: fetch("http://localhost:3001/api/simulation/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({eventType: "person"})})');
  
  // Guardar ws en global para acceso
  window.testWs = ws;
  console.log('\n💾 WebSocket guardado en window.testWs para debugging');
  
})();

