-- ============================================================
-- Migration: 004_community.sql
-- Backfindr — Módulo Comunidade
-- Executar no Supabase: Dashboard → SQL Editor → New Query
-- ============================================================

-- ── Tabela principal de posts ────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(300)  NOT NULL UNIQUE,
  title         VARCHAR(500)  NOT NULL,
  subtitle      TEXT,
  body          TEXT          NOT NULL,
  category      VARCHAR(50)   NOT NULL DEFAULT 'dica'
                              CHECK (category IN ('dica','caso','guia','debate','novidade','seguranca')),
  cover_url     TEXT,
  author_name   VARCHAR(200)  NOT NULL DEFAULT 'Equipe Backfindr',
  author_avatar TEXT,
  tags          TEXT[]        NOT NULL DEFAULT '{}',
  status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','published')),
  featured      BOOLEAN       NOT NULL DEFAULT false,
  views         INTEGER       NOT NULL DEFAULT 0,
  likes         INTEGER       NOT NULL DEFAULT 0,
  seo_title     VARCHAR(60),
  seo_desc      VARCHAR(160),
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_community_posts_status
  ON community_posts(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_category
  ON community_posts(category) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_community_posts_featured
  ON community_posts(featured, published_at DESC) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_community_posts_slug
  ON community_posts(slug);

-- ── Tabela de comentários ────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_comments (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID         NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(255),              -- armazenado para moderação, nunca exibido
  body       TEXT         NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  ip_address VARCHAR(50),               -- para anti-spam
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments(post_id, status);

CREATE INDEX IF NOT EXISTS idx_community_comments_pending
  ON community_comments(status) WHERE status = 'pending';

-- ── Trigger: atualiza updated_at automaticamente ─────────────
CREATE OR REPLACE FUNCTION update_community_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_community_post_timestamp();

-- ── Post inicial de exemplo (opcional — remover em produção) ──
-- INSERT INTO community_posts (slug, title, subtitle, body, category, status, featured, published_at)
-- VALUES (
--   'como-recuperar-celular-perdido-sao-paulo',
--   'Como recuperar um celular perdido em São Paulo',
--   'Guia completo com os passos certos para as primeiras 24 horas',
--   '<h2>As primeiras 24 horas são críticas</h2><p>Quando você perde o celular, cada minuto conta...</p>',
--   'guia',
--   'published',
--   true,
--   NOW()
-- );
