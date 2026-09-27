export type SupportedCurrency = 'EUR' | 'USD' | 'CHF';

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  labelEn: string;
  labelNl: string;
  example: string;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
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

export function getCurrencySymbol(currency?: string): string {
  if (!currency) return '€';
  const c = currency.toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'CHF') return 'CHF';
  return '€';
}

export function formatCurrency(amount: number | undefined | null, currency?: string): string {
  const safeAmount = Number(amount || 0);
  const code = (currency?.toUpperCase() || 'EUR') as SupportedCurrency;
  
  if (code === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  if (code === 'CHF') {
    return `CHF ${safeAmount.toFixed(2)}`;
  }
  return `€${safeAmount.toFixed(2)}`;
}
