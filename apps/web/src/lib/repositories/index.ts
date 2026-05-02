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
} from './product.repository';

export {
  listAllPromos,
  listActivePromos,
  getPromoBySlug,
  getPromosByLocationSlug,
  deletePromo,
  upsertPromo,
} from './promo.repository';

export {
  listInventoryForLocation,
  getInventoryItem,
  listOnlineAvailableInventory,
  listFeaturedInventory,
  getOnlineInStockSet,
  setInventoryItem,
  decrementInventoryItems,
  InsufficientStockError,
} from './inventory.repository';

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
