import React, { useState, useEffect, useRef } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  Send,
  Search,
  Check,
  CheckCheck,
  MessageSquare,
  Sparkles,
  User,
  Calendar,
  Package,
  Phone,
  Mail,
  ArrowRight,
  Plus,
  ChevronLeft,
  X,
  Megaphone,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Client } from '../../types';
import { BulkMessageModal } from './BulkMessageModal';

interface ProviderChatViewProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ProviderChatView: React.FC<ProviderChatViewProps> = ({ onNavigateToTab }) => {
  const {
    clients,
    activeClients,
    messages,
    sendChatMessage,
    editChatMessage,
    deleteChatMessage,
    markMessagesAsRead,
    getUnreadCountForProvider,
    selectedChatClientId,
    setSelectedChatClientId,
    getClientActivePackages,
    settings,
    currencySymbol,
    t,
    language,
  } = useBooking();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_messages' | 'unread'>('all');
  const [inputText, setInputText] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Default to first active client if selected is not found
  const activeClient =
    activeClients.find((c) => c.id === selectedChatClientId) || activeClients[0];

  // Mark messages as read when viewing client's thread
  useEffect(() => {
    if (activeClient) {
      markMessagesAsRead(activeClient.id, 'provider');
    }
  }, [activeClient?.id, messages.length]);

  // Active client's messages
  const currentMessages = activeClient
    ? messages.filter((m) => m.clientId === activeClient.id)
    : [];

