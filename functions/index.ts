// Firebase Cloud Functions entry point
import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/https';
import * as logger from 'firebase-functions/logger';

admin.initializeApp();
setGlobalOptions({ maxInstances: 10 });

// Example function (for reference/health checks)
export const helloWorld = onRequest((request, response) => {
  logger.info('Hello logs!', { structuredData: true });
  response.send('Hello from Firebase!');
});
