import React, { useState, useEffect, useMemo } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Send,
  Users,
  Check,
  Search,
  Sparkles,
  Calendar,
  ShieldAlert,
  Megaphone,
  Package,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

interface BulkMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds?: string[];
  onSuccess?: (sentCount: number) => void;
}

export const BulkMessageModal: React.FC<BulkMessageModalProps> = ({
  isOpen,
  onClose,
  initialSelectedIds,
  onSuccess,
}) => {
  const {
    activeClients,
    sendBulkChatMessage,
    getClientActivePackages,
    settings,
    language,
  } = useBooking();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sentResultCount, setSentResultCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedIds(initialSelectedIds);
      } else {
        setSelectedIds(activeClients.map((c) => c.id));
      }
      setSearchQuery('');
      setSentResultCount(null);
    }
  }, [isOpen, initialSelectedIds, activeClients]);

  const templates = useMemo(() => {
    if (language === 'nl') {
      return [
        {
          id: 'holiday',
          label: 'Vakantie / Sluiting',
          icon: Calendar,
          text: `Hoi {voornaam},\n\nGraag laat ik je weten dat ik wegens vakantie / feestdagen afwezig ben van [Startdatum] t/m [Einddatum]. Wil je voor of na deze periode nog sessies inplannen? Boek ze gerust alvast via je persoonlijke portaal!\n\nSportieve groet,\n${settings.name}`,
        },
        {
          id: 'policy',
          label: 'Beleid & Voorwaarden',
          icon: ShieldAlert,
          text: `Hoi {voornaam},\n\nKorte update over onze planningsvoorwaarden: kosteloos verplaatsen of annuleren van een sessie kan tot ${settings.cancellationPolicyHours} uur voor aanvang via je portaal. Zo houden we de agenda voor iedereen flexibel!\n\nMet vriendelijke groet,\n${settings.name}`,
        },
        {
          id: 'schedule',
          label: 'Extra Beschikbaarheid',
          icon: Sparkles,
          text: `Hoi {voornaam},\n\nEr zijn voor komende week extra tijdsloten vrijgekomen in de agenda! Als je nog een extra training wilt inplannen met je rittenkaart of losse sessie, kun je direct een plek reserveren.\n\nTot snel!\n${settings.name}`,
        },
        {
          id: 'general',
          label: 'Algemene Mededeling',
          icon: Megaphone,
          text: `Hoi {voornaam},\n\nHierbij een korte algemene update vanuit ${settings.name}: [Typ hier je mededeling].\n\nLaat het gerust weten in de chat als je vragen hebt!`,
        },
      ];
    }

    return [
      {
        id: 'holiday',
        label: 'Holiday Closure',
        icon: Calendar,
        text: `Hi {firstName},\n\nPlease note that I will be away for the holidays from [Start Date] through [End Date]. If you'd like to lock in your sessions before or after the break, feel free to book ahead via your client portal!\n\nBest regards,\n${settings.name}`,
      },
      {
        id: 'policy',
        label: 'Policy Update',
        icon: ShieldAlert,
        text: `Hi {firstName},\n\nQuick update regarding our scheduling policy: sessions can be rescheduled or cancelled free of charge up to ${settings.cancellationPolicyHours} hours in advance via your portal. Thank you for your cooperation!\n\nBest,\n${settings.name}`,
      },
      {
        id: 'schedule',
        label: 'New Slots Open',
        icon: Sparkles,
        text: `Hi {firstName},\n\nNew training slots have just been opened for next week! If you'd like to book an extra session or redeem a package credit, you can grab your preferred time in the portal now.\n\nSee you soon!\n${settings.name}`,
      },
      {
        id: 'general',
        label: 'General Announcement',
        icon: Megaphone,
        text: `Hi {firstName},\n\nHere is a quick announcement from ${settings.name}: [Insert announcement details here].\n\nFeel free to reply here in the chat if you have any questions!`,
      },
    ];
  }, [language, settings.name, settings.cancellationPolicyHours]);

  // Preview message for the first selected client
  const previewClient =
    activeClients.find((c) => selectedIds.includes(c.id)) || activeClients[0];

  const previewText = useMemo(() => {
    if (!messageText.trim()) return '';
    const fullName = previewClient?.name || (language === 'nl' ? 'Linda de Vries' : 'Linda de Vries');
    const firstName = fullName.split(' ')[0];
    return messageText
      .replace(/\{firstName\}/gi, firstName)
      .replace(/\{voornaam\}/gi, firstName)
      .replace(/\{name\}/gi, fullName)
      .replace(/\{naam\}/gi, fullName);
  }, [messageText, previewClient, language]);

  if (!isOpen) return null;

  const filteredClients = activeClients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.city && c.city.toLowerCase().includes(q))
    );
  });

  const toggleClient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllActive = () => {
    setSelectedIds(activeClients.map((c) => c.id));
  };

  const selectWithActivePackages = () => {
    const withPkg = activeClients
      .filter((c) => getClientActivePackages(c.id).length > 0)
      .map((c) => c.id);
    setSelectedIds(withPkg);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const insertPlaceholder = (placeholder: string) => {
    setMessageText((prev) => `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${placeholder}`);
  };

  const handleSendBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !messageText.trim()) return;

    const count = sendBulkChatMessage(selectedIds, messageText);
    setSentResultCount(count);
    if (onSuccess) {
      onSuccess(count);
    }
    setTimeout(() => {
      setMessageText('');
      setSentResultCount(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8 animate-scale-in">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {language === 'nl'
                  ? 'Groepsbericht & Mededeling Versturen'
                  : 'Send Bulk Chat Message & Announcement'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'nl'
                  ? 'Selecteer meerdere klanten voor vakantiesluitingen, beleidswijzigingen of algemene updates'
                  : 'Select multiple clients for holiday closures, policy updates, or general announcements'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {sentResultCount !== null ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              {language === 'nl'
                ? `Bericht succesvol verstuurd naar ${sentResultCount} ${
                    sentResultCount === 1 ? 'klant' : 'klanten'
                  }!`
                : `Message successfully sent to ${sentResultCount} ${
                    sentResultCount === 1 ? 'client' : 'clients'
                  }!`}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {language === 'nl'
                ? 'Elke geselecteerde klant heeft het bericht direct in zijn of haar eigen chatgesprek en klantenportaal ontvangen.'
                : 'Each selected client has received the personalized message directly in their individual chat thread and client portal.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendBulk} className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left Column: Recipient Selection (5 cols) */}
            <div className="md:col-span-5 p-5 bg-slate-50/60 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {language === 'nl' ? '1. Selecteer Ontvangers' : '1. Select Recipients'}
                    </span>
                  </label>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                    {selectedIds.length} / {activeClients.length}{' '}
                    {language === 'nl' ? 'geselecteerd' : 'selected'}
                  </span>
                </div>

                {/* Quick Filter Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllActive}
                    className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 transition cursor-pointer shadow-2xs"
                  >
                    {language === 'nl' ? 'Alle actieve klanten' : 'All Active'} ({activeClients.length})
                  </button>
                  <button
                    type="button"
                    onClick={selectWithActivePackages}
                    className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50/50 transition cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <Package className="h-3 w-3" />
                    <span>{language === 'nl' ? 'Met pakket' : 'With Package'}</span>
                  </button>
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 hover:border-rose-200 transition cursor-pointer"
                    >
                      {language === 'nl' ? 'Wissen' : 'Clear'}
                    </button>
                  )}
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      language === 'nl' ? 'Zoek klant op naam...' : 'Filter clients by name...'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white pl-8.5 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Scrollable Client Checklist */}
                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                  {filteredClients.map((client) => {
                    const isChecked = selectedIds.includes(client.id);
                    const pkgs = getClientActivePackages(client.id);
                    const openSessions = pkgs.reduce((acc, p) => acc + p.remainingSessions, 0);

                    return (
                      <div
                        key={client.id}
                        onClick={() => toggleClient(client.id)}
                        className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition cursor-pointer select-none ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-50/60 shadow-2xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {client.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">{client.email}</p>
                          </div>
                        </div>

                        {openSessions > 0 && (
                          <span className="shrink-0 rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {openSessions} {language === 'nl' ? 'open' : 'left'}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {filteredClients.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">
                      {language === 'nl' ? 'Geen klanten gevonden.' : 'No matching clients.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-100 p-2.5 text-[11px] text-slate-600 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {language === 'nl'
                    ? 'Elke klant ontvangt dit bericht privé in zijn/haar eigen 1-op-1 chat.'
                    : 'Each client receives this message privately in their 1-on-1 chat.'}
                </span>
              </div>
            </div>

            {/* Right Column: Message Composer & Templates (7 cols) */}
            <div className="md:col-span-7 p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Templates Section */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    {language === 'nl'
                      ? '2. Kies een Snel Sjabloon (Optioneel)'
                      : '2. Quick Announcement Templates (Optional)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((tpl) => {
                      const Icon = tpl.icon;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => setMessageText(tpl.text)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 text-left text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition cursor-pointer"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-2xs border border-slate-100">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="truncate">{tpl.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Textarea Composer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800">
                      {language === 'nl' ? '3. Bericht Opstellen *' : '3. Compose Message *'}
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">
                        {language === 'nl' ? 'Personaliseer:' : 'Personalize:'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          insertPlaceholder(language === 'nl' ? '{voornaam}' : '{firstName}')
                        }
                        className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                      >
                        + {language === 'nl' ? '{voornaam}' : '{firstName}'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          insertPlaceholder(language === 'nl' ? '{naam}' : '{name}')
                        }
                        className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                      >
                        + {language === 'nl' ? '{naam}' : '{name}'}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    required
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={
                      language === 'nl'
                        ? 'Typ hier je mededeling voor de geselecteerde klanten...'
                        : 'Type your announcement for the selected clients here...'
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition leading-relaxed resize-none"
                  />
                </div>

                {/* Live Personalized Preview */}
                {messageText.trim() && previewClient && (
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>
                        {language === 'nl'
                          ? `Voorbeeld voor ${previewClient.name}`
                          : `Live Preview for ${previewClient.name}`}
                      </span>
                      <span className="text-emerald-600">1-on-1 Chat</span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-3">
                      {previewText}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Footer */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  {language === 'nl' ? 'Annuleren' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={selectedIds.length === 0 || !messageText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {language === 'nl'
                      ? `Verstuur naar ${selectedIds.length} ${
                          selectedIds.length === 1 ? 'Klant' : 'Klanten'
                        }`
                      : `Send to ${selectedIds.length} ${
                          selectedIds.length === 1 ? 'Client' : 'Clients'
                        }`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
