export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const requiredFirebaseConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

export function hasCompleteFirebaseConfig(
  config: Record<string, unknown>,
): boolean {
  return requiredFirebaseConfigKeys.every(
    (key) =>
      typeof config[key] === "string" &&
      (config[key] as string).trim().length > 0,
  );
}

export const isFirebaseConfigured = hasCompleteFirebaseConfig(firebaseConfig);
