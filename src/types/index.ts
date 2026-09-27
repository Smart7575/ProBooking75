export type AppointmentStatus = 'reserved' | 'delivered' | 'cancelled' | 'no-show';

export interface ServiceType {
  id: string;
  name: string;
  durationMinutes: number;
  description: string;
  basePrice?: number; // Optional base price, or calculated from hourly rate
  color: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  vatNumber?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  notes?: string; // special notes (e.g. injuries, goals)
  specialNotes?: string; // alias for notes
  avatarUrl?: string;
  customHourlyRate?: number; // Overrides provider standard rate if set
  magicToken: string;
  isArchived?: boolean;
  createdAt: string;
}

export interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  enabled: boolean;
  startTime: string; // HH:mm (e.g. "09:00")
  endTime: string;   // HH:mm (e.g. "17:00")
  breakStart?: string; // HH:mm
  breakEnd?: string;   // HH:mm
  slotDuration?: number; // Custom slot duration in minutes (overrides trainer standard)
  bufferMinutes?: number; // Custom buffer between slots in minutes (overrides trainer standard)
}

export interface ScheduleException {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: 'vacation' | 'sick' | 'personal' | 'blocked';
  notes?: string;
}

export type SupportedCurrency = 'EUR' | 'USD' | 'CHF';
export type AvailabilityMode = 'weekly' | 'adhoc';

export interface AdHocAvailabilityBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (e.g. "09:00")
  endTime: string;   // HH:mm (e.g. "17:00")
  breakStart?: string; // HH:mm
  breakEnd?: string;   // HH:mm
  notes?: string;
  slotDuration?: number; // Custom slot duration in minutes (overrides trainer standard)
  bufferMinutes?: number; // Custom buffer between slots in minutes (overrides trainer standard)
}

export interface ProviderSettings {
  name: string;
  profession: string;
  email: string;
  phone: string;
  standardHourlyRate: number; // e.g. 65 EUR / USD / CHF
  currency: SupportedCurrency | string; // 'EUR' (€), 'USD' ($), or 'CHF' (CHF)
  standardSlotDuration: number; // e.g. 60 min
  bufferMinutes: number;      // e.g. 15 min
  cancellationPolicyHours: number; // e.g. 24 hours. 0 = unrestricted cancellation
  allowUnrestrictedCancellation: boolean;
  availabilityMode: AvailabilityMode; // 'weekly' = recurring week, 'adhoc' = date-specific flexible schedule
  weeklySchedule: DaySchedule[];
  adHocSchedule: AdHocAvailabilityBlock[];
  exceptions: ScheduleException[];
  services: ServiceType[];
  sendReminderHours: number[]; // e.g. [24, 1]
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  serviceId?: string; // Optional specific service ID, or undefined/'all' for any service
  sessionCount: number; // e.g. 5, 10, 20 sessions
  price: number; // Total package price in EUR
  originalValue?: number; // Calculated base value to highlight discount
  validityDays?: number; // e.g. 90, 180 days (or undefined for never expires)
  color?: string;
  isActive: boolean;
  featured?: boolean;
}

export type BillingStatus = 'to_invoice' | 'invoiced' | 'paid';

export interface BillingItem {
  id: string; // e.g. "appt-{id}" or "cpkg-{id}"
  sourceId: string;
  type: 'appointment' | 'package';
  clientId: string;
  clientName: string;
  clientEmail?: string;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  amount: number;
  status: BillingStatus;
  invoicedAt?: string;
  paidAt?: string;
  invoiceNumber?: string;
  packageId?: string;
  packageName?: string;
  isCoveredByPackage?: boolean;
}

export interface ClientPackage {
  id: string;
  clientId: string;
  packageId: string;
  packageName: string;
  serviceId?: string;
  totalSessions: number;
  remainingSessions: number;
  purchasedAt: string; // ISO date
  expiresAt?: string; // ISO date
  pricePaid: number;
  status: 'active' | 'exhausted' | 'expired';
  billingStatus?: BillingStatus;
  invoicedAt?: string;
  paidAt?: string;
  invoiceNumber?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  serviceId: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  durationMinutes: number;
  price: number;      // Calculated based on client/provider rate & duration, or 0 if covered by package
  status: AppointmentStatus;
  completionNotes?: string;
  createdAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  packageId?: string; // ID of the ClientPackage if booked using a package
  packageName?: string; // Name of the package applied
  billingStatus?: BillingStatus;
  invoicedAt?: string;
  paidAt?: string;
  invoiceNumber?: string;
}

export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  available: boolean;
  reasonIfUnavailable?: string;
}

export interface ChatMessage {
  id: string;
  clientId: string;
  sender: 'provider' | 'client';
  text: string;
  timestamp: string; // ISO string
  readByProvider: boolean;
  readByClient: boolean;
}

export interface InvoiceLineItem {
  id: string;
  sourceType?: 'appointment' | 'package' | 'custom';
  sourceId?: string;
  date?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 21, 9, 0
  vatAmount: number;
  total: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. "FACT-2026-0001"
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  clientPostalCode?: string;
  clientCity?: string;
  clientCountry?: string;
  clientTaxId?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceStatus;
  items: InvoiceLineItem[];
  subtotal: number;
  totalVat: number;
  totalAmount: number;
  currency: string;
  // Snapshot of supplier details at issuance
  senderBusinessName: string;
  senderTaxId: string;
  senderChamberOfCommerce: string;
  senderAddress: string;
  senderPostalCode: string;
  senderCity: string;
  senderCountry: string;
  senderPhone?: string;
  senderEmail: string;
  senderWebsite?: string;
  senderIban: string;
  senderBic?: string;
  senderBankName?: string;
  notes?: string;
  createdAt: string; // ISO
  paidAt?: string; // ISO
  archived?: boolean;
  isVatExempt?: boolean;
}

export interface InvoiceSettings {
  enabled: boolean;
  businessName: string;
  taxId: string; // BTW / VAT ID (e.g., NL849204912B01)
  chamberOfCommerce: string; // KVK / Company Reg (e.g., 78392019)
  address: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  iban: string;
  bic: string;
  bankName: string;
  paymentTermDays: number;
  defaultVatRate: number; // e.g., 21, 9, 0
  isVatExempt?: boolean;
  numberPrefix: string; // e.g., "FACT-{YYYY}-"
  numberPadding: number; // e.g., 4
  nextSequenceNumber: number; // e.g., 2
  invoiceNotes: string;
}

export type UserRole = 'provider' | 'client';
export type AppLanguage = 'en' | 'nl';

