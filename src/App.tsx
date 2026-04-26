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
import { Link } from 'react-router-dom';
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


  // Payment account states
  const [paymentAccounts, setPaymentAccounts] = useState({
    paypal: { value: '', active: true },
    bank: { value: '', active: true },
    crypto: { value: '', active: true }
  });
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCountry, setAuthCountry] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(window.location.hash === '#signup' ? 'signup' : 'login');

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
      try {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          await fetchBets(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setUserBets([]);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    });

    const eventsSub = supabase.channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      }).subscribe();

    // Fallback safety para quitar el loading si auth falla silenciosamente
    const safetyTimeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      clearTimeout(safetyTimeout);
      authListener?.subscription?.unsubscribe();
      supabase.removeChannel(eventsSub);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const profileSub = supabase.channel('public:users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, (payload) => {
        setProfile(payload.new as UserProfile);
      }).subscribe();

    return () => {
      supabase.removeChannel(profileSub);
    };
  }, [user?.id]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ 
          email: authEmail, 
          password: authPass,
          options: {
            data: { 
              full_name: authName || authEmail.split('@')[0],
              phone: authPhone,
              country: authCountry,
              username: authUsername
            }
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
    } catch (err) {
      console.error(err);
    }
  };

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<string>('PAYPAL');

  const tabs = [
    { id: 'panel', label: 'PANEL', icon: LayoutDashboard },
    { id: 'mercado', label: 'MERCADO', icon: Target },
    { id: 'financiar', label: 'AGREGAR SALDO', icon: Wallet },
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
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Alofoke Predicción" className="h-10 object-contain" />
          </Link>
          
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
            {profile?.is_admin && (
              <Link to="/admin" className="transition-all h-20 flex items-center border-b-2 border-transparent text-[#ff2a2a] hover:text-white ml-4 bg-[#ff2a2a]/10 px-4">
                <Settings className="w-4 h-4 mr-2" />
                PANEL ADMIN
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {user && (
            <>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-[#a1a1aa] uppercase font-bold tracking-widest">Balance</span>
                <span className="text-green-500 font-bold text-sm">
                  RD${profile?.balance.toLocaleString()} <span className="text-[10px]">DOP</span>
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
                <img src="/logo.png" alt="Alofoke Predicción Logo" className="h-16 mx-auto mb-6 object-contain drop-shadow-[0_0_15px_rgba(255,42,42,0.3)]" />
                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                  INICIA <span className="text-[#ff2a2a]">SESIÓN</span>
                </h2>
                <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">Alofoke Predicción Platform</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                {authMode === 'signup' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">NOMBRE COMPLETO</label>
                      <input 
                        type="text" 
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">USUARIO</label>
                        <input 
                          type="text" 
                          required
                          value={authUsername}
                          onChange={(e) => setAuthUsername(e.target.value)}
                          placeholder="@tu_usuario"
                          className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">TELÉFONO</label>
                        <input 
                          type="tel" 
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="+1 809..."
                          className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">PAÍS DE RESIDENCIA</label>
                      <select 
                        required
                        value={authCountry}
                        onChange={(e) => setAuthCountry(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-[#a1a1aa] font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm appearance-none"
                      >
                        <option value="" disabled>Selecciona tu país</option>
                        <option value="DO">República Dominicana</option>
                        <option value="US">Estados Unidos</option>
                        <option value="ES">España</option>
                        <option value="MX">México</option>
                        <option value="CO">Colombia</option>
                        <option value="AR">Argentina</option>
                        <option value="CL">Chile</option>
                        <option value="PE">Perú</option>
                        <option value="OT">Otro</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CORREO ELECTRÓNICO</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">CONTRASEÑA</label>
                  <input 
                    type="password" 
                    required
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-white font-bold focus:border-[#ff2a2a]/50 outline-none transition-all rounded-sm"
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
                <span className="text-white">AGREGAR</span> <span className="text-[#ff2a2a] border-b-4 border-[#ff2a2a] pb-1">SALDO</span>
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
                    <span className="text-sm font-black text-white">RD$50 <span className="text-[10px] text-[#777] uppercase">DOP</span></span>
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
                    <span className="text-sm font-black text-white">RD$100 <span className="text-[10px] text-[#777] uppercase">DOP</span></span>
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
                    <span className="text-sm font-black text-white">RD$200 <span className="text-[10px] text-[#777] uppercase">DOP</span></span>
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
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">MONTO ENVIADO (DOP)</label>
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
        {user && activeTab === 'perfil' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="space-y-2 mb-8">
              <h2 className="text-4xl font-black italic uppercase text-white">TU <span className="text-[#ff2a2a]">PERFIL</span></h2>
              <p className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">INFORMACIÓN DE CUENTA Y SEGURIDAD</p>
            </div>

            <div className="ko-card p-10 bg-[#111111] border-transparent space-y-8">
              <div className="flex items-center gap-6 pb-8 border-b border-[#222]">
                <div className="w-24 h-24 rounded-full bg-[#222] border-2 border-[#ff2a2a] flex items-center justify-center text-4xl font-black text-white uppercase">
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase">{profile?.full_name || 'USUARIO ALOFOKE'}</h3>
                  <p className="text-[#777] font-bold text-xs uppercase tracking-widest mt-1">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">USERNAME</label>
                  <div className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-bold text-white rounded-sm">
                    {profile?.username || 'N/A'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">TELÉFONO</label>
                  <div className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-bold text-white rounded-sm">
                    {profile?.phone || 'N/A'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">PAÍS</label>
                  <div className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-bold text-white rounded-sm">
                    {profile?.country || 'N/A'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[#777] uppercase tracking-widest">BALANCE ACTUAL</label>
                  <div className="w-full bg-[#0a0a0a] border border-[#222] p-4 text-sm font-black text-green-500 rounded-sm">
                    RD${profile?.balance?.toLocaleString() || 0} DOP
                  </div>
                </div>
              </div>

              <div className="pt-8 flex justify-end">
                <button 
                  onClick={handleLogout}
                  className="px-8 py-4 bg-[#ff2a2a]/10 text-[#ff2a2a] border border-[#ff2a2a]/30 hover:bg-[#ff2a2a] hover:text-white transition-all text-xs font-black uppercase tracking-widest rounded-sm flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  CERRAR SESIÓN
                </button>
              </div>
            </div>
          </div>
        )}

        {user && activeTab === 'mercado' && (
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_320px] gap-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Left Sidebar */}
            <aside className="space-y-6 hidden xl:block">
              <div className="ko-card p-6 border-transparent bg-[#111111]">
                <div className="text-[10px] uppercase text-[#a1a1aa] mb-2 font-bold tracking-widest">MI BALANCE</div>
                <div className="text-3xl font-black text-white tracking-tighter mb-1">
                  RD${(profile?.balance ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div className="text-[10px] font-bold text-[#a1a1aa]">DOP DISPONIBLE</div>
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
                    <p className="text-[10px] text-[#777] font-bold mt-1 uppercase tracking-widest">Alofoke Predicción Platform</p>
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
