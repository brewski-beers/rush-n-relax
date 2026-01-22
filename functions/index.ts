// Firebase Cloud Functions entry point
// Move TypeScript code from src/src/index.ts here

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

setGlobalOptions({ maxInstances: 10 });

// Example function
export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});
