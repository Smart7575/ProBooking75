import React from 'react';
import { useBooking } from '../context/BookingContext';
import {
  Menu,
  ExternalLink,
  User,
  LayoutDashboard,
  LogOut,
  Calendar,
  Users,
  Receipt,
  MessageSquare,
  Package,
  Clock,
  BarChart3,
  Settings,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { formatFullHumanDate, getTodayISO } from '../utils/dateUtils';

interface TopHeaderProps {
  currentTab: string;
  onOpenMobileNav: () => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of bookings, revenue, and daily agenda',
    icon: LayoutDashboard,
  },
  calendar: {
    title: 'Calendar & Schedule',
    subtitle: 'Manage appointments, group sessions, and time blocks',
    icon: Calendar,
  },
  clients: {
    title: 'Clients & CRM',
    subtitle: 'Client profiles, notes, history, and booking links',
    icon: Users,
  },
  billing: {
    title: 'Invoicing & Revenue',
    subtitle: 'Create official invoices, track status, and export PDFs',
    icon: Receipt,
  },
  chat: {
    title: 'Client Messages',
    subtitle: 'Direct messaging and schedule updates with clients',
    icon: MessageSquare,
  },
  packages: {
    title: 'Packages & Bundles',
    subtitle: 'Prepaid session cards and bundle management',
    icon: Package,
  },
  availability: {
    title: 'Availability & Hours',
    subtitle: 'Working hours, vacation blocks, and Google Calendar sync',
    icon: Clock,
  },
  reports: {
    title: 'Reports & Analytics',
    subtitle: 'Financial insights, attendance metrics, and export data',
    icon: BarChart3,
  },
  settings: {
    title: 'Settings & Business Profile',
    subtitle: 'Trainer preferences, rates, taxes, and data backup',
    icon: Settings,
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onOpenMobileNav,
}) => {
  const { role, isTrainerPreview, exitTrainerPreview, settings, setRole, activeClients, setActiveClientId } = useBooking();
  const today = getTodayISO();

  const tabInfo = TAB_TITLES[currentTab] || {
    title: 'ProBooking',
    subtitle: 'Trainer Workspace',
    icon: LayoutDashboard,
  };
  const TabIcon = tabInfo.icon;

  return (
    <header className="sticky top-0 z-20 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + Page Title / Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 -ml-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Section Breadcrumb & Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TabIcon className="h-4 w-4" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {tabInfo.title}
              </h1>
            </div>
            <p className="hidden md:block text-xs text-slate-500 truncate">
              {tabInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Date info + Quick actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Return to Trainer Dashboard if in Client preview */}
          {role === 'client' && isTrainerPreview && (
            <button
              type="button"
              onClick={exitTrainerPreview}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              <span>Back to Trainer Dashboard</span>
            </button>
          )}

          {/* Today's date indicator */}
          <div className="hidden xl:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span>{formatFullHumanDate(today)}</span>
          </div>

          {/* Open Webapp in Browser */}
          <a
            href="https://pro-booking75.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
            title="Open published webapp in external tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden md:inline">Open Webapp</span>
          </a>

          {/* Quick Client Test Trigger if in Provider role */}
          {role === 'provider' && activeClients.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveClientId(activeClients[0].id);
                setRole('client');
              }}
              title="Preview client booking portal"
              className="hidden lg:flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 transition cursor-pointer"
            >
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span>Preview Client Portal</span>
            </button>
          )}

          {/* Sign Out Button */}
          {auth.currentUser && (
            <button
              type="button"
              onClick={() => signOut(auth)}
              title="Sign Out"
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-700 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
