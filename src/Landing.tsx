import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Shield, Target, Wallet, ChevronRight, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-x-hidden selection:bg-[#ff2a2a] selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-[1500px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Alofoke K.O" className="h-8 object-contain" />
            <span className="text-xl font-black italic tracking-tighter text-white">ALOFOKE <span className="text-[#ff2a2a]">K.O</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-[11px] font-bold uppercase tracking-widest text-[#a1a1aa]">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Cómo Funciona</a>
            <a href="#markets" className="hover:text-white transition-colors">Mercados</a>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/app" className="text-[11px] font-bold uppercase tracking-widest text-white hover:text-[#ff2a2a] transition-colors hidden sm:block">
              INICIAR SESIÓN
            </Link>
            <Link to="/app" className="bg-[#ff2a2a] text-white text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-sm hover:bg-[#e62020] transition-colors shadow-[0_0_20px_rgba(255,42,42,0.2)]">
              INGRESAR AHORA
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#ff2a2a]/10 via-[#0a0a0a] to-[#0a0a0a] pointer-events-none" />
        
        <div className="max-w-[1500px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 bg-[#111] border border-[#222] rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff2a2a] animate-pulse" />
              <span className="text-[10px] font-bold text-[#a1a1aa] uppercase tracking-widest">NUEVOS MERCADOS DISPONIBLES</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
              LA NUEVA ERA DE LAS <br/>
              <span className="text-[#ff2a2a]">APUESTAS DEPORTIVAS</span>
            </h1>
            
            <p className="text-lg text-[#a1a1aa] max-w-xl leading-relaxed">
              Plataforma de predicción de mercados deportivos para boxeo y artes marciales mixtas.
              Cuotas dinámicas, pagos instantáneos y la seguridad que exige el más alto nivel.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/app" className="bg-[#ff2a2a] text-white text-sm font-black uppercase tracking-widest px-8 py-5 rounded-sm hover:bg-[#e62020] transition-all hover:scale-[1.02] text-center shadow-[0_0_30px_rgba(255,42,42,0.3)] flex items-center justify-center gap-2">
                COMENZAR AHORA <ChevronRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works" className="bg-[#111] border border-[#222] text-white text-sm font-bold uppercase tracking-widest px-8 py-5 rounded-sm hover:bg-[#222] transition-colors text-center">
                CONOCER MÁS
              </a>
            </div>
            
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/5">
              <div>
                <div className="text-3xl font-black text-white">24/7</div>
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest">Mercados Activos</div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#ff2a2a]">100%</div>
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest">Pago Garantizado</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white">&lt; 1s</div>
                <div className="text-[10px] font-bold text-[#777] uppercase tracking-widest">Tiempo Ejecución</div>
              </div>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative lg:h-[600px] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#ff2a2a]/5 blur-[100px] rounded-full" />
            <img src="/logo.png" alt="Alofoke K.O Logo Large" className="relative z-10 w-full max-w-lg object-contain drop-shadow-[0_0_50px_rgba(255,42,42,0.2)]" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#050505] border-y border-[#111]">
        <div className="max-w-[1500px] mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">
              INFRAESTRUCTURA <span className="text-[#ff2a2a]">PREMIUM</span>
            </h2>
            <p className="text-[#a1a1aa] max-w-2xl mx-auto">
              Construido para soportar alto volumen de transacciones con la máxima seguridad y transparencia en cada operación de mercado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#111] border border-[#222] p-8 rounded-sm hover:border-[#333] transition-colors group">
              <div className="w-14 h-14 bg-[#0a0a0a] border border-[#222] flex items-center justify-center rounded-sm mb-6 group-hover:border-[#ff2a2a]/50 transition-colors">
                <Target className="w-6 h-6 text-[#ff2a2a]" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest mb-3">Cuotas Dinámicas</h3>
              <p className="text-[#777] text-sm leading-relaxed">
                Algoritmo de balance de pool que ajusta las probabilidades en tiempo real según el volumen de operaciones de los usuarios.
              </p>
            </div>

            <div className="bg-[#111] border border-[#222] p-8 rounded-sm hover:border-[#333] transition-colors group">
              <div className="w-14 h-14 bg-[#0a0a0a] border border-[#222] flex items-center justify-center rounded-sm mb-6 group-hover:border-[#ff2a2a]/50 transition-colors">
                <Wallet className="w-6 h-6 text-[#ff2a2a]" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest mb-3">Pagos Instantáneos</h3>
              <p className="text-[#777] text-sm leading-relaxed">
                Múltiples métodos de fondeo y retiro incluyendo transferencia bancaria local, PayPal y depósitos en criptomonedas.
              </p>
            </div>

            <div className="bg-[#111] border border-[#222] p-8 rounded-sm hover:border-[#333] transition-colors group">
              <div className="w-14 h-14 bg-[#0a0a0a] border border-[#222] flex items-center justify-center rounded-sm mb-6 group-hover:border-[#ff2a2a]/50 transition-colors">
                <Shield className="w-6 h-6 text-[#ff2a2a]" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest mb-3">Seguridad Nivel Nodo</h3>
              <p className="text-[#777] text-sm leading-relaxed">
                Cada transacción y apuesta es validada criptográficamente en nuestra base de datos inmutable, asegurando total transparencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#ff2a2a] mix-blend-multiply opacity-5" />
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <Zap className="w-12 h-12 text-[#ff2a2a] mx-auto" />
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
            ¿ESTÁS LISTO PARA ENTRAR AL MERCADO?
          </h2>
          <p className="text-[#a1a1aa] text-lg">
            Únete a cientos de usuarios que ya están operando en las mejores carteleras de deportes de contacto.
          </p>
          <div className="flex justify-center pt-8">
            <Link to="/app#signup" className="bg-[#ff2a2a] text-white text-lg font-black uppercase tracking-widest px-12 py-6 rounded-sm hover:bg-[#e62020] transition-all hover:scale-105 shadow-[0_0_40px_rgba(255,42,42,0.4)]">
              CREAR CUENTA AHORA
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050505] border-t border-[#111] py-12 px-6">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Alofoke K.O" className="h-6 object-contain grayscale opacity-50" />
            <span className="text-sm font-black italic tracking-tighter text-[#555]">ALOFOKE <span className="text-[#ff2a2a]/50">K.O</span></span>
          </div>
          
          <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest">
            © {new Date().getFullYear()} Alofoke K.O Platform. Todos los derechos reservados.
          </div>
          
          <div className="flex gap-6 text-[10px] font-bold text-[#777] uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
