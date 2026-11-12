-- Dados de teste do passo 2 dos fluxos /flow/found e /flow/lost (espelham o que a auditoria viu no banco real).
-- Use SOMENTE depois de tests/fixtures/feed-schema.sql, em banco descartável. Todos públicos.
DELETE FROM objects;
INSERT INTO objects (title, description, status, category, type, color, is_public, is_legacy, source, qr_code, created_at, updated_at) VALUES
-- LEGADO perdido, animais pretos (caso «Pochete de couro preta»)
('Sumiu minha gatinha preta',                              'Gata preta com coleira muito dócil',          'lost','animal','animal','Preta', true,true,'webjetos','LEG00001', now()-interval '4811 days', now()-interval '4811 days'),
('Vira-latinha Preta Perdida na Asa Norte',                'cachorra pequena e assustada',                 'lost','animal','animal','PRETA', true,true,'webjetos','LEG00002', now()-interval '4384 days', now()-interval '4384 days'),
('Cadela perdida no Alto de Pinheiros SP',                 'Cadela preta atende por Mel',                 'lost','pet','other','Preta',     true,true,'webjetos','LEG00003', now()-interval '4071 days', now()-interval '4071 days'),
('RECUPERADO - Cachorrinha perdida Pinscher femea Camila', 'cachorrinha preta pequena',                   'lost','pet','other','Preta',     true,true,'webjetos','LEG00004', now()-interval '3923 days', now()-interval '3923 days'),
('PROCURA-SE CACHORRA',                                    'preta com mancha branca no peito',             'lost','animal','animal','Preta', true,true,'webjetos','LEG00005', now()-interval '4423 days', now()-interval '4423 days'),
-- LEGADO perdido, celulares (um recuperado)
('Perda de Celular Nokia',                                 'celular Nokia perdido no ônibus',              'lost','electronics','other',NULL, true,true,'webjetos','LEG00006', now()-interval '3914 days', now()-interval '3914 days'),
('Celular perdido Iphone Perdido',                         'iphone perdido no centro',                     'lost','electronics','other',NULL, true,true,'webjetos','LEG00007', now()-interval '4434 days', now()-interval '4434 days'),
('Celular Samsung RECUPERADO',                             'celular Samsung preto já recuperado',         'lost','electronics','other','preto', true,true,'webjetos','LEG00008', now()-interval '3950 days', now()-interval '3950 days'),
('Roubaram o celular dentro da minha casa Moto E preto',   'celular Motorola preto roubado',               'lost','electronics','other',NULL, true,true,'webjetos','LEG00009', now()-interval '3902 days', now()-interval '3902 days'),
-- USUÁRIO perdido
('Celular azul',                                           'Perdi meu celular azul no parque',             'lost','phone','phone','azul',    true,false,NULL,'USR00001', now()-interval '14 days', now()-interval '14 days'),
('Celular Samsung Galaxy - recuperação em andamento',      'celular Samsung preto boletim registrado',    'lost','phone','phone','preto',   true,false,NULL,'USR00002', now()-interval '20 days', now()-interval '20 days'),
-- SINAIS PÚBLICOS perdidos: chaves de carro
('Perda de chave de carro no bairro Nova York',            'Perda de chave de carro no bairro Nova York',  'lost','keys','keys',NULL, true,false,'public_signal','SIG00001', now()-interval '46 days', now()-interval '46 days'),
('Perda de chave de carro no bairro Brasília',             'Perda de chave de carro no bairro Brasília',   'lost','keys','keys',NULL, true,false,'public_signal','SIG00002', now()-interval '59 days', now()-interval '59 days'),
('Perda de chave de carro no bairro Pacaembu',             'Perda de chave de carro no bairro Pacaembu',   'lost','keys','keys',NULL, true,false,'public_signal','SIG00003', now()-interval '62 days', now()-interval '62 days'),
('Perda de chave de carro no bairro Morumbi',              'Perda de chave de carro no bairro Morumbi',    'lost','keys','keys',NULL, true,false,'public_signal','SIG00004', now()-interval '79 days', now()-interval '79 days'),
('Chave de carro perdida no bairro Santo Onofre',          'Chave de carro perdida no bairro Santo Onofre','lost','keys','keys',NULL, true,false,'public_signal','SIG00005', now()-interval '83 days', now()-interval '83 days'),
-- ACHADOS (usados por /flow/lost): sinais de celular e uma carteira preta
('Achado celular da marca Samsung',                        'Achado celular da marca Samsung',              'found','phone','phone',NULL, true,false,'public_signal','SIG00006', now()-interval '65 days', now()-interval '65 days'),
('Achado celular da marca Motorola no bairro Pacaembu',    'Achado celular da marca Motorola no bairro Pacaembu','found','phone','phone',NULL, true,false,'public_signal','SIG00007', now()-interval '75 days', now()-interval '75 days'),
('Carteira preta achada no ônibus',                        'carteira preta com zíper',                     'found','wallet','wallet','preta', true,false,NULL,'USR00003', now()-interval '5 days', now()-interval '5 days'),
-- Achado LEGADO (nunca entra em status=found, regra que já existe na rota)
('Achado bolsa preta antiga',                              'bolsa preta de couro',                         'found','bag','other','preta', true,true,'webjetos','LEG00010', now()-interval '3000 days', now()-interval '3000 days');
-- Busca ampla («Celular azul», «Pochete de couro preta»): registros recentes parecidos
INSERT INTO objects (title, description, status, category, type, color, is_public, is_legacy, source, qr_code, created_at, updated_at) VALUES
('Perda de celular Motorola no bairro Centro',  'Perda de celular Motorola no bairro Centro',  'lost','phone','phone',NULL, true,false,'public_signal','SIG00020', now()-interval '30 days',  now()-interval '30 days'),
('Perda de celular Xiaomi no bairro Brasília',  'Perda de celular Xiaomi no bairro Brasília',  'lost','phone','phone',NULL, true,false,'public_signal','SIG00021', now()-interval '40 days',  now()-interval '40 days'),
('Celular do João perdido na rodoviária',       'celular antigo perdido na rodoviária',        'lost','phone','phone',NULL, true,false,NULL,'USR00020', now()-interval '120 days', now()-interval '120 days'),
('Celular legado perdido recentemente',         'celular perdido, registro do legado',         'lost','phone','phone',NULL, true,true,'webjetos','LEG00020', now()-interval '10 days',  now()-interval '10 days'),
('Celular RECUPERADO pela polícia',             'celular recuperado e devolvido',              'lost','phone','phone',NULL, true,false,NULL,'USR00021', now()-interval '8 days',    now()-interval '8 days'),
('Bolsa preta perdida no ônibus',               'bolsa preta com zíper perdida no ônibus',     'lost','bag','bag','preta',   true,false,NULL,'USR00022', now()-interval '5 days',    now()-interval '5 days');
