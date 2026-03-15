'use server';

import { headers } from 'next/headers';
import { submitContactAndQueueEmail } from '@/lib/repositories';
import { isRateLimited } from '@/lib/rate-limit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactState {
  type: 'idle' | 'success' | 'error';
  message: string;
  errors: { name?: string; email?: string; message?: string };
  emailDomain?: string;
}

export const INITIAL_CONTACT_STATE: ContactState = {
  type: 'idle',
  message: '',
  errors: {},
};

function sanitize(value: FormDataEntryValue | null, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function submitContact(
  _prevState: ContactState,
  formData: FormData
): Promise<ContactState> {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return {
      type: 'error',
      message: 'Too many requests. Please try again later.',
      errors: {},
    };
  }

  const name = sanitize(formData.get('name'), 120);
  const email = sanitize(formData.get('email'), 200).toLowerCase();
  const phone = sanitize(formData.get('phone'), 40);
  const message = sanitize(formData.get('message'), 5000);

  const errors: ContactState['errors'] = {};
  if (!name) errors.name = 'Name is required';
  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Invalid email address';
  if (!message) errors.message = 'Message is required';

  if (Object.keys(errors).length > 0) {
    return {
      type: 'error',
      message: 'Please check the form for errors.',
      errors,
    };
  }

  try {
    await submitContactAndQueueEmail({
      name,
      email,
      ...(phone ? { phone } : {}),
      message,
    });
    return {
      type: 'success',
      message:
        'Thank you! Your message has been sent successfully. We will get back to you soon.',
      errors: {},
      emailDomain: email.split('@')[1],
    };
  } catch (error) {
    console.error('[submitContact] failed:', error);
    return {
      type: 'error',
      message:
        'There was an error sending your message. Please try again or contact us directly.',
      errors: {},
    };
  }
}
