import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { auth, db, formatFirestoreError, OperationType } from '../firebase';
import {
  ProviderSettings,
  Client,
  Appointment,
  AppointmentStatus,
  ServiceType,
  TimeSlot,
  UserRole,
  AppLanguage,
  ScheduleException,
  ServicePackage,
  ClientPackage,
  ChatMessage,
  AvailabilityMode,
  AdHocAvailabilityBlock,
  DaySchedule,
  BillingStatus,
  BillingItem,
  Invoice,
  InvoiceSettings,
  InvoiceLineItem,
} from '../types';
import {
  initialSettings,
  initialClients,
  initialAppointments,
  initialPackages,
  initialClientPackages,
  initialMessages,
  initialInvoiceSettings,
  initialInvoices,
} from '../data/initialData';
import {
  parseDateISO,
  formatDateISO,
  timeToMinutes,
  endTimeToMinutes,
  minutesToTime,
  isCancellationAllowed,
  addDaysToISO,
  addDays,
} from '../utils/dateUtils';
import { translations } from '../utils/translations';
import { SupportedCurrency, getCurrencySymbol, formatCurrency } from '../utils/currencyUtils';
import { formatInvoiceNumber } from '../utils/invoiceUtils';

interface BookingContextType {
  // State
  role: UserRole;
  setRole: (role: UserRole) => void;
  activeClientId: string;
  setActiveClientId: (id: string) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: typeof translations.en;
  
  // Currency Management (EUR, USD, CHF)
  currency: SupportedCurrency;
  setCurrency: (curr: SupportedCurrency) => void;
  currencySymbol: string;
  formatPrice: (amount: number | undefined | null) => string;
  
  settings: ProviderSettings;
  updateSettings: (newSettings: Partial<ProviderSettings>) => void;

