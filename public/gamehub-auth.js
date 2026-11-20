// GameHub 2.0 Firebase Authentication — Google, Email/Password, Guest.
// A valid Yahoo / Outlook / other email address works with email + password.
// This is NOT Yahoo OAuth: players create a separate GameHub password.
// Game data is still saved locally, not synced into Firebase.

const el = id => document.getElementById(id);
const entryGoogle = el('entry-google');
const googleLogin = el('google-login');
const googleLogout = el('google-logout');
const accountQuick = el('account-quick');
const authStatus = el('auth-status');
const authTitle = el('auth-title');
const authDescription = el('auth-description');
const emailIds = ['entry', 'account'];
const phonePlaces = ['entry', 'account'];
const phoneSessions = Object.create(null);
const forms = Object.fromEntries(emailIds.map(k => [k, el(`${k}-email-form`)]));
const authButtons = [entryGoogle, googleLogin, ...emailIds.flatMap(k =>
  ['signin', 'signup', 'reset'].map(action => el(`${k}-email-${action}`)))];

function showStatus(message) {
  if (authStatus) authStatus.textContent = message;
  window.GameHubAccess?.authStatus?.(message);
}
function setEnabled(value) {
  for (const button of authButtons) if (button) button.disabled = !value;
}
function formatError(err) {
  switch (err?.code) {
    case 'auth/popup-closed-by-user': return 'Google sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked': return 'The popup was blocked. Allow popups for GameHub and try again.';
    case 'auth/cancelled-popup-request': return 'Another popup is open. Close it and try again.';
    case 'auth/unauthorized-domain': return 'This site is not an authorized Firebase domain.';
    case 'auth/operation-not-allowed': return 'This sign-in method is not enabled in Firebase.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/email-already-in-use': return 'This email is already registered. Sign in or reset your password.';
    case 'auth/weak-password': return 'Choose a stronger password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'The email or password was incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Cannot reach Firebase. Check the internet connection.';
    case 'auth/invalid-api-key': return 'The Firebase configuration is invalid.';
    default: return 'Sign-in could not complete (' + String(err?.code || 'unknown error') + ').';
  }
}
function setIdentity(user) {
  const name = user?.displayName || user?.email || 'Player';
  if (authTitle) authTitle.textContent = user ? 'Welcome, ' + name : 'Account sign-in';
  if (authDescription) authDescription.textContent = user
    ? 'Signed in using Firebase. Your games still save to this browser, not the cloud.'
    : 'Use Google, email and password, or Guest Mode.';
  if (googleLogin) googleLogin.hidden = Boolean(user);
  if (googleLogout) googleLogout.hidden = !user;
  if (accountQuick && user) accountQuick.textContent = '◉ ' + name;
}
function showFailure(message) {
  showStatus(message + ' You can still use Guest Mode.');
  window.GameHubAccess?.error?.(message);
  setEnabled(false);
}
function toggleForm(formName) {
  const form = forms[formName];
  if (!form) return;
  form.hidden = !form.hidden;
  if (!form.hidden) el(`${formName}-email-address`)?.focus();
}
for (const place of emailIds) {
  el(`${place}-email-toggle`)?.addEventListener('click', () => toggleForm(place));
}

