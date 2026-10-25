GAMEHUB MINI — NETLIFY DROP WEBSITE (STATIC)
===========================================

This ZIP is ready to upload to Netlify Drop. index.html is at ZIP root.

CONTENTS
- index.html: GameHub browser dashboard, Snake/Pong browser games, easy/normal/hard difficulty, pixel studio, themes, guest profile.
- pair.html + pair.js + pair.css: ESP32 OLED/touchscreen display selector, PIN form and remote controller UI.
- games/: optional standalone game modules that require an extended firmware game loader.

WARNING: This rebuild is NOT an exact copy of your old GameHub Neo site.
Your previous Firebase/Google login, accounts, stored data, and themes are NOT automatically recovered.
Download a backup of your existing Netlify deploy before you replace it.

To deploy:
1. Sign in to Netlify and select your existing site fanciful-churros-486d77.
2. Back up or download its earlier successful deploy first.
3. Use Netlify Drop / site's production deploy area to upload this ZIP or extracted folder.
4. Check the published Deploy file browser contains index.html at its root.
5. Open the website; browser games and pixel studio work without the ESP32.

PAIRING IS NOT AUTOMATICALLY WORKING IN THIS STATIC ZIP.
You also need the companion source/build version containing netlify/functions/bridge.mjs,
a backend build/deploy with @netlify/blobs, and compatible ESP32 firmware.
The earlier ESP32 all-in-one firmware cloud connection is prototype and has not been
hardware-verified; TLS server certificate validation may be missing.

To use PIN pairing, deploy the "GameHub_Netlify_With_Cloud_Source.zip" project
through a Netlify build (e.g. Git repo deploy) with functions and Blobs installed.
The function can be checked at /.netlify/functions/bridge; its GET response
should report GameHub Mini bridge v1.
