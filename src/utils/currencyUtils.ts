export type SupportedCurrency = 'EUR' | 'USD' | 'CHF' | string;

export interface CurrencyConfig {
  code: string;
  symbol: string;
  labelEn: string;
  labelNl: string;
  example: string;
}

export const SUPPORTED_CURRENCIES: Record<'EUR' | 'USD' | 'CHF', CurrencyConfig> = {
  EUR: {
    code: 'EUR',
    symbol: '€',
    labelEn: 'Euro (€)',
    labelNl: 'Euro (€)',
    example: '€65.00',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    labelEn: 'US Dollar ($)',
    labelNl: 'US Dollar ($)',
    example: '$65.00',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    labelEn: 'Swiss Franc (CHF)',
    labelNl: 'Zwitserse Frank (CHF)',
    example: 'CHF 65.00',
  },
};

export const CURRENCY_OPTIONS: CurrencyConfig[] = [
  SUPPORTED_CURRENCIES.EUR,
  SUPPORTED_CURRENCIES.USD,
  SUPPORTED_CURRENCIES.CHF,
];

export function sanitizeCurrencyCode(input?: string): string {
  if (!input) return '';
  return input.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6);
}

export function getCurrencySymbol(currency?: string): string {
  const c = sanitizeCurrencyCode(currency);
  if (!c || c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'CHF') return 'CHF';
  return c;
}

export function formatCurrency(amount: number | undefined | null, currency?: string): string {
  const safeAmount = Number(amount || 0);
  const sign = safeAmount < 0 ? '-' : '';
  const absFormatted = Math.abs(safeAmount).toFixed(2);
  const code = sanitizeCurrencyCode(currency) || 'EUR';

  if (code === 'EUR') {
    return `${sign}€${absFormatted}`;
  }
  if (code === 'USD') {
    return `${sign}$${absFormatted}`;
  }
  return `${sign}${code} ${absFormatted}`;
}
