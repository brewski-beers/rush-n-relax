/**
 * Social Media Configuration
 * Uses enum mappers with centralized metadata
 * Single source of truth for social link data - locations/staff/pages reference by ID
 * Icons: SVG imports or emoji
 */

import facebookIcon from '../assets/icons/facebook.svg';

export enum SocialId {
  FACEBOOK_MARYVILLE = 'fb_maryville',
  FACEBOOK_OAK_RIDGE = 'fb_oak_ridge',
  FACEBOOK_SEYMOUR = 'fb_seymour',
  // INSTAGRAM = 'instagram',
  // TIKTOK = 'tiktok',
}

export interface SocialIconObject {
  src: string;
  alt: string;
}

export interface SocialLink {
  id: SocialId;
  name: string;
  url: string;
  icon: string | SocialIconObject;
  ariaLabel: string;
}

// Type guard to check if icon is an SVG object
export const isSocialIconObject = (icon: string | SocialIconObject): icon is SocialIconObject => {
  return typeof icon === 'object' && icon !== null && 'src' in icon;
};

export const SOCIAL_METADATA: Record<SocialId, SocialLink> = {
  [SocialId.FACEBOOK_MARYVILLE]: {
    id: SocialId.FACEBOOK_MARYVILLE,
    name: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61585628978171',
    icon: { src: facebookIcon, alt: 'Facebook' },
    ariaLabel: 'Visit Rush N Relax Maryville on Facebook',
  },
  [SocialId.FACEBOOK_OAK_RIDGE]: {
    id: SocialId.FACEBOOK_OAK_RIDGE,
    name: 'Facebook',
    url: 'https://www.facebook.com/search/top/?q=rush%20n%20relax%20oak%20ridge',
    icon: { src: facebookIcon, alt: 'Facebook' },
    ariaLabel: 'Visit Rush N Relax Oak Ridge on Facebook',
  },
  [SocialId.FACEBOOK_SEYMOUR]: {
    id: SocialId.FACEBOOK_SEYMOUR,
    name: 'Facebook',
    url: 'https://www.facebook.com/profile.php?id=61585953144207',
    icon: { src: facebookIcon, alt: 'Facebook' },
    ariaLabel: 'Visit Rush N Relax Seymour on Facebook',
  },
  // [SocialId.INSTAGRAM]: {
  //   name: 'Instagram',
  //   url: 'https://instagram.com/rushnrelax',
  //   icon: '📷',
  //   ariaLabel: 'Visit on Instagram',
  // },
  // [SocialId.TIKTOK]: {
  //   name: 'TikTok',
  //   url: 'https://tiktok.com/@rushnrelax',
  //   icon: '🎵',
  //   ariaLabel: 'Visit on TikTok',
  // },
};

// Helper to get social link metadata by ID
export const getSocialLink = (id: SocialId): SocialLink => SOCIAL_METADATA[id];

// Array export for components that display all social links (Navigation, Footer, etc.)
export const SOCIAL_LINKS: SocialLink[] = Object.values(SOCIAL_METADATA);

export const TECH_CREDIT = {
  name: 'Tech by Brewski',
  url: 'https://www.techbybrewski.com',
};