  // Contained scroll to bottom - does NOT scroll window or parent sidebar out of view
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [currentMessages.length, activeClient?.id]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeClient) return;
    sendChatMessage(activeClient.id, 'provider', inputText.trim());
    setInputText('');
  };

  const handleQuickReply = (text: string) => {
    if (!activeClient) return;
    sendChatMessage(activeClient.id, 'provider', text);
  };

  // Get conversation list with last message & unread count
  const conversations = activeClients.map((client) => {
    const clientMessages = messages.filter((m) => m.clientId === client.id);
    const lastMessage = clientMessages[clientMessages.length - 1];
    const unreadCount = getUnreadCountForProvider(client.id);
    const activePackages = getClientActivePackages(client.id);

    return {
      client,
      lastMessage,
      unreadCount,
      activePackages,
      lastTimestamp: lastMessage ? new Date(lastMessage.timestamp).getTime() : 0,
    };
  });

  // Sort by most recent message, then name
  conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

  const totalClientsCount = conversations.length;
  const withMessagesCount = conversations.filter((c) => !!c.lastMessage).length;
  const unreadCountTotal = conversations.filter((c) => c.unreadCount > 0).length;

  // Filter conversations based on search and tab mode
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.client.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterMode === 'has_messages') {
      return !!c.lastMessage;
    }
    if (filterMode === 'unread') {
      return c.unreadCount > 0;
    }
    return true;
  });

  const quickRepliesList = language === 'nl' ? [
    'Top gedaan vandaag! 💪',
    'Vergeet je bidon en handdoek niet.',
    'Sessie staat genoteerd in de agenda! 📅',
    'Hoe voelt de spierpijn vandaag?',
    'Neem een extra rustdag als het nodig is.',
  ] : [
    'Great job today! 💪',
    "Don't forget your water bottle and towel.",
    'Session is confirmed in the calendar! 📅',
    'How are your muscles feeling today?',
    'Take an extra rest day if needed.',
  ];

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  const activeClientPackages = activeClient ? getClientActivePackages(activeClient.id) : [];

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col md:flex-row h-[720px]">
      {/* Left Sidebar: Conversations list */}
      <div
        className={`${
          showMobileChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 border-r border-slate-200/80 bg-slate-50/70 flex-col shrink-0 h-full`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200/80 bg-white space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t.allConversations}</h2>
                <p className="text-[11px] text-slate-400">
                  {totalClientsCount} {language === 'nl' ? 'cliënten' : 'clients'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {getUnreadCountForProvider() > 0 && (
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs animate-pulse">
                  {getUnreadCountForProvider()} {t.unreadMessages}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-600 transition cursor-pointer shadow-xs"
                title={
                  language === 'nl'
                    ? 'Stuur een groepsbericht naar meerdere klanten'
                    : 'Send a bulk message to multiple clients'
                }
              >
                <Megaphone className="h-3.5 w-3.5 text-emerald-400" />
                <span>{language === 'nl' ? 'Groepsbericht' : 'Bulk Message'}</span>
              </button>
            </div>
          </div>

          {/* Search box with clear button */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchConversations}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8.5 pr-8 py-2 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                title="Wissen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex-1 rounded-lg py-1 px-2 text-[11px] font-bold transition text-center ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.filterAll} ({totalClientsCount})
            </button>
            <button
              onClick={() => setFilterMode('has_messages')}
              className={`flex-1 rounded-lg py-1 px-2 text-[11px] font-bold transition text-center ${
                filterMode === 'has_messages'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.filterWithMessages} ({withMessagesCount})
            </button>
            {unreadCountTotal > 0 && (
              <button
                onClick={() => setFilterMode('unread')}
                className={`flex-1 rounded-lg py-1 px-2 text-[11px] font-bold transition text-center flex items-center justify-center gap-1 ${
                  filterMode === 'unread'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <span>{t.filterUnread}</span>
                <span className="rounded-full bg-emerald-500 text-white px-1.5 py-0.2 text-[9px]">
                  {unreadCountTotal}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Conversation item list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredConversations.map(({ client, lastMessage, unreadCount, activePackages }) => {
            const isSelected = activeClient?.id === client.id;
            return (
              <button
                key={client.id}
                onClick={() => {
                  setSelectedChatClientId(client.id);
                  markMessagesAsRead(client.id, 'provider');
                  setShowMobileChat(true);
                }}
                className={`w-full text-left rounded-2xl p-3 transition flex items-start gap-3 relative ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white hover:bg-slate-100 text-slate-700'
                }`}
              >
                {/* Client Avatar */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-xs ${
                    isSelected
                      ? 'bg-white text-emerald-700'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {client.name.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {client.name}
                    </span>
                    {lastMessage && (
                      <span
                        className={`text-[10px] shrink-0 font-medium ${
                          isSelected ? 'text-emerald-100' : 'text-slate-400'
                        }`}
                      >
                        {formatMessageTime(lastMessage.timestamp)}
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <p
                    className={`text-[11px] truncate mt-0.5 ${
                      isSelected ? 'text-emerald-50' : 'text-slate-500'
                    }`}
                  >
                    {lastMessage ? (
                      <>
                        {lastMessage.sender === 'provider' && (
                          <span className="font-semibold">{language === 'nl' ? 'Jij: ' : 'You: '}</span>
                        )}
                        {lastMessage.text}
                      </>
                    ) : (
                      <span className="italic text-slate-400">
                        {language === 'nl' ? 'Nog geen berichten' : 'No messages yet'}
                      </span>
                    )}
                  </p>

                  {/* Badges: Unread or Package */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {unreadCount > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                          isSelected
                            ? 'bg-white text-emerald-700'
                            : 'bg-emerald-500 text-white'
                        }`}
                      >
                        {unreadCount} {language === 'nl' ? 'nieuw' : 'new'}
                      </span>
                    )}
                    {activePackages.length > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.2 text-[9px] font-semibold truncate ${
                          isSelected
                            ? 'bg-emerald-600/60 text-white'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {activePackages[0].remainingSessions} {language === 'nl' ? 'sessies' : 'sessions'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">
              {language === 'nl' ? 'Geen cliënten gevonden.' : 'No clients found.'}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Active Chat Conversation */}
      {activeClient ? (
        <div
          className={`${
            !showMobileChat ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col bg-slate-50/50 h-full min-w-0`}
        >
          {/* Conversation Header */}
          <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Back Button to return to sidebar/all clients */}
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 text-xs font-bold transition shrink-0"
                title={t.backToConversations}
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-bold">{language === 'nl' ? 'Gesprekken' : 'Chats'}</span>
              </button>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20">
                {activeClient.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {activeClient.name}
                  </h3>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {t.online}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 truncate">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="truncate">{activeClient.email}</span>
                  </span>
                  {activeClient.phone && (
                    <span className="hidden sm:flex items-center gap-1 shrink-0">
                      <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                      {activeClient.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Context & Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {activeClientPackages.length > 0 && (
                <div className="hidden lg:flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs text-amber-800 font-semibold">
                  <Package className="h-3.5 w-3.5 text-amber-600" />
                  <span>{activeClientPackages[0].packageName} ({activeClientPackages[0].remainingSessions} over)</span>
                </div>
              )}
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('calendar')}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition flex items-center gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">{language === 'nl' ? 'Plan Sessie' : 'Book Session'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-100/50"
          >
            {/* Conversation Start Intro Banner */}
            <div className="mx-auto max-w-sm rounded-2xl bg-white border border-slate-200/80 p-3.5 text-center shadow-xs text-xs text-slate-500 space-y-1">
              <div className="font-bold text-slate-800">
                {t.startConversationWith} {activeClient.name}
              </div>
              <p className="text-[11px] text-slate-400">
                {language === 'nl'
                  ? 'Berichten worden direct gesynchroniseerd met het persoonlijke klantenportaal van deze cliënt.'
                  : 'Messages sync directly with this client\'s personal self-service portal.'}
              </p>
            </div>

            {currentMessages.map((msg) => {
              const isProvider = msg.sender === 'provider';
              const isEditingThis = editingMessageId === msg.id;
              return (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${isProvider ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                      isProvider
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                    }`}
                  >
                    {isEditingThis ? (
                      <div className="space-y-2 min-w-[220px]">
                        <textarea
                          rows={2}
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          className="w-full rounded-xl bg-white text-slate-900 p-2 text-xs outline-none border border-emerald-300"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingMessageText('');
                            }}
                            className="rounded-lg bg-emerald-700/60 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-800 transition"
                          >
                            {t.cancel}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingMessageText.trim()) {
                                editChatMessage(msg.id, editingMessageText.trim());
                              }
                              setEditingMessageId(null);
                              setEditingMessageText('');
                            }}
                            className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-900 hover:bg-emerald-50 transition"
                          >
                            Opslaan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div
                      className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                        isProvider ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                    >
                      {!isEditingThis && (
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 mr-1">
                          {isProvider && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditingMessageText(msg.text);
                              }}
                              className="p-0.5 rounded hover:bg-black/15 transition cursor-pointer"
                              title="Bericht bewerken"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteChatMessage(msg.id)}
                            className="p-0.5 rounded hover:bg-black/15 transition cursor-pointer"
                            title="Bericht verwijderen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <span>{formatMessageTime(msg.timestamp)}</span>
                      {isProvider && (
                        <span>
                          {msg.readByClient ? (
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-200" title={t.read} />
                          ) : (
                            <Check className="h-3 w-3 text-emerald-300" title={t.delivered} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {currentMessages.length === 0 && (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <MessageSquare className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-600">{t.noMessagesYet}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'nl'
                    ? 'Stuur een welkomstbericht of beantwoord vragen over trainingen en herstel.'
                    : 'Send a welcome message or answer questions about training and recovery.'}
                </p>
              </div>
            )}
          </div>

          {/* Quick Replies Tray */}
          <div className="px-4 py-2 border-t border-slate-200/80 bg-white flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-1" />
            <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">
              {t.quickReplies}:
            </span>
            {quickRepliesList.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition shrink-0 whitespace-nowrap shadow-2xs"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center gap-2.5 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`${t.typeMessagePlaceholder} (${activeClient.name})`}
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="rounded-2xl bg-emerald-500 p-2.5 text-slate-950 font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-md shadow-emerald-500/20 shrink-0"
              title={t.send}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
          <div>
            <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Geen actieve cliënt geselecteerd</p>
            <p className="text-xs text-slate-400 mt-1">Selecteer een cliënt in de linkerlijst om te chatten.</p>
          </div>
        </div>
      )}

      <BulkMessageModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
      />
    </div>
  );
};

