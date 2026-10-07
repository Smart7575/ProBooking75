import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  Package,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { GroupSession } from '../../types';

interface BookGroupSessionModalProps {
  session: GroupSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: GroupSession) => void;
}

export const BookGroupSessionModal: React.FC<BookGroupSessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    currentClient,
    settings,
    clientPackages,
    bookGroupSessionSpot,
    formatPrice,
  } = useBooking();

  const [usePackage, setUsePackage] = useState<boolean>(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !session || !currentClient) return null;

  const confirmedParticipants = (session.participants || []).filter(
    (p) => p.status === 'confirmed'
  );
  const spotsLeft = Math.max(0, session.maxParticipants - confirmedParticipants.length);
  const isFull = spotsLeft === 0;

  // Find active packages for current client with remaining sessions
  const eligiblePackages = (clientPackages || []).filter(
    (cp) =>
      cp.clientId === currentClient.id &&
      cp.status === 'active' &&
      cp.remainingSessions >= 1 &&
      (!cp.expiresAt || cp.expiresAt >= session.date)
  );

  const defaultPkgId = eligiblePackages[0]?.id || '';
  const effectivePackageId = selectedPackageId || defaultPkgId;

  const handleConfirm = () => {
    setErrorMsg(null);
    setIsSubmitting(true);

    const pkgToUse = usePackage && eligiblePackages.length > 0 ? effectivePackageId : undefined;

    const res = bookGroupSessionSpot(session.id, currentClient.id, pkgToUse);

    setIsSubmitting(false);
    if (res.success) {
      onSuccess(session);
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-2xs shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Group Session
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    isFull
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {isFull ? 'Full' : `${spotsLeft} of ${session.maxParticipants} left`}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-1">
                {session.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Session Meta */}
        <div className="mt-4 space-y-2.5 rounded-2xl bg-purple-50/70 p-4 border border-purple-200/80 text-xs text-purple-950">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="font-semibold">{session.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-600 shrink-0" />
            <span className="font-semibold">
              {session.startTime} - {session.endTime} ({session.durationMinutes} min)
            </span>
          </div>
          {session.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-purple-600 shrink-0" />
              <span className="font-semibold">{session.location}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 font-bold">
            <span>Trainer: {settings.name}</span>
            <span className="text-sm font-black text-purple-950">
              {formatPrice(session.price)} / spot
            </span>
          </div>
        </div>

        {/* Capacity Occupancy Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
            <span>Capacity:</span>
            <span>
              {confirmedParticipants.length} / {session.maxParticipants} spots
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              style={{
                width: `${Math.min(
                  100,
                  (confirmedParticipants.length / session.maxParticipants) * 100
                )}%`,
              }}
              className={`h-full rounded-full transition-all duration-500 ${
                isFull ? 'bg-rose-500' : 'bg-purple-600'
              }`}
            ></div>
          </div>
        </div>

        {/* Payment / Credit Selection */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Payment &amp; Credit
          </label>

          {eligiblePackages.length > 0 ? (
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer select-none transition ${
                  usePackage
                    ? 'border-purple-600 bg-purple-50/60 text-purple-950'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="groupPayMode"
                  checked={usePackage}
                  onChange={() => setUsePackage(true)}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs flex-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Package className="h-3.5 w-3.5 text-purple-700" />
                    <span>Redeem package credit</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    1 session will be deducted from your package balance.
                  </p>

                  {usePackage && eligiblePackages.length > 1 && (
                    <select
                      value={effectivePackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-purple-950 outline-none"
                    >
                      {eligiblePackages.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.packageName} ({cp.remainingSessions} remaining)
                        </option>
                      ))}
                    </select>
                  )}
                  {usePackage && eligiblePackages.length === 1 && (
                    <p className="text-[11px] font-bold text-purple-800 mt-1">
                      {eligiblePackages[0].packageName} ({eligiblePackages[0].remainingSessions} remaining)
                    </p>
                  )}
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer select-none transition ${
                  !usePackage
                    ? 'border-purple-600 bg-purple-50/60 text-purple-950'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="groupPayMode"
                  checked={!usePackage}
                  onChange={() => setUsePackage(false)}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <span className="font-bold block">
                    Pay single session rate
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatPrice(session.price)} (will be invoiced)
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">
                  Single Session Fee
                </span>
                <span className="text-[11px] text-slate-500">
                  Invoiced upon attendance
                </span>
              </div>
              <span className="text-base font-black text-slate-900">
                {formatPrice(session.price)}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isFull || isSubmitting}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>Reserve Spot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
