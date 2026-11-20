// GameHub 2.0 — Google login integration, Firebase Authentication.
// Depends on firebase-config.js from the SAME folder.
// No service account credentials should appear in browser JavaScript.
// Web game data remains local in this version; this authenticates identity only.

const byId = id => document.getElementById(id);
const entry = byId("entry-google");
const login = byId("google-login");
const logout = byId("google-logout");
const authStatus = byId("auth-status");
const title = byId("auth-title");
const description = byId("auth-description");
const quick = byId("account-quick");

function setStatus(message) {
  if (authStatus) authStatus.textContent = message;
  window.GameHubAccess?.authStatus?.(message);
}
function unavailable(message) {
  if (entry) entry.disabled = true;
  if (login) login.disabled = true;
  if (logout) logout.hidden = true;
  if (authStatus) authStatus.textContent = message;
  window.GameHubAccess?.error?.(message);
}
function formatError(err) {
  switch (err?.code) {
    case "auth/popup-closed-by-user": return "Sign-in window was closed. Try again.";
    case "auth/cancelled-popup-request": return "Sign-in request cancelled. Try again.";
    case "auth/popup-blocked": return "Your browser blocked the Google popup. Allow popups for this website and try again.";
    case "auth/unauthorized-domain": return "This website is not an authorized Firebase domain. Add fanciful-churros-486d77.netlify.app under Authentication > Settings > Authorized domains.";
    case "auth/operation-not-allowed": return "Google sign-in isn't enabled in Firebase Authentication > Sign-in method.";
    case "auth/network-request-failed": return "Network error. Check your internet connection and try again.";
    case "auth/invalid-api-key": return "The Firebase web configuration has an invalid API key.";
    default: return "Google sign-in could not complete (" + String(err?.code || "unknown error") + "). Check Firebase configuration.";
  }
}

// Leave the page usable as Guest even if Firebase is unavailable or not configured.
try {
  const { firebaseConfig } = await import("./firebase-config.js");
  const needed = ["apiKey", "authDomain", "projectId", "appId"];
  const configured = needed.every(k => typeof firebaseConfig?.[k] === "string"
    && firebaseConfig[k].trim() && !firebaseConfig[k].includes("REPLACE_WITH_"));
  if (!configured) {
    unavailable("Google sign-in requires Firebase setup. Complete firebase-config.js, enable the Google provider, and authorize your Netlify domain.");
  } else {
    const version = "13.4.0"; // Firebase documented CDN version; pin to prevent untested updates.
    const [{ initializeApp }, {
      getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
    }] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`)
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    if (entry) entry.disabled = false;
    if (login) login.disabled = false;
    window.GameHubAccess?.ready?.();
    setStatus("Google authentication configured. Ready to sign in.");

    if (login) login.addEventListener("click", async () => {
      if (!window.GameHubAccess?.canSignIn?.()) return;
      login.disabled = true;
      setStatus("Opening Google sign-in…");
      try {
        const result = await signInWithPopup(auth, provider);
        const name = result.user?.displayName || result.user?.email || "Player";
        setStatus("Signed in as " + name + ". Game saves remain on this browser.");
      } catch (err) {
        setStatus(formatError(err));
      } finally { login.disabled = false; }
    });
    if (logout) logout.addEventListener("click", async () => {
      logout.disabled = true;
      try { await signOut(auth); setStatus("Signed out of Google."); }
      catch (err) { setStatus(formatError(err)); }
      finally { logout.disabled = false; }
    });
    onAuthStateChanged(auth, user => {
      if (user) {
        const name = user.displayName || user.email || "Player";
        if (title) title.textContent = "Welcome, " + name;
        if (description) description.textContent = "Google account verified by Firebase. Your GameHub games still save to this browser only.";
        if (login) login.hidden = true;
        if (logout) logout.hidden = false;
        if (quick) quick.textContent = "◉ " + name;
        window.GameHubAccess?.signedIn?.(user);
        if (authStatus) authStatus.textContent = "Signed in as " + name + ". Game saves stay local.";
      } else {
        if (title) title.textContent = "Google sign-in";
        if (description) description.textContent = "Sign in with your Google account using Firebase Authentication.";
        if (login) login.hidden = false;
        if (logout) logout.hidden = true;
        if (quick && !document.body.classList.contains("guest-mode")) quick.textContent = "◉ Google sign-in";
        window.GameHubAccess?.signedOut?.();
      }
    }, err => setStatus(formatError(err)));
  }
} catch (err) {
  console.error("GameHub Google auth initialization error:", err);
  unavailable("Google sign-in could not initialize. Check your connection, Firebase configuration, and browser console.");
}
