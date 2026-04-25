import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Wallet, 
  Settings, 
  Plus, 
  Bitcoin, 
  Target,
  LogOut,
  ChevronRight,
  Activity,
  Cpu,
  Crosshair,
  LayoutDashboard,
  User as UserIcon,
  Shield,
  CreditCard,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';

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
  bets_count: number;
  fee: number;
  status: 'upcoming' | 'live' | 'finished' | 'cancelled';
  fighters: string[];
  options: MarketOption[];
  date: any;
  created_at?: string;
}

interface UserProfile {
  id: string;
  balance: number;
  is_admin: boolean;
  display_name: string;
}

interface BetRecord {
  id: string;
  event_id: string;
  selection: string;
  amount: number;
  status: string;
  created_at: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('mercado');
  const [selectedEvent, setSelectedEvent] = useState<FightEvent | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userBets, setUserBets] = useState<BetRecord[]>([]);
  const [events, setEvents] = useState<FightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betAmount, setBetAmount] = useState(10);
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);

  // Admin states
  const [newFighter1, setNewFighter1] = useState('');
  const [newFighter2, setNewFighter2] = useState('');
  const [newTitle, setNewTitle] = useState('');
  
  // Payment account states
  const [paymentAccounts, setPaymentAccounts] = useState({
    paypal: '',
    bank: '',
    crypto: ''
  });

  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (data) {
      setEvents(data);
      if (!selectedEvent && data.length > 0) setSelectedEvent(data[0]);
    }
  };

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', uid).single();
    if (data) setProfile(data);
  };

  const fetchBets = async (uid: string) => {
    const { data } = await supabase.from('bets').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (data) setUserBets(data);
  };

  const fetchPendingTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*, users(email, display_name)')
      .eq('status', 'pending');
    if (data) setPendingTransactions(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('data').eq('id', 'payments').single();
    if (data) setPaymentAccounts(data.data);
  };

  useEffect(() => {
    loadSettings();
    fetchEvents();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
        await fetchBets(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setUserBets([]);
      }
      setLoading(false);
    });

    const eventsSub = supabase.channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      }).subscribe();

    const profileSub = supabase.channel('public:users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        if (payload.new.id === user?.id) setProfile(payload.new as UserProfile);
      }).subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(eventsSub);
      supabase.removeChannel(profileSub);
    };
  }, [user?.id]);

  useEffect(() => {
    if (profile?.is_admin) {
      fetchPendingTransactions();
    }
  }, [profile?.is_admin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ 
          email: authEmail, 
          password: authPass,
          options: {
            data: { full_name: authEmail.split('@')[0] }
          }
        });
        if (error) throw error;
        alert('REGISTRO EXITOSO. YA PUEDES INICIAR SESIÓN.');
        setAuthMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass });
        if (error) throw error;
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const placeBet = async () => {
    if (!user || !profile || !selectedEvent || !selectedOption) return;
    if (betAmount > profile.balance) {
      alert('SALDO INSUFICIENTE. RECARGA TUS FONDOS.');
      return;
    }

    try {
      const odds = (100 / selectedOption.percentage).toFixed(2);
      
      const { error: betError } = await supabase.from('bets').insert({
        user_id: user.id,
        event_id: selectedEvent.id,
        selection_id: selectedOption.id,
        selection: selectedOption.label,
        amount: betAmount,
        odds: Number(odds),
        status: 'pending'
      });

      if (betError) throw betError;

      const { error: balanceError } = await supabase.from('users').update({
        balance: profile.balance - betAmount
      }).eq('id', user.id);

      if (balanceError) throw balanceError;

      setBetModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('ERROR EN LA TRANSACCIÓN.');
    }
  };

  const handleDeposit = async (amount: number, method: string) => {
    if (!user) return;
    try {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'deposit',
        amount,
        method,
        status: 'pending'
      });
      alert('NOTIFICACIÓN ENVIADA. ESPERANDO APROBACIÓN.');
      if (profile?.is_admin) fetchPendingTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveTransaction = async (txId: string, userId: string, amount: number) => {
    try {
      const { data: userProfile } = await supabase.from('users').select('balance').eq('id', userId).single();
      const newBalance = (userProfile?.balance || 0) + amount;
      
      const { error: upError } = await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
      if (upError) throw upError;

      const { error: txError } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', txId);
      if (txError) throw txError;
      
      fetchPendingTransactions();
      alert('TRANSACCIÓN APROBADA.');
    } catch (err) {
      console.error(err);
      alert('ERROR AL APROBAR.');
    }
  };

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<string>('PAYPAL');

  const tabs = [
    { id: 'panel', label: 'SYS_PANEL', icon: LayoutDashboard },
    { id: 'mercado', label: 'MERCADO_PRED', icon: Target },
    { id: 'financiar', label: 'FONDOS', icon: Wallet },
    { id: 'admin', label: 'ADMIN_NODE', icon: Settings, adminOnly: true },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#030305] flex items-center justify-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 border-y-2 border-ko-cyan rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-x-2 border-ko-accent rounded-full animate-[spin_2s_reverse_infinite]"></div>
        <div className="text-ko-cyan font-black text-xs italic tracking-widest">SYS_INI</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      <div className="cyber-scanline" />

      {/* Cyber Header */}
      <header className="sticky top-0 z-50 h-20 border-b border-ko-cyan/20 ko-glass px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab('mercado')}>
            <img src="/logo.png" alt="Alofoke K.O" className="w-16 h-16 object-contain mix-blend-screen transition-transform group-hover:scale-110" />
            <div className="flex flex-col">
              <span className="text-[8px] text-ko-cyan uppercase tracking-[0.3em] font-mono mt-1">Neural Betting Node</span>
            </div>
          </div>
          
          <nav className="hidden md:flex gap-6 text-xs font-black uppercase tracking-widest text-zinc-500">
            {tabs.filter(t => !t.adminOnly || profile?.is_admin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "transition-all flex items-center gap-2 h-20 border-b-2",
                  activeTab === tab.id 
                    ? "text-ko-cyan border-ko-cyan" 
                    : "border-transparent hover:text-zinc-300 hover:border-zinc-700"
                )}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Saldo Activo</span>
                <span className="mono text-ko-cyan font-black tracking-tight text-lg shadow-black drop-shadow-md">
                  {profile?.balance.toLocaleString()} <span className="text-xs text-zinc-600">CRD</span>
                </span>
              </div>
              <div className="h-8 w-px bg-ko-cyan/20" />
              <button onClick={handleLogout} className="p-2 hover:bg-ko-accent/20 rounded transition-colors group border border-transparent hover:border-ko-accent/30">
                <LogOut className="w-4 h-4 text-zinc-500 group-hover:text-ko-accent" />
              </button>
              <div className="flex items-center gap-3 bg-black/50 border border-white/5 p-1 pr-3" style={{clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'}}>
                <div className="w-8 h-8 bg-zinc-900 border border-ko-cyan/50 overflow-hidden" style={{clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'}}>
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-full h-full text-zinc-500 p-1" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{profile?.display_name?.split(' ')[0] || 'GUEST'}</span>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1500px] mx-auto w-full p-6 lg:p-8 relative z-10">


        {!user && (
          <div className="min-h-[80vh] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full ko-card p-10 space-y-8 relative overflow-hidden"
              style={{clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)'}}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-ko-accent/10 blur-[50px] -mr-16 -mt-16" />
              
              <div className="text-center space-y-4">
                <img src="/logo.png" alt="Alofoke K.O" className="w-32 h-32 mx-auto mix-blend-screen drop-shadow-[0_0_15px_rgba(255,42,42,0.5)]" />
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                  AUTENTICACIÓN <span className="text-ko-cyan">REQUERIDA</span>
                </h2>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Protocolo de Acceso Seguro v4.0</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">EMAIL_NODE</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-black/50 border border-ko-cyan/20 p-4 text-white mono focus:border-ko-cyan outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">ACCESS_CODE</label>
                  <input 
                    type="password" 
                    required
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    className="w-full bg-black/50 border border-ko-cyan/20 p-4 text-white mono focus:border-ko-cyan outline-none transition-all"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="ko-btn-accent w-full py-4 text-[10px] flex items-center justify-center gap-3 font-black uppercase"
                >
                  <Shield className="w-4 h-4" /> 
                  {authMode === 'login' ? 'INICIAR_SESIÓN' : 'REGISTRAR_NODO'}
                </button>
              </form>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-[10px] font-mono text-ko-cyan uppercase tracking-widest hover:text-white transition-colors"
                >
                  {authMode === 'login' ? '¿No tienes cuenta? REGISTRARSE' : '¿Ya tienes cuenta? LOGIN'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {user && activeTab === 'panel' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="ko-card p-6 border-l-4 border-l-ko-cyan">
                <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest mb-2">BALANCE_TOTAL</div>
                <div className="text-3xl font-black text-white mono">{profile?.balance.toLocaleString()} <span className="text-xs text-zinc-600">CRD</span></div>
              </div>
              <div className="ko-card p-6 border-l-4 border-l-ko-accent">
                <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest mb-2">OPERACIONES_ACTIVAS</div>
                <div className="text-3xl font-black text-white mono">{userBets.filter(b => b.status === 'pending').length}</div>
              </div>
              <div className="ko-card p-6 border-l-4 border-l-ko-gold">
                <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest mb-2">RETORNO_TOTAL</div>
                <div className="text-3xl font-black text-white mono">0 <span className="text-xs text-zinc-600">CRD</span></div>
              </div>
              <div className="ko-card p-6 border-l-4 border-l-zinc-500">
                <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest mb-2">NIVEL_ACCESO</div>
                <div className="text-3xl font-black text-white mono">{profile?.is_admin ? 'ADMIN' : 'USER'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="ko-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                  <History className="w-4 h-4 text-ko-cyan" />
                  <h3 className="text-xs font-black uppercase tracking-widest">HISTORIAL_OPERATIVO</h3>
                </div>
                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                  {userBets.map(bet => (
                    <div key={bet.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                      <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase text-white">{bet.selection}</div>
                        <div className="text-[9px] font-mono text-zinc-500">{new Date(bet.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="mono text-sm font-bold text-ko-cyan">{bet.amount} CRD</div>
                        <div className={`text-[8px] font-black uppercase ${bet.status === 'won' ? 'text-green-500' : 'text-zinc-500'}`}>{bet.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ko-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-ko-accent" />
                  <h3 className="text-xs font-black uppercase tracking-widest">ACTIVIDAD_RECIENTE</h3>
                </div>
                <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-zinc-800" />
                  </div>
                  <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em]">Sincronizando con el nodo...</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {user && activeTab === 'financiar' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black italic uppercase text-white">INYECCIÓN DE <span className="text-ko-cyan">LIQUIDEZ</span></h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Selecciona un protocolo de transferencia para cargar tu balance</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* PayPal */}
              <div className="ko-card p-8 space-y-6 group hover:border-ko-cyan transition-all cursor-pointer">
                <div className="w-12 h-12 bg-blue-500/10 rounded flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white">PAYPAL</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Confirmación: 1-5 MIN</p>
                </div>
                <div className="p-4 bg-black border border-white/5 text-[10px] font-mono text-ko-cyan break-all">
                  {paymentAccounts.paypal}
                </div>
              </div>

              {/* Bank */}
              <div className="ko-card p-8 space-y-6 group hover:border-ko-gold transition-all cursor-pointer">
                <div className="w-12 h-12 bg-ko-gold/10 rounded flex items-center justify-center border border-ko-gold/20 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-ko-gold" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white">BANCO</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Confirmación: 2-24 HRS</p>
                </div>
                <div className="p-4 bg-black border border-white/5 text-[10px] font-mono text-zinc-300">
                  {paymentAccounts.bank}
                </div>
              </div>

              {/* Crypto */}
              <div className="ko-card p-8 space-y-6 group hover:border-ko-accent transition-all cursor-pointer">
                <div className="w-12 h-12 bg-ko-accent/10 rounded flex items-center justify-center border border-ko-accent/20 group-hover:scale-110 transition-transform">
                  <Bitcoin className="w-6 h-6 text-ko-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase text-white">CRYPTO</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mt-1">Confirmación: 1 CONF</p>
                </div>
                <div className="p-4 bg-black border border-white/5 text-[10px] font-mono text-ko-accent break-all">
                  {paymentAccounts.crypto}
                </div>
              </div>
            </div>

            <div className="ko-card p-10 bg-gradient-to-br from-zinc-950 to-black">
              <h3 className="text-xs font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-ko-accent" /> NOTIFICAR DEPÓSITO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">MONTO_A_CARGAR (CRD)</label>
                  <input 
                    type="number" 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    placeholder="Ej: 500" 
                    className="w-full bg-black border border-white/10 p-5 text-2xl font-black mono text-white focus:border-ko-cyan outline-none transition-all" 
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">MÉTODO_UTILIZADO</label>
                  <select 
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full bg-black border border-white/10 p-5 text-sm font-black uppercase text-white focus:border-ko-cyan outline-none transition-all appearance-none"
                  >
                    <option value="PAYPAL">PAYPAL</option>
                    <option value="BANCO">BANCO</option>
                    <option value="CRYPTO">CRYPTO</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={() => handleDeposit(depositAmount, depositMethod)} 
                className="ko-btn-accent w-full mt-10 py-5 text-xs font-black uppercase"
              >
                ENVIAR_COMPROBANTE_DE_PAGO
              </button>
            </div>
          </div>
        )}

        {user && activeTab === 'admin' && profile?.is_admin && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
              <h2 className="text-4xl font-black italic uppercase text-ko-accent">NODO_CONTROL <span className="text-white">ADMIN</span></h2>
              <button onClick={() => {
                const title = prompt('Título del Evento:');
                const category = prompt('Categoría (BOXEO, UFC, etc):');
                if (title && category) {
                  supabase.from('events').insert({
                    title,
                    category,
                    options: [
                      { id: '1', label: 'COMBATIENTE A', percentage: 50 },
                      { id: '2', label: 'COMBATIENTE B', percentage: 50 },
                      { id: '3', label: 'EMPATE', percentage: 10 }
                    ]
                  }).then(() => fetchEvents());
                }
              }} className="ko-btn-cyan px-6 py-3 text-[10px]">CREAR_NUEVO_EVENTO</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 ko-card overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-zinc-900 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-ko-gold" />
                  <h3 className="text-xs font-black uppercase tracking-widest">DEPÓSITOS_PENDIENTES</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {pendingTransactions.length > 0 ? pendingTransactions.map(tx => (
                    <div key={tx.id} className="p-6 flex justify-between items-center bg-black/40">
                      <div>
                        <div className="text-sm font-black text-white">{tx.users?.display_name || tx.users?.email}</div>
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">{tx.method} // {new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-2xl font-black text-ko-cyan mono">{tx.amount} CRD</div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApproveTransaction(tx.id, tx.user_id, tx.amount)} className="p-3 bg-green-500/10 border border-green-500/50 text-green-500 hover:bg-green-500 hover:text-white transition-all rounded">
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => supabase.from('transactions').update({ status: 'rejected' }).eq('id', tx.id).then(() => fetchPendingTransactions())} className="p-3 bg-ko-accent/10 border border-ko-accent/50 text-ko-accent hover:bg-ko-accent hover:text-white transition-all rounded">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="p-12 text-center text-zinc-600 font-mono text-[10px] uppercase">SIN_TRANSACCIONES_PENDIENTES</div>
                  )}
                </div>
              </div>

              <div className="ko-card p-6 space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest border-b border-white/5 pb-4">RESUMEN_SISTEMA</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase">Total Usuarios</span>
                    <span className="mono text-white">--</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase">Apuestas Activas</span>
                    <span className="mono text-white">{events.reduce((acc, e) => acc + (e.bets_count || 0), 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase">Volumen Total</span>
                    <span className="mono text-ko-gold">{events.reduce((acc, e) => acc + (e.pool || 0), 0)} CRD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user && activeTab === 'mercado' && (
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_340px] gap-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Left Sidebar */}
            <aside className="space-y-6 hidden xl:block">
              <div className="stat-box">
                <div className="text-[9px] uppercase text-ko-cyan mb-2 font-black tracking-widest flex items-center gap-2">
                  <Activity className="w-3 h-3" /> FONDOS_ACTIVOS
                </div>
                <div className="text-4xl font-black mono text-white tracking-tighter">
                  {profile?.balance.toLocaleString()}
                  <span className="text-xs text-zinc-600 ml-1">CRD</span>
                </div>
                <div className="h-1 w-full bg-zinc-900 mt-4 rounded-full overflow-hidden">
                  <div className="h-full bg-ko-cyan w-1/3 shadow-[0_0_10px_#00f0ff]" />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] uppercase font-black text-zinc-500 tracking-widest border-b border-white/5 pb-2">
                  LOG_TRANSACCIONES
                </h3>
                <div className="space-y-3">
                  {userBets.length > 0 ? userBets.slice(0, 5).map((bet) => (
                    <div key={bet.id} className="p-4 bg-zinc-950 border border-white/5 border-l-2 border-l-ko-accent text-[11px] font-bold transition-all hover:bg-zinc-900 hover:border-ko-cyan" style={{clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)'}}>
                      <div className="flex justify-between mb-2">
                        <span className="truncate uppercase text-zinc-300 pr-2">{bet.selection}</span>
                        <span className="text-ko-cyan mono">{bet.amount} CRD</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-zinc-600 uppercase tracking-widest">
                        <span>{new Date(bet.created_at).toLocaleDateString()}</span>
                        <span className={cn(bet.status === 'pending' ? 'text-zinc-500' : 'text-ko-cyan')}>{bet.status}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-8 text-center text-[9px] text-zinc-600 uppercase font-mono border border-zinc-800/50 bg-black/30">
                      NO_RECORDS_FOUND
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-ko-cyan/20 pb-4">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                  <Crosshair className="w-8 h-8 text-ko-accent" />
                  CARTELERA <span className="text-ko-cyan">GLOBAL</span>
                </h2>
                <div className="flex gap-2">
                  <span className="bg-ko-accent/10 px-4 py-1.5 rounded-sm text-[10px] font-black uppercase border border-ko-accent text-ko-accent live-glow mono tracking-widest">
                    ON_AIR
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectedEvent && (
                  <motion.div 
                    key={selectedEvent.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ko-card"
                  >
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/60 backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        <div className="w-2 h-12 bg-gradient-to-b from-ko-accent to-ko-cyan rounded shadow-[0_0_15px_rgba(0,240,255,0.4)]" />
                        <div>
                          <h3 className="text-2xl font-black uppercase leading-none tracking-tight mb-2 text-white">{selectedEvent.title}</h3>
                          <span className="text-[10px] font-mono text-ko-cyan uppercase tracking-widest bg-ko-cyan/10 px-2 py-1 rounded-sm border border-ko-cyan/20">
                            {selectedEvent.category} // {selectedEvent.promoter}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">LIQUIDITY_POOL</div>
                        <div className="mono text-2xl text-ko-gold font-black drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]">
                          {selectedEvent.pool.toLocaleString()} <span className="text-xs text-zinc-600">CRD</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-ko-accent/5 via-transparent to-transparent">
                      {selectedEvent.options?.map((option) => (
                        <div key={option.id} className="group relative">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-black text-zinc-300 uppercase truncate pr-2">{option.label}</span>
                            <span className="mono text-ko-cyan text-[10px] font-bold bg-ko-cyan/10 px-2 py-0.5 border border-ko-cyan/20">{option.percentage.toFixed(0)}%</span>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedOption(option);
                              setBetAmount(10);
                              setBetModalOpen(true);
                            }}
                            className="ko-btn-outline w-full p-6 flex flex-col items-center gap-2 group-hover:-translate-y-1 group-hover:border-ko-cyan transition-all duration-300 relative overflow-hidden"
                            style={{clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)'}}
                          >
                            <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-ko-cyan/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="mono font-black text-3xl text-white italic group-hover:text-ko-cyan transition-colors">x{(100/option.percentage).toFixed(2)}</span>
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">MULTIPLICADOR_NETO</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-8 py-4 bg-zinc-950 border-t border-ko-cyan/20 flex flex-wrap gap-12 items-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">SYS_TIMEOUT</span>
                        <span className="mono text-xs font-bold text-zinc-300">21:00 GMT-5</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">VOLUMEN_OP</span>
                        <span className="mono text-xs font-bold text-ko-cyan">{selectedEvent.bets_count}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">NETWORK_FEE</span>
                        <span className="mono text-xs font-bold text-ko-accent">{selectedEvent.fee}%</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {events.filter(e => e.id !== (selectedEvent?.id || '')).map(event => (
                  <div key={event.id} onClick={() => setSelectedEvent(event)} className="p-5 bg-zinc-950 border border-white/5 flex justify-between items-center cursor-pointer group hover:border-ko-cyan transition-all" style={{clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'}}>
                    <div className="space-y-2">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 bg-zinc-800 group-hover:bg-ko-cyan transition-colors" /> {event.category}
                      </span>
                      <h4 className="text-sm font-black uppercase tracking-tight text-zinc-400 group-hover:text-white transition-colors">{event.title}</h4>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-ko-cyan transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar - Bet Slip */}
            <aside className="space-y-6">
              <div className="ko-card bg-black/60 backdrop-blur-xl sticky top-28 flex flex-col h-auto min-h-[500px]">
                <div className="p-6 border-b border-ko-cyan/20">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-ko-cyan">
                    <Crosshair className="w-4 h-4" /> TERMINAL_OP
                  </h3>
                </div>
                
                <div className="p-6 flex-1">
                  {selectedEvent ? (
                    <div className="space-y-6">
                      <div className="p-5 bg-zinc-950 border border-ko-accent/30 relative group" style={{clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'}}>
                        <div className="text-[9px] text-zinc-500 uppercase font-mono tracking-widest mb-2">TARGET_LOCKED</div>
                        <div className="font-black text-sm mb-4 uppercase tracking-tight text-white">{selectedEvent.title}</div>
                        <div className="flex justify-between items-center pt-3 border-t border-white/5">
                          <div className="mono text-xs text-zinc-400">STATUS: <span className="text-ko-accent font-black">AWAITING_INPUT</span></div>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs font-bold p-2">
                        <div className="flex justify-between text-zinc-500">
                          <span className="uppercase text-[9px] tracking-widest">NETWORK_FEE ({selectedEvent.fee}%)</span>
                          <span className="mono">AUTO</span>
                        </div>
                        <div className="flex justify-between font-black text-sm border-t border-ko-cyan/20 pt-4 mt-4 text-white">
                          <span className="uppercase tracking-widest text-[10px] text-ko-cyan">RETORNO_CALC</span>
                          <span className="text-ko-gold mono text-lg drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">--- CRD</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center p-8">
                      <div className="space-y-4">
                        <div className="w-16 h-16 border border-zinc-800 rounded-full flex items-center justify-center mx-auto">
                          <Target className="w-6 h-6 text-zinc-700" />
                        </div>
                        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">AWAITING_SELECTION...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-zinc-950 border-t border-white/5">
                  <h4 className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-4">INYECCIÓN_RAPIDA</h4>
                  <div className="flex gap-2 mb-6">
                    <div className="payment-pill flex-1 justify-center" onClick={() => handleDeposit(100)}>
                      100 CRD
                    </div>
                    <div className="payment-pill flex-1 justify-center border-ko-cyan/30 text-ko-cyan" onClick={() => handleDeposit(500)}>
                      500 CRD
                    </div>
                  </div>
                  <button className="ko-btn-accent w-full py-4 text-[10px] opacity-50 cursor-not-allowed">
                    EJECUTAR_OP
                  </button>
                </div>
              </div>
            </aside>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 ko-glass"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-zinc-950 border border-ko-cyan/50 shadow-[0_0_40px_rgba(0,240,255,0.15)] relative overflow-hidden"
              style={{clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)'}}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ko-cyan via-ko-accent to-ko-cyan" />
              <div className="p-8 space-y-8 relative z-10">
                <div className="flex justify-between items-start border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-2xl font-black italic uppercase text-white">CONFIRMAR <span className="text-ko-cyan">OP</span></h3>
                    <p className="text-[10px] text-zinc-500 font-mono tracking-widest mt-1">SINDICATO K.O // TX_NODE</p>
                  </div>
                  <div className="w-8 h-8 border border-ko-accent text-ko-accent flex items-center justify-center font-bold text-xs">!</div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex justify-between">
                      <span>MONTO_CRD</span>
                      <span className="text-ko-cyan">FONDOS: {profile?.balance.toLocaleString()}</span>
                    </label>
                    <input 
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="w-full bg-black border border-ko-cyan/30 p-5 text-3xl font-black mono text-ko-cyan focus:border-ko-cyan focus:shadow-[0_0_15px_rgba(0,240,255,0.2)] outline-none transition-all"
                      style={{clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'}}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black p-5 border border-white/5" style={{clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)'}}>
                      <span className="text-[9px] font-mono text-zinc-500 uppercase block mb-2">MULTIPLICADOR</span>
                      <span className="mono text-2xl font-black italic text-white">x{(100/selectedOption.percentage).toFixed(2)}</span>
                    </div>
                    <div className="bg-ko-accent/10 p-5 border border-ko-accent/30" style={{clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'}}>
                      <span className="text-[9px] font-mono text-ko-accent uppercase block mb-2">PROFIT_EST</span>
                      <span className="mono text-2xl font-black text-white italic drop-shadow-[0_0_5px_rgba(255,42,42,0.8)]">{(betAmount * (100/selectedOption.percentage)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setBetModalOpen(false)}
                    className="ko-btn-cyan flex-1 py-4 text-[10px]"
                  >
                    ABORTAR
                  </button>
                  <button 
                    onClick={placeBet}
                    className="ko-btn-accent flex-[2] py-4 text-[10px]"
                  >
                    CONFIRMAR_FIRMA
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
