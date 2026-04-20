import type { UserRole } from '@/types';
import { FIXTURE_DATASET_VERSION, FIXTURE_TIMESTAMP } from './storefront';

export { FIXTURE_DATASET_VERSION, FIXTURE_TIMESTAMP };

export interface AuthProviderFixture {
  providerId: 'google.com';
  providerUid: string;
  email: string;
  displayName: string;
}

export interface AuthUserFixture {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: UserRole;
  providers: readonly AuthProviderFixture[];
}

export const AUTH_USER_FIXTURES: readonly AuthUserFixture[] = [
  {
    uid: 'kb-owner-uid',
    email: 'kb@rushnrelax.com',
    emailVerified: true,
    displayName: 'KB',
    role: 'owner',
    providers: [
      {
        providerId: 'google.com',
        providerUid: 'kb-google-oauth',
        email: 'kb@rushnrelax.com',
        displayName: 'KB',
      },
    ],
  },
];
