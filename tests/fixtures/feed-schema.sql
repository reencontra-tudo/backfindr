-- Esquema MÍNIMO e DESCARTÁVEL (só para testes e verificação local do Feed).
-- Reproduz os nomes e tipos das colunas de produção usadas pelas rotas públicas.
-- Nunca aplicar em produção. Rodar só em banco de teste: DROP/CREATE abaixo.
DROP TABLE IF EXISTS public_signal_evidence, municipality_events, local_pages, municipalities, object_events, objects, users CASCADE;

CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), is_legacy boolean DEFAULT false, is_system_account boolean DEFAULT false);

CREATE TABLE objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, title varchar NOT NULL, description text, status varchar, type varchar,
  location varchar, latitude numeric, longitude numeric, qr_code varchar, images jsonb,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
  category varchar, color varchar, brand varchar, reward numeric, is_public boolean DEFAULT false,
  resolved_at timestamp, legacy_id integer, occurrence_description text, occurrence_type varchar,
  occurrence_date date, occurrence_time_range varchar, police_report_number varchar, police_station varchar,
  subject_name varchar, subject_gender varchar, model varchar, serial_number varchar,
  manufacture_year smallint, license_plate varchar, breed varchar, reward_offered boolean,
  reward_amount numeric, document_type varchar, country_of_origin varchar, views_count integer DEFAULT 0,
  is_legacy boolean DEFAULT false, source varchar, reward_description text, is_boosted boolean DEFAULT false,
  boost_expires_at timestamptz, visibility varchar DEFAULT 'active', search_vector tsvector, unique_code text,
  category_fields jsonb, found_pending_confirmation boolean, found_pending_since timestamptz
);
CREATE INDEX objects_feed_idx ON objects (created_at DESC) WHERE is_public = true;

CREATE TABLE object_events (id serial PRIMARY KEY, object_id uuid, type text, title text, description text, source text, actor_type text, actor_id text, user_id uuid, metadata jsonb, created_at timestamptz DEFAULT now());

CREATE TABLE municipalities (
  id serial PRIMARY KEY, ibge_code varchar, name text, slug text, state_code char(2), state_name text, region text,
  population integer, is_capital boolean DEFAULT false, latitude numeric, longitude numeric, main_landmarks text[],
  police_contact text, city_hall_email text, city_hall_site text, partnership_status text, partnership_notes text,
  first_contact_at timestamptz, last_contact_at timestamptz, total_objects_registered integer DEFAULT 0,
  total_page_views integer DEFAULT 0, avg_google_position numeric, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), radius_km numeric, category_breakdown jsonb, last_computed_at timestamptz,
  police_contact_source_url text, police_contact_notes text, emergency_contacts_local jsonb,
  emergency_contacts_local_source_url text, emergency_contacts_local_updated_at timestamptz, emergency_contacts_local_notes text
);
CREATE TABLE local_pages (id serial PRIMARY KEY, municipality_id integer, category_slug text, status text, title text, content text, meta_description text, faq_content jsonb, intro_text text, tips_content text, published_at timestamptz DEFAULT '2026-10-01', created_at timestamptz DEFAULT now());
CREATE TABLE municipality_events (id serial PRIMARY KEY, municipality_id integer, event_type text, name text, description text, date_text text, month integer, day integer);

CREATE TABLE public_signal_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), object_id uuid, source_url text, source_type text,
  captured_at timestamptz DEFAULT now(), has_contact_data boolean DEFAULT false, contact_snapshot jsonb,
  dedup_hash text, canonical_object_id uuid, expires_at timestamptz, reviewed_by uuid, status text,
  created_at timestamptz DEFAULT now(), extracted_fields jsonb, region_hint text
);
