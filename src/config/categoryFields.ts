/**
 * Configuração de campos específicos por categoria
 * Define quais campos adicionais devem ser coletados para cada tipo de objeto
 */

export interface CategoryFieldConfig {
  category: string;
  label: string;
  emoji: string;
  essentialFields: FieldDefinition[];
  optionalFields: FieldDefinition[];
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'color';
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  maxLength?: number;
  inputMode?: 'numeric' | 'text';
}

// Marcação «obrigatório» (asterisco): SÓ o Animal tem campos obrigatórios (espécie e cor/pelagem, exigidos de verdade em `faltasDoAnimal`).
// Nas demais categorias nada exigia os campos e a marca enganava; decisão do fundador, 24/11/2026: todos opcionais.
export const CATEGORY_FIELDS: Record<string, CategoryFieldConfig> = {
  vehicle: {
    category: 'vehicle',
    label: 'Veículo',
    emoji: '🚗',
    essentialFields: [
      {
        name: 'vehicle_type',
        label: 'Tipo de Veículo',
        type: 'select',
        options: [
          { value: 'car', label: 'Carro' },
          { value: 'motorcycle', label: 'Moto' },
          { value: 'truck', label: 'Caminhão' },
          { value: 'bicycle', label: 'Bicicleta' },
          { value: 'scooter', label: 'Scooter' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'vehicle_brand',
        label: 'Marca',
        type: 'text',
        placeholder: 'Ex: Toyota, Honda, BMW',
        hint: 'Digite a marca do veículo',
      },
      {
        name: 'vehicle_model',
        label: 'Modelo',
        type: 'text',
        placeholder: 'Ex: Corolla, Civic, X5',
      },
      {
        name: 'vehicle_year',
        label: 'Ano',
        type: 'number',
        placeholder: 'Ex: 2020',
        required: false,
      },
      {
        name: 'vehicle_color',
        label: 'Cor Principal',
        type: 'color',
      },
    ],
    optionalFields: [
      {
        name: 'vehicle_plate',
        label: 'Placa',
        type: 'text',
        placeholder: 'Ex: ABC1234 ou ABC-1D23',
        hint: 'Placa do veículo (se disponível)',
      },
      {
        name: 'vehicle_vin',
        label: 'VIN / Chassi',
        type: 'text',
        placeholder: 'Ex: 1HGBH41JXMN109186',
        hint: 'Número de identificação do veículo',
      },
      {
        name: 'vehicle_engine',
        label: 'Motor / Cilindrada',
        type: 'text',
        placeholder: 'Ex: 1.8L, 2.0L Turbo',
      },
      {
        name: 'vehicle_transmission',
        label: 'Transmissão',
        type: 'select',
        options: [
          { value: 'manual', label: 'Manual' },
          { value: 'automatic', label: 'Automática' },
          { value: 'cvt', label: 'CVT' },
        ],
      },
    ],
  },

  phone: {
    category: 'phone',
    label: 'Celular',
    emoji: '📱',
    essentialFields: [
      {
        name: 'phone_brand',
        label: 'Marca',
        type: 'select',
        options: [
          { value: 'apple', label: 'Apple (iPhone)' },
          { value: 'samsung', label: 'Samsung' },
          { value: 'xiaomi', label: 'Xiaomi' },
          { value: 'motorola', label: 'Motorola' },
          { value: 'lg', label: 'LG' },
          { value: 'google', label: 'Google Pixel' },
          { value: 'oneplus', label: 'OnePlus' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'phone_model',
        label: 'Modelo',
        type: 'text',
        placeholder: 'Ex: iPhone 15 Pro, Galaxy S24',
      },
      {
        name: 'phone_color',
        label: 'Cor',
        type: 'text',
        placeholder: 'Ex: Preto, Branco, Azul',
      },
    ],
    optionalFields: [
      {
        name: 'phone_imei',
        label: 'IMEI',
        type: 'text',
        placeholder: '15 dígitos (encontrado em *#06#)',
        hint: 'Número IMEI para identificação única',
      },
      {
        name: 'phone_serial',
        label: 'Número de Série',
        type: 'text',
        placeholder: 'Número de série do dispositivo',
      },
      {
        name: 'phone_storage',
        label: 'Armazenamento',
        type: 'select',
        options: [
          { value: '64gb', label: '64 GB' },
          { value: '128gb', label: '128 GB' },
          { value: '256gb', label: '256 GB' },
          { value: '512gb', label: '512 GB' },
          { value: '1tb', label: '1 TB' },
        ],
      },
    ],
  },

  electronics: {
    category: 'electronics',
    label: 'Eletrônico',
    emoji: '💻',
    essentialFields: [
      {
        name: 'electronics_type',
        label: 'Tipo de Eletrônico',
        type: 'select',
        options: [
          { value: 'laptop', label: 'Notebook' },
          { value: 'tablet', label: 'Tablet' },
          { value: 'camera', label: 'Câmera' },
          { value: 'headphones', label: 'Fone de Ouvido' },
          { value: 'smartwatch', label: 'Relógio Inteligente' },
          { value: 'game_console', label: 'Console de Videogame' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'electronics_brand',
        label: 'Marca',
        type: 'text',
        placeholder: 'Ex: Dell, Apple, Sony',
      },
      {
        name: 'electronics_model',
        label: 'Modelo',
        type: 'text',
        placeholder: 'Ex: MacBook Pro 14", WH-1000XM5',
      },
      {
        name: 'electronics_color',
        label: 'Cor',
        type: 'text',
        placeholder: 'Ex: Cinza, Prateado, Preto',
      },
    ],
    optionalFields: [
      {
        name: 'electronics_serial',
        label: 'Número de Série',
        type: 'text',
        placeholder: 'Número de série do dispositivo',
        hint: 'Geralmente encontrado na etiqueta traseira',
      },
      {
        name: 'electronics_imei',
        label: 'IMEI / Identificador',
        type: 'text',
        placeholder: 'Identificador único do dispositivo',
      },
      {
        name: 'electronics_specs',
        label: 'Especificações Técnicas',
        type: 'textarea',
        placeholder: 'Ex: 16GB RAM, 512GB SSD, Intel i7...',
        hint: 'Detalhes técnicos que ajudem na identificação',
      },
    ],
  },

  // Animal de CRIAÇÃO ou TRABALHO (cavalo, boi, porco...). Quem tem cachorro, gato, pássaro ou coelho escolhe «Pet» (decisão do fundador, 24/11/2026, MC-01).
  // Nomes próprios (animal_*), sem reaproveitar pet_*. Essenciais: espécie e cor/pelagem. Todo o resto é opcional.
  animal: {
    category: 'animal',
    label: 'Animal',
    emoji: '🐴',
    essentialFields: [
      {
        name: 'animal_species',
        label: 'Espécie',
        type: 'select',
        required: true,
        options: [
          { value: 'horse', label: 'Cavalo / égua' },
          { value: 'cattle', label: 'Boi / vaca / bezerro' },
          { value: 'pig', label: 'Porco' },
          { value: 'sheep', label: 'Ovelha' },
          { value: 'goat', label: 'Cabra / bode' },
          { value: 'poultry', label: 'Ave de criação (galinha, pato...)' },
          { value: 'donkey', label: 'Burro / jumento / mula' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'animal_color',
        label: 'Cor / pelagem',
        type: 'text',
        required: true,
        placeholder: 'Ex: alazão com estrela na testa, preto, malhado',
        maxLength: 80,
      },
    ],
    optionalFields: [
      { name: 'animal_breed', label: 'Raça', type: 'text', placeholder: 'Ex: Mangalarga, Nelore (se souber)', maxLength: 80 },
      {
        name: 'animal_sex',
        label: 'Sexo',
        type: 'select',
        options: [
          { value: 'male', label: 'Macho' },
          { value: 'female', label: 'Fêmea' },
          { value: 'unknown', label: 'Não sei' },
        ],
      },
      { name: 'animal_age', label: 'Idade aproximada', type: 'text', placeholder: 'Ex: 5 anos', maxLength: 40 },
      {
        name: 'animal_size',
        label: 'Porte',
        type: 'select',
        options: [
          { value: 'small', label: 'Pequeno' },
          { value: 'medium', label: 'Médio' },
          { value: 'large', label: 'Grande' },
        ],
      },
      { name: 'animal_marks', label: 'Marcas e sinais', type: 'textarea', placeholder: 'Ex: ferro/marca a fogo, cicatriz, mancha, crina, ferradura', maxLength: 300 },
      { name: 'animal_id_tag', label: 'Identificação (brinco, microchip ou registro)', type: 'text', placeholder: 'Número do brinco, microchip ou registro, se houver', maxLength: 80 },
    ],
  },
  pet: {
    category: 'pet',
    label: 'Pet / Animal',
    emoji: '🐾',
    essentialFields: [
      {
        name: 'pet_species',
        label: 'Espécie',
        type: 'select',
        options: [
          { value: 'dog', label: 'Cachorro' },
          { value: 'cat', label: 'Gato' },
          { value: 'bird', label: 'Pássaro' },
          { value: 'rabbit', label: 'Coelho' },
          { value: 'hamster', label: 'Hamster' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'pet_breed',
        label: 'Raça',
        type: 'text',
        placeholder: 'Ex: Labrador, Persa, SRD',
      },
      {
        name: 'pet_color',
        label: 'Cor / Padrão',
        type: 'text',
        placeholder: 'Ex: Preto e branco, Caramelo, Malhado',
      },
      {
        name: 'pet_size',
        label: 'Tamanho',
        type: 'select',
        options: [
          { value: 'small', label: 'Pequeno (até 5kg)' },
          { value: 'medium', label: 'Médio (5-15kg)' },
          { value: 'large', label: 'Grande (15-30kg)' },
          { value: 'extra_large', label: 'Muito Grande (30kg+)' },
        ],
      },
    ],
    optionalFields: [
      {
        name: 'pet_microchip',
        label: 'Número do Microchip',
        type: 'text',
        placeholder: '15 dígitos do microchip',
        hint: 'Se o pet foi microchipado',
      },
      {
        name: 'pet_age',
        label: 'Idade Aproximada',
        type: 'text',
        placeholder: 'Ex: 2 anos, 6 meses',
      },
      {
        name: 'pet_distinguishing_marks',
        label: 'Marcas Distintivas',
        type: 'textarea',
        placeholder: 'Ex: Cicatriz na orelha, mancha no peito, olho azul',
        hint: 'Características únicas que ajudem na identificação',
      },
      {
        name: 'pet_collar_description',
        label: 'Descrição da Coleira',
        type: 'text',
        placeholder: 'Ex: Coleira vermelha com nome "Max"',
      },
    ],
  },

  wallet: {
    category: 'wallet',
    label: 'Carteira',
    emoji: '👛',
    essentialFields: [
      {
        name: 'wallet_type',
        label: 'Tipo',
        type: 'select',
        options: [
          { value: 'leather', label: 'Couro' },
          { value: 'fabric', label: 'Tecido' },
          { value: 'plastic', label: 'Plástico' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'wallet_color',
        label: 'Cor',
        type: 'color',
      },
      {
        name: 'wallet_brand',
        label: 'Marca (se houver)',
        type: 'text',
        placeholder: 'Ex: Gucci, Louis Vuitton, Fossil',
        required: false,
      },
    ],
    optionalFields: [
      {
        name: 'wallet_contents',
        label: 'Conteúdo Importante',
        type: 'textarea',
        placeholder: 'Ex: Cartão de crédito com nome "João Silva", RG com número...',
        hint: 'Informações que ajudem a identificar o proprietário',
      },
      {
        name: 'wallet_distinguishing_marks',
        label: 'Marcas Distintivas',
        type: 'textarea',
        placeholder: 'Ex: Iníciais bordadas, rasgo na lateral, adesivo interno',
      },
    ],
  },

  document: {
    category: 'document',
    label: 'Documento',
    emoji: '📄',
    essentialFields: [
      {
        name: 'document_type',
        label: 'Tipo de Documento',
        type: 'select',
        options: [
          { value: 'rg', label: 'RG' },
          { value: 'cpf', label: 'CPF' },
          { value: 'passport', label: 'Passaporte' },
          { value: 'drivers_license', label: 'Carteira de Motorista' },
          { value: 'work_card', label: 'Carteira de Trabalho' },
          { value: 'student_id', label: 'Carteirinha de Estudante' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'document_owner_name',
        label: 'Nome do titular',
        type: 'text',
        placeholder: 'Nome como está no documento',
        hint: 'Este nome aparecerá publicamente na página do objeto, para quem achar o documento reconhecer o titular.',
        maxLength: 100,
      },
      {
        name: 'document_last4',
        label: 'Últimos 4 dígitos do documento (opcional)',
        type: 'text',
        placeholder: 'Ex: 1234',
        hint: 'O número completo nunca é pedido nem mostrado. Aparece só como «final 1234».',
        maxLength: 4,
        inputMode: 'numeric',
      },
    ],
    // Órgão emissor e validade eram pedidos mas nunca enviados: não são mais pedidos.
    optionalFields: [],
  },

  keys: {
    category: 'keys',
    label: 'Chaves',
    emoji: '🔑',
    essentialFields: [
      {
        name: 'keys_count',
        label: 'Quantidade de Chaves',
        type: 'number',
        placeholder: '1, 2, 3...',
      },
      {
        name: 'keys_description',
        label: 'Descrição das Chaves',
        type: 'textarea',
        placeholder: 'Ex: 3 chaves de latão, uma com etiqueta azul com número 42',
      },
      {
        name: 'keys_color',
        label: 'Cor do Chaveiro',
        type: 'text',
        placeholder: 'Ex: Preto, Vermelho, Sem chaveiro',
        required: false,
      },
    ],
    optionalFields: [
      {
        name: 'keys_distinguishing_marks',
        label: 'Marcas Distintivas',
        type: 'textarea',
        placeholder: 'Ex: Etiqueta com nome, chaveiro de couro, corrente de prata',
      },
    ],
  },

  bike: {
    category: 'bike',
    label: 'Bicicleta',
    emoji: '🚲',
    essentialFields: [
      {
        name: 'bike_type',
        label: 'Tipo de Bicicleta',
        type: 'select',
        options: [
          { value: 'mountain', label: 'Mountain Bike' },
          { value: 'road', label: 'Bicicleta de Estrada' },
          { value: 'hybrid', label: 'Híbrida' },
          { value: 'bmx', label: 'BMX' },
          { value: 'cruiser', label: 'Cruiser' },
          { value: 'other', label: 'Outro' },
        ],
      },
      {
        name: 'bike_brand',
        label: 'Marca',
        type: 'text',
        placeholder: 'Ex: Caloi, Monark, Specialized',
      },
      {
        name: 'bike_color',
        label: 'Cor Principal',
        type: 'color',
      },
      {
        name: 'bike_size',
        label: 'Tamanho do Quadro',
        type: 'text',
        placeholder: 'Ex: 21", M, 56cm',
        required: false,
      },
    ],
    optionalFields: [
      {
        name: 'bike_serial',
        label: 'Número de Série',
        type: 'text',
        placeholder: 'Número de série do quadro',
      },
      {
        name: 'bike_gears',
        label: 'Número de Marchas',
        type: 'text',
        placeholder: 'Ex: 18, 21, 27',
      },
      {
        name: 'bike_distinguishing_marks',
        label: 'Marcas Distintivas',
        type: 'textarea',
        placeholder: 'Ex: Adesivo no quadro, pneu furado, corrente enferrujada',
      },
    ],
  },
};

/**
 * Retorna a configuração de campos para uma categoria
 */
export function getCategoryFieldConfig(category: string): CategoryFieldConfig | null {
  return CATEGORY_FIELDS[category] || null;
}

/**
 * Retorna todos os campos (essenciais + opcionais) para uma categoria
 */
export function getAllFieldsForCategory(category: string): FieldDefinition[] {
  const config = getCategoryFieldConfig(category);
  if (!config) return [];
  return [...config.essentialFields, ...config.optionalFields];
}
