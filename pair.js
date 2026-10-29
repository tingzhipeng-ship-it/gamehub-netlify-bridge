(() => {
  'use strict';

  const api = '/.netlify/functions/bridge';
  const $ = id => document.getElementById(id);
  let token = sessionStorage.getItem('gamehubToken') || '';
  const supportedScreens = {
    oled: 'SH1106 128x64',
    tft: 'ILI9341 320x240'
  };
  let selectedDisplay = localStorage.getItem('gamehubDisplay') === 'tft' ? 'tft' : 'oled';
  let actualDisplay = null;
  let busy = false;
  let lastButtonAt = 0;

  // USB Web Serial state is separate from Wi-Fi PIN pairing.
  let usbPort = null;
  let usbWriter = null;
  let usbReader = null;
  let usbKeepalive = null;
  let usbReady = false;
  let usbBusy = false;
  let lastUsbCommandAt = 0;

  const usbKeyButtons = Array.from(document.querySelectorAll('[data-usb-key]'));
  const cloudKeyButtons = Array.from(document.querySelectorAll('[data-key]'));

  function note(message) {
    $('notice').textContent = message;
  }

  function usbNote(message, kind = '') {
    $('usb-notice').textContent = message;
    $('usb-notice').className = 'hint' + (kind ? ' ' + kind : '');
  }

  function updateIndicator() {
    if (token && usbPort) $('indicator').textContent = '● PIN + USB connected';
    else if (usbPort) $('indicator').textContent = '● USB connected';
    else if (token) $('indicator').textContent = '● PIN paired';
    else $('indicator').textContent = '● Not paired';
  }

  const setDisplay = (type, save = true) => {
    selectedDisplay = type;
    if (save) localStorage.setItem('gamehubDisplay', type);
    for (const button of document.querySelectorAll('[data-display]')) {
      const yes = button.dataset.display === type;
      button.classList.toggle('selected', yes);
      button.setAttribute('aria-pressed', String(yes));
    }
    $('selectionnote').textContent = type === 'oled'
      ? '1.3-inch OLED selected · SH1106 · button controls.'
      : '2.8-inch colour display selected · touchscreen and microSD integration pending hardware verification.';
    $('librarydetail').textContent = 'CATCH and DODGE files can be downloaded for later expansion. Your current all-in-one Snake/Pong firmware does not yet include a game loader.';
    if (actualDisplay && actualDisplay !== supportedScreens[type]) {
      $('selectionnote').textContent += ' Warning: paired device reports ' + actualDisplay + '.';
    }
  };

  for (const button of document.querySelectorAll('[data-display]')) {
    button.addEventListener('click', () => setDisplay(button.dataset.display));
  }
  setDisplay(selectedDisplay, false);

  // Keep the PIN option visible even when this browser already has a token.
  // This lets users use both connection methods from the same page.
  function view() {
    $('pairpanel').classList.remove('hidden');
    $('controlpanel').classList.toggle('hidden', !token);
    updateIndicator();
  }

  async function post(body) {
    const response = await fetch(api, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw Error('The Netlify bridge is not installed or could not respond.');
    }
    if (!response.ok || !data.ok) throw Error(data.error || 'Bridge error');
    return data;
  }

  function forget() {
    token = '';
    sessionStorage.removeItem('gamehubToken');
    view();
    note('PIN pairing cleared for this browser. USB connection remains independent.');
  }

  $('pairform').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const pin = $('pin').value.trim();
    if (!/^\d{6}$/.test(pin)) return note('Enter exactly six digits.');

    busy = true;
    $('pairbtn').disabled = true;
    note('Checking pairing PIN…');

    try {
      const data = await post({ action: 'pair', pin });
      token = data.token;
      sessionStorage.setItem('gamehubToken', token);
      $('pin').value = '';
      view();
      note('Paired by PIN! The Wi-Fi remote controller is below. USB remains available too.');
      await refresh();
    } catch (error) {
      note('PIN pairing failed: ' + error.message + '. You can still choose USB cable below.');
    } finally {
      busy = false;
      $('pairbtn').disabled = false;
    }
  });

  $('unpair').addEventListener('click', forget);

  async function refresh() {
    if (!token) return;
    try {
      const data = await post({ action: 'status', token });
      $('status').textContent = data.online ? 'ESP32 online' : 'ESP32 offline';
      actualDisplay = data.screen || null;
      $('detail').textContent = (data.screen || 'ESP32 display') + ' · ' + data.mode + ' · last seen ' + (data.last_seen_seconds ?? '?') + 's ago';
      if (actualDisplay === supportedScreens.oled || actualDisplay === supportedScreens.tft) {
        const detected = actualDisplay === supportedScreens.oled ? 'oled' : 'tft';
        if (detected !== selectedDisplay) {
          setDisplay(detected);
          note('Display detected: ' + actualDisplay + '. Selection updated automatically.');
        }
      }
      $('orb').classList.toggle('on', data.online);
    } catch (error) {
      if (error.message === 'pair_again') forget();
      else {
        $('status').textContent = 'Bridge unavailable';
        $('orb').classList.remove('on');
      }
    }
  }

  for (const button of cloudKeyButtons) {
    button.addEventListener('click', async () => {
      if (!token) return;
      if (Date.now() - lastButtonAt < 250) return note('Please use slower taps for cloud control.');
      lastButtonAt = Date.now();
      try {
        await post({ action: 'command', token, key: button.dataset.key });
        note('Sent ' + button.dataset.key + ' over Wi-Fi. Delivery depends on network delay.');
      } catch (error) {
        note('Wi-Fi command failed: ' + error.message);
      }
    });
  }

  // ---------------- USB CABLE CONNECTION ----------------

  function updateUsbView() {
    const connected = Boolean(usbPort);
    $('usb-connect').disabled = connected || usbBusy;
    $('usb-disconnect').disabled = !connected;
    $('usb-controls').classList.toggle('hidden', !connected);
    $('usb-orb').classList.toggle('on', connected && usbReady);
    $('usb-status').textContent = !connected
      ? 'USB not connected'
      : (usbReady ? 'GameHub firmware ready' : 'USB port open; waiting for firmware');
    $('usb-detail').textContent = !connected
      ? 'Wi-Fi PIN pairing remains available above.'
      : (usbReady ? 'Direct cable control is active.' : 'Keep the page open; waiting for GAMEHUB_USB_READY.');
    updateIndicator();
  }

  async function sendUsbLine(line) {
    if (!usbWriter) throw new Error('Connect the ESP32 USB port first.');
    await usbWriter.write(new TextEncoder().encode(line + '\n'));
  }

  async function readUsb(port) {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    usbReader = reader;
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (usbPort === port) {
        const result = await reader.read();
        if (result.done) break;
        if (!result.value) continue;
        buffer += decoder.decode(result.value, { stream: true });
        if (buffer.length > 1800) buffer = buffer.slice(-600);
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.includes('GAMEHUB_USB_READY')) {
            usbReady = true;
            updateUsbView();
            usbNote('USB controller ready. Use the buttons below or the keyboard.', 'good');
          }
        }
      }
    } catch (error) {
      if (usbPort === port) usbNote('USB read error: ' + (error.message || String(error)), 'bad');
    } finally {
      try { reader.releaseLock(); } catch (_) {}
      if (usbReader === reader) usbReader = null;
    }
  }

  async function connectUsb() {
    if (!('serial' in navigator)) {
      usbNote('Web Serial is not supported in this browser. Use desktop Chrome or Edge on this HTTPS page.', 'bad');
      return;
    }
    if (usbBusy || usbPort) return;

    usbBusy = true;
    $('usb-connect').disabled = true;
    try {
      usbNote('Choose the ESP32 serial port in the browser permission window…');
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      usbPort = selectedPort;
      usbReady = false;
      usbWriter = selectedPort.writable.getWriter();
      updateUsbView();
      usbNote('USB port opened. Waiting for the GameHub firmware…');
      readUsb(selectedPort); // starts the read loop; do not block the UI
      await sendUsbLine('PING');
      usbKeepalive = setInterval(() => {
        sendUsbLine('PING').catch(error => {
          if (usbPort) usbNote('USB write error: ' + (error.message || String(error)), 'bad');
        });
      }, 2000);
    } catch (error) {
      usbNote('Could not connect: ' + (error.message || String(error)) + '. Close ESP IDE/ViperIDE serial monitors and try again.', 'bad');
      await disconnectUsb(false);
    } finally {
      usbBusy = false;
      updateUsbView();
    }
  }

  async function disconnectUsb(showMessage = true) {
    if (usbKeepalive) {
      clearInterval(usbKeepalive);
      usbKeepalive = null;
    }
    const oldPort = usbPort;
    const oldReader = usbReader;
    const oldWriter = usbWriter;
    usbPort = null;
    usbReader = null;
    usbWriter = null;
    usbReady = false;

    if (oldReader) {
      try { await oldReader.cancel(); } catch (_) {}
      try { oldReader.releaseLock(); } catch (_) {}
    }
    if (oldWriter) {
      try { oldWriter.releaseLock(); } catch (_) {}
    }
    if (oldPort) {
      try { await oldPort.close(); } catch (_) {}
    }

    updateUsbView();
    if (showMessage) usbNote('USB disconnected. Wi-Fi PIN pairing is still available above.');
  }

  $('usb-connect').addEventListener('click', connectUsb);
  $('usb-disconnect').addEventListener('click', () => disconnectUsb(true));

  for (const button of usbKeyButtons) {
    button.addEventListener('click', async () => {
      const key = button.dataset.usbKey;
      if (!usbPort || !usbWriter) {
        usbNote('Connect the ESP32 by USB first.', 'bad');
        return;
      }
      if (Date.now() - lastUsbCommandAt < 90) return;
      lastUsbCommandAt = Date.now();
      try {
        await sendUsbLine('KEY ' + key);
        usbNote('Sent ' + key + ' over USB.', 'good');
      } catch (error) {
        usbNote('USB command failed: ' + (error.message || String(error)), 'bad');
      }
    });
  }

  window.addEventListener('keydown', event => {
    if (event.repeat || event.target.closest('button, input, textarea, select')) return;
    const map = {
      ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
      x: 'A', X: 'A', z: 'B', Z: 'B', Enter: 'START', Shift: 'SELECT'
    };
    const key = map[event.key];
    if (key && usbPort && usbWriter) {
      event.preventDefault();
      sendUsbLine('KEY ' + key).then(() => usbNote('Sent ' + key + ' over USB.', 'good'))
        .catch(error => usbNote('USB command failed: ' + (error.message || String(error)), 'bad'));
    }
  });

  if ('serial' in navigator) {
    navigator.serial.addEventListener('disconnect', event => {
      if (usbPort && event.target === usbPort) {
        disconnectUsb(false).then(() => usbNote('ESP32 USB cable disconnected. Wi-Fi PIN pairing remains available.', 'bad'));
      }
    });
  }

  view();
  updateUsbView();
  if (token) refresh();
  setInterval(refresh, 10000);
})();
