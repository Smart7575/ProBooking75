import React, { useState } from 'react';
import { useBooking } from '../context/BookingContext';
import {
  Calendar,
  User,
  Users,
  RotateCcw,
  Globe,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Check,
  LayoutDashboard,
  Clock,
  BarChart3,
  Sliders,
  Package,
  Coins,
  MessageSquare,
  Receipt,
  LogOut,
  Database,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const {
    role,
    setRole,
    activeClientId,
    setActiveClientId,
    activeClients,
    clients,
    currentClient,
    settings,
    language,
    setLanguage,
    currency,
    setCurrency,
    currencySymbol,
    t,
    getUnreadCountForProvider,
    getUnreadCountForClient,
    resetDemoData,
    unbilledItemsCount,
    firebaseSyncStatus,
    firebaseSyncError,
    forceSyncToFirebase,
  } = useBooking();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showManageDropdown, setShowManageDropdown] = useState(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const firestoreRulesSnippet = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trainers/{trainerId} {
      allow read, write: if request.auth != null && request.auth.uid == trainerId;
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == trainerId;
      }
    }
    match /{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesSnippet);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const providerUnread = getUnreadCountForProvider();

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }

  const primaryNavItems: NavItem[] = [
    { id: 'dashboard', label: t.tabDashboard, icon: LayoutDashboard },
    { id: 'calendar', label: t.tabCalendar, icon: Calendar },
    { id: 'clients', label: t.tabClients, icon: Users },
    { id: 'billing', label: t.tabBilling, icon: Receipt, badge: unbilledItemsCount > 0 ? unbilledItemsCount : undefined },
  ];

  const manageNavItems: NavItem[] = [
    { id: 'chat', label: t.tabChat, icon: MessageSquare, badge: providerUnread },
    { id: 'packages', label: t.tabPackages, icon: Package },
    { id: 'availability', label: t.tabAvailability, icon: Clock },
    { id: 'reports', label: t.tabReports, icon: BarChart3 },
  ];

  const allNavItems = [...primaryNavItems, ...manageNavItems];
  const isManageActive = manageNavItems.some((item) => item.id === currentTab);
  const activeManageItem = manageNavItems.find((item) => item.id === currentTab);

  return (
    <>
      {/* Top Header for Mobile & Client Mode */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900 text-slate-100 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8 h-16 gap-2">
          {/* Logo & Brand with Geometric Balance Emerald Badge */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-lg italic shadow-md shadow-emerald-500/20 shrink-0">
              PB
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
                  {t.appTitle}
                </span>
                <span className="hidden sm:inline-block rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  {role === 'provider' ? 'Provider' : 'Client'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation for Provider in Top bar */}
          {role === 'provider' && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 shrink-0">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentTab(item.id);
                      setShowManageDropdown(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition relative whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`rounded-full font-bold px-1.5 py-0.2 text-[10px] ${
                          isActive
                            ? 'bg-white text-emerald-950 shadow-xs'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Management Dropdown for secondary tabs (Chat, Packages, Availability, Reports) */}
              <div className="relative">
                <button
                  onClick={() => setShowManageDropdown((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                    isManageActive
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`${t.tabManage}: ${manageNavItems.map((i) => i.label).join(', ')}`}
                >
                  <Sliders className="h-3.5 w-3.5 shrink-0" />
                  <span>{isManageActive && activeManageItem ? activeManageItem.label : t.tabManage}</span>
                  {providerUnread > 0 && !isManageActive && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                  <ChevronDown className={`h-3 w-3 transition-transform ml-0.5 ${showManageDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showManageDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowManageDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl z-50 text-xs text-slate-200">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {t.tabManage}
                      </div>
                      {manageNavItems.map((item) => {
                        const Icon = item.icon;
                        const isSubActive = currentTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setCurrentTab(item.id);
                              setShowManageDropdown(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 transition mt-0.5 ${
                              isSubActive
                                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-emerald-400" />
                              <span>{item.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="rounded-full bg-emerald-400 text-slate-950 font-bold px-1.5 py-0.2 text-[10px]">
                                  {item.badge}
                                </span>
                              )}
                              {isSubActive && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </nav>
          )}

          {/* Right Actions: Persona Switcher, Currency, Language, Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Interactive Persona / Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-xs hover:bg-slate-700 transition shrink-0"
              >
                {role === 'provider' ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                    <User className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="hidden lg:inline">Trainer ({settings.name.split(' ')[0]})</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <span className="hidden lg:inline">{currentClient?.name?.split(' ')[0] || 'Client'}</span>
                  </>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {showRoleDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowRoleDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-2.5 shadow-2xl z-50 text-xs text-slate-200">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Persona / Role
                    </div>

                  {/* Option 1: Provider */}
                  <button
                    onClick={() => {
                      setRole('provider');
                      setShowRoleDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 transition mt-1 ${
                      role === 'provider'
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">{settings.name} (Provider)</div>
                        <div className="text-[10px] text-slate-400">Full agenda, rates & CRM control</div>
                      </div>
                    </div>
                    {role === 'provider' && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </button>

                  {/* Quick link to Provider Settings & Account Deletion */}
                  <button
                    onClick={() => {
                      setRole('provider');
                      setCurrentTab('availability');
                      setShowRoleDropdown(false);
                      setTimeout(() => {
                        const el = document.getElementById('account-danger-zone');
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 transition mt-1 text-rose-300 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                        <Sliders className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-rose-200">
                          {language === 'nl' ? 'Instellingen & Account Verwijderen' : 'Settings & Delete Account'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {language === 'nl' ? 'Profiel, tarieven & account wissen' : 'Profile, rates & erase account'}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="my-2 border-t border-slate-800"></div>
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Test Client Portal (Magic Link)
                  </div>

                  <div className="space-y-1 mt-1">
                    {activeClients.map((client) => {
                      const isSelected = role === 'client' && activeClientId === client.id;
                      return (
                        <button
                          key={client.id}
                          onClick={() => {
                            setActiveClientId(client.id);
                            setRole('client');
                            setShowRoleDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 transition ${
                            isSelected
                              ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-left truncate">
                            <div className="text-white truncate font-medium">{client.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{client.email}</div>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            </div>

            {/* Currency Switcher (EUR, USD, CHF) */}
            <div className="relative">
              <button
                onClick={() => setShowCurrencyDropdown((v) => !v)}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-xs hover:bg-slate-700 hover:text-white transition"
                title="Valuta / Currency (EUR, USD, CHF)"
              >
                <Coins className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold">{currency}</span>
                <span className="text-[11px] text-emerald-400 font-mono">({currencySymbol})</span>
                <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
              </button>

              {showCurrencyDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCurrencyDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl z-50 text-xs text-slate-200">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {language === 'nl' ? 'Valuta Kiezen' : 'Select Currency'}
                    </div>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.code}
                        onClick={() => {
                          setCurrency(opt.code);
                          setShowCurrencyDropdown(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 transition mt-0.5 ${
                          currency === opt.code
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-mono font-bold text-emerald-400">{opt.symbol}</span>
                          <span>{language === 'nl' ? opt.labelNl : opt.labelEn}</span>
                        </div>
                        {currency === opt.code && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-xs hover:bg-slate-700 hover:text-white transition"
              title="Toggle Language (English default / Nederlands)"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-400" />
              <span className="uppercase">{language}</span>
            </button>

            {/* Firebase Cloud Sync Status Button */}
            <button
              type="button"
              onClick={() => {
                if (firebaseSyncStatus === 'error') {
                  setShowFirebaseModal(true);
                } else {
                  forceSyncToFirebase();
                }
              }}
              title={
                firebaseSyncStatus === 'error'
                  ? `Firebase (probooking75): ${firebaseSyncError || 'Firestore Rules vereist'}. Klik voor instructies & synchronisatie.`
                  : 'Gekoppeld aan Firebase Firestore (probooking75). Klik om direct te synchroniseren.'
              }
              className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                firebaseSyncStatus === 'synced'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : firebaseSyncStatus === 'connecting'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline font-mono text-[11px]">probooking75</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  firebaseSyncStatus === 'synced'
                    ? 'bg-emerald-400'
                    : firebaseSyncStatus === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
            </button>

            {/* Reset Demo Button */}
            <button
              onClick={() => setShowResetConfirm(true)}
              title={t.resetDemo}
              className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 shadow-xs hover:bg-rose-900/40 hover:text-rose-300 hover:border-rose-700 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Sign Out Button */}
            {auth.currentUser && (
              <button
                onClick={() => signOut(auth)}
                title={`Uitloggen (${auth.currentUser.email || ''})`}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 shadow-xs hover:bg-rose-900/50 hover:text-rose-200 hover:border-rose-700 transition cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-400" />
                <span className="hidden xl:inline">
                  {language === 'nl' ? 'Uitloggen' : 'Logout'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar for Provider */}
        {role === 'provider' && (
          <div className="flex md:hidden overflow-x-auto border-t border-slate-800 px-3 py-2 bg-slate-950 scrollbar-none gap-2">
            {allNavItems.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                  currentTab === tab.id
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="rounded-full bg-emerald-400 text-slate-950 font-bold px-1.5 py-0.2 text-[10px]">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Reset Confirmation Dialog with Geometric Balance Rounded-3xl */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-3">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Reset Demo Data?</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              This will restore the original demo appointments, availability schedule, and clients (including Linda de Vries and Mark Jansen).
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  resetDemoData();
                  setShowResetConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firebase Rules & Sync Modal */}
      {showFirebaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Firebase Cloud Sync (probooking75)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Alle gegevens zijn lokaal beveiligd opgeslagen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFirebaseModal(false)}
                className="rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 mb-4 text-xs text-amber-900 leading-relaxed">
              <strong>Let op:</strong> Je Firebase-project <code className="font-mono font-bold">probooking75</code> blokkeert momenteel nog schrijftoegang vanuit de browser (<em>Missing or insufficient permissions</em>). Plak onderstaande <strong>Firestore Rules</strong> eenmalig in je <strong>Firebase Console &rarr; Firestore Database &rarr; Rules</strong> en klik op <strong>Publish</strong>:
            </div>

            <div className="relative mb-4">
              <pre className="rounded-2xl bg-slate-900 text-emerald-300 p-3.5 text-[11px] font-mono overflow-x-auto leading-relaxed">
                {firestoreRulesSnippet}
              </pre>
              <button
                type="button"
                onClick={handleCopyRules}
                className="absolute top-2.5 right-2.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-600 transition cursor-pointer"
              >
                {copiedRules ? '✓ Gekopieerd!' : 'Kopieer Rules'}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Sluiten
              </button>
              <button
                type="button"
                onClick={() => {
                  forceSyncToFirebase();
                  setShowFirebaseModal(false);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
              >
                Opnieuw verbinden &amp; Synchroniseren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
