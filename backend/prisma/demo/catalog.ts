import type { PaymentMethod } from '@prisma/client';

/**
 * Listas fixas da demonstração: nomes, endereços reais de São Paulo e da Grande
 * SP, navegadores e IPs. Nada aqui é de pessoa real — as combinações são
 * sorteadas pela seed.
 */

export const MALE_FIRST_NAMES = [
  'João', 'José', 'Carlos', 'Lucas', 'Gabriel', 'Rafael', 'Matheus', 'Felipe', 'Bruno', 'Thiago',
  'Rodrigo', 'Anderson', 'Leandro', 'Diego', 'Marcos', 'Paulo', 'Wesley', 'Wellington', 'Jefferson',
  'Vinícius', 'Gustavo', 'Leonardo', 'Daniel', 'Eduardo', 'Fábio', 'Renato', 'Alexandre', 'Márcio',
  'Everton', 'Cléber', 'Robson', 'Adriano', 'Fernando', 'Ricardo', 'Luiz', 'Antônio', 'Francisco',
  'Sérgio', 'Igor', 'Caio', 'Kaique', 'Kauã', 'Richard', 'Samuel', 'Henrique', 'Emerson', 'Edson',
  'Gilberto', 'Reginaldo', 'Douglas', 'Jonathan', 'Willian', 'Alan', 'Érick', 'Juliano', 'Maicon',
  'Luan', 'Davi', 'Pedro', 'Guilherme', 'Hugo', 'Otávio', 'Nathan', 'Cristiano', 'Valdir', 'Josué',
  'Elias', 'Moisés', 'Rogério', 'Ailton', 'Jailson', 'Genivaldo', 'Cícero', 'Raimundo', 'Edvaldo',
] as const;

export const FEMALE_FIRST_NAMES = [
  'Ana', 'Juliana', 'Patrícia', 'Camila', 'Fernanda', 'Amanda', 'Bruna', 'Jéssica', 'Aline', 'Tatiane',
  'Vanessa', 'Priscila', 'Letícia', 'Beatriz', 'Larissa', 'Débora', 'Simone', 'Viviane', 'Daniela', 'Carla',
] as const;

export const MALE_MIDDLE_NAMES = ['Henrique', 'Eduardo', 'Carlos', 'Luiz', 'Augusto', 'Vitor', 'Aparecido', 'Roberto', 'Gabriel', 'Felipe'] as const;
export const FEMALE_MIDDLE_NAMES = ['Cristina', 'Aparecida', 'Beatriz', 'Carolina', 'Fernanda', 'Luísa'] as const;

export const SURNAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
  'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira',
  'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes', 'Marques', 'Machado',
  'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Santana', 'Teixeira', 'Araújo', 'Moura',
  'Cavalcante', 'Monteiro', 'Batista', 'Pinto', 'Campos', 'Correia', 'Brito', 'Farias', 'Macedo',
  'Reis', 'Xavier', 'Conceição', 'Bezerra', 'Rezende', 'Queiroz', 'Siqueira', 'Prado', 'Barros',
  'Pires', 'Leite', 'Borges', 'Miranda', 'Tavares',
] as const;

/** Sobrenomes que costumam vir com "da"/"dos"/"de". */
export const SURNAME_PARTICLE: Record<string, string> = {
  Silva: 'da', Santos: 'dos', Oliveira: 'de', Souza: 'de', Conceição: 'da', Costa: 'da', Paula: 'de',
  Almeida: 'de', Jesus: 'de', Lima: 'de', Andrade: 'de', Freitas: 'de', Moura: 'de', Nascimento: 'do',
};

export interface District {
  district: string;
  city: string;
  cep: string; // 5 primeiros dígitos
  streets: string[];
}

