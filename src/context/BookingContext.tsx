import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
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
  InvoiceStatus,
  InvoiceSettings,
  InvoiceLineItem,
  GroupSession,
  GroupSessionParticipant,
  ProBookingBackupData,
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
  initialGroupSessions,
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
import { SupportedCurrency, getCurrencySymbol, formatCurrency, sanitizeCurrencyCode } from '../utils/currencyUtils';
import { formatInvoiceNumber, isDemoTrainerName } from '../utils/invoiceUtils';
import { getUrlMagicLinkParams, clearUrlMagicLinkParams } from '../utils/urlUtils';

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
  createCreditNote: (originalInvoiceId: string) => Invoice | null;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  markInvoicePaid: (invoiceId: string) => void;
  deleteInvoice: (invoiceId: string) => void;
  getNextInvoiceNumber: () => string;
  getNextCreditNoteNumber: () => string;

  
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
  getClientActivePackages: (clientId: string, serviceId?: string, durationMinutes?: number) => ClientPackage[];
  getPackageStandardDuration: (cp?: ClientPackage, pkg?: ServicePackage) => number;
  calculatePackageCreditsForDuration: (durationMinutes: number, cp?: ClientPackage, pkg?: ServicePackage) => number;
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

  // Group Sessions
  groupSessions: GroupSession[];
  addGroupSession: (
    data: Omit<GroupSession, 'id' | 'createdAt' | 'participants'> & {
      participants?: GroupSessionParticipant[];
    }
  ) => GroupSession;
  updateGroupSession: (id: string, updates: Partial<GroupSession>) => void;
  deleteGroupSession: (id: string) => void;
  bookGroupSessionSpot: (
    groupSessionId: string,
    clientId: string,
    clientPackageId?: string
  ) => { success: boolean; message: string; appointment?: Appointment };
  cancelGroupSessionSpot: (
    groupSessionId: string,
    clientId: string,
    reason?: string
  ) => { success: boolean; message: string };
  isClientInGroupSession: (groupSessionId: string, clientId: string) => boolean;
  getGroupSessionSpotsLeft: (groupSessionId: string) => number;
  
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
  clearDemoData: () => Promise<void>;
  exportAllData: () => ProBookingBackupData;
  importAllData: (
    backup: ProBookingBackupData | string,
    mode?: 'replace' | 'merge'
  ) => {
    success: boolean;
    message: string;
    stats?: {
      clientsCount: number;
      appointmentsCount: number;
      invoicesCount: number;
      packagesCount: number;
      groupSessionsCount: number;
    };
  };
  currentClient: Client | undefined;

  // Magic Link testing & simulation
  magicLinkNotification: { clientName: string; token: string } | null;
  dismissMagicLinkNotification: () => void;
  simulateMagicLink: (token: string) => boolean;
  isTrainerPreview: boolean;
  exitTrainerPreview: () => void;

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
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const currentUser = authUser || auth.currentUser;
  const initialMagicLinkParams = getUrlMagicLinkParams();
  const [resolvedTrainerUid, setResolvedTrainerUid] = useState<string | null>(
    () => currentUser?.uid || initialMagicLinkParams.trainerId || null
  );
  const resolvedTrainerUidRef = useRef<string | null>(
    currentUser?.uid || initialMagicLinkParams.trainerId || null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      if (u?.uid) {
        resolvedTrainerUidRef.current = u.uid;
        setResolvedTrainerUid(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const effectiveUid = currentUser?.uid || resolvedTrainerUid;
  const userStoragePrefix = effectiveUid
    ? `${LOCAL_STORAGE_KEY}_${effectiveUid}`
    : LOCAL_STORAGE_KEY;

  // Load initial from localStorage or defaults (default language: 'en' unless previously chosen)
  // If a magic link ?token=... is present in the URL, start immediately in 'client' role!
  const [role, setRoleState] = useState<UserRole>(() =>
    initialMagicLinkParams.token ? 'client' : 'provider'
  );
  const isMagicLinkModeRef = useRef<boolean>(Boolean(initialMagicLinkParams.token));
  const [isTrainerPreview, setIsTrainerPreview] = useState<boolean>(false);
  const isTrainerPreviewRef = useRef<boolean>(false);
  const [activeClientId, setActiveClientId] = useState<string>('cli-1');
  const [magicLinkNotification, setMagicLinkNotification] = useState<{ clientName: string; token: string } | null>(null);

  const exitTrainerPreview = useCallback(() => {
    clearUrlMagicLinkParams();
    setMagicLinkNotification(null);
    isMagicLinkModeRef.current = false;
    isTrainerPreviewRef.current = false;
    setIsTrainerPreview(false);
    setRoleState('provider');
  }, []);

  const setRole = useCallback(
    (newRole: UserRole) => {
      if (newRole === 'client') {
        if (auth.currentUser && !getUrlMagicLinkParams().token) {
          isTrainerPreviewRef.current = true;
          setIsTrainerPreview(true);
        }
        setRoleState('client');
        return;
      }

      if (newRole === 'provider') {
        // If the trainer was previewing/testing a client from their own authenticated session, return directly to Trainer Dashboard
        if (auth.currentUser && isTrainerPreviewRef.current) {
          exitTrainerPreview();
          return;
        }

        const hasMagicTokenInUrl = Boolean(getUrlMagicLinkParams().token);
        const isLeavingClientOrMagicLink =
          role === 'client' ||
          isMagicLinkModeRef.current ||
          hasMagicTokenInUrl ||
          Boolean(magicLinkNotification);

        clearUrlMagicLinkParams();
        setMagicLinkNotification(null);
        isMagicLinkModeRef.current = false;
        isTrainerPreviewRef.current = false;
        setIsTrainerPreview(false);
        setRoleState('provider');

        if (!auth.currentUser || isLeavingClientOrMagicLink) {
          window.dispatchEvent(new CustomEvent('probooking:require-trainer-auth'));
          if (auth.currentUser) {
            signOut(auth).catch(() => {
              // ignore signOut errors
            });
          }
          return;
        }
      }
      setRoleState(newRole);
    },
    [role, magicLinkNotification, exitTrainerPreview]
  );
  const [language] = useState<AppLanguage>('en');

  const setLanguage = useCallback((_lang: AppLanguage) => {
    try {
      localStorage.setItem('probooking_language', 'en');
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
    isHydratedFromFirestoreRef.current = true;
    setIsHydratedFromFirestore(true);
    setFirebaseSyncStatus('connecting');
    setFirebaseSyncError(null);
    setSyncTrigger((n) => n + 1);
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
        const resolvedName = isDemoTrainerName(parsed.name, currentUser?.email)
          ? fallbackUserName
          : parsed.name || fallbackUserName;
        const isDemoEmail =
          parsed.email === 'mark@jansen-performance.nl' || parsed.email === 'alex@probooking.nl';
        return {
          ...initialSettings,
          ...parsed,
          name: resolvedName,
          email: (!isDemoEmail && parsed.email) || fallbackUserEmail,
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

  const [groupSessions, setGroupSessions] = useState<GroupSession[]>(() => {
    const saved = localStorage.getItem(`${userStoragePrefix}_groupSessions`);
    return saved ? JSON.parse(saved) : initialGroupSessions;
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
        businessName: tName,
        email: pendingReg.email || fallbackUserEmail,
        phone: pendingReg.phone || initialInvoiceSettings.phone,
        website: '',
      };
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as InvoiceSettings;
        const resolvedBizName = isDemoTrainerName(parsed.businessName, currentUser?.email)
          ? settings.name || fallbackUserName
          : parsed.businessName || settings.name || fallbackUserName;
        const isDemoEmail =
          parsed.email === 'mark@jansen-performance.nl' || parsed.email === 'alex@probooking.nl';
        return {
          ...initialInvoiceSettings,
          ...parsed,
          businessName: resolvedBizName,
          email: (!isDemoEmail && parsed.email) || settings.email || fallbackUserEmail,
          phone: parsed.phone || settings.phone,
          website:
            parsed.website === 'www.jansen-performance.nl' &&
            currentUser?.email !== 'mark@jansen-performance.nl'
              ? ''
              : parsed.website,
        };
      } catch {
        // fallback below
      }
    }
    return {
      ...initialInvoiceSettings,
      businessName: settings.name || fallbackUserName,
      email: settings.email || fallbackUserEmail,
      phone: settings.phone || initialInvoiceSettings.phone,
      website: '',
    };
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

  // Load trainer profile & clients from Firebase Firestore on mount / user change / magic link
  useEffect(() => {
    const { token: urlToken, trainerId: urlTrainerId } = getUrlMagicLinkParams();
    const authUid = auth.currentUser?.uid || null;

    if (!authUid && !urlToken && !urlTrainerId) {
      isHydratedFromFirestoreRef.current = true;
      setIsHydratedFromFirestore(true);
      return;
    }

    let isCancelled = false;
    isHydratedFromFirestoreRef.current = false;
    setIsHydratedFromFirestore(false);
    setFirebaseSyncStatus('connecting');

    const loadFromFirestore = async () => {
      let targetUid: string | null = authUid || urlTrainerId || null;

      try {
        const pendingReg = getPendingRegistration();
        if (pendingReg && authUid) {
          localStorage.removeItem('probooking_pending_registration');
        }

        // If accessed via public magic link without trainer UID in URL, look up trainer UID by client magicToken
        if (!targetUid && urlToken) {
          try {
            const clientQuery = query(
              collection(db, 'clients'),
              where('magicToken', '==', urlToken)
            );
            const clientSnap = await getDocs(clientQuery);
            if (!clientSnap.empty) {
              const foundTrainerId = clientSnap.docs[0].data()?.trainerId;
              if (foundTrainerId) {
                targetUid = foundTrainerId;
              }
            }
          } catch {
            // Fallback to scanning trainers collection below
          }

          if (!targetUid) {
            try {
              const trainersSnap = await getDocs(collection(db, 'trainers'));
              trainersSnap.forEach((docSnap) => {
                if (targetUid) return;
                const d = docSnap.data();
                if (
                  Array.isArray(d.clients) &&
                  d.clients.some((c: Client) => c.magicToken === urlToken)
                ) {
                  targetUid = docSnap.id;
                }
              });
            } catch {
              // Ignore if trainers collection cannot be listed
            }
          }
        }

        if (!targetUid) {
          // If no cloud trainer found (e.g. demo token only in local state), match locally
          if (!isCancelled) {
            if (urlToken) {
              const localMatch = clients.find((c) => c.magicToken === urlToken);
              if (localMatch) {
                isMagicLinkModeRef.current = true;
                setActiveClientId(localMatch.id);
                setSelectedChatClientId(localMatch.id);
                setRoleState('client');
                setMagicLinkNotification({
                  clientName: localMatch.name,
                  token: localMatch.magicToken,
                });
              }
            }
            isHydratedFromFirestoreRef.current = true;
            setIsHydratedFromFirestore(true);
            setFirebaseSyncStatus('synced');
          }
          return;
        }

        resolvedTrainerUidRef.current = targetUid;
        setResolvedTrainerUid(targetUid);

        const userDocRef = doc(db, 'users', targetUid);
        const trainerDocRef = doc(db, 'trainers', targetUid);
        let snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          try {
            const fallbackSnap = await getDoc(trainerDocRef);
            if (fallbackSnap.exists()) {
              snap = fallbackSnap;
            }
          } catch {
            // Ignore if trainers collection is restricted
          }
        }

        if (isCancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          const cloudSettings = data.settings || {};
          const isDemoFallbackInCloud =
            isDemoTrainerName(cloudSettings.name || data.name, auth.currentUser?.email);

          const resolvedName =
            pendingReg?.name ||
            (!isDemoFallbackInCloud && (cloudSettings.name || data.name)) ||
            auth.currentUser?.displayName ||
            (!isDemoTrainerName(settings.name, auth.currentUser?.email) ? settings.name : '') ||
            (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : settings.name);

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

          const cloudClients: Client[] = Array.isArray(data.clients) ? data.clients : [];
          let subcollectionClients: Client[] = [];
          try {
            const subSnap = await getDocs(collection(db, 'users', targetUid, 'clients'));
            subSnap.forEach((d) => {
              const cData = d.data() as Client;
              if (cData && cData.id) {
                subcollectionClients.push(cData);
              }
            });
          } catch {
            // Ignore subcollection read errors
          }

          // Merge cloud clients, subcollection clients, and any custom local clients created before sync succeeded
          const mergedClientsMap = new Map<string, Client>();
          for (const c of cloudClients) {
            if (c && c.id) mergedClientsMap.set(c.id, c);
          }
          for (const c of subcollectionClients) {
            if (c && c.id) mergedClientsMap.set(c.id, c);
          }
          const demoClientIds = new Set(initialClients.map((ic) => ic.id));
          for (const localC of clients) {
            if (localC && localC.id && !mergedClientsMap.has(localC.id)) {
              if (!demoClientIds.has(localC.id) || !Array.isArray(data.clients)) {
                mergedClientsMap.set(localC.id, localC);
              }
            }
          }

          const loadedClients: Client[] =
            mergedClientsMap.size > 0
              ? Array.from(mergedClientsMap.values())
              : Array.isArray(data.clients)
              ? data.clients
              : clients;
          const loadedAppointments: Appointment[] = Array.isArray(data.appointments) ? data.appointments : appointments;
          const loadedPackages: ServicePackage[] = Array.isArray(data.packages) ? data.packages : packages;
          const loadedClientPackages: ClientPackage[] = Array.isArray(data.clientPackages) ? data.clientPackages : clientPackages;
          const loadedMessages: ChatMessage[] = Array.isArray(data.messages) ? data.messages : messages;
          const loadedInvoices: Invoice[] = Array.isArray(data.invoices) ? data.invoices : invoices;

          // Reset diff maps so existing items get verified/synced to subcollections if needed
          prevSubcollectionsRef.current = {};

          setSettings(loadedSettings);
          setClients(loadedClients);

          if (urlToken) {
            isMagicLinkModeRef.current = true;
            const matchedClient = loadedClients.find((c) => c.magicToken === urlToken);
            if (matchedClient) {
              setActiveClientId(matchedClient.id);
              setSelectedChatClientId(matchedClient.id);
              setRoleState('client');
              setMagicLinkNotification({
                clientName: matchedClient.name,
                token: matchedClient.magicToken,
              });
            } else if (loadedClients.length > 0) {
              setActiveClientId(loadedClients[0].id);
              setSelectedChatClientId(loadedClients[0].id);
              setRoleState('client');
            }
          } else if (loadedClients.length > 0) {
            setActiveClientId(loadedClients[0].id);
            setSelectedChatClientId(loadedClients[0].id);
          }

          setAppointments(loadedAppointments);
          setPackages(loadedPackages);
          setClientPackages(loadedClientPackages);
          setMessages(loadedMessages);

          const cloudInvSettings = data.invoiceSettings || {};
          const resolvedBizName =
            pendingReg?.name ||
            (!isDemoTrainerName(cloudInvSettings.businessName, auth.currentUser?.email)
              ? cloudInvSettings.businessName
              : resolvedName);
          const resolvedWebsite =
            cloudInvSettings.website === 'www.jansen-performance.nl' &&
            auth.currentUser?.email !== 'mark@jansen-performance.nl'
              ? ''
              : cloudInvSettings.website ?? invoiceSettings.website ?? '';

          setInvoiceSettings((prev) => ({
            ...prev,
            ...cloudInvSettings,
            businessName: resolvedBizName,
            email: resolvedEmail,
            phone: cloudInvSettings.phone || resolvedPhone,
            website: resolvedWebsite,
          }));

          const sanitizedInvoices = loadedInvoices.map((inv) => {
            if (isDemoTrainerName(inv.senderBusinessName, auth.currentUser?.email)) {
              return {
                ...inv,
                senderBusinessName: resolvedBizName,
                senderEmail: resolvedEmail,
                senderPhone: cloudInvSettings.phone || resolvedPhone,
                senderWebsite: resolvedWebsite,
              };
            }
            return inv;
          });
          setInvoices(sanitizedInvoices);

          isHydratedFromFirestoreRef.current = true;
          isFirestoreWritableRef.current = true;
          setIsHydratedFromFirestore(true);
          setSyncTrigger((n) => n + 1);
          setFirebaseSyncStatus('synced');
          setFirebaseSyncError(null);
        } else if (authUid) {
          // Initialize new trainer document in Firestore under users/{uid}
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

          const initialTrainerPayload = JSON.parse(
            JSON.stringify({
              uid: authUid,
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
            })
          );

          await setDoc(userDocRef, initialTrainerPayload, { merge: true });
          setDoc(trainerDocRef, initialTrainerPayload, { merge: true }).catch(() => {});

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
        const errInfo = formatFirestoreError(err, OperationType.GET, `users/${targetUid || 'unknown'}`);
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
    localStorage.setItem(`${userStoragePrefix}_groupSessions`, JSON.stringify(groupSessions));
  }, [groupSessions, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_invoiceSettings`, JSON.stringify(invoiceSettings));
  }, [invoiceSettings, userStoragePrefix]);

  useEffect(() => {
    if (isAccountDeletingRef.current) return;
    localStorage.setItem(`${userStoragePrefix}_invoices`, JSON.stringify(invoices));
  }, [invoices, userStoragePrefix]);

  // Persist changes to Firebase Firestore whenever trainer/client state updates
  useEffect(() => {
    const uid = auth.currentUser?.uid || currentUser?.uid || resolvedTrainerUidRef.current;
    if (!uid || !isHydratedFromFirestoreRef.current || isAccountDeletingRef.current) return;

    const timer = setTimeout(async () => {
      if (isAccountDeletingRef.current) return;
      try {
        const nowIso = new Date().toISOString();
        const trainerDocPayload = JSON.parse(
          JSON.stringify({
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
          })
        );

        await setDoc(doc(db, 'users', uid), trainerDocPayload, { merge: true });
        setDoc(doc(db, 'trainers', uid), trainerDocPayload, { merge: true }).catch(() => {});
        isFirestoreWritableRef.current = true;
        setFirebaseSyncStatus('synced');
        setFirebaseSyncError(null);

        // Synchronize each entity collection into its own Firestore subcollection under users/{uid}/{subcollectionName}
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
              const payload = JSON.parse(
                JSON.stringify({
                  ...item,
                  userId: uid,
                  trainerId: uid,
                  trainerName: settings.name,
                  trainerEmail: settings.email,
                  updatedAt: nowIso,
                })
              );
              ops.push(
                setDoc(doc(db, 'users', uid, subcollectionName, item.id), payload, {
                  merge: true,
                })
              );
              ops.push(
                setDoc(doc(db, 'trainers', uid, subcollectionName, item.id), payload, {
                  merge: true,
                }).catch(() => {})
              );
              if (mirrorTopLevelCollection) {
                ops.push(
                  setDoc(doc(db, mirrorTopLevelCollection, `${uid}_${item.id}`), payload, {
                    merge: true,
                  }).catch(() => {})
                );
              }
            }
          }

          // Delete removed items from Firestore subcollection
          for (const oldId of prevMap.keys()) {
            if (!nextMap.has(oldId)) {
              ops.push(
                deleteDoc(doc(db, 'users', uid, subcollectionName, oldId)).catch(() => {})
              );
              ops.push(
                deleteDoc(doc(db, 'trainers', uid, subcollectionName, oldId)).catch(() => {})
              );
              if (mirrorTopLevelCollection) {
                ops.push(
                  deleteDoc(doc(db, mirrorTopLevelCollection, `${uid}_${oldId}`)).catch(() => {})
                );
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
      } catch (err) {
        const errInfo = formatFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        setFirebaseSyncStatus('error');
        setFirebaseSyncError(errInfo.error);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [
    currentUser?.uid,
    resolvedTrainerUid,
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

  // Simulate opening a magic link directly inside the app (Trainer testing as Client)
  const simulateMagicLink = (token: string): boolean => {
    const found = clients.find((c) => c.magicToken === token);
    if (found) {
      isTrainerPreviewRef.current = true;
      setIsTrainerPreview(true);
      isMagicLinkModeRef.current = false;
      setActiveClientId(found.id);
      setSelectedChatClientId(found.id);
      setRoleState('client');
      setMagicLinkNotification({
        clientName: found.name,
        token: found.magicToken,
      });
      return true;
    }
    return false;
  };

  // Check URL search & hash params for token (simulated magic booking link FR-4.2)
  useEffect(() => {
    const { token } = getUrlMagicLinkParams();
    if (token) {
      isMagicLinkModeRef.current = true;
      setRoleState('client');
      const found = clients.find((c) => c.magicToken === token);
      if (found) {
        setActiveClientId(found.id);
        setSelectedChatClientId(found.id);
        setMagicLinkNotification({
          clientName: found.name,
          token: found.magicToken,
        });
      }
    }
  }, [clients]);

  const t = translations.en;

  // Currency management
  const currency = useMemo<SupportedCurrency>(() => {
    const c = sanitizeCurrencyCode(settings.currency);
    return c || 'EUR';
  }, [settings.currency]);

  const setCurrency = (newCurrency: SupportedCurrency) => {
    const cleaned = sanitizeCurrencyCode(newCurrency) || 'EUR';
    updateSettings({ currency: cleaned });
  };

  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const formatPrice = (amount: number | undefined | null) => formatCurrency(amount, currency);

  const activeClients = useMemo(() => clients.filter((c) => !c.isArchived), [clients]);
  const currentClient = useMemo(() => clients.find((c) => c.id === activeClientId), [clients, activeClientId]);

  // Settings update
  const updateSettings = (newSettings: Partial<ProviderSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      // Also keep invoiceSettings in sync when trainer updates their name, email, or phone
      if (newSettings.name || newSettings.email || newSettings.phone) {
        setInvoiceSettings((prevInv) => {
          const shouldSyncBusinessName =
            newSettings.name &&
            (isDemoTrainerName(prevInv.businessName, updated.email) ||
              prevInv.businessName === prev.name ||
              prevInv.businessName === `${prev.name} Coaching`);
          const isDemoEmail =
            prevInv.email === 'mark@jansen-performance.nl' ||
            prevInv.email === 'alex@probooking.nl';
          return {
            ...prevInv,
            businessName: shouldSyncBusinessName ? newSettings.name! : prevInv.businessName,
            email:
              newSettings.email && (isDemoEmail || prevInv.email === prev.email || !prevInv.email)
                ? newSettings.email
                : prevInv.email,
            phone:
              newSettings.phone && (prevInv.phone === prev.phone || !prevInv.phone)
                ? newSettings.phone
                : prevInv.phone,
          };
        });
      }
      return updated;
    });
  };

  // Client Management
  const syncClientToFirestore = async (client: Client, nextClientsList?: Client[]) => {
    const uid = auth.currentUser?.uid || currentUser?.uid || resolvedTrainerUidRef.current;
    if (!uid) return;
    try {
      const nowIso = new Date().toISOString();
      const payload = JSON.parse(
        JSON.stringify({
          ...client,
          userId: uid,
          trainerId: uid,
          trainerName: settings.name,
          trainerEmail: settings.email,
          updatedAt: nowIso,
        })
      );
      await setDoc(doc(db, 'users', uid, 'clients', client.id), payload, { merge: true });
      if (nextClientsList) {
        const cleanClients = JSON.parse(JSON.stringify(nextClientsList));
        await setDoc(
          doc(db, 'users', uid),
          {
            uid,
            clients: cleanClients,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }
      setDoc(doc(db, 'trainers', uid, 'clients', client.id), payload, { merge: true }).catch(() => {});
      setDoc(doc(db, 'clients', `${uid}_${client.id}`), payload, { merge: true }).catch(() => {});
      setFirebaseSyncStatus('synced');
      setFirebaseSyncError(null);
    } catch (err) {
      const errInfo = formatFirestoreError(err, OperationType.WRITE, `users/${uid}/clients/${client.id}`);
      setFirebaseSyncStatus('error');
      setFirebaseSyncError(errInfo.error);
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

    const nextClients = [newClient, ...clients];
    setClients(nextClients);
    syncClientToFirestore(newClient, nextClients);

    return newClient;
  };

  const updateClient = (id: string, clientData: Partial<Client>) => {
    setClients((prev) => {
      let updatedClient: Client | null = null;
      const nextClients = prev.map((c) => {
        if (c.id === id) {
          updatedClient = { ...c, ...clientData };
          return updatedClient;
        }
        return c;
      });
      if (updatedClient) {
        syncClientToFirestore(updatedClient, nextClients);
      }
      return nextClients;
    });
  };

  const updateClientContactDetails = (id: string, details: Partial<Client>) => {
    setClients((prev) => {
      let updatedClient: Client | null = null;
      const nextClients = prev.map((c) => {
        if (c.id === id) {
          updatedClient = { ...c, ...details };
          return updatedClient;
        }
        return c;
      });
      if (updatedClient) {
        syncClientToFirestore(updatedClient, nextClients);
      }
      return nextClients;
    });
  };

  const archiveClient = (id: string) => {
    setClients((prev) => {
      let updatedClient: Client | null = null;
      const nextClients = prev.map((c) => {
        if (c.id === id) {
          updatedClient = { ...c, isArchived: !c.isArchived };
          return updatedClient;
        }
        return c;
      });
      if (updatedClient) {
        syncClientToFirestore(updatedClient, nextClients);
      }
      return nextClients;
    });
  };

  const deleteClient = (id: string) => {
    // Under GDPR FR-8: delete client and redact/remove their personal associations
    const nextClients = clients.filter((c) => c.id !== id);
    setClients(nextClients);
    setAppointments((prev) => prev.filter((a) => a.clientId !== id));
    setClientPackages((prev) => prev.filter((cp) => cp.clientId !== id));
    setMessages((prev) => prev.filter((m) => m.clientId !== id));
    if (activeClientId === id && activeClients.length > 0) {
      setActiveClientId(activeClients[0].id);
    }
    const uid = auth.currentUser?.uid || currentUser?.uid || resolvedTrainerUidRef.current;
    if (uid) {
      const cleanClients = JSON.parse(JSON.stringify(nextClients));
      Promise.all([
        deleteDoc(doc(db, 'users', uid, 'clients', id)),
        setDoc(
          doc(db, 'users', uid),
          { uid, clients: cleanClients, updatedAt: new Date().toISOString() },
          { merge: true }
        ),
        deleteDoc(doc(db, 'trainers', uid, 'clients', id)).catch(() => {}),
        deleteDoc(doc(db, 'clients', `${uid}_${id}`)).catch(() => {}),
      ]).catch((err) => {
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}/clients/${id}`);
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
      deleteDoc(doc(db, 'users', uid, 'exceptions', id)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}/exceptions/${id}`)
      );
      deleteDoc(doc(db, 'trainers', uid, 'exceptions', id)).catch(() => {});
    }
  };

  // Package & Bundle Management
  const getPackageStandardDuration = useCallback(
    (cp?: ClientPackage, pkg?: ServicePackage): number => {
      if (cp?.sessionDurationMinutes && cp.sessionDurationMinutes > 0) {
        return cp.sessionDurationMinutes;
      }
      if (pkg?.sessionDurationMinutes && pkg.sessionDurationMinutes > 0) {
        return pkg.sessionDurationMinutes;
      }
      const matchedPkg = cp ? packages.find((p) => p.id === cp.packageId) : undefined;
      if (matchedPkg?.sessionDurationMinutes && matchedPkg.sessionDurationMinutes > 0) {
        return matchedPkg.sessionDurationMinutes;
      }
      const srvId = cp?.serviceId || pkg?.serviceId || matchedPkg?.serviceId;
      if (srvId) {
        const linkedSrv = settings.services.find((s) => s.id === srvId);
        if (linkedSrv && linkedSrv.durationMinutes > 0) {
          return linkedSrv.durationMinutes;
        }
      }
      return settings.standardSlotDuration || 60;
    },
    [packages, settings.services, settings.standardSlotDuration]
  );

  const calculatePackageCreditsForDuration = useCallback(
    (durationMinutes: number, cp?: ClientPackage, pkg?: ServicePackage): number => {
      const stdDuration = getPackageStandardDuration(cp, pkg);
      if (!stdDuration || stdDuration <= 0) return 1;
      const effDuration = durationMinutes > 0 ? durationMinutes : stdDuration;
      return Math.round((effDuration / stdDuration) * 100) / 100;
    },
    [getPackageStandardDuration]
  );

  const addPackage = (pkgData: Omit<ServicePackage, 'id'>) => {
    const newPkg: ServicePackage = {
      ...pkgData,
      sessionDurationMinutes: pkgData.sessionDurationMinutes || 60,
      id: `pkg-${Date.now()}`,
    };
    setPackages((prev) => [newPkg, ...prev]);
  };

  const updatePackage = (id: string, pkgData: Partial<ServicePackage>) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...pkgData } : p))
    );
    if (pkgData.sessionDurationMinutes && pkgData.sessionDurationMinutes > 0) {
      setClientPackages((prev) =>
        prev.map((cp) =>
          cp.packageId === id
            ? {
                ...cp,
                sessionDurationMinutes: pkgData.sessionDurationMinutes,
                packageName: pkgData.name || cp.packageName,
              }
            : cp
        )
      );
    }
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
    const stdDuration = getPackageStandardDuration(undefined, pkg);

    const newClientPackage: ClientPackage = {
      id: `cpkg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId,
      packageId: pkg.id,
      packageName: pkg.name,
      serviceId: pkg.serviceId,
      totalSessions: pkg.sessionCount,
      remainingSessions: pkg.sessionCount,
      sessionDurationMinutes: stdDuration,
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
      sessionDurationMinutes: settings.standardSlotDuration || 60,
      price: 0,
      serviceId: undefined,
      validityDays: 180,
      isActive: true,
      description: '',
    };
    const todayStr = formatDateISO(new Date());
    const count = customSessions || pkg.sessionCount;
    const expiresAt = pkg.validityDays ? addDaysToISO(todayStr, pkg.validityDays) : undefined;
    const stdDuration = getPackageStandardDuration(undefined, pkg as ServicePackage);

    const newClientPackage: ClientPackage = {
      id: `cpkg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId,
      packageId: pkg.id,
      packageName: pkg.name,
      serviceId: pkg.serviceId,
      totalSessions: count,
      remainingSessions: count,
      sessionDurationMinutes: stdDuration,
      purchasedAt: todayStr,
      expiresAt,
      pricePaid: 0,
      status: 'active',
      billingStatus: pkg.price > 0 ? 'to_invoice' : 'paid',
    };

    setClientPackages((prev) => [newClientPackage, ...prev]);

    return newClientPackage;
  };

  const getClientActivePackages = (
    clientId: string,
    serviceId?: string,
    durationMinutes?: number
  ): ClientPackage[] => {
    const todayStr = formatDateISO(new Date());
    const targetService = serviceId
      ? settings.services.find((s) => s.id === serviceId)
      : undefined;
    const effectiveDuration = durationMinutes ?? targetService?.durationMinutes;

    return clientPackages.filter((cp) => {
      if (cp.clientId !== clientId) return false;
      if (cp.remainingSessions <= 0) return false;
      if (cp.expiresAt && cp.expiresAt < todayStr) return false;
      if (effectiveDuration && effectiveDuration > 0) {
        const neededCredits = calculatePackageCreditsForDuration(effectiveDuration, cp);
        if (cp.remainingSessions + 0.0001 < neededCredits) return false;
      }
      return true;
    });
  };

  const adjustClientPackageBalance = (clientPackageId: string, change: number) => {
    setClientPackages((prev) =>
      prev.map((cp) => {
        if (cp.id === clientPackageId) {
          const newRemaining = Math.max(
            0,
            Math.round((cp.remainingSessions + change) * 100) / 100
          );
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
      deleteDoc(doc(db, 'users', uid, 'clientPackages', clientPackageId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}/clientPackages/${clientPackageId}`)
      );
      deleteDoc(doc(db, 'trainers', uid, 'clientPackages', clientPackageId)).catch(() => {});
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
            notes: 'Fixed weekly schedule',
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
                notes: 'Fixed weekly schedule',
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
          notes: `Fixed weekly schedule (${startDate} to ${endDate})`,
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
        description: 'Vacation / Blocked',
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
        description: 'Not scheduled',
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
          description: 'Regular day off',
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

            // 3. Check collision with active scheduled group sessions on this day
            if (!collidesWithAppt) {
              for (const gs of groupSessions) {
                if (gs.date === dateStr && gs.status === 'scheduled') {
                  const gsStart = timeToMinutes(gs.startTime);
                  const gsEnd = endTimeToMinutes(gs.endTime);
                  const directOverlap = Math.max(slotStart, gsStart) < Math.min(slotEnd, gsEnd);
                  const preBufferViolation = buffer > 0 && slotEnd > (gsStart - buffer) && slotStart < gsStart;
                  const postBufferViolation = buffer > 0 && slotStart < (gsEnd + buffer) && slotEnd > gsEnd;

                  if (directOverlap || preBufferViolation || postBufferViolation) {
                    collidesWithAppt = true;
                    break;
                  }
                }
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
    [appointments, groupSessions, settings]
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
    let creditsToDeduct = 0;
    if (clientPackageId) {
      usedPackage = clientPackages.find(
        (cp) => cp.id === clientPackageId && cp.clientId === clientId
      );
      if (!usedPackage) {
        return { success: false, message: 'Selected package was not found.' };
      }
      creditsToDeduct = calculatePackageCreditsForDuration(service.durationMinutes, usedPackage);
      if (usedPackage.remainingSessions <= 0 || usedPackage.remainingSessions + 0.0001 < creditsToDeduct) {
        return {
          success: false,
          message: `Selected package has insufficient remaining sessions (${usedPackage.remainingSessions} left, ${creditsToDeduct} needed).`,
        };
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
      packageSessionsDeducted: usedPackage ? creditsToDeduct : undefined,
    };

    setAppointments((prev) => [newAppt, ...prev]);

    // If a package was used, decrement remainingSessions proportionally based on session duration
    if (usedPackage && creditsToDeduct > 0) {
      const remainingAfterDeduction = Math.max(
        0,
        Math.round((usedPackage.remainingSessions - creditsToDeduct) * 100) / 100
      );
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

    // If appointment was booked via a package, restore the exact number of deducted sessions!
    if (appt.packageId) {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (cp.id === appt.packageId) {
            const creditsToRestore =
              appt.packageSessionsDeducted ??
              calculatePackageCreditsForDuration(appt.durationMinutes, cp);
            const updatedRemaining = Math.round((cp.remainingSessions + creditsToRestore) * 100) / 100;
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
    const existingAppt = appointments.find((a) => a.id === appointmentId);
    if (existingAppt && existingAppt.packageId && existingAppt.status !== 'cancelled') {
      const nextServiceId = updates.serviceId ?? existingAppt.serviceId;
      const service = settings.services.find((s) => s.id === nextServiceId);
      const nextDuration =
        updates.durationMinutes ?? (service ? service.durationMinutes : existingAppt.durationMinutes);
      if (nextDuration !== existingAppt.durationMinutes) {
        const linkedCp = clientPackages.find((cp) => cp.id === existingAppt.packageId);
        if (linkedCp) {
          const oldCredits =
            existingAppt.packageSessionsDeducted ??
            calculatePackageCreditsForDuration(existingAppt.durationMinutes, linkedCp);
          const newCredits = calculatePackageCreditsForDuration(nextDuration, linkedCp);
          const diff = oldCredits - newCredits;
          if (diff !== 0) {
            setClientPackages((prev) =>
              prev.map((cp) => {
                if (cp.id === linkedCp.id) {
                  const updatedRemaining = Math.max(
                    0,
                    Math.round((cp.remainingSessions + diff) * 100) / 100
                  );
                  return {
                    ...cp,
                    remainingSessions: updatedRemaining,
                    status: updatedRemaining > 0 ? 'active' : 'exhausted',
                  };
                }
                return cp;
              })
            );
          }
          updates.packageSessionsDeducted = newCredits;
        }
      }
    }

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
            const creditsToRestore =
              appt.packageSessionsDeducted ??
              calculatePackageCreditsForDuration(appt.durationMinutes, cp);
            const updatedRemaining = Math.round((cp.remainingSessions + creditsToRestore) * 100) / 100;
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
      deleteDoc(doc(db, 'users', uid, 'appointments', appointmentId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}/appointments/${appointmentId}`)
      );
      deleteDoc(doc(db, 'trainers', uid, 'appointments', appointmentId)).catch(() => {});
    }
  };

  // Group Sessions Management & Booking
  const addGroupSession = (
    data: Omit<GroupSession, 'id' | 'createdAt' | 'participants'> & {
      participants?: GroupSessionParticipant[];
    }
  ): GroupSession => {
    const newGs: GroupSession = {
      ...data,
      id: `grp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: data.status || 'scheduled',
      participants: data.participants || [],
      createdAt: formatDateISO(new Date()),
    };

    // If pre-assigned participants, create corresponding appointments
    if (newGs.participants && newGs.participants.length > 0) {
      const newAppts: Appointment[] = newGs.participants
        .filter((p) => p.status === 'confirmed')
        .map((p) => ({
          id: `apt-grp-${Date.now()}-${p.clientId}`,
          clientId: p.clientId,
          serviceId: newGs.serviceId || 'grp-service',
          date: newGs.date,
          startTime: newGs.startTime,
          endTime: newGs.endTime,
          durationMinutes: newGs.durationMinutes,
          price: p.price ?? newGs.price,
          status: 'reserved',
          createdAt: formatDateISO(new Date()),
          isGroupSession: true,
          groupSessionId: newGs.id,
          groupSessionTitle: newGs.title,
          maxParticipants: newGs.maxParticipants,
          packageId: p.packageId,
          packageName: p.packageName,
        }));

      if (newAppts.length > 0) {
        setAppointments((prev) => [...newAppts, ...prev]);
      }
    }

    setGroupSessions((prev) => [newGs, ...prev]);
    return newGs;
  };

  const updateGroupSession = (id: string, updates: Partial<GroupSession>) => {
    setGroupSessions((prev) =>
      prev.map((gs) => {
        if (gs.id !== id) return gs;
        const updated = { ...gs, ...updates };

        // Synchronize linked appointments
        if (
          updates.date ||
          updates.startTime ||
          updates.endTime ||
          updates.title ||
          updates.maxParticipants !== undefined ||
          updates.durationMinutes !== undefined
        ) {
          setAppointments((prevAppts) =>
            prevAppts.map((a) => {
              if (a.groupSessionId === id) {
                return {
                  ...a,
                  date: updates.date || a.date,
                  startTime: updates.startTime || a.startTime,
                  endTime: updates.endTime || a.endTime,
                  groupSessionTitle: updates.title || a.groupSessionTitle,
                  maxParticipants: updates.maxParticipants ?? a.maxParticipants,
                  durationMinutes: updates.durationMinutes ?? a.durationMinutes,
                };
              }
              return a;
            })
          );
        }
        return updated;
      })
    );
  };

  const deleteGroupSession = (id: string) => {
    // Refund any package sessions if booked via package
    const linkedAppts = appointments.filter((a) => a.groupSessionId === id && a.status === 'reserved');
    linkedAppts.forEach((a) => {
      if (a.packageId) {
        setClientPackages((prev) =>
          prev.map((cp) => {
            if (cp.id === a.packageId) {
              const restored =
                Math.round((cp.remainingSessions + (a.packageSessionsDeducted ?? 1)) * 100) / 100;
              return {
                ...cp,
                remainingSessions: restored,
                status: restored > 0 ? 'active' : cp.status,
              };
            }
            return cp;
          })
        );
      }
    });

    setAppointments((prev) =>
      prev.map((a) =>
        a.groupSessionId === id
          ? {
              ...a,
              status: 'cancelled' as AppointmentStatus,
              cancelledAt: new Date().toISOString(),
              cancellationReason: 'Group session cancelled by trainer',
            }
          : a
      )
    );

    setGroupSessions((prev) => prev.filter((gs) => gs.id !== id));
  };

  const bookGroupSessionSpot = (
    groupSessionId: string,
    clientId: string,
    clientPackageId?: string
  ): { success: boolean; message: string; appointment?: Appointment } => {
    const gs = groupSessions.find((g) => g.id === groupSessionId);
    if (!gs) {
      return {
        success: false,
        message: 'Group session not found.',
      };
    }

    if (gs.status !== 'scheduled') {
      return {
        success: false,
        message: 'This group session is no longer active.',
      };
    }

    const confirmed = (gs.participants || []).filter((p) => p.status === 'confirmed');

    // Check capacity
    if (confirmed.length >= gs.maxParticipants) {
      return {
        success: false,
        message: `This group session is fully booked (maximum ${gs.maxParticipants} participants reached).`,
      };
    }

    // Check duplicate
    if (confirmed.some((p) => p.clientId === clientId)) {
      return {
        success: false,
        message: 'You are already registered for this group session.',
      };
    }

    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      return {
        success: false,
        message: 'Client not found.',
      };
    }

    let usedPackage: ClientPackage | undefined = undefined;
    if (clientPackageId) {
      usedPackage = clientPackages.find((cp) => cp.id === clientPackageId && cp.clientId === clientId);
      if (!usedPackage) {
        return {
          success: false,
          message: 'Selected package was not found.',
        };
      }
      if (usedPackage.remainingSessions < 1) {
        return {
          success: false,
          message: 'Insufficient sessions remaining on this package.',
        };
      }
      if (usedPackage.expiresAt && usedPackage.expiresAt < gs.date) {
        return {
          success: false,
          message: 'Selected package has expired.',
        };
      }
    }

    const apptId = `apt-grp-${Date.now()}-${clientId}`;
    const price = usedPackage ? 0 : gs.price;

    const newParticipant: GroupSessionParticipant = {
      clientId,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      bookedAt: new Date().toISOString(),
      appointmentId: apptId,
      packageId: usedPackage?.id,
      packageName: usedPackage?.packageName,
      price,
      status: 'confirmed',
    };

    const newAppt: Appointment = {
      id: apptId,
      clientId,
      serviceId: gs.serviceId || 'grp-service',
      date: gs.date,
      startTime: gs.startTime,
      endTime: gs.endTime,
      durationMinutes: gs.durationMinutes,
      price,
      status: 'reserved',
      createdAt: formatDateISO(new Date()),
      isGroupSession: true,
      groupSessionId: gs.id,
      groupSessionTitle: gs.title,
      maxParticipants: gs.maxParticipants,
      packageId: usedPackage?.id,
      packageName: usedPackage?.packageName,
      packageSessionsDeducted: usedPackage ? 1 : undefined,
    };

    // Deduct package credit if used
    if (usedPackage) {
      const remainingAfter = Math.max(0, Math.round((usedPackage.remainingSessions - 1) * 100) / 100);
      setClientPackages((prev) =>
        prev.map((cp) =>
          cp.id === usedPackage!.id
            ? {
                ...cp,
                remainingSessions: remainingAfter,
                status: remainingAfter === 0 ? 'exhausted' : cp.status,
              }
            : cp
        )
      );
    }

    setAppointments((prev) => [newAppt, ...prev]);

    setGroupSessions((prev) =>
      prev.map((g) => {
        if (g.id !== groupSessionId) return g;
        const filtered = (g.participants || []).filter((p) => p.clientId !== clientId);
        return {
          ...g,
          participants: [...filtered, newParticipant],
        };
      })
    );

    const remainingSpots = Math.max(0, gs.maxParticipants - (confirmed.length + 1));

    return {
      success: true,
      message: `Your spot for "${gs.title}" has been reserved! (${remainingSpots} ${remainingSpots === 1 ? 'spot' : 'spots'} left)`,
      appointment: newAppt,
    };
  };

  const cancelGroupSessionSpot = (
    groupSessionId: string,
    clientId: string,
    reason?: string
  ): { success: boolean; message: string } => {
    const gs = groupSessions.find((g) => g.id === groupSessionId);
    if (!gs) {
      return {
        success: false,
        message: 'Group session not found.',
      };
    }

    const participant = (gs.participants || []).find(
      (p) => p.clientId === clientId && p.status === 'confirmed'
    );
    if (!participant) {
      return {
        success: false,
        message: 'No active registration found.',
      };
    }

    // Check cancellation cutoff
    const check = isCancellationAllowed(
      gs.date,
      gs.startTime,
      settings.cancellationPolicyHours,
      settings.allowUnrestrictedCancellation
    );

    if (!check.allowed) {
      return {
        success: false,
        message: `Cancellation cutoff expired (${settings.cancellationPolicyHours} hours policy). Please contact ${settings.name}.`,
      };
    }

    // Restore package credit if used
    if (participant.packageId) {
      setClientPackages((prev) =>
        prev.map((cp) => {
          if (cp.id === participant.packageId) {
            const restored = Math.round((cp.remainingSessions + 1) * 100) / 100;
            return {
              ...cp,
              remainingSessions: restored,
              status: restored > 0 ? 'active' : cp.status,
            };
          }
          return cp;
        })
      );
    }

    // Cancel appointment
    setAppointments((prev) =>
      prev.map((a) =>
        a.groupSessionId === groupSessionId && a.clientId === clientId
          ? {
              ...a,
              status: 'cancelled' as AppointmentStatus,
              cancelledAt: new Date().toISOString(),
              cancellationReason: reason || 'Cancelled group session registration',
            }
          : a
      )
    );

    // Update group session participant record
    setGroupSessions((prev) =>
      prev.map((g) => {
        if (g.id !== groupSessionId) return g;
        return {
          ...g,
          participants: (g.participants || []).map((p) =>
            p.clientId === clientId ? { ...p, status: 'cancelled' as const } : p
          ),
        };
      })
    );

    return {
      success: true,
      message: 'Registration cancelled. The spot has been freed up.',
    };
  };

  const isClientInGroupSession = (groupSessionId: string, clientId: string): boolean => {
    const gs = groupSessions.find((g) => g.id === groupSessionId);
    if (!gs || !gs.participants) return false;
    return gs.participants.some((p) => p.clientId === clientId && p.status === 'confirmed');
  };

  const getGroupSessionSpotsLeft = (groupSessionId: string): number => {
    const gs = groupSessions.find((g) => g.id === groupSessionId);
    if (!gs) return 0;
    const confirmedCount = (gs.participants || []).filter((p) => p.status === 'confirmed').length;
    return Math.max(0, gs.maxParticipants - confirmedCount);
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

          const hasCustomRate = client?.customHourlyRate !== undefined && client?.customHourlyRate > 0;
          const isVatInclusive = hasCustomRate
            ? client?.customHourlyRateIncludesVat ?? (settings.ratesIncludeVat ?? true)
            : settings.ratesIncludeVat ?? true;

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
            isVatInclusive,
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
          isVatInclusive: settings.ratesIncludeVat ?? true,
          status: cp.billingStatus || 'to_invoice',
          invoicedAt: cp.invoicedAt,
          paidAt: cp.paidAt,
          invoiceNumber: cp.invoiceNumber,
        });
      });

      return items.sort((a, b) => b.date.localeCompare(a.date));
    },
    [appointments, clientPackages, clients, settings.services, settings.ratesIncludeVat]
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
      const fullName = clientObj?.name || 'Client';
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
      deleteDoc(doc(db, 'users', uid, 'messages', messageId)).catch((err) =>
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}/messages/${messageId}`)
      );
      deleteDoc(doc(db, 'trainers', uid, 'messages', messageId)).catch(() => {});
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
    setInvoiceSettings((prev) => {
      const next = { ...prev, ...updates };
      const hasTaxId = Boolean(next.taxId && next.taxId.trim().length > 0);
      if (!hasTaxId) {
        next.defaultVatRate = 0;
        next.isVatExempt = true;
      }
      if (
        updates.businessName !== undefined ||
        updates.email !== undefined ||
        updates.phone !== undefined ||
        updates.address !== undefined ||
        updates.postalCode !== undefined ||
        updates.city !== undefined ||
        updates.chamberOfCommerce !== undefined ||
        updates.taxId !== undefined ||
        updates.iban !== undefined
      ) {
        setInvoices((prevInvs) =>
          prevInvs.map((inv) => ({
            ...inv,
            senderBusinessName: next.businessName || inv.senderBusinessName,
            senderEmail: next.email || inv.senderEmail,
            senderPhone: next.phone || inv.senderPhone,
            senderAddress: next.address || inv.senderAddress,
            senderPostalCode: next.postalCode || inv.senderPostalCode,
            senderCity: next.city || inv.senderCity,
            senderCountry: next.country || inv.senderCountry,
            senderChamberOfCommerce: next.chamberOfCommerce ?? '',
            senderTaxId: next.taxId ?? '',
            senderIban: next.iban ?? inv.senderIban,
            senderBic: next.bic ?? inv.senderBic,
            senderBankName: next.bankName ?? inv.senderBankName,
            senderWebsite: next.website ?? inv.senderWebsite,
          }))
        );
      }
      return next;
    });
  };

  const getNextInvoiceNumber = (): string => {
    return formatInvoiceNumber(
      invoiceSettings.numberPrefix,
      invoiceSettings.numberPadding,
      invoiceSettings.nextSequenceNumber,
      new Date()
    );
  };

  const getNextCreditNoteNumber = (): string => {
    return formatInvoiceNumber(
      invoiceSettings.creditNotePrefix || 'CN-{YYYY}-',
      invoiceSettings.numberPadding || 4,
      invoiceSettings.nextCreditNoteSequenceNumber || 1,
      new Date()
    );
  };

  const createCreditNote = (originalInvoiceId: string): Invoice | null => {
    const originalInvoice = invoices.find((inv) => inv.id === originalInvoiceId);
    if (!originalInvoice || originalInvoice.isCreditNote) return null;

    const existingCn = invoices.find(
      (inv) =>
        inv.isCreditNote &&
        (inv.originalInvoiceId === originalInvoice.id ||
          inv.originalInvoiceNumber === originalInvoice.invoiceNumber)
    );
    if (existingCn) return existingCn;

    const todayStr = formatDateISO(new Date());
    const creditNoteNumber = getNextCreditNoteNumber();
    const wasAlreadyPaid = originalInvoice.status === 'paid';

    // If the original invoice was not yet paid, both original invoice and credit note become settled (paid).
    // If the original invoice was already paid, the credit note must still be paid (status: 'sent').
    const creditNoteStatus: InvoiceStatus = wasAlreadyPaid ? 'sent' : 'paid';
    const creditNotePaidAt = wasAlreadyPaid ? undefined : todayStr;

    const creditItems: InvoiceLineItem[] = (originalInvoice.items || []).map((item, idx) => ({
      ...item,
      id: `cn-line-${Date.now()}-${idx}`,
      unitPrice: -Math.abs(Number(item.unitPrice) || 0),
      baseAmount:
        item.baseAmount !== undefined ? -Math.abs(Number(item.baseAmount) || 0) : undefined,
      vatAmount: -Math.abs(Number(item.vatAmount) || 0),
      total: -Math.abs(Number(item.total) || 0),
    }));

    const newCreditNote: Invoice = {
      ...originalInvoice,
      id: `cn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber: creditNoteNumber,
      isCreditNote: true,
      originalInvoiceId: originalInvoice.id,
      originalInvoiceNumber: originalInvoice.invoiceNumber,
      creditNoteId: undefined,
      creditNoteNumber: undefined,
      issueDate: todayStr,
      dueDate: todayStr,
      status: creditNoteStatus,
      paidAt: creditNotePaidAt,
      items: creditItems,
      subtotal: -Math.abs(Number(originalInvoice.subtotal) || 0),
      totalVat: -Math.abs(Number(originalInvoice.totalVat) || 0),
      totalAmount: -Math.abs(Number(originalInvoice.totalAmount) || 0),
      notes: `Credit note reversing invoice ${originalInvoice.invoiceNumber} in full.`,
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [
      newCreditNote,
      ...prev.map((inv) => {
        if (inv.id === originalInvoice.id) {
          return {
            ...inv,
            creditNoteId: newCreditNote.id,
            creditNoteNumber: creditNoteNumber,
            status: 'paid' as InvoiceStatus,
            paidAt: inv.paidAt || todayStr,
          };
        }
        return inv;
      }),
    ]);

    setInvoiceSettings((prev) => ({
      ...prev,
      nextCreditNoteSequenceNumber: (prev.nextCreditNoteSequenceNumber || 1) + 1,
    }));

    if (!wasAlreadyPaid && originalInvoice.items && originalInvoice.items.length > 0) {
      const apptSourceIds = new Set(
        originalInvoice.items
          .filter((i) => i.sourceType === 'appointment' && i.sourceId)
          .map((i) => i.sourceId!)
      );
      const pkgSourceIds = new Set(
        originalInvoice.items
          .filter((i) => i.sourceType === 'package' && i.sourceId)
          .map((i) => i.sourceId!)
      );

      if (apptSourceIds.size > 0) {
        setAppointments((prev) =>
          prev.map((a) =>
            apptSourceIds.has(a.id) ? { ...a, billingStatus: 'paid', paidAt: todayStr } : a
          )
        );
      }

      if (pkgSourceIds.size > 0) {
        setClientPackages((prev) =>
          prev.map((cp) =>
            pkgSourceIds.has(cp.id) ? { ...cp, billingStatus: 'paid', paidAt: todayStr } : cp
          )
        );
      }
    }

    return newCreditNote;
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
    const restoredSettings: ProviderSettings = {
      ...initialSettings,
      name: settings.name,
      profession: settings.profession,
      email: settings.email,
      phone: settings.phone,
      standardHourlyRate: settings.standardHourlyRate,
      currency: settings.currency,
      availabilityMode: 'adhoc',
    };
    const restoredInvoiceSettings: InvoiceSettings = {
      ...initialInvoiceSettings,
      businessName: invoiceSettings.businessName || `${settings.name} Coaching`,
      email: settings.email,
      phone: settings.phone,
    };

    const prefixes = [userStoragePrefix, LOCAL_STORAGE_KEY];
    prefixes.forEach((prefix) => {
      localStorage.setItem(`${prefix}_settings`, JSON.stringify(restoredSettings));
      localStorage.setItem(`${prefix}_clients`, JSON.stringify(initialClients));
      localStorage.setItem(`${prefix}_appointments`, JSON.stringify(initialAppointments));
      localStorage.setItem(`${prefix}_packages`, JSON.stringify(initialPackages));
      localStorage.setItem(`${prefix}_clientPackages`, JSON.stringify(initialClientPackages));
      localStorage.setItem(`${prefix}_messages`, JSON.stringify(initialMessages));
      localStorage.setItem(`${prefix}_invoiceSettings`, JSON.stringify(restoredInvoiceSettings));
      localStorage.setItem(`${prefix}_invoices`, JSON.stringify(initialInvoices));
      localStorage.setItem(`${prefix}_groupSessions`, JSON.stringify(initialGroupSessions));
    });

    prevSubcollectionsRef.current = {};
    setSettings(restoredSettings);
    setClients(initialClients);
    setAppointments(initialAppointments);
    setPackages(initialPackages);
    setClientPackages(initialClientPackages);
    setMessages(initialMessages);
    setInvoiceSettings(restoredInvoiceSettings);
    setInvoices(initialInvoices);
    setGroupSessions(initialGroupSessions);
    setSelectedChatClientId('cli-1');
    setRole('provider');
    setActiveClientId('cli-1');
  };

  const clearDemoData = async (): Promise<void> => {
    const cleanSettings: ProviderSettings = {
      ...settings,
      adHocSchedule: [],
      exceptions: [],
      services: [],
      availabilityMode: 'adhoc',
    };

    const cleanInvoiceSettings: InvoiceSettings = {
      ...invoiceSettings,
      nextSequenceNumber: 1,
      nextCreditNoteSequenceNumber: 1,
    };

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

    const prefixes = [userStoragePrefix, LOCAL_STORAGE_KEY];
    prefixes.forEach((prefix) => {
      localStorage.setItem(`${prefix}_settings`, JSON.stringify(cleanSettings));
      localStorage.setItem(`${prefix}_clients`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_appointments`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_packages`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_clientPackages`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_messages`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_invoiceSettings`, JSON.stringify(cleanInvoiceSettings));
      localStorage.setItem(`${prefix}_invoices`, JSON.stringify([]));
      localStorage.setItem(`${prefix}_groupSessions`, JSON.stringify([]));
    });

    prevSubcollectionsRef.current = {};
    setSettings(cleanSettings);
    setClients([]);
    setAppointments([]);
    setPackages([]);
    setClientPackages([]);
    setMessages([]);
    setInvoiceSettings(cleanInvoiceSettings);
    setInvoices([]);
    setGroupSessions([]);
    setSelectedChatClientId('');
    setActiveClientId('');
    setRole('provider');

    const uid = auth.currentUser?.uid;
    if (!uid) return;

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

    try {
      await Promise.all(
        collectionNames.map(async (colName) => {
          const deletePromises: Promise<unknown>[] = [];
          try {
            const userSubSnap = await getDocs(collection(db, 'users', uid, colName));
            userSubSnap.forEach((docSnap) => {
              deletePromises.push(deleteDoc(docSnap.ref).catch(() => {}));
            });
          } catch {
            // fallback to known items
          }

          try {
            const subSnap = await getDocs(collection(db, 'trainers', uid, colName));
            subSnap.forEach((docSnap) => {
              deletePromises.push(deleteDoc(docSnap.ref).catch(() => {}));
            });
          } catch {
            // fallback to known items
          }

          const knownItems = knownItemsByCollection[colName] || [];
          for (const item of knownItems) {
            if (item?.id) {
              deletePromises.push(
                deleteDoc(doc(db, 'users', uid, colName, item.id)).catch(() => {}),
                deleteDoc(doc(db, 'trainers', uid, colName, item.id)).catch(() => {})
              );
            }
          }

          if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
          }
        })
      );

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
            // ignore
          }
        })
      );

      const cleanPayload = {
        uid,
        name: cleanSettings.name,
        profession: cleanSettings.profession,
        email: cleanSettings.email,
        phone: cleanSettings.phone,
        standardHourlyRate: cleanSettings.standardHourlyRate,
        settings: cleanSettings,
        invoiceSettings: cleanInvoiceSettings,
        clients: [],
        appointments: [],
        packages: [],
        clientPackages: [],
        messages: [],
        invoices: [],
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', uid), cleanPayload, { merge: true });
      setDoc(doc(db, 'trainers', uid), cleanPayload, { merge: true }).catch(() => {});
    } catch (err) {
      formatFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  };

  const exportAllData = (): ProBookingBackupData => {
    return {
      version: 1,
      app: 'ProBooking',
      exportedAt: new Date().toISOString(),
      language,
      data: {
        settings: JSON.parse(JSON.stringify(settings)),
        invoiceSettings: JSON.parse(JSON.stringify(invoiceSettings)),
        clients: JSON.parse(JSON.stringify(clients)),
        appointments: JSON.parse(JSON.stringify(appointments)),
        packages: JSON.parse(JSON.stringify(packages)),
        clientPackages: JSON.parse(JSON.stringify(clientPackages)),
        groupSessions: JSON.parse(JSON.stringify(groupSessions)),
        invoices: JSON.parse(JSON.stringify(invoices)),
        messages: JSON.parse(JSON.stringify(messages)),
      },
    };
  };

  const importAllData = (
    backupInput: ProBookingBackupData | string,
    mode: 'replace' | 'merge' = 'replace'
  ): {
    success: boolean;
    message: string;
    stats?: {
      clientsCount: number;
      appointmentsCount: number;
      invoicesCount: number;
      packagesCount: number;
      groupSessionsCount: number;
    };
  } => {
    try {
      let parsed: any;
      if (typeof backupInput === 'string') {
        parsed = JSON.parse(backupInput);
      } else {
        parsed = backupInput;
      }

      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          message: 'Invalid backup file (not a valid JSON object).',
        };
      }

      // Handle structured { version: 1, data: { ... } } or direct payload
      const backupData = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

      const incomingSettings = backupData.settings;
      const incomingInvoiceSettings = backupData.invoiceSettings;
      const incomingClients: Client[] = Array.isArray(backupData.clients) ? backupData.clients : [];
      const incomingAppointments: Appointment[] = Array.isArray(backupData.appointments)
        ? backupData.appointments
        : [];
      const incomingPackages: ServicePackage[] = Array.isArray(backupData.packages)
        ? backupData.packages
        : [];
      const incomingClientPackages: ClientPackage[] = Array.isArray(backupData.clientPackages)
        ? backupData.clientPackages
        : [];
      const incomingGroupSessions: GroupSession[] = Array.isArray(backupData.groupSessions)
        ? backupData.groupSessions
        : [];
      const incomingInvoices: Invoice[] = Array.isArray(backupData.invoices)
        ? backupData.invoices
        : [];
      const incomingMessages: ChatMessage[] = Array.isArray(backupData.messages)
        ? backupData.messages
        : [];

      let finalSettings: ProviderSettings;
      let finalInvoiceSettings: InvoiceSettings;
      let finalClients: Client[];
      let finalAppointments: Appointment[];
      let finalPackages: ServicePackage[];
      let finalClientPackages: ClientPackage[];
      let finalGroupSessions: GroupSession[];
      let finalInvoices: Invoice[];
      let finalMessages: ChatMessage[];

      if (mode === 'replace') {
        finalSettings =
          incomingSettings && typeof incomingSettings === 'object'
            ? { ...initialSettings, ...incomingSettings }
            : settings;

        finalInvoiceSettings =
          incomingInvoiceSettings && typeof incomingInvoiceSettings === 'object'
            ? { ...initialInvoiceSettings, ...incomingInvoiceSettings }
            : invoiceSettings;

        finalClients = incomingClients;
        finalAppointments = incomingAppointments;
        finalPackages = incomingPackages;
        finalClientPackages = incomingClientPackages;
        finalGroupSessions = incomingGroupSessions;
        finalInvoices = incomingInvoices;
        finalMessages = incomingMessages;
      } else {
        // Merge mode
        finalSettings =
          incomingSettings && typeof incomingSettings === 'object'
            ? { ...settings, ...incomingSettings }
            : settings;

        finalInvoiceSettings =
          incomingInvoiceSettings && typeof incomingInvoiceSettings === 'object'
            ? { ...invoiceSettings, ...incomingInvoiceSettings }
            : invoiceSettings;

        const mergeById = <T extends { id: string }>(currentList: T[], newList: T[]): T[] => {
          const map = new Map<string, T>();
          for (const item of currentList) {
            if (item?.id) map.set(item.id, item);
          }
          for (const item of newList) {
            if (item?.id) map.set(item.id, item);
          }
          return Array.from(map.values());
        };

        finalClients = mergeById(clients, incomingClients);
        finalAppointments = mergeById(appointments, incomingAppointments);
        finalPackages = mergeById(packages, incomingPackages);
        finalClientPackages = mergeById(clientPackages, incomingClientPackages);
        finalGroupSessions = mergeById(groupSessions, incomingGroupSessions);
        finalInvoices = mergeById(invoices, incomingInvoices);
        finalMessages = mergeById(messages, incomingMessages);
      }

      // Persist to local storage prefixes
      const prefixes = [userStoragePrefix, LOCAL_STORAGE_KEY];
      prefixes.forEach((prefix) => {
        localStorage.setItem(`${prefix}_settings`, JSON.stringify(finalSettings));
        localStorage.setItem(`${prefix}_invoiceSettings`, JSON.stringify(finalInvoiceSettings));
        localStorage.setItem(`${prefix}_clients`, JSON.stringify(finalClients));
        localStorage.setItem(`${prefix}_appointments`, JSON.stringify(finalAppointments));
        localStorage.setItem(`${prefix}_packages`, JSON.stringify(finalPackages));
        localStorage.setItem(`${prefix}_clientPackages`, JSON.stringify(finalClientPackages));
        localStorage.setItem(`${prefix}_groupSessions`, JSON.stringify(finalGroupSessions));
        localStorage.setItem(`${prefix}_invoices`, JSON.stringify(finalInvoices));
        localStorage.setItem(`${prefix}_messages`, JSON.stringify(finalMessages));
      });

      localStorage.setItem('probooking_language', 'en');

      // Atomically update React states
      prevSubcollectionsRef.current = {};
      setSettings(finalSettings);
      setInvoiceSettings(finalInvoiceSettings);
      setClients(finalClients);
      setAppointments(finalAppointments);
      setPackages(finalPackages);
      setClientPackages(finalClientPackages);
      setGroupSessions(finalGroupSessions);
      setInvoices(finalInvoices);
      setMessages(finalMessages);

      if (
        finalClients.length > 0 &&
        (!activeClientId || !finalClients.some((c) => c.id === activeClientId))
      ) {
        setActiveClientId(finalClients[0].id);
        setSelectedChatClientId(finalClients[0].id);
      }

      setSyncTrigger((prev) => prev + 1);

      return {
        success: true,
        message: `Data successfully ${mode === 'replace' ? 'restored (replaced)' : 'merged'}!`,
        stats: {
          clientsCount: finalClients.length,
          appointmentsCount: finalAppointments.length,
          invoicesCount: finalInvoices.length,
          packagesCount: finalPackages.length,
          groupSessionsCount: finalGroupSessions.length,
        },
      };
    } catch (err: any) {
      console.error('Import error:', err);
      return {
        success: false,
        message: err?.message || 'An error occurred while importing data.',
      };
    }
  };

  const deleteTrainerAccount = async (reauthOptions?: {
    password?: string;
    provider?: 'google' | 'apple';
  }): Promise<void> => {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user found.');
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
      // 3. Delete all subcollection documents under users/{uid}/{subcollection} and trainers/{uid}/{subcollection}
      await Promise.all(
        collectionNames.map(async (colName) => {
          const deletePromises: Promise<unknown>[] = [];

          try {
            const userSubSnap = await getDocs(collection(db, 'users', uid, colName));
            userSubSnap.forEach((docSnap) => {
              deletePromises.push(deleteDoc(docSnap.ref).catch(() => {}));
            });
          } catch {
            // Fallback to known state item IDs if listing subcollection fails
          }

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
                deleteDoc(doc(db, 'users', uid, colName, item.id)).catch(() => {}),
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

      // 5. Delete the root trainer document users/{uid} and trainers/{uid}
      try {
        await deleteDoc(doc(db, 'users', uid));
        await deleteDoc(doc(db, 'trainers', uid)).catch(() => {});
      } catch (err) {
        formatFirestoreError(err, OperationType.DELETE, `users/${uid}`);
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
        createCreditNote,
        updateInvoice,
        markInvoicePaid,
        deleteInvoice,
        getNextInvoiceNumber,
        getNextCreditNoteNumber,
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
        getPackageStandardDuration,
        calculatePackageCreditsForDuration,
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
        groupSessions,
        addGroupSession,
        updateGroupSession,
        deleteGroupSession,
        bookGroupSessionSpot,
        cancelGroupSessionSpot,
        isClientInGroupSession,
        getGroupSessionSpotsLeft,
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
        clearDemoData,
        exportAllData,
        importAllData,
        currentClient,
        magicLinkNotification,
        dismissMagicLinkNotification,
        simulateMagicLink,
        isTrainerPreview,
        exitTrainerPreview,
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
