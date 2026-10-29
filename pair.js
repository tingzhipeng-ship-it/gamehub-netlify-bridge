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

    $('librarydetail').textContent = 'CATCH and DODGE files can be downloaded for later expansion. The current firmware does not yet include a game loader.';

    if (actualDisplay && actualDisplay !== supportedScreens[type]) {
      $('selectionnote').textContent += ' Warning: paired device reports ' + actualDisplay + '.';
    }
  };

  for (const button of document.querySelectorAll('[data-display]')) {
    button.addEventListener('click', () => setDisplay(button.dataset.display));
  }
  setDisplay(selectedDisplay, false);

  function note(message) {
    $('notice').textContent = message;
  }

  // IMPORTANT FIX: never hide the PIN form, even when a token is saved.
  // This lets the user see the PIN field and pair/re-pair from the same page.
  function view() {
    $('pairpanel').classList.remove('hidden');
    $('controlpanel').classList.toggle('hidden', !token);
    $('indicator').textContent = token ? '● Browser has a saved pairing' : '● Not paired';
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
    } catch (error) {
      throw Error('The Netlify bridge is not installed or could not respond.');
    }

    if (!response.ok || !data.ok) {
      throw Error(data.error || 'Bridge error');
    }

    return data;
  }

  function forget() {
    token = '';
    sessionStorage.removeItem('gamehubToken');
    view();
    note('Pairing cleared. Enter the PIN shown on your OLED to pair again.');
  }

  $('pairform').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;

    const pin = $('pin').value.trim();
    if (!/^\d{6}$/.test(pin)) {
      note('Enter exactly six digits from the ESP32 OLED.');
      return;
    }

    busy = true;
    $('pairbtn').disabled = true;
    note('Checking pairing PIN…');

    try {
      const data = await post({ action: 'pair', pin });
      token = data.token;
      sessionStorage.setItem('gamehubToken', token);
      $('pin').value = '';
      view();
      note('Paired successfully! The controller is below.');
      await refresh();
    } catch (error) {
      note('Pairing failed: ' + error.message);
    } finally {
      busy = false;
      $('pairbtn').disabled = false;
    }
  });

  $('unpair').addEventListener('click', forget);

  async function refresh() {
    if (!token) return;

    try {
      const device = await post({ action: 'status', token });
      $('status').textContent = device.online ? 'ESP32 online' : 'ESP32 offline';
      actualDisplay = device.screen || null;
      $('detail').textContent = (device.screen || 'ESP32 display') +
        ' · ' + (device.mode || 'unknown') +
        ' · last seen ' + (device.last_seen_seconds ?? '?') + 's ago';

      if (actualDisplay === supportedScreens.oled || actualDisplay === supportedScreens.tft) {
        const detected = actualDisplay === supportedScreens.oled ? 'oled' : 'tft';
        if (detected !== selectedDisplay) {
          setDisplay(detected);
          note('Display detected: ' + actualDisplay + '. Selection updated automatically.');
        }
      }

      $('orb').classList.toggle('on', device.online);
    } catch (error) {
      if (error.message === 'pair_again') {
        forget();
      } else {
        $('status').textContent = 'Bridge unavailable';
        $('orb').classList.remove('on');
      }
    }
  }

  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('click', async () => {
      if (!token) {
        note('Enter the OLED PIN and pair the ESP32 first.');
        return;
      }

      if (Date.now() - lastButtonAt < 250) {
        note('Please use slower taps for cloud control.');
        return;
      }

      lastButtonAt = Date.now();
      try {
        await post({ action: 'command', token, key: button.dataset.key });
        note('Sent ' + button.dataset.key + ' (network delay may apply).');
      } catch (error) {
        note('Command failed: ' + error.message);
      }
    });
  }

  view();
  if (token) refresh();
  setInterval(refresh, 10000);
})();
