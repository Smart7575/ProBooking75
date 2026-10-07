import React, { useState } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Users,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { getTodayISO, addDaysToISO, minutesToTime, timeToMinutes } from '../../utils/dateUtils';
import { GroupSession, GroupSessionParticipant } from '../../types';

interface CreateGroupSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  initialStartTime?: string;
}

const TEMPLATES = [
  { title: 'Small Group Strength Training', duration: 60, max: 6, price: 20, location: 'Strength Room' },
  { title: 'Outdoor Bootcamp', duration: 60, max: 8, price: 15, location: 'City Park' },
  { title: 'HIIT & Core Circuit', duration: 45, max: 6, price: 17.5, location: 'Studio 1' },
  { title: 'Mobility & Recovery Workshop', duration: 60, max: 5, price: 25, location: 'Studio 2' },
];

export const CreateGroupSessionModal: React.FC<CreateGroupSessionModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialStartTime = '18:00',
}) => {
  const { addGroupSession, services, clients, currency, formatPrice } = useBooking();

  const todayStr = getTodayISO();
  const defaultDate = initialDate || addDaysToISO(todayStr, 1);

  const [title, setTitle] = useState('Small Group Strength Training');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState<number>(6);
  const [price, setPrice] = useState<number>(20);
  const [location, setLocation] = useState('Main Studio');
  const [description, setDescription] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const startMin = timeToMinutes(startTime);
  const endMin = startMin + durationMinutes;
  const endTime = minutesToTime(Math.min(1439, endMin));

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setDurationMinutes(tmpl.duration);
    setMaxParticipants(tmpl.max);
    setPrice(tmpl.price);
    setLocation(tmpl.location);
  };

  const handleTogglePreselectedClient = (cId: string) => {
    setSelectedClientIds((prev) => {
      if (prev.includes(cId)) {
        return prev.filter((id) => id !== cId);
      }
      if (prev.length >= maxParticipants) {
        setErrorMsg(`You can only pre-select up to ${maxParticipants} participants (maximum capacity).`);
        return prev;
      }
      setErrorMsg(null);
      return [...prev, cId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a title for the group session.');
      return;
    }
    if (maxParticipants < 2) {
      setErrorMsg('A group session requires at least 2 participants.');
      return;
    }

    const preParticipants: GroupSessionParticipant[] = selectedClientIds.map((cId) => {
      const client = clients.find((c) => c.id === cId);
      return {
        clientId: cId,
        clientName: client?.name || 'Client',
        clientEmail: client?.email,
        clientPhone: client?.phone,
        bookedAt: new Date().toISOString(),
        price,
        status: 'confirmed',
      };
    });

    addGroupSession({
      title: title.trim(),
      serviceId: serviceId || undefined,
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      durationMinutes,
      maxParticipants,
      price: Number(price) || 0,
      location: location.trim() || undefined,
      status: 'scheduled',
      participants: preParticipants,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 shadow-2xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Schedule Group Session
              </h3>
              <p className="text-xs text-slate-500">
                Define a session with maximum participant capacity.
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

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Template Pills */}
        <div className="mb-5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Quick Templates:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold border transition cursor-pointer ${
                  title === tmpl.title
                    ? 'border-purple-600 bg-purple-50 text-purple-800'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {tmpl.title} ({tmpl.max}p • {tmpl.duration}m)
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Group Session Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Small Group Strength Training"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-purple-600 outline-none"
              required
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={75}>75 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            <span>
              Time window:{' '}
              <strong className="text-slate-800">
                {startTime} - {endTime} ({durationMinutes} min)
              </strong>
            </span>
          </div>

          {/* Capacity (Maximal Participants) & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
            <div>
              <label className="font-bold text-purple-950 block mb-1 flex items-center justify-between">
                <span>Max Participants *</span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold">
                  {maxParticipants} spots
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Math.max(2, parseInt(e.target.value, 10) || 2))}
                  className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm font-black text-purple-950 focus:border-purple-600 outline-none"
                  required
                />
              </div>
              <p className="text-[10px] text-purple-800 mt-1">
                Clients can book until this capacity is reached.
              </p>
            </div>

            <div>
              <label className="font-bold text-purple-950 block mb-1 flex items-center justify-between">
                <span>Price per participant *</span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold">
                  {formatPrice(price)} / person
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.50"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-purple-300 bg-white pl-3 pr-8 py-2 text-sm font-black text-purple-950 focus:border-purple-600 outline-none"
                  required
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {currency}
                </span>
              </div>
              <p className="text-[10px] text-purple-800 mt-1">
                Or 1 package session credit.
              </p>
            </div>
          </div>

          {/* Location & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Main Studio or Park"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Link Service
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
              >
                <option value="">General Group</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Notes / Instructions for Participants
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Bring a towel and water bottle. Please arrive 5 minutes before start."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-purple-600 outline-none"
            />
          </div>

          {/* Optional: Pre-enroll clients */}
          <div>
            <label className="font-bold text-slate-800 block mb-1 flex items-center justify-between">
              <span>Pre-enroll clients (optional)</span>
              <span className="text-[11px] text-slate-500">
                {selectedClientIds.length} / {maxParticipants} selected
              </span>
            </label>
            <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1 bg-slate-50/50">
              {clients.map((c) => {
                const isSelected = selectedClientIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                      isSelected
                        ? 'bg-purple-100/70 text-purple-950 font-bold'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleTogglePreselectedClient(c.id)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="truncate">{c.name}</span>
                    </div>
                    {c.phone && <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Group Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
