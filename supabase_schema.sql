-- Migración a Supabase para Alofoke KO
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase

-- 1. Tabla de Usuarios (Perfiles)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT 'Anon',
  phone TEXT,
  country TEXT,
  username TEXT,
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
  image_url TEXT,
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
INSERT INTO public.settings (id, data) VALUES ('payments', '{"paypal": {"value": "admin@alofokeko.com", "active": true}, "bank": {"value": "Banco Popular, Cuenta 123456", "active": true}, "crypto": {"value": "0x000000", "active": true}}') ON CONFLICT (id) DO NOTHING;

-- Activar Realtime en Eventos y Settings (Ya activados, comentar para evitar errores)
-- alter publication supabase_realtime add table public.events;
-- alter publication supabase_realtime add table public.settings;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;

-- NOTA IMPORTANT: Función Trigger para crear el perfil cuando alguien se loguea con Google o se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, phone, country, username, is_admin)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'username',
    CASE WHEN new.email = 'tecnocreditoficial@gmail.com' THEN true ELSE false END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Función RPC para Liquidar Eventos (Pagar a los ganadores)
CREATE OR REPLACE FUNCTION public.liquidate_event(p_event_id UUID, p_winning_selection_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bet_record RECORD;
    payout_amount NUMERIC;
BEGIN
    -- 1. Verificar si el evento existe y no está finalizado
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND status != 'finished') THEN
        RAISE EXCEPTION 'El evento no existe o ya fue liquidado.';
    END IF;

    -- 2. Marcar el evento como finalizado
    UPDATE public.events SET status = 'finished' WHERE id = p_event_id;

    -- 3. Procesar todas las apuestas pendientes de este evento
    FOR bet_record IN SELECT * FROM public.bets WHERE event_id = p_event_id AND status = 'pending' LOOP
        IF bet_record.selection_id = p_winning_selection_id THEN
            -- Ganó: Calcular pago (monto * cuota) y actualizar balance
            payout_amount := bet_record.amount * bet_record.odds;
            
            UPDATE public.bets SET status = 'won' WHERE id = bet_record.id;
            UPDATE public.users SET balance = balance + payout_amount WHERE id = bet_record.user_id;
        ELSE
            -- Perdió
            UPDATE public.bets SET status = 'lost' WHERE id = bet_record.id;
        END IF;
    END LOOP;
END;
$$;
