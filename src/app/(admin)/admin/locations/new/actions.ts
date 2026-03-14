'use server';

import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/admin-auth';
import { upsertLocation, getLocationBySlug } from '@/lib/repositories';
import {
  buildHoursRange,
  formatTimeFromParts,
  isSupportedState,
  isSupportedTimeHour,
  isSupportedTimeMeridiem,
  isSupportedTimeMinute,
} from '@/constants/locationFormOptions';

export async function createLocation(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  await requireRole('owner');

  const slug = formData.get('slug')?.toString().trim().toLowerCase();
  const name = formData.get('name')?.toString().trim();
  const address = formData.get('address')?.toString().trim();
  const city = formData.get('city')?.toString().trim();
  const state = formData.get('state')?.toString().trim().toUpperCase();
  const zip = formData.get('zip')?.toString().trim();
  const phone = formData.get('phone')?.toString().trim();
  const openHour = formData.get('openHour')?.toString().trim();
  const openMinute = formData.get('openMinute')?.toString().trim();
  const openMeridiem = formData
    .get('openMeridiem')
    ?.toString()
    .trim()
    .toUpperCase();
  const closeHour = formData.get('closeHour')?.toString().trim();
  const closeMinute = formData.get('closeMinute')?.toString().trim();
  const closeMeridiem = formData
    .get('closeMeridiem')
    ?.toString()
    .trim()
    .toUpperCase();
  const description = formData.get('description')?.toString().trim();
  const placeId = formData.get('placeId')?.toString().trim() || undefined;

  if (
    !slug ||
    !name ||
    !address ||
    !city ||
    !state ||
    !zip ||
    !phone ||
    !openHour ||
    !openMinute ||
    !openMeridiem ||
    !closeHour ||
    !closeMinute ||
    !closeMeridiem ||
    !description
  ) {
    return { error: 'All fields are required.' };
  }

  if (!isSupportedState(state)) {
    return { error: 'State must be selected from the approved list.' };
  }

  if (
    !isSupportedTimeHour(openHour) ||
    !isSupportedTimeMinute(openMinute) ||
    !isSupportedTimeMeridiem(openMeridiem) ||
    !isSupportedTimeHour(closeHour) ||
    !isSupportedTimeMinute(closeMinute) ||
    !isSupportedTimeMeridiem(closeMeridiem)
  ) {
    return {
      error: 'Hours must be selected from approved time options.',
    };
  }

  const hours = buildHoursRange(
    formatTimeFromParts(openHour, openMinute, openMeridiem),
    formatTimeFromParts(closeHour, closeMinute, closeMeridiem)
  );

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: 'Slug must be lowercase letters, numbers, and hyphens only.',
    };
  }

  const existing = await getLocationBySlug(slug);
  if (existing)
    return { error: `A location with slug "${slug}" already exists.` };

  await upsertLocation({
    slug,
    name,
    address,
    city,
    state,
    zip,
    phone,
    hours,
    description,
    ...(placeId ? { placeId } : {}),
  });

  redirect('/admin/locations');
}
