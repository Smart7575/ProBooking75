import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { AuthScreen } from './components/auth/AuthScreen';
import { BookingProvider, useBooking } from './context/BookingContext';
import { Navbar } from './components/Navbar';
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
  const { role, currentClient } = useBooking();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [billingFilterClientId, setBillingFilterClientId] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar styled with Geometric Balance */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {role === 'provider' ? (
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
            {currentTab === 'availability' && <AvailabilitySettings onNavigate={setCurrentTab} />}
            {currentTab === 'reports' && <ReportingView />}
          </div>
        ) : (
          <ClientPortal />
        )}
      </main>

      {/* Clean, minimalist footer styled with Geometric Balance */}
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
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    document.title = 'ProBooking75';
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-300 font-sans">
        <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white font-bold text-lg italic flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-pulse">
          PB
        </div>
        <span className="text-xs font-medium text-slate-400">Authenticatie controleren...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <BookingProvider>
      <MainLayout />
    </BookingProvider>
  );
}
