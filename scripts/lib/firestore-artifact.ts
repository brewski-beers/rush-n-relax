import {
  FIXTURE_DATASET_VERSION,
  FIXTURE_TIMESTAMP,
  LOCATION_REVIEW_FIXTURES,
  PROMO_FIXTURES,
  buildLocationDocuments,
  buildProductDocuments,
  buildHubInventoryDocuments,
  buildCategoryDocuments,
} from '../../src/lib/fixtures';

export type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

export type FirestoreFields = Record<string, FirestoreValue>;

export interface FirestoreSeedDocument {
  collection: string;
  docId: string;
  fields: FirestoreFields;
}

export interface FirestoreSeedArtifact {
  version: string;
  generatedAt: string;
  datasetVersion: string;
  documents: FirestoreSeedDocument[];
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }

  if (value && typeof value === 'object') {
    const fields = Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([key, v]) => [key, toFirestoreValue(v)])
    );
    return { mapValue: { fields } };
  }

  return { stringValue: '' };
}

export function toFirestoreFields(
  value: Record<string, unknown>
): FirestoreFields {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => [key, toFirestoreValue(v)])
  );
}

export function buildStorefrontSeedArtifact(): FirestoreSeedArtifact {
  const fixtureDate = new Date(FIXTURE_TIMESTAMP);
  const documents: FirestoreSeedDocument[] = [];

  for (const location of buildLocationDocuments(fixtureDate)) {
    documents.push({
      collection: 'locations',
      docId: location.slug,
      fields: toFirestoreFields({
        slug: location.slug,
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        zip: location.zip,
        phone: location.phone,
        hours: location.hours,
        description: location.description,
        placeId: location.placeId,
        coordinates: location.coordinates,
        socialLinkIds: location.socialLinkIds,
        seoDescription: location.seoDescription,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
      }),
    });
  }

  for (const product of buildProductDocuments(fixtureDate)) {
    documents.push({
      collection: 'products',
      docId: product.slug,
      fields: toFirestoreFields({
        slug: product.slug,
        name: product.name,
        category: product.category,
        details: product.details,
        image: product.image,
        status: product.status,
        federalDeadlineRisk: product.federalDeadlineRisk,
        availableAt: product.availableAt,
        coaUrl: product.coaUrl,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }),
    });
  }

  for (const item of buildHubInventoryDocuments(fixtureDate)) {
    documents.push({
      // subcollection path: inventory/{locationId}/items/{productId}
      collection: `inventory/${item.locationId}/items`,
      docId: item.productId,
      fields: toFirestoreFields({
        productId: item.productId,
        locationId: item.locationId,
        inStock: item.inStock,
        availableOnline: item.availableOnline,
        availablePickup: item.availablePickup,
        featured: item.featured,
        quantity: item.quantity,
        updatedAt: item.updatedAt,
      }),
    });
  }

  for (const promo of PROMO_FIXTURES) {
    documents.push({
      collection: 'promos',
      docId: promo.slug,
      fields: toFirestoreFields({
        promoId: promo.promoId,
        slug: promo.slug,
        name: promo.name,
        tagline: promo.tagline,
        description: promo.description,
        details: promo.details,
        cta: promo.cta,
        ctaPath: promo.ctaPath,
        image: promo.image,
        locationSlug: promo.locationSlug,
        keywords: promo.keywords,
        active: promo.active,
        startDate: promo.startDate,
        endDate: promo.endDate,
        createdAt: fixtureDate,
        updatedAt: fixtureDate,
      }),
    });
  }

  for (const category of buildCategoryDocuments(fixtureDate)) {
    documents.push({
      collection: 'product-categories',
      docId: category.slug,
      fields: toFirestoreFields({
        slug: category.slug,
        label: category.label,
        description: category.description,
        order: category.order,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      }),
    });
  }

  for (const reviewDoc of LOCATION_REVIEW_FIXTURES) {
    documents.push({
      collection: 'location-reviews',
      docId: reviewDoc.placeId,
      fields: toFirestoreFields(
        reviewDoc as unknown as Record<string, unknown>
      ),
    });
  }

  return {
    version: '1',
    generatedAt: new Date().toISOString(),
    datasetVersion: FIXTURE_DATASET_VERSION,
    documents,
  };
}
