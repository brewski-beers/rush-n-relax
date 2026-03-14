'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDownloadURL, ref } from 'firebase/storage';
import { getStorage$, initializeApp } from '@/firebase';
import { Card } from '@/components/Card';
import type { Promo } from '@/types';
import '@/styles/promo.css';

export default function PromoClient({
  promo,
  locationName,
}: {
  promo: Promo;
  locationName?: string;
}) {
  const [imageSrc, setImageSrc] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    const resolveImage = async () => {
      if (!promo?.image) {
        if (!cancelled) setImageSrc(undefined);
        return;
      }

      if (/^https?:\/\//i.test(promo.image)) {
        if (!cancelled) setImageSrc(promo.image);
        return;
      }

      try {
        initializeApp();
        const storageRef = ref(getStorage$(), promo.image);
        const downloadUrl = await getDownloadURL(storageRef);
        if (!cancelled) setImageSrc(downloadUrl);
      } catch {
        if (!cancelled) setImageSrc(`/${promo.image}`);
      }
    };

    void resolveImage();
    return () => {
      cancelled = true;
    };
  }, [promo.image]);

  return (
    <main className="promo-page">
      <section
        id="promo-hero"
        className="promo-hero asymmetry-section-stable page-hero-shell"
      >
        <div className="container promo-hero-inner">
          <p className="promo-kicker">Try In Store</p>
          <h1 className="asymmetry-headline-anchor">{promo.name}</h1>
          <div className="promo-hero-media">
            {imageSrc ? (
              <div className="promo-hero-image-wrap">
                <img
                  src={imageSrc}
                  alt={promo.name}
                  className="promo-hero-image"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="promo-hero-image-fallback" aria-hidden="true" />
            )}
          </div>
          <p className="lead">{promo.tagline}</p>
        </div>
      </section>

      <section
        id="promo-details"
        className="promo-details asymmetry-section-stable"
      >
        <div className="container promo-details-inner">
          <Card
            variant="info"
            as="article"
            surface="anchor"
            elevation="soft"
            motion
            className="promo-detail-card"
          >
            <div className="promo-detail-body">
              <p>{promo.details}</p>
              {promo.locationSlug && locationName ? (
                <p className="promo-location-note">
                  Available at{' '}
                  <Link href={`/locations/${promo.locationSlug}`}>
                    {locationName}
                  </Link>
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>

      <section id="promo-cta" className="promo-cta asymmetry-section-anchor">
        <div className="container promo-cta-inner">
          <Link
            href={promo.ctaPath}
            className="btn promo-cta-btn asymmetry-motion-anchor"
          >
            {promo.cta}
          </Link>
        </div>
      </section>
    </main>
  );
}
