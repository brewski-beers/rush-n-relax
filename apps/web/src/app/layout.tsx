import type { Metadata } from 'next';
import { seoConfig } from '@/config/seo.config';
import '@/styles/index.css';

export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.site.domain),
  title: {
    default: seoConfig.site.defaultTitle,
    template: seoConfig.site.titleTemplate,
  },
  description: seoConfig.site.defaultDescription,
  openGraph: {
    siteName: seoConfig.site.name,
    locale: seoConfig.site.locale,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: seoConfig.site.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#2c5f2d" />
      </head>
      <body>{children}</body>
    </html>
  );
}
