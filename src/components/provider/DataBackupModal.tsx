import React, { useState, useRef } from 'react';
import { useBooking } from '../../context/BookingContext';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileText,
  Users,
  Calendar,
  Package,
  Receipt,
  MessageSquare,
  Settings,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { formatFullHumanDate } from '../../utils/dateUtils';
import { ProBookingBackupData } from '../../types';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'export' | 'import';
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'export',
}) => {
  const {
    settings,
    invoiceSettings,
    clients,
    appointments,
    packages,
    clientPackages,
    groupSessions,
    invoices,
    messages,
    exportAllData,
    importAllData,
    formatPrice,
  } = useBooking();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<ProBookingBackupData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [confirmedRisk, setConfirmedRisk] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    clientsCount: number;
    appointmentsCount: number;
    invoicesCount: number;
    packagesCount: number;
    groupSessionsCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Export Download
  const handleDownloadBackup = () => {
    try {
      const data = exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `probooking-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccessMsg('Backup file successfully downloaded!');
      setTimeout(() => setDownloadSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Handle Copy JSON to Clipboard
  const handleCopyJson = async () => {
    try {
      const data = exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      // fallback
    }
  };

  // Validate JSON string
  const validateAndSetJson = (jsonString: string) => {
    setParseError(null);
    setParsedBackup(null);
    setImportSuccessMsg(null);
    setImportStats(null);

    const trimmed = jsonString.trim();
    if (!trimmed) {
      setParseError('Please provide backup JSON data.');
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object') {
        setParseError('Invalid backup file (not a valid JSON object).');
        return;
      }

      // Check structure (either { data: { clients, appointments... } } or flat)
      const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const hasRecognizableData =
        Array.isArray(data.clients) ||
        Array.isArray(data.appointments) ||
        Array.isArray(data.invoices) ||
        data.settings ||
        data.invoiceSettings;

      if (!hasRecognizableData) {
        setParseError('This file does not contain recognizable ProBooking data (such as clients, appointments, or settings).');
        return;
      }

      setParsedBackup(parsed as ProBookingBackupData);
    } catch (err: any) {
      setParseError(`Error parsing JSON: ${err.message}`);
    }
  };

  // Handle File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      validateAndSetJson(content);
    };
    reader.onerror = () => {
      setParseError('Could not read file.');
    };
    reader.readAsText(file);
  };

  // Handle Drag & Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setImportJsonText(content);
        validateAndSetJson(content);
      };
      reader.readAsText(file);
    }
  };

  // Execute Import
  const handleExecuteImport = () => {
    if (!parsedBackup) return;
    setIsImporting(true);

    try {
      const res = importAllData(parsedBackup, importMode);
      setIsImporting(false);

      if (res.success) {
        setImportSuccessMsg(res.message);
        if (res.stats) {
          setImportStats(res.stats);
        }
      } else {
        setParseError(res.message);
      }
    } catch (err: any) {
      setIsImporting(false);
      setParseError(err?.message || 'Unknown import error.');
    }
  };

  // Counts from parsed backup for preview
  const previewData = parsedBackup
    ? parsedBackup.data && typeof parsedBackup.data === 'object'
      ? parsedBackup.data
      : (parsedBackup as any)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-5 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-5 sm:p-7 shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-2xs shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Data Management
                </span>
                <span className="text-xs text-slate-400">JSON Backup</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
                Export & Import Data
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl my-4 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Export Data (Backup)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="h-4 w-4 text-emerald-600" />
            <span>Import Data (Restore)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* ========================================================================= */}
          {/* TAB 1: EXPORT DATA                                                        */}
          {/* ========================================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              {downloadSuccessMsg && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-bold">{downloadSuccessMsg}</span>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">
                    Complete Data Package
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The export contains all your data in structured JSON format: your trainer profile, rates, schedules, client directory, appointment records, packages, group sessions, invoice history, and messages.
                </p>
              </div>

              {/* Data Summary Grid */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Backup contents:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Users className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Clients</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{clients.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Profiles & notes
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Bookings</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{appointments.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Reserved & delivered
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Users className="h-3.5 w-3.5 text-purple-600" />
                      <span>Groups</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{groupSessions.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Group sessions & caps
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Package className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Bundles</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {packages.length + clientPackages.length}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {packages.length} pkgs • {clientPackages.length} active
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Invoices</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{invoices.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Invoices & credit notes
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <Settings className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Settings</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {settings.name || 'Trainer'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {formatPrice(settings.standardHourlyRate)}/h • {settings.services.length} services
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <FileText className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Tax & IBAN</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {invoiceSettings.taxId ? 'Tax ID configured' : 'No Tax ID'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      {invoiceSettings.chamberOfCommerce ? 'Reg. ID set' : 'No Reg. ID'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold mb-1">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Messages</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{messages.length}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Chat messages
                    </div>
                  </div>
                </div>
              </div>

              {/* JSON preview toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowJsonPreview(!showJsonPreview)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {showJsonPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>
                    {showJsonPreview
                      ? 'Hide JSON preview'
                      : 'View JSON structure preview'}
                  </span>
                </button>

                {showJsonPreview && (
                  <div className="mt-2 p-3 bg-slate-900 text-emerald-400 rounded-2xl font-mono text-[11px] max-h-48 overflow-y-auto leading-relaxed border border-slate-800">
                    <pre>{JSON.stringify(exportAllData(), null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">
                        Copied to clipboard!
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-500" />
                      <span>Copy JSON to Clipboard</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Full Backup (.json)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: IMPORT DATA                                                        */}
          {/* ========================================================================= */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {importSuccessMsg && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-sm">{importSuccessMsg}</span>
                  </div>
                  {importStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-emerald-200/80 text-[11px]">
                      <div>
                        <strong>{importStats.clientsCount}</strong> clients
                      </div>
                      <div>
                        <strong>{importStats.appointmentsCount}</strong> bookings
                      </div>
                      <div>
                        <strong>{importStats.invoicesCount}</strong> invoices
                      </div>
                      <div>
                        <strong>{importStats.packagesCount}</strong> packages
                      </div>
                      <div>
                        <strong>{importStats.groupSessionsCount}</strong> group sessions
                      </div>
                    </div>
                  )}
                </div>
              )}

              {parseError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{parseError}</span>
                </div>
              )}

              {/* Upload Dropzone / Selector */}
              {!useTextInput ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-3xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 p-6 sm:p-8 text-center transition cursor-pointer space-y-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 mx-auto shadow-xs">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-800 block">
                      {importFile
                        ? importFile.name
                        : 'Select or drag a .json backup file here'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      {importFile
                        ? `${Math.round(importFile.size / 1024)} KB`
                        : 'Supports official ProBooking backup exports'}
                    </span>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block rounded-xl bg-white border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs">
                      Browse files...
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Paste JSON Backup code:
                  </label>
                  <textarea
                    rows={6}
                    value={importJsonText}
                    onChange={(e) => {
                      setImportJsonText(e.target.value);
                      validateAndSetJson(e.target.value);
                    }}
                    placeholder="Paste contents of a probooking-backup.json file here..."
                    className="w-full rounded-2xl border border-slate-200 p-3 font-mono text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {/* Toggle upload method */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setUseTextInput(!useTextInput)}
                  className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  {useTextInput
                    ? '← Upload file via file picker'
                    : 'Or: Paste JSON code manually →'}
                </button>
                {importFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportFile(null);
                      setImportJsonText('');
                      setParsedBackup(null);
                      setParseError(null);
                    }}
                    className="text-slate-400 hover:text-rose-600 transition"
                  >
                    Clear file
                  </button>
                )}
              </div>

              {/* Preview of Parsed Data */}
              {previewData && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-950">
                        Valid backup recognized
                      </span>
                    </div>
                    {parsedBackup?.exportedAt && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Exported:{' '}
                        {formatFullHumanDate(parsedBackup.exportedAt.slice(0, 10))}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Clients
                      </span>
                      <strong className="text-sm text-slate-900">
                        {previewData.clients?.length || 0}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Bookings
                      </span>
                      <strong className="text-sm text-slate-900">
                        {previewData.appointments?.length || 0}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Invoices
                      </span>
                      <strong className="text-sm text-slate-900">
                        {previewData.invoices?.length || 0}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Groups & Pkgs
                      </span>
                      <strong className="text-sm text-slate-900">
                        {(previewData.groupSessions?.length || 0) +
                          (previewData.packages?.length || 0)}
                      </strong>
                    </div>
                  </div>

                  {previewData.settings?.name && (
                    <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      <strong>Trainer profile:</strong>{' '}
                      {previewData.settings.name} • {previewData.settings.profession || 'Coach'} •{' '}
                      {previewData.settings.currency || 'EUR'}
                    </div>
                  )}
                </div>
              )}

              {/* Mode Selection */}
              {previewData && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-800 block">
                    Choose import mode:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label
                      onClick={() => setImportMode('replace')}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start gap-3 ${
                        importMode === 'replace'
                          ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <strong className="text-xs font-bold text-slate-900 block">
                          Replace (Full Restore)
                        </strong>
                        <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                          Replaces all current data with the backup. Recommended for restoring backups.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setImportMode('merge')}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-start gap-3 ${
                        importMode === 'merge'
                          ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <strong className="text-xs font-bold text-slate-900 block">
                          Merge with Existing
                        </strong>
                        <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                          Combines records without deleting unique existing items.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Risk acknowledgement */}
                  <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedRisk}
                      onChange={(e) => setConfirmedRisk(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-600 select-none leading-relaxed">
                      I understand that importing this backup will update my current data and settings.
                    </span>
                  </label>
                </div>
              )}

              {/* Action execute button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  disabled={!parsedBackup || !confirmedRisk || isImporting}
                  onClick={handleExecuteImport}
                  className={`rounded-xl px-5 py-2.5 text-xs font-bold shadow-md transition flex items-center gap-2 ${
                    !parsedBackup || !confirmedRisk || isImporting
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                  }`}
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>
                        {importMode === 'replace'
                          ? 'Replace & Restore'
                          : 'Merge Data'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
