export type { PageResult } from './types';

export {
  listLocations,
  getLocationBySlug,
  getLocationById,
  upsertLocation,
} from './location.repository';

export {
  listAllProducts,
  listArchivedProducts,
  listProducts,
  listProductsByIds,
  listProductsByCategory,
  listProductsByVendor,
  getRelatedProducts,
  getProductBySlug,
  upsertProduct,
  clearProductFields,
  setProductStatus,
  setVariantLocation,
  decrementVariantStock,
  holdStock,
  releaseStock,
  commitStock,
  listProductsInStockAt,
  listFeaturedProductsAt,
  getOnlineInStockSet,
  InsufficientStockError,
} from './product.repository';
export type { HoldRequest } from './product.repository';

export {
  listAllPromos,
  listActivePromos,
  getPromoBySlug,
  getPromosByLocationSlug,
  deletePromo,
  upsertPromo,
} from './promo.repository';

export {
  normalizeInviteEmail,
  getPendingUserInviteByEmail,
  listPendingUserInvites,
  createOrUpdatePendingUserInvite,
  markPendingUserInviteAccepted,
  revokePendingUserInvite,
} from './pending-user-invite.repository';

export {
  submitContactAndQueueEmail,
  queueOutboundEmail,
  queueTestContactEmail,
  listOutboundEmailJobs,
  requeueOutboundEmailJob,
} from './contact.repository';

export {
  listActiveCategories,
  listAllCategories,
  getCategoryBySlug,
  upsertCategory,
  setCategoryStatus,
  reorderCategories,
} from './category.repository';

export {
  getDefaultContactEmailTemplate,
  getEmailTemplateById,
  listEmailTemplates,
  listEmailTemplateRevisions,
  restoreEmailTemplateRevision,
  upsertEmailTemplate,
} from './email-template.repository';

export {
  listVendors,
  listAllVendors,
  getVendorBySlug,
  upsertVendor,
  setVendorActive,
} from './vendor.repository';

export {
  createOrder,
  getOrder,
  setOrderProviderRefs,
  InvalidTransitionError,
  listOrders,
  listOrderEvents,
  transitionStatus,
} from './order.repository';
export type { ListOrdersOptions, ListOrdersResult } from './order.repository';

export { listCoaDocuments } from './coa.repository';

export {
  listVariantTemplates,
  upsertVariantTemplate,
  deleteVariantTemplate,
} from './variant-template.repository';

export {
  enqueueRefundPending,
  listRefundsPendingForRetry,
  markRefundPendingRetryFailed,
  deleteRefundPending,
  backoffMsFor,
} from './refund-pending.repository';
export type {
  RefundPendingRecord,
  RefundPendingSource,
  EnqueueRefundPendingInput,
  ListRefundsPendingForRetryOptions,
} from './refund-pending.repository';

export {
  createCheckoutSession,
  getCheckoutSession,
  markAgeVerified,
  markCheckoutSessionCompleted,
  markCheckoutSessionExpired,
  markCheckoutSessionCancelled,
  InvalidCheckoutSessionTransitionError,
} from './checkout-session.repository';
export type { CreateCheckoutSessionInput } from './checkout-session.repository';
