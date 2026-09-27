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

export interface MagicLinkDetails {
  token: string;
  isDevContainer: boolean;
  inAppUrl: string;
  publicSharedUrl: string;
  explanation: string;
}

export const getMagicLinkDetails = (token: string): MagicLinkDetails => {
  const currentOrigin = window.location.origin;
  const isDevContainer = currentOrigin.includes('ais-dev-');
  const pathname = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;

  const inAppUrl = `${currentOrigin}${pathname}?token=${token}`;

  const publicOrigin = isDevContainer
    ? currentOrigin.replace('ais-dev-', 'ais-pre-')
    : currentOrigin;
  const publicSharedUrl = `${publicOrigin}${pathname}?token=${token}`;

  const explanation = isDevContainer
    ? 'De ontwikkel-URL (ais-dev) is privé beveiligd door Google AI Studio. Buiten deze ontwikkelsessie (bv. in incognito of op mobiel) geeft Google Cloud Run een 403 error. Klik op "Share" in AI Studio voor publieke toegang, of test direct in deze preview.'
    : 'Deze unieke link geeft direct toegang tot het self-service boekingsportaal zonder wachtwoord.';

  return {
    token,
    isDevContainer,
    inAppUrl,
    publicSharedUrl,
    explanation,
  };
};
