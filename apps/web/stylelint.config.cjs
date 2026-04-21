module.exports = {
  ignoreFiles: [
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'dist/**',
  ],
  rules: {
    'selector-disallowed-list': [
      /^\.product-card$/,
      /^\.product-card-small$/,
      /^\.value-card$/,
      /^\.location-card$/,
      /^\.info-card$/,
      /^\.team-member$/,
    ],
    'declaration-property-value-disallowed-list': {
      '/^(margin(|-(top|right|bottom|left))|padding(|-(top|right|bottom|left))|gap|row-gap|column-gap)$/': [
        '/\\b(\\d*\\.?\\d+)rem\\b/',
        '/\\b(\\d*\\.?\\d+)px\\b/',
      ],
      '/^(color|background-color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color|outline|outline-color)$/': [
        '/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/',
        '/rgba?\\(/',
      ],
      '/^background$/': ['/^(#|rgba?\\()/'],
      '/^border$/': [
        '/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/',
        '/rgba?\\(/',
      ],
      '/^border-(top|right|bottom|left)$/': [
        '/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/',
        '/rgba?\\(/',
      ],
    },
  },
};