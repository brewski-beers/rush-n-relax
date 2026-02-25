import { getDownloadURL, ref } from 'firebase/storage';
import { getStorage$, initializeApp } from '../firebase';

/**
 * Brand Logo System
 * Encodes exact usage rules for logo selection, placement, and sizing.
 */

export enum BrandLogoVariant {
  PRIMARY = 'logo-primary',
  ACCENT_BLUE_BG = 'logo-accent-blue-bg',
}

export enum BrandAssetFormat {
  SVG = 'svg',
  PNG = 'png',
}

export enum BrandSurface {
  HEADER_DESKTOP = 'header-desktop',
  HEADER_MOBILE = 'header-mobile',
  FOOTER = 'footer',
  IN_CONTENT_BADGE = 'in-content-badge',
  HERO = 'hero',
  SOCIAL_PROMO = 'social-promo',
  CAMPAIGN_BANNER = 'campaign-banner',
  FAVICON = 'favicon',
  APP_ICON = 'app-icon',
  LEGAL_BRAND_PRESENCE = 'legal-brand-presence',
}

export interface HeightRule {
  exactPx?: number;
  minPx?: number;
  maxPx?: number;
}

export interface BrandUsageRule {
  surface: BrandSurface;
  allowedLogos: readonly BrandLogoVariant[];
  preferredLogo: BrandLogoVariant;
  height: HeightRule;
}

export const getBrandLogoStoragePath = (
  logo: BrandLogoVariant,
  format: BrandAssetFormat
): string => {
  return `branding/${logo}.${format}`;
};

const getLocalLogoPath = (
  logo: BrandLogoVariant,
  format: BrandAssetFormat
): string => {
  if (format === BrandAssetFormat.SVG) {
    return BRAND_LOGO_FILES[logo].svg;
  }
  return BRAND_LOGO_FILES[logo].png;
};

export const resolveBrandLogoUrl = async (
  logo: BrandLogoVariant,
  format: BrandAssetFormat = BrandAssetFormat.PNG
): Promise<string> => {
  try {
    initializeApp();
    const storage = getStorage$();
    const path = getBrandLogoStoragePath(logo, format);
    return await getDownloadURL(ref(storage, path));
  } catch {
    return getLocalLogoPath(logo, format);
  }
};

export const resolvePreferredLogoUrlForSurface = async (
  surface: BrandSurface,
  format: BrandAssetFormat = BrandAssetFormat.PNG
): Promise<string> => {
  const preferred = getPreferredLogoForSurface(surface);
  return resolveBrandLogoUrl(preferred, format);
};

export const BRAND_LOGO_FILES: Record<
  BrandLogoVariant,
  { svg: string; png: string }
> = {
  [BrandLogoVariant.PRIMARY]: {
    svg: '/icons/logo-primary.png',
    png: '/icons/logo-primary.png',
  },
  [BrandLogoVariant.ACCENT_BLUE_BG]: {
    svg: '/icons/logo-primary.png',
    png: '/icons/logo-primary.png',
  },
};

export const BRAND_USAGE_RULES: Record<BrandSurface, BrandUsageRule> = {
  [BrandSurface.HEADER_DESKTOP]: {
    surface: BrandSurface.HEADER_DESKTOP,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: { exactPx: 52, minPx: 48, maxPx: 56 },
  },
  [BrandSurface.HEADER_MOBILE]: {
    surface: BrandSurface.HEADER_MOBILE,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: { exactPx: 40, minPx: 36, maxPx: 44 },
  },
  [BrandSurface.FOOTER]: {
    surface: BrandSurface.FOOTER,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: { exactPx: 44 },
  },
  [BrandSurface.IN_CONTENT_BADGE]: {
    surface: BrandSurface.IN_CONTENT_BADGE,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: { minPx: 120 },
  },
  [BrandSurface.HERO]: {
    surface: BrandSurface.HERO,
    allowedLogos: [BrandLogoVariant.PRIMARY, BrandLogoVariant.ACCENT_BLUE_BG],
    preferredLogo: BrandLogoVariant.ACCENT_BLUE_BG,
    height: {},
  },
  [BrandSurface.SOCIAL_PROMO]: {
    surface: BrandSurface.SOCIAL_PROMO,
    allowedLogos: [BrandLogoVariant.PRIMARY, BrandLogoVariant.ACCENT_BLUE_BG],
    preferredLogo: BrandLogoVariant.ACCENT_BLUE_BG,
    height: {},
  },
  [BrandSurface.CAMPAIGN_BANNER]: {
    surface: BrandSurface.CAMPAIGN_BANNER,
    allowedLogos: [BrandLogoVariant.PRIMARY, BrandLogoVariant.ACCENT_BLUE_BG],
    preferredLogo: BrandLogoVariant.ACCENT_BLUE_BG,
    height: {},
  },
  [BrandSurface.FAVICON]: {
    surface: BrandSurface.FAVICON,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: {},
  },
  [BrandSurface.APP_ICON]: {
    surface: BrandSurface.APP_ICON,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: {},
  },
  [BrandSurface.LEGAL_BRAND_PRESENCE]: {
    surface: BrandSurface.LEGAL_BRAND_PRESENCE,
    allowedLogos: [BrandLogoVariant.PRIMARY],
    preferredLogo: BrandLogoVariant.PRIMARY,
    height: {},
  },
};

export const BRAND_SAFETY = {
  MIN_RENDER_WIDTH_PX: 96,
  CLEARSPACE_RATIO_DEFAULT: 0.12,
  CLEARSPACE_RATIO_TIGHT_MOBILE_MIN: 0.08,
  FAVICON_EXPORT_SIZES_PX: [16, 32, 48] as const,
  APP_ICON_EXPORT_SIZES_PX: [180, 192, 512] as const,
} as const;

export const BRAND_RESTRICTIONS = {
  disallowRecolor: true,
  disallowExtraEffects: true,
  disallowRotate: true,
  disallowStretch: true,
  disallowCropIntoEmblem: true,
  disallowExtraPerimeterText: true,
  minContrastRatioAgainstBackground: 3,
} as const;

export const getPreferredLogoForSurface = (
  surface: BrandSurface
): BrandLogoVariant => {
  return BRAND_USAGE_RULES[surface].preferredLogo;
};

export const isLogoAllowedForSurface = (
  surface: BrandSurface,
  logo: BrandLogoVariant
): boolean => {
  return BRAND_USAGE_RULES[surface].allowedLogos.includes(logo);
};
