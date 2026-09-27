import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, formatFirestoreError, OperationType } from '../../firebase';
import { initialSettings, initialInvoiceSettings } from '../../data/initialData';
import {
  Lock,
  Mail,
  User,
  Phone,
  Briefcase,
  Coins,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Database,
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('Personal Trainer & Performance Coach');
  const [phone, setPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('65');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFriendlyErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Ongeldig e-mailadres of wachtwoord. Controleer je gegevens en probeer het opnieuw.';
      case 'auth/email-already-in-use':
        return 'Dit e-mailadres is al in gebruik. Log in of gebruik een ander e-mailadres.';
      case 'auth/weak-password':
        return 'Het wachtwoord is te zwak. Gebruik minimaal 6 tekens.';
      case 'auth/invalid-email':
        return 'Voer een geldig e-mailadres in.';
      case 'auth/too-many-requests':
        return 'Te veel mislukte pogingen. Wacht even en probeer het later opnieuw.';
      case 'auth/network-request-failed':
        return 'Netwerkfout. Controleer je internetverbinding.';
      case 'auth/popup-closed-by-user':
        return 'Het inlogvenster is gesloten voordat het inloggen was voltooid.';
      case 'auth/popup-blocked':
        return 'De pop-up werd geblokkeerd door je browser. Sta pop-ups toe voor deze website en probeer het opnieuw.';
      case 'auth/cancelled-popup-request':
        return 'Er is al een inlogvenster geopend. Voltooi die actie eerst.';
      case 'auth/operation-not-allowed':
        return 'Deze inlogmethode (Google of Apple) is nog niet geactiveerd in Firebase. Schakel de provider in via Firebase Console > Authentication > Sign-in method.';
      case 'auth/unauthorized-domain':
        return `Dit domein (${window.location.hostname}) is nog niet geautoriseerd in Firebase. Voeg dit domein toe in Firebase Console > Authentication > Settings > Authorized domains.`;
      case 'auth/account-exists-with-different-credential':
        return 'Er bestaat al een account met dit e-mailadres via een andere inlogmethode.';
      default:
        return err?.message || 'Er is een fout opgetreden bij het authenticeren.';
    }
  };

  const initializeTrainerProfile = async (
    firebaseUser: FirebaseUser,
    isExplicitRegister: boolean
  ) => {
    const uid = firebaseUser.uid;
    const storagePrefix = `probooking_v3_${uid}`;
    const existingLocalSettings = localStorage.getItem(`${storagePrefix}_settings`);

    let existingCloudDoc = false;
    try {
      const snap = await getDoc(doc(db, 'trainers', uid));
      existingCloudDoc = snap.exists();
    } catch (readErr) {
      formatFirestoreError(readErr, OperationType.GET, `trainers/${uid}`);
    }

    // Only initialize defaults if this is a brand-new trainer or explicit registration
    if (!existingCloudDoc && (!existingLocalSettings || isExplicitRegister)) {
      const trainerName =
        name.trim() ||
        firebaseUser.displayName ||
        (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Personal Trainer');
      const trainerProfession = profession.trim() || 'Personal Trainer & Performance Coach';
      const trainerPhone = phone.trim() || firebaseUser.phoneNumber || '+31 6 12345678';
      const parsedRate = Number(hourlyRate) > 0 ? Number(hourlyRate) : 65;
      const trainerEmail = firebaseUser.email || email.trim() || initialSettings.email;

      if (!firebaseUser.displayName && trainerName) {
        try {
          await updateProfile(firebaseUser, { displayName: trainerName });
        } catch {
          // Ignore non-critical profile update errors
        }
      }

      const newTrainerSettings = {
        ...initialSettings,
        name: trainerName,
        profession: trainerProfession,
        email: trainerEmail,
        phone: trainerPhone,
        standardHourlyRate: parsedRate,
        availabilityMode: 'adhoc' as const,
      };

      const newInvoiceSettings = {
        ...initialInvoiceSettings,
        businessName: `${trainerName} Coaching`,
        email: trainerEmail,
        phone: trainerPhone,
      };

      localStorage.setItem(`${storagePrefix}_settings`, JSON.stringify(newTrainerSettings));
      localStorage.setItem(
        `${storagePrefix}_invoiceSettings`,
        JSON.stringify(newInvoiceSettings)
      );

      try {
        await setDoc(
          doc(db, 'trainers', uid),
          {
            uid,
            name: trainerName,
            profession: trainerProfession,
            email: trainerEmail,
            phone: trainerPhone,
            standardHourlyRate: parsedRate,
            settings: newTrainerSettings,
            invoiceSettings: newInvoiceSettings,
            clients: [],
            appointments: [],
            packages: [],
            clientPackages: [],
            messages: [],
            invoices: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (dbErr) {
        formatFirestoreError(dbErr, OperationType.CREATE, `trainers/${uid}`);
      }
    }
  };

  const handleOAuthSignIn = async (providerType: 'google' | 'apple') => {
    setError(null);
    setOauthLoading(providerType);
    try {
      let userCredential;
      if (providerType === 'google') {
        const googleProvider = new GoogleAuthProvider();
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        userCredential = await signInWithPopup(auth, googleProvider);
      } else {
        const appleProvider = new OAuthProvider('apple.com');
        appleProvider.addScope('email');
        appleProvider.addScope('name');
        userCredential = await signInWithPopup(auth, appleProvider);
      }

      await initializeTrainerProfile(userCredential.user, mode === 'register');
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Vul zowel je e-mailadres als wachtwoord in.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Vul je naam in om je als trainer te registreren.');
        return;
      }
      if (password.length < 6) {
        setError('Het wachtwoord moet minimaal 6 tekens bevatten.');
        return;
      }
      if (password !== confirmPassword) {
        setError('De ingevoerde wachtwoorden komen niet overeen.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        await initializeTrainerProfile(userCredential.user, true);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
  };

  const isAnyLoading = loading || oauthLoading !== null;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Subtle Ambient Background Accents */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />

      {/* Top Brand Header */}
      <header className="relative z-10 mx-auto w-full max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-lg italic shadow-lg shadow-emerald-500/25">
            PB
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              ProBooking
            </span>
            <span className="ml-2 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
              Firebase Cloud & Auth
            </span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <Database className="h-4 w-4 text-emerald-400" />
          <span>Gekoppeld aan probooking75</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Left Column: Brand Value Proposition */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 p-8 border-r border-slate-800/80">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>Trainer & Cliënt Cloud Database</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white leading-snug">
                Registreer je trainerprofiel en beheer je cliënten in de cloud.
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Alle trainergegevens, cliëntregistraties, werktijden, afspraken en facturen worden direct gesynchroniseerd met de Firebase Firestore database.
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Trainergegevens & tarieven opgeslagen in Firestore</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cliënten registreren en beheren met Magic Booking Links</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Realtime synchronisatie tussen al je apparaten</span>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Firebase Project:</span>
              <span className="text-emerald-400 font-mono font-bold">probooking75</span>
            </div>
          </div>

          {/* Right Column: Login / Register Form */}
          <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center bg-white text-slate-900">
            {/* Mode Switcher Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200/80 mb-5">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Inloggen
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Trainer Registreren
              </button>
            </div>

            <div className="mb-5">
              <h2 className="text-xl font-extrabold text-slate-900">
                {mode === 'login' ? 'Welkom terug' : 'Registreer als Trainer'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Log in met Google, Apple of je e-mailadres om je agenda en cliënten te openen.'
                  : 'Maak snel een nieuw trainer-account aan met Google, Apple of je e-mailadres.'}
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Google & Apple Sign-In Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isAnyLoading}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>
                  {oauthLoading === 'google'
                    ? 'Verbinden...'
                    : mode === 'login'
                      ? 'Inloggen met Google'
                      : 'Registreren met Google'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={isAnyLoading}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span>
                  {oauthLoading === 'apple'
                    ? 'Verbinden...'
                    : mode === 'login'
                      ? 'Inloggen met Apple'
                      : 'Registreren met Apple'}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-1.5 mb-3">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink-0 mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {mode === 'login' ? 'of met e-mailadres' : 'of registreer met e-mailadres'}
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Volledige Naam *
                      </label>
                      <div className="relative">
                        <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Bijv. Sander Martinali"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Specialisme / Beroep
                      </label>
                      <div className="relative">
                        <Briefcase className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={profession}
                          onChange={(e) => setProfession(e.target.value)}
                          placeholder="Personal Trainer & Coach"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefoonnummer
                      </label>
                      <div className="relative">
                        <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+31 6 12345678"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Standaard Uurtarief (€)
                      </label>
                      <div className="relative">
                        <Coins className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                          placeholder="65"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mailadres *
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="naam@voorbeeld.nl"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div className={mode === 'register' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wachtwoord *
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Min. 6 tekens' : '••••••••'}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bevestig wachtwoord *
                    </label>
                    <div className="relative">
                      <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Herhaal wachtwoord"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isAnyLoading}
                className="w-full mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span>Bezig met {mode === 'login' ? 'inloggen...' : 'registreren...'}</span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' ? 'Inloggen' : 'Trainer Account Registreren'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
              {mode === 'login' ? (
                <>
                  Nog geen trainer-account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-bold text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline cursor-pointer"
                  >
                    Registreer je hier
                  </button>
                </>
              ) : (
                <>
                  Heb je al een account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-bold text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline cursor-pointer"
                  >
                    Log hier in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500">
        ProBooking • Gekoppeld aan Firebase Firestore & Authentication (probooking75)
      </footer>
    </div>
  );
};
