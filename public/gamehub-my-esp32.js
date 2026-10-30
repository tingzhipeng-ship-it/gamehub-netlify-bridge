(() => {
  'use strict';
  const API = '/.netlify/functions/bridge';
  const $ = id => document.getElementById(id);
  const cloudKeys = ['UP','DOWN','LEFT','RIGHT','A','B','START','SELECT'];
  const views = ['dashboard','store','create','mygames','upload','storage','editions','myesp32','account','widgets','settings'];
  let token = sessionStorage.getItem('gamehubToken') || localStorage.getItem('gamehubToken') || '';
  let cloudBusy = false;
  let lastCloudTap = 0;
  let usbPort = null, usbReader = null, usbWriter = null, usbReady = false, usbKeepalive = null;

  function showView(name) {
    if (!views.includes(name)) name = 'myesp32';
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + name));
    document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === name));
    $('crumbname').textContent = name === 'myesp32' ? 'My ESP32' : name.charAt(0).toUpperCase() + name.slice(1);
    history.replaceState(null, '', '#' + name);
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showView(b.dataset.go)));
  const initial = location.hash.replace('#','');
  showView(views.includes(initial) ? initial : 'myesp32');

  function setCloudMessage(message, type='') {
    $('pin-status').textContent = message;
    $('pin-status').className = 'status' + (type ? ' ' + type : '');
  }
  function updateGlobal() {
    const online = $('cloud-state').textContent === 'ESP32 online';
    const connected = !!usbPort && usbReady;
    const pill = $('global-state');
    if (online && connected) pill.textContent = '● PIN + USB CONNECTED';
    else if (online) pill.textContent = '● DEVICE ONLINE · PIN';
    else if (connected) pill.textContent = '● DEVICE CONNECTED · USB';
    else pill.textContent = '● DEVICE OFFLINE';
    pill.classList.toggle('online', online || connected);
  }
  async function bridgePost(payload) {
    const response = await fetch(API, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload), cache: 'no-store'
    });
    const data = await response.json().catch(() => { throw new Error('Bridge did not return JSON. Check the Netlify Function deployment.'); });
    if (!response.ok || !data.ok) throw new Error(data.error || 'Bridge request failed');
    return data;
  }
  function showCloudControls() { $('cloud-controls').hidden = !token; }
  async function refreshCloud() {
    if (!token) return;
    try {
      const data = await bridgePost({action:'status', token});
      $('cloud-state').textContent = data.online ? 'ESP32 online' : 'Device offline';
      $('cloud-detail').textContent = (data.screen || 'ESP32') + ' · ' + (data.mode || 'unknown') + ' · last seen ' + (data.last_seen_seconds ?? '?') + 's ago';
      $('cloud-dot').classList.toggle('on', !!data.online);
      updateGlobal();
    } catch (err) {
      $('cloud-state').textContent = 'Bridge unavailable';
      $('cloud-detail').textContent = err.message;
      $('cloud-dot').classList.remove('on');
      updateGlobal();
      if (err.message === 'pair_again') forgetPin();
    }
  }
  function forgetPin() {
    token = '';
    sessionStorage.removeItem('gamehubToken');
    localStorage.removeItem('gamehubToken');
    showCloudControls();
    $('cloud-state').textContent = 'Device offline';
    $('cloud-detail').textContent = 'PIN pairing disconnected. USB remains independent.';
    $('cloud-dot').classList.remove('on');
    setCloudMessage('PIN pairing removed from this browser. You can still connect by USB.');
    updateGlobal();
  }
  $('pin-input').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g,'').slice(0,6); });
  $('pin-pair').addEventListener('click', async () => {
    if (cloudBusy) return;
    const pin = $('pin-input').value.trim();
    if (!/^\d{6}$/.test(pin)) { setCloudMessage('Enter exactly six digits from the ESP32 OLED.', 'bad'); return; }
    cloudBusy = true; $('pin-pair').disabled = true; setCloudMessage('Checking your PIN with the GameHub bridge…');
    try {
      const result = await bridgePost({action:'pair', pin});
      token = result.token;
      sessionStorage.setItem('gamehubToken', token);
      localStorage.setItem('gamehubToken', token);
      $('pin-input').value = '';
      showCloudControls();
      setCloudMessage('PIN accepted! Your browser is paired. Checking ESP32 status…', 'good');
      await refreshCloud();
    } catch (err) {
      setCloudMessage('Pairing failed: ' + err.message, 'bad');
    } finally { cloudBusy = false; $('pin-pair').disabled = false; }
  });
  $('forget-pin').addEventListener('click', forgetPin);
  document.querySelectorAll('[data-cloud]').forEach(button => button.addEventListener('click', async () => {
    if (!token) return;
    if (Date.now() - lastCloudTap < 220) return;
    lastCloudTap = Date.now();
    try { await bridgePost({action:'command', token, key:button.dataset.cloud}); setCloudMessage('Sent ' + button.dataset.cloud + ' over Wi-Fi.', 'good'); }
    catch (err) { setCloudMessage('Command failed: ' + err.message, 'bad'); }
  }));
  showCloudControls();
  if (token) refreshCloud();
  setInterval(refreshCloud, 10000);

  // USB Web Serial: ESP32 firmware accepts PING and KEY <BUTTON> lines.
  function updateUsb() {
    $('usb-connect').disabled = !!usbPort;
    $('usb-disconnect').disabled = !usbPort;
    $('usb-controls').hidden = !usbPort || !usbReady;
    $('usb-state').textContent = !usbPort ? 'USB offline' : (usbReady ? 'USB connected' : 'USB port open');
    $('usb-detail').textContent = !usbPort ? 'Waiting for the GameHub USB firmware.' : (usbReady ? 'Direct serial control is active.' : 'Waiting for GAMEHUB_USB_READY from firmware.');
    $('usb-dot').classList.toggle('on', !!usbPort && usbReady);
    updateGlobal();
  }
  async function sendUsb(line) {
    if (!usbWriter) throw new Error('USB port is not connected.');
    await usbWriter.write(new TextEncoder().encode(line + '\n'));
  }
  async function readUsb(port) {
    if (!port.readable) return;
    const reader = port.readable.getReader(); usbReader = reader;
    const decoder = new TextDecoder(); let buffer = '';
    try {
      while (usbPort === port) {
        const result = await reader.read();
        if (result.done) break;
        if (!result.value) continue;
        buffer += decoder.decode(result.value, {stream:true});
        if (buffer.length > 1600) buffer = buffer.slice(-600);
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.includes('GAMEHUB_USB_READY')) {
            usbReady = true; updateUsb();
            $('usb-status').textContent = 'USB controller ready. Use the controls on this page.';
            $('usb-status').className = 'status good';
          }
        }
      }
    } catch (err) {
      if (usbPort === port) { $('usb-status').textContent = 'USB read error: ' + err.message; $('usb-status').className = 'status bad'; }
    } finally {
      try { reader.releaseLock(); } catch (_) {}
      if (usbReader === reader) usbReader = null;
    }
  }
  async function disconnectUsb(showMessage=true) {
    if (usbKeepalive) { clearInterval(usbKeepalive); usbKeepalive = null; }
    const oldPort = usbPort, oldReader = usbReader, oldWriter = usbWriter;
    usbPort = null; usbReader = null; usbWriter = null; usbReady = false;
    if (oldReader) { try { await oldReader.cancel(); } catch (_) {} try { oldReader.releaseLock(); } catch (_) {} }
    if (oldWriter) { try { oldWriter.releaseLock(); } catch (_) {} }
    if (oldPort) { try { await oldPort.close(); } catch (_) {} }
    updateUsb();
    if (showMessage) { $('usb-status').textContent = 'USB disconnected. PIN pairing remains available.'; $('usb-status').className = 'status'; }
  }
  $('usb-connect').addEventListener('click', async () => {
    if (!('serial' in navigator)) {
      $('usb-status').textContent = 'Web Serial is unavailable. Use desktop Chrome or Edge on the HTTPS GameHub page.';
      $('usb-status').className = 'status bad'; return;
    }
    try {
      $('usb-status').textContent = 'Choose the ESP32 serial port…';
      const port = await navigator.serial.requestPort();
      await port.open({baudRate:115200, dataBits:8, stopBits:1, parity:'none', flowControl:'none'});
      usbPort = port; usbReady = false; usbWriter = port.writable.getWriter(); updateUsb();
      $('usb-status').textContent = 'USB port opened. Waiting for GameHub firmware…';
      readUsb(port);
      await sendUsb('PING');
      usbKeepalive = setInterval(() => sendUsb('PING').catch(err => {
        $('usb-status').textContent = 'USB write error: ' + err.message;
        $('usb-status').className = 'status bad';
      }), 2000);
    } catch (err) {
      $('usb-status').textContent = 'USB connection failed: ' + err.message + '. Close ESP IDE/ViperIDE serial monitors, then retry.';
      $('usb-status').className = 'status bad';
      await disconnectUsb(false);
    }
  });
  $('usb-disconnect').addEventListener('click', () => disconnectUsb(true));
  document.querySelectorAll('[data-usb]').forEach(button => button.addEventListener('click', async () => {
    try { await sendUsb('KEY ' + button.dataset.usb); $('usb-status').textContent = 'Sent ' + button.dataset.usb + ' over USB.'; $('usb-status').className = 'status good'; }
    catch (err) { $('usb-status').textContent = err.message; $('usb-status').className = 'status bad'; }
  }));
  if ('serial' in navigator) navigator.serial.addEventListener('disconnect', event => { if (usbPort && event.target === usbPort) disconnectUsb(true); });
  window.addEventListener('beforeunload', () => { if (usbKeepalive) clearInterval(usbKeepalive); });
  updateUsb();
})();
