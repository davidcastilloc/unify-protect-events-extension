// Diagnostic script for browser console
// Copy and paste this code in Chrome DevTools console to diagnose the connection

(async function diagnoseUnifiConnection() {
  console.log('%c🔍 UNIFI CONNECTION DIAGNOSTICS', 'background: #667eea; color: white; padding: 10px; font-size: 16px; font-weight: bold;');
  
  const SERVER_URL = 'http://localhost:3001';
  const clientId = 'test-' + Math.random().toString(36).substr(2, 9);
  
  // Test 1: Verify HTTP server
  console.log('\n%c📡 Test 1: HTTP Server', 'color: #667eea; font-weight: bold;');
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const data = await response.json();
    console.log('✅ Server available:', data);
    console.log(`   └─ Connected clients: ${data.clients}`);
  } catch (error) {
    console.error('❌ Error connecting to server:', error.message);
    console.log('%c⚠️ Make sure the server is running: npm start', 'color: orange; font-weight: bold;');
    return;
  }
  
  // Test 2: Get token
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
    console.log('✅ Token obtained:', token.substring(0, 30) + '...');
  } catch (error) {
    console.error('❌ Error getting token:', error.message);
    return;
  }
  
  // Test 3: Connect WebSocket
  console.log('\n%c🔌 Test 3: WebSocket Connection', 'color: #667eea; font-weight: bold;');
  const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    console.log('   └─ State: OPEN');
    
    // Send ping
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'ping' }));
      console.log('📤 Ping sent to server');
    }, 1000);
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log(`%c📨 Message received: ${message.type}`, 'color: green; font-weight: bold;');
    console.log('   └─ Datos:', message);
    
    if (message.type === 'event') {
      console.log('%c🎯 EVENTO RECIBIDO:', 'background: #4CAF50; color: white; padding: 5px; font-weight: bold;');
      console.log('   ├─ Tipo:', message.data.type);
      console.log('   ├─ Cámara:', message.data.camera.name);
      console.log('   ├─ Severity:', message.data.severity);
      console.log('   └─ Descripción:', message.data.description);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };
  
  ws.onclose = (event) => {
    console.log(`🔌 WebSocket cerrado: ${event.code} - ${event.reason}`);
  };
  
  // Test 4: Generate test event
  console.log('\n%c🎭 Test 4: Generate simulation event', 'color: #667eea; font-weight: bold;');
  console.log('Esperando 3 segundos antes de generar evento...');
  
  setTimeout(async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/simulation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'person' })
      });
      const data = await response.json();
      console.log('✅ Simulation event generated:', data);
      console.log('   └─ Deberías ver el evento en el WebSocket arriba ↑');
    } catch (error) {
      console.error('❌ Error generating event:', error.message);
    }
  }, 3000);
  
  // Instrucciones finales
  console.log('\n%c💡 INSTRUCCIONES:', 'background: #2196F3; color: white; padding: 5px; font-weight: bold;');
  console.log('1. If you see "WebSocket connected" and "Message received: connected", the connection works');
  console.log('2. If you see an event after 3 seconds, the server is sending events correctly');
  console.log('3. Para cerrar la conexión: ws.close()');
  console.log('4. Para generar más eventos: fetch("http://localhost:3001/api/simulation/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({eventType: "person"})})');
  
  // Save ws globally for access
  window.testWs = ws;
  console.log('\n💾 WebSocket guardado en window.testWs para debugging');
  
})();

