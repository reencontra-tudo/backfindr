-- ============================================================
-- BACKFINDR — Migration 002
-- Módulos: Portaria · Custody · Delivery
-- Executar no Supabase/PostgreSQL após migration 001 (core)
-- Todos os comandos são idempotentes (IF NOT EXISTS)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MÓDULO PORTARIA
-- ────────────────────────────────────────────────────────────

-- Condomínios (estende b2b_partners com dados específicos)
CREATE TABLE IF NOT EXISTS condominios (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_partner_id    UUID        REFERENCES b2b_partners(id) ON DELETE SET NULL,
  slug              VARCHAR(200) UNIQUE NOT NULL,      -- ex: "edificio-parque-das-aguas"
  nome              VARCHAR(200) NOT NULL,
  endereco          TEXT        NOT NULL,
  cidade            VARCHAR(100) NOT NULL,
  estado            VARCHAR(2)  NOT NULL,
  cep               VARCHAR(10),
  total_unidades    INTEGER     NOT NULL DEFAULT 0,
  logo_url          TEXT,
  whatsapp_notify   BOOLEAN     NOT NULL DEFAULT true,
  push_notify       BOOLEAN     NOT NULL DEFAULT true,
  email_notify      BOOLEAN     NOT NULL DEFAULT true,
  active            BOOLEAN     NOT NULL DEFAULT true,
  criado_por        UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_condominios_slug      ON condominios(slug);
CREATE INDEX IF NOT EXISTS idx_condominios_partner   ON condominios(b2b_partner_id);
CREATE INDEX IF NOT EXISTS idx_condominios_active    ON condominios(active);

-- Unidades/apartamentos do condomínio
CREATE TABLE IF NOT EXISTS unidades (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  numero          VARCHAR(20) NOT NULL,
  bloco           VARCHAR(20),
  user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,   -- morador vinculado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(condominio_id, numero, bloco)
);

CREATE INDEX IF NOT EXISTS idx_unidades_condominio   ON unidades(condominio_id);
CREATE INDEX IF NOT EXISTS idx_unidades_user         ON unidades(user_id);

-- Porteiros vinculados ao condomínio
CREATE TABLE IF NOT EXISTS porteiros (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  turno           VARCHAR(20) NOT NULL DEFAULT 'dia',  -- dia | noite | folga
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(condominio_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_porteiros_condominio  ON porteiros(condominio_id);
CREATE INDEX IF NOT EXISTS idx_porteiros_user        ON porteiros(user_id);

-- Encomendas recebidas na portaria
CREATE TABLE IF NOT EXISTS encomendas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id     UUID        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidade_id        UUID        REFERENCES unidades(id) ON DELETE SET NULL,
  morador_id        UUID        REFERENCES users(id) ON DELETE SET NULL,  -- destinatário
  porteiro_id       UUID        REFERENCES users(id) ON DELETE SET NULL,  -- quem registrou
  remetente         VARCHAR(200),                          -- "Amazon", "Shopee", etc.
  descricao         TEXT,
  foto_url          TEXT,                                  -- foto da etiqueta via OCR
  codigo_rastreio   VARCHAR(100),
  status            VARCHAR(30) NOT NULL DEFAULT 'pendente',  -- pendente | entregue | devolvida
  ocr_dados         JSONB,                                 -- dados extraídos pelo OCR
  registrado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entregue_em       TIMESTAMPTZ,
  entregue_para_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encomendas_condominio ON encomendas(condominio_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_morador    ON encomendas(morador_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_status     ON encomendas(status);
CREATE INDEX IF NOT EXISTS idx_encomendas_data       ON encomendas(registrado_em DESC);

-- ────────────────────────────────────────────────────────────
-- MÓDULO CUSTODY
-- ────────────────────────────────────────────────────────────

-- Itens registrados para custódia/transferência
CREATE TABLE IF NOT EXISTS custodias (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id         UUID        REFERENCES condominios(id) ON DELETE SET NULL,  -- null = uso standalone
  remetente_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destinatario_nome     VARCHAR(200) NOT NULL,
  destinatario_contato  VARCHAR(200) NOT NULL,  -- telefone ou email
  destinatario_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,  -- preenchido quando se cadastra
  descricao             TEXT        NOT NULL,
  qr_code               VARCHAR(20) UNIQUE NOT NULL,
  link_token            VARCHAR(100) UNIQUE NOT NULL,  -- token enviado ao destinatário
  status                VARCHAR(30) NOT NULL DEFAULT 'registrado',
  -- registrado | custodiado | em_transito | entregue | cancelado
  custodiante_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  custodiante_tipo      VARCHAR(30),  -- porteiro | entregador | pessoa
  custodiado_em         TIMESTAMPTZ,
  entregue_em           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custodias_remetente    ON custodias(remetente_id);
CREATE INDEX IF NOT EXISTS idx_custodias_qr           ON custodias(qr_code);
CREATE INDEX IF NOT EXISTS idx_custodias_token        ON custodias(link_token);
CREATE INDEX IF NOT EXISTS idx_custodias_status       ON custodias(status);
CREATE INDEX IF NOT EXISTS idx_custodias_condominio   ON custodias(condominio_id);
CREATE INDEX IF NOT EXISTS idx_custodias_destinatario ON custodias(destinatario_user_id);

-- Cadeia de eventos de custódia (rastreabilidade ponta a ponta)
CREATE TABLE IF NOT EXISTS custody_eventos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  custodia_id   UUID        NOT NULL REFERENCES custodias(id) ON DELETE CASCADE,
  tipo          VARCHAR(30) NOT NULL,
  -- registrado | custodiado | em_transito | entregue | cancelado | visualizado
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  lat           DECIMAL(10,7),
  lng           DECIMAL(10,7),
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custody_eventos_custodia ON custody_eventos(custodia_id);
CREATE INDEX IF NOT EXISTS idx_custody_eventos_data     ON custody_eventos(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- MÓDULO DELIVERY
-- ────────────────────────────────────────────────────────────

-- Estabelecimentos (restaurantes, pizzarias, etc.)
CREATE TABLE IF NOT EXISTS estabelecimentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  b2b_partner_id  UUID        REFERENCES b2b_partners(id) ON DELETE SET NULL,
  nome            VARCHAR(200) NOT NULL,
  slug            VARCHAR(200) UNIQUE NOT NULL,
  telefone        VARCHAR(30),
  endereco        TEXT        NOT NULL,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  cidade          VARCHAR(100),
  estado          VARCHAR(2),
  plano           VARCHAR(30) NOT NULL DEFAULT 'basic',  -- basic | pro
  active          BOOLEAN     NOT NULL DEFAULT true,
  criado_por      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estabelecimentos_slug    ON estabelecimentos(slug);
CREATE INDEX IF NOT EXISTS idx_estabelecimentos_active  ON estabelecimentos(active);

-- Entregadores vinculados (podem ser autônomos ou do estabelecimento)
CREATE TABLE IF NOT EXISTS entregadores (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estabelecimento_id  UUID        REFERENCES estabelecimentos(id) ON DELETE SET NULL,
  veiculo             VARCHAR(50),   -- moto | bike | carro | a_pe
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_entregadores_user            ON entregadores(user_id);
CREATE INDEX IF NOT EXISTS idx_entregadores_estabelecimento ON entregadores(estabelecimento_id);

-- Entregas
CREATE TABLE IF NOT EXISTS entregas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  estabelecimento_id    UUID        NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  entregador_id         UUID        REFERENCES entregadores(id) ON DELETE SET NULL,
  entregador_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  condominio_id         UUID        REFERENCES condominios(id) ON DELETE SET NULL,  -- integração Portaria
  cliente_user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  cliente_nome          VARCHAR(200) NOT NULL,
  cliente_telefone      VARCHAR(30) NOT NULL,
  cliente_endereco      TEXT        NOT NULL,
  cliente_lat           DECIMAL(10,7),
  cliente_lng           DECIMAL(10,7),
  descricao             TEXT,                             -- "Pizza Margherita + Refri"
  qr_code               VARCHAR(20) UNIQUE NOT NULL,
  link_token            VARCHAR(100) UNIQUE NOT NULL,    -- token enviado ao cliente
  status                VARCHAR(30) NOT NULL DEFAULT 'preparando',
  -- preparando | saiu | proximo | na_portaria | entregue | cancelado
  entregador_lat        DECIMAL(10,7),
  entregador_lng        DECIMAL(10,7),
  ultima_localizacao_em TIMESTAMPTZ,
  saiu_em               TIMESTAMPTZ,
  chegou_em             TIMESTAMPTZ,                      -- chegou no destino/portaria
  entregue_em           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entregas_estabelecimento ON entregas(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_entregas_entregador      ON entregas(entregador_id);
CREATE INDEX IF NOT EXISTS idx_entregas_qr              ON entregas(qr_code);
CREATE INDEX IF NOT EXISTS idx_entregas_token           ON entregas(link_token);
CREATE INDEX IF NOT EXISTS idx_entregas_status          ON entregas(status);
CREATE INDEX IF NOT EXISTS idx_entregas_condominio      ON entregas(condominio_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente         ON entregas(cliente_user_id);

-- Cadeia de eventos de entrega (geofencing + confirmações)
CREATE TABLE IF NOT EXISTS entrega_eventos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id  UUID        NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  tipo        VARCHAR(30) NOT NULL,
  -- saiu | proximo_500m | proximo_100m | na_portaria | entregue | cancelado | localizacao
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  observacao  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entrega_eventos_entrega ON entrega_eventos(entrega_id);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_data    ON entrega_eventos(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- EXTEND users: nova role porteiro
-- ────────────────────────────────────────────────────────────
-- A role 'porteiro' é adicionada ao sistema existente de roles.
-- porteiro: acesso ao PWA da portaria do condomínio vinculado
-- (sem acesso ao painel admin ou dashboard principal)

-- Verificar se constraint de role existe e adicionar 'porteiro' se necessário
-- (PostgreSQL não tem ADD TO ENUM de forma simples, usamos CHECK via extensão)
-- A role é armazenada como TEXT — apenas adicionar validação via app.

-- ────────────────────────────────────────────────────────────
-- ENDPOINT DE ATIVAÇÃO: rota para criar tabelas via API
-- (mesma estratégia do migrate-tables existente)
-- ────────────────────────────────────────────────────────────
-- Ver: /api/v1/portaria/migrate para criação via endpoint seguro

-- ============================================================
-- FIM DA MIGRATION 002
-- ============================================================
