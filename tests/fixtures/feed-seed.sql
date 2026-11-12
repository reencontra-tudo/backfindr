-- Dados SINTÉTICOS e determinísticos (nenhum dado real). Depois de feed-schema.sql.
INSERT INTO municipalities (ibge_code,name,slug,state_code,state_name,region,population,is_capital,latitude,longitude,radius_km,police_contact) VALUES
 ('4104808','Cascavel','cascavel-pr','PR','Paraná','Sul',348051,false,-24.9555,-53.4552,15,'190'),
 ('3550308','São Paulo','sao-paulo-sp','SP','São Paulo','Sudeste',12300000,true,-23.5505,-46.6333,40,'190'),
 ('2611606','Recife','recife-pe','PE','Pernambuco','Nordeste',1650000,true,-8.0476,-34.8770,20,'190'),
 ('4205407','Florianópolis','florianopolis-sc','SC','Santa Catarina','Sul',508000,true,-27.5954,-48.5480,20,'190');
INSERT INTO local_pages (municipality_id,category_slug,status,title,content) VALUES (1,'celular','published','Celular em Cascavel','Conteúdo de teste');
INSERT INTO municipality_events (municipality_id,event_type,name) VALUES (1,'festa','Festa de teste');

-- Legado (NÃO pode aparecer no Feed): 40 públicos, vários status
INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,latitude,longitude,created_at,updated_at)
SELECT 'Legado '||g, 'Registro legado '||g, (ARRAY['lost','stolen','lost','found'])[1+g%4], (ARRAY['phone','pet','wallet','vehicle'])[1+g%4],
       'LEG'||lpad(g::text,5,'0'), true, true, NULL, 'Rua Antiga '||g||', São Paulo, SP', -23.55, -46.63,
       timestamp '2024-01-01' + g*interval '1 day', timestamp '2024-01-01' + g*interval '1 day'
FROM generate_series(1,40) g;

-- Usuários atuais (elegíveis)
INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,latitude,longitude,images,created_at,updated_at,user_id) VALUES
 ('Celular azul perdido','Perdi no ônibus','lost','phone','USR00001',true,false,NULL,'Boa Viagem, 51021, Recife, Pernambuco, Brasil',-8.1,-34.9,'["https://pub-test.r2.dev/a.jpg"]','2026-11-10 10:00','2026-11-10 10:00',gen_random_uuid()),
 ('Carteira de identidade','Modelo novo','lost','document','USR00002',true,false,NULL,'Travessa do Cruzeiro 39, Parque Dos Pássaros, Santo André - SP',-23.66,-46.53,'[]','2026-11-09 10:00','2026-11-09 10:00',gen_random_uuid()),
 ('Cachorro caramelo achado','Achado na praça','found','animal','USR00003',true,false,NULL,'Centro, Cascavel, PR',-24.95,-53.45,'["https://pub-test.r2.dev/b.jpg"]','2026-11-11 09:00','2026-11-11 09:00',gen_random_uuid()),
 ('Gato preto desaparecido','Visto pela última vez','lost','pet','USR00004',true,false,NULL,'Bairro Alto, Cascavel, PR',-24.96,-53.46,'[]','2026-11-08 08:00','2026-11-08 08:00',gen_random_uuid()),
 ('Chaves de carro','Chaveiro preto','lost','found','USR00005',true,false,NULL,'Florianópolis, Santa Catarina, Brasil',-27.6,-48.55,'[]','2026-11-07 08:00','2026-11-07 08:00',gen_random_uuid()),
 ('Bolsa roubada','Roubo na rua','stolen','bag','USR00006',true,false,NULL,NULL,NULL,NULL,'[]','2026-11-06 08:00','2026-11-06 08:00',gen_random_uuid()),
 ('Mochila com foto inline','Foto em base64','lost','bag','USR00007',true,false,NULL,'Avenida Paulista 1000, Bela Vista, São Paulo, SP',-23.56,-46.65,
   ('["'||repeat('/9j/4AAQSkZJRgABAQ',2000)||'"]')::jsonb,'2026-11-05 08:00','2026-11-05 08:00',gen_random_uuid()),
 ('Celular achado no mercado','Achei no mercado','found','phone','USR00008',true,false,NULL,'Centro, São Paulo, SP',-23.55,-46.63,'["https://pub-test.r2.dev/c.jpg"]','2026-11-04 08:00','2026-11-04 08:00',gen_random_uuid());

