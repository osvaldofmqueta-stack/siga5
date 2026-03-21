import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Platform, Dimensions, FlatList, Image,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useConfig } from '@/context/ConfigContext';

// ─── Types ─────────────────────────────────────────────────────────────────

type DocTipo = 'declaracao' | 'certificado' | 'atestado' | 'oficio' | 'pauta' | 'pauta_final' | 'ficha_matricula' | 'outro';
type Mode = 'list' | 'editor' | 'emit';

interface DocTemplate {
  id: string;
  nome: string;
  tipo: DocTipo;
  conteudo: string;
  criadoEm: string;
  atualizadoEm: string;
  insigniaBase64?: string;
  marcaAguaBase64?: string;
  classeAlvo?: string;
}

// ─── Variables definition ───────────────────────────────────────────────────

const VARIABLE_GROUPS = [
  {
    grupo: 'Aluno',
    icon: 'person',
    cor: Colors.info,
    vars: [
      { tag: '{{NOME_COMPLETO}}', desc: 'Nome e apelido completos', exemplo: 'João Manuel Silva' },
      { tag: '{{NOME}}', desc: 'Primeiro nome', exemplo: 'João' },
      { tag: '{{APELIDO}}', desc: 'Apelido', exemplo: 'Silva' },
      { tag: '{{DATA_NASCIMENTO}}', desc: 'Data de nascimento', exemplo: '15/03/2005' },
      { tag: '{{GENERO}}', desc: 'Género', exemplo: 'Masculino' },
      { tag: '{{PROVINCIA}}', desc: 'Província de naturalidade', exemplo: 'Luanda' },
      { tag: '{{MUNICIPIO}}', desc: 'Município / Naturalidade', exemplo: 'Belas' },
      { tag: '{{NUMERO_MATRICULA}}', desc: 'Número de matrícula', exemplo: '2025001' },
      { tag: '{{NOME_ENCARREGADO}}', desc: 'Nome do encarregado de educação', exemplo: 'Manuel Silva' },
      { tag: '{{TELEFONE_ENCARREGADO}}', desc: 'Telefone do encarregado', exemplo: '+244 923 456 789' },
    ],
  },
  {
    grupo: 'Turma',
    icon: 'people',
    cor: Colors.success,
    vars: [
      { tag: '{{TURMA}}', desc: 'Nome da turma', exemplo: '10ª A' },
      { tag: '{{CLASSE}}', desc: 'Classe', exemplo: '10ª Classe' },
      { tag: '{{NIVEL}}', desc: 'Nível de ensino', exemplo: 'II Ciclo' },
      { tag: '{{TURNO}}', desc: 'Turno', exemplo: 'Manhã' },
      { tag: '{{ANO_LECTIVO}}', desc: 'Ano lectivo', exemplo: '2025' },
    ],
  },
  {
    grupo: 'Escola',
    icon: 'school',
    cor: Colors.gold,
    vars: [
      { tag: '{{NOME_ESCOLA}}', desc: 'Nome da escola', exemplo: 'Escola Secundária N.º 1' },
      { tag: '{{NOME_DIRECTOR}}', desc: 'Nome do Director', exemplo: 'António Gomes' },
    ],
  },
  {
    grupo: 'Data',
    icon: 'calendar',
    cor: Colors.warning,
    vars: [
      { tag: '{{DATA_ACTUAL}}', desc: 'Data actual completa', exemplo: '20 de Março de 2026' },
      { tag: '{{MES_ACTUAL}}', desc: 'Mês actual por extenso', exemplo: 'Março' },
      { tag: '{{ANO_ACTUAL}}', desc: 'Ano actual', exemplo: '2026' },
    ],
  },
  {
    grupo: 'Identificação',
    icon: 'card',
    cor: '#ec4899',
    vars: [
      { tag: '{{PAI}}', desc: 'Nome do pai', exemplo: 'Fernando Mpinge Kalute' },
      { tag: '{{MAE}}', desc: 'Nome da mãe', exemplo: 'Fernanda João' },
      { tag: '{{NATURALIDADE}}', desc: 'Local de nascimento', exemplo: 'Mucope Ombadja Xangongo' },
      { tag: '{{DIA_NASC}}', desc: 'Dia de nascimento', exemplo: '15' },
      { tag: '{{MES_NASC}}', desc: 'Mês de nascimento por extenso', exemplo: 'Março' },
      { tag: '{{ANO_NASC}}', desc: 'Ano de nascimento', exemplo: '2005' },
      { tag: '{{BI_NUMERO}}', desc: 'Número do Bilhete de Identidade', exemplo: '005895569555CE049' },
      { tag: '{{BI_DATA_EMISSAO}}', desc: 'Data de emissão do BI', exemplo: '03 de Janeiro de 2015' },
      { tag: '{{BI_LOCAL_EMISSAO}}', desc: 'Arquivo de identificação onde o BI foi emitido', exemplo: 'Luanda' },
      { tag: '{{ENCARREGADO_PROFISSAO}}', desc: 'Profissão do encarregado', exemplo: 'Professor' },
      { tag: '{{ENCARREGADO_LOCAL_TRABALHO}}', desc: 'Local de trabalho do encarregado', exemplo: 'Escola Primária N.º 5' },
      { tag: '{{ENCARREGADO_RESIDENCIA}}', desc: 'Residência do encarregado', exemplo: 'Rangel, Luanda' },
      { tag: '{{ENCARREGADO_CONTACTO2}}', desc: 'Segundo contacto do encarregado', exemplo: '+244 912 345 678' },
    ],
  },
  {
    grupo: 'Académico',
    icon: 'ribbon',
    cor: '#14b8a6',
    vars: [
      { tag: '{{AREA}}', desc: 'Área de estudos', exemplo: 'Ciências Económicas e Jurídicas' },
      { tag: '{{CICLO}}', desc: 'Ciclo de ensino', exemplo: 'IIº Ciclo' },
      { tag: '{{RESULTADO}}', desc: 'Resultado final', exemplo: 'APTO' },
      { tag: '{{RESULTADO_LETRA}}', desc: 'Resultado abreviado', exemplo: 'A' },
      { tag: '{{PAUTA_NUMERO}}', desc: 'Número da pauta', exemplo: '039' },
      { tag: '{{PROCESSO_NUMERO}}', desc: 'Número do processo', exemplo: '858' },
    ],
  },
  {
    grupo: 'Notas',
    icon: 'school',
    cor: '#f97316',
    vars: [
      { tag: '{{NOTA_LP}}', desc: 'Língua Portuguesa', exemplo: '14' },
      { tag: '{{NOTA_LE}}', desc: 'Língua Estrangeira', exemplo: '12' },
      { tag: '{{NOTA_MAT}}', desc: 'Matemática', exemplo: '12' },
      { tag: '{{NOTA_INF}}', desc: 'Informática', exemplo: '15' },
      { tag: '{{NOTA_EF}}', desc: 'Educação Física', exemplo: '16' },
      { tag: '{{NOTA_HIS}}', desc: 'História', exemplo: '11' },
      { tag: '{{NOTA_GEO}}', desc: 'Geografia', exemplo: '11' },
      { tag: '{{NOTA_INTRO_DIR}}', desc: 'Introdução ao Direito', exemplo: '14' },
      { tag: '{{NOTA_INTRO_ECO}}', desc: 'Introdução à Economia', exemplo: '11' },
      { tag: '{{NOTA_DIR}}', desc: 'Direito', exemplo: '13' },
      { tag: '{{NOTA_ECO}}', desc: 'Economia', exemplo: '12' },
      { tag: '{{NOTA_GEST}}', desc: 'Gestão de Empresas', exemplo: '13' },
      { tag: '{{NOTA_CONT}}', desc: 'Contabilidade', exemplo: '14' },
      { tag: '{{NOTA_FIL}}', desc: 'Filosofia', exemplo: '12' },
      { tag: '{{NOTA_DIR_COM}}', desc: 'Direito Comercial', exemplo: '13' },
      { tag: '{{NOTA_ECO_POL}}', desc: 'Economia Política', exemplo: '12' },
      { tag: '{{NOTA_CONT_GEST}}', desc: 'Contabilidade e Gestão', exemplo: '14' },
      { tag: '{{NOTA_EMPREEND}}', desc: 'Empreendedorismo', exemplo: '15' },
      { tag: '{{NOTA_DIR_EMP}}', desc: 'Direito Empresarial', exemplo: '13' },
      { tag: '{{NOTA_ECO_AV}}', desc: 'Economia Avançada', exemplo: '12' },
      { tag: '{{NOTA_GEST_FIN}}', desc: 'Gestão Financeira', exemplo: '14' },
      { tag: '{{NOTA_CONT_AV}}', desc: 'Contabilidade Avançada', exemplo: '13' },
    ],
  },
];

const TIPO_LABELS: Record<DocTipo, string> = {
  declaracao: 'Declaração',
  certificado: 'Certificado',
  atestado: 'Atestado',
  oficio: 'Ofício',
  pauta: 'Mini-Pauta',
  pauta_final: 'Pauta Final',
  ficha_matricula: 'Ficha de Matrícula',
  outro: 'Outro',
};
const TIPO_COLORS: Record<DocTipo, string> = {
  declaracao: Colors.info,
  certificado: Colors.gold,
  atestado: Colors.success,
  oficio: Colors.warning,
  pauta: '#8b5cf6',
  pauta_final: '#dc2626',
  ficha_matricula: '#0891b2',
  outro: Colors.textMuted,
};

const STORAGE_KEY = '@sgaa_doc_templates';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function genId() { return 'tpl_' + Date.now() + Math.random().toString(36).slice(2, 7); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Default / Seed Templates ────────────────────────────────────────────────

const SEED_GUIA_TRANSFERENCIA_ID = 'tpl_seed_guia_transferencia_v1';

const SEED_GUIA_TRANSFERENCIA: DocTemplate = {
  id: SEED_GUIA_TRANSFERENCIA_ID,
  nome: 'Guia de Transferência',
  tipo: 'outro',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `GUIA DE TRANSFERÊNCIA Nº ____/________

A pedido do seu encarregado de educação, eu {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}, venho por meio desta transferir o (a) aluno (a) {{NOME_COMPLETO}}, nascido(a) aos {{DATA_NASCIMENTO}}, filho(a) de {{NOME_ENCARREGADO}} e de ________________________________,

{{MUNICIPIO}}, Natural de {{MUNICIPIO}}, província de {{PROVINCIA}}, matriculado(a) na {{CLASSE}}.

É transferido(a) para ________________________________________________, município de __________________, província de __________________, com os seguintes documentos:

  › ___ Cópia (s) do bilhete, Cédula ou Certidão de nascimento.
  › ___ Fotografia (s).
  › ___ Certificado da 6ª Classe ou ficha de encaminhamento.
  › ___ Atestado Médico.
  › ___ Cartão de Vacina.
  › ___ Pauta / Declaração da 7ª Classe.
  › ___ Pauta / Declaração da 8ª Classe.

Por me ter solicitado, passou-se a presente guia de transferência que por mim vai assinado e autenticado com carimbo a óleo em uso nesta instituição Escolar.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_DECLARACAO_HABILITACOES_ID = 'tpl_seed_declaracao_habilitacoes_v1';

const SEED_DECLARACAO_HABILITACOES: DocTemplate = {
  id: SEED_DECLARACAO_HABILITACOES_ID,
  nome: 'Declaração de Habilitações',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

DECLARAÇÃO DE HABILITAÇÕES

{{NOME_DIRECTOR}}, Director(a) da {{NOME_ESCOLA}}, com Decreto de conjunto nº _________ Certifico que: {{NOME_COMPLETO}}, Filho (a) de {{NOME_ENCARREGADO}} e de ________________________________, nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{MUNICIPIO}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador (a) do B.I. nº _________________, passado pelo arquivo de identificação de _________________ aos _________.

Frequentou nesta Escola no Ano Lectivo de {{ANO_LECTIVO}} a ({{CLASSE}}) {{NOME_ESCOLA}}, {{NIVEL}}, na Área de _________________________________, com o resultado final de _________________ Sob a pauta nº _________ arquivado nesta Escola, com as seguintes classificações:

DISCIPLINA                                    | NOTA
----------------------------------------------|-------------------
Língua Portuguesa                             | _____ valores
Língua Estrangeira                            | _____ valores
Matemática                                    | _____ valores
Informática                                   | _____ valores
Educação Física                               | _____ valores
___________________________________           | _____ valores
___________________________________           | _____ valores
___________________________________           | _____ valores
___________________________________           | _____ valores

Por ser verdade, passou-se a presente DECLARAÇÃO que vai por mim assinado e autenticado com o carimbo a óleo em uso nesta Instituição de Ensino.

{{NOME_ESCOLA}} — {{MUNICIPIO}}, {{DATA_ACTUAL}}.`,
};

const SEED_CERTIFICADO_I_CICLO_ID = 'tpl_seed_certificado_i_ciclo_v1';

const SEED_CERTIFICADO_I_CICLO: DocTemplate = {
  id: SEED_CERTIFICADO_I_CICLO_ID,
  nome: 'Certificado — Iº Ciclo do Ensino Secundário',
  tipo: 'certificado',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
Iº CÍCLO DO ENSINO SECUNDÁRIO

CERTIFICADO

a) {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}, criado(a) sob Decreto Executivo nº _______ de _________________
Certifico que: {{NOME_COMPLETO}}, filho (a) de {{NOME_ENCARREGADO}} e de ________________________________, Nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{MUNICIPIO}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador (a) do B.I nº _________________, emitido aos _________________ pelo Arquivo de Identificação de _________________.

Concluiu no ano lectivo de {{ANO_LECTIVO}} o Iº CÍCLO DO ENSINO SECUNDÁRIO GERAL, {{NOME_ESCOLA}} sob o processo nº _______, Pauta nº _______, conforme o disposto na alínea (c) do artigo 109º da LBSEE 17/16, de 7 de Outubro, com a Média Final de _______ valores obtido nas seguintes classificações:

DISCIPLINA               | 7ª Cl. | 8ª Cl. | 9ª Cl. | Média | Por Extenso
-------------------------|--------|--------|--------|-------|------------------
Língua Portuguesa        |        |        |        |       |
Língua Inglesa           |        |        |        |       |
Língua Francesa          |        |        |        |       |
Matemática               |        |        |        |       |
Biologia                 |        |        |        |       |
Física                   |        |        |        |       |
Química                  |        |        |        |       |
Geografia                |        |        |        |       |
História                 |        |        |        |       |
Educação Física          |        |        |        |       |
Educação Moral e Cívica  |        |        |        |       |
Educação Visual e Plást. |        |        |        |       |
Educação Laboral         |        |        |        |       |
Emprendedorismo          |        |        |        |       |

Para efeitos legais lhe é passado o presente CERTIFICADO, que consta no livro de registo nº _______ Folha _______, assinado por mim e autenticado com o carimbo a óleo/selo branco em uso neste estabelecimento de ensino.

{{NOME_ESCOLA}} em {{MUNICIPIO}} aos, {{DATA_ACTUAL}}.`,
};

const SEED_MINI_PAUTA_ID = 'tpl_seed_mini_pauta_v1';

const SEED_MINI_PAUTA: DocTemplate = {
  id: SEED_MINI_PAUTA_ID,
  nome: 'Mini-Pauta (Modelo Manual)',
  tipo: 'pauta',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
{{NIVEL_ENSINO}}

{{NOME_ESCOLA}}
MINI-PAUTA

DISCIPLINA: {{DISCIPLINA}}        {{CLASSE}}ª CLASSE        TURMA: {{TURMA}}        ANO LECTIVO: {{ANO_LECTIVO}}

Nº | NOME COMPLETO                  | 1º TRIM.              | 2º TRIM.              | 3º TRIM.              | MFD | OBSERVAÇÃO
   |                                | MAC | NPP | NPT | MT1 | MAC | NPP | NPT | MT2 | MAC | NPP | NPT | MT3 |     |
---|--------------------------------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|------------
01 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
02 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
03 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
04 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
05 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
06 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
07 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
08 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
09 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
10 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
11 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
12 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
13 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
14 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
15 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
16 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
17 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
18 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
19 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
20 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
21 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
22 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
23 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
24 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
25 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
26 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
27 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
28 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
29 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
30 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
31 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
32 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
33 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
34 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
35 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
36 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
37 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
38 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
39 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
40 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
41 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
42 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
43 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
44 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |
45 |                                |     |     |     |     |     |     |     |     |     |     |     |     |     |

Legenda: MAC = Média Avaliações Contínuas | NPP = Nota Prova Parcial | NPT = Nota Prova Trimestral
         MT = Média Trimestral | MFD = Média Final do Ano

{{NOME_ESCOLA}}, {{MUNICIPIO}}, {{DATA_ACTUAL}}.

O PROFESSOR
_______________________________
{{NOME_PROFESSOR}}`,
};

