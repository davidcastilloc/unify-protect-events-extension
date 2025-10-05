// Browser console diagnostic script
// Copy and paste this code in Chrome DevTools console to diagnose connection

(async function diagnoseUnifiConnection() {
  console.log('%c🔍 UNIFI CONNECTION DIAGNOSTIC', 'background: #667eea; color: white; padding: 10px; font-size: 16px; font-weight: bold;');
  
  const SERVER_URL = 'http://localhost:3001';
  const clientId = 'test-' + Math.random().toString(36).substr(2, 9);
  
  // Test 1: Verificar servidor HTTP
  console.log('\n%c📡 Test 1: HTTP Server', 'color: #667eea; font-weight: bold;');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Server available:', data);
    console.log(`   └─ Connected clients: ${data.clients}`);
  } catch (error) {
    console.error('❌ Error conectando al servidor:', error.message);
    console.log('%c⚠️ Make sure the server is running: npm start', 'color: orange; font-weight: bold;');
    return;
  }
  
  // Test 2: Obtener token
  console.log('\n%c🔑 Test 2: Authentication', 'color: #667eea; font-weight: bold;');
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
  
  // Test 3: Connect WebSocket
  console.log('\n%c🔌 Test 3: WebSocket Connection', 'color: #667eea; font-weight: bold;');
  const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('✅ WebSocket conectado');
    console.log('   └─ State: OPEN');
    
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
      console.log('   ├─ Camera:', message.data.camera.name);
      console.log('   ├─ Severidad:', message.data.severity);
      console.log('   └─ Description:', message.data.description);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error en WebSocket:', error);
  };
  
  ws.onclose = (event) => {
    console.log(`🔌 WebSocket cerrado: ${event.code} - ${event.reason}`);
  };
  
  // Test 4: Generate test event
  console.log('\n%c🎭 Test 4: Generate simulation event', 'color: #667eea; font-weight: bold;');
  console.log('Waiting 3 seconds before generating event...');
  
  setTimeout(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/simulation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'person' })
      });
      const data = await response.json();
      console.log('✅ Simulation event generated:', data);
      console.log('   └─ You should see the event in the WebSocket above ↑');
    } catch (error) {
      console.error('❌ Error generando evento:', error.message);
    }
  }, 3000);
  
  // Instrucciones finales
  console.log('\n%c💡 INSTRUCCIONES:', 'background: #2196F3; color: white; padding: 5px; font-weight: bold;');
  console.log('1. If you see "WebSocket connected" and "Message received: connected", the connection works');
  console.log('2. If you see an event after 3 seconds, the server is sending events correctly');
  console.log('3. To close the connection: ws.close()');
  console.log('4. To generate more events: fetch("http://localhost:3001/api/simulation/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({eventType: "person"})})');
  
  // Save ws in global for access
  window.testWs = ws;
  console.log('\n💾 WebSocket guardado en window.testWs para debugging');
  
})();

