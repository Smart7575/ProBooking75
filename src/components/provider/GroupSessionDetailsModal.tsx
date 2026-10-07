import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  UserPlus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  UserX,
  Package,
} from 'lucide-react';
import { GroupSession, GroupSessionParticipant } from '../../types';
import { minutesToTime, timeToMinutes } from '../../utils/dateUtils';

interface GroupSessionDetailsModalProps {
  session: GroupSession | null;
  onClose: () => void;
  onOpenEdit?: (session: GroupSession) => void;
}

export const GroupSessionDetailsModal: React.FC<GroupSessionDetailsModalProps> = ({
  session,
  onClose,
}) => {
  const {
    groupSessions,
    clients,
    updateGroupSession,
    deleteGroupSession,
    bookGroupSessionSpot,
    cancelGroupSessionSpot,
    formatPrice,
  } = useBooking();

  // Get current active state for this session from context
  const currentSession = session
    ? groupSessions.find((g) => g.id === session.id) || session
    : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(currentSession?.title || '');
  const [editMaxParticipants, setEditMaxParticipants] = useState<number>(
    currentSession?.maxParticipants || 6
  );
  const [editPrice, setEditPrice] = useState<number>(currentSession?.price || 20);
  const [editLocation, setLocation] = useState(currentSession?.location || '');
  const [editDate, setEditDate] = useState(currentSession?.date || '');
  const [editStartTime, setEditStartTime] = useState(currentSession?.startTime || '18:00');
  const [editDuration, setEditDuration] = useState<number>(currentSession?.durationMinutes || 60);

  // Add participant state
  const [selectedAddClientId, setSelectedAddClientId] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!currentSession) return null;

  const activeParticipants = (currentSession.participants || []).filter(
    (p) => p.status === 'confirmed'
  );
  const spotsLeft = Math.max(0, currentSession.maxParticipants - activeParticipants.length);
  const isFull = spotsLeft === 0;
  const occupancyPct = Math.min(
    100,
    Math.round((activeParticipants.length / currentSession.maxParticipants) * 100)
  );

  // Clients eligible to be added (not already confirmed)
  const eligibleClients = clients.filter(
    (c) => !activeParticipants.some((p) => p.clientId === c.id)
  );

  const handleManualAddParticipant = () => {
    if (!selectedAddClientId) return;
    if (activeParticipants.length >= currentSession.maxParticipants) {
      setActionFeedback({
        type: 'error',
        message: 'This session is already full.',
      });
      return;
    }

    const res = bookGroupSessionSpot(currentSession.id, selectedAddClientId);
    if (res.success) {
      setActionFeedback({
        type: 'success',
        message: 'Participant added successfully!',
      });
      setSelectedAddClientId('');
      setTimeout(() => setActionFeedback(null), 3000);
    } else {
      setActionFeedback({ type: 'error', message: res.message });
    }
  };

  const handleRemoveParticipant = (p: GroupSessionParticipant) => {
    const res = cancelGroupSessionSpot(
      currentSession.id,
      p.clientId,
      'Removed by trainer via management panel'
    );
    if (res.success) {
      setActionFeedback({
        type: 'success',
        message: `${p.clientName} was removed. Spot is now reopened.`,
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } else {
      setActionFeedback({ type: 'error', message: res.message });
    }
  };

  const handleSaveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (editMaxParticipants < activeParticipants.length) {
      setActionFeedback({
        type: 'error',
        message: `Capacity cannot be lower than confirmed participants (${activeParticipants.length}).`,
      });
      return;
    }

    const startMin = timeToMinutes(editStartTime);
    const endMin = startMin + editDuration;
    const endTime = minutesToTime(Math.min(1439, endMin));

    updateGroupSession(currentSession.id, {
      title: editTitle.trim() || currentSession.title,
      maxParticipants: editMaxParticipants,
      price: editPrice,
      location: editLocation.trim(),
      date: editDate,
      startTime: editStartTime,
      endTime,
      durationMinutes: editDuration,
    });

    setIsEditing(false);
    setActionFeedback({
      type: 'success',
      message: 'Group session updated.',
    });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleDeleteSession = () => {
    if (
      window.confirm(
        `Are you sure you want to cancel "${currentSession.title}"? All ${activeParticipants.length} attendees will be cancelled.`
      )
    ) {
      deleteGroupSession(currentSession.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-2xs shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {currentSession.title}
                </h3>
                <span className="rounded-full bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Group Session
                </span>
                {isFull ? (
                  <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                    Full
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                    {spotsLeft} open
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentSession.date} • {currentSession.startTime} - {currentSession.endTime} ({currentSession.durationMinutes} min)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Feedback message banner */}
        {actionFeedback && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs flex items-center gap-2 ${
              actionFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
        )}

        {/* Occupancy Progress Bar */}
        <div className="mt-4 p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80">
          <div className="flex items-center justify-between text-xs font-bold text-purple-950 mb-2">
            <span>Participants &amp; Capacity</span>
            <span className="text-sm font-black">
              {activeParticipants.length} / {currentSession.maxParticipants}{' '}
              <span className="text-xs font-medium text-purple-700">({occupancyPct}% full)</span>
            </span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-purple-200/60 p-0.5">
            <div
              style={{ width: `${occupancyPct}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isFull ? 'bg-rose-500' : 'bg-purple-600'
              }`}
            ></div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-purple-900">
            <span>
              {isFull
                ? 'Maximum capacity reached. No further bookings allowed.'
                : `${spotsLeft} of ${currentSession.maxParticipants} spots available for booking.`}
            </span>
            <span>{formatPrice(currentSession.price)} / pp</span>
          </div>
        </div>

        {/* Details & Location */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Location
              </span>
              <span className="font-semibold text-slate-900 truncate block">
                {currentSession.location || 'No location specified'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
            <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Price / Spot
              </span>
              <span className="font-semibold text-slate-900">
                {formatPrice(currentSession.price)}{' '}
                <span className="text-slate-400 text-[11px] font-normal">
                  (or 1 credit)
                </span>
              </span>
            </div>
          </div>
        </div>

        {currentSession.description && (
          <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
            "{currentSession.description}"
          </p>
        )}

        {/* Edit Form (if toggled) */}
        {isEditing ? (
          <form onSubmit={handleSaveEdits} className="mt-5 p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-3 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-900 border-b border-purple-200/60 pb-2">
              <span>Edit Session Details</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-purple-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min={activeParticipants.length || 2}
                  max={50}
                  value={editMaxParticipants}
                  onChange={(e) => setEditMaxParticipants(parseInt(e.target.value, 10) || 2)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Price p.p.
                </label>
                <input
                  type="number"
                  step="0.50"
                  min={0}
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-purple-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Time</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Duration</label>
                <select
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  <option value={45}>45m</option>
                  <option value={60}>60m</option>
                  <option value={75}>75m</option>
                  <option value={90}>90m</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-purple-600 px-4 py-1 text-xs font-bold text-white hover:bg-purple-700"
              >
                Save
              </button>
            </div>
          </form>
        ) : null}

        {/* Registered Participants Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Registered Participants ({activeParticipants.length})
            </span>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
              >
                <Edit2 className="h-3 w-3" />
                <span>Edit Session</span>
              </button>
            )}
          </div>

          {activeParticipants.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
              No attendees registered yet. Clients can book this session via their portal.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-100 p-1">
              {activeParticipants.map((p, idx) => (
                <div
                  key={p.clientId || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100/70 transition text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="font-mono text-[10px] font-extrabold text-purple-700 w-4">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">{p.clientName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {p.clientEmail || p.clientPhone || ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.packageId ? (
                      <span className="flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        <Package className="h-3 w-3" />
                        <span>Package</span>
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {formatPrice(p.price || currentSession.price)}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Remove participant"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual Add Participant Action (if spots remain) */}
        {!isFull && eligibleClients.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl border border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex-1 w-full">
              <select
                value={selectedAddClientId}
                onChange={(e) => setSelectedAddClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-purple-600 cursor-pointer"
              >
                <option value="">
                  -- Add participant manually --
                </option>
                {eligibleClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleManualAddParticipant}
              disabled={!selectedAddClientId}
              className="w-full sm:w-auto flex items-center justify-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-3.5 py-1.5 text-xs font-bold text-white transition cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDeleteSession}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Cancel Session</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
