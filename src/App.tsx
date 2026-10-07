import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { AuthScreen } from './components/auth/AuthScreen';
import { BookingProvider, useBooking } from './context/BookingContext';
import { getUrlMagicLinkParams } from './utils/urlUtils';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ProviderDashboard } from './components/provider/ProviderDashboard';
import { CalendarView } from './components/provider/CalendarView';
import { ClientManagement } from './components/provider/ClientManagement';
import { AvailabilitySettings } from './components/provider/AvailabilitySettings';
import { ReportingView } from './components/provider/ReportingView';
import { PackageManagement } from './components/provider/PackageManagement';
import { ProviderChatView } from './components/provider/ProviderChatView';
import { BillingManagement } from './components/provider/BillingManagement';
import { ClientPortal } from './components/client/ClientPortal';

const MainLayout: React.FC = () => {
  const { role } = useBooking();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [billingFilterClientId, setBillingFilterClientId] = useState<string | undefined>(undefined);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Security guard: Provider views require an authenticated trainer session
  if (role === 'provider' && !auth.currentUser) {
    return <AuthScreen />;
  }

  // Client view (public client or trainer previewing client mode)
  if (role === 'client') {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
        <TopHeader
          currentTab="client"
          onOpenMobileNav={() => {}}
        />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ClientPortal />
        </main>
        <footer className="w-full border-t border-slate-200/80 bg-white py-5 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-700">ProBooking</span>
              <span className="text-slate-400">• Independent Service Provider Scheduling & Client Ops</span>
            </div>
            <span className="text-slate-400">GDPR / AVG Compliant • SSL Encrypted Self-Service</span>
          </div>
        </footer>
      </div>
    );
  }

  // Provider Workspace Layout with Sidebar
  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Side Menu (persistent on desktop lg+, drawer on mobile) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpenMobile={isMobileNavOpen}
        setIsOpenMobile={setIsMobileNavOpen}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <TopHeader
          currentTab={currentTab}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Main Workspace Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="space-y-6">
            {currentTab === 'dashboard' && <ProviderDashboard onNavigate={setCurrentTab} />}
            {currentTab === 'calendar' && <CalendarView />}
            {currentTab === 'clients' && (
              <ClientManagement
                onNavigateToChat={(clientId) => setCurrentTab('chat')}
                onNavigateToBilling={(clientId) => {
                  setBillingFilterClientId(clientId);
                  setCurrentTab('billing');
                }}
              />
            )}
            {currentTab === 'billing' && (
              <BillingManagement
                initialClientId={billingFilterClientId}
                onNavigateToClient={(clientId) => setCurrentTab('clients')}
              />
            )}
            {currentTab === 'chat' && <ProviderChatView onNavigateToTab={setCurrentTab} />}
            {currentTab === 'packages' && <PackageManagement />}
            {(currentTab === 'availability' || currentTab === 'settings') && (
              <AvailabilitySettings onNavigate={setCurrentTab} />
            )}
            {currentTab === 'reports' && <ReportingView />}
          </div>
        </main>

        {/* Minimalist footer */}
        <footer className="w-full border-t border-slate-200/80 bg-white py-5 text-center text-xs text-slate-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-700">ProBooking</span>
              <span className="text-slate-400">• Independent Service Provider Scheduling & Client Ops</span>
            </div>
            <span className="text-slate-400">GDPR / AVG Compliant • SSL Encrypted Self-Service</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [urlMagicToken, setUrlMagicToken] = useState<string | null>(
    () => getUrlMagicLinkParams().token
  );
  const [requireTrainerAuth, setRequireTrainerAuth] = useState(false);

  useEffect(() => {
    document.title = 'ProBooking75';
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser && !getUrlMagicLinkParams().token) {
        setRequireTrainerAuth(false);
      }
    });

    const handleMagicLinkChanged = () => {
      const { token } = getUrlMagicLinkParams();
      setUrlMagicToken(token);
      if (token) {
        setRequireTrainerAuth(false);
      }
    };

    const handleRequireTrainerAuth = () => {
      setUrlMagicToken(null);
      setRequireTrainerAuth(true);
    };

    window.addEventListener('probooking:magic-link-changed', handleMagicLinkChanged);
    window.addEventListener('probooking:require-trainer-auth', handleRequireTrainerAuth);
    window.addEventListener('popstate', handleMagicLinkChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('probooking:magic-link-changed', handleMagicLinkChanged);
      window.removeEventListener('probooking:require-trainer-auth', handleRequireTrainerAuth);
      window.removeEventListener('popstate', handleMagicLinkChanged);
    };
  }, []);

  if (!authReady && !urlMagicToken) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-300 font-sans">
        <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white font-bold text-lg italic flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-pulse">
          PB
        </div>
        <span className="text-xs font-medium text-slate-400">
          Verifying authentication...
        </span>
      </div>
    );
  }

  if (requireTrainerAuth || (!user && !urlMagicToken)) {
    return <AuthScreen />;
  }

  return (
    <BookingProvider>
      <MainLayout />
    </BookingProvider>
  );
}
