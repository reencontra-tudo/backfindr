// ─── Módulo Portaria ─────────────────────────────────────────────────────────

export interface Condominio {
  id:              string;
  b2b_partner_id:  string | null;
  slug:            string;
  nome:            string;
  endereco:        string;
  cidade:          string;
  estado:          string;
  cep:             string | null;
  total_unidades:  number;
  logo_url:        string | null;
  whatsapp_notify: boolean;
  push_notify:     boolean;
  email_notify:    boolean;
  active:          boolean;
  created_at:      string;
  updated_at:      string;
}

export interface Unidade {
  id:            string;
  condominio_id: string;
  numero:        string;
  bloco:         string | null;
  user_id:       string | null;
  created_at:    string;
}

export interface Porteiro {
  id:            string;
  condominio_id: string;
  user_id:       string;
  turno:         'dia' | 'noite' | 'folga';
  active:        boolean;
  created_at:    string;
}

export type EncomendaStatus = 'pendente' | 'entregue' | 'devolvida';

export interface Encomenda {
  id:               string;
  condominio_id:    string;
  unidade_id:       string | null;
  morador_id:       string | null;
  porteiro_id:      string | null;
  remetente:        string | null;
  descricao:        string | null;
  foto_url:         string | null;
  codigo_rastreio:  string | null;
  ocr_dados:        Record<string, unknown> | null;
  status:           EncomendaStatus;
  registrado_em:    string;
  entregue_em:      string | null;
  entregue_para_id: string | null;
  // joins
  morador_nome?:    string;
  unidade_numero?:  string;
  unidade_bloco?:   string;
}

// ─── Módulo Custody ───────────────────────────────────────────────────────────

export type CustodiaStatus =
  | 'registrado'
  | 'custodiado'
  | 'em_transito'
  | 'entregue'
  | 'cancelado';

export type CustodiaTipo = 'porteiro' | 'entregador' | 'pessoa';

export interface Custodia {
  id:                   string;
  condominio_id:        string | null;
  remetente_id:         string;
  destinatario_nome:    string;
  destinatario_contato: string;
  destinatario_user_id: string | null;
  descricao:            string;
  qr_code:              string;
  link_token:           string;
  status:               CustodiaStatus;
  custodiante_id:       string | null;
  custodiante_tipo:     CustodiaTipo | null;
  custodiado_em:        string | null;
  entregue_em:          string | null;
  created_at:           string;
  updated_at:           string;
  // computed
  link_url?:            string;
  // joins
  remetente_nome?:      string;
  custodiante_nome?:    string;
  condominio_nome?:     string;
}

export interface CustodiaEvento {
  id:          string;
  custodia_id: string;
  tipo:        string;
  user_id:     string | null;
  lat:         number | null;
  lng:         number | null;
  observacao:  string | null;
  created_at:  string;
  // joins
  user_nome?:  string;
}

// ─── Módulo Delivery ─────────────────────────────────────────────────────────

export interface Estabelecimento {
  id:             string;
  b2b_partner_id: string | null;
  nome:           string;
  slug:           string;
  telefone:       string | null;
  endereco:       string;
  lat:            number | null;
  lng:            number | null;
  cidade:         string | null;
  estado:         string | null;
  plano:          'basic' | 'pro';
  active:         boolean;
  created_at:     string;
  updated_at:     string;
}

export interface Entregador {
  id:                 string;
  user_id:            string;
  estabelecimento_id: string | null;
  veiculo:            string | null;
  active:             boolean;
  created_at:         string;
}

export type EntregaStatus =
  | 'preparando'
  | 'saiu'
  | 'proximo'
  | 'na_portaria'
  | 'entregue'
  | 'cancelado';

export interface Entrega {
  id:                    string;
  estabelecimento_id:    string;
  entregador_id:         string | null;
  entregador_user_id:    string | null;
  condominio_id:         string | null;
  cliente_user_id:       string | null;
  cliente_nome:          string;
  cliente_telefone:      string;
  cliente_endereco:      string;
  cliente_lat:           number | null;
  cliente_lng:           number | null;
  descricao:             string | null;
  qr_code:               string;
  link_token:            string;
  status:                EntregaStatus;
  entregador_lat:        number | null;
  entregador_lng:        number | null;
  ultima_localizacao_em: string | null;
  saiu_em:               string | null;
  chegou_em:             string | null;
  entregue_em:           string | null;
  created_at:            string;
  updated_at:            string;
  // computed
  link_url?:             string;
  // joins
  estabelecimento_nome?: string;
  entregador_nome?:      string;
}

export interface EntregaEvento {
  id:          string;
  entrega_id:  string;
  tipo:        string;
  lat:         number | null;
  lng:         number | null;
  user_id:     string | null;
  observacao:  string | null;
  created_at:  string;
}
