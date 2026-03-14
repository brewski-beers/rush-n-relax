import {
  AUTH_USER_FIXTURES,
  FIXTURE_DATASET_VERSION,
  FIXTURE_TIMESTAMP,
} from '../../src/lib/fixtures';

export interface AuthSeedProvider {
  providerId: 'google.com';
  uid: string;
  email: string;
  displayName: string;
}

export interface AuthSeedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  customClaims: {
    role: string;
  };
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
  providerData: AuthSeedProvider[];
}

export interface AuthSeedArtifact {
  version: string;
  generatedAt: string;
  datasetVersion: string;
  users: AuthSeedUser[];
}

export function buildAuthSeedArtifact(): AuthSeedArtifact {
  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    datasetVersion: FIXTURE_DATASET_VERSION,
    users: AUTH_USER_FIXTURES.map(user => ({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      customClaims: {
        role: user.role,
      },
      metadata: {
        creationTime: FIXTURE_TIMESTAMP,
        lastSignInTime: FIXTURE_TIMESTAMP,
      },
      providerData: user.providers.map(provider => ({
        providerId: provider.providerId,
        uid: provider.providerUid,
        email: provider.email,
        displayName: provider.displayName,
      })),
    })),
  };
}
