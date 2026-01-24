/**
 * Tests for firebaseAdmin lazy initialization utility
 * Ensures Firebase is only initialized when needed
 * Verifies singleton pattern works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFirebaseApp,
  getFirebaseDb,
  resetFirebase,
  isFirebaseInitialized,
} from '.';

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ projectId: 'test-project' })),
  getApp: vi.fn(() => {
    throw new Error('No app');
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ projectId: 'test-project' })),
}));

vi.mock('@/firebase', () => ({
  firebaseConfig: {
    apiKey: 'test-key',
    projectId: 'test-project',
  },
}));

describe('firebaseAdmin - Lazy Firebase Initialization', () => {
  beforeEach(() => {
    // Clean state before each test
    resetFirebase();
  });

  afterEach(() => {
    // Clean up after each test
    resetFirebase();
  });

  describe('getFirebaseApp', () => {
    it('should initialize Firebase app on first call', () => {
      expect(isFirebaseInitialized()).toBe(false);

      const app = getFirebaseApp();

      expect(app).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const app1 = getFirebaseApp();
      const app2 = getFirebaseApp();

      expect(app1).toBe(app2);
    });
  });

  describe('getFirebaseDb', () => {
    it('should initialize Firestore on first call', () => {
      expect(isFirebaseInitialized()).toBe(false);

      const db = getFirebaseDb();

      expect(db).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      const db1 = getFirebaseDb();
      const db2 = getFirebaseDb();

      expect(db1).toBe(db2);
    });

    it('should initialize Firebase app if not already initialized', () => {
      expect(isFirebaseInitialized()).toBe(false);

      getFirebaseDb();

      expect(isFirebaseInitialized()).toBe(true);
    });
  });

  describe('resetFirebase', () => {
    it('should clear cached instances', () => {
      getFirebaseApp();
      getFirebaseDb();
      expect(isFirebaseInitialized()).toBe(true);

      resetFirebase();

      expect(isFirebaseInitialized()).toBe(false);
    });

    it('should force reinitialization on next call', () => {
      const app1 = getFirebaseApp();
      resetFirebase();
      const app2 = getFirebaseApp();

      // Should be different instances (one was reset)
      expect(app1).not.toBe(app2);
    });
  });

  describe('isFirebaseInitialized', () => {
    it('should return false before initialization', () => {
      expect(isFirebaseInitialized()).toBe(false);
    });

    it('should return true after getFirebaseDb is called', () => {
      getFirebaseDb();
      expect(isFirebaseInitialized()).toBe(true);
    });

    it('should return false after resetFirebase is called', () => {
      getFirebaseDb();
      expect(isFirebaseInitialized()).toBe(true);

      resetFirebase();
      expect(isFirebaseInitialized()).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain single instance across multiple accesses', () => {
      const apps = [getFirebaseApp(), getFirebaseApp(), getFirebaseApp()];
      expect(new Set(apps).size).toBe(1);
    });

    it('should maintain single db instance across multiple accesses', () => {
      const dbs = [getFirebaseDb(), getFirebaseDb(), getFirebaseDb()];
      expect(new Set(dbs).size).toBe(1);
    });

    it('should maintain singleton across mixed access patterns', () => {
      const app1 = getFirebaseApp();
      const db1 = getFirebaseDb();
      const app2 = getFirebaseApp();
      const db2 = getFirebaseDb();

      expect(app1).toBe(app2);
      expect(db1).toBe(db2);
    });
  });

  describe('Lazy Loading Behavior', () => {
    it('should not initialize Firebase until functions are called', () => {
      // Just after importing, nothing should be initialized
      expect(isFirebaseInitialized()).toBe(false);
    });
  });
});
