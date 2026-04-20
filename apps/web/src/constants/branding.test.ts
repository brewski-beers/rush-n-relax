import { describe, it, expect } from 'vitest';
import {
  BrandLogoVariant,
  BrandSurface,
  BrandAssetFormat,
  BRAND_USAGE_RULES,
  getBrandLogoStoragePath,
} from './branding';

describe('Branding Constants', () => {
  describe('BrandLogoVariant enum', () => {
    it('has PRIMARY variant', () => {
      expect(BrandLogoVariant.PRIMARY).toBe('logo-primary');
    });

    it('has ACCENT_BLUE_BG variant', () => {
      expect(BrandLogoVariant.ACCENT_BLUE_BG).toBe('logo-accent-blue-bg');
    });
  });

  describe('BrandSurface enum', () => {
    it('has HEADER_DESKTOP surface', () => {
      expect(BrandSurface.HEADER_DESKTOP).toBeDefined();
    });

    it('has FOOTER surface', () => {
      expect(BrandSurface.FOOTER).toBeDefined();
    });

    it('has HERO surface', () => {
      expect(BrandSurface.HERO).toBeDefined();
    });
  });

  describe('BRAND_USAGE_RULES', () => {
    it('exports usage rules object', () => {
      expect(BRAND_USAGE_RULES).toBeDefined();
      expect(typeof BRAND_USAGE_RULES).toBe('object');
    });

    it('contains rules for HEADER_DESKTOP', () => {
      expect(BRAND_USAGE_RULES[BrandSurface.HEADER_DESKTOP]).toBeDefined();
    });

    it('HEADER_DESKTOP rules allow PRIMARY variant', () => {
      const headerRules = BRAND_USAGE_RULES[BrandSurface.HEADER_DESKTOP];
      expect(headerRules.allowedLogos).toContain(BrandLogoVariant.PRIMARY);
    });

    it('HEADER_DESKTOP rules specify height constraint', () => {
      const headerRules = BRAND_USAGE_RULES[BrandSurface.HEADER_DESKTOP];
      expect(headerRules.height).toBeDefined();
      expect(headerRules.height.exactPx).toBeGreaterThan(0);
    });

    it('contains rules for FOOTER', () => {
      expect(BRAND_USAGE_RULES[BrandSurface.FOOTER]).toBeDefined();
    });

    it('FOOTER rules allow PRIMARY variant', () => {
      const footerRules = BRAND_USAGE_RULES[BrandSurface.FOOTER];
      expect(footerRules.allowedLogos).toContain(BrandLogoVariant.PRIMARY);
    });

    it('FOOTER rules have exact height constraint', () => {
      const footerRules = BRAND_USAGE_RULES[BrandSurface.FOOTER];
      expect(footerRules.height.exactPx).toBeDefined();
      expect(footerRules.height.exactPx).toBeGreaterThan(0);
    });
  });

  describe('getBrandLogoStoragePath', () => {
    it('builds PRIMARY png path correctly', () => {
      expect(
        getBrandLogoStoragePath(BrandLogoVariant.PRIMARY, BrandAssetFormat.PNG)
      ).toBe('branding/logo-primary.png');
    });

    it('builds ACCENT_BLUE_BG svg path correctly', () => {
      expect(
        getBrandLogoStoragePath(
          BrandLogoVariant.ACCENT_BLUE_BG,
          BrandAssetFormat.SVG
        )
      ).toBe('branding/logo-accent-blue-bg.svg');
    });
  });

  describe('Brand guidelines', () => {
    it('PRIMARY variant used for main surfaces', () => {
      const headerRules = BRAND_USAGE_RULES[BrandSurface.HEADER_DESKTOP];
      const footerRules = BRAND_USAGE_RULES[BrandSurface.FOOTER];

      expect(headerRules.allowedLogos[0]).toBe(BrandLogoVariant.PRIMARY);
      expect(footerRules.allowedLogos[0]).toBe(BrandLogoVariant.PRIMARY);
    });

    it('ACCENT variant used for hero sections', () => {
      const heroRules = BRAND_USAGE_RULES[BrandSurface.HERO];
      expect(heroRules).toBeDefined();
      expect(heroRules.allowedLogos).toContain(BrandLogoVariant.ACCENT_BLUE_BG);
    });

    it('header and footer have defined height constraints', () => {
      const headerRules = BRAND_USAGE_RULES[BrandSurface.HEADER_DESKTOP];
      const footerRules = BRAND_USAGE_RULES[BrandSurface.FOOTER];

      expect(headerRules.height.exactPx).toBeGreaterThan(0);
      expect(footerRules.height.exactPx).toBeGreaterThan(0);
    });
  });
});
