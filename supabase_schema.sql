-- Migración a Supabase para Alofoke KO
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase

-- 1. Tabla de Usuarios (Perfiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT 'Anon',
  balance NUMERIC DEFAULT 0.00,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden leer su propio perfil" ON public.users;
CREATE POLICY "Usuarios pueden leer su propio perfil" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins pueden leer todos los perfiles" ON public.users;
CREATE POLICY "Admins pueden leer todos los perfiles" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

-- 2. Tabla de Eventos
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  promoter TEXT DEFAULT 'Alofoke K.O',
  pool NUMERIC DEFAULT 0,
  bets_count INTEGER DEFAULT 0,
  fee NUMERIC DEFAULT 5,
  status TEXT DEFAULT 'upcoming', -- upcoming, live, finished, cancelled
  date DATE,
  fighters JSONB,
  options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cualquiera puede ver eventos" ON public.events;
CREATE POLICY "Cualquiera puede ver eventos" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Solo admins pueden crear/editar eventos" ON public.events;
CREATE POLICY "Solo admins pueden crear/editar eventos" ON public.events FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

-- 3. Tabla de Apuestas (Bets)
CREATE TABLE IF NOT EXISTS public.bets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  selection_id TEXT NOT NULL,
  selection TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, won, lost
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias apuestas" ON public.bets;
CREATE POLICY "Usuarios pueden ver sus propias apuestas" ON public.bets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins pueden ver todas las apuestas" ON public.bets;
CREATE POLICY "Admins pueden ver todas las apuestas" ON public.bets FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));
DROP POLICY IF EXISTS "Usuarios pueden insertar sus apuestas" ON public.bets;
CREATE POLICY "Usuarios pueden insertar sus apuestas" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Tabla de Transacciones (Depósitos/Retiros)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- deposit, withdrawal
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias transacciones" ON public.transactions;
CREATE POLICY "Usuarios pueden ver sus propias transacciones" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Usuarios pueden crear depósitos" ON public.transactions;
CREATE POLICY "Usuarios pueden crear depósitos" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins pueden ver todas y actualizar" ON public.transactions;
CREATE POLICY "Admins pueden ver todas y actualizar" ON public.transactions FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

-- 5. Tabla de Configuraciones Globales (Settings)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cualquiera puede leer settings" ON public.settings;
CREATE POLICY "Cualquiera puede leer settings" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Solo admins pueden actualizar settings" ON public.settings;
CREATE POLICY "Solo admins pueden actualizar settings" ON public.settings FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE));

-- Inserción inicial de configuración de pagos
INSERT INTO public.settings (id, data) VALUES ('payments', '{"paypal": "admin@alofokeko.com", "bank": "Banco Popular, Cuenta 123456", "crypto": "0x000000"}') ON CONFLICT (id) DO NOTHING;

-- Activar Realtime en Eventos y Settings (Ya activados, comentar para evitar errores)
-- alter publication supabase_realtime add table public.events;
-- alter publication supabase_realtime add table public.settings;

-- NOTA IMPORTANT: Función Trigger para crear el perfil cuando alguien se loguea con Google
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, is_admin)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    CASE WHEN new.email = 'tecnocreditoficial@gmail.com' THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
