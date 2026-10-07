import React, { useState } from 'react';
import { useBooking } from '../context/BookingContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Receipt,
  MessageSquare,
  Package,
  Clock,
  BarChart3,
  Settings,
  Database,
  LogOut,
  X,
  ExternalLink,
  Check,
  ChevronDown,
  User,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpenMobile,
  setIsOpenMobile,
}) => {
  const {
    role,
    setRole,
    activeClientId,
    setActiveClientId,
    activeClients,
    settings,
    t,
    getUnreadCountForProvider,
    unbilledItemsCount,
    firebaseSyncStatus,
    firebaseSyncError,
    forceSyncToFirebase,
  } = useBooking();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const providerUnread = getUnreadCountForProvider();

  const firestoreRulesSnippet = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, create, update: if true;
      allow delete: if request.auth != null && request.auth.uid == userId;
      match /{subcollection}/{docId} {
        allow read, create, update: if true;
        allow delete: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /trainers/{trainerId} {
      allow read, create, update: if true;
      allow delete: if request.auth != null && request.auth.uid == trainerId;
      match /{subcollection}/{docId} {
        allow read, create, update: if true;
        allow delete: if request.auth != null && request.auth.uid == trainerId;
      }
    }
    match /{collection}/{docId} {
      allow read, create, update: if true;
      allow delete: if request.auth != null;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesSnippet);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  const navGroups: NavGroup[] = [
    {
      title: 'Workspace & Agenda',
      items: [
        { id: 'dashboard', label: t.tabDashboard, icon: LayoutDashboard },
        { id: 'calendar', label: t.tabCalendar, icon: Calendar },
      ],
    },
    {
      title: 'Clients & Invoicing',
      items: [
        { id: 'clients', label: t.tabClients, icon: Users },
        {
          id: 'billing',
          label: t.tabBilling,
          icon: Receipt,
          badge: unbilledItemsCount > 0 ? unbilledItemsCount : undefined,
        },
        { id: 'packages', label: t.tabPackages, icon: Package },
      ],
    },
    {
      title: 'Comms & Operations',
      items: [
        {
          id: 'chat',
          label: t.tabChat,
          icon: MessageSquare,
          badge: providerUnread > 0 ? providerUnread : undefined,
        },
        { id: 'availability', label: t.tabAvailability, icon: Clock },
        { id: 'reports', label: t.tabReports, icon: BarChart3 },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { id: 'settings', label: t.tabSettings || 'Settings', icon: Settings },
      ],
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    setIsOpenMobile(false);
  };

  // Reusable Sidebar Inner Content
  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Section: Brand + Trainer Info + Navigation */}
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-lg italic shadow-md shadow-emerald-500/25 shrink-0">
              PB
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">
                  ProBooking
                </span>
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                  Trainer Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {settings.profession || 'Fitness & Coaching'}
              </p>
            </div>
          </div>

          {/* Mobile Close Button */}
          {isOpenMobile && (
            <button
              type="button"
              onClick={() => setIsOpenMobile(false)}
              className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Trainer Mini Card */}
        <div className="mx-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                  {settings.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              </div>
              <div className="min-w-0 truncate">
                <h4 className="text-xs font-bold text-slate-100 truncate">
                  {settings.name}
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  Admin Workspace
                </p>
              </div>
            </div>

            <a
              href="https://pro-booking75.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              title="Open Webapp in new browser window"
              className="text-slate-400 hover:text-emerald-300 transition p-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="px-3 space-y-4 pt-1">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/25'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 group-hover:text-emerald-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {/* Badge if present */}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 ${
                            isActive
                              ? 'bg-white text-emerald-950 shadow-xs'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Section: Firebase Status + Role Switcher + Reset + Sign Out */}
      <div className="p-3 border-t border-slate-800 space-y-2 mt-4">
        {/* Firebase Cloud Sync Status */}
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
              ? `Firebase (probooking75): ${firebaseSyncError || 'Rules required'}. Click for setup.`
              : 'Connected to Firebase Firestore. Click to sync now.'
          }
          className={`flex w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-[11px] font-medium transition cursor-pointer ${
            firebaseSyncStatus === 'synced'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              : firebaseSyncStatus === 'connecting'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
          }`}
        >
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px]">Firestore Cloud</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">
              {firebaseSyncStatus === 'synced' ? 'Online' : 'Sync'}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${
                firebaseSyncStatus === 'synced'
                  ? 'bg-emerald-400'
                  : firebaseSyncStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
          </div>
        </button>

        {/* Role Switcher / Test Client Portal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleDropdown((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="truncate">Test Client Portal</span>
            </div>
            <ChevronDown
              className={`h-3 w-3 text-slate-400 transition-transform ${
                showRoleDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showRoleDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowRoleDropdown(false)}
              />
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl z-50 text-xs text-slate-200">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Client to Test
                </div>

                <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                  {activeClients.map((client) => {
                    const isSelected =
                      role === 'client' && activeClientId === client.id;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setActiveClientId(client.id);
                          setRole('client');
                          setShowRoleDropdown(false);
                          setIsOpenMobile(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 transition text-left cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-medium text-white truncate">
                            {client.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {client.email}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sign out */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => signOut(auth)}
            title={`Sign Out (${auth.currentUser?.email || ''})`}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 py-2 px-3 text-xs font-bold text-rose-200 hover:bg-rose-600 hover:text-white transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 text-slate-100 flex-col overflow-y-auto scrollbar-none z-30">
        {sidebarContent}
      </aside>

      {/* 2. Mobile Slide-out Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpenMobile(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col z-50 overflow-y-auto">
            {sidebarContent}
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
                    All data is securely saved locally
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 mb-4 text-xs text-amber-900 leading-relaxed">
              <strong>Notice:</strong> Your Firebase project{' '}
              <code className="font-mono font-bold">probooking75</code> currently
              requires updated security rules. Paste the{' '}
              <strong>Firestore Rules</strong> below into your{' '}
              <strong>Firebase Console &rarr; Firestore Database &rarr; Rules</strong> and click <strong>Publish</strong>:
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
                {copiedRules ? '✓ Copied!' : 'Copy Rules'}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFirebaseModal(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  forceSyncToFirebase();
                  setShowFirebaseModal(false);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition cursor-pointer"
              >
                Reconnect &amp; Synchronize
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
