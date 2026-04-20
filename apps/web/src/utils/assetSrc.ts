interface SrcAsset {
  src: string;
}

function hasSrc(value: unknown): value is SrcAsset {
  return (
    typeof value === 'object' &&
    value !== null &&
    'src' in value &&
    typeof (value as { src?: unknown }).src === 'string'
  );
}

export function getAssetSrc(value: unknown): string {
  if (typeof value === 'string') return value;
  if (hasSrc(value)) return value.src;
  return '';
}
