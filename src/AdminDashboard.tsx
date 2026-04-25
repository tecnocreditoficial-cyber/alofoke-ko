import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Target, 
  CreditCard, 
  Wallet, 
  Bitcoin, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  LogOut
} from 'lucide-react';
import { cn } from './lib/utils';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [events, setEvents] = useState<any[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPool, setTotalPool] = useState(0);

  // Admin form states
  const [newFighter1, setNewFighter1] = useState('');
  const [newFighter2, setNewFighter2] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('BOXEO');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDate, setNewDate] = useState('');
  const [selectedWinners, setSelectedWinners] = useState<Record<string, string>>({});

  const [paymentAccounts, setPaymentAccounts] = useState({
    paypal: { value: '', active: true },
    bank: { value: '', active: true },
    crypto: { value: '', active: true }
  });

  const fetchData = async () => {
    // Fetch Events
    const { data: evts } = await supabase.from('events').select('*').order('created_at', { ascending: false });
    if (evts) {
      setEvents(evts);
      setTotalPool(evts.reduce((sum, e) => sum + (e.pool || 0), 0));
    }

    // Fetch Transactions
    const { data: txs } = await supabase.from('transactions').select('*, users(email, display_name)').eq('status', 'pending');
    if (txs) setPendingTransactions(txs);

    // Fetch Users Count
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (count) setTotalUsers(count);

    // Fetch Settings
    const { data: settings } = await supabase.from('settings').select('data').eq('id', 'payments').single();
    if (settings && settings.data) {
      const dbData = settings.data;
      setPaymentAccounts({
        paypal: typeof dbData.paypal === 'string' ? { value: dbData.paypal, active: true } : (dbData.paypal || { value: '', active: true }),
        bank: typeof dbData.bank === 'string' ? { value: dbData.bank, active: true } : (dbData.bank || { value: '', active: true }),
        crypto: typeof dbData.crypto === 'string' ? { value: dbData.crypto, active: true } : (dbData.crypto || { value: '', active: true })
      });
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/app');
        return;
      }
      
      const { data: profileData } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      
      if (!profileData?.is_admin) {
        navigate('/app');
        return;
      }

      setUser(session.user);
      setProfile(profileData);
      await fetchData();
      setLoading(false);
    };

    checkAdmin();
  }, [navigate]);

  const handleApproveTransaction = async (txId: string, userId: string, amount: number) => {
    try {
      const { data: userData, error: userError } = await supabase.from('users').select('balance').eq('id', userId).single();
      if (userError) throw userError;
      
      const currentBalance = userData.balance || 0;
      const { error: updateError } = await supabase.from('users').update({ balance: currentBalance + amount }).eq('id', userId);
      if (updateError) throw updateError;
      
      const { error: txError } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', txId);
      if (txError) throw txError;
      
      fetchData();
      alert('TRANSACCIÓN APROBADA.');
    } catch (err) {
      console.error(err);
      alert('ERROR AL APROBAR.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 border-y-2 border-[#ff2a2a] rounded-full animate-spin"></div>
        <div className="text-white font-black text-xs italic tracking-widest">CARGANDO SECURE NET...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] font-sans text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 h-16 border-b border-white/5 bg-[#0a0a0a] px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shield className="w-5 h-5 text-[#ff2a2a]" />
          <span className="text-lg font-black tracking-widest">ALOFOKE <span className="text-[#ff2a2a]">ADMIN</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/app" className="text-[10px] font-bold text-[#ff2a2a] hover:text-white transition-colors uppercase border border-[#ff2a2a]/30 bg-[#ff2a2a]/10 px-3 py-1.5 rounded-sm">
            VISTA USUARIO
          </Link>
          <span className="text-[10px] font-bold text-zinc-500 uppercase ml-2">Sesión Segura</span>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/app'); }} className="text-[#a1a1aa] hover:text-white transition-colors" title="Cerrar sesión">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="p-8 max-w-[1600px] mx-auto space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#111] border border-[#222] p-6 rounded-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-[#ff2a2a]/10 rounded-sm">
                <DollarSign className="w-5 h-5 text-[#ff2a2a]" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Volumen Total (Pool)</div>
            <div className="text-3xl font-black">RD${totalPool.toLocaleString()}</div>
          </div>
          
          <div className="bg-[#111] border border-[#222] p-6 rounded-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 rounded-sm">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Usuarios Registrados</div>
            <div className="text-3xl font-black">{totalUsers}</div>
          </div>

          <div className="bg-[#111] border border-[#222] p-6 rounded-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-yellow-500/10 rounded-sm">
                <Activity className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Eventos Activos</div>
            <div className="text-3xl font-black">{events.filter(e => e.status !== 'finished').length}</div>
          </div>

          <div className="bg-[#111] border border-[#222] p-6 rounded-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-500/10 rounded-sm">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Depósitos Pendientes</div>
            <div className="text-3xl font-black">{pendingTransactions.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Carteleras y Liquidaciones */}
          <div className="xl:col-span-2 space-y-8">
            
            {/* Liquidar Eventos */}
            <div className="bg-[#111] border border-[#222] p-8 rounded-sm">
              <h3 className="text-xs font-black uppercase tracking-widest mb-6 text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#ff2a2a]" /> LIQUIDAR CARTELERAS ACTIVAS
              </h3>
              <div className="space-y-4">
                {events.filter(e => e.status !== 'finished').length > 0 ? events.filter(e => e.status !== 'finished').map(event => (
                  <div key={event.id} className="p-4 bg-[#0a0a0a] border border-[#222] rounded-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-[#ff2a2a] uppercase tracking-widest">{event.category}</div>
                      <div className="text-base font-black uppercase">{event.title}</div>
                      <div className="text-[10px] font-bold text-[#777] uppercase mt-1">Pool: RD${event.pool} • Apuestas: {event.bets_count}</div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <select 
                        value={selectedWinners[event.id] || ''}
                        onChange={(e) => setSelectedWinners({...selectedWinners, [event.id]: e.target.value})}
                        className="bg-[#111] border border-[#333] p-2 text-xs font-bold outline-none rounded-sm"
                      >
                        <option value="" disabled>Ganador...</option>
                        {event.options?.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <button 
                        onClick={async () => {
                          const winnerId = selectedWinners[event.id];
                          if (!winnerId) return alert('Debes seleccionar un ganador primero');
                          if (!confirm('¿Estás seguro de liquidar este evento?')) return;
                          
                          try {
                            const { error } = await supabase.rpc('liquidate_event', { p_event_id: event.id, p_winning_selection_id: winnerId });
                            if (error) throw error;
                            alert('✅ EVENTO LIQUIDADO');
                            fetchData();
                          } catch (err: any) {
                            alert('Error liquidando: ' + err.message);
                          }
                        }}
                        className="bg-[#ff2a2a] text-white font-black text-[10px] px-4 py-2 uppercase tracking-widest hover:bg-[#e62020] transition-colors rounded-sm"
                      >
                        LIQUIDAR
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-[#777] font-bold text-[10px] uppercase tracking-widest">NO HAY EVENTOS ACTIVOS</div>
                )}
              </div>
            </div>

            {/* Crear Cartelera */}
            <div className="bg-[#111] border border-[#222] p-8 rounded-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#ff2a2a] mb-6">NUEVA CARTELERA</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#777] uppercase">PELEADOR 1</label>
                    <input type="text" value={newFighter1} onChange={(e) => setNewFighter1(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#777] uppercase">PELEADOR 2</label>
                    <input type="text" value={newFighter2} onChange={(e) => setNewFighter2(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#777] uppercase">TÍTULO DEL EVENTO</label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#777] uppercase">CATEGORÍA</label>
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm">
                      <option value="BOXEO">BOXEO</option>
                      <option value="MMA">MMA / UFC</option>
                      <option value="OTRO">OTRO</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-[#777] uppercase">FECHA</label>
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-[#777] uppercase">URL IMAGEN</label>
                  <input type="url" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] p-3 text-sm text-white outline-none rounded-sm" />
                </div>
                
                <button 
                  onClick={async () => {
                    if (!newFighter1 || !newFighter2) return alert('Debes ingresar ambos peleadores');
                    const titleStr = newTitle || `${newFighter1} VS ${newFighter2}`;
                    const { error } = await supabase.from('events').insert({
                      title: titleStr, category: newCategory, date: newDate || null, image_url: newImageUrl || null, status: 'upcoming',
                      options: [
                        { id: '1', label: `${newFighter1} GANA`, percentage: 40 },
                        { id: '2', label: 'EMPATE', percentage: 20 },
                        { id: '3', label: `${newFighter2} GANA`, percentage: 40 }
                      ]
                    });
                    if (error) { alert('ERROR: ' + error.message); return; }
                    fetchData();
                    setNewFighter1(''); setNewFighter2(''); setNewTitle(''); setNewImageUrl(''); setNewDate('');
                    alert('✅ MERCADO LANZADO CON ÉXITO');
                  }}
                  className="bg-[#ff2a2a] text-white font-black text-xs w-full py-4 mt-4 uppercase tracking-widest hover:bg-[#e62020] transition-colors rounded-sm"
                >
                  LANZAR MERCADO EN VIVO
                </button>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Pagos y Cobros */}
          <div className="space-y-8">
            
            {/* Depósitos Pendientes */}
            <div className="bg-[#111] border border-[#222] p-8 rounded-sm">
              <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> DEPÓSITOS PENDIENTES
              </h3>
              <div className="space-y-3">
                {pendingTransactions.length > 0 ? pendingTransactions.map(tx => (
                  <div key={tx.id} className="p-4 bg-[#0a0a0a] border border-[#222] rounded-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs font-black">{tx.users?.display_name || tx.users?.email}</div>
                        <div className="text-[9px] text-[#777] uppercase">{tx.method}</div>
                      </div>
                      <div className="text-sm font-black text-green-500">RD${tx.amount}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => handleApproveTransaction(tx.id, tx.user_id, tx.amount)} className="flex-1 p-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all rounded-sm flex justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button onClick={async () => { await supabase.from('transactions').update({ status: 'rejected' }).eq('id', tx.id); fetchData(); }} className="flex-1 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all rounded-sm flex justify-center">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="py-6 text-center text-[#777] font-bold text-[9px] uppercase tracking-widest">SIN PENDIENTES</div>
                )}
              </div>
            </div>

            {/* Cuentas de Cobro */}
            <div className="bg-[#111] border border-[#222] p-8 rounded-sm">
              <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-500" /> CUENTAS DE COBRO
              </h3>
              <div className="space-y-4">
                {/* PayPal */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#777]">PAYPAL</label>
                    <button onClick={() => setPaymentAccounts({...paymentAccounts, paypal: {...paymentAccounts.paypal, active: !paymentAccounts.paypal.active}})} className={cn("text-[8px] font-black px-1 rounded-sm", paymentAccounts.paypal.active ? "text-green-500" : "text-red-500")}>{paymentAccounts.paypal.active ? 'ON' : 'OFF'}</button>
                  </div>
                  <input type="text" value={paymentAccounts.paypal.value} onChange={(e) => setPaymentAccounts({...paymentAccounts, paypal: {...paymentAccounts.paypal, value: e.target.value}})} className="w-full bg-[#0a0a0a] border border-[#222] p-2 text-xs outline-none rounded-sm" />
                </div>
                {/* Banco */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#777]">BANCO LOCAL</label>
                    <button onClick={() => setPaymentAccounts({...paymentAccounts, bank: {...paymentAccounts.bank, active: !paymentAccounts.bank.active}})} className={cn("text-[8px] font-black px-1 rounded-sm", paymentAccounts.bank.active ? "text-green-500" : "text-red-500")}>{paymentAccounts.bank.active ? 'ON' : 'OFF'}</button>
                  </div>
                  <textarea value={paymentAccounts.bank.value} onChange={(e) => setPaymentAccounts({...paymentAccounts, bank: {...paymentAccounts.bank, value: e.target.value}})} rows={2} className="w-full bg-[#0a0a0a] border border-[#222] p-2 text-xs outline-none rounded-sm resize-none" />
                </div>
                {/* Crypto */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-[9px] font-bold text-[#777]">WALLET CRYPTO</label>
                    <button onClick={() => setPaymentAccounts({...paymentAccounts, crypto: {...paymentAccounts.crypto, active: !paymentAccounts.crypto.active}})} className={cn("text-[8px] font-black px-1 rounded-sm", paymentAccounts.crypto.active ? "text-green-500" : "text-red-500")}>{paymentAccounts.crypto.active ? 'ON' : 'OFF'}</button>
                  </div>
                  <input type="text" value={paymentAccounts.crypto.value} onChange={(e) => setPaymentAccounts({...paymentAccounts, crypto: {...paymentAccounts.crypto, value: e.target.value}})} className="w-full bg-[#0a0a0a] border border-[#222] p-2 text-xs outline-none rounded-sm" />
                </div>

                <button 
                  onClick={async () => {
                    await supabase.from('settings').update({ data: paymentAccounts }).eq('id', 'payments');
                    alert('✅ ACTUALIZADO');
                  }}
                  className="bg-white text-black font-black text-[10px] w-full py-3 mt-4 uppercase tracking-widest hover:bg-gray-200 transition-colors rounded-sm"
                >
                  GUARDAR CONFIGURACIÓN
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
