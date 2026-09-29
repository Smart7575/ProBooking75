import React, { useState } from 'react';
import { Client } from '../../types';
import { getMagicLinkDetails } from '../../utils/urlUtils';
import { useBooking } from '../../context/BookingContext';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Share2,
  X,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

interface MagicLinkModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({
  client,
  isOpen,
  onClose,
}) => {
  const { simulateMagicLink, t } = useBooking();
  const [copiedType, setCopiedType] = useState<'public' | 'inapp' | 'token' | null>(null);

  if (!isOpen) return null;

  const details = getMagicLinkDetails(
    client.magicToken,
    (client as any).trainerId || (client as any).userId
  );

  const handleCopy = (text: string, type: 'public' | 'inapp' | 'token') => {
    navigator.clipboard?.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleTestInApp = () => {
    simulateMagicLink(client.magicToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-xs">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {t.magicLinkModalTitle} {client.name}
              </h3>
              <p className="text-xs text-slate-500">
                {t.magicLinkModalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Primary Recommended Action: Direct Test in App */}
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  {t.recommendedTestMethod}
                </span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                {t.worksInstantly}
              </span>
            </div>
            <p className="text-xs text-emerald-950 font-medium mb-3 leading-relaxed">
              {t.magicLinkModalTestDesc}
            </p>
            <button
              onClick={handleTestInApp}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.99] transition cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{t.testDirectlyInApp} {client.name} {t.inAppPortal}</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>

          {/* 403 Explanation Box */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs">
                <h4 className="font-bold text-amber-950">
                  {t.why403Title}
                </h4>
                <p className="text-amber-900 leading-relaxed">
                  {t.why403Desc}
                </p>
                <div className="pt-1 text-[11px] text-amber-950">
                  <span className="font-bold">{t.why403SolutionTitle}</span>
                  <p className="mt-0.5">
                    {t.why403SolutionDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Link Copy Options */}
          <div className="space-y-2.5 pt-1">
            <label className="block text-xs font-bold text-slate-700">
              {t.shareableLinks}
            </label>

            {/* Public Shared URL (ais-pre) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-blue-600" />
                  {t.publicShareLink}
                </span>
                <button
                  onClick={() => handleCopy(details.publicSharedUrl, 'public')}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs transition"
                >
                  {copiedType === 'public' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>{t.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>{t.copy}</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 truncate select-all">
                {details.publicSharedUrl}
              </div>
            </div>

            {/* Token only */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                  TOKEN
                </span>
                <span className="font-mono text-xs text-slate-800 font-bold">
                  {client.magicToken}
                </span>
              </div>
              <button
                onClick={() => handleCopy(client.magicToken, 'token')}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-1 rounded-lg transition"
              >
                {copiedType === 'token' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>{t.copyToken}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-4 mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
