/**
 * Utility functions for handling Magic Booking Links in the application.
 * 
 * Why does HTTP 403 occur in AI Studio?
 * In Google AI Studio Build, the development server runs on `ais-dev-...run.app`.
 * This dev domain is protected by Google Cloud Identity-Aware Proxy (IAP) and
 * requires the active Google AI Studio owner session. If opened in incognito,
 * on another device (e.g. mobile), or by external testers, Google Cloud Run
 * returns HTTP 403 Forbidden.
 * 
 * To test publicly:
 * 1. The user clicks "Share" in Google AI Studio to provision the public `ais-pre-...` domain.
 * 2. Or the user can test magic links directly within the app using the in-app simulator!
 */

import { auth } from '../firebase';

export interface MagicLinkDetails {
  token: string;
  trainerId?: string;
  isDevContainer: boolean;
  inAppUrl: string;
  publicSharedUrl: string;
  explanation: string;
}

export const getUrlMagicLinkParams = (): { token: string | null; trainerId: string | null } => {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    let token = searchParams.get('token');
    let trainerId = searchParams.get('trainer') || searchParams.get('uid');

    if ((!token || !trainerId) && window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const queryPart = hash.includes('?') ? hash.split('?')[1] : hash;
      const hashParams = new URLSearchParams(queryPart);
      if (!token) {
        token = hashParams.get('token') || (hash.startsWith('token=') ? hash.split('=')[1]?.split('&')[0] : null);
      }
      if (!trainerId) {
        trainerId = hashParams.get('trainer') || hashParams.get('uid');
      }
    }

    return {
      token: token ? token.trim() : null,
      trainerId: trainerId ? trainerId.trim() : null,
    };
  } catch {
    return { token: null, trainerId: null };
  }
};

export const clearUrlMagicLinkParams = (): void => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('trainer');
    url.searchParams.delete('uid');
    if (url.hash && (url.hash.includes('token=') || url.hash.includes('trainer='))) {
      url.hash = '';
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore in restricted iframe
  }
  window.dispatchEvent(new CustomEvent('probooking:magic-link-changed'));
};

export const PUBLIC_CLIENT_BASE_URL = 'https://pro-booking75.vercel.app/';

export const getMagicLinkDetails = (token: string, trainerId?: string): MagicLinkDetails => {
  const urlParams = getUrlMagicLinkParams();
  const resolvedTrainerId = trainerId || auth.currentUser?.uid || urlParams.trainerId || undefined;
  const querySuffix = `?token=${encodeURIComponent(token)}${
    resolvedTrainerId ? `&trainer=${encodeURIComponent(resolvedTrainerId)}` : ''
  }`;

  const clientMagicUrl = `${PUBLIC_CLIENT_BASE_URL}${querySuffix}`;
  const inAppUrl = clientMagicUrl;
  const publicSharedUrl = clientMagicUrl;

  const explanation =
    'Deze unieke link verwijst altijd naar https://pro-booking75.vercel.app/ en geeft de klant direct toegang tot het persoonlijke boekingsportaal zonder wachtwoord.';

  return {
    token,
    trainerId: resolvedTrainerId,
    isDevContainer: false,
    inAppUrl,
    publicSharedUrl,
    explanation,
  };
};
