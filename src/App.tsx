import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Wallet, 
  History, 
  Settings, 
  Plus, 
  Gamepad2, 
  CreditCard, 
  Bitcoin, 
  Landmark,
  Shield,
  Search,
  LayoutDashboard,
  Bell,
  User as UserIcon,
  ChevronRight,
  Target,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { auth, db } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';

// Error Handler
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: any[];
  }
}

function handleFirestoreError(err: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null) {
  if (err.code === 'permission-denied') {
    const errorInfo: FirestoreErrorInfo = {
      error: err.message,
      operationType: operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid || 'anonymous',
        email: auth.currentUser?.email || '',
        emailVerified: auth.currentUser?.emailVerified || false,
        isAnonymous: auth.currentUser?.isAnonymous || false,
        providerInfo: auth.currentUser?.providerData.map(p => ({
          providerId: p.providerId,
          displayName: p.displayName,
          email: p.email
        })) || []
      }
    };
    throw new Error(JSON.stringify(errorInfo));
  }
  throw err;
}

// Types
interface MarketOption {
  id: string;
  label: string;
  percentage: number;
  pool: number;
  sharePrice: number;
}

interface FightEvent {
  id: string;
  title: string;
  category: string;
  promoter: string;
  pool: number;
  bets: number;
  fee: number;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  fighters: string[];
  options: MarketOption[];
  date: any;
}

interface UserProfile {
  balance: number;
  isAdmin: boolean;
  displayName: string;
}

interface BetRecord {
  id: string;
  eventId: string;
  selection: string;
  amount: number;
  status: string;
  createdAt: any;
}

