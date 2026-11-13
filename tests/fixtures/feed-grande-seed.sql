-- Dados SINTÉTICOS e determinísticos (nenhum dado real). Depois de feed-schema.sql.
-- Espelha a composição do Feed real: 217 cards elegíveis = 184 sinais públicos (sem foto) + 33 registros de usuário
-- (9 com foto; 18 perdidos, 6 achados, 9 roubados). Serve para medir o Feed com a lista inteira carregada (19 lotes de 12).
INSERT INTO municipalities (ibge_code,name,slug,state_code,state_name,region,population,is_capital,latitude,longitude,radius_km,police_contact) VALUES
 ('4104808','Cascavel','cascavel-pr','PR','Paraná','Sul',348051,false,-24.9555,-53.4552,15,'190'),
 ('3550308','São Paulo','sao-paulo-sp','SP','São Paulo','Sudeste',12300000,true,-23.5505,-46.6333,40,'190');

-- Usuários (33): g = 1..33. Perdidos 1..18, achados 19..24, roubados 25..33. Fotos: g % 4 = 1 (9 registros)
INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,latitude,longitude,images,created_at,updated_at,user_id)
SELECT
  (ARRAY['Celular azul','Carteira de identidade','Chaves de carro','Mochila preta','Gato preto','Cachorro caramelo','Bicicleta vermelha','Notebook cinza','Óculos de grau','Relógio prata','Fone de ouvido'])[1+g%11] || ' ' || (CASE WHEN g<=18 THEN 'perdido' WHEN g<=24 THEN 'achado' ELSE 'roubado' END),
  'Registro de teste '||g,
  CASE WHEN g<=18 THEN 'lost' WHEN g<=24 THEN 'found' ELSE 'stolen' END,
  (ARRAY['phone','document','keys','bag','pet','animal','bike','electronics','other','jewelry','other'])[1+g%11],
  'USR'||lpad(g::text,5,'0'), true, false, NULL,
  (ARRAY['Boa Viagem, Recife, PE','Centro, Cascavel, PR','Bela Vista, São Paulo, SP','Centro, Florianópolis, SC'])[1+g%4],
  -23.5, -46.6,
  CASE WHEN g%4=1 THEN ('["https://pub-test.r2.dev/u'||g||'.jpg"]')::jsonb ELSE '[]'::jsonb END,
  timestamp '2026-11-12 12:00' - g*interval '9 hours', timestamp '2026-11-12 12:00' - g*interval '9 hours', gen_random_uuid()
FROM generate_series(1,33) g;

-- Sinais públicos (184): sem foto, com fonte (notícia)
INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,latitude,longitude,created_at,updated_at)
SELECT
  (ARRAY['Perda de chave de carro no bairro ','Achado celular da marca Samsung no bairro ','Documento encontrado no bairro ','Cachorro encontrado no bairro ','Perda de óculos no bairro ','Moto roubada no bairro ','Bolsa encontrada no bairro '])[1+g%7] || (ARRAY['Centro','Alto Alegre','Nova York','Pacaembu','Morumbi','Brasília','Floresta','Santo Onofre'])[1+g%8],
  'Ocorrência identificada automaticamente.',
  (ARRAY['lost','found','found','found','lost','stolen','found'])[1+g%7],
  (ARRAY['keys','phone','document','pet','other','vehicle','bag'])[1+g%7],
  'SIG'||lpad(g::text,5,'0'), true, false, 'public_signal',
  'bairro '||(ARRAY['Centro','Alto Alegre','Nova York','Pacaembu','Morumbi','Brasília','Floresta','Santo Onofre'])[1+g%8]||', '||(ARRAY['Cascavel, PR','São Paulo, SP','Recife, PE','Florianópolis, SC'])[1+g%4],
  -24.9, -53.4,
  timestamp '2026-11-12 08:00' - g*interval '7 hours', timestamp '2026-11-12 08:00' - g*interval '7 hours'
FROM generate_series(1,184) g;
INSERT INTO public_signal_evidence (object_id,source_url,source_type,status,has_contact_data,contact_snapshot,dedup_hash,region_hint)
SELECT id, 'https://g1.globo.com/pr/noticia/'||qr_code, 'press_rss', 'approved', false, '{}'::jsonb, md5(qr_code), 'Cascavel'
FROM objects WHERE source='public_signal';
