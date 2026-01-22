"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.helloWorld = exports.products = void 0;
// Firebase Cloud Functions entry point
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/https");
const logger = __importStar(require("firebase-functions/logger"));
admin.initializeApp();
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
// GET /api/products - Fetch all products
exports.products = (0, https_1.onRequest)(async (request, response) => {
    // Enable CORS
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') {
        response.status(204).send('');
        return;
    }
    if (request.method !== 'GET') {
        response.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const db = admin.firestore();
        const snapshot = await db.collection('products').get();
        const productsList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
        logger.info(`Fetched ${productsList.length} products`);
        response.status(200).json({ products: productsList });
    }
    catch (error) {
        logger.error('Error fetching products:', error);
        response.status(500).json({ error: 'Failed to fetch products' });
    }
});
// Example function (keep for reference)
exports.helloWorld = (0, https_1.onRequest)((request, response) => {
    logger.info('Hello logs!', { structuredData: true });
    response.send('Hello from Firebase!');
});
//# sourceMappingURL=index.js.map