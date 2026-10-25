GAMEHUB MINI FULL NETLIFY PROJECT — STATIC SITE + CLOUD PIN BRIDGE
================================================================

This is source that MUST be built by Netlify for Functions support.
Do NOT assume a manual static drag-and-drop deploy installs/functions a cloud backend.
To use backend, connect a Git repo to Netlify and deploy this project, ensuring
that Netlify runs the build and installs @netlify/blobs. Project publish = public.
If Netlify Drop offers a project-build option while logged in, that may work too;
verify functions are deployed by visiting:
https://YOUR-SITE.netlify.app/.netlify/functions/bridge
Expected: a JSON body containing "service":"GameHub Mini bridge v1".

The ESP32 cloud code uses HTTPS and sends an announce/poll with device secret; the
browser pairing page uses the PIN. Device and browser must both have internet.
Note earlier MicroPython TLS support may not validate the server certificate and
firmware requires physical hardware tests. Do not use this prototype for sensitive data.

BACKUP your current site first. The previous Firebase/Google account system is not
recreated here; new dashboard is browser-local guest functionality only.
