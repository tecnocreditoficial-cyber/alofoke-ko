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
  image_url?: string;
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
  const [newCategory, setNewCategory] = useState('BOXEO');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDate, setNewDate] = useState('');
  
  // Payment account states
  const [paymentAccounts, setPaymentAccounts] = useState({
    paypal: { value: '', active: true },
    bank: { value: '', active: true },
    crypto: { value: '', active: true }
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
    if (data && data.data) {
      const dbData = data.data;
      // Convert old string format to new object format if necessary
      const formattedData = {
        paypal: typeof dbData.paypal === 'string' ? { value: dbData.paypal, active: true } : (dbData.paypal || { value: '', active: true }),
        bank: typeof dbData.bank === 'string' ? { value: dbData.bank, active: true } : (dbData.bank || { value: '', active: true }),
        crypto: typeof dbData.crypto === 'string' ? { value: dbData.crypto, active: true } : (dbData.crypto || { value: '', active: true })
      };
      setPaymentAccounts(formattedData);
    }
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
    if (betAmount <= 0) {
      alert('INGRESA UN MONTO VÁLIDO.');
      return;
    }
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

      // Deduct from user balance
      const { error: balanceError } = await supabase.from('users').update({
        balance: profile.balance - betAmount
      }).eq('id', user.id);

      if (balanceError) throw balanceError;

      // Update event pool & bets count
      await supabase.from('events').update({
        pool: (selectedEvent.pool || 0) + betAmount,
        bets_count: (selectedEvent.bets_count || 0) + 1
      }).eq('id', selectedEvent.id);

      // Refresh data
      await fetchProfile(user.id);
      await fetchBets(user.id);
      await fetchEvents();
      
      setSelectedOption(null);
      setBetModalOpen(false);
      alert('¡APUESTA REGISTRADA CON ÉXITO!');
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
    { id: 'panel', label: 'PANEL', icon: LayoutDashboard },
    { id: 'mercado', label: 'MERCADO', icon: Target },
    { id: 'financiar', label: 'FINANCIAR', icon: Wallet },
    { id: 'admin', label: 'ADMIN', icon: Settings, adminOnly: true },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 border-y-2 border-[#ff2a2a] rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-x-2 border-white rounded-full animate-[spin_2s_reverse_infinite]"></div>
        <div className="text-white font-black text-xs italic tracking-widest">ALOFOKE</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      {/* Header Alofoke K.O */}
      <header className="sticky top-0 z-50 h-20 border-b border-white/5 bg-[#0a0a0a] px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('mercado')}>
            <div className="w-8 h-8 bg-[#ff2a2a] text-white flex items-center justify-center font-black text-xl rounded-sm">A</div>
            <span className="text-2xl font-black italic tracking-tighter text-white">ALOFOKE <span className="text-[#ff2a2a]">K.O</span></span>
          </div>
          
          <nav className="hidden md:flex gap-6 text-xs font-bold uppercase tracking-wide text-[#a1a1aa]">
            {tabs.filter(t => !t.adminOnly || profile?.is_admin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "transition-all h-20 flex items-center border-b-2",
                  activeTab === tab.id 
                    ? "text-white border-[#ff2a2a]" 
                    : "border-transparent hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
            {user && (
              <button onClick={() => setActiveTab('perfil')} className="transition-all h-20 flex items-center border-b-2 border-transparent hover:text-white">
                PERFIL
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-[#a1a1aa] uppercase font-bold tracking-widest">Balanza</span>
                <span className="text-green-500 font-bold text-sm">
                  ${profile?.balance.toLocaleString()} <span className="text-[10px]">USD</span>
                </span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              
              <div className="flex items-center gap-4">
                <button onClick={handleLogout} className="text-[#a1a1aa] hover:text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-zinc-500" />
                    </div>
                  )}
                </div>
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
              className="max-w-md w-full ko-card p-10 space-y-8 bg-[#111111] border-transparent"
            >
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-[#ff2a2a] text-white flex items-center justify-center font-black text-4xl rounded-sm mx-auto mb-4">A</div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                  INICIA <span className="text-[#ff2a2a]">SESIÓN</span>
                </h2>
                <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">Alofoke K.O Platform</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CORREO ELECTRÓNICO</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#555] outline-none transition-all rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CONTRASEÑA</label>
                  <input 
                    type="password" 
                    required
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#555] outline-none transition-all rounded-sm"
                  />
                </div>
                
                <button 
                  type="submit"
                  className="ko-btn-accent w-full py-4 text-[11px] flex items-center justify-center gap-3"
                >
                  <Shield className="w-4 h-4" /> 
                  {authMode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
                </button>
              </form>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-[10px] font-bold text-[#ff2a2a] uppercase tracking-widest hover:text-white transition-colors"
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
              <div className="ko-card p-6 bg-[#111111] border-transparent border-l-4 border-l-green-500 rounded-sm">
                <div className="text-[9px] text-[#777] uppercase font-bold tracking-widest mb-2">BALANCE_TOTAL</div>
                <div className="text-3xl font-black text-white">${profile?.balance.toLocaleString()} <span className="text-xs text-[#a1a1aa]">USD</span></div>
              </div>
              <div className="ko-card p-6 bg-[#111111] border-transparent border-l-4 border-l-[#ff2a2a] rounded-sm">
                <div className="text-[9px] text-[#777] uppercase font-bold tracking-widest mb-2">OPERACIONES_ACTIVAS</div>
                <div className="text-3xl font-black text-white">{userBets.filter(b => b.status === 'pending').length}</div>
              </div>
              <div className="ko-card p-6 bg-[#111111] border-transparent border-l-4 border-l-white rounded-sm">
                <div className="text-[9px] text-[#777] uppercase font-bold tracking-widest mb-2">RETORNO_TOTAL</div>
                <div className="text-3xl font-black text-white">$0 <span className="text-xs text-[#a1a1aa]">USD</span></div>
              </div>
              <div className="ko-card p-6 bg-[#111111] border-transparent border-l-4 border-l-[#555] rounded-sm">
                <div className="text-[9px] text-[#777] uppercase font-bold tracking-widest mb-2">NIVEL_ACCESO</div>
                <div className="text-3xl font-black text-white">{profile?.is_admin ? 'ADMIN' : 'USER'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="ko-card bg-[#111111] border-transparent overflow-hidden">
                <div className="p-4 border-b border-[#222] flex items-center gap-3">
                  <History className="w-4 h-4 text-[#ff2a2a]" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">HISTORIAL_OPERATIVO</h3>
                </div>
                <div className="divide-y divide-[#222] max-h-[400px] overflow-y-auto">
                  {userBets.map(bet => (
                    <div key={bet.id} className="p-4 flex justify-between items-center hover:bg-[#222] transition-colors">
                      <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase text-white">{bet.selection}</div>
                        <div className="text-[9px] font-bold text-[#777]">{new Date(bet.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-white">${bet.amount}</div>
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
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter">
                <span className="text-white">FINANCIAR</span> <span className="text-[#ff2a2a] border-b-4 border-[#ff2a2a] pb-1">CAPITAL</span>
              </h2>
              <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest pt-2">INYECCIÓN DE LIQUIDEZ NODO KO-MARKET</p>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* PayPal */}
              {paymentAccounts.paypal.active && (
                <div className="ko-card p-10 flex flex-col items-center justify-center text-center space-y-6 group hover:border-[#333] transition-all cursor-pointer bg-[#111111] border-transparent" onClick={() => setDepositMethod('PAYPAL')}>
                  <div className="w-12 h-12 rounded bg-black flex items-center justify-center border border-[#222]">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-widest">PAYPAL INSTANT</h3>
                    <p className="text-[9px] font-bold text-[#777] uppercase tracking-widest mt-2">VALIDACIÓN INMEDIATA</p>
                  </div>
                  <div className="w-full pt-6 border-t border-[#222] flex justify-center items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-sm font-black text-white">$50 <span className="text-[10px] text-[#777] uppercase">USD</span></span>
                  </div>
                </div>
              )}

              {/* Bank */}
              {paymentAccounts.bank.active && (
                <div className="ko-card p-10 flex flex-col items-center justify-center text-center space-y-6 group hover:border-[#333] transition-all cursor-pointer bg-[#111111] border-transparent" onClick={() => setDepositMethod('BANCO')}>
                  <div className="w-12 h-12 rounded bg-black flex items-center justify-center border border-[#222]">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-widest">BANK SEPA</h3>
                    <p className="text-[9px] font-bold text-[#777] uppercase tracking-widest mt-2">1 - 2 HORAS RED</p>
                  </div>
                  <div className="w-full pt-6 border-t border-[#222] flex justify-center items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-sm font-black text-white">$100 <span className="text-[10px] text-[#777] uppercase">USD</span></span>
                  </div>
                </div>
              )}

              {/* Crypto */}
              {paymentAccounts.crypto.active && (
                <div className="ko-card p-10 flex flex-col items-center justify-center text-center space-y-6 group hover:border-[#333] transition-all cursor-pointer bg-[#111111] border-transparent" onClick={() => setDepositMethod('CRYPTO')}>
                  <div className="w-12 h-12 rounded bg-black flex items-center justify-center border border-[#222]">
                    <Bitcoin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-widest">BLOCKCHAIN L2</h3>
                    <p className="text-[9px] font-bold text-[#777] uppercase tracking-widest mt-2">CONFIRMACIÓN MINERA</p>
                  </div>
                  <div className="w-full pt-6 border-t border-[#222] flex justify-center items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-sm font-black text-white">$200 <span className="text-[10px] text-[#777] uppercase">USD</span></span>
                  </div>
                </div>
              )}
            </div>           </div>

            <div className="ko-card p-10 bg-[#111111] border-transparent mt-12">
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-8 text-white">
                NOTIFICAR TRANSFERENCIA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">MONTO ENVIADO (USD)</label>
                  <input 
                    type="number" 
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    placeholder="Ej: 50" 
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-lg font-black text-white focus:border-[#555] outline-none transition-all rounded-sm" 
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">MÉTODO SELECCIONADO</label>
                  <select 
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-bold uppercase text-white focus:border-[#555] outline-none transition-all appearance-none rounded-sm"
                  >
                    {paymentAccounts.paypal.active && <option value="PAYPAL">PAYPAL INSTANT</option>}
                    {paymentAccounts.bank.active && <option value="BANCO">BANK SEPA</option>}
                    {paymentAccounts.crypto.active && <option value="CRYPTO">BLOCKCHAIN L2</option>}
                  </select>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#222] rounded-sm">
                <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest mb-2">INSTRUCCIONES DE PAGO ({depositMethod})</p>
                <p className="text-xs font-mono text-white">
                  {depositMethod === 'PAYPAL' && paymentAccounts.paypal.value}
                  {depositMethod === 'BANCO' && paymentAccounts.bank.value}
                  {depositMethod === 'CRYPTO' && paymentAccounts.crypto.value}
                </p>
              </div>

              <button 
                onClick={() => handleDeposit(depositAmount, depositMethod)} 
                className="ko-btn-white w-full mt-8 py-4 text-[11px]"
              >
                CONFIRMAR Y NOTIFICAR DEPÓSITO
              </button>
            </div>
          </div>
        )}

        {user && activeTab === 'admin' && profile?.is_admin && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-black italic uppercase text-white">CENTRO DE <span className="text-[#ff2a2a]">COMANDO</span></h2>
              <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">GESTIÓN DE MERCADOS Y LIQUIDACIÓN</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Nueva Cartelera */}
              <div className="ko-card p-10 bg-[#111111] border-transparent flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#ff2a2a] mb-8">NUEVA CARTELERA</h3>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">PELEADOR 1</label>
                        <input 
                          type="text"
                          value={newFighter1}
                          onChange={(e) => setNewFighter1(e.target.value)}
                          placeholder="Ej: Canelo Álvarez"
                          className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-bold text-white focus:border-[#555] outline-none rounded-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">PELEADOR 2</label>
                        <input 
                          type="text"
                          value={newFighter2}
                          onChange={(e) => setNewFighter2(e.target.value)}
                          placeholder="Ej: Gennady Golovkin"
                          className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-bold text-white focus:border-[#555] outline-none rounded-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">TÍTULO DEL EVENTO (OPCIONAL)</label>
                      <input 
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Ej: Noche de Campeones • Santo Domingo"
                        className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-bold text-white focus:border-[#555] outline-none rounded-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CATEGORÍA</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-bold text-white focus:border-[#555] outline-none rounded-sm appearance-none"
                        >
                          <option value="BOXEO">BOXEO</option>
                          <option value="MMA">MMA / UFC</option>
                          <option value="KICKBOXING">KICKBOXING</option>
                          <option value="LUCHA LIBRE">LUCHA LIBRE</option>
                          <option value="OTRO">OTRO</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">FECHA DEL EVENTO</label>
                        <input 
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-bold text-white focus:border-[#555] outline-none rounded-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">URL IMAGEN DEL CARTEL (OPCIONAL)</label>
                      <input 
                        type="url"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="https://i.imgur.com/tu-imagen.jpg"
                        className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm font-mono text-white focus:border-[#555] outline-none rounded-sm"
                      />
                      {newImageUrl && (
                        <img src={newImageUrl} alt="Preview" className="w-full h-24 object-cover rounded-sm mt-2 border border-[#222]" onError={(e) => {(e.target as HTMLImageElement).style.display='none'}} />
                      )}
                    </div>

                    <div className="bg-[#0a0a0a] border border-[#222] rounded-sm p-4 space-y-3">
                      <p className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CUOTAS (% PROBABILIDAD)</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white font-bold w-28 truncate">{newFighter1 || 'Peleador 1'} gana</span>
                        <span className="text-[9px] text-[#777] font-bold">x{newFighter1 ? (100/40).toFixed(2) : '2.50'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white font-bold w-28">Empate</span>
                        <span className="text-[9px] text-[#777] font-bold">x{(100/20).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white font-bold w-28 truncate">{newFighter2 || 'Peleador 2'} gana</span>
                        <span className="text-[9px] text-[#777] font-bold">x{newFighter2 ? (100/40).toFixed(2) : '2.50'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={async () => {
                    if (!newFighter1 || !newFighter2) return alert('Debes ingresar ambos peleadores');
                    const titleStr = newTitle || `${newFighter1} VS ${newFighter2}`;
                    const { error } = await supabase.from('events').insert({
                      title: titleStr,
                      category: newCategory,
                      date: newDate || null,
                      image_url: newImageUrl || null,
                      status: 'upcoming',
                      options: [
                        { id: '1', label: `${newFighter1} GANA`, percentage: 40 },
                        { id: '2', label: 'EMPATE', percentage: 20 },
                        { id: '3', label: `${newFighter2} GANA`, percentage: 40 }
                      ]
                    });
                    if (error) { alert('ERROR: ' + error.message); return; }
                    await fetchEvents();
                    setNewFighter1('');
                    setNewFighter2('');
                    setNewTitle('');
                    setNewImageUrl('');
                    setNewDate('');
                    alert('✅ MERCADO LANZADO CON ÉXITO');
                  }}
                  className="ko-btn-accent w-full py-4 text-xs mt-8"
                >
                  LANZAR MERCADO EN VIVO
                </button>
              </div>

              {/* Configuración Nodo - Gestión de Pagos */}
              <div className="ko-card p-10 bg-[#111111] border-transparent">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#a1a1aa] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ff2a2a]" /> GESTIÓN DE COBROS
                  </h3>
                  <span className="text-[9px] font-bold text-[#ff2a2a] bg-[#ff2a2a]/10 px-2 py-1 rounded-sm uppercase tracking-widest">Nivel Maestro</span>
                </div>
                
                <div className="space-y-8">
                  {/* PayPal Config */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-[#ff2a2a]" />
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">DIRECCIÓN PAYPAL (BUSINESS)</label>
                      </div>
                      <button 
                        onClick={() => setPaymentAccounts({...paymentAccounts, paypal: {...paymentAccounts.paypal, active: !paymentAccounts.paypal.active}})}
                        className={cn("text-[8px] font-black px-2 py-0.5 rounded-sm transition-all", paymentAccounts.paypal.active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}
                      >
                        {paymentAccounts.paypal.active ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </div>
                    <input 
                      type="text"
                      value={paymentAccounts.paypal.value}
                      onChange={(e) => setPaymentAccounts({...paymentAccounts, paypal: {...paymentAccounts.paypal, value: e.target.value}})}
                      placeholder="ejemplo@paypal.me"
                      className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-mono text-white focus:border-[#ff2a2a]/50 outline-none rounded-sm transition-all"
                    />
                  </div>

                  {/* Bank Config */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-3 h-3 text-[#ff2a2a]" />
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">DATOS BANCARIOS (SEP/ACH/RD)</label>
                      </div>
                      <button 
                        onClick={() => setPaymentAccounts({...paymentAccounts, bank: {...paymentAccounts.bank, active: !paymentAccounts.bank.active}})}
                        className={cn("text-[8px] font-black px-2 py-0.5 rounded-sm transition-all", paymentAccounts.bank.active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}
                      >
                        {paymentAccounts.bank.active ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </div>
                    <textarea 
                      value={paymentAccounts.bank.value}
                      onChange={(e) => setPaymentAccounts({...paymentAccounts, bank: {...paymentAccounts.bank, value: e.target.value}})}
                      placeholder="Banco, Nombre, Número de Cuenta, Cédula/RNC..."
                      rows={3}
                      className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-mono text-white focus:border-[#ff2a2a]/50 outline-none rounded-sm resize-none transition-all"
                    />
                  </div>

                  {/* Crypto Config */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Bitcoin className="w-3 h-3 text-[#ff2a2a]" />
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">WALLET CRYPTO (BTC/USDT-TRC20)</label>
                      </div>
                      <button 
                        onClick={() => setPaymentAccounts({...paymentAccounts, crypto: {...paymentAccounts.crypto, active: !paymentAccounts.crypto.active}})}
                        className={cn("text-[8px] font-black px-2 py-0.5 rounded-sm transition-all", paymentAccounts.crypto.active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}
                      >
                        {paymentAccounts.crypto.active ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </div>
                    <input 
                      type="text"
                      value={paymentAccounts.crypto.value}
                      onChange={(e) => setPaymentAccounts({...paymentAccounts, crypto: {...paymentAccounts.crypto, value: e.target.value}})}
                      placeholder="0x... o dirección de red"
                      className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-mono text-white focus:border-[#ff2a2a]/50 outline-none rounded-sm transition-all"
                    />
                  </div>

                  <div className="pt-4">
                    <button 
                      onClick={async () => {
                        const { error } = await supabase.from('settings').update({ data: paymentAccounts }).eq('id', 'payments');
                        if (error) {
                          alert('Error al guardar: ' + error.message);
                        } else {
                          alert('✅ MÉTODOS DE PAGO ACTUALIZADOS CORRECTAMENTE');
                        }
                      }}
                      className="ko-btn-white w-full py-5 text-[11px] font-black tracking-widest hover:bg-[#ff2a2a] hover:text-white transition-all duration-500 shadow-lg shadow-black/20"
                    >
                      SINCRONIZAR MÉTODOS DE COBRO
                    </button>
                    <p className="text-[8px] text-[#555] text-center mt-4 uppercase font-bold tracking-[0.2em]">Los cambios se reflejarán instantáneamente para todos los usuarios</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pendientes (Manteniendo funcionalidad original) */}
            <div className="ko-card p-10 bg-[#111111] border-transparent mt-12">
              <h3 className="text-xs font-black uppercase tracking-widest mb-8 text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#ff2a2a]" /> LIQUIDACIONES PENDIENTES
              </h3>
              <div className="divide-y divide-[#222]">
                {pendingTransactions.length > 0 ? pendingTransactions.map(tx => (
                  <div key={tx.id} className="py-4 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-black text-white">{tx.users?.display_name || tx.users?.email}</div>
                      <div className="text-[10px] font-bold text-[#777] uppercase">{tx.method} // {new Date(tx.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-xl font-black text-white">${tx.amount}</div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveTransaction(tx.id, tx.user_id, tx.amount)} className="p-2 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-white transition-all rounded-sm">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => supabase.from('transactions').update({ status: 'rejected' }).eq('id', tx.id).then(() => fetchPendingTransactions())} className="p-2 bg-[#ff2a2a]/10 border border-[#ff2a2a]/30 text-[#ff2a2a] hover:bg-[#ff2a2a] hover:text-white transition-all rounded-sm">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center text-[#777] font-bold text-[10px] uppercase tracking-widest">SIN LIQUIDACIONES PENDIENTES</div>
                )}
              </div>
            </div>
          </div>
        )}

        {user && activeTab === 'mercado' && (
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_320px] gap-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Left Sidebar */}
            <aside className="space-y-6 hidden xl:block">
              <div className="ko-card p-6 border-transparent bg-[#111111]">
                <div className="text-[10px] uppercase text-[#a1a1aa] mb-2 font-bold tracking-widest">MI BALANZA</div>
                <div className="text-3xl font-black text-white tracking-tighter mb-1">
                  ${(profile?.balance ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div className="text-[10px] font-bold text-[#a1a1aa]">USD DISPONIBLE</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest text-[#a1a1aa]">MIS APUESTAS ACTIVAS</h3>
                  <span className="bg-[#ff2a2a] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                    {userBets.filter(b => b.status === 'pending').length}
                  </span>
                </div>
                
                {userBets.filter(b => b.status === 'pending').length > 0 ? (
                  <div className="space-y-2">
                    {userBets.filter(b => b.status === 'pending').slice(0, 5).map(bet => (
                      <div key={bet.id} className="bg-[#111111] border border-[#222] rounded-sm p-3">
                        <div className="text-[10px] font-black text-white uppercase truncate">{bet.selection}</div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] text-[#777] font-bold">{new Date(bet.created_at).toLocaleDateString()}</span>
                          <span className="text-[10px] font-black text-green-400">${bet.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-sm p-6 text-center">
                    <span className="text-[10px] text-[#555] font-bold tracking-widest">SIN APUESTAS ACTIVAS</span>
                  </div>
                )}

                {userBets.length > 0 && (
                  <button onClick={() => setActiveTab('panel')} className="text-[10px] text-[#ff2a2a] hover:text-white transition-colors uppercase font-bold tracking-widest flex items-center gap-2">
                    VER HISTORIAL COMPLETO <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </aside>

            {/* Main Content */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                  CARTELERA: <span className="text-[#ff2a2a]">MAIN EVENT</span>
                </h2>
                <div className="flex gap-2">
                  <button className="bg-transparent border border-green-500 text-green-500 px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest">
                    VIVO
                  </button>
                  <button className="bg-[#1a1a1a] border border-transparent text-[#a1a1aa] px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest">
                    PRÓXIMOS
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectedEvent && (
                  <motion.div 
                    key={selectedEvent.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ko-card bg-[#111111] border-transparent overflow-hidden"
                  >
                    {/* Event Banner Image */}
                    {selectedEvent.image_url && (
                      <div className="relative h-48 overflow-hidden">
                        <img 
                          src={selectedEvent.image_url} 
                          alt={selectedEvent.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="bg-[#ff2a2a] text-white text-[9px] font-black px-3 py-1 uppercase tracking-widest">
                            {selectedEvent.status === 'live' ? '🔴 EN VIVO' : selectedEvent.category}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="p-6 border-b border-[#222] flex justify-between items-start">
                      <div className="flex items-start gap-4">
                        <div className="w-1.5 h-12 bg-[#ff2a2a] flex-shrink-0" />
                        <div>
                          <h3 className="text-xl font-black uppercase leading-none tracking-tight mb-2 text-white">{selectedEvent.title}</h3>
                          <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">
                            {selectedEvent.category} • ALOFOKE K.O
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[9px] font-bold text-[#a1a1aa] uppercase tracking-widest mb-1">POOL TOTAL</div>
                        <div className="text-lg text-white font-black">
                          ${(selectedEvent.pool || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {selectedEvent.options?.map((option) => (
                        <div key={option.id} className="group relative">
                          <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-[10px] font-bold text-[#a1a1aa] uppercase truncate">{option.label}</span>
                            <span className="text-[#a1a1aa] text-[10px] font-bold">{option.percentage.toFixed(0)}%</span>
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedOption(option);
                              setBetAmount(10);
                            }}
                            className={cn(
                              "w-full p-6 flex flex-col items-center justify-center gap-1 transition-all rounded-sm",
                              selectedOption?.id === option.id ? "bg-[#ff2a2a]/10 border border-[#ff2a2a]" : "bg-[#0a0a0a] border border-transparent hover:border-[#333]"
                            )}
                          >
                            <span className="font-black text-xl text-white italic">x{(100/option.percentage).toFixed(2)}</span>
                            <span className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CUOTA FIJA</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-6 py-4 border-t border-[#222] flex flex-wrap gap-8 items-center bg-[#0a0a0a]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CIERRE</span>
                        <span className="text-[10px] font-bold text-[#a1a1aa]">21:00 GMT-5</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#777] uppercase tracking-widest">APUESTAS</span>
                        <span className="text-[10px] font-bold text-[#a1a1aa]">{selectedEvent.bets_count}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#777] uppercase tracking-widest">FEE</span>
                        <span className="text-[10px] font-bold text-[#a1a1aa]">{selectedEvent.fee}%</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {events.filter(e => e.id !== (selectedEvent?.id || '')).map(event => (
                  <div key={event.id} onClick={() => setSelectedEvent(event)} className="p-5 bg-[#111] border border-transparent rounded-sm flex justify-between items-center cursor-pointer group hover:border-[#333] transition-all">
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-[#777] uppercase tracking-widest">
                        {event.category}
                      </span>
                      <h4 className="text-xs font-black uppercase tracking-tight text-[#a1a1aa] group-hover:text-white transition-colors">{event.title}</h4>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#777] group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Sidebar - Bet Slip */}
            <aside className="space-y-6">
              <div className="ko-card bg-[#111111] border-transparent flex flex-col h-auto">
                <div className="p-4 border-b border-[#222] flex justify-between items-center">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-white">
                    <span className="text-[#ff2a2a]">+</span> CUPÓN DE APUESTA
                  </h3>
                  <button className="w-5 h-5 rounded-full bg-[#222] flex items-center justify-center text-[#777] text-xs hover:text-white">x</button>
                </div>
                
                <div className="p-5 flex-1">
                  {selectedEvent && selectedOption ? (
                    <div className="space-y-6">
                      <div>
                        <div className="text-[9px] text-[#a1a1aa] uppercase font-bold tracking-widest mb-2">MERCADO SELECCIONADO</div>
                        <div className="font-black text-sm uppercase tracking-tight text-white mb-2">{selectedEvent.title} - {selectedOption.label}</div>
                        <div className="text-xs font-bold text-[#ff2a2a]">
                          Cuota: {(100/selectedOption.percentage).toFixed(2)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <input 
                            type="number"
                            value={betAmount || ''}
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            className="w-full bg-[#0a0a0a] border border-[#222] p-3 pl-4 rounded-sm text-sm font-bold text-white focus:border-[#555] outline-none transition-all"
                            placeholder="Monto $"
                          />
                          <span className="absolute right-4 top-3.5 text-[#555] text-sm font-bold">$</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-[10px] font-bold border-b border-[#222] pb-4">
                        <div className="flex justify-between text-[#777]">
                          <span>Monto de apuesta</span>
                          <span>${betAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#777]">
                          <span>Comisión de red ({selectedEvent.fee}%)</span>
                          <span>${(betAmount * (selectedEvent.fee/100)).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className="uppercase font-black text-[11px] text-white tracking-widest">RETORNO POTENCIAL</span>
                        <span className="text-green-500 font-black text-sm">${(betAmount * (100/selectedOption.percentage) - (betAmount * (selectedEvent.fee/100))).toFixed(2)}</span>
                      </div>

                      <div className="pt-2">
                        <div className="text-[9px] text-[#a1a1aa] uppercase font-bold tracking-widest mb-3">MÉTODO DE VALIDACIÓN</div>
                        <div className="grid grid-cols-3 gap-2">
                          <button className="bg-[#222] text-[#a1a1aa] p-2 rounded-sm text-[9px] font-bold hover:bg-[#333] hover:text-white flex items-center justify-center gap-1">
                            <CreditCard className="w-3 h-3" /> PayPal
                          </button>
                          <button className="bg-[#222] text-[#a1a1aa] p-2 rounded-sm text-[9px] font-bold hover:bg-[#333] hover:text-white flex items-center justify-center gap-1">
                            <Bitcoin className="w-3 h-3" /> Crypto
                          </button>
                          <button className="bg-[#222] text-[#a1a1aa] p-2 rounded-sm text-[9px] font-bold hover:bg-[#333] hover:text-white flex items-center justify-center gap-1">
                            <Wallet className="w-3 h-3" /> Banco
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          if (!betAmount || betAmount <= 0) return alert('INGRESA UN MONTO VÁLIDO');
                          setBetModalOpen(true);
                        }}
                        className="ko-btn-accent w-full py-4 mt-2 text-[11px]"
                      >
                        CONFIRMAR OPERACIÓN
                      </button>
                    </div>
                  ) : (
                    <div className="h-full min-h-[200px] flex items-center justify-center text-center">
                      <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest">SELECCIONA UNA CUOTA</p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

      </main>

      {/* Betting Confirmation Modal */}
      <AnimatePresence>
        {betModalOpen && selectedOption && selectedEvent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setBetModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="max-w-md w-full bg-[#111111] border border-[#333] rounded-sm relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-[#ff2a2a]" />
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black italic uppercase text-white">CONFIRMAR <span className="text-[#ff2a2a]">APUESTA</span></h3>
                    <p className="text-[10px] text-[#777] font-bold mt-1 uppercase tracking-widest">Alofoke K.O Platform</p>
                  </div>
                  <button onClick={() => setBetModalOpen(false)} className="w-8 h-8 bg-[#222] rounded-sm flex items-center justify-center text-[#777] hover:text-white transition-colors">✕</button>
                </div>

                <div className="bg-[#0a0a0a] border border-[#222] rounded-sm p-4 space-y-2">
                  <div className="text-[9px] font-bold text-[#777] uppercase tracking-widest">MERCADO</div>
                  <div className="text-sm font-black text-white uppercase">{selectedEvent.title}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#ff2a2a] uppercase">{selectedOption.label}</span>
                    <span className="text-sm font-black text-white">x{(100/selectedOption.percentage).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest flex justify-between">
                    <span>MONTO A APOSTAR</span>
                    <span className="text-green-400">BALANCE: ${(profile?.balance ?? 0).toFixed(2)}</span>
                  </label>
                  <input 
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-2xl font-black text-white focus:border-[#555] outline-none transition-all rounded-sm"
                    min={1}
                    max={profile?.balance ?? 0}
                  />
                </div>

                <div className="space-y-2 text-[11px] font-bold border-t border-b border-[#222] py-4">
                  <div className="flex justify-between text-[#a1a1aa]">
                    <span>Monto apostado</span>
                    <span>${betAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#a1a1aa]">
                    <span>Comisión ({selectedEvent.fee ?? 5}%)</span>
                    <span>-${(betAmount * ((selectedEvent.fee ?? 5)/100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-black text-sm pt-1">
                    <span>RETORNO POTENCIAL</span>
                    <span className="text-green-400">${(betAmount * (100/selectedOption.percentage) - betAmount * ((selectedEvent.fee ?? 5)/100)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setBetModalOpen(false)}
                    className="flex-1 py-3 bg-[#222] text-[#a1a1aa] hover:text-white text-xs font-bold uppercase rounded-sm transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button 
                    onClick={placeBet}
                    className="ko-btn-accent flex-[2] py-3 text-xs"
                  >
                    CONFIRMAR APUESTA
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