// Offline use never requires an account. Firebase loading failures don't block Guest.
try {
  const { firebaseConfig, ENABLE_PHONE_OTP = false } = await import('./firebase-config.js');
  const required = ['apiKey','authDomain','projectId','appId'];
  if (!required.every(k => typeof firebaseConfig?.[k] === 'string' && firebaseConfig[k].trim() && !firebaseConfig[k].includes('REPLACE_WITH_'))) {
    showFailure('Firebase configuration is incomplete.');
  } else {
    // Firebase SDK 13.4.0 is documented by Firebase (Nov 2026).
    const [{ initializeApp }, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')
    ]);
    const {
      getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
      createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
      RecaptchaVerifier, signInWithPhoneNumber
    } = authModule;
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({prompt:'select_account'});
    setEnabled(true);
    showStatus('Google, email sign-in and Guest Mode are available.');
    window.GameHubAccess?.ready?.();

    // Guest users may deliberately upgrade to account sign-in from the Account page.
    let upgradingGuest = false;
    // Firebase state change is authoritative. No fake account names or sign-in success.
    onAuthStateChanged(auth, user => {
      if (document.body.classList.contains('guest-mode') && !upgradingGuest) {
        if (user) void signOut(auth).catch(() => {});
        return;
      }
      setIdentity(user);
      if (user) {
        upgradingGuest = false;
        window.GameHubAccess?.signedIn?.(user);
        showStatus('Signed in as ' + (user.email || user.displayName || 'Player') + '. Games remain on this browser.');
      } else {
        window.GameHubAccess?.signedOut?.();
      }
    }, err => showStatus(formatError(err)));

    async function runAuth(button, task, verb) {
      if (!window.GameHubAccess?.canSignIn?.()) return;
      upgradingGuest = document.body.classList.contains('guest-mode');
      if (button) button.disabled = true;
      showStatus(verb + '…');
      try {
        await task();
        // Wait for the Firebase auth-state observer to update the app.
      } catch (err) {
        upgradingGuest = false;
        showStatus(formatError(err));
      } finally {
        if (button) button.disabled = false;
      }
    }
    // Call signInWithPopup directly in the trusted click handler.
    // IMPORTANT: Call Firebase DIRECTLY from whichever visible button was clicked.
    // Forwarding a click from the gate to a hidden button can lose browser popup permission.
    for (const button of [entryGoogle, googleLogin]) {
      button?.addEventListener('click', () => {
        void runAuth(button, () => signInWithPopup(auth, googleProvider), 'Opening Google sign-in');
      });
    }

    for (const place of emailIds) {
      const form = forms[place];
      const email = el(`${place}-email-address`);
      const password = el(`${place}-email-password`);
      const submit = el(`${place}-email-signin`);
      const signup = el(`${place}-email-signup`);
      const reset = el(`${place}-email-reset`);
      const credentials = () => [email.value.trim(), password.value];
      form?.addEventListener('submit', event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const [address, pass] = credentials();
        void runAuth(submit, () => signInWithEmailAndPassword(auth, address, pass), 'Signing in');
      });
      signup?.addEventListener('click', () => {
        if (!form.reportValidity()) return;
        const [address, pass] = credentials();
        void runAuth(signup, () => createUserWithEmailAndPassword(auth, address, pass), 'Creating account');
      });
      reset?.addEventListener('click', async () => {
        if (!email.checkValidity() || !email.value.trim()) {
          showStatus('Enter your email address above to reset your password.');
          email.focus();
          return;
        }
        reset.disabled = true;
        try {
          await sendPasswordResetEmail(auth, email.value.trim());
          showStatus('If that email has a GameHub account, check its inbox for the reset instructions.');
        } catch (err) { showStatus(formatError(err)); }
        finally { reset.disabled = false; }
      });
    }
    googleLogout?.addEventListener('click', async () => {
      googleLogout.disabled = true;
      try { await signOut(auth); showStatus('Signed out. Choose Guest, email, or Google.'); }
      catch (err) { showStatus(formatError(err)); }
      finally { googleLogout.disabled = false; }
    });
    // Optional phone OTP setup. On Spark, no SMS controls are enabled.
    // Sending any SMS requires both ENABLE_PHONE_OTP and project-side paid setup.
    // Initialize reCAPTCHA on demand only after the user opens the phone form.
    for (const place of phonePlaces) {
      const toggle = el(`${place}-phone-toggle`);
      const panel = el(`${place}-phone-panel`);
      const help = el(`${place}-phone-help`);
      const number = el(`${place}-phone-number`);
      const send = el(`${place}-phone-send`);
      const code = el(`${place}-phone-code`);
      const confirm = el(`${place}-phone-confirm`);
      if (!toggle || !panel || !number || !send || !code || !confirm || !help) continue;
      const enabled = ENABLE_PHONE_OTP === true;
      if (enabled) {
        help.textContent = 'Phone verification requires SMS service enabled in Firebase, reCAPTCHA, and Blaze billing. SMS charges may apply.';
        number.disabled = false;
        send.disabled = false;
      }
      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
      });
      if (!enabled) continue;
      send.addEventListener('click', async () => {
        const phone = number.value.trim();
        if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
          showStatus('Enter your phone in international format, such as +60123456789.');
          return;
        }
        if (!window.GameHubAccess?.canSignIn?.()) return;
        send.disabled = true;
        showStatus('Preparing phone verification…');
        try {
          let verifier = phoneSessions[place]?.verifier;
          if (!verifier) {
            verifier = new RecaptchaVerifier(auth, `${place}-phone-recaptcha`, {size:'normal'});
            phoneSessions[place] = {verifier};
            await verifier.render();
          }
          const result = await signInWithPhoneNumber(auth, phone, verifier);
          phoneSessions[place].result = result;
          code.disabled = false;
          confirm.disabled = false;
          showStatus('Verification code requested. Check your phone if SMS delivery is available.');
        } catch (err) {
          showStatus(formatError(err));
          const old = phoneSessions[place];
          if (old?.verifier) {
            try { old.verifier.clear(); } catch (_) {}
            phoneSessions[place] = null;
            el(`${place}-phone-recaptcha`).replaceChildren();
          }
        } finally { send.disabled = false; }
      });
      confirm.addEventListener('click', async () => {
        const entry = phoneSessions[place];
        if (!entry?.result) { showStatus('Request a verification code first.'); return; }
        const value = code.value.trim();
        if (!/^\d{6}$/.test(value)) { showStatus('Enter the six-digit code from your SMS.'); return; }
        upgradingGuest = document.body.classList.contains('guest-mode');
        confirm.disabled = true;
        try {
          await entry.result.confirm(value);
          showStatus('Verification accepted. Finishing sign-in…');
        } catch (err) {
          upgradingGuest = false;
          showStatus(formatError(err));
        } finally { confirm.disabled = false; }
      });
    }
    // The AI assistant shares this SAME real Firebase user/session.
    // Tokens are never put into URL parameters or localStorage by our code.
    window.GameHubAuth = {
      getIdToken: async () => auth.currentUser ? await auth.currentUser.getIdToken() : null,
      signOutForGuest: () => {
        if (auth.currentUser) return signOut(auth).catch(() => {});
        return Promise.resolve();
      }
    };
  }
} catch (err) {
  console.error('GameHub Firebase initialization failed:', err);
  showFailure('Authentication could not load. Check the scripts, network and browser console.');
}