const SEED_PAUTA_FINAL_ID = 'tpl_seed_pauta_final_v1';
const SEED_PAUTA_FINAL: DocTemplate = {
  id: SEED_PAUTA_FINAL_ID,
  nome: 'Pauta Final (por Turma)',
  tipo: 'pauta_final',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[PAUTA FINAL GERADA AUTOMATICAMENTE]

Este modelo gera automaticamente a Pauta Final completa com todos os alunos da turma seleccionada e as respectivas notas por disciplina e trimestre.

Ao emitir, seleccione a turma e o sistema irá:
• Listar todos os alunos ordenados por nome
• Preencher as notas por disciplina (MT1, MT2, MT3, MFD)
• Calcular a Média Final do Ano (MFD)
• Gerar o documento oficial em formato A3 paisagem

Cabeçalho: REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO
           PAUTA FINAL — {{CICLO}} DO ENSINO SECUNDÁRIO

Escola: {{NOME_ESCOLA}}  |  Classe: {{CLASSE}}  |  Turma: {{TURMA}}
Ano Lectivo: {{ANO_LECTIVO}}  |  Turno: {{TURNO}}

Assinado: {{NOME_DIRECTOR}} — Director(a)`,
};

const SEED_DECLARACAO_COM_NOTA_ID = 'tpl_seed_declaracao_com_nota_v1';

const SEED_DECLARACAO_COM_NOTA: DocTemplate = {
  id: SEED_DECLARACAO_COM_NOTA_ID,
  nome: 'Declaração com Nota (Ensino Primário)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

{{NOME_ESCOLA}}

DECLARAÇÃO

{{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}} em {{MUNICIPIO}}, {{PROVINCIA}}. Declara que {{NOME_COMPLETO}}, filho (a) de {{NOME_ENCARREGADO}} e de ________________________________, natural de {{MUNICIPIO}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, nascido (a) aos {{DATA_NASCIMENTO}}, portador (a) do B.I nº _________________, passado pelo arquivo de Identificação de _________________ aos _________.

Frequentou a {{CLASSE}} durante o ano lectivo de {{ANO_LECTIVO}} no Ensino Primário com o resultado final _________________ sob o processo nº _______ pauta nº _______ obtendo as seguintes notas descriminadas:

Disciplinas                   | Notas | Valores
------------------------------|-------|-------------------
Língua Portuguesa             |       | (          ) Valores
Matemática                    |       | (          ) Valores
Ciências da Natureza          |       | (          ) Valores
Educação Manual e Plástica    |       | (          ) Valores
Educação Músical              |       | (          ) Valores
Educação Moral e Cívica       |       | (          ) Valores
História                      |       | (          ) Valores
Geografia                     |       | (          ) Valores

OBS: Por ser verdade e assim constar, passou-se a presente Declaração, que vai por mim assinado e autenticado com o carimbo a óleo em uso nesta Instituição.

{{NOME_ESCOLA}} em {{MUNICIPIO}}, {{DATA_ACTUAL}}.`,
};

const SEED_DECLARACAO_HABILITACOES_PRIMARIO_ID = 'tpl_seed_declaracao_habilitacoes_primario_v1';

const SEED_DECLARACAO_HABILITACOES_PRIMARIO: DocTemplate = {
  id: SEED_DECLARACAO_HABILITACOES_PRIMARIO_ID,
  nome: 'Declaração de Habilitações (Ensino Primário)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `República de Angola
Ministério da Educação
{{NOME_ESCOLA}}

Declaração de Habilitações

Eu, {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}} Declaro que: {{NOME_COMPLETO}},
Filho (a) de {{NOME_ENCARREGADO}} E de ________________________________,
Natural de {{MUNICIPIO}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}},
Nascido (a) aos {{DATA_NASCIMENTO}},
portador (a) do bilhete de identificação ou cédula nº ________________________________ passado pelos arquivos de identificação de _________________ aos ___/___/_____

Frequentou o ano lectivo de {{ANO_LECTIVO}} E concluiu a {{CLASSE}} classe do Ensino Primário de Educação nesta Escola, conforme consta na Pauta _________________ livro nº _____________,
Sala _____________ Turma {{TURMA}} com a média final de _________________ obtidas nas seguintes classificações:

Língua Portuguesa ..............................................................................
Matemática .........................................................................................
Estudo do Meio ....................................................................................
Educação Manual e Plástica ..................................................................
Educação Musical .................................................................................
Educação Física ....................................................................................

Esta declaração é para efeito de matrícula.

Pela veracidade e autenticidade, passamos a presente declaração que vai por mim assinado e autenticado com carimbos a óleo em uso neste estabelecimento de ensino {{NOME_ESCOLA}}.

{{MUNICIPIO}}, {{DATA_ACTUAL}}.`,
};

// ─── Declaração com Nota — II Ciclo (10ª, 11ª, 12ª, 13ª) ───────────────────

const SEED_DECL_NOTA_10_ID = 'tpl_seed_decl_nota_10_v1';
const SEED_DECL_NOTA_10: DocTemplate = {
  id: SEED_DECL_NOTA_10_ID,
  nome: 'Declaração com Nota — 10ª Classe (IIº Ciclo)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

DECLARAÇÃO

a) {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}.

Declaro que {{NOME_COMPLETO}}, Filho (a) de {{PAI}} e de {{MAE}}, nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador do B.I ou Cédula Pessoal nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, passado pelo arquivo de Identificação de {{BI_LOCAL_EMISSAO}}.

Concluiu nesta Escola no Ano Lectivo de {{ANO_LECTIVO}} o {{CICLO}} do Ensino Secundário, 10ª Classe, na área de {{AREA}} com o resultado final de {{RESULTADO}} ({{RESULTADO_LETRA}}) no termo c, Pauta, nº {{PAUTA_NUMERO}}, A processa nº {{PROCESSO_NUMERO}} arquivada nesta Escola, com as seguintes classificações:

Disciplinas                          | 10ª Classe
-------------------------------------|-------------------
Língua Portuguesa                    | {{NOTA_LP}} Valores
Língua Estrangeira                   | {{NOTA_LE}} Valores
Matemática                           | {{NOTA_MAT}} Valores
Informática                          | {{NOTA_INF}} Valores
Educação Física                      | {{NOTA_EF}} Valores
História                             | {{NOTA_HIS}} Valores
Geografia                            | {{NOTA_GEO}} Valores
Introdução ao Direito                | {{NOTA_INTRO_DIR}} Valores
Introdução à Economia                | {{NOTA_INTRO_ECO}} Valores

Por ser verdade, passou-se o presente Declaração que vai assinado e autenticado com o carimbo a Óleo ou Branco, em uso nesta Escola.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_DECL_NOTA_11_ID = 'tpl_seed_decl_nota_11_v1';
const SEED_DECL_NOTA_11: DocTemplate = {
  id: SEED_DECL_NOTA_11_ID,
  nome: 'Declaração com Nota — 11ª Classe (IIº Ciclo)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

DECLARAÇÃO

a) {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}.

Declaro que {{NOME_COMPLETO}}, Filho (a) de {{PAI}} e de {{MAE}}, nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador do B.I ou Cédula Pessoal nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, passado pelo arquivo de Identificação de {{BI_LOCAL_EMISSAO}}.

Concluiu nesta Escola no Ano Lectivo de {{ANO_LECTIVO}} o {{CICLO}} do Ensino Secundário, 11ª Classe, na área de {{AREA}} com o resultado final de {{RESULTADO}} ({{RESULTADO_LETRA}}) no termo c, Pauta, nº {{PAUTA_NUMERO}}, A processa nº {{PROCESSO_NUMERO}} arquivada nesta Escola, com as seguintes classificações:

Disciplinas                          | 11ª Classe
-------------------------------------|-------------------
Língua Portuguesa                    | {{NOTA_LP}} Valores
Língua Estrangeira                   | {{NOTA_LE}} Valores
Matemática                           | {{NOTA_MAT}} Valores
Informática                          | {{NOTA_INF}} Valores
Educação Física                      | {{NOTA_EF}} Valores
Direito                              | {{NOTA_DIR}} Valores
Economia                             | {{NOTA_ECO}} Valores
Gestão de Empresas                   | {{NOTA_GEST}} Valores
Contabilidade                        | {{NOTA_CONT}} Valores

Por ser verdade, passou-se o presente Declaração que vai assinado e autenticado com o carimbo a Óleo ou Branco, em uso nesta Escola.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_DECL_NOTA_12_ID = 'tpl_seed_decl_nota_12_v1';
const SEED_DECL_NOTA_12: DocTemplate = {
  id: SEED_DECL_NOTA_12_ID,
  nome: 'Declaração com Nota — 12ª Classe (IIº Ciclo)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

DECLARAÇÃO

a) {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}.

Declaro que {{NOME_COMPLETO}}, Filho (a) de {{PAI}} e de {{MAE}}, nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador do B.I ou Cédula Pessoal nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, passado pelo arquivo de Identificação de {{BI_LOCAL_EMISSAO}}.

Concluiu nesta Escola no Ano Lectivo de {{ANO_LECTIVO}} o {{CICLO}} do Ensino Secundário, 12ª Classe, na área de {{AREA}} com o resultado final de {{RESULTADO}} ({{RESULTADO_LETRA}}) no termo c, Pauta, nº {{PAUTA_NUMERO}}, A processa nº {{PROCESSO_NUMERO}} arquivada nesta Escola, com as seguintes classificações:

Disciplinas                          | 12ª Classe
-------------------------------------|-------------------
Língua Portuguesa                    | {{NOTA_LP}} Valores
Língua Estrangeira                   | {{NOTA_LE}} Valores
Matemática                           | {{NOTA_MAT}} Valores
Filosofia                            | {{NOTA_FIL}} Valores
Educação Física                      | {{NOTA_EF}} Valores
Direito Comercial                    | {{NOTA_DIR_COM}} Valores
Economia Política                    | {{NOTA_ECO_POL}} Valores
Contabilidade e Gestão               | {{NOTA_CONT_GEST}} Valores
Empreendedorismo                     | {{NOTA_EMPREEND}} Valores

Por ser verdade, passou-se o presente Declaração que vai assinado e autenticado com o carimbo a Óleo ou Branco, em uso nesta Escola.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_DECL_NOTA_13_ID = 'tpl_seed_decl_nota_13_v1';
const SEED_DECL_NOTA_13: DocTemplate = {
  id: SEED_DECL_NOTA_13_ID,
  nome: 'Declaração com Nota — 13ª Classe (Pré-Universitário)',
  tipo: 'declaracao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `REPÚBLICA DE ANGOLA
MINISTÉRIO DA EDUCAÇÃO
ENSINO GERAL

DECLARAÇÃO

a) {{NOME_DIRECTOR}}, Director(a) do {{NOME_ESCOLA}}.

Declaro que {{NOME_COMPLETO}}, Filho (a) de {{PAI}} e de {{MAE}}, nascido (a) aos {{DATA_NASCIMENTO}}, natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}, portador do B.I ou Cédula Pessoal nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, passado pelo arquivo de Identificação de {{BI_LOCAL_EMISSAO}}.

