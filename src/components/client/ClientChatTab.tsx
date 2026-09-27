import React, { useState, useEffect, useRef } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  Send,
  Sparkles,
  Check,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  Clock,
  Dumbbell,
  Phone,
  Mail,
} from 'lucide-react';

export const ClientChatTab: React.FC = () => {
  const {
    currentClient,
    settings,
    messages,
    sendChatMessage,
    markMessagesAsRead,
    language,
    t,
  } = useBooking();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clientId = currentClient?.id || 'cli-1';

  // Mark trainer's messages as read by client
  useEffect(() => {
    if (clientId) {
      markMessagesAsRead(clientId, 'client');
    }
  }, [clientId, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, clientId]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(clientId, 'client', inputText.trim());
    setInputText('');
  };

  const handleQuickQuestion = (text: string) => {
    sendChatMessage(clientId, 'client', text);
  };

  // Messages for this client
  const clientMessages = messages.filter((m) => m.clientId === clientId);

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

  const clientQuickQuestions = language === 'nl' ? [
    'Heb je tips voor m\'n spierpijn van de training?',
    'Kan ik morgen eventueel 10 minuten eerder starten?',
    'Super bedankt voor de fijne sessie vandaag!',
    'Wat is de beste warming-up oefening voor m\'n rug?',
  ] : [
    'Any tips for muscle soreness after our session?',
    'Could I possibly start 10 minutes earlier tomorrow?',
    'Thank you so much for the great training today!',
    'What is the best warm-up mobility drill for my back?',
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Trainer Contact & Status Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-black text-lg shadow-md shadow-emerald-500/20">
              <Dumbbell className="h-6 w-6" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"></span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {settings.name}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {t.online}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {t.chatTrainerSub}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t.typicalReplyTime}</span>
          </div>
          {settings.phone && (
            <div className="hidden md:flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              <span>{settings.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col h-[560px]">
        {/* Messages Flow */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
          {/* Welcome Card */}
          <div className="mx-auto max-w-md rounded-2xl bg-white border border-slate-200/80 p-4 text-center shadow-xs space-y-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mx-auto">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800">
              {language === 'nl' ? 'Beveiligde Chatlijn met je Trainer' : 'Direct & Secure Coach Chat'}
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {language === 'nl'
                ? `Stel hier je vragen aan ${settings.name} over oefeningen, voeding, herstel of planning.`
                : `Ask ${settings.name} any questions about workouts, nutrition, recovery or rescheduling.`}
            </p>
          </div>

          {clientMessages.map((msg) => {
            const isClient = msg.sender === 'client';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}
              >
                {!isClient && (
                  <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">
                    {settings.name}
                  </span>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                    isClient
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                      isClient ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatMessageTime(msg.timestamp)}</span>
                    {isClient && (
                      <span>
                        {msg.readByProvider ? (
                          <CheckCheck className="h-3.5 w-3.5 text-emerald-400" title={t.read} />
                        ) : (
                          <Check className="h-3 w-3 text-slate-400" title={t.delivered} />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {clientMessages.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <MessageSquare className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">{t.noMessagesYet}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'nl'
                  ? 'Typ hieronder je eerste bericht of kies een van de suggesties.'
                  : 'Type your message below or pick one of the suggestions.'}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Questions */}
        <div className="px-4 py-2 border-t border-slate-200/80 bg-slate-50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0 ml-1" />
          <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">
            {language === 'nl' ? 'Suggesties' : 'Suggestions'}:
          </span>
          {clientQuickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickQuestion(q)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition shrink-0 whitespace-nowrap shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Client Message Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center gap-2.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              language === 'nl'
                ? `Typ een bericht aan ${settings.name}...`
                : `Type a message to ${settings.name}...`
            }
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
    </div>
  );
};