const MOCK_EVENTS: FightEvent[] = [
  {
    id: '1',
    title: 'Omega El Fuerte vs Gallo The Producer',
    category: 'Boxeo/MMA',
    promoter: 'Alofoke K.O',
    pool: 12500,
    bets: 142,
    fee: 5,
    status: 'upcoming',
    date: '2026-05-20',
    fighters: ['f1', 'f2'],
    options: [
      { id: 'o1', label: 'Omega El Fuerte Gana', percentage: 50, pool: 6250, sharePrice: 2.00 },
      { id: 'o2', label: 'Empate', percentage: 20, pool: 2500, sharePrice: 5.00 },
      { id: 'o3', label: 'Gallo The Producer Gana', percentage: 30, pool: 3750, sharePrice: 3.33 }
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('mercado');
  const [selectedEvent, setSelectedEvent] = useState<FightEvent | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userBets, setUserBets] = useState<BetRecord[]>([]);
  const [events, setEvents] = useState<FightEvent[]>(MOCK_EVENTS);
  const [loading, setLoading] = useState(true);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);

  // Admin states
  const [newFighter1, setNewFighter1] = useState('');
  const [newFighter2, setNewFighter2] = useState('');
  const [newTitle, setNewTitle] = useState('');
  
  // Payment account states (persistent in Firestore)
  const [paymentAccounts, setPaymentAccounts] = useState({
    paypal: '',
    bank: '',
    crypto: ''
  });

  useEffect(() => {
    // Sync payment accounts from global settings
    const unsub = onSnapshot(doc(db, 'settings', 'payments'), (s) => {
      if (s.exists()) setPaymentAccounts(s.data() as any);
    });
    return unsub;
  }, []);

  const updatePaymentAccounts = async () => {
    if (!profile?.isAdmin) return;
    try {
      await setDoc(doc(db, 'settings', 'payments'), paymentAccounts);
      alert('Cuentas de pago actualizadas');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const newProfile = { 
              balance: 0, 
              isAdmin: u.email === 'tecnocreditoficial@gmail.com', 
              displayName: u.displayName || 'Anon' 
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(snap.data() as UserProfile);
          }
        } catch (err) {
          console.error("Profile sync failed", err);
        }

        onSnapshot(userRef, (s) => {
          if (s.exists()) setProfile(s.data() as UserProfile);
        }, (err) => handleFirestoreError(err, 'get', `users/${u.uid}`));

        const betsQuery = query(collection(db, 'bets'), where('userId', '==', u.uid));
        onSnapshot(betsQuery, (s) => {
          const bets: BetRecord[] = [];
          s.forEach((d) => bets.push({ id: d.id, ...d.data() } as BetRecord));
          setUserBets(bets.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => handleFirestoreError(err, 'list', 'bets'));
      } else {
        setProfile(null);
        setUserBets([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'events'), (s) => {
      if (s.empty) {
        setEvents(MOCK_EVENTS);
        setSelectedEvent(MOCK_EVENTS[0]);
      } else {
        const evs: FightEvent[] = [];
        s.forEach(d => evs.push({ id: d.id, ...d.data() } as FightEvent));
        setEvents(evs);
        if (evs.length > 0) setSelectedEvent(evs[0]);
      }
    }, (err) => handleFirestoreError(err, 'list', 'events'));
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const placeBet = async () => {
    if (!user || !profile || !selectedEvent || !selectedOption) return;
    if (betAmount > profile.balance) {
      alert('Saldo insuficiente');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw "User profile not found";
        
        const currentBalance = userSnap.data().balance;
        if (currentBalance < betAmount) throw "Insufficient balance";

        // 1. Create the bet
        const betRef = doc(collection(db, 'bets'));
        transaction.set(betRef, {
          userId: user.uid,
          eventId: selectedEvent.id,
          selectionId: selectedOption.id,
          selection: selectedOption.label,
          amount: betAmount,
          odds: (100 / selectedOption.percentage).toFixed(2),
          status: 'pending',
          createdAt: serverTimestamp()
        });

        // 2. Update user balance
        transaction.update(userRef, {
          balance: currentBalance - betAmount
        });
      });
      
      setBetModalOpen(false);
      alert('Apuesta colocada con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al realizar la apuesta');
    }
  };

  const handleCreateEvent = async () => {
    if (!profile?.isAdmin) return;
    try {
      const eventData = {
        title: newTitle || `${newFighter1} vs ${newFighter2}`,
        category: 'Boxeo/MMA',
        promoter: 'Alofoke K.O',
        pool: 0,
        bets: 0,
        fee: 5,
        status: 'upcoming',
        date: new Date().toISOString().split('T')[0],
        fighters: [newFighter1, newFighter2],
        options: [
          { id: 'o1', label: `${newFighter1} Gana`, percentage: 45, pool: 0, sharePrice: 2.22 },
          { id: 'o2', label: 'Empate', percentage: 10, pool: 0, sharePrice: 10.00 },
          { id: 'o3', label: `${newFighter2} Gana`, percentage: 45, pool: 0, sharePrice: 2.22 }
        ],
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'events'), eventData);
      alert('Evento creado exitosamente');
      setNewFighter1('');
      setNewFighter2('');
      setNewTitle('');
    } catch (err) {
      handleFirestoreError(err, 'create', 'events');
    }
  };

  const handleDeposit = async (amount: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'deposit',
        amount,
        method: 'paypal',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Solicitud de depósito enviada. Un administrador verificará su pago.');
    } catch (err) {
      handleFirestoreError(err, 'create', 'transactions');
    }
  };

  const tabs = [
    { id: 'panel', label: 'PANEL', icon: LayoutDashboard },
    { id: 'mercado', label: 'MERCADO PREDICCIONES', icon: Target },
    { id: 'financiar', label: 'FINANCIAR', icon: Wallet },
    { id: 'admin', label: 'ADMINISTRACIÓN', icon: Settings, adminOnly: true },
    { id: 'perfil', label: 'PERFIL', icon: UserIcon },
  ];

  if (loading) return (
    <div className="min-h-screen bg-ko-bg flex items-center justify-center">
      <div className="w-12 h-12 border-2 border-ko-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-ko-bg text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b border-ko-border ko-glass px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('mercado')}>
            <div className="w-8 h-8 bg-ko-accent rounded flex items-center justify-center font-extrabold text-xl italic transition-transform group-hover:scale-110">
              A
            </div>
            <h1 className="text-xl font-extrabold tracking-tighter uppercase">ALOFOKE <span className="text-ko-accent">K.O</span></h1>
          </div>
          
          <nav className="hidden md:flex gap-6 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            {tabs.filter(t => !t.adminOnly || profile?.isAdmin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "transition-all flex items-center gap-2",
                  activeTab === tab.id 
                    ? "text-white" 
                    : "hover:text-zinc-200"
                )}
              >
                {tab.id === 'admin' ? 'ADMIN' : tab.label.split(' ')[0]}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Balanza</span>
                <span className="mono text-green-500 font-bold tracking-tight text-sm">${(profile?.balance || 0).toLocaleString()} <span className="text-[10px] text-zinc-500">USD</span></span>
              </div>
              <div className="h-8 w-px bg-ko-border" />
              <button onClick={handleLogout} className="p-2 hover:bg-ko-accent/10 rounded-full transition-colors group">
                <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-ko-accent" />
              </button>
              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-ko-border overflow-hidden p-[1px]">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <UserIcon className="w-full h-full text-zinc-500 p-1" />
                )}
              </div>
            </>
          ) : (
            <button 
              onClick={handleLogin}
              className="px-5 py-2 bg-white text-black font-extrabold text-[10px] tracking-widest rounded transition-all hover:bg-zinc-200"
            >
              CONECTAR
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto w-full p-4 lg:p-6">
        {!user && (
          <div className="h-[calc(100vh-200px)] flex items-center justify-center">
            <div className="max-w-md w-full p-12 text-center ko-card bg-zinc-900/50 backdrop-blur-sm space-y-6">
              <div className="w-16 h-16 bg-ko-accent rounded-xl flex items-center justify-center mx-auto shadow-2xl">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold italic uppercase leading-none">ALOFOKE <span className="text-ko-accent">K.O</span></h2>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Acceso Restringido • Nodo de Mercado Oficial</p>
              </div>
              <button 
                onClick={handleLogin}
                className="w-full py-4 bg-ko-accent text-white font-extrabold tracking-widest rounded hover:brightness-110 active:scale-95 transition-all uppercase text-xs"
              >
                Conectar con Google
              </button>
            </div>
          </div>
        )}

        {user && activeTab === 'mercado' && (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] gap-6">
            {/* Left Sidebar - Mis Apuestas */}
            <aside className="space-y-6 hidden lg:block">
              <div className="stat-box">
                <div className="text-[10px] uppercase text-zinc-500 mb-1 font-bold tracking-widest">Historial Saldo</div>
                <div className="text-2xl font-bold mono text-zinc-100">${(profile?.balance || 0).toLocaleString()}</div>
                <div className="text-[10px] text-green-400 font-bold uppercase tracking-tight">+12% este mes</div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-[11px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-2">
                  <Target className="w-3 h-3" /> Mis Apuestas
                </h3>
                <div className="space-y-2">
                  {userBets.length > 0 ? userBets.slice(0, 5).map((bet) => (
                    <div key={bet.id} className="p-3 rounded bg-zinc-900 border-l-2 border-ko-accent/50 text-[11px] font-medium transition-colors hover:bg-zinc-800">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="truncate uppercase">{bet.selection}</span>
                        <span className="text-zinc-500 mono">${bet.amount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase tracking-widest">
                        <span>{bet.createdAt?.toDate().toLocaleDateString()}</span>
                        <span className={cn(bet.status === 'pending' ? 'text-zinc-400' : 'text-green-500')}>{bet.status}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-[10px] text-zinc-600 uppercase font-bold border border-zinc-800 rounded bg-zinc-900/30 italic">
                      Sin actividad
                    </div>
                  )}
                </div>
                <button className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors text-left px-1 mt-1">Ver todo el historial ↗</button>
              </div>
            </aside>

            {/* Main Content - Mercados */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-extrabold italic uppercase tracking-tighter">CARTELERA: <span className="text-ko-accent">MAIN EVENT</span></h2>
                <div className="flex gap-2">
                  <span className="bg-zinc-900 px-3 py-1 rounded text-[10px] font-bold uppercase border border-ko-border text-green-400">VIVO</span>
                  <span className="bg-zinc-900 px-3 py-1 rounded text-[10px] font-bold uppercase border border-ko-border text-zinc-500">PRÓXIMOS</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectedEvent && (
                  <motion.div 
                    key={selectedEvent.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ko-card overflow-hidden"
                  >
                    <div className="p-5 border-b border-ko-border flex justify-between items-center bg-zinc-900/30">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-4 bg-ko-accent rounded-full" />
                        <div>
                          <h3 className="text-lg font-extrabold uppercase leading-none tracking-tight">{selectedEvent.title}</h3>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{selectedEvent.category} • {selectedEvent.promoter}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase">Pool Total</div>
                        <div className="mono text-zinc-100 font-bold">${(selectedEvent.pool || 0).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedEvent.options.map((option) => (
                        <div key={option.id} className="group relative">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase truncate pr-2">{option.label}</span>
                            <span className="mono text-zinc-500 text-[10px]">{option.percentage.toFixed(0)}%</span>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedOption(option);
                              setBetAmount(10);
                              setBetModalOpen(true);
                            }}
                            className="ko-btn-outline w-full p-4 rounded flex flex-col items-center gap-1 group-hover:border-ko-accent"
                          >
                            <span className="mono font-bold text-lg text-zinc-100 italic">x{(100/option.percentage).toFixed(2)}</span>
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-ko-accent">Cuota fija</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-6 py-4 bg-zinc-900/50 border-t border-ko-border flex flex-wrap gap-6 items-center">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Cierre</span>
                        <span className="mono text-xs font-bold text-zinc-400 italic">21:00 GMT-5</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Apuestas</span>
                        <span className="mono text-xs font-bold text-zinc-400 italic">{selectedEvent.bets}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Fee</span>
                        <span className="mono text-xs font-bold text-zinc-400 italic">{selectedEvent.fee}%</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {events.filter(e => e.id !== (selectedEvent?.id || '')).map(event => (
                  <div key={event.id} onClick={() => setSelectedEvent(event)} className="p-4 ko-card bg-zinc-900/30 flex justify-between items-center cursor-pointer group">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full group-hover:bg-ko-accent transition-colors" /> {event.category}
                      </span>
                      <h4 className="text-sm font-extrabold uppercase tracking-tight group-hover:text-ko-accent transition-colors">{event.title}</h4>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar - Bet Slip & Payments */}
            <aside className="space-y-6">
              <div className="bet-slip h-full ko-card bg-zinc-900/50 backdrop-blur-md sticky top-24">
                <h3 className="text-xs font-bold uppercase tracking-widest border-b border-ko-border pb-4 flex items-center gap-2">
                  <Plus className="w-3 h-3 text-ko-accent" /> Cupón de Apuesta
                </h3>
                
                <div className="space-y-4 pt-2">
                  {selectedEvent && (
                    <div className="p-4 rounded bg-zinc-950 border border-ko-border relative group">
                      <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Mercado Seleccionado</div>
                      <div className="font-extrabold text-sm mb-3 uppercase tracking-tight">{selectedEvent.title}</div>
                      <div className="flex justify-between items-center gap-4">
                        <div className="mono text-xs text-ko-accent font-bold italic">Cuota: 1.45</div>
                        <input 
                          type="text" 
                          placeholder="Monto $" 
                          className="w-24 bg-zinc-900 border border-ko-border rounded p-2 text-right text-sm mono focus:border-ko-accent outline-none"
                        />
                      </div>
                      <div className="absolute -top-2 -right-2 bg-zinc-800 border border-ko-border w-5 h-5 rounded-full flex items-center justify-center text-[10px] cursor-pointer hover:bg-ko-accent transition-colors">×</div>
                    </div>
                  )}

                  <div className="mt-6 space-y-2 text-[11px] font-medium p-1">
                    <div className="flex justify-between text-zinc-500">
                      <span>Monto de apuesta</span>
                      <span className="mono">$0.00</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Comisión de red (5%)</span>
                      <span className="mono">$0.00</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm border-t border-ko-border pt-3 mt-3">
                      <span className="uppercase tracking-tight">Retorno Potencial</span>
                      <span className="text-green-500 mono italic font-bold leading-none">$0.00</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 py-4 border-t border-ko-border mt-auto">
                  <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Método de Validación</h4>
                  <div className="flex flex-wrap gap-2">
                    <div className="payment-pill group" onClick={() => handleDeposit(50)}>
                      <span className="group-hover:scale-125 transition-transform">🅿️</span>
                      <span className="font-bold tracking-tight">PayPal</span>
                    </div>
                    <div className="payment-pill group" onClick={() => handleDeposit(200)}>
                      <span className="group-hover:scale-125 transition-transform text-orange-500">₿</span>
                      <span className="font-bold tracking-tight">Crypto</span>
                    </div>
                    <div className="payment-pill group" onClick={() => handleDeposit(100)}>
                      <span className="group-hover:scale-125 transition-transform text-blue-400">🏦</span>
                      <span className="font-bold tracking-tight">Banco</span>
                    </div>
                  </div>
                </div>

                <button className="w-full py-4 bg-white text-black font-extrabold uppercase text-[10px] tracking-widest shadow-xl hover:bg-zinc-200 transition-all rounded">
                  Confirmar Operación
                </button>
              </div>
            </aside>
          </div>
        )}

        {user && activeTab === 'financiar' && (
          <div className="max-w-4xl mx-auto space-y-8 py-12">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-extrabold italic uppercase tracking-tighter">FINANCIAR <span className="text-ko-accent">CAPITAL</span></h2>
              <div className="h-1 w-20 bg-ko-accent mx-auto" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Inyección de liquidez Nodo KO-Market</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: 'paypal', label: 'PayPal Instant', icon: CreditCard, amount: 50, detail: 'Validación inmediata' },
                { id: 'bank', label: 'Bank SEPA', icon: Landmark, amount: 100, detail: '1-2 Horas red' },
                { id: 'crypto', label: 'Blockchain L2', icon: Bitcoin, amount: 200, detail: 'Confirmación minera' }
              ].map((item) => (
                <div key={item.id} onClick={() => handleDeposit(item.amount)} className="p-8 ko-card bg-zinc-900 flex flex-col items-center gap-6 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group">
                  <div className="w-14 h-14 bg-zinc-950 rounded flex items-center justify-center border border-ko-border group-hover:border-ko-accent transition-colors">
                    <item.icon className="w-6 h-6 group-hover:text-ko-accent transition-colors" />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-extrabold tracking-widest uppercase">{item.label}</span>
                    <div className="mt-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{item.detail}</div>
                  </div>
                  <div className="w-full pt-4 border-t border-ko-border mt-2 font-black mono text-zinc-100 flex justify-center items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> ${item.amount} <span className="text-[10px] text-zinc-600">USD</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user && activeTab === 'admin' && profile?.isAdmin && (
          <div className="max-w-6xl mx-auto space-y-8 py-10">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold italic uppercase tracking-tighter">CENTRO DE <span className="text-ko-accent">COMANDO</span></h2>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Gestión de Mercados y Liquidación</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* ... (Nueva Cartelera unchanged) */}
                
                <div className="ko-card p-8 bg-zinc-900/50 space-y-6 border-ko-accent/30 shadow-[0_0_30px_rgba(255,59,48,0.05)]">
                  <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-ko-accent border-b border-ko-border pb-4">Nueva Cartelera</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Peleador 1</label>
                      <input 
                        value={newFighter1}
                        onChange={(e) => setNewFighter1(e.target.value)}
                        placeholder="Campeón" 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-sm focus:border-ko-accent transition-all mono outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Peleador 2</label>
                      <input 
                        value={newFighter2}
                        onChange={(e) => setNewFighter2(e.target.value)}
                        placeholder="Retador" 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-sm focus:border-ko-accent transition-all mono outline-none"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Título del Evento (Opcional)</label>
                      <input 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Ej: Main Event • Santo Domingo" 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-sm focus:border-ko-accent transition-all mono outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleCreateEvent}
                    className="w-full py-4 bg-ko-accent text-white font-extrabold uppercase text-xs tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl"
                  >
                    Lanzar Mercado en Vivo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.map((event, i) => (
                    <div key={i} className="ko-card bg-zinc-900/50 p-6 space-y-4 group border-l-2 border-l-zinc-800 hover:border-l-ko-accent transition-all">
                      <div className="flex justify-between items-start">
                        <div className="text-zinc-600 group-hover:text-ko-accent transition-colors">
                          <Trophy className="w-5 h-5" />
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold tracking-widest px-2 py-1 rounded uppercase border font-mono italic",
                          event.status === 'upcoming' ? "bg-zinc-950 text-zinc-400 border-zinc-800" : "bg-ko-accent/10 text-ko-accent border-ko-accent/20"
                        )}>
                          {event.status}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base uppercase tracking-tight group-hover:text-ko-accent transition-colors">{event.title}</h3>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{event.category}</p>
                      </div>
                      <div className="pt-4 border-t border-ko-border flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Liquid Pool</span>
                          <span className="text-sm font-bold mono text-zinc-200 tracking-tighter">${(event.pool || 0).toLocaleString()}</span>
                        </div>
                        <button className="p-2 bg-zinc-950 border border-ko-border rounded hover:border-ko-accent transition-colors">
                          <Settings className="w-4 h-4 text-zinc-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Admin: Configuración de Pagos */}
              <div className="space-y-6">
                <div className="ko-card p-6 bg-zinc-900/50 space-y-6 border-zinc-800">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 border-b border-ko-border pb-3 flex items-center gap-2">
                    <Shield className="w-3 h-3 text-ko-accent" /> CONFIGURACIÓN NODO
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-zinc-500 uppercase">PayPal de Recaudación</label>
                      <input 
                        value={paymentAccounts.paypal}
                        onChange={(e) => setPaymentAccounts(prev => ({ ...prev, paypal: e.target.value }))}
                        placeholder="email@paypal.com" 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-xs focus:border-ko-accent transition-all mono outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-zinc-500 uppercase">Cuenta Bancaria (Instrucciones)</label>
                      <textarea 
                        value={paymentAccounts.bank}
                        onChange={(e) => setPaymentAccounts(prev => ({ ...prev, bank: e.target.value }))}
                        placeholder="Banco: XYZ, Cuenta: 000..." 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-xs focus:border-ko-accent transition-all mono outline-none h-20 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-zinc-500 uppercase">Wallet Crypto (BTC/USDT)</label>
                      <input 
                        value={paymentAccounts.crypto}
                        onChange={(e) => setPaymentAccounts(prev => ({ ...prev, crypto: e.target.value }))}
                        placeholder="0x..." 
                        className="w-full bg-zinc-950 border border-ko-border p-3 text-xs focus:border-ko-accent transition-all mono outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={updatePaymentAccounts}
                    className="w-full py-3 bg-zinc-800 text-white font-extrabold uppercase text-[9px] tracking-widest hover:bg-zinc-700 transition-all rounded border border-zinc-700"
                  >
                    Guardar Configuración
                  </button>

                  <div className="p-4 bg-ko-accent/5 border border-ko-accent/20 rounded space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-bold text-zinc-500 uppercase">Comisión de la Casa</span>
                      <span className="text-ko-accent font-black mono text-xs">5.00%</span>
                    </div>
                    <p className="text-[8px] text-zinc-600 uppercase leading-relaxed font-bold">La casa retiene automáticamente el 5% de cada pozo para mantenimiento de nodo y comisiones de red.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Betting Modal */}
      <AnimatePresence>
        {betModalOpen && selectedOption && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-sm w-full ko-card bg-zinc-900 overflow-hidden shadow-2xl border-ko-accent/20"
            >
              <div className="p-1 bg-ko-accent shadow-[0_0_20px_rgba(255,59,48,0.3)]" />
              <div className="p-8 space-y-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-extrabold italic uppercase italic border-b border-ko-border pb-3">Ticket de <span className="text-ko-accent">Apuesta</span></h3>
                  <div className="flex flex-col pt-2">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Selección</span>
                    <span className="text-zinc-100 font-bold uppercase text-sm">{selectedOption.label}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex justify-between">
                      <span>Monto de apuesta</span>
                      <span className="text-ko-accent">Balance: ${profile?.balance.toLocaleString()}</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-500">$</span>
                      <input 
                        type="number"
                        value={betAmount}
                        onChange={(e) => setBetAmount(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-ko-border p-4 pl-8 text-xl font-bold mono focus:border-ko-accent transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950 p-4 border border-ko-border">
                      <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">Cuota</span>
                      <span className="mono text-xl font-bold italic">x{(100/selectedOption.percentage).toFixed(2)}</span>
                    </div>
                    <div className="bg-zinc-950 p-4 border border-ko-border">
                      <span className="text-[8px] font-bold text-zinc-500 uppercase block mb-1">Retorno</span>
                      <span className="mono text-xl font-bold text-green-500 italic">${(betAmount * (100/selectedOption.percentage)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setBetModalOpen(false)}
                    className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold uppercase text-[10px] tracking-widest hover:bg-zinc-700 transition-all rounded"
                  >
                    Cancelar
                  </button>
                  <motion.button 
                    onClick={placeBet}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    className="flex-[2] py-4 bg-ko-accent text-white font-extrabold uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-ko-accent/20 rounded"
                  >
                    Confirmar Apuesta
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-ko-border h-16 ko-glass flex items-center px-6 justify-between">
        <div className="flex gap-8 items-center text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" /> DB NODE: CONNECTED
          </span>
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full" /> SYNCING LIVE ODDS
          </span>
        </div>
        <div className="flex gap-4 text-zinc-600 text-[10px] font-bold uppercase tracking-tighter italic">
          <p>© 2026 ALOFOKE K.O PREDICTIONS • VERIFIED V2.7.5 • JUEGA CON RESPONSABILIDAD</p>
        </div>
      </footer>
    </div>
  );
}