/** Bairros da capital e cidades da Grande SP onde moram os entregadores. */
export const DISTRICTS: District[] = [
  { district: 'Itaquera', city: 'São Paulo', cep: '08210', streets: ['Avenida Itaquera', 'Rua Gregório Ramalho', 'Rua Victório Santim', 'Rua Américo Salvador Novelli'] },
  { district: 'Capão Redondo', city: 'São Paulo', cep: '05870', streets: ['Estrada de Itapecerica', 'Avenida Comendador Sant\'Anna', 'Rua Serra da Juruoca', 'Rua Luís Fernandes da Silva'] },
  { district: 'Santo Amaro', city: 'São Paulo', cep: '04745', streets: ['Avenida Adolfo Pinheiro', 'Rua Isabel Schmidt', 'Rua Paulo Eiró', 'Rua Barão do Rio Branco'] },
  { district: 'Tatuapé', city: 'São Paulo', cep: '03310', streets: ['Rua Tuiuti', 'Rua Itapura', 'Rua Serra de Botucatu', 'Rua Antônio de Barros'] },
  { district: 'Brasilândia', city: 'São Paulo', cep: '02845', streets: ['Avenida Deputado Cantídio Sampaio', 'Rua Parapuã', 'Estrada do Sabão', 'Rua Silvério Mendes'] },
  { district: 'Grajaú', city: 'São Paulo', cep: '04843', streets: ['Avenida Dona Belmira Marin', 'Estrada do Cocaia', 'Rua Giovanni Bononcini', 'Rua Manuel Guilherme dos Reis'] },
  { district: 'Penha', city: 'São Paulo', cep: '03634', streets: ['Rua Padre Benedito de Camargo', 'Avenida Gabriela Mistral', 'Rua Doutor João Ribeiro', 'Rua Santo Afonso'] },
  { district: 'Pirituba', city: 'São Paulo', cep: '02930', streets: ['Avenida Mutinga', 'Avenida Raimundo Pereira de Magalhães', 'Rua Doutor Sérgio Meira', 'Rua Cônego José Salomon'] },
  { district: 'Vila Mariana', city: 'São Paulo', cep: '04101', streets: ['Rua Domingos de Morais', 'Rua Vergueiro', 'Rua Joaquim Távora', 'Rua Humberto I'] },
  { district: 'Guaianases', city: 'São Paulo', cep: '08410', streets: ['Estrada Itaquera-Guaianases', 'Rua Hipólito de Camargo', 'Rua Salvador Gianetti', 'Rua Coronel Raul Humaitá Villa Nova'] },
  { district: 'Jardim Ângela', city: 'São Paulo', cep: '04929', streets: ['Estrada do M\'Boi Mirim', 'Rua Luiz Baldinato', 'Rua Alexandre Archipenko'] },
  { district: 'São Mateus', city: 'São Paulo', cep: '03962', streets: ['Avenida Mateo Bei', 'Avenida Ragueb Chohfi', 'Rua Cachoeira Utupanema'] },
  { district: 'Cidade Tiradentes', city: 'São Paulo', cep: '08470', streets: ['Avenida dos Metalúrgicos', 'Rua Inácio Monteiro', 'Rua Sara Kubitschek'] },
  { district: 'Vila Prudente', city: 'São Paulo', cep: '03136', streets: ['Avenida Professor Luiz Ignácio Anhaia Mello', 'Rua Ibitirama', 'Rua do Orfanato'] },
  { district: 'Sapopemba', city: 'São Paulo', cep: '03928', streets: ['Avenida Sapopemba', 'Rua Arquiteto Vilanova Artigas', 'Rua Manuel Quirino de Mattos'] },
  { district: 'Freguesia do Ó', city: 'São Paulo', cep: '02911', streets: ['Avenida Itaberaba', 'Rua Crasso', 'Largo da Matriz de Nossa Senhora do Ó'] },
  { district: 'Vila Maria', city: 'São Paulo', cep: '02116', streets: ['Avenida Guilherme Cotching', 'Rua Curuçá', 'Rua Araritaguaba'] },
  { district: 'Campo Limpo', city: 'São Paulo', cep: '05765', streets: ['Estrada do Campo Limpo', 'Rua Doutor Luiz da Fonseca Galvão', 'Avenida Carlos Lacerda'] },
  { district: 'Cidade Ademar', city: 'São Paulo', cep: '04403', streets: ['Avenida Cupecê', 'Rua Mário Lago', 'Avenida Yervant Kissajikian'] },
  { district: 'Ermelino Matarazzo', city: 'São Paulo', cep: '03812', streets: ['Avenida Paranaguá', 'Rua Abel Tavares', 'Avenida São Miguel'] },
  { district: 'Jabaquara', city: 'São Paulo', cep: '04346', streets: ['Avenida Engenheiro Armando de Arruda Pereira', 'Rua Nelson Fernandes', 'Rua das Rosas'] },
  { district: 'Lapa', city: 'São Paulo', cep: '05069', streets: ['Rua Guaicurus', 'Rua Clélia', 'Rua Doze de Outubro'] },
  { district: 'Centro', city: 'Guarulhos', cep: '07011', streets: ['Avenida Salgado Filho', 'Rua Dom Pedro II', 'Avenida Tiradentes'] },
  { district: 'Centro', city: 'Osasco', cep: '06010', streets: ['Avenida dos Autonomistas', 'Rua Antônio Agu', 'Rua Primitiva Vianco'] },
  { district: 'Centro', city: 'Diadema', cep: '09911', streets: ['Avenida Alda', 'Rua Manoel da Nóbrega', 'Avenida Antônio Piranga'] },
  { district: 'Centro', city: 'Santo André', cep: '09010', streets: ['Rua Coronel Oliveira Lima', 'Avenida Portugal', 'Rua Senador Flaquer'] },
  { district: 'Rudge Ramos', city: 'São Bernardo do Campo', cep: '09636', streets: ['Rua Alfeu Tavares', 'Avenida Caminho do Mar', 'Rua Rio Branco'] },
  { district: 'Jardim Maria Rosa', city: 'Taboão da Serra', cep: '06763', streets: ['Rua Cesário Dau', 'Avenida Aprígio Bezerra da Silva', 'Estrada São Francisco'] },
  { district: 'Vila Dirce', city: 'Carapicuíba', cep: '06310', streets: ['Avenida Rui Barbosa', 'Rua São Pedro', 'Estrada Ernestina Vieira'] },
];

export const COMPLEMENTS = ['Casa 2', 'Fundos', 'Apto 12', 'Apto 34 Bloco B', 'Casa 1', 'Bloco C Apto 21', 'Sobrado'] as const;

export const EMAIL_DOMAINS: readonly (readonly [string, number])[] = [
  ['gmail.com', 60],
  ['hotmail.com', 20],
  ['outlook.com', 10],
  ['yahoo.com.br', 5],
  ['icloud.com', 5],
];

export const DESKTOP_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
] as const;

export const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 14; SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; moto g54 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; 23108RN04Y) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 12; SM-A325M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
] as const;

/** Prefixos de IP de operadoras brasileiras (fixo e móvel). */
export const IP_PREFIXES = ['177.92', '177.37', '189.40', '189.62', '191.13', '179.108', '201.17', '187.54'] as const;

/** Meios de pagamento das parcelas (PIX domina). */
export const METHOD_WEIGHTS: readonly (readonly [PaymentMethod, number])[] = [
  ['PIX', 65],
  ['CASH', 12],
  ['BANK_TRANSFER', 8],
  ['DEBIT_CARD', 8],
  ['CREDIT_CARD', 7],
];