  // Invoicing & Administration Module
  invoiceSettings: InvoiceSettings;
  updateInvoiceSettings: (settings: Partial<InvoiceSettings>) => void;
  invoices: Invoice[];
  createInvoice: (data: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  markInvoicePaid: (invoiceId: string) => void;
  deleteInvoice: (invoiceId: string) => void;
  getNextInvoiceNumber: () => string;

  
  clients: Client[];
  activeClients: Client[];
  addClient: (clientData: Omit<Client, 'id' | 'magicToken' | 'createdAt'>) => Client;
  updateClient: (id: string, clientData: Partial<Client>) => void;
  updateClientContactDetails: (id: string, details: Partial<Client>) => void;
  archiveClient: (id: string) => void;
  deleteClient: (id: string) => void;
  exportClientGDPR: (id: string) => string;
  
  services: ServiceType[];
  addService: (service: Omit<ServiceType, 'id'>) => void;
  updateService: (id: string, service: Partial<ServiceType>) => void;
  deleteService: (id: string) => void;

  // Packages & Bundles
  packages: ServicePackage[];
  addPackage: (pkg: Omit<ServicePackage, 'id'>) => void;
  updatePackage: (id: string, pkg: Partial<ServicePackage>) => void;
  deletePackage: (id: string) => void;
  
  clientPackages: ClientPackage[];
  purchasePackage: (clientId: string, packageId: string) => { success: boolean; clientPackage?: ClientPackage; message?: string };
  getClientActivePackages: (clientId: string, serviceId?: string) => ClientPackage[];
  adjustClientPackageBalance: (clientPackageId: string, change: number, reason?: string) => void;
  grantClientPackage: (clientId: string, packageId: string, customSessions?: number) => ClientPackage;
  updateClientPackage: (clientPackageId: string, updates: Partial<ClientPackage>) => void;
  deleteClientPackage: (clientPackageId: string) => void;
  
  exceptions: ScheduleException[];
  addException: (exception: Omit<ScheduleException, 'id'>) => void;
  updateException: (id: string, exception: Partial<ScheduleException>) => void;
  deleteException: (id: string) => void;

  // Availability Strategy & Ad-Hoc Management
  availabilityMode: AvailabilityMode;
  setAvailabilityMode: (mode: AvailabilityMode) => void;
  adHocSchedule: AdHocAvailabilityBlock[];
  addAdHocBlock: (block: Omit<AdHocAvailabilityBlock, 'id'>) => void;
  updateAdHocBlock: (id: string, block: Partial<AdHocAvailabilityBlock>) => void;
  deleteAdHocBlock: (id: string) => void;
  setAdHocBlocksForDate: (
    dateStr: string,
    blocks: {
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
      notes?: string;
      slotDuration?: number;
      bufferMinutes?: number;
    }[]
  ) => void;
  toggleDateAvailability: (dateStr: string, defaultStartTime?: string, defaultEndTime?: string) => void;
  copyDayAvailability: (sourceDateStr: string, targetDateStr: string) => void;
  isDateTimeAvailable: (dateStr: string, timeHourOrSlot: string) => boolean;
  getWorkingBlockForDateTime: (dateStr: string, timeHour: string) => {
    block: AdHocAvailabilityBlock;
    isSyntheticWeekly: boolean;
  } | null;
  saveWorkingBlock: (
    blockData: {
      date: string;
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
      notes?: string;
      slotDuration?: number;
      bufferMinutes?: number;
    },
    existingBlockId?: string,
    copyToWeek?: boolean
  ) => void;
  removeWorkingBlock: (
    dateStr: string,
    blockId?: string,
    timeHour?: string
  ) => void;
  updateWeeklyScheduleDay: (
    dayOfWeek: number,
    dayData: Partial<DaySchedule>
  ) => void;
  applyWeeklyScheduleToDateRange: (
    startDate: string,
    endDate: string,
    schedule: DaySchedule[],
    overwriteExisting?: boolean
  ) => number;
  getDateAvailabilityInfo: (dateStr: string) => {
    isAvailable: boolean;
    isException: boolean;
    mode: AvailabilityMode;
    blocks: {
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
      notes?: string;
      slotDuration?: number;
      bufferMinutes?: number;
    }[];
    totalHours: number;
    description: string;
  };
  
  appointments: Appointment[];
  bookAppointment: (
    clientId: string,
    serviceId: string,
    date: string,
    startTime: string,
    clientPackageId?: string
  ) => { success: boolean; appointment?: Appointment; message?: string };
  cancelAppointment: (
    appointmentId: string,
    reason?: string,
    forcedByProvider?: boolean
  ) => { success: boolean; message: string };
  updateAppointmentStatus: (
    appointmentId: string,
    status: AppointmentStatus,
    completionNotes?: string
  ) => void;
  updateAppointment: (
    appointmentId: string,
    updates: Partial<Appointment>
  ) => void;
  deleteAppointment: (appointmentId: string) => void;
  
  // Invoicing & Billing
  updateBillingItemStatus: (
    type: 'appointment' | 'package',
    id: string,
    status: BillingStatus,
    metadata?: { invoiceNumber?: string; invoicedAt?: string; paidAt?: string }
  ) => void;
  bulkUpdateBillingStatus: (
    items: Array<{ type: 'appointment' | 'package'; id: string }>,
    status: BillingStatus,
    metadata?: { invoiceNumber?: string }
  ) => void;
  getBillingItems: (clientId?: string) => BillingItem[];
  unbilledItemsCount: number;
  totalUnbilledAmount: number;
  
  // Slot calculations
  getAvailableSlotsForDate: (dateStr: string, serviceDurationMinutes: number) => TimeSlot[];
  calculateSessionPrice: (clientId: string, serviceId: string, durationMinutes?: number) => number;
  
  // Chat & Messaging
  messages: ChatMessage[];
  sendChatMessage: (clientId: string, sender: 'provider' | 'client', text: string) => void;
  sendBulkChatMessage: (clientIds: string[], text: string) => number;
  editChatMessage: (messageId: string, newText: string) => void;
  deleteChatMessage: (messageId: string) => void;
  markMessagesAsRead: (clientId: string, reader: 'provider' | 'client') => void;
  getUnreadCountForProvider: (clientId?: string) => number;
  getUnreadCountForClient: (clientId: string) => number;
  selectedChatClientId: string;
  setSelectedChatClientId: (id: string) => void;

  // Helpers
  resetDemoData: () => void;
  currentClient: Client | undefined;

  // Magic Link testing & simulation
  magicLinkNotification: { clientName: string; token: string } | null;
  dismissMagicLinkNotification: () => void;
  simulateMagicLink: (token: string) => boolean;

  // Firebase Cloud Sync state
  firebaseSyncStatus: 'connecting' | 'synced' | 'error';
  firebaseSyncError: string | null;
  forceSyncToFirebase: () => void;
  deleteTrainerAccount: (reauthOptions?: {
    password?: string;
    provider?: 'google' | 'apple';
  }) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'probooking_app_state_v1';

export const BookingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const currentUser = auth.currentUser;
  const userStoragePrefix = currentUser?.uid
    ? `${LOCAL_STORAGE_KEY}_${currentUser.uid}`
    : LOCAL_STORAGE_KEY;

  // Load initial from localStorage or defaults (default language: 'en' unless previously chosen)
  const [role, setRole] = useState<UserRole>('provider');
  const [activeClientId, setActiveClientId] = useState<string>('cli-1');
  const [magicLinkNotification, setMagicLinkNotification] = useState<{ clientName: string; token: string } | null>(null);
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const savedLang = localStorage.getItem('probooking_language');
      if (savedLang === 'en' || savedLang === 'nl') return savedLang;
    } catch {
      // ignore
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('probooking_language', lang);
    } catch {
      // ignore
    }
  }, []);
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<'connecting' | 'synced' | 'error'>('connecting');
  const [firebaseSyncError, setFirebaseSyncError] = useState<string | null>(null);
  const [isHydratedFromFirestore, setIsHydratedFromFirestore] = useState<boolean>(false);
  const [syncTrigger, setSyncTrigger] = useState<number>(0);
  const [reloadTrigger, setReloadTrigger] = useState<number>(0);
  const isHydratedFromFirestoreRef = useRef<boolean>(false);
  const isFirestoreWritableRef = useRef<boolean>(false);
  const isAccountDeletingRef = useRef<boolean>(false);
  const prevSubcollectionsRef = useRef<Record<string, Map<string, string>>>({});

  const forceSyncToFirebase = useCallback(() => {
    prevSubcollectionsRef.current = {};
    setFirebaseSyncStatus('connecting');
    setFirebaseSyncError(null);
    setReloadTrigger((n) => n + 1);
  }, []);

  const getPendingRegistration = () => {
    try {
      const raw = localStorage.getItem('probooking_pending_registration');
      if (raw) {
        return JSON.parse(raw) as {
          name?: string;
          profession?: string;
          phone?: string;
          standardHourlyRate?: number;
          email?: string;
          isExplicitRegister?: boolean;
        };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const fallbackUserName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : initialSettings.name);
  const fallbackUserEmail = currentUser?.email || initialSettings.email;

  const [settings, setSettings] = useState<ProviderSettings>(() => {
    const pendingReg = getPendingRegistration();
    const saved =
      localStorage.getItem(`${userStoragePrefix}_settings`) ||
      localStorage.getItem(`probooking_v3_${currentUser?.uid}_settings`);

    if (pendingReg && (pendingReg.isExplicitRegister || pendingReg.name || pendingReg.profession)) {
      return {
        ...initialSettings,
        name: pendingReg.name || fallbackUserName,
        profession: pendingReg.profession || 'Personal Trainer & Coach',
        email: pendingReg.email || fallbackUserEmail,
        phone: pendingReg.phone || initialSettings.phone,
        standardHourlyRate: pendingReg.standardHourlyRate || initialSettings.standardHourlyRate,
        availabilityMode: 'adhoc',
      };
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const resolvedName =
          parsed.name === 'Alex Jansen' && currentUser?.email !== 'alex@probooking.nl'
            ? fallbackUserName
            : parsed.name || fallbackUserName;
        return {
          ...initialSettings,
          ...parsed,
          name: resolvedName,
          email: parsed.email || fallbackUserEmail,
          availabilityMode: 'adhoc',
          adHocSchedule: Array.isArray(parsed.adHocSchedule)
            ? parsed.adHocSchedule
            : initialSettings.adHocSchedule,
        };
      } catch {
        return {
          ...initialSettings,
          name: fallbackUserName,
          profession: 'Personal Trainer & Coach',
          email: fallbackUserEmail,
        };
      }
    }
    return {
      ...initialSettings,
      name: fallbackUserName,
      profession: 'Personal Trainer & Coach',
      email: fallbackUserEmail,
    };
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_clients`);
    return saved ? JSON.parse(saved) : initialClients;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_appointments`);
    return saved ? JSON.parse(saved) : initialAppointments;
  });

  const [packages, setPackages] = useState<ServicePackage[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_packages`);
    return saved ? JSON.parse(saved) : initialPackages;
  });

  const [clientPackages, setClientPackages] = useState<ClientPackage[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_clientPackages`);
    return saved ? JSON.parse(saved) : initialClientPackages;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_messages`);
    return saved ? JSON.parse(saved) : initialMessages;
  });

  const [selectedChatClientId, setSelectedChatClientId] = useState<string>('cli-1');

  // Invoicing & Administration
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
    const pendingReg = getPendingRegistration();
    const saved = localStorage.getItem(`${userStoragePrefix}_invoiceSettings`);
    if (pendingReg && (pendingReg.isExplicitRegister || pendingReg.name)) {
      const tName = pendingReg.name || fallbackUserName;
      return {
        ...initialInvoiceSettings,
        businessName: `${tName} Coaching`,
        email: pendingReg.email || fallbackUserEmail,
        phone: pendingReg.phone || initialInvoiceSettings.phone,
      };
    }
    return saved ? JSON.parse(saved) : initialInvoiceSettings;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_invoices`);
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  // Listen for profile initialization event from AuthScreen
  useEffect(() => {
    const handleProfileInitialized = (e: Event) => {
      const customEvent = e as CustomEvent<{
        uid: string;
        settings: ProviderSettings;
        invoiceSettings: InvoiceSettings;
      }>;
      if (customEvent.detail?.settings) {
        setSettings(customEvent.detail.settings);
      }
      if (customEvent.detail?.invoiceSettings) {
        setInvoiceSettings(customEvent.detail.invoiceSettings);
      }
    };
    window.addEventListener('probooking:profile-initialized', handleProfileInitialized);
    return () => {
      window.removeEventListener('probooking:profile-initialized', handleProfileInitialized);
    };
  }, []);

  // Load trainer profile & clients from Firebase Firestore on mount / user change
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      isHydratedFromFirestoreRef.current = true;
      setIsHydratedFromFirestore(true);
      return;
    }

    let isCancelled = false;
    isHydratedFromFirestoreRef.current = false;
    setIsHydratedFromFirestore(false);
    setFirebaseSyncStatus('connecting');

    const loadFromFirestore = async () => {
      try {
        const pendingReg = getPendingRegistration();
        if (pendingReg) {
          localStorage.removeItem('probooking_pending_registration');
        }

        const trainerDocRef = doc(db, 'trainers', uid);
        const snap = await getDoc(trainerDocRef);

        if (isCancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          const cloudSettings = data.settings || {};
          const isDemoFallbackInCloud =
            (cloudSettings.name === 'Alex Jansen' || data.name === 'Alex Jansen') &&
            auth.currentUser?.email !== 'alex@probooking.nl';

          const resolvedName =
            pendingReg?.name ||
            (!isDemoFallbackInCloud && (cloudSettings.name || data.name)) ||
            auth.currentUser?.displayName ||
            settings.name;

          const resolvedProfession =
            pendingReg?.profession ||
            (!isDemoFallbackInCloud && (cloudSettings.profession || data.profession)) ||
            settings.profession;

          const resolvedPhone =
            pendingReg?.phone ||
            cloudSettings.phone ||
            data.phone ||
            settings.phone;

          const resolvedRate =
            pendingReg?.standardHourlyRate ||
            cloudSettings.standardHourlyRate ||
            data.standardHourlyRate ||
            settings.standardHourlyRate;

          const resolvedEmail =
            pendingReg?.email ||
            auth.currentUser?.email ||
            cloudSettings.email ||
            data.email ||
            settings.email;

          const loadedSettings: ProviderSettings = {
            ...settings,
            ...cloudSettings,
            name: resolvedName,
            profession: resolvedProfession,
            phone: resolvedPhone,
            standardHourlyRate: resolvedRate,
            email: resolvedEmail,
            availabilityMode: 'adhoc',
            adHocSchedule: Array.isArray(cloudSettings.adHocSchedule)
              ? cloudSettings.adHocSchedule
              : settings.adHocSchedule,
            exceptions: Array.isArray(cloudSettings.exceptions)
              ? cloudSettings.exceptions
              : settings.exceptions,
            services: Array.isArray(cloudSettings.services)
              ? cloudSettings.services
              : settings.services,
          };

          const loadedClients: Client[] = Array.isArray(data.clients) ? data.clients : clients;
          const loadedAppointments: Appointment[] = Array.isArray(data.appointments) ? data.appointments : appointments;
          const loadedPackages: ServicePackage[] = Array.isArray(data.packages) ? data.packages : packages;
          const loadedClientPackages: ClientPackage[] = Array.isArray(data.clientPackages) ? data.clientPackages : clientPackages;
          const loadedMessages: ChatMessage[] = Array.isArray(data.messages) ? data.messages : messages;
          const loadedInvoices: Invoice[] = Array.isArray(data.invoices) ? data.invoices : invoices;

          // Reset diff maps so existing items get verified/synced to subcollections if needed
          prevSubcollectionsRef.current = {};

          setSettings(loadedSettings);
          setClients(loadedClients);
          if (loadedClients.length > 0) {
            setActiveClientId(loadedClients[0].id);
            setSelectedChatClientId(loadedClients[0].id);
          }
          setAppointments(loadedAppointments);
          setPackages(loadedPackages);
          setClientPackages(loadedClientPackages);
          setMessages(loadedMessages);
          if (data.invoiceSettings) {
            setInvoiceSettings((prev) => ({
              ...prev,
              ...data.invoiceSettings,
              businessName:
                pendingReg?.name
                  ? `${pendingReg.name} Coaching`
                  : data.invoiceSettings.businessName === 'Jansen Performance Coaching' &&
                    auth.currentUser?.email !== 'alex@probooking.nl'
                  ? `${resolvedName} Coaching`
                  : data.invoiceSettings.businessName,
              email: resolvedEmail,
            }));
          }
          setInvoices(loadedInvoices);

          isHydratedFromFirestoreRef.current = true;
          isFirestoreWritableRef.current = true;
          setIsHydratedFromFirestore(true);
          setSyncTrigger((n) => n + 1);
          setFirebaseSyncStatus('synced');
          setFirebaseSyncError(null);
        } else {
          // Initialize new trainer document in Firestore
          const trainerName =
            pendingReg?.name ||
            auth.currentUser?.displayName ||
            settings.name;
          const trainerProfession =
            pendingReg?.profession ||
            settings.profession ||
            'Personal Trainer & Coach';
          const trainerPhone =
            pendingReg?.phone ||
            settings.phone;
          const trainerRate =
            pendingReg?.standardHourlyRate ||
            settings.standardHourlyRate;
          const trainerEmail =
            pendingReg?.email ||
            auth.currentUser?.email ||
            settings.email;

          const initialTrainerSettings: ProviderSettings = {
            ...settings,
            name: trainerName,
            profession: trainerProfession,
            phone: trainerPhone,
            standardHourlyRate: trainerRate,
            email: trainerEmail,
            availabilityMode: 'adhoc',
          };

          const initialTrainerInvoiceSettings: InvoiceSettings = {
            ...invoiceSettings,
            businessName: `${trainerName} Coaching`,
            email: trainerEmail,
            phone: trainerPhone,
          };

          prevSubcollectionsRef.current = {};
          setSettings(initialTrainerSettings);
          setInvoiceSettings(initialTrainerInvoiceSettings);

          await setDoc(
            trainerDocRef,
            {
              uid,
              name: initialTrainerSettings.name,
              profession: initialTrainerSettings.profession,
              email: initialTrainerSettings.email,
              phone: initialTrainerSettings.phone,
              standardHourlyRate: initialTrainerSettings.standardHourlyRate,
              settings: initialTrainerSettings,
              clients,
              appointments,
              packages,
              clientPackages,
              messages,
              invoiceSettings: initialTrainerInvoiceSettings,
              invoices,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          if (!isCancelled) {
            isHydratedFromFirestoreRef.current = true;
            isFirestoreWritableRef.current = true;
            setIsHydratedFromFirestore(true);
            setSyncTrigger((n) => n + 1);
            setFirebaseSyncStatus('synced');
            setFirebaseSyncError(null);
          }
        }
      } catch (err) {
        const errInfo = formatFirestoreError(err, OperationType.GET, `trainers/${uid}`);
        if (!isCancelled) {
          isHydratedFromFirestoreRef.current = true;
          isFirestoreWritableRef.current = false;
          setIsHydratedFromFirestore(true);
          setFirebaseSyncStatus('error');
          setFirebaseSyncError(errInfo.error);
        }
      }
    };

    loadFromFirestore();

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.uid, reloadTrigger]);

  // Sync to local storage & Firebase Firestore
  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_settings`, JSON.stringify(settings));
  }, [settings, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_clients`, JSON.stringify(clients));
  }, [clients, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_appointments`, JSON.stringify(appointments));
  }, [appointments, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_packages`, JSON.stringify(packages));
  }, [packages, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_clientPackages`, JSON.stringify(clientPackages));
  }, [clientPackages, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_messages`, JSON.stringify(messages));
  }, [messages, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_invoiceSettings`, JSON.stringify(invoiceSettings));
  }, [invoiceSettings, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_invoices`, JSON.stringify(invoices));
  }, [invoices, userStoragePrefix]);

  // Persist changes to Firebase Firestore whenever trainer state updates
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isHydratedFromFirestoreRef.current || !isFirestoreWritableRef.current || isAccountDeletingRef.current) return;

    const timer = setTimeout(async () => {
      if (isAccountDeletingRef.current) return;
      try {
        const nowIso = new Date().toISOString();
        await setDoc(
          doc(db, 'trainers', uid),
          {
            uid,
            name: settings.name,
            profession: settings.profession,
            email: settings.email,
            phone: settings.phone,
            standardHourlyRate: settings.standardHourlyRate,
            settings,
            clients,
            appointments,
            packages,
            clientPackages,
            messages,
            invoiceSettings,
            invoices,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        // Synchronize each entity collection into its own Firestore subcollection (Create, Update, Delete)
        const syncSubcollection = async <T extends { id: string }>(
          subcollectionName: string,
          items: T[],
          mirrorTopLevelCollection?: string
        ) => {
          const prevMap = prevSubcollectionsRef.current[subcollectionName] || new Map<string, string>();
          const nextMap = new Map<string, string>();
          const ops: Promise<unknown>[] = [];

          for (const item of items) {
            if (!item || !item.id) continue;
            const serialized = JSON.stringify(item);
            nextMap.set(item.id, serialized);
            if (prevMap.get(item.id) !== serialized) {
              const payload = {
                ...item,
                trainerId: uid,
                trainerName: settings.name,
                trainerEmail: settings.email,
                updatedAt: nowIso,
              };
              ops.push(
                setDoc(doc(db, 'trainers', uid, subcollectionName, item.id), payload, {
                  merge: true,
                })
              );
              if (mirrorTopLevelCollection) {
                ops.push(
                  setDoc(doc(db, mirrorTopLevelCollection, `${uid}_${item.id}`), payload, {
                    merge: true,
                  })
                );
              }
            }
          }

          // Delete removed items from Firestore subcollection
          for (const oldId of prevMap.keys()) {
            if (!nextMap.has(oldId)) {
              ops.push(deleteDoc(doc(db, 'trainers', uid, subcollectionName, oldId)));
              if (mirrorTopLevelCollection) {
                ops.push(deleteDoc(doc(db, mirrorTopLevelCollection, `${uid}_${oldId}`)));
              }
            }
          }

          prevSubcollectionsRef.current[subcollectionName] = nextMap;
          if (ops.length > 0) {
            await Promise.all(ops);
          }
        };

        await Promise.all([
          syncSubcollection('clients', clients, 'clients'),
          syncSubcollection('appointments', appointments, 'appointments'),
          syncSubcollection('availability', settings.adHocSchedule || [], 'availability'),
          syncSubcollection('exceptions', settings.exceptions || [], 'exceptions'),
          syncSubcollection('services', settings.services || [], 'services'),
          syncSubcollection('packages', packages, 'packages'),
          syncSubcollection('clientPackages', clientPackages, 'clientPackages'),
          syncSubcollection('messages', messages, 'messages'),
          syncSubcollection('invoices', invoices, 'invoices'),
        ]);

        setFirebaseSyncStatus('synced');
        setFirebaseSyncError(null);
      } catch (err) {
        const errInfo = formatFirestoreError(err, OperationType.WRITE, `trainers/${uid}`);
        isFirestoreWritableRef.current = false;
        setFirebaseSyncStatus('error');
        setFirebaseSyncError(errInfo.error);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    isHydratedFromFirestore,
    syncTrigger,
    settings,
    clients,
    appointments,
    packages,
    clientPackages,
    messages,
    invoiceSettings,
    invoices,
  ]);


  // Dismiss magic link notification banner
  const dismissMagicLinkNotification = () => {
    setMagicLinkNotification(null);
  };

  // Simulate opening a magic link directly inside the app
  const simulateMagicLink = (token: string): boolean => {
    const found = clients.find((c) => c.magicToken === token);
    if (found) {
      setActiveClientId(found.id);
      setRole('client');
      setMagicLinkNotification({
        clientName: found.name,
        token: found.magicToken,
      });
      // Optionally reflect in URL without reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('token', token);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Ignore in restricted iframe
      }
      return true;
    }
    return false;
  };

  // Check URL search & hash params for token (simulated magic booking link FR-4.2)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get('token');

      if (!token && window.location.hash) {
        const hash = window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);
        token = hashParams.get('token') || (hash.startsWith('token=') ? hash.split('=')[1] : null);
      }

      if (token) {
        const found = clients.find((c) => c.magicToken === token);
        if (found) {
          setActiveClientId(found.id);
          setRole('client');
          setMagicLinkNotification({
            clientName: found.name,
            token: found.magicToken,
          });
        }
      }
    } catch {
      // Ignore URL parse error in sandboxed environment
    }
  }, [clients]);

  const t = translations[language];

  // Currency management
  const currency = useMemo<SupportedCurrency>(() => {
    const c = settings.currency?.toUpperCase();
    if (c === 'USD' || c === 'CHF') return c;
    return 'EUR';
  }, [settings.currency]);

  const setCurrency = (newCurrency: SupportedCurrency) => {
    updateSettings({ currency: newCurrency });
  };

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const formatPrice = (amount: number | undefined | null) => formatCurrency(amount, currency);

  const activeClients = useMemo(() => clients.filter((c) => !c.isArchived), [clients]);
  const currentClient = useMemo(() => clients.find((c) => c.id === activeClientId), [clients, activeClientId]);

  // Settings update
  const updateSettings = (newSettings: Partial<ProviderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Client Management
  const syncClientToFirestore = async (client: Client) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const payload = {
        ...client,
        trainerId: uid,
        trainerName: settings.name,
        trainerEmail: settings.email,
        updatedAt: new Date().toISOString(),
      };
      await Promise.all([
        setDoc(doc(db, 'trainers', uid, 'clients', client.id), payload, { merge: true }),
        setDoc(doc(db, 'clients', `${uid}_${client.id}`), payload, { merge: true }),
      ]);
    } catch (err) {
      formatFirestoreError(err, OperationType.WRITE, `trainers/${uid}/clients/${client.id}`);
    }
  };

  const addClient = (clientData: Omit<Client, 'id' | 'magicToken' | 'createdAt'>): Client => {
    const randomHex = Math.random().toString(36).substring(2, 7);
    const slug = (clientData.name || 'client').toLowerCase().replace(/[^a-z0-9]/g, '');
    const token = `tok-${slug}-${randomHex}`;
    
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      magicToken: token,
      createdAt: formatDateISO(new Date()),
    };

    setClients((prev) => [newClient, ...prev]);
    syncClientToFirestore(newClient);

    return newClient;
  };

  const updateClient = (id: string, clientData: Partial<Client>) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...clientData };
          syncClientToFirestore(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const updateClientContactDetails = (id: string, details: Partial<Client>) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...details };
          syncClientToFirestore(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const archiveClient = (id: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, isArchived: !c.isArchived };
          syncClientToFirestore(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const deleteClient = (id: string) => {
    // Under GDPR FR-8: delete client and redact/remove their personal associations
    setClients((prev) => prev.filter((c) => c.id !== id));
    setAppointments((prev) => prev.filter((a) => a.clientId !== id));
    setClientPackages((prev) => prev.filter((cp) => cp.clientId !== id));
    setMessages((prev) => prev.filter((m) => m.clientId !== id));
    if (activeClientId === id && activeClients.length > 0) {
      setActiveClientId(activeClients[0].id);
    }
    const uid = auth.currentUser?.uid;
    if (uid) {
      Promise.all([
        deleteDoc(doc(db, 'trainers', uid, 'clients', id)),
        deleteDoc(doc(db, 'clients', `${uid}_${id}`)),
      ]).catch((err) => {
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}/clients/${id}`);
      });
    }
  };

  const exportClientGDPR = (id: string): string => {
    const client = clients.find((c) => c.id === id);
    if (!client) return '{}';
    const clientAppointments = appointments.filter((a) => a.clientId === id);
    const data = {
      clientProfile: client,
      bookingHistory: clientAppointments,
      exportDate: new Date().toISOString(),
      compliance: 'GDPR / AVG Article 15 Right of Access & Data Portability',
    };
    return JSON.stringify(data, null, 2);
  };

  // Service Management
  const addService = (service: Omit<ServiceType, 'id'>) => {
    const newSrv: ServiceType = {
      ...service,
      id: `srv-${Date.now()}`,
    };
    setSettings((prev) => ({
      ...prev,
      services: [...prev.services, newSrv],
    }));
  };

  const updateService = (id: string, serviceData: Partial<ServiceType>) => {
    setSettings((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, ...serviceData } : s)),
    }));
  };

  const deleteService = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s.id !== id),
    }));
  };

  // Schedule Exception Management
  const addException = (exc: Omit<ScheduleException, 'id'>) => {
    const newExc: ScheduleException = {
      ...exc,
      id: `exc-${Date.now()}`,
    };
    setSettings((prev) => ({
      ...prev,
      exceptions: [...prev.exceptions, newExc],
    }));
  };

  const updateException = (id: string, excData: Partial<ScheduleException>) => {
    setSettings((prev) => ({
      ...prev,
      exceptions: prev.exceptions.map((e) => (e.id === id ? { ...e, ...excData } : e)),
    }));
  };

  const deleteException = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      exceptions: prev.exceptions.filter((e) => e.id !== id),
    }));
    const uid = auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'trainers', uid, 'exceptions', id)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}/exceptions/${id}`)
      );
    }
  };

  // Package & Bundle Management
  const addPackage = (pkgData: Omit<ServicePackage, 'id'>) => {
    const newPkg: ServicePackage = {
      ...pkgData,
      id: `pkg-${Date.now()}`,
    };
    setPackages((prev) => [newPkg, ...prev]);
  };

  const updatePackage = (id: string, pkgData: Partial<ServicePackage>) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...pkgData } : p))
    );
  };

  const deletePackage = (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  const purchasePackage = (
    clientId: string,
    packageId: string
  ): { success: boolean; clientPackage?: ClientPackage; message?: string } => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return { success: false, message: 'Package not found' };
    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, message: 'Client not found' };

    const todayStr = formatDateISO(new Date());
    const expiresAt = pkg.validityDays ? addDaysToISO(todayStr, pkg.validityDays) : undefined;

    const newClientPackage: ClientPackage = {
      id: `cpkg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId,
      packageId: pkg.id,
      packageName: pkg.name,
      serviceId: pkg.serviceId,
      totalSessions: pkg.sessionCount,
      remainingSessions: pkg.sessionCount,
      purchasedAt: todayStr,
      expiresAt,
      pricePaid: pkg.price,
      status: 'active',
      billingStatus: 'to_invoice',
    };

    setClientPackages((prev) => [newClientPackage, ...prev]);

    return { success: true, clientPackage: newClientPackage, message: 'Package activated successfully!' };
  };

  const grantClientPackage = (
    clientId: string,
    packageId: string,
    customSessions?: number
  ): ClientPackage => {
    const pkg = packages.find((p) => p.id === packageId) || {
      id: 'pkg-custom',
      name: 'Complimentary / Custom Bundle',
      sessionCount: customSessions || 5,
      price: 0,
      serviceId: undefined,
      validityDays: 180,
    };
    const client = clients.find((c) => c.id === clientId);
    const todayStr = formatDateISO(new Date());
    const count = customSessions || pkg.sessionCount;
    const expiresAt = pkg.validityDays ? addDaysToISO(todayStr, pkg.validityDays) : undefined;

    const newClientPackage: ClientPackage = {
      id: `cpkg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId,
      packageId: pkg.id,
      packageName: pkg.name,
      serviceId: pkg.serviceId,
      totalSessions: count,
      remainingSessions: count,
      purchasedAt: todayStr,
      expiresAt,
      pricePaid: 0,
      status: 'active',
      billingStatus: pkg.price > 0 ? 'to_invoice' : 'paid',
    };

    setClientPackages((prev) => [newClientPackage, ...prev]);

    return newClientPackage;
  };

  const getClientActivePackages = (clientId: string, serviceId?: string): ClientPackage[] => {
    const todayStr = formatDateISO(new Date());
    return clientPackages.filter((cp) => {
      if (cp.clientId !== clientId) return false;
      if (cp.remainingSessions <= 0) return false;
      if (cp.expiresAt && cp.expiresAt < todayStr) return false;
      if (serviceId && cp.serviceId && cp.serviceId !== serviceId) return false;
      return true;
    });
  };

  const adjustClientPackageBalance = (clientPackageId: string, change: number) => {
    setClientPackages((prev) =>
      prev.map((cp) => {
        if (cp.id === clientPackageId) {
          const newRemaining = Math.max(0, cp.remainingSessions + change);
          return {
            ...cp,
            remainingSessions: newRemaining,
            status: newRemaining > 0 ? 'active' : 'exhausted',
          };
        }
        return cp;
      })
    );
  };

  const updateClientPackage = (clientPackageId: string, updates: Partial<ClientPackage>) => {
    setClientPackages((prev) =>
      prev.map((cp) => (cp.id === clientPackageId ? { ...cp, ...updates } : cp))
    );
  };

  const deleteClientPackage = (clientPackageId: string) => {
    setClientPackages((prev) => prev.filter((cp) => cp.id !== clientPackageId));
    const uid = auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'trainers', uid, 'clientPackages', clientPackageId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}/clientPackages/${clientPackageId}`)
      );
    }
  };

  // Availability Strategy & Ad-Hoc Management
  const setAvailabilityMode = (mode: AvailabilityMode) => {
    updateSettings({ availabilityMode: mode });
  };

  const addAdHocBlock = (block: Omit<AdHocAvailabilityBlock, 'id'>) => {
    const newBlock: AdHocAvailabilityBlock = {
      ...block,
      id: `adhoc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    updateSettings({
      adHocSchedule: [...(settings.adHocSchedule || []), newBlock],
    });
  };

  const updateAdHocBlock = (id: string, blockData: Partial<AdHocAvailabilityBlock>) => {
    updateSettings({
      adHocSchedule: (settings.adHocSchedule || []).map((b) =>
        b.id === id ? { ...b, ...blockData } : b
      ),
    });
  };

  const deleteAdHocBlock = (id: string) => {
    updateSettings({
      adHocSchedule: (settings.adHocSchedule || []).filter((b) => b.id !== id),
    });
  };

  const setAdHocBlocksForDate = (
    dateStr: string,
    blocks: {
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
      notes?: string;
      slotDuration?: number;
      bufferMinutes?: number;
    }[]
  ) => {
    setSettings((prev) => {
      const otherBlocks = (prev.adHocSchedule || []).filter((b) => b.date !== dateStr);
      const newBlocks: AdHocAvailabilityBlock[] = blocks.map((b, idx) => ({
        ...b,
        id: `adhoc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
        date: dateStr,
      }));
      return {
        ...prev,
        availabilityMode: 'adhoc',
        adHocSchedule: [...otherBlocks, ...newBlocks],
      };
    });
  };

  const toggleDateAvailability = (
    dateStr: string,
    defaultStartTime: string = '08:30',
    defaultEndTime: string = '17:30'
  ) => {
    const existing = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);
    if (existing.length > 0) {
      // Clear availability for this date
      updateSettings({
        adHocSchedule: (settings.adHocSchedule || []).filter((b) => b.date !== dateStr),
      });
    } else {
      // Add default block
      addAdHocBlock({
        date: dateStr,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        breakStart: '12:30',
        breakEnd: '13:15',
      });
    }
  };

  const copyDayAvailability = (sourceDateStr: string, targetDateStr: string) => {
    const sourceBlocks = (settings.adHocSchedule || []).filter((b) => b.date === sourceDateStr);
    const otherBlocks = (settings.adHocSchedule || []).filter((b) => b.date !== targetDateStr);
    if (sourceBlocks.length === 0) {
      updateSettings({
        adHocSchedule: otherBlocks,
      });
      return;
    }
    const copiedBlocks: AdHocAvailabilityBlock[] = sourceBlocks.map((b, idx) => ({
      ...b,
      id: `adhoc-${Date.now()}-${idx}`,
      date: targetDateStr,
    }));
    updateSettings({
      adHocSchedule: [...otherBlocks, ...copiedBlocks],
    });
  };

  // Check if a specific time slot/hour on a date is scheduled as working time
  const isDateTimeAvailable = (dateStr: string, timeHourOrSlot: string): boolean => {
    // 1. Check if date is blocked by an exception
    const isException = (settings.exceptions || []).some(
      (exc) => dateStr >= exc.startDate && dateStr <= exc.endDate
    );
    if (isException) return false;

    const timeMin = timeToMinutes(timeHourOrSlot.includes(':') ? timeHourOrSlot : `${timeHourOrSlot}:00`);
    const mode = settings.availabilityMode || 'weekly';

    // Priority 1: If ad hoc blocks exist for this specific date, they ALWAYS take effect
    const adHocBlocks = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);
    if (adHocBlocks.length > 0) {
      return adHocBlocks.some((b) => {
        const startMin = timeToMinutes(b.startTime);
        const endMin = endTimeToMinutes(b.endTime);
        const inWindow = timeMin >= startMin && timeMin < endMin;
        if (!inWindow) return false;
        if (b.breakStart && b.breakEnd) {
          const bsMin = timeToMinutes(b.breakStart);
          const beMin = endTimeToMinutes(b.breakEnd);
          if (timeMin >= bsMin && timeMin < beMin) return false;
        }
        return true;
      });
    }

    if (mode === 'adhoc') {
      // In ad hoc mode without blocks for this date, trainer is free
      return false;
    }

    // Weekly schedule fallback
    const dateObj = parseDateISO(dateStr);
    const dayOfWeek = dateObj.getDay();
    const daySched = settings.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (!daySched || !daySched.enabled) return false;
    const startMin = timeToMinutes(daySched.startTime);
    const endMin = endTimeToMinutes(daySched.endTime);
    const inWindow = timeMin >= startMin && timeMin < endMin;
    if (!inWindow) return false;
    if (daySched.breakStart && daySched.breakEnd) {
      const bsMin = timeToMinutes(daySched.breakStart);
      const beMin = endTimeToMinutes(daySched.breakEnd);
      if (timeMin >= bsMin && timeMin < beMin) return false;
    }
    return true;
  };

  // Find exact working block covering a date and time hour (Google Calendar style)
  const getWorkingBlockForDateTime = (
    dateStr: string,
    timeHour: string
  ): { block: AdHocAvailabilityBlock; isSyntheticWeekly: boolean } | null => {
    const isException = (settings.exceptions || []).some(
      (exc) => dateStr >= exc.startDate && dateStr <= exc.endDate
    );
    if (isException) return null;

    const timeMin = timeToMinutes(timeHour.includes(':') ? timeHour : `${timeHour}:00`);

    // 1. Check ad hoc schedule first
    const adHocBlocks = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);
    const foundAdHoc = adHocBlocks.find((b) => {
      const sMin = timeToMinutes(b.startTime);
      const eMin = endTimeToMinutes(b.endTime);
      return timeMin >= sMin && timeMin < eMin;
    });

    if (foundAdHoc) {
      return { block: foundAdHoc, isSyntheticWeekly: false };
    }

    // If explicit ad hoc blocks exist for this date, or in ad hoc mode, no weekly fallback
    if (adHocBlocks.length > 0 || settings.availabilityMode === 'adhoc') {
      return null;
    }

    // 2. Check weekly schedule
    const dateObj = parseDateISO(dateStr);
    const dayOfWeek = dateObj.getDay();
    const daySched = settings.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (daySched && daySched.enabled) {
      const sMin = timeToMinutes(daySched.startTime);
      const eMin = endTimeToMinutes(daySched.endTime);
      if (timeMin >= sMin && timeMin < eMin) {
        return {
          block: {
            id: `weekly-${dayOfWeek}-${dateStr}`,
            date: dateStr,
            startTime: daySched.startTime,
            endTime: daySched.endTime,
            breakStart: daySched.breakStart,
            breakEnd: daySched.breakEnd,
            slotDuration: daySched.slotDuration,
            bufferMinutes: daySched.bufferMinutes,
            notes: 'Vast weekrooster',
          },
          isSyntheticWeekly: true,
        };
      }
    }

    return null;
  };

  // Save or modify a working block (Google Calendar style)
  const saveWorkingBlock = (
    blockData: {
      date: string;
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
      notes?: string;
      slotDuration?: number;
      bufferMinutes?: number;
    },
    existingBlockId?: string,
    copyToWeek?: boolean
  ) => {
    let updatedSchedule = [...(settings.adHocSchedule || [])];

    if (existingBlockId && existingBlockId.startsWith('adhoc-')) {
      // Update existing ad hoc block
      updatedSchedule = updatedSchedule.map((b) =>
        b.id === existingBlockId
          ? {
              ...b,
              ...blockData,
            }
          : b
      );
    } else {
      // Add as new block (or converting from weekly schedule)
      const newBlock: AdHocAvailabilityBlock = {
        ...blockData,
        id: `adhoc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      // If there were other blocks for this date, keep non-overlapping ones
      const otherDateBlocks = updatedSchedule.filter((b) => b.date !== blockData.date);
      let sameDateExisting = updatedSchedule.filter(
        (b) => b.date === blockData.date && b.id !== existingBlockId
      );

      // If adding a new block on a date that was using the weekly schedule (and not replacing the weekly block),
      // materialize the weekly block so it is preserved alongside the new working block
      if (
        sameDateExisting.length === 0 &&
        !existingBlockId &&
        settings.availabilityMode === 'weekly'
      ) {
        const dateObj = parseDateISO(blockData.date);
        const dayOfWeek = dateObj.getDay();
        const daySched = settings.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
        if (daySched && daySched.enabled) {
          const wStart = timeToMinutes(daySched.startTime);
          const wEnd = endTimeToMinutes(daySched.endTime);
          const nStart = timeToMinutes(blockData.startTime);
          const nEnd = endTimeToMinutes(blockData.endTime);
          const overlaps = Math.max(wStart, nStart) < Math.min(wEnd, nEnd);
          if (!overlaps) {
            sameDateExisting = [
              {
                id: `adhoc-weekly-${Date.now()}`,
                date: blockData.date,
                startTime: daySched.startTime,
                endTime: daySched.endTime,
                breakStart: daySched.breakStart,
                breakEnd: daySched.breakEnd,
                slotDuration: daySched.slotDuration,
                bufferMinutes: daySched.bufferMinutes,
                notes: 'Vast weekrooster',
              },
            ];
          }
        }
      }

      updatedSchedule = [...otherDateBlocks, ...sameDateExisting, newBlock];
    }

    // If copyToWeek is true: apply to Monday through Friday of the same week
    if (copyToWeek) {
      const baseDate = parseDateISO(blockData.date);
      const dayOfWeek = baseDate.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      const monday = addDays(baseDate, -diffToMonday);

      for (let i = 0; i < 5; i++) {
        const targetD = addDays(monday, i);
        const targetStr = formatDateISO(targetD);
        if (targetStr !== blockData.date) {
          // Remove existing for target date and add copy
          updatedSchedule = updatedSchedule.filter((b) => b.date !== targetStr);
          updatedSchedule.push({
            ...blockData,
            date: targetStr,
            id: `adhoc-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          });
        }
      }
    }

    updateSettings({
      availabilityMode: 'adhoc',
      adHocSchedule: updatedSchedule,
    });
  };

  // Remove a working block (Google Calendar style - marks as free)
  const removeWorkingBlock = (
    dateStr: string,
    blockId?: string,
    timeHour?: string
  ) => {
    let updatedSchedule = [...(settings.adHocSchedule || [])];

    if (blockId && blockId.startsWith('adhoc-')) {
      updatedSchedule = updatedSchedule.filter((b) => b.id !== blockId);
    } else if (timeHour) {
      const timeMin = timeToMinutes(timeHour.includes(':') ? timeHour : `${timeHour}:00`);
      updatedSchedule = updatedSchedule.filter((b) => {
        if (b.date !== dateStr) return true;
        const sMin = timeToMinutes(b.startTime);
        const eMin = timeToMinutes(b.endTime);
        return !(timeMin >= sMin && timeMin < eMin);
      });
    }

    // If it was originally weekly, ensure this date has no adhoc blocks so in adhoc mode it is free
    updateSettings({
      availabilityMode: 'adhoc',
      adHocSchedule: updatedSchedule,
    });
  };

  // Update weekly schedule day
  const updateWeeklyScheduleDay = (dayOfWeek: number, dayData: Partial<DaySchedule>) => {
    updateSettings({
      weeklySchedule: settings.weeklySchedule.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, ...dayData } : d
      ),
    });
  };

  // Apply fixed weekly schedule across a specific date range [startDate, endDate]
  const applyWeeklyScheduleToDateRange = (
    startDate: string,
    endDate: string,
    schedule: DaySchedule[],
    overwriteExisting: boolean = true
  ): number => {
    const startObj = parseDateISO(startDate);
    const endObj = parseDateISO(endDate);
    const diffDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays <= 0 || diffDays > 730) return 0;

    let updatedAdHoc = [...(settings.adHocSchedule || [])];

    if (overwriteExisting) {
      updatedAdHoc = updatedAdHoc.filter((b) => b.date < startDate || b.date > endDate);
    }

    let appliedCount = 0;
    const nowTs = Date.now();

    for (let i = 0; i < diffDays; i++) {
      const currDate = addDays(startObj, i);
      const dStr = formatDateISO(currDate);
      const dow = currDate.getDay();

      // If not overwriting and this date already has ad hoc blocks, keep existing
      if (!overwriteExisting && updatedAdHoc.some((b) => b.date === dStr)) {
        continue;
      }

      const dayConfig = schedule.find((s) => s.dayOfWeek === dow);
      if (dayConfig && dayConfig.enabled) {
        updatedAdHoc.push({
          id: `adhoc-fixed-${nowTs}-${i}`,
          date: dStr,
          startTime: dayConfig.startTime,
          endTime: dayConfig.endTime,
          breakStart: dayConfig.breakStart || undefined,
          breakEnd: dayConfig.breakEnd || undefined,
          slotDuration: dayConfig.slotDuration,
          bufferMinutes: dayConfig.bufferMinutes,
          notes: `Vast weekrooster (${startDate} t/m ${endDate})`,
        });
        appliedCount++;
      }
    }

    updateSettings({
      availabilityMode: 'adhoc',
      weeklySchedule: schedule,
      adHocSchedule: updatedAdHoc,
    });

    return appliedCount;
  };

  // Get full availability summary for a date (used in Calendar Month/Week/Day view)
  const getDateAvailabilityInfo = (dateStr: string) => {
    const isException = (settings.exceptions || []).some(
      (exc) => dateStr >= exc.startDate && dateStr <= exc.endDate
    );
    if (isException) {
      return {
        isAvailable: false,
        isException: true,
        mode: settings.availabilityMode || 'weekly',
        blocks: [],
        totalHours: 0,
        description: 'Vakantie / Geblokkeerd',
      };
    }

    const mode = settings.availabilityMode || 'weekly';
    const adHocBlocks = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);

    // If explicit ad hoc blocks exist for this date, use them
    if (adHocBlocks.length > 0) {
      let totalMinutes = 0;
      adHocBlocks.forEach((b) => {
        const sMin = timeToMinutes(b.startTime);
        const eMin = endTimeToMinutes(b.endTime);
        let mins = eMin - sMin;
        if (b.breakStart && b.breakEnd) {
          const bsMin = timeToMinutes(b.breakStart);
          const beMin = endTimeToMinutes(b.breakEnd);
          if (beMin > bsMin && bsMin > sMin && beMin < eMin) {
            mins -= (beMin - bsMin);
          }
        }
        totalMinutes += Math.max(0, mins);
      });
      const desc = adHocBlocks.map((b) => `${b.startTime} - ${b.endTime}`).join(', ');
      return {
        isAvailable: true,
        isException: false,
        mode: mode,
        blocks: adHocBlocks,
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        description: desc,
      };
    }

    if (mode === 'adhoc') {
      return {
        isAvailable: false,
        isException: false,
        mode: 'adhoc' as AvailabilityMode,
        blocks: [],
        totalHours: 0,
        description: 'Niet ingepland',
      };
    } else {
      const dateObj = parseDateISO(dateStr);
      const dayOfWeek = dateObj.getDay();
      const daySched = settings.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
      if (!daySched || !daySched.enabled) {
        return {
          isAvailable: false,
          isException: false,
          mode: 'weekly' as AvailabilityMode,
          blocks: [],
          totalHours: 0,
          description: 'Vaste vrije dag',
        };
      }
      let mins = endTimeToMinutes(daySched.endTime) - timeToMinutes(daySched.startTime);
      if (daySched.breakStart && daySched.breakEnd) {
        mins -= (endTimeToMinutes(daySched.breakEnd) - timeToMinutes(daySched.breakStart));
      }
      return {
        isAvailable: true,
        isException: false,
        mode: 'weekly' as AvailabilityMode,
        blocks: [daySched],
        totalHours: Math.round((Math.max(0, mins) / 60) * 10) / 10,
        description: `${daySched.startTime} - ${daySched.endTime}`,
      };
    }
  };

  // Rates & Price calculation (FR-7.1, FR-7.2, FR-7.3)
  const calculateSessionPrice = (
    clientId: string,
    serviceId: string,
    durationMinutes?: number
  ): number => {
    const service = settings.services.find((s) => s.id === serviceId);
    const duration = durationMinutes || service?.durationMinutes || settings.standardSlotDuration;
    const client = clients.find((c) => c.id === clientId);

    // If client has specific hourly rate override, use that; else standard
    const hourlyRate = client?.customHourlyRate ?? settings.standardHourlyRate;
    
    // Calculate proportional price based on duration: e.g. 60 min = 1.0 * hourlyRate, 30 min = 0.5 * hourlyRate
    const calculatedPrice = (hourlyRate * duration) / 60;
    return Math.round(calculatedPrice * 100) / 100;
  };

  // Slot Generator Engine (FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-2.3, FR-3.1)
  // Supports both fixed 'weekly' recurring schedule and dynamic 'adhoc' date-by-date schedule
  // Ensures booked slots are removed, and cancelled slots immediately become available again.
  const getAvailableSlotsForDate = useCallback(
    (dateStr: string, serviceDurationMinutes: number): TimeSlot[] => {
      // 1. Check if entire day is blocked by an exception (vacation, sickness, etc.)
      const isExceptionBlocked = (settings.exceptions || []).some((exc) => {
        return dateStr >= exc.startDate && dateStr <= exc.endDate;
      });

      if (isExceptionBlocked) {
        return [];
      }

      interface WorkingWindow {
        startTime: string;
        endTime: string;
        breakStart?: string;
        breakEnd?: string;
        slotDuration?: number;
        bufferMinutes?: number;
      }

      const workingWindows: WorkingWindow[] = [];
      const mode = settings.availabilityMode || 'weekly';
      const adHocBlocks = (settings.adHocSchedule || []).filter((b) => b.date === dateStr);

      // If explicit ad hoc blocks exist for this date, they always take priority
      if (adHocBlocks.length > 0) {
        for (const b of adHocBlocks) {
          workingWindows.push({
            startTime: b.startTime,
            endTime: b.endTime,
            breakStart: b.breakStart,
            breakEnd: b.breakEnd,
            slotDuration: b.slotDuration,
            bufferMinutes: b.bufferMinutes,
          });
        }
      } else if (mode === 'adhoc') {
        // No blocks on this date in ad hoc mode
        return [];
      } else {
        const dateObj = parseDateISO(dateStr);
        const dayOfWeek = dateObj.getDay(); // 0-6
        const daySchedule = settings.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
        if (daySchedule && daySchedule.enabled) {
          workingWindows.push({
            startTime: daySchedule.startTime,
            endTime: daySchedule.endTime,
            breakStart: daySchedule.breakStart,
            breakEnd: daySchedule.breakEnd,
            slotDuration: daySchedule.slotDuration,
            bufferMinutes: daySchedule.bufferMinutes,
          });
        }
      }

      if (workingWindows.length === 0) {
        return [];
      }

      // Find all existing active appointments on this day (reserved or delivered)
      // Note: CANCELLED appointments are explicitly excluded so the slot is freed up immediately!
      const existingAppointments = appointments.filter(
        (a) => a.date === dateStr && a.status !== 'cancelled'
      );

      const availableSlots: TimeSlot[] = [];

      // Check if date is in the past
      const now = new Date();
      const todayStr = formatDateISO(now);
      const currentMinToday = now.getHours() * 60 + now.getMinutes();

      if (dateStr < todayStr) {
        return [];
      }

      for (const win of workingWindows) {
        const buffer =
          win.bufferMinutes !== undefined && win.bufferMinutes !== null
            ? win.bufferMinutes
            : settings.bufferMinutes !== undefined
            ? settings.bufferMinutes
            : 0;
        const dayStartMin = timeToMinutes(win.startTime);
        const dayEndMin = endTimeToMinutes(win.endTime);

        const hasBreak = Boolean(win.breakStart && win.breakEnd);
        const brkStart = hasBreak ? timeToMinutes(win.breakStart!) : null;
        const brkEnd = hasBreak ? endTimeToMinutes(win.breakEnd!) : null;

        type SubWin = { start: number; end: number };
        let subWindows: SubWin[] = [];

        if (hasBreak && brkStart !== null && brkEnd !== null && brkStart > dayStartMin && brkEnd < dayEndMin) {
          subWindows = [
            { start: dayStartMin, end: brkStart },
            { start: brkEnd, end: dayEndMin },
          ];
        } else {
          subWindows = [{ start: dayStartMin, end: dayEndMin }];
        }

        const slotDur = serviceDurationMinutes > 0 ? serviceDurationMinutes : (win.slotDuration || settings.standardSlotDuration || 60);
        const slotStep = (win.slotDuration && win.slotDuration > 0)
          ? win.slotDuration + buffer
          : (slotDur + buffer);

        for (const sub of subWindows) {
          const subDuration = sub.end - sub.start;
          if (subDuration <= 0) continue;

          const effectiveSlotDur = Math.min(slotDur, subDuration);
          const effectiveStep =
            win.slotDuration && win.slotDuration > 0
              ? Math.min(win.slotDuration, subDuration) + buffer
              : effectiveSlotDur + buffer;

          let curr = sub.start;
          while (curr + effectiveSlotDur <= sub.end) {
            const slotStart = curr;
            const slotEnd = curr + effectiveSlotDur;

            // 1. If date is today, slot must be in the future (at least 30 min from now)
            if (dateStr === todayStr && slotStart <= currentMinToday + 30) {
              curr += Math.max(15, effectiveStep);
              continue;
            }

            // 2. Check collision with existing active appointments on this day
            let collidesWithAppt = false;
            for (const appt of existingAppointments) {
              const apptStart = timeToMinutes(appt.startTime);
              const apptEnd = endTimeToMinutes(appt.endTime);

              // Overlap with appointment itself
              const directOverlap = Math.max(slotStart, apptStart) < Math.min(slotEnd, apptEnd);

              // Buffer compliance before and after
              const preBufferViolation = buffer > 0 && slotEnd > (apptStart - buffer) && slotStart < apptStart;
              const postBufferViolation = buffer > 0 && slotStart < (apptEnd + buffer) && slotEnd > apptEnd;

              if (directOverlap || preBufferViolation || postBufferViolation) {
                collidesWithAppt = true;
                break;
              }
            }

            // If not booked, this slot is available for booking
            if (!collidesWithAppt) {
              availableSlots.push({
                startTime: minutesToTime(slotStart),
                endTime: minutesToTime(slotEnd),
                available: true,
              });
            }

            curr += Math.max(15, effectiveStep);
          }
        }
      }

      return availableSlots;
    },
    [appointments, settings]
  );

  // Appointment Actions
  const bookAppointment = (
    clientId: string,
    serviceId: string,
    date: string,
    startTime: string,
    clientPackageId?: string
  ): { success: boolean; appointment?: Appointment; message?: string } => {
    const service = settings.services.find((s) => s.id === serviceId);
    if (!service) return { success: false, message: 'Invalid service selected' };

    const client = clients.find((c) => c.id === clientId);
    if (!client) return { success: false, message: 'Client not found' };

    let usedPackage: ClientPackage | undefined = undefined;
    if (clientPackageId) {
      usedPackage = clientPackages.find(
        (cp) => cp.id === clientPackageId && cp.clientId === clientId
      );
      if (!usedPackage) {
        return { success: false, message: 'Selected package was not found.' };
      }
      if (usedPackage.remainingSessions <= 0) {
        return { success: false, message: 'Selected package has 0 remaining sessions.' };
      }
      if (usedPackage.expiresAt && usedPackage.expiresAt < date) {
        return { success: false, message: 'Selected package has expired.' };
      }
    }

    const startMin = timeToMinutes(startTime);
    const endMin = startMin + service.durationMinutes;
    const endTime = minutesToTime(endMin);

    const standardPrice = calculateSessionPrice(clientId, serviceId, service.durationMinutes);
    const price = usedPackage ? 0 : standardPrice;

    const newAppt: Appointment = {
      id: `apt-${Date.now()}`,
      clientId,
      serviceId,
      date,
      startTime,
      endTime,
      durationMinutes: service.durationMinutes,
      price,
      status: 'reserved',
      createdAt: formatDateISO(new Date()),
      packageId: usedPackage?.id,
      packageName: usedPackage?.packageName,
    };

    setAppointments((prev) => [newAppt, ...prev]);

    // If a package was used, decrement remainingSessions
    if (usedPackage) {
      const remainingAfterDeduction = Math.max(0, usedPackage.remainingSessions - 1);
      setClientPackages((prev) =>
        prev.map((cp) =>
          cp.id === usedPackage!.id
            ? {
                ...cp,
                remainingSessions: remainingAfterDeduction,
                status: remainingAfterDeduction === 0 ? 'exhausted' : cp.status,
              }
            : cp
        )
      );
    }

    return { success: true, appointment: newAppt };
  };

  const cancelAppointment = (
    appointmentId: string,
    reason?: string,
    forcedByProvider: boolean = false
  ): { success: boolean; message: string } => {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (!appt) return { success: false, message: 'Appointment not found' };

    // Check cancellation window policy if not forced by provider (FR-6.2, FR-6.3)
    if (!forcedByProvider) {
      const check = isCancellationAllowed(
        appt.date,
        appt.startTime,
        settings.cancellationPolicyHours,
        settings.allowUnrestrictedCancellation
      );

      if (!check.allowed) {
        return {
          success: false,
          message: `Cancellation window expired. Cancellations must be made at least ${settings.cancellationPolicyHours} hours before the appointment. Please contact ${settings.name} directly.`,
        };
      }
    }

    // If appointment was booked via a package, restore 1 session!
    if (appt.packageId) {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (cp.id === appt.packageId) {
            const updatedRemaining = cp.remainingSessions + 1;
            return {
              ...cp,
              remainingSessions: updatedRemaining,
              status: updatedRemaining > 0 ? 'active' : cp.status,
            };
          }
          return cp;
        })
      );
    }

    // Update appointment status to cancelled (FR-6.4)
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId
          ? {
              ...a,
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancellationReason: reason || (forcedByProvider ? 'Cancelled by provider' : 'Cancelled by client'),
            }
          : a
      )
    );

    const client = clients.find((c) => c.id === appt.clientId);
    const service = settings.services.find((s) => s.id === appt.serviceId);
    const packageRefundMsg = appt.packageId
      ? `\n\nPackage Balance Restored: 1 session has been refunded to your "${appt.packageName || 'Package'}" balance.`
      : '';

    return { success: true, message: 'Appointment cancelled successfully. Slot is now reopened.' };
  };

  const updateAppointmentStatus = (
    appointmentId: string,
    status: AppointmentStatus,
    completionNotes?: string
  ) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId
          ? {
              ...a,
              status,
              completionNotes: completionNotes !== undefined ? completionNotes : a.completionNotes,
              billingStatus:
                status === 'delivered'
                  ? a.billingStatus || 'to_invoice'
                  : a.billingStatus,
            }
          : a
      )
    );
  };

  const updateAppointment = (appointmentId: string, updates: Partial<Appointment>) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== appointmentId) return a;
        const nextServiceId = updates.serviceId ?? a.serviceId;
        const service = settings.services.find((s) => s.id === nextServiceId);
        const nextDuration = updates.durationMinutes ?? (service ? service.durationMinutes : a.durationMinutes);
        const nextStartTime = updates.startTime ?? a.startTime;
        const nextEndTime =
          updates.endTime ?? minutesToTime(timeToMinutes(nextStartTime) + nextDuration);
        return {
          ...a,
          ...updates,
          serviceId: nextServiceId,
          durationMinutes: nextDuration,
          startTime: nextStartTime,
          endTime: nextEndTime,
        };
      })
    );
  };

  const deleteAppointment = (appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId);
    if (appt && appt.status === 'reserved' && appt.packageId) {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (cp.id === appt.packageId) {
            const updatedRemaining = cp.remainingSessions + 1;
            return {
              ...cp,
              remainingSessions: updatedRemaining,
              status: updatedRemaining > 0 ? 'active' : cp.status,
            };
          }
          return cp;
        })
      );
    }
    setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    const uid = auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'trainers', uid, 'appointments', appointmentId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}/appointments/${appointmentId}`)
      );
    }
  };

  // Invoicing & Billing management
  const updateBillingItemStatus = (
    type: 'appointment' | 'package',
    id: string,
    status: BillingStatus,
    metadata?: { invoiceNumber?: string; invoicedAt?: string; paidAt?: string }
  ) => {
    const todayStr = formatDateISO(new Date());

    if (type === 'appointment') {
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === id) {
            return {
              ...a,
              billingStatus: status,
              invoicedAt:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoicedAt || a.invoicedAt || (status === 'invoiced' ? todayStr : undefined),
              paidAt:
                status === 'paid'
                  ? metadata?.paidAt || a.paidAt || todayStr
                  : status === 'to_invoice'
                  ? undefined
                  : a.paidAt,
              invoiceNumber:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoiceNumber !== undefined
                  ? metadata.invoiceNumber
                  : a.invoiceNumber,
            };
          }
          return a;
        })
      );
    } else {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (cp.id === id) {
            return {
              ...cp,
              billingStatus: status,
              invoicedAt:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoicedAt || cp.invoicedAt || (status === 'invoiced' ? todayStr : undefined),
              paidAt:
                status === 'paid'
                  ? metadata?.paidAt || cp.paidAt || todayStr
                  : status === 'to_invoice'
                  ? undefined
                  : cp.paidAt,
              invoiceNumber:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoiceNumber !== undefined
                  ? metadata.invoiceNumber
                  : cp.invoiceNumber,
            };
          }
          return cp;
        })
      );
    }
  };

  const bulkUpdateBillingStatus = (
    items: Array<{ type: 'appointment' | 'package'; id: string }>,
    status: BillingStatus,
    metadata?: { invoiceNumber?: string }
  ) => {
    const todayStr = formatDateISO(new Date());
    const apptIds = new Set(items.filter((i) => i.type === 'appointment').map((i) => i.id));
    const pkgIds = new Set(items.filter((i) => i.type === 'package').map((i) => i.id));

    if (apptIds.size > 0) {
      setAppointments((prev) =>
        prev.map((a) => {
          if (apptIds.has(a.id)) {
            return {
              ...a,
              billingStatus: status,
              invoicedAt:
                status === 'to_invoice'
                  ? undefined
                  : a.invoicedAt || (status === 'invoiced' ? todayStr : undefined),
              paidAt:
                status === 'paid' ? a.paidAt || todayStr : status === 'to_invoice' ? undefined : a.paidAt,
              invoiceNumber:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoiceNumber !== undefined
                  ? metadata.invoiceNumber
                  : a.invoiceNumber,
            };
          }
          return a;
        })
      );
    }

    if (pkgIds.size > 0) {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (pkgIds.has(cp.id)) {
            return {
              ...cp,
              billingStatus: status,
              invoicedAt:
                status === 'to_invoice'
                  ? undefined
                  : cp.invoicedAt || (status === 'invoiced' ? todayStr : undefined),
              paidAt:
                status === 'paid' ? cp.paidAt || todayStr : status === 'to_invoice' ? undefined : cp.paidAt,
              invoiceNumber:
                status === 'to_invoice'
                  ? undefined
                  : metadata?.invoiceNumber !== undefined
                  ? metadata.invoiceNumber
                  : cp.invoiceNumber,
            };
          }
          return cp;
        })
      );
    }
  };

  const getBillingItems = useCallback(
    (targetClientId?: string): BillingItem[] => {
      const items: BillingItem[] = [];

      // 1. Delivered appointments
      appointments.forEach((appt) => {
        if (appt.status === 'delivered') {
          if (targetClientId && appt.clientId !== targetClientId) return;
          const client = clients.find((c) => c.id === appt.clientId);
          const service = settings.services.find((s) => s.id === appt.serviceId);
          const isCovered = !!appt.packageId;

          items.push({
            id: `appt-${appt.id}`,
            sourceId: appt.id,
            type: 'appointment',
            clientId: appt.clientId,
            clientName: client?.name || 'Client',
            clientEmail: client?.email,
            date: appt.date,
            title: service?.name || 'Personal Training',
            description: `${appt.durationMinutes} min (${appt.startTime} - ${appt.endTime})${
              isCovered ? ` • ${appt.packageName || 'Package'}` : ''
            }${appt.completionNotes ? ` • ${appt.completionNotes}` : ''}`,
            amount: isCovered ? 0 : appt.price,
            status: appt.billingStatus || 'to_invoice',
            invoicedAt: appt.invoicedAt,
            paidAt: appt.paidAt,
            invoiceNumber: appt.invoiceNumber,
            packageId: appt.packageId,
            packageName: appt.packageName,
            isCoveredByPackage: isCovered,
          });
        }
      });

      // 2. Purchased Packages
      clientPackages.forEach((cp) => {
        if (targetClientId && cp.clientId !== targetClientId) return;
        const client = clients.find((c) => c.id === cp.clientId);
        const purchaseDate = cp.purchasedAt ? cp.purchasedAt.split('T')[0] : formatDateISO(new Date());

        items.push({
          id: `cpkg-${cp.id}`,
          sourceId: cp.id,
          type: 'package',
          clientId: cp.clientId,
          clientName: client?.name || 'Client',
          clientEmail: client?.email,
          date: purchaseDate,
          title: cp.packageName,
          description: `${cp.totalSessions} sessions (${cp.remainingSessions} remaining)`,
          amount: cp.pricePaid,
          status: cp.billingStatus || 'to_invoice',
          invoicedAt: cp.invoicedAt,
          paidAt: cp.paidAt,
          invoiceNumber: cp.invoiceNumber,
        });
      });

      return items.sort((a, b) => b.date.localeCompare(a.date));
    },
    [appointments, clientPackages, clients, settings.services]
  );

  const { unbilledItemsCount, totalUnbilledAmount } = useMemo(() => {
    let count = 0;
    let total = 0;

    appointments.forEach((a) => {
      if (a.status === 'delivered') {
        const isToInvoice = !a.billingStatus || a.billingStatus === 'to_invoice';
        if (isToInvoice && !a.packageId && a.price > 0) {
          count++;
          total += a.price;
        }
      }
    });

    clientPackages.forEach((cp) => {
      const isToInvoice = !cp.billingStatus || cp.billingStatus === 'to_invoice';
      if (isToInvoice && cp.pricePaid > 0) {
        count++;
        total += cp.pricePaid;
      }
    });

    return { unbilledItemsCount: count, totalUnbilledAmount: total };
  }, [appointments, clientPackages]);

  // Chat & Messaging helpers
  const sendChatMessage = (clientId: string, sender: 'provider' | 'client', text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId,
      sender,
      text: trimmed,
      timestamp: new Date().toISOString(),
      readByProvider: sender === 'provider',
      readByClient: sender === 'client',
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const sendBulkChatMessage = (clientIds: string[], text: string): number => {
    const trimmed = text.trim();
    if (!trimmed || clientIds.length === 0) return 0;

    const uniqueIds = Array.from(new Set(clientIds));
    const nowIso = new Date().toISOString();

    const newMessages: ChatMessage[] = uniqueIds.map((cId, index) => {
      const clientObj = clients.find((c) => c.id === cId);
      const fullName = clientObj?.name || (language === 'nl' ? 'Klant' : 'Client');
      const firstName = fullName.split(' ')[0];

      const personalizedText = trimmed
        .replace(/\{firstName\}/gi, firstName)
        .replace(/\{voornaam\}/gi, firstName)
        .replace(/\{name\}/gi, fullName)
        .replace(/\{naam\}/gi, fullName);

      return {
        id: `msg-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
        clientId: cId,
        sender: 'provider',
        text: personalizedText,
        timestamp: nowIso,
        readByProvider: true,
        readByClient: false,
      };
    });

    setMessages((prev) => [...prev, ...newMessages]);
    return newMessages.length;
  };

  const editChatMessage = (messageId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, text: trimmed } : m))
    );
  };

  const deleteChatMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const uid = auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'trainers', uid, 'messages', messageId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}/messages/${messageId}`)
      );
    }
  };

  const markMessagesAsRead = (clientId: string, reader: 'provider' | 'client') => {
    setMessages((prev) => {
      let changed = false;
      const updated = prev.map((msg) => {
        if (msg.clientId === clientId) {
          if (reader === 'provider' && !msg.readByProvider) {
            changed = true;
            return { ...msg, readByProvider: true };
          }
          if (reader === 'client' && !msg.readByClient) {
            changed = true;
            return { ...msg, readByClient: true };
          }
        }
        return msg;
      });
      return changed ? updated : prev;
    });
  };

  const getUnreadCountForProvider = (clientId?: string): number => {
    if (clientId) {
      return messages.filter((m) => m.clientId === clientId && m.sender === 'client' && !m.readByProvider).length;
    }
    return messages.filter((m) => m.sender === 'client' && !m.readByProvider).length;
  };

  const getUnreadCountForClient = (clientId: string): number => {
    return messages.filter((m) => m.clientId === clientId && m.sender === 'provider' && !m.readByClient).length;
  };

  // Invoicing & Administration
  const updateInvoiceSettings = (updates: Partial<InvoiceSettings>) => {
    setInvoiceSettings((prev) => ({ ...prev, ...updates }));
  };

  const getNextInvoiceNumber = (): string => {
    return formatInvoiceNumber(
      invoiceSettings.numberPrefix,
      invoiceSettings.numberPadding,
      invoiceSettings.nextSequenceNumber,
      new Date()
    );
  };

  const createInvoice = (data: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const newInvoice: Invoice = {
      ...data,
      id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Increment next sequential number
    setInvoiceSettings((prev) => ({
      ...prev,
      nextSequenceNumber: prev.nextSequenceNumber + 1,
    }));

    // If invoice covers delivered appointments or purchased packages, sync status & invoice number
    if (data.items && data.items.length > 0) {
      const todayStr = formatDateISO(new Date());
      const apptSourceIds = new Set<string>();
      const pkgSourceIds = new Set<string>();

      data.items.forEach((item) => {
        if (item.sourceType === 'appointment' && item.sourceId) {
          apptSourceIds.add(item.sourceId);
        } else if (item.sourceType === 'package' && item.sourceId) {
          pkgSourceIds.add(item.sourceId);
        }
      });

      if (apptSourceIds.size > 0) {
        setAppointments((prev) =>
          prev.map((a) =>
            apptSourceIds.has(a.id)
              ? {
                  ...a,
                  billingStatus: 'invoiced',
                  invoiceNumber: data.invoiceNumber,
                  invoicedAt: data.issueDate || todayStr,
                }
              : a
          )
        );
      }

      if (pkgSourceIds.size > 0) {
        setClientPackages((prev) =>
          prev.map((cp) =>
            pkgSourceIds.has(cp.id)
              ? {
                  ...cp,
                  billingStatus: 'invoiced',
                  invoiceNumber: data.invoiceNumber,
                  invoicedAt: data.issueDate || todayStr,
                }
              : cp
          )
        );
      }
    }

    return newInvoice;
  };

  const updateInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, ...updates } : inv))
    );
  };

  const markInvoicePaid = (invoiceId: string) => {
    const todayStr = formatDateISO(new Date());
    let targetInv: Invoice | undefined;

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          targetInv = { ...inv, status: 'paid', paidAt: todayStr };
          return targetInv;
        }
        return inv;
      })
    );

    if (targetInv && targetInv.items) {
      const apptSourceIds = new Set(
        targetInv.items.filter((i) => i.sourceType === 'appointment' && i.sourceId).map((i) => i.sourceId!)
      );
      const pkgSourceIds = new Set(
        targetInv.items.filter((i) => i.sourceType === 'package' && i.sourceId).map((i) => i.sourceId!)
      );

      if (apptSourceIds.size > 0) {
        setAppointments((prev) =>
          prev.map((a) =>
            apptSourceIds.has(a.id)
              ? { ...a, billingStatus: 'paid', paidAt: todayStr }
              : a
          )
        );
      }

      if (pkgSourceIds.size > 0) {
        setClientPackages((prev) =>
          prev.map((cp) =>
            pkgSourceIds.has(cp.id)
              ? { ...cp, billingStatus: 'paid', paidAt: todayStr }
              : cp
          )
        );
      }
    }
  };

  const deleteInvoice = (invoiceId: string) => {
    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
  };

  const resetDemoData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_settings`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_clients`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_appointments`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_packages`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_clientPackages`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_messages`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_invoiceSettings`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_invoices`);
    setSettings(initialSettings);
    setClients(initialClients);
    setAppointments(initialAppointments);
    setPackages(initialPackages);
    setClientPackages(initialClientPackages);
    setMessages(initialMessages);
    setInvoiceSettings(initialInvoiceSettings);
    setInvoices(initialInvoices);
    setSelectedChatClientId('cli-1');
    setRole('provider');
    setActiveClientId('cli-1');
  };

  const deleteTrainerAccount = async (reauthOptions?: {
    password?: string;
    provider?: 'google' | 'apple';
  }): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Geen ingelogde gebruiker gevonden.');
    }

    const uid = user.uid;

    // 1. Optional re-authentication if requested (e.g. after auth/requires-recent-login)
    if (reauthOptions?.password && user.email) {
      const credential = EmailAuthProvider.credential(user.email, reauthOptions.password);
      await reauthenticateWithCredential(user, credential);
    } else if (reauthOptions?.provider === 'google') {
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await reauthenticateWithPopup(user, googleProvider);
    } else if (reauthOptions?.provider === 'apple') {
      const appleProvider = new OAuthProvider('apple.com');
      await reauthenticateWithPopup(user, appleProvider);
    }

    // 2. Stop any pending background syncs
    isAccountDeletingRef.current = true;
    isFirestoreWritableRef.current = false;

    const collectionNames = [
      'clients',
      'appointments',
      'availability',
      'exceptions',
      'services',
      'packages',
      'clientPackages',
      'messages',
      'invoices',
    ];

    const knownItemsByCollection: Record<string, Array<{ id: string }>> = {
      clients,
      appointments,
      availability: settings.adHocSchedule || [],
      exceptions: settings.exceptions || [],
      services: settings.services || [],
      packages,
      clientPackages,
      messages,
      invoices,
    };

    try {
      // 3. Delete all subcollection documents under trainers/{uid}/{subcollection}
      await Promise.all(
        collectionNames.map(async (colName) => {
          const deletePromises: Promise<unknown>[] = [];

          try {
            const subSnap = await getDocs(collection(db, 'trainers', uid, colName));
            subSnap.forEach((docSnap) => {
              deletePromises.push(deleteDoc(docSnap.ref).catch(() => {}));
            });
          } catch {
            // Fallback to known state item IDs if listing subcollection fails
          }

          const knownItems = knownItemsByCollection[colName] || [];
          for (const item of knownItems) {
            if (item?.id) {
              deletePromises.push(
                deleteDoc(doc(db, 'trainers', uid, colName, item.id)).catch(() => {})
              );
            }
          }

          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        })
      );

      // 4. Delete all mirrored documents in top-level collections where trainerId == uid
      await Promise.all(
        collectionNames.map(async (colName) => {
          try {
            const q = query(collection(db, colName), where('trainerId', '==', uid));
            const topSnap = await getDocs(q);
            const deletePromises: Promise<unknown>[] = [];
            topSnap.forEach((docSnap) => {
              deletePromises.push(deleteDoc(docSnap.ref).catch(() => {}));
            });
            if (deletePromises.length > 0) {
              await Promise.all(deletePromises);
            }
          } catch {
            // Ignore if collection does not exist or has no matching documents
          }
        })
      );

      // 5. Delete the root trainer document trainers/{uid}
      try {
        await deleteDoc(doc(db, 'trainers', uid));
      } catch (err) {
        formatFirestoreError(err, OperationType.DELETE, `trainers/${uid}`);
      }

      // 6. Clean up all localStorage keys associated with this user
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.includes(uid) ||
              key.startsWith(LOCAL_STORAGE_KEY) ||
              key.startsWith('probooking_v3_'))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // Ignore storage errors
      }

      prevSubcollectionsRef.current = {};

      // 7. Delete the Firebase Authentication user account
      await deleteUser(user);
    } catch (err) {
      isAccountDeletingRef.current = false;
      throw err;
    }
  };

  return (
    <BookingContext.Provider
      value={{
        role,
        setRole,
        activeClientId,
        setActiveClientId,
        language,
        setLanguage,
        t,
        currency,
        setCurrency,
        currencySymbol,
        formatPrice,
        settings,
        updateSettings,
        invoiceSettings,
        updateInvoiceSettings,
        invoices,
        createInvoice,
        updateInvoice,
        markInvoicePaid,
        deleteInvoice,
        getNextInvoiceNumber,
        clients,
        activeClients,
        addClient,
        updateClient,
        updateClientContactDetails,
        archiveClient,
        deleteClient,
        exportClientGDPR,
        services: settings.services,
        addService,
        updateService,
        deleteService,
        packages,
        addPackage,
        updatePackage,
        deletePackage,
        clientPackages,
        purchasePackage,
        getClientActivePackages,
        adjustClientPackageBalance,
        grantClientPackage,
        updateClientPackage,
        deleteClientPackage,
        exceptions: settings.exceptions,
        addException,
        updateException,
        deleteException,
        availabilityMode: 'adhoc',
        setAvailabilityMode,
        adHocSchedule: settings.adHocSchedule || [],
        addAdHocBlock,
        updateAdHocBlock,
        deleteAdHocBlock,
        setAdHocBlocksForDate,
        toggleDateAvailability,
        copyDayAvailability,
        isDateTimeAvailable,
        getWorkingBlockForDateTime,
        saveWorkingBlock,
        removeWorkingBlock,
        updateWeeklyScheduleDay,
        applyWeeklyScheduleToDateRange,
        getDateAvailabilityInfo,
        appointments,
        bookAppointment,
        cancelAppointment,
        updateAppointmentStatus,
        updateAppointment,
        deleteAppointment,
        updateBillingItemStatus,
        bulkUpdateBillingStatus,
        getBillingItems,
        unbilledItemsCount,
        totalUnbilledAmount,
        getAvailableSlotsForDate,
        calculateSessionPrice,
        messages,
        sendChatMessage,
        sendBulkChatMessage,
        editChatMessage,
        deleteChatMessage,
        markMessagesAsRead,
        getUnreadCountForProvider,
        getUnreadCountForClient,
        selectedChatClientId,
        setSelectedChatClientId,
        resetDemoData,
        currentClient,
        magicLinkNotification,
        dismissMagicLinkNotification,
        simulateMagicLink,
        firebaseSyncStatus,
        firebaseSyncError,
        forceSyncToFirebase,
        deleteTrainerAccount,
      }}
    >
      {children}
    </BookingContext.Provider>
  );

};

export const useBooking = (): BookingContextType => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
