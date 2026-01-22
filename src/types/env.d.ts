interface ImportMetaEnv {
  // Vite built-in environment variables
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
  
  // Custom environment variables
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  // add other VITE_ keys as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