Concluiu nesta Escola no Ano Lectivo de {{ANO_LECTIVO}} o {{CICLO}} do Ensino Secundário, 13ª Classe, na área de {{AREA}} com o resultado final de {{RESULTADO}} ({{RESULTADO_LETRA}}) no termo c, Pauta, nº {{PAUTA_NUMERO}}, A processa nº {{PROCESSO_NUMERO}} arquivada nesta Escola, com as seguintes classificações:

Disciplinas                          | 13ª Classe
-------------------------------------|-------------------
Língua Portuguesa                    | {{NOTA_LP}} Valores
Língua Estrangeira                   | {{NOTA_LE}} Valores
Matemática                           | {{NOTA_MAT}} Valores
Filosofia                            | {{NOTA_FIL}} Valores
Educação Física                      | {{NOTA_EF}} Valores
Direito Empresarial                  | {{NOTA_DIR_EMP}} Valores
Economia Avançada                    | {{NOTA_ECO_AV}} Valores
Gestão Financeira                    | {{NOTA_GEST_FIN}} Valores
Contabilidade Avançada               | {{NOTA_CONT_AV}} Valores

Por ser verdade, passou-se o presente Declaração que vai assinado e autenticado com o carimbo a Óleo ou Branco, em uso nesta Escola.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

// ─── Disciplina → Note variable mapping ────────────────────────────────────

const DISCIPLINA_NOTA_MAP: Record<string, string[]> = {
  '{{NOTA_LP}}': ['língua portuguesa', 'lingua portuguesa', 'português', 'portugues'],
  '{{NOTA_LE}}': ['língua estrangeira', 'lingua estrangeira', 'inglês', 'ingles', 'francês', 'frances', 'língua inglesa', 'língua francesa'],
  '{{NOTA_MAT}}': ['matemática', 'matematica'],
  '{{NOTA_INF}}': ['informática', 'informatica'],
  '{{NOTA_EF}}': ['educação física', 'educacao fisica', 'ed. física', 'ed. fisica'],
  '{{NOTA_HIS}}': ['história', 'historia'],
  '{{NOTA_GEO}}': ['geografia'],
  '{{NOTA_INTRO_DIR}}': ['introdução ao direito', 'introducao ao direito', 'intro. ao direito'],
  '{{NOTA_INTRO_ECO}}': ['introdução à economia', 'introducao a economia', 'intro. à economia', 'intro. a economia'],
  '{{NOTA_DIR}}': ['direito'],
  '{{NOTA_ECO}}': ['economia'],
  '{{NOTA_GEST}}': ['gestão de empresas', 'gestao de empresas'],
  '{{NOTA_CONT}}': ['contabilidade'],
  '{{NOTA_FIL}}': ['filosofia'],
  '{{NOTA_DIR_COM}}': ['direito comercial'],
  '{{NOTA_ECO_POL}}': ['economia política', 'economia politica'],
  '{{NOTA_CONT_GEST}}': ['contabilidade e gestão', 'contabilidade e gestao'],
  '{{NOTA_EMPREEND}}': ['empreendedorismo'],
  '{{NOTA_DIR_EMP}}': ['direito empresarial'],
  '{{NOTA_ECO_AV}}': ['economia avançada', 'economia avancada'],
  '{{NOTA_GEST_FIN}}': ['gestão financeira', 'gestao financeira'],
  '{{NOTA_CONT_AV}}': ['contabilidade avançada', 'contabilidade avancada'],
};

// ─── Certificado ITAQ — 13ª Classe (Técnico-Profissional) ───────────────────

const SEED_CERT_ITAQ_13_ID = 'tpl_seed_cert_itaq_13_v1';
const SEED_CERT_ITAQ_13: DocTemplate = {
  id: SEED_CERT_ITAQ_13_ID,
  nome: 'Certificado de Habilitações — ITAQ 13ª (Técnico-Profissional)',
  tipo: 'certificado',
  classeAlvo: '13ª-ITAQ',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `CERTIFICADO — IIº CICLO ENSINO SECUNDÁRIO TÉCNICO (ITAQ)

Director(a): {{NOME_DIRECTOR}} — {{NOME_ESCOLA}}
Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}} de {{MES_NASC}} de {{ANO_NASC}}
Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}
BI nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, Arquivo de {{BI_LOCAL_EMISSAO}}

Concluiu no Ano Lectivo {{ANO_LECTIVO}} o IIº Ciclo Ensino Secundário Técnico
Especialidade: {{AREA}}

Componente Sociocultural: LP, LE, Formação de Actitudes Integradoras, EF
Componente Científica: Matemática, Física, Química, Biologia
Componente Técnica: Informática, Empreendedorismo, Agricultura Geral, etc.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

// ─── Certificados de Habilitações — II Ciclo (11ª, 12ª, 13ª) ────────────────

const SEED_CERT_HAB_11_ID = 'tpl_seed_cert_hab_11_v1';
const SEED_CERT_HAB_11: DocTemplate = {
  id: SEED_CERT_HAB_11_ID,
  nome: 'Certificado de Habilitações — 11ª Classe',
  tipo: 'certificado',
  classeAlvo: '11ª',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `CERTIFICADO DE HABILITAÇÕES — 11ª Classe (IIº Ciclo)

Director(a): {{NOME_DIRECTOR}} — {{NOME_ESCOLA}}
Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}} de {{MES_NASC}} de {{ANO_NASC}}
Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}
BI nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, Arquivo de {{BI_LOCAL_EMISSAO}}

Concluiu no Ano Lectivo de {{ANO_LECTIVO}} o IIº Ciclo — 11ª Classe
Área: {{AREA}} | Média Final: {{RESULTADO}} ({{RESULTADO_LETRA}})
Pauta nº {{PAUTA_NUMERO}} | Processo nº {{PROCESSO_NUMERO}}

Disciplinas: LP, LE, MAT, INF, EF, Direito, Economia, Gestão, Contabilidade

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_CERT_HAB_12_ID = 'tpl_seed_cert_hab_12_v1';
const SEED_CERT_HAB_12: DocTemplate = {
  id: SEED_CERT_HAB_12_ID,
  nome: 'Certificado de Habilitações — 12ª Classe',
  tipo: 'certificado',
  classeAlvo: '12ª',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `CERTIFICADO DE HABILITAÇÕES — 12ª Classe (IIº Ciclo)

Director(a): {{NOME_DIRECTOR}} — {{NOME_ESCOLA}}
Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}} de {{MES_NASC}} de {{ANO_NASC}}
Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}
BI nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, Arquivo de {{BI_LOCAL_EMISSAO}}

Concluiu no Ano Lectivo de {{ANO_LECTIVO}} o IIº Ciclo — 12ª Classe
Área: {{AREA}} | Média Final: {{RESULTADO}} ({{RESULTADO_LETRA}})
Pauta nº {{PAUTA_NUMERO}} | Processo nº {{PROCESSO_NUMERO}}

Disciplinas: LP, LE, MAT, FIL, EF, Dir. Comercial, Eco. Política, Cont. e Gestão, Empreendedorismo

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_CERT_HAB_13_ID = 'tpl_seed_cert_hab_13_v1';
const SEED_CERT_HAB_13: DocTemplate = {
  id: SEED_CERT_HAB_13_ID,
  nome: 'Certificado de Habilitações — 13ª Classe (Pré-Universitário)',
  tipo: 'certificado',
  classeAlvo: '13ª',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `CERTIFICADO DE HABILITAÇÕES — 13ª Classe (Pré-Universitário)

Director(a): {{NOME_DIRECTOR}} — {{NOME_ESCOLA}}
Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}} de {{MES_NASC}} de {{ANO_NASC}}
Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}
BI nº {{BI_NUMERO}}, emitido aos {{BI_DATA_EMISSAO}}, Arquivo de {{BI_LOCAL_EMISSAO}}

Concluiu no Ano Lectivo de {{ANO_LECTIVO}} o IIº Ciclo — 13ª Classe
Área: {{AREA}} | Média Final: {{RESULTADO}} ({{RESULTADO_LETRA}})
Pauta nº {{PAUTA_NUMERO}} | Processo nº {{PROCESSO_NUMERO}}

Disciplinas: LP, LE, MAT, FIL, EF, Dir. Empresarial, Eco. Avançada, Gestão Financeira, Cont. Avançada

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

// ─── Ficha de Matrícula Seed ─────────────────────────────────────────────────

const SEED_FICHA_MATRICULA_ID = 'tpl_seed_ficha_matricula_v1';

