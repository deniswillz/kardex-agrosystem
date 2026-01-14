-- =============================================
-- DIÁRIO DE BORDO - SIMPLIFIED AUTH SETUP
-- Execute este SQL no editor do Supabase (SQL Editor)
-- ATENÇÃO: ISSO IRÁ RESETAR O BANCO DE DADOS
-- =============================================

-- Remover tabelas antigas (limpeza completa)
DROP TABLE IF EXISTS comentarios CASCADE;
DROP TABLE IF EXISTS ordens_producao CASCADE;
DROP TABLE IF EXISTS notas_fiscais CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE; -- Garantir que a nova tabela também seja limpa se existir

-- 1. Tabela de Usuários (Autenticação Própria)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Notas Fiscais
CREATE TABLE public.notas_fiscais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    numero TEXT NOT NULL,
    fornecedor TEXT,
    status TEXT NOT NULL,
    tipo TEXT,
    observacao TEXT,
    created_by UUID REFERENCES public.users(id), -- Referência à nova tabela users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Ordens de Produção
CREATE TABLE public.ordens_producao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    numero TEXT NOT NULL,
    documento TEXT,
    status TEXT NOT NULL,
    observacao TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Comentários
CREATE TABLE public.comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    texto TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS POLICIES (Simplificadas para acesso público via API Key)
-- Como não estamos usando auth.uid() do Supabase, controlamos acesso no App
-- =============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;

-- Permitir acesso total público (controlado pelo backend/app)
-- Em um app real, faríamos funções RPC para login seguro, 
-- mas isso simplifica para o objetivo atual.

CREATE POLICY "Public Access Users" ON public.users FOR ALL USING (true);
CREATE POLICY "Public Access Notas" ON public.notas_fiscais FOR ALL USING (true);
CREATE POLICY "Public Access Ordens" ON public.ordens_producao FOR ALL USING (true);
CREATE POLICY "Public Access Comentarios" ON public.comentarios FOR ALL USING (true);

-- =============================================
-- CRIAR USUÁRIO ADMIN INICIAL
-- =============================================

INSERT INTO public.users (username, password, name, role)
VALUES ('admin', '12dfe', 'Administrador', 'admin')
ON CONFLICT (username) DO NOTHING;

-- =============================================
-- MENSAGEM DE SUCESSO
-- =============================================
-- Selecione tudo e clique em RUN.
-- Se der sucesso, o usuário admin já estará criado!
-- Login: admin
-- Senha: 12dfe