-- Excluídos do Feed (não podem aparecer): privado, arquivado, devolvido, protegido
INSERT INTO objects (title,status,category,qr_code,is_public,is_legacy,created_at) VALUES
 ('PRIVADO nao publico','lost','phone','PRV00001',false,false,'2026-11-10'),
 ('ARQUIVADO','archived','phone','ARC00001',true,false,'2026-11-10'),
 ('DEVOLVIDO','returned','phone','RET00001',true,false,'2026-11-10'),
 ('PROTEGIDO','protected','phone','PRO00001',true,false,'2026-11-10');

-- Sinais públicos (conta de sistema, source='public_signal'); alguns com nome de pessoa
INSERT INTO objects (title,description,status,category,qr_code,is_public,is_legacy,source,location,latitude,longitude,created_at,updated_at)
SELECT t, t||'. Categoria: x. Ocorrência identificada automaticamente.', s, c, 'SIG'||lpad(g::text,5,'0'), true, false, 'public_signal', l, la, lo,
       timestamp '2026-10-01' + g*interval '1 day', timestamp '2026-10-01' + g*interval '1 day'
FROM (VALUES
 (1,'Documento encontrado em nome de Pablo Miguel Ferreira de Melo Sebastiani','found','document','bairro Colonial, Cascavel, PR',-24.96,-53.46),
 (2,'Encontrado Cartão Bancário em nome de Marco Antônio Padovani','found','other','bairro Maria Luiza, Cascavel, PR',-24.95,-53.47),
 (3,'Documento encontrado em nome de Filipe de Mello pequeno','found','document','Centro, Cascavel, PR',-24.95,-53.45),
 (4,'Gato Derick desapareceu','lost','pet','bairro Belmonte, Cascavel, PR',-24.97,-53.44),
 (5,'Cachorro encontrado na Antônio Heil; tutores são procurados','found','pet','Brusque / SC',-27.1,-48.9),
 (6,'Perda de óculos no Terminal Sul','lost','other','bairro Universitário, Cascavel, PR',-24.94,-53.46),
 (7,'Documento encontrado em nome de Tiago da Silva','found','document','Parque Verde',-24.96,-53.43),
 (8,'Cachorro encontrado pode estar perdido','found','pet','União dos Palmares',-9.16,-36.02),
 (9,'Pônei fêmea encontrada no bairro Alto Alegre','found','animal','bairro Alto Alegre, Cascavel, PR',-24.93,-53.48),
 (10,'Perda de chave de carro no bairro Nova York','lost','keys','bairro Nova York, Cascavel, PR',-24.95,-53.50),
 (11,'Moto roubada no Centro','stolen','vehicle','Centro, São Paulo, SP',-23.55,-46.63),
 (12,'Bolsa encontrada no Recife','found','bag','Boa Viagem, Recife, PE',-8.12,-34.9)
) v(g,t,s,c,l,la,lo);
INSERT INTO public_signal_evidence (object_id,source_url,source_type,status,has_contact_data,contact_snapshot,dedup_hash,region_hint)
SELECT id, 'https://g1.globo.com/pr/noticia/'||qr_code, 'press_rss', 'approved', true, '{"phone":"45999990000","email":"contato@exemplo.com"}'::jsonb, md5(qr_code), 'Cascavel'
FROM objects WHERE source='public_signal';