const SEED_FICHA_MATRICULA: DocTemplate = {
  id: SEED_FICHA_MATRICULA_ID,
  nome: 'Ficha de Reconfirmação de Matrícula',
  tipo: 'ficha_matricula',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `FICHA DE RECONFIRMAÇÃO DE MATRÍCULA

Nome do Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}} de {{MES_NASC}} de {{ANO_NASC}} Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}
Província de {{PROVINCIA}} portador(a) do B.I ou Cédula pessoal nº {{BI_NUMERO}}
emitido aos {{BI_DATA_EMISSAO}} pela direcção nacional de identificação
ou conservatória de registo civil de {{BI_LOCAL_EMISSAO}}.

Nome do encarregado: {{NOME_ENCARREGADO}}
Profissão: {{ENCARREGADO_PROFISSAO}}    Local de trabalho: {{ENCARREGADO_LOCAL_TRABALHO}}
Residência: {{ENCARREGADO_RESIDENCIA}}
Contactos: {{TELEFONE_ENCARREGADO}} ou {{ENCARREGADO_CONTACTO2}}

Classe actual: {{CLASSE}}   Turma: {{TURMA}}   Ano Lectivo: {{ANO_LECTIVO}}

──────────────────────────────────────────────
FREQUÊNCIA ESCOLAR DO ALUNO
──────────────────────────────────────────────

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}`,
};

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function EditorDocumentos() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, turmas, notas } = useData();
  const { config } = useConfig();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const [mode, setMode] = useState<Mode>('list');
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<DocTemplate | null>(null);
  const [editorNome, setEditorNome] = useState('');
  const [editorTipo, setEditorTipo] = useState<DocTipo>('declaracao');
  const [editorContent, setEditorContent] = useState('');
  const [editorInsignia, setEditorInsignia] = useState<string | undefined>(undefined);
  const [editorMarcaAgua, setEditorMarcaAgua] = useState<string | undefined>(undefined);
  const [showVarsPanel, setShowVarsPanel] = useState(true);
  const [showAppearPanel, setShowAppearPanel] = useState(true);
  const [activeVarGroup, setActiveVarGroup] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Emit state
  const [emitTemplate, setEmitTemplate] = useState<DocTemplate | null>(null);
  const [emitAlunoId, setEmitAlunoId] = useState('');
  const [emitPreview, setEmitPreview] = useState('');
  const [alunoSearch, setAlunoSearch] = useState('');
  // Pauta Final emit state (turma-level)
  const [emitTurmaId, setEmitTurmaId] = useState('');
  const [turmaSearch, setTurmaSearch] = useState('');

  const inputRef = useRef<TextInput>(null);

  // Load templates + seed defaults
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(async raw => {
      let list: DocTemplate[] = raw ? JSON.parse(raw) : [];

      // Inject seed templates if not yet present
      const seeds = [SEED_CERT_ITAQ_13, SEED_CERT_HAB_13, SEED_CERT_HAB_12, SEED_CERT_HAB_11, SEED_FICHA_MATRICULA, SEED_PAUTA_FINAL, SEED_DECL_NOTA_10, SEED_DECL_NOTA_11, SEED_DECL_NOTA_12, SEED_DECL_NOTA_13, SEED_MINI_PAUTA, SEED_DECLARACAO_COM_NOTA, SEED_CERTIFICADO_I_CICLO, SEED_DECLARACAO_HABILITACOES_PRIMARIO, SEED_DECLARACAO_HABILITACOES, SEED_GUIA_TRANSFERENCIA];
      let changed = false;
      for (const seed of seeds) {
        if (!list.find(t => t.id === seed.id)) {
          list = [seed, ...list];
          changed = true;
        }
      }
      if (changed) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }

      setTemplates(list);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  async function saveTemplates(list: DocTemplate[]) {
    setTemplates(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function openNew() {
    setEditingTemplate(null);
    setEditorNome('Novo Documento');
    setEditorTipo('declaracao');
    setEditorContent('');
    setEditorInsignia(undefined);
    setEditorMarcaAgua(undefined);
    setShowVarsPanel(true);
    setShowAppearPanel(true);
    setMode('editor');
  }

  function openEdit(t: DocTemplate) {
    setEditingTemplate(t);
    setEditorNome(t.nome);
    setEditorTipo(t.tipo);
    setEditorContent(t.conteudo);
    setEditorInsignia(t.insigniaBase64);
    setEditorMarcaAgua(t.marcaAguaBase64);
    setShowVarsPanel(true);
    setShowAppearPanel(true);
    setMode('editor');
  }

  async function saveTemplate() {
    if (!editorNome.trim()) return;
    setIsSaving(true);
    const now = new Date().toISOString();
    let updated: DocTemplate[];
    if (editingTemplate) {
      updated = templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, nome: editorNome.trim(), tipo: editorTipo, conteudo: editorContent, atualizadoEm: now, insigniaBase64: editorInsignia, marcaAguaBase64: editorMarcaAgua }
          : t
      );
    } else {
      const novo: DocTemplate = {
        id: genId(), nome: editorNome.trim(), tipo: editorTipo,
        conteudo: editorContent, criadoEm: now, atualizadoEm: now,
        insigniaBase64: editorInsignia, marcaAguaBase64: editorMarcaAgua,
      };
      updated = [novo, ...templates];
    }
    await saveTemplates(updated);
    setIsSaving(false);
    setMode('list');
  }

  // ─── Image picker (web: file input; native: expo-image-picker) ──────────────
  function pickImageWeb(onPick: (base64: string) => void) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        onPick(result);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function pickImageNative(onPick: (base64: string) => void) {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        onPick(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {}
  }

  function pickImage(onPick: (base64: string) => void) {
    if (Platform.OS === 'web') {
      pickImageWeb(onPick);
    } else {
      pickImageNative(onPick);
    }
  }

  async function deleteTemplate(id: string) {
    const updated = templates.filter(t => t.id !== id);
    await saveTemplates(updated);
  }

  function openEmit(t: DocTemplate) {
    setEmitTemplate(t);
    setEmitAlunoId('');
    setEmitPreview('');
    setAlunoSearch('');
    setEmitTurmaId('');
    setTurmaSearch('');
    setMode('emit');
  }

  // Helper: checks if this template uses turma-level emit (pauta types)
  function isPautaType(t: DocTemplate | null) {
    return t?.tipo === 'pauta' || t?.tipo === 'pauta_final';
  }

  // ─── Pauta Final HTML Builder ──────────────────────────────────────────────

  function buildPautaFinalHtml(turmaId: string): string {
    const turma = turmas.find(t => t.id === turmaId);
    if (!turma) return '';

    const now = new Date();
    const alunosDaTurma = alunos
      .filter(a => a.ativo && a.turmaId === turmaId)
      .sort((a, b) => `${a.nome} ${a.apelido}`.localeCompare(`${b.nome} ${b.apelido}`));

    const notasDaTurma = notas.filter(n => n.turmaId === turmaId);

    // Collect all unique disciplines (preserving order of first occurrence)
    const disciplinasSet: string[] = [];
    for (const n of notasDaTurma) {
      if (!disciplinasSet.includes(n.disciplina)) disciplinasSet.push(n.disciplina);
    }
    const disciplinas = disciplinasSet.sort((a, b) => a.localeCompare(b));

    // Helper: get nota for student × disciplina × trimestre
    function getMT(alunoId: string, disc: string, trim: number): string {
      const n = notasDaTurma.find(x => x.alunoId === alunoId && x.disciplina === disc && x.trimestre === trim);
      return n ? String(Math.round(n.mt1)) : '';
    }
    function getMFD(alunoId: string, disc: string): string {
      const ns = notasDaTurma.filter(x => x.alunoId === alunoId && x.disciplina === disc);
      if (ns.length === 0) return '';
      // Use nf from any record (should be same) or calculate average MT
      const withNf = ns.find(x => x.nf);
      if (withNf) return String(Math.round(withNf.nf));
      const mts = ns.map(x => x.mt1).filter(v => v > 0);
      if (mts.length === 0) return '';
      return String(Math.round(mts.reduce((a, b) => a + b, 0) / mts.length));
    }

    const cicloMap: Record<string, string> = {
      'Primário': 'ENSINO PRIMÁRIO',
      'I Ciclo': 'Iº CICLO',
      'II Ciclo': 'IIº CICLO',
    };
    const ciclo = cicloMap[turma.nivel] || turma.nivel.toUpperCase();
    const escola = config.nomeEscola || '___________________________';
    const director = user?.nome || '___________________________';
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    // Build discipline header columns
    const disciplinaHeaders = disciplinas
      .map(d => `<th colspan="4" style="background:#f0f0f0;font-weight:bold;white-space:nowrap;">${d}</th>`)
      .join('');
    const subHeaders = disciplinas
      .map(() => `<th>MT1</th><th>MT2</th><th>MT3</th><th style="background:#fffde7;font-weight:bold;">MFD</th>`)
      .join('');

    // Build student rows
    const studentRows = alunosDaTurma.map((aluno, idx) => {
      const gradeCells = disciplinas.map(disc => {
        const mt1 = getMT(aluno.id, disc, 1);
        const mt2 = getMT(aluno.id, disc, 2);
        const mt3 = getMT(aluno.id, disc, 3);
        const mfd = getMFD(aluno.id, disc);
        const mfdNum = parseFloat(mfd);
        const mfdColor = mfdNum > 0 ? (mfdNum >= 10 ? '#1a7a1a' : '#c00000') : '#000';
        return `<td>${mt1}</td><td>${mt2}</td><td>${mt3}</td><td style="font-weight:bold;color:${mfdColor};">${mfd}</td>`;
      }).join('');
      return `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:left;padding-left:4px;white-space:nowrap;">${aluno.nome.toUpperCase()} ${aluno.apelido.toUpperCase()}</td>
        ${gradeCells}
        <td></td>
      </tr>`;
    }).join('');

    // Filler rows (up to at least 45 lines or the number of students, whichever is bigger)
    const fillerCount = Math.max(0, 45 - alunosDaTurma.length);
    const fillerRows = Array.from({ length: fillerCount }, (_, i) => {
      const emptyCells = disciplinas.map(() => `<td></td><td></td><td></td><td></td>`).join('');
      return `<tr style="height:18px;">
        <td style="text-align:center;">${alunosDaTurma.length + i + 1}</td>
        <td></td>
        ${emptyCells}
        <td></td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Pauta Final — ${turma.classe} ${turma.nome} ${turma.anoLetivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 7.5px; margin: 10px; color: #000; }
    .page-header { text-align: center; margin-bottom: 6px; }
    .page-header p { margin: 1px 0; }
    .page-header .title { font-size: 9px; font-weight: bold; margin: 3px 0; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; margin-bottom: 6px; font-size: 7.5px; border: 1px solid #000; }
    .info-row { display: flex; gap: 4px; padding: 2px 4px; border-bottom: 1px solid #ccc; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: bold; white-space: nowrap; }
    .info-line { flex: 1; border-bottom: 1px solid #333; min-width: 40px; }
    .visto-block { position: absolute; top: 10px; left: 10px; font-size: 7px; border: 1px solid #000; padding: 4px 8px; min-width: 120px; text-align: center; }
    .main-table { border-collapse: collapse; width: 100%; font-size: 6.5px; }
    .main-table th, .main-table td { border: 1px solid #000; padding: 1px 2px; text-align: center; }
    .main-table .name-col { text-align: left; min-width: 110px; max-width: 140px; }
    .main-table .num-col { width: 18px; }
    .disc-section { font-size: 9px; font-weight: bold; text-align: center; margin: 3px 0 2px; text-transform: uppercase; letter-spacing: 1px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 16px; font-size: 7px; }
    .sig-block { text-align: center; min-width: 180px; }
    .sig-line { width: 160px; border-top: 1px solid #000; margin: 20px auto 3px; }
    @media print { @page { size: A3 landscape; margin: 8mm; } body { margin: 0; font-size: 7px; } }
  </style>
</head>
<body>
  <div style="position:relative;">
    <div class="visto-block">
      <p><strong>VISTO</strong></p>
      <p>Data ___/___/______</p>
      <br/>
      <p>A Chefe de Repartição e Ensino</p>
      <br/>
      <p>_________________________</p>
    </div>
    <div class="page-header" style="margin-left:130px;">
      <p>REPÚBLICA DE ANGOLA</p>
      <p>MINISTÉRIO DA EDUCAÇÃO</p>
      <p class="title">PAUTA FINAL PARA A CLASSE DE EXAME DO ${ciclo} DO ENSINO SECUNDÁRIO</p>
    </div>
  </div>

  <div style="border:1px solid #000;padding:4px 6px;margin-bottom:4px;font-size:7.5px;">
    <div style="display:flex;gap:16px;margin-bottom:3px;">
      <span><strong>ESCOLA:</strong> ${escola}</span>
      <span><strong>MUNICÍPIO DE:</strong> ______________________</span>
      <span><strong>PROVÍNCIA DE:</strong> ______________________</span>
    </div>
    <div style="display:flex;gap:16px;">
      <span><strong>PAUTA N.º</strong> ________ / ${now.getFullYear()}</span>
      <span><strong>ANO LECTIVO:</strong> ${turma.anoLetivo}</span>
      <span><strong>CLASSE:</strong> ${turma.classe}</span>
      <span><strong>TURMA:</strong> ${turma.nome}</span>
      <span><strong>SALA:</strong> _____</span>
      <span><strong>TURNO:</strong> ${turma.turno}</span>
    </div>
  </div>

  <div class="disc-section">DISCIPLINAS</div>

  <table class="main-table">
    <thead>
      <tr>
        <th class="num-col" rowspan="2">Nº</th>
        <th class="name-col" rowspan="2">NOME DO ALUNO</th>
        ${disciplinaHeaders}
        <th rowspan="2">OBS</th>
      </tr>
      <tr>
        ${subHeaders}
      </tr>
    </thead>
    <tbody>
      ${studentRows}
      ${fillerRows}
    </tbody>
  </table>

  <div class="sig-row">
    <div class="sig-block">
      <div>O CONSELHO DE NOTAS</div>
      <div class="sig-line"></div>
      <div>1 ___________________________</div>
    </div>
    <div class="sig-block">
      <div>DATA: ${dataActual}</div>
      <div class="sig-line"></div>
      <div>O(A) SUB-DIRECTOR(A) PEDAGÓGICO</div>
    </div>
    <div class="sig-block">
      <div>DATA: ${dataActual}</div>
      <div class="sig-line"></div>
      <div style="font-weight:bold;">${director}</div>
      <div>O(A) DIRECTOR(A) DA ESCOLA</div>
    </div>
  </div>

  <div style="font-size:6.5px;margin-top:4px;color:#555;">
    Legenda: MT1 = Média 1º Trimestre | MT2 = Média 2º Trimestre | MT3 = Média 3º Trimestre | MFD = Média Final do Ano
    | Classificação: ≥10 = Apto (A) | &lt;10 = Não Apto (NA)
  </div>
</body>
</html>`;
  }

  // Insert variable into editor at cursor (web-aware)
  function insertVariable(tag: string) {
    if (Platform.OS === 'web') {
      const el = (inputRef.current as any)?._inputRef?.current as HTMLTextAreaElement | null
        || document.activeElement as HTMLTextAreaElement | null;
      if (el && el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? editorContent.length;
        const end = el.selectionEnd ?? editorContent.length;
        const next = editorContent.slice(0, start) + tag + editorContent.slice(end);
        setEditorContent(next);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + tag.length;
          el.focus();
        }, 0);
        return;
      }
    }
    setEditorContent(prev => prev + tag);
  }

  // Fill variables for a given student
  function buildPreview(template: DocTemplate, alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return template.conteudo;
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const now = new Date();

    // Resolve cycle from nivel
    const cicloMap: Record<string, string> = {
      'Primário': 'Ensino Primário',
      'I Ciclo': 'Iº Ciclo',
      'II Ciclo': 'IIº Ciclo',
    };

    // Build nota lookup: disciplina (lowercase) → nf for this student
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);
    const notaByDisciplina: Record<string, number> = {};
    for (const n of alunoNotas) {
      notaByDisciplina[n.disciplina.toLowerCase().trim()] = n.nf;
    }

    // Helper: find nota by variable tag
    function resolveNota(tag: string): string {
      const candidates = DISCIPLINA_NOTA_MAP[tag] || [];
      for (const candidate of candidates) {
        const v = notaByDisciplina[candidate];
        if (v !== undefined) return String(Math.round(v));
      }
      return '____';
    }

    const map: Record<string, string> = {
      '{{NOME_COMPLETO}}': `${aluno.nome} ${aluno.apelido}`,
      '{{NOME}}': aluno.nome,
      '{{APELIDO}}': aluno.apelido,
      '{{DATA_NASCIMENTO}}': aluno.dataNascimento
        ? new Date(aluno.dataNascimento).toLocaleDateString('pt-PT') : '',
      '{{GENERO}}': aluno.genero === 'M' ? 'Masculino' : 'Feminino',
      '{{PROVINCIA}}': aluno.provincia || '',
      '{{MUNICIPIO}}': aluno.municipio || '',
      '{{NATURALIDADE}}': aluno.municipio || '',
      '{{NUMERO_MATRICULA}}': aluno.numeroMatricula || '',
      '{{NOME_ENCARREGADO}}': aluno.nomeEncarregado || '',
      '{{PAI}}': aluno.nomeEncarregado || '________________________',
      '{{MAE}}': '________________________',
      '{{DIA_NASC}}': aluno.dataNascimento ? String(new Date(aluno.dataNascimento).getDate()) : '__',
      '{{MES_NASC}}': aluno.dataNascimento ? MESES[new Date(aluno.dataNascimento).getMonth()] : '__________',
      '{{ANO_NASC}}': aluno.dataNascimento ? String(new Date(aluno.dataNascimento).getFullYear()) : '____',
      '{{BI_NUMERO}}': '________________________',
      '{{BI_DATA_EMISSAO}}': '________________________',
      '{{BI_LOCAL_EMISSAO}}': '________________________',
      '{{ENCARREGADO_PROFISSAO}}': '________________________',
      '{{ENCARREGADO_LOCAL_TRABALHO}}': '________________________',
      '{{ENCARREGADO_RESIDENCIA}}': '________________________',
      '{{ENCARREGADO_CONTACTO2}}': '________________________',
      '{{TELEFONE_ENCARREGADO}}': aluno.telefoneEncarregado || '',
      '{{TURMA}}': turma?.nome || '',
      '{{CLASSE}}': turma ? `${turma.classe} Classe` : '',
      '{{NIVEL}}': turma?.nivel || '',
      '{{CICLO}}': turma ? (cicloMap[turma.nivel] || turma.nivel) : '',
      '{{TURNO}}': turma?.turno || '',
      '{{ANO_LECTIVO}}': turma?.anoLetivo || new Date().getFullYear().toString(),
      '{{AREA}}': '________________________',
      '{{RESULTADO}}': 'APTO',
      '{{RESULTADO_LETRA}}': 'A',
      '{{PAUTA_NUMERO}}': '____',
      '{{PROCESSO_NUMERO}}': '____',
      '{{NOME_ESCOLA}}': config.nomeEscola || '',
      '{{NOME_DIRECTOR}}': user?.nome || '',
      '{{DATA_ACTUAL}}': `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`,
      '{{MES_ACTUAL}}': MESES[now.getMonth()],
      '{{ANO_ACTUAL}}': now.getFullYear().toString(),
      // Grade variables — auto-resolved from notas, fallback to blank
      '{{NOTA_LP}}': resolveNota('{{NOTA_LP}}'),
      '{{NOTA_LE}}': resolveNota('{{NOTA_LE}}'),
      '{{NOTA_MAT}}': resolveNota('{{NOTA_MAT}}'),
      '{{NOTA_INF}}': resolveNota('{{NOTA_INF}}'),
      '{{NOTA_EF}}': resolveNota('{{NOTA_EF}}'),
      '{{NOTA_HIS}}': resolveNota('{{NOTA_HIS}}'),
      '{{NOTA_GEO}}': resolveNota('{{NOTA_GEO}}'),
      '{{NOTA_INTRO_DIR}}': resolveNota('{{NOTA_INTRO_DIR}}'),
      '{{NOTA_INTRO_ECO}}': resolveNota('{{NOTA_INTRO_ECO}}'),
      '{{NOTA_DIR}}': resolveNota('{{NOTA_DIR}}'),
      '{{NOTA_ECO}}': resolveNota('{{NOTA_ECO}}'),
      '{{NOTA_GEST}}': resolveNota('{{NOTA_GEST}}'),
      '{{NOTA_CONT}}': resolveNota('{{NOTA_CONT}}'),
      '{{NOTA_FIL}}': resolveNota('{{NOTA_FIL}}'),
      '{{NOTA_DIR_COM}}': resolveNota('{{NOTA_DIR_COM}}'),
      '{{NOTA_ECO_POL}}': resolveNota('{{NOTA_ECO_POL}}'),
      '{{NOTA_CONT_GEST}}': resolveNota('{{NOTA_CONT_GEST}}'),
      '{{NOTA_EMPREEND}}': resolveNota('{{NOTA_EMPREEND}}'),
      '{{NOTA_DIR_EMP}}': resolveNota('{{NOTA_DIR_EMP}}'),
      '{{NOTA_ECO_AV}}': resolveNota('{{NOTA_ECO_AV}}'),
      '{{NOTA_GEST_FIN}}': resolveNota('{{NOTA_GEST_FIN}}'),
      '{{NOTA_CONT_AV}}': resolveNota('{{NOTA_CONT_AV}}'),
    };

    let result = template.conteudo;
    Object.entries(map).forEach(([k, v]) => {
      result = result.split(k).join(v);
    });
    return result;
  }

  function handleSelectAluno(alunoId: string) {
    setEmitAlunoId(alunoId);
    if (emitTemplate) setEmitPreview(buildPreview(emitTemplate, alunoId));
    setAlunoSearch('');
  }

  // ─── Ficha de Matrícula HTML Builder ──────────────────────────────────────

  function buildFichaMatriculaHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const escola = config.nomeEscola || 'Escola';
    const now = new Date();

    const nome = `${aluno.nome.toUpperCase()} ${aluno.apelido.toUpperCase()}`;
    const diaNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getDate() : '__';
    const mesNasc = aluno.dataNascimento ? MESES[new Date(aluno.dataNascimento).getMonth()] : '__________';
    const anoNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear() : '____';
    const municipio = aluno.municipio || '____________________';
    const provincia = aluno.provincia || '____________________';
    const encarregado = aluno.nomeEncarregado || '____________________________________________';
    const telefone = aluno.telefoneEncarregado || '_______________________';
    const classeActual = turma ? turma.classe : '____';
    const turmaNome = turma ? turma.nome : '____';
    const anoLetivo = turma ? turma.anoLetivo : String(now.getFullYear());

    // Class history table columns
    const classes = ['Iniciação', '1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe', '7ª Classe', '8ª Classe', '9ª Classe'];
    const classeHeaders = classes.map(c => `<th>${c.replace(' Classe', '<br/>Classe')}</th>`).join('');
    const classeCells = classes.map(() => `<td>&nbsp;</td>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Ficha de Reconfirmação de Matrícula — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px 30px; }
    .header { text-align: center; margin-bottom: 16px; }
    .header .escola { font-size: 14px; font-weight: bold; text-transform: uppercase; }
    .header .sub { font-size: 11px; text-transform: uppercase; }
    .titulo { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 18px 0 20px; letter-spacing: 1px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; }
    .field { margin-bottom: 10px; line-height: 1.8; }
    .line { display: inline-block; border-bottom: 1px solid #000; min-width: 200px; vertical-align: bottom; margin: 0 2px; }
    .line-sm { min-width: 60px; }
    .line-md { min-width: 120px; }
    .line-lg { min-width: 260px; }
    .line-xl { min-width: 360px; }
    .row { display: flex; gap: 24px; align-items: flex-end; margin-bottom: 10px; }
    .row > * { flex: 1; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 10px; }
    table th, table td { border: 1px solid #000; padding: 5px 3px; text-align: center; }
    table th { background: #f0f0f0; font-weight: bold; font-size: 9px; }
    .section-title { font-size: 13px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 16px 0 8px; letter-spacing: 2px; }
    .frequencia-box { border: 1px solid #000; min-height: 80px; padding: 8px; margin-bottom: 16px; font-size: 10px; color: #aaa; font-style: italic; }
    .date-line { margin: 16px 0; font-size: 11px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 28px; }
    .sig-block { text-align: center; min-width: 220px; }
    .sig-label { font-size: 11px; margin-bottom: 28px; }
    .sig-line { width: 200px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .comprovativo { border: 1px solid #aaa; background: #f7f7f7; padding: 8px 12px; margin-top: 20px; font-size: 9px; }
    .comp-title { font-size: 9px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 1px; }
    .comp-row { display: flex; gap: 16px; flex-wrap: wrap; }
    .comp-field { flex: 1; min-width: 120px; }
    @media print { @page { size: A4; margin: 15mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Ensino Particular</div>
    <div class="escola">${escola}</div>
    <div class="sub">Ensino Primário, Iº e IIº Ciclo</div>
  </div>

  <div class="titulo">Ficha de Reconfirmação de Matrícula</div>

  <div class="field">Nome do Aluno <span class="line line-xl">${nome}</span></div>

  <div class="field">
    Filho(a) de <span class="line line-lg">________________________</span>
    &nbsp;e de <span class="line line-md">________________________</span>
  </div>

  <div class="field">
    Nascido(a) aos <span class="line line-sm">${diaNasc}</span>
    de <span class="line line-md">${mesNasc}</span>
    de 20<span class="line line-sm">${String(anoNasc).slice(-2)}</span>
    &nbsp;Natural de <span class="line line-md">${municipio}</span>
    &nbsp;Município de <span class="line line-md">${municipio}</span>
  </div>

  <div class="field">
    Província de <span class="line line-md">${provincia}</span>
    portador(a) do B.I ou Cédula pessoal nº <span class="line line-md">_____________________</span>
    emitido aos <span class="line line-sm">____</span>
    de <span class="line line-md">________________</span>
    de 20<span class="line line-sm">____</span>
    pela direcção nacional de identificação ou conservatória de registo civil de
    <span class="line line-lg">________________________</span>.
  </div>

  <div class="field">Nome do encarregado <span class="line line-xl">${encarregado}</span></div>

  <div class="row">
    <div>Profissão <span class="line line-md">________________________</span></div>
    <div>Local de trabalho <span class="line line-md">_______________________________</span></div>
  </div>

  <div class="row">
    <div>Residência <span class="line line-md">________________________</span></div>
    <div>Contactos <span class="line line-md">${telefone}</span></div>
    <div>ou <span class="line line-md">_______________________</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="min-width:70px;">Classes</th>
        ${classeHeaders}
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>Ano lectivo</th>
        ${classeCells}
      </tr>
    </tbody>
  </table>

  <div class="section-title">Frequência Escolar do Aluno</div>
  <div class="frequencia-box">— espaço para observações —</div>

  <div class="date-line">Luanda aos, ______ de ____________________ de 20____</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">O encarregado de educação</div>
      <div class="sig-line"></div>
      <div>${encarregado}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">O(a) Responsável da Secretaria</div>
      <div class="sig-line"></div>
      <div>&nbsp;</div>
    </div>
  </div>

  <div class="comprovativo">
    <div class="comp-title">Comprovativo de Matrícula — Ano Lectivo 20____</div>
    <div class="comp-row">
      <div class="comp-field">Nome: <strong>${nome}</strong></div>
      <div class="comp-field">Fez a matrícula na Classe: <strong>${classeActual}</strong></div>
      <div class="comp-field">Período: __________</div>
    </div>
    <div class="comp-row" style="margin-top:4px;">
      <div class="comp-field">O Encarregado: ______________________</div>
      <div class="comp-field">A Secretária: ________________________</div>
      <div class="comp-field">Luanda aos ______ de ______ de 20____</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Certificado de Habilitações HTML Builder ─────────────────────────────

  function numExtenso(n: number): string {
    const map: Record<number, string> = {
      0: 'Zero', 1: 'Um', 2: 'Dois', 3: 'Três', 4: 'Quatro', 5: 'Cinco',
      6: 'Seis', 7: 'Sete', 8: 'Oito', 9: 'Nove', 10: 'Dez', 11: 'Onze',
      12: 'Doze', 13: 'Treze', 14: 'Catorze', 15: 'Quinze', 16: 'Dezasseis',
      17: 'Dezassete', 18: 'Dezoito', 19: 'Dezanove', 20: 'Vinte',
    };
    return map[Math.round(n)] ?? String(Math.round(n));
  }

  type DisciplinaRow = { nome: string; notaVar: string };

  const DISCIPLINAS_POR_CLASSE: Record<string, DisciplinaRow[]> = {
    '11ª': [
      { nome: 'Língua Portuguesa',   notaVar: '{{NOTA_LP}}' },
      { nome: 'Língua Estrangeira',   notaVar: '{{NOTA_LE}}' },
      { nome: 'Matemática',           notaVar: '{{NOTA_MAT}}' },
      { nome: 'Informática',          notaVar: '{{NOTA_INF}}' },
      { nome: 'Educação Física',      notaVar: '{{NOTA_EF}}' },
      { nome: 'Direito',              notaVar: '{{NOTA_DIR}}' },
      { nome: 'Economia',             notaVar: '{{NOTA_ECO}}' },
      { nome: 'Gestão de Empresas',   notaVar: '{{NOTA_GEST}}' },
      { nome: 'Contabilidade',        notaVar: '{{NOTA_CONT}}' },
    ],
    '12ª': [
      { nome: 'Língua Portuguesa',    notaVar: '{{NOTA_LP}}' },
      { nome: 'Língua Estrangeira',   notaVar: '{{NOTA_LE}}' },
      { nome: 'Matemática',           notaVar: '{{NOTA_MAT}}' },
      { nome: 'Filosofia',            notaVar: '{{NOTA_FIL}}' },
      { nome: 'Educação Física',      notaVar: '{{NOTA_EF}}' },
      { nome: 'Direito Comercial',    notaVar: '{{NOTA_DIR_COM}}' },
      { nome: 'Economia Política',    notaVar: '{{NOTA_ECO_POL}}' },
      { nome: 'Contabilidade e Gestão', notaVar: '{{NOTA_CONT_GEST}}' },
      { nome: 'Empreendedorismo',     notaVar: '{{NOTA_EMPREEND}}' },
    ],
    '13ª': [
      { nome: 'Língua Portuguesa',    notaVar: '{{NOTA_LP}}' },
      { nome: 'Língua Estrangeira',   notaVar: '{{NOTA_LE}}' },
      { nome: 'Matemática',           notaVar: '{{NOTA_MAT}}' },
      { nome: 'Filosofia',            notaVar: '{{NOTA_FIL}}' },
      { nome: 'Educação Física',      notaVar: '{{NOTA_EF}}' },
      { nome: 'Direito Empresarial',  notaVar: '{{NOTA_DIR_EMP}}' },
      { nome: 'Economia Avançada',    notaVar: '{{NOTA_ECO_AV}}' },
      { nome: 'Gestão Financeira',    notaVar: '{{NOTA_GEST_FIN}}' },
      { nome: 'Contabilidade Avançada', notaVar: '{{NOTA_CONT_AV}}' },
    ],
  };

  function buildCertificadoHabilitacoesHtml(alunoId: string, classeAlvo: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const escola = config.nomeEscola || 'Escola';
    const director = user?.nome || '____________________________';
    const now = new Date();
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
    const anoLetivo = turma?.anoLetivo || String(now.getFullYear());

    const nome = `${aluno.nome} ${aluno.apelido}`;
    const diaNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getDate() : '__';
    const mesNasc = aluno.dataNascimento ? MESES[new Date(aluno.dataNascimento).getMonth()] : '__________';
    const anoNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear() : '____';
    const municipio = aluno.municipio || '______________';
    const provincia = aluno.provincia || '______________';
    const encarregado = aluno.nomeEncarregado || '________________________';

    // Resolve grades for this student
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);
    const notaByDisc: Record<string, number> = {};
    for (const n of alunoNotas) {
      notaByDisc[n.disciplina.toLowerCase().trim()] = n.nf;
    }
    function resolveNota(tag: string): number | null {
      const candidates = DISCIPLINA_NOTA_MAP[tag] || [];
      for (const c of candidates) {
        if (notaByDisc[c] !== undefined) return notaByDisc[c];
      }
      return null;
    }

    const disciplinas = DISCIPLINAS_POR_CLASSE[classeAlvo] || [];
    const resolvedGrades = disciplinas.map(d => ({
      ...d,
      nota: resolveNota(d.notaVar),
    }));

    // Calculate average (only over resolved grades)
    const withGrades = resolvedGrades.filter(g => g.nota !== null);
    const avg = withGrades.length > 0
      ? withGrades.reduce((s, g) => s + (g.nota ?? 0), 0) / withGrades.length
      : null;
    const avgRounded = avg !== null ? Math.round(avg) : null;
    const avgDisplay = avgRounded !== null ? String(avgRounded) : '____';
    const avgExtenso = avgRounded !== null ? numExtenso(avgRounded) : '________';

    const cicloLabel = 'II CICLO DO ENSINO SECUNDÁRIO GERAL';
    const classeLabel = classeAlvo === '13ª'
      ? 'Pré-Universitário — 13ª Classe'
      : `IIº Ciclo — ${classeAlvo} Classe`;

    // Grade table rows
    const tableRows = resolvedGrades.map(g => {
      const nota = g.nota !== null ? Math.round(g.nota) : null;
      const notaStr = nota !== null ? String(nota) : '—';
      const extensoStr = nota !== null ? numExtenso(nota) + ' Valores' : '—';
      return `<tr>
        <td style="text-align:left;padding:4px 8px;">${g.nome}</td>
        <td style="text-align:center;font-weight:bold;">${notaStr}</td>
        <td style="text-align:center;">${notaStr !== '—' ? notaStr : '—'}</td>
        <td style="text-align:right;padding-right:8px;">${extensoStr}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado de Habilitações — ${nome} — ${classeAlvo} Classe</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12px; color: #000; padding: 30px 50px; line-height: 1.7; }
    .header { text-align: center; margin-bottom: 16px; }
    .header p { margin: 2px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .escola-nome { font-size: 12px; font-style: italic; font-weight: bold; }
    .header .ensino { font-size: 11px; font-weight: bold; }
    .titulo { text-align: center; font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 10px 0; }
    .body { text-align: justify; margin-bottom: 16px; }
    .body p { margin-bottom: 8px; }
    .nome-aluno { color: #c00; font-weight: bold; text-decoration: none; }
    .bold { font-weight: bold; }
    .italic-bold { font-style: italic; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11.5px; }
    table th { background: #eee; border: 1px solid #333; padding: 5px 8px; font-weight: bold; }
    table td { border: 1px solid #555; padding: 4px 6px; }
    .media-row td { font-weight: bold; background: #f5f5f5; border-top: 2px solid #000; }
    .legal { text-align: justify; margin: 16px 0; }
    .date { text-align: center; margin: 24px 0 32px; font-size: 12px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 20px; }
    .sig-block { text-align: center; min-width: 220px; }
    .sig-label { font-size: 11.5px; font-weight: bold; margin-bottom: 32px; }
    .sig-line { width: 200px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .sig-name { font-size: 11px; }
    @media print { @page { size: A4; margin: 15mm 20mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p class="escola-nome">${escola}</p>
    <p class="ensino">Ensino Geral</p>
  </div>

  <div class="titulo">Certificado de Habilitações</div>

  <div class="body">
    <p>
      <span class="italic-bold">${director}, Director(a) do <em>${escola}</em></span>,
      criado sob o Decreto Executivo ____/_____ de __ de __________.
    </p>
    <p>
      Certifica que: <span class="nome-aluno">${nome}</span>,
      filho(a) de <span class="bold">${encarregado}</span>,
      e de <span class="bold">________________________</span>,
      nascido(a) aos <span class="bold">${diaNasc}</span> de
      <span class="bold">${mesNasc}</span> de
      <span class="bold">${anoNasc}</span>,
      natural de <span class="bold">______________</span>,
      Município de <span class="bold">${municipio}</span>,
      Província de <span class="bold">${provincia}</span>,
      portador(a) do BI nº <span class="bold">________________________</span>,
      emitido aos <span class="bold">__</span> de
      <span class="bold">______________</span> de
      <span class="bold">____</span>,
      passado pelo Arquivo de Identificação Nacional de
      <span class="bold">${provincia}</span>.
    </p>
    <p>
      Concluiu no Ano Lectivo de <span class="bold">${anoLetivo}</span>
      o <span class="bold">${cicloLabel}</span>,
      conforme o disposto na alínea b) do artigo 109º da LBEE 17/16 de 7 de Outubro,
      ${classeLabel}, com a Média Final de
      (<span class="bold">${avgDisplay}</span>)
      <span class="bold">${avgExtenso} Valores</span>
      obtida nas seguintes classificações por ciclos de aprendizagem:
    </p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:42%;">Disciplina</th>
        <th style="text-align:center;width:14%;">${classeAlvo} Classe</th>
        <th style="text-align:center;width:14%;">Média Final</th>
        <th style="text-align:right;width:30%;">Média por extenso</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="media-row">
        <td style="text-align:left;padding:4px 8px;">Média Geral Final</td>
        <td></td>
        <td style="text-align:center;">${avgDisplay}</td>
        <td style="text-align:right;padding-right:8px;">${avgExtenso} Valores</td>
      </tr>
    </tbody>
  </table>

  <div class="legal">
    <p>
      Por efeitos legais, lhe é passado o presente
      <span class="bold">CERTIFICADO</span>,
      que consta no livro de termos nº <span class="bold">____</span>,
      folha <span class="bold">____</span>,
      assinado por mim e autenticado com carimbo a óleo em uso neste Estabelecimento de Ensino.
    </p>
  </div>

  <div class="date">Luanda aos ${dataActual}</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">Conferido por</div>
      <div class="sig-line"></div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">O Director</div>
      <div class="sig-line"></div>
      <div class="sig-name">${director}</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Certificado ITAQ HTML Builder ────────────────────────────────────────

  function buildCertificadoItaqHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const escola = config.nomeEscola || 'Instituto Técnico';
    const director = user?.nome || '____________________________';
    const now = new Date();
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;
    const anoLetivo = turma?.anoLetivo || String(now.getFullYear());

    const nome = `${aluno.nome} ${aluno.apelido}`;
    const diaNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getDate() : '__';
    const anoNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear() : '____';
    const mesNascNum = aluno.dataNascimento ? String(new Date(aluno.dataNascimento).getMonth() + 1).padStart(2, '0') : '__';
    const municipio = aluno.municipio || '______________';
    const provincia = aluno.provincia || '______________';
    const encarregado = aluno.nomeEncarregado || '________________________';

    // Resolve grades directly from notas by discipline name fuzzy match
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);
    function getNota(names: string[]): number | null {
      for (const nota of alunoNotas) {
        const d = nota.disciplina.toLowerCase().trim();
        for (const name of names) {
          if (d.includes(name) || name.includes(d)) return nota.nf;
        }
      }
      return null;
    }

    type ItaqRow = { nome: string; lookup: string[]; isHeader?: boolean };
    const sociocultural: ItaqRow[] = [
      { nome: 'Língua Portuguesa',              lookup: ['língua portuguesa', 'lingua portuguesa', 'português'] },
      { nome: 'Língua Estrangeira',             lookup: ['língua estrangeira', 'lingua estrangeira', 'inglês', 'ingles'] },
      { nome: 'Formação de Actitudes Integradoras', lookup: ['formação de actitudes', 'formacao de actitudes', 'actitudes integradoras'] },
      { nome: 'Educação Física',                lookup: ['educação física', 'educacao fisica', 'ed. física'] },
    ];
    const cientifica: ItaqRow[] = [
      { nome: 'Matemática',  lookup: ['matemática', 'matematica'] },
      { nome: 'Física',      lookup: ['física', 'fisica'] },
      { nome: 'Química',     lookup: ['química', 'quimica'] },
      { nome: 'Biologia',    lookup: ['biologia'] },
    ];
    const tecnica: ItaqRow[] = [
      { nome: 'Informática',                              lookup: ['informática', 'informatica'] },
      { nome: 'Empreendedorismo',                        lookup: ['empreendedorismo'] },
      { nome: 'Agricultura Geral',                       lookup: ['agricultura geral'] },
      { nome: 'Mecanização Agrícola',                    lookup: ['mecanização agrícola', 'mecanizacao agricola'] },
      { nome: 'Topografia, Hidráulica e Construções Rurais', lookup: ['topografia', 'hidráulica', 'construções rurais'] },
      { nome: 'Economia e Gestão',                       lookup: ['economia e gestão', 'economia e gestao'] },
      { nome: 'Transformação e Conservação de Produtos', lookup: ['transformação e conservação', 'transformacao e conservacao'] },
      { nome: 'Horto-Fruticultura',                      lookup: ['horto-fruticultura', 'hortofruticultura', 'horto fruticultura'] },
      { nome: 'Fitossanidade',                           lookup: ['fitossanidade'] },
      { nome: 'Culturas Arvenses e Industriais',         lookup: ['culturas arvenses'] },
      { nome: 'Extensão e Desenvolvimento Rural',        lookup: ['extensão e desenvolvimento', 'extensao e desenvolvimento'] },
      { nome: 'Trabalho de Campo',                       lookup: ['trabalho de campo'] },
      { nome: 'Projecto Tecnológico',                    lookup: ['projecto tecnológico', 'projeto tecnologico', 'projecto tecnologico'] },
    ];

    const allDiscs = [...sociocultural, ...cientifica, ...tecnica];
    const resolvedAll = allDiscs.map(d => ({ ...d, nota: getNota(d.lookup) }));

    // MPC = average of all disciplines
    const withGrades = resolvedAll.filter(g => g.nota !== null);
    const mpc = withGrades.length > 0
      ? withGrades.reduce((s, g) => s + (g.nota ?? 0), 0) / withGrades.length
      : null;
    const mpcRounded = mpc !== null ? Math.round(mpc) : null;
    const mpcDisplay = mpcRounded !== null ? String(mpcRounded) : '___';
    const mpcExtenso = mpcRounded !== null ? numExtenso(mpcRounded) : '______';

    // Final = (2×MPC + PAP) / 3  → PAP left blank
    const finalExtenso = mpcRounded !== null ? numExtenso(mpcRounded) : '______';

    function buildRows(rows: ItaqRow[], component: string): string {
      const header = `<tr style="background:#2c4a1e;">
        <td colspan="3" style="font-weight:bold;color:#fff;padding:5px 8px;">${component}</td>
      </tr>`;
      const body = rows.map(d => {
        const nota = getNota(d.lookup);
        const notaStr = nota !== null ? Math.round(nota).toString() : '___';
        const extensoStr = nota !== null ? `(${numExtenso(Math.round(nota))})` : '(___)';
        return `<tr>
          <td style="padding:4px 8px;">${d.nome}</td>
          <td style="text-align:center;color:#1a5276;font-weight:bold;">${notaStr}</td>
          <td style="text-align:center;color:#1a5276;">${extensoStr}</td>
        </tr>`;
      }).join('');
      return header + body;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado ITAQ — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 24px 40px; line-height: 1.65; }
    .header { text-align: center; margin-bottom: 14px; }
    .header p { margin: 2px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .sub { font-size: 12px; font-weight: bold; letter-spacing: 1px; }
    .border-box { border: 2px solid #2c4a1e; padding: 12px 16px; }
    .titulo { text-align: center; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 14px; }
    .body { text-align: justify; margin-bottom: 12px; font-size: 11.5px; line-height: 1.75; }
    .bold { font-weight: bold; }
    .nome-aluno { color: #c00; font-weight: bold; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 11px; }
    table th { background: #2c4a1e; color: #fff; border: 1px solid #2c4a1e; padding: 6px 8px; text-align: center; }
    table th:first-child { text-align: left; }
    table td { border: 1px solid #999; padding: 4px 6px; }
    .summary-row td { background: #f0f4ec; font-weight: bold; border-top: 2px solid #2c4a1e; font-size: 11px; }
    .final-row td { background: #2c4a1e; color: #fff; font-weight: bold; border-top: 2px solid #1a3c10; font-size: 11px; }
    .legal { font-size: 11px; margin-top: 14px; text-align: justify; line-height: 1.7; }
    .date { text-align: center; margin: 18px 0 28px; font-size: 11px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 10px; }
    .sig-block { text-align: center; min-width: 200px; }
    .sig-label { font-size: 11px; font-weight: bold; margin-bottom: 28px; }
    .sig-line { width: 180px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .sig-name { font-size: 10.5px; font-style: italic; }
    @media print { @page { size: A4; margin: 12mm 18mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p class="sub">Ensino Secundário Técnico-Profissional</p>
  </div>

  <div class="border-box">
    <div class="titulo">Certificado</div>

    <div class="body">
      <span class="bold">${director}</span>, Director do <span class="bold">${escola}</span>,
      criado sob o Decreto Executivo nº __________ de __ de __________,
      certifica que <span class="nome-aluno">${nome}</span>,
      filho de <span class="bold">${encarregado}</span>
      e de <span class="bold">________________________</span>,
      natural de <span class="bold">______________</span>,
      Município de <span class="bold">${municipio}</span>,
      Província de <span class="bold">${provincia}</span>,
      nascido aos <span class="bold">${diaNasc}/${mesNascNum}/${anoNasc}</span>,
      portador do Bilhete de Identidade, nº <span class="bold">________________________</span>,
      passado pelo Arquivo de Identificação de <span class="bold">${provincia}</span>,
      aos __ / __ / ______,
      concluiu no ano lectivo <span class="bold">${anoLetivo}</span>,
      o Curso do IIº CICLO DO ENSINO SECUNDÁRIO TÉCNICO,
      na especialidade de <span class="bold">____________________________</span>,
      conforme o disposto na alínea f) do artigo 109º da LBSEE 17/16 de 7 de Outubro,
      com a Média Final de <span class="bold">${mpcDisplay}</span> valores
      obtida nas seguintes classificações por disciplinas:
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:58%;">Componente de Formação</th>
          <th style="width:21%;">Média Final</th>
          <th style="width:21%;">Média por Extenso</th>
        </tr>
      </thead>
      <tbody>
        ${buildRows(sociocultural, 'Componente Sociocultural')}
        ${buildRows(cientifica, 'Componente Científica')}
        ${buildRows(tecnica, 'Componente Técnica, Tecnológica e Prática')}
        <tr class="summary-row">
          <td style="padding:5px 8px;">Média por Plano Curricular</td>
          <td style="text-align:center;">${mpcDisplay}</td>
          <td style="text-align:center;font-style:italic;">(${mpcExtenso})</td>
        </tr>
        <tr class="summary-row">
          <td style="padding:5px 8px;">Prova de Aptidão Profissional</td>
          <td style="text-align:center;">___</td>
          <td style="text-align:center;font-style:italic;">(___)</td>
        </tr>
        <tr class="final-row">
          <td style="padding:5px 8px;">Classificação Final por Curso =(2XPC+PAP)/3</td>
          <td style="text-align:center;">___</td>
          <td style="text-align:center;font-style:italic;">(${finalExtenso})</td>
        </tr>
      </tbody>
    </table>

    <div class="legal">
      Para efeitos legais lhe é passado o presente <strong>CERTIFICADO</strong>,
      que consta do livro de registo nº 1, &nbsp; folha____,
      assinado por mim e autenticado com selo branco em uso neste estabelecimento de ensino.
    </div>
  </div>

  <div class="date">${escola}, aos ${dataActual}</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">Conferido por</div>
      <div class="sig-line"></div>
      <div class="sig-name">&nbsp;</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">O Director</div>
      <div class="sig-line"></div>
      <div class="sig-name">${director}</div>
    </div>
  </div>
</body>
</html>`;
  }

  function handlePrint() {
    if (Platform.OS !== 'web') return;
    const win = window.open('', '_blank');
    if (!win) return;

    // ── Pauta Final: use generated HTML directly ──────────────────────────────
    if (emitTemplate?.tipo === 'pauta_final' && emitTurmaId) {
      const html = buildPautaFinalHtml(emitTurmaId);
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

    // ── Ficha de Matrícula: use dedicated form HTML builder ───────────────────
    if (emitTemplate?.tipo === 'ficha_matricula' && emitAlunoId) {
      const html = buildFichaMatriculaHtml(emitAlunoId);
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

    // ── Certificado de Habilitações: rich HTML with grade table ───────────────
    if (emitTemplate?.tipo === 'certificado' && emitTemplate?.classeAlvo && emitAlunoId) {
      const classe = emitTemplate.classeAlvo;
      const html = classe === '13ª-ITAQ'
        ? buildCertificadoItaqHtml(emitAlunoId)
        : buildCertificadoHabilitacoesHtml(emitAlunoId, classe);
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

    // ── Standard document: use template preview text ──────────────────────────
    const aluno = alunos.find(a => a.id === emitAlunoId);
    const tplInsignia = emitTemplate?.insigniaBase64;
    const tplMarcaAgua = emitTemplate?.marcaAguaBase64;

    const logoHtml = tplInsignia
      ? `<img src="${tplInsignia}" alt="Insígnia" style="height:90px;width:90px;object-fit:contain;margin-bottom:8px;" />`
      : `<div style="width:72px;height:72px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:26px;font-weight:bold;color:#666;line-height:72px;text-align:center;border:2px solid #ccc;">${(config.nomeEscola || 'E').charAt(0).toUpperCase()}</div>`;

    const watermarkHtml = tplMarcaAgua
      ? `<img src="${tplMarcaAgua}" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;opacity:0.05;pointer-events:none;z-index:0;" />`
      : `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:72px;font-weight:bold;color:rgba(0,0,0,0.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:8px;">${config.nomeEscola || 'SIGA'}</div>`;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>${emitTemplate?.nome || 'Documento'}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', serif; margin: 60px; font-size: 14px; line-height: 1.8; color: #000; position: relative; }
          .content { position: relative; z-index: 1; }
          .doc-header { text-align: center; margin-bottom: 32px; }
          h1 { font-size: 16px; margin: 4px 0; font-family: 'Times New Roman', serif; }
          .republika { font-size: 11px; color: #555; margin-bottom: 2px; letter-spacing: 1px; text-transform: uppercase; }
          .divider { width: 80px; height: 2px; background: #000; margin: 12px auto; }
          .doc-tipo { font-size: 14px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin: 8px 0; }
          .doc-meta { font-size: 11px; color: #555; margin-bottom: 32px; }
          pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.9; text-align: justify; }
          .signature { margin-top: 60px; text-align: center; }
          .sig-line { width: 200px; height: 1px; background: #333; margin: 40px auto 6px; }
          @media print { body { margin: 30px 50px; } }
        </style>
      </head>
      <body>
        ${watermarkHtml}
        <div class="content">
          <div class="doc-header">
            ${logoHtml}
            <div class="republika">República de Angola</div>
            <h1>${config.nomeEscola}</h1>
            <div class="divider"></div>
            <div class="doc-tipo">${emitTemplate?.nome || ''}</div>
            ${aluno ? `<div class="doc-meta">${aluno.nome} ${aluno.apelido}</div>` : ''}
          </div>
          <pre>${emitPreview}</pre>
          <div class="signature">
            <div style="font-size:13px;color:#444;">Luanda, ${new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div class="sig-line"></div>
            <div style="font-weight:bold;font-size:13px;">${user?.nome || ''}</div>
            <div style="font-size:12px;color:#555;">Director(a)</div>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
  }

  const screenWidth = Dimensions.get('window').width;
  const isWide = screenWidth >= 768;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (mode === 'list') return <ListScreen />;
  if (mode === 'editor') return <EditorScreen />;
  if (mode === 'emit') return <EmitScreen />;
  return null;

  // ─── LIST ─────────────────────────────────────────────────────────────────

  function ListScreen() {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Editor de Documentos</Text>
            <Text style={styles.headerSub}>{templates.length} modelo{templates.length !== 1 ? 's' : ''} guardado{templates.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={openNew} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="file-alt" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum modelo criado</Text>
            <Text style={styles.emptyDesc}>Crie o primeiro modelo de documento para a sua escola.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Criar primeiro modelo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={templates}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => <TemplateCard template={item} />}
          />
        )}
      </View>
    );
  }

  function TemplateCard({ template }: { template: DocTemplate }) {
    const [showMenu, setShowMenu] = useState(false);
    const tipoColor = TIPO_COLORS[template.tipo];
    const preview = template.conteudo.slice(0, 120).replace(/\n/g, ' ');

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.tipoBadge, { backgroundColor: tipoColor + '22' }]}>
            <Text style={[styles.tipoText, { color: tipoColor }]}>{TIPO_LABELS[template.tipo]}</Text>
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(v => !v)}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardNome}>{template.nome}</Text>
        <Text style={styles.cardPreview} numberOfLines={2}>{preview || 'Sem conteúdo'}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>Actualizado: {fmtDate(template.atualizadoEm)}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEmit(template)}>
              <Ionicons name="document-text" size={14} color={Colors.success} />
              <Text style={[styles.cardActionText, { color: Colors.success }]}>Emitir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEdit(template)}>
              <Ionicons name="pencil" size={14} color={Colors.info} />
              <Text style={[styles.cardActionText, { color: Colors.info }]}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showMenu && (
          <View style={styles.dropMenu}>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); openEdit(template); }}>
              <Ionicons name="pencil-outline" size={16} color={Colors.text} />
              <Text style={styles.dropItemText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); openEmit(template); }}>
              <Ionicons name="document-text-outline" size={16} color={Colors.success} />
              <Text style={[styles.dropItemText, { color: Colors.success }]}>Emitir documento</Text>
            </TouchableOpacity>
            <View style={styles.dropDivider} />
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); deleteTemplate(template.id); }}>
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={[styles.dropItemText, { color: Colors.danger }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ─── EDITOR ───────────────────────────────────────────────────────────────

  function EditorScreen() {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Editor Header */}
        <View style={styles.editorHeader}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={styles.editorNomeInput}
            value={editorNome}
            onChangeText={setEditorNome}
            placeholder="Nome do modelo..."
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            onPress={saveTemplate}
            disabled={isSaving}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>{isSaving ? 'A guardar...' : 'Guardar'}</Text>
          </TouchableOpacity>
        </View>

        {/* Tipo selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tipoScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(Object.keys(TIPO_LABELS) as DocTipo[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tipoChip, editorTipo === t && { backgroundColor: TIPO_COLORS[t], borderColor: TIPO_COLORS[t] }]}
              onPress={() => setEditorTipo(t)}
            >
              <Text style={[styles.tipoChipText, editorTipo === t && { color: '#fff' }]}>{TIPO_LABELS[t]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Aparência do documento */}
        <View style={styles.appearSection}>
          <TouchableOpacity style={styles.appearHeader} onPress={() => setShowAppearPanel(v => !v)} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={15} color={Colors.gold} />
            <Text style={styles.appearHeaderTitle}>Aparência do Documento</Text>
            <Ionicons name={showAppearPanel ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textMuted} />
          </TouchableOpacity>

          {showAppearPanel && (
            <View style={styles.appearBody}>
              {/* Insignia upload */}
              <View style={styles.appearItem}>
                <View style={styles.appearItemInfo}>
                  <Text style={styles.appearItemLabel}>Insígnia / Emblema</Text>
                  <Text style={styles.appearItemHint}>Aparece no topo do documento (ex: brasão da escola)</Text>
                </View>
                <View style={styles.appearItemControls}>
                  {editorInsignia ? (
                    <View style={styles.imagePreviewWrap}>
                      <Image source={{ uri: editorInsignia }} style={styles.imagePreview} resizeMode="contain" />
                      <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setEditorInsignia(undefined)}>
                        <Ionicons name="close-circle" size={20} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(setEditorInsignia)} activeOpacity={0.75}>
                      <Ionicons name="cloud-upload-outline" size={18} color={Colors.gold} />
                      <Text style={styles.uploadBtnText}>Carregar imagem</Text>
                    </TouchableOpacity>
                  )}
                  {editorInsignia && (
                    <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage(setEditorInsignia)} activeOpacity={0.75}>
                      <Ionicons name="refresh-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.changeBtnText}>Alterar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.appearDivider} />

              {/* Marca de água upload */}
              <View style={styles.appearItem}>
                <View style={styles.appearItemInfo}>
                  <Text style={styles.appearItemLabel}>Marca de Água</Text>
                  <Text style={styles.appearItemHint}>Imagem em fundo no documento (transparente)</Text>
                </View>
                <View style={styles.appearItemControls}>
                  {editorMarcaAgua ? (
                    <View style={styles.imagePreviewWrap}>
                      <View style={styles.imagePreviewMarcaWrap}>
                        <Image source={{ uri: editorMarcaAgua }} style={styles.imagePreviewMarca} resizeMode="contain" />
                        <View style={styles.imagePreviewMarcaOverlay} />
                      </View>
                      <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setEditorMarcaAgua(undefined)}>
                        <Ionicons name="close-circle" size={20} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage(setEditorMarcaAgua)} activeOpacity={0.75}>
                      <Ionicons name="cloud-upload-outline" size={18} color={Colors.info} />
                      <Text style={[styles.uploadBtnText, { color: Colors.info }]}>Carregar imagem</Text>
                    </TouchableOpacity>
                  )}
                  {editorMarcaAgua && (
                    <TouchableOpacity style={styles.changeBtn} onPress={() => pickImage(setEditorMarcaAgua)} activeOpacity={0.75}>
                      <Ionicons name="refresh-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.changeBtnText}>Alterar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.editorBody, isWide && { flexDirection: 'row' }]}>
          {/* Text area */}
          <View style={[styles.editorTextWrap, isWide && { flex: 1 }]}>
            <View style={styles.editorToolbar}>
              <Text style={styles.editorToolbarLabel}>Área de edição</Text>
              <TouchableOpacity onPress={() => setShowVarsPanel(v => !v)} style={styles.toggleVarsBtn}>
                <Ionicons name={showVarsPanel ? 'eye-off-outline' : 'code-slash'} size={15} color={Colors.textSecondary} />
                <Text style={styles.toggleVarsText}>{showVarsPanel ? 'Ocultar variáveis' : 'Ver variáveis'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={inputRef}
              style={styles.editorTextInput}
              value={editorContent}
              onChangeText={setEditorContent}
              multiline
              textAlignVertical="top"
              placeholder={`Escreva o conteúdo do documento aqui...\n\nUse as variáveis no painel ao lado para inserir dados automáticos.\n\nExemplo:\nEu, {{NOME_DIRECTOR}}, Director(a) da {{NOME_ESCOLA}}, declaro que {{NOME_COMPLETO}}, portador(a) do BI nº _______, filho(a) de _______ e _______, nascido(a) em {{DATA_NASCIMENTO}}, na província de {{PROVINCIA}}, está regularmente matriculado(a) na {{CLASSE}}, turma {{TURMA}}, no ano lectivo {{ANO_LECTIVO}}.\n\nLuanda, {{DATA_ACTUAL}}.`}
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.editorStats}>
              <Text style={styles.editorStatsText}>{editorContent.length} caracteres · {editorContent.split('\n').length} linhas</Text>
            </View>
          </View>

          {/* Variables panel */}
          {showVarsPanel && (
            <View style={[styles.varsPanel, isWide && { width: 260 }]}>
              <View style={styles.varsPanelHeader}>
                <Ionicons name="code-slash" size={15} color={Colors.gold} />
                <Text style={styles.varsPanelTitle}>Variáveis disponíveis</Text>
              </View>
              <Text style={styles.varsPanelHint}>Toque numa variável para inserir no documento</Text>

              {/* Group tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupTabScroll} contentContainerStyle={{ gap: 6 }}>
                {VARIABLE_GROUPS.map((g, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.groupTab, activeVarGroup === i && { backgroundColor: g.cor + '22', borderColor: g.cor }]}
                    onPress={() => setActiveVarGroup(i)}
                  >
                    <Ionicons name={g.icon as any} size={13} color={activeVarGroup === i ? g.cor : Colors.textMuted} />
                    <Text style={[styles.groupTabText, activeVarGroup === i && { color: g.cor }]}>{g.grupo}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Variables list */}
              <ScrollView style={styles.varsList} showsVerticalScrollIndicator={false}>
                {VARIABLE_GROUPS[activeVarGroup].vars.map((v, i) => (
                  <TouchableOpacity key={i} style={styles.varItem} onPress={() => insertVariable(v.tag)} activeOpacity={0.7}>
                    <View style={styles.varItemInner}>
                      <Text style={styles.varTag}>{v.tag}</Text>
                      <Text style={styles.varDesc}>{v.desc}</Text>
                      <Text style={styles.varExemplo}>Ex: {v.exemplo}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={18} color={VARIABLE_GROUPS[activeVarGroup].cor} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── EMIT ─────────────────────────────────────────────────────────────────

  function EmitScreen() {
    const isPauta = isPautaType(emitTemplate);

    // ── Turma-level (pauta) variables ─────────────────────────────────────
    const turmasAtivas = turmas.filter(t => t.ativo);
    const filteredTurmas = turmaSearch.trim()
      ? turmasAtivas.filter(t =>
          `${t.classe} ${t.nome} ${t.anoLetivo}`.toLowerCase().includes(turmaSearch.toLowerCase())
        )
      : turmasAtivas;
    const selectedTurmaObj = turmas.find(t => t.id === emitTurmaId);
    const alunosDaTurma = emitTurmaId ? alunos.filter(a => a.ativo && a.turmaId === emitTurmaId) : [];
    const disciplinasDaTurma = emitTurmaId
      ? [...new Set(notas.filter(n => n.turmaId === emitTurmaId).map(n => n.disciplina))].sort()
      : [];

    // ── Student-level (document) variables ────────────────────────────────
    const alunosAtivos = alunos.filter(a => a.ativo);
    const filteredAlunos = alunoSearch.trim()
      ? alunosAtivos.filter(a =>
          `${a.nome} ${a.apelido} ${a.numeroMatricula}`.toLowerCase().includes(alunoSearch.toLowerCase())
        )
      : alunosAtivos;
    const selectedAluno = alunos.find(a => a.id === emitAlunoId);
    const selectedTurmaForAluno = selectedAluno ? turmas.find(t => t.id === selectedAluno.turmaId) : null;

    const canPrint = isPauta ? !!emitTurmaId : (!!emitAlunoId && !!emitPreview);

    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('list')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Emitir Documento</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{emitTemplate?.nome}</Text>
          </View>
          {canPrint ? (
            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.8}>
              <Ionicons name="print" size={16} color="#fff" />
              <Text style={styles.printBtnText}>Imprimir</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.emitBody, isWide && { flexDirection: 'row' }]}>
          {/* Left: Turma selector (pauta) or Student selector (documents) */}
          <View style={[styles.emitLeft, isWide && { width: 300 }]}>
            {isPauta ? (
              <>
                <Text style={styles.emitSectionTitle}>1. Seleccionar Turma</Text>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={turmaSearch}
                    onChangeText={setTurmaSearch}
                    placeholder="Pesquisar turma..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {filteredTurmas.map(turma => {
                    const sel = emitTurmaId === turma.id;
                    const count = alunos.filter(a => a.ativo && a.turmaId === turma.id).length;
                    return (
                      <TouchableOpacity
                        key={turma.id}
                        style={[styles.alunoItem, sel && styles.alunoItemSel]}
                        onPress={() => { setEmitTurmaId(turma.id); setTurmaSearch(''); }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.alunoAvatar, sel && { backgroundColor: '#dc2626' }]}>
                          <Text style={styles.alunoAvatarText}>{turma.classe.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.alunoNome, sel && { color: '#dc2626' }]}>{turma.classe} — {turma.nome}</Text>
                          <Text style={styles.alunoMeta}>{turma.anoLetivo} · {turma.turno} · {count} alunos</Text>
                        </View>
                        {sel && <Ionicons name="checkmark-circle" size={18} color="#dc2626" />}
                      </TouchableOpacity>
                    );
                  })}
                  {filteredTurmas.length === 0 && (
                    <Text style={styles.noAlunos}>Nenhuma turma encontrada</Text>
                  )}
                </ScrollView>
                {selectedTurmaObj && (
                  <View style={styles.selectedInfo}>
                    <Text style={styles.selectedInfoTitle}>Turma seleccionada:</Text>
                    <Text style={styles.selectedInfoName}>{selectedTurmaObj.classe} — {selectedTurmaObj.nome}</Text>
                    <Text style={styles.selectedInfoMeta}>{selectedTurmaObj.nivel} · {selectedTurmaObj.anoLetivo} · {selectedTurmaObj.turno}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.emitSectionTitle}>1. Seleccionar Aluno</Text>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    value={alunoSearch}
                    onChangeText={setAlunoSearch}
                    placeholder="Pesquisar aluno..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {filteredAlunos.slice(0, 50).map(aluno => {
                    const t = turmas.find(tr => tr.id === aluno.turmaId);
                    const sel = emitAlunoId === aluno.id;
                    return (
                      <TouchableOpacity
                        key={aluno.id}
                        style={[styles.alunoItem, sel && styles.alunoItemSel]}
                        onPress={() => handleSelectAluno(aluno.id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.alunoAvatar, sel && { backgroundColor: Colors.info }]}>
                          <Text style={styles.alunoAvatarText}>{aluno.nome.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.alunoNome, sel && { color: Colors.info }]}>{aluno.nome} {aluno.apelido}</Text>
                          <Text style={styles.alunoMeta}>{t ? `${t.classe} · ${t.nome}` : 'Sem turma'} · Nº {aluno.numeroMatricula}</Text>
                        </View>
                        {sel && <Ionicons name="checkmark-circle" size={18} color={Colors.info} />}
                      </TouchableOpacity>
                    );
                  })}
                  {filteredAlunos.length === 0 && (
                    <Text style={styles.noAlunos}>Nenhum aluno encontrado</Text>
                  )}
                </ScrollView>
                {selectedAluno && (
                  <View style={styles.selectedInfo}>
                    <Text style={styles.selectedInfoTitle}>Aluno seleccionado:</Text>
                    <Text style={styles.selectedInfoName}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                    <Text style={styles.selectedInfoMeta}>{selectedTurmaForAluno?.classe} · {selectedTurmaForAluno?.nome} · {selectedAluno.provincia}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Right: Pauta summary or Document preview */}
          <View style={[styles.emitRight, isWide && { flex: 1 }]}>
            {isPauta ? (
              <>
                <Text style={styles.emitSectionTitle}>2. Resumo da Pauta</Text>
                {!selectedTurmaObj ? (
                  <View style={styles.previewEmpty}>
                    <Ionicons name="list-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.previewEmptyText}>Seleccione uma turma para gerar a Pauta Final</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                    <View style={{ backgroundColor: '#1e2a3a', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#dc2626' }}>
                      <Text style={{ color: '#dc2626', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>PAUTA FINAL — A3 PAISAGEM</Text>
                      <Text style={{ color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>{selectedTurmaObj.classe} — {selectedTurmaObj.nome}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{selectedTurmaObj.nivel} · Ano Lectivo {selectedTurmaObj.anoLetivo} · Turno {selectedTurmaObj.turno}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={22} color={Colors.info} />
                        <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{alunosDaTurma.length}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Alunos</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="book-outline" size={22} color={Colors.success} />
                        <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{disciplinasDaTurma.length}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Disciplinas</Text>
                      </View>
                    </View>
                    {disciplinasDaTurma.length > 0 && (
                      <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>DISCIPLINAS INCLUÍDAS</Text>
                        {disciplinasDaTurma.map(d => (
                          <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                            <Text style={{ color: Colors.text, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{d}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={{ backgroundColor: '#1a2e1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.success, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="information-circle-outline" size={18} color={Colors.success} />
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 }}>
                        A pauta será gerada em formato A3 paisagem com colunas MT1, MT2, MT3 e MFD por disciplina. Clique em Imprimir para abrir o documento.
                      </Text>
                    </View>
                  </ScrollView>
                )}
              </>
            ) : (
              <>
                <Text style={styles.emitSectionTitle}>2. Pré-visualização do Documento</Text>
                {!emitPreview ? (
                  <View style={styles.previewEmpty}>
                    <Ionicons name="document-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.previewEmptyText}>Seleccione um aluno para pré-visualizar o documento com os dados preenchidos</Text>
                  </View>
                ) : (
                  <View style={styles.previewOuter}>
                    {emitTemplate?.marcaAguaBase64 ? (
                      <View style={styles.watermarkContainer} pointerEvents="none">
                        <Image source={{ uri: emitTemplate.marcaAguaBase64 }} style={styles.watermarkImage} resizeMode="contain" />
                      </View>
                    ) : (
                      <View style={styles.watermarkContainer} pointerEvents="none">
                        <Text style={styles.watermarkText}>{config.nomeEscola || 'SIGA'}</Text>
                      </View>
                    )}
                    <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                      <View style={styles.docHeader}>
                        {emitTemplate?.insigniaBase64 ? (
                          <Image source={{ uri: emitTemplate.insigniaBase64 }} style={styles.docInsignia} resizeMode="contain" />
                        ) : (
                          <View style={styles.docInsigniaPlaceholder}>
                            <Text style={styles.docInsigniaLetter}>{(config.nomeEscola || 'E').charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={styles.docRepublika}>República de Angola</Text>
                        <Text style={styles.docEscola}>{config.nomeEscola}</Text>
                        <View style={styles.docDivider} />
                        <Text style={styles.docTipo}>{TIPO_LABELS[emitTemplate!.tipo]}</Text>
                      </View>
                      <Text style={styles.docBody}>{emitPreview}</Text>
                      <View style={styles.docSignature}>
                        <Text style={styles.docSignatureDate}>Luanda, {new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                        <View style={styles.docSignatureLine} />
                        <Text style={styles.docSignatureName}>{user?.nome}</Text>
                        <Text style={styles.docSignatureRole}>Director(a)</Text>
                      </View>
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </View>
    );
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryDark,
  },
  backBtn: { padding: 6 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  newBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  printBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // List
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: Colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  // Card
  card: {
    backgroundColor: Colors.backgroundCard, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tipoText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  menuBtn: { padding: 4 },
  cardNome: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  cardPreview: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardDate: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.surface, borderRadius: 8 },
  cardActionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  dropMenu: {
    position: 'absolute', top: 48, right: 8, zIndex: 99,
    backgroundColor: Colors.backgroundCard, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 8, minWidth: 200, padding: 4,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  dropItemText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text },
  dropDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },

  // Editor
  editorHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryDark,
  },
  editorNomeInput: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text,
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.success, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  tipoScroll: { maxHeight: 48, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tipoChip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'center',
  },
  tipoChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  editorBody: { flex: 1, flexDirection: 'column' },
  editorTextWrap: { flex: 1, display: 'flex', flexDirection: 'column' },
  editorToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  editorToolbarLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  toggleVarsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleVarsText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  editorTextInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_400Regular',
    color: Colors.text, backgroundColor: Colors.background,
    lineHeight: 24,
  },
  editorStats: {
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: Colors.backgroundCard, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  editorStatsText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Variables panel
  varsPanel: {
    backgroundColor: Colors.primaryDark, borderTopWidth: 1, borderTopColor: Colors.border,
    borderLeftWidth: 1, borderLeftColor: Colors.border, maxHeight: 320,
  },
  varsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
  },
  varsPanelTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.8 },
  varsPanelHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, paddingHorizontal: 14, paddingBottom: 8 },
  groupTabScroll: { paddingHorizontal: 10, paddingBottom: 8 },
  groupTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  groupTabText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  varsList: { flex: 1, paddingHorizontal: 10 },
  varItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  varItemInner: { flex: 1 },
  varTag: { fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Inter_600SemiBold', color: Colors.gold },
  varDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 1 },
  varExemplo: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1, fontStyle: 'italic' },

  // Emit
  emitBody: { flex: 1, flexDirection: 'column' },
  emitLeft: {
    borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.primaryDark, padding: 14,
    maxHeight: '100%',
  },
  emitRight: { flex: 1, padding: 14 },
  emitSectionTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text },
  alunoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4,
    borderWidth: 1, borderColor: 'transparent',
  },
  alunoItemSel: { backgroundColor: Colors.info + '15', borderColor: Colors.info + '50' },
  alunoAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  alunoAvatarText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
  alunoNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alunoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  noAlunos: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', padding: 20 },
  selectedInfo: {
    marginTop: 10, padding: 12, backgroundColor: Colors.info + '15',
    borderRadius: 10, borderWidth: 1, borderColor: Colors.info + '40',
  },
  selectedInfoTitle: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase' },
  selectedInfoName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 2 },
  selectedInfoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginTop: 2 },

  // Preview
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
  previewEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', maxWidth: 300 },
  previewOuter: { flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  watermarkContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 0,
    transform: [{ rotate: '-40deg' }],
  },
  watermarkText: {
    fontSize: Platform.OS === 'web' ? 52 : 36,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(0,0,0,0.04)',
    letterSpacing: 6,
    textAlign: 'center',
  },
  watermarkImage: {
    width: '80%' as any,
    height: 200,
    opacity: 0.06,
  },
  previewScroll: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  docHeader: { alignItems: 'center', marginBottom: 24 },
  docInsignia: { width: 72, height: 72, marginBottom: 8 },
  docInsigniaPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#e8e8e8', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 2, borderColor: '#ccc',
  },
  docInsigniaLetter: { fontSize: 30, fontFamily: 'Inter_700Bold', color: '#555' },
  docRepublika: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  docEscola: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1a1a1a', textAlign: 'center' },
  docTipo: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#444', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.5 },
  docDivider: { height: 2, backgroundColor: '#1a1a1a', width: 60, marginTop: 10, marginBottom: 2 },
  docBody: { fontSize: 14, fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : 'Inter_400Regular', color: '#1a1a1a', lineHeight: 26, textAlign: 'justify' },
  docSignature: { marginTop: 48, alignItems: 'center', gap: 4 },
  docSignatureDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#444' },
  docSignatureLine: { width: 200, height: 1, backgroundColor: '#333', marginTop: 40, marginBottom: 6 },
  docSignatureName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#1a1a1a' },
  docSignatureRole: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#444' },

  // Appearance section
  appearSection: {
    backgroundColor: Colors.primaryDark,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  appearHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  appearHeaderTitle: {
    flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold',
    color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  appearBody: {
    paddingHorizontal: 16, paddingBottom: 14,
  },
  appearItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 8,
  },
  appearItemInfo: { flex: 1 },
  appearItemLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  appearItemHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  appearItemControls: { alignItems: 'flex-end', gap: 4 },
  appearDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    borderStyle: 'dashed',
  },
  uploadBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.gold },
  changeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  changeBtnText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },

  imagePreviewWrap: { alignItems: 'center', gap: 4 },
  imagePreview: {
    width: 64, height: 64, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  imagePreviewMarcaWrap: {
    width: 64, height: 50, borderRadius: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  imagePreviewMarca: { width: '100%' as any, height: '100%' as any, opacity: 0.4 },
  imagePreviewMarcaOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6 },
});
