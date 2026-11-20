// GameHub Firebase PUBLIC web app config from Firebase > Game Boy > Project Settings.
// These are public client-side identifiers, NOT Google passwords or service account keys.
// DO NOT add service-account private keys, server secrets, or OAuth client secrets here.
export const firebaseConfig = {
  apiKey: "AIzaSyAPTW232R6axWL7CWuJHbcQ4eoQTlgYWHE",
  authDomain: "little-lock-8331a.firebaseapp.com",
  projectId: "little-lock-8331a",
  storageBucket: "little-lock-8331a.firebasestorage.app",
  messagingSenderId: "459844143992",
  appId: "1:459844143992:web:28ac1578e7986ceadc168d",
  measurementId: "G-LRX2XJ28J2"
};

// Keep FALSE on the existing free Spark plan. The interface displays setup guidance,
// but no SMS will be requested. Phone auth requires Blaze billing and a configured
// Firebase Phone provider; switching it on can incur real SMS costs.
export const ENABLE_PHONE_OTP = false;
