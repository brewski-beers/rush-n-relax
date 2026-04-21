/**
 * Application Messages and Constants
 * Single source of truth for user-facing messages
 */

export const ERROR_MESSAGES = {
  GENERIC: 'Something went wrong. Please try again.',
  FORM_INVALID: 'Please check the form for errors.',
  SUBMIT_FAILED: 'Failed to submit. Please try again or contact us directly.',
  NETWORK: 'Network error. Please check your connection.',
} as const;

export const SUCCESS_MESSAGES = {
  FORM_SUBMITTED: 'Thank you! Your message has been sent successfully.',
} as const;

export const LOADING_MESSAGES = {
  SENDING: 'Sending your message...',
} as const;

/**
 * Company Information
 */
export const COMPANY = {
  NAME: 'Rush N Relax',
  NICKNAME: 'RnR',
  DESCRIPTION:
    'East Tennessee\u2019s upscale cannabis dispensary — premium flower, concentrates, edibles, vapes, THCa-infused drinks, and a one-of-a-kind speakeasy-style lounge in Oak Ridge.',
  CONTACT: {
    email1: 'rush@rushnrelax.com',
    email2: 'capps@rushnrelax.com',
  },
  HOURS: 'Monday - Sunday: 10:00 AM - 10:00 PM',
  HOURS_SUMMARY: '7 days a week',
  AGE_REQUIREMENT: 21,
} as const;

/**
 * Route Constants
 */
export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  LOCATIONS: '/locations',
  CONTACT: '/contact',
} as const;
