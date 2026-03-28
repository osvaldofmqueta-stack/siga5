import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Platform, Dimensions, FlatList, Image, Alert, Animated, ActivityIndicator, Modal,
} from 'react-native';
import { Editor } from '@tinymce/tinymce-react';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as XLSX from 'xlsx';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useConfig } from '@/context/ConfigContext';

// ─── Types ─────────────────────────────────────────────────────────────────

type DocTipo = 'declaracao' | 'certificado' | 'atestado' | 'oficio' | 'pauta' | 'pauta_final' | 'ficha_matricula' | 'mapa_aproveitamento' | 'mapa_frequencias' | 'lista_turma' | 'certificado_primario' | 'ficha_inscricao' | 'recibo_salario' | 'extrato_propina' | 'outro';
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
  bloqueado?: boolean;
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
  {
    grupo: 'Funcionário / RH',
    icon: 'briefcase',
    cor: '#10b981',
    vars: [
      { tag: '{{FUNC_NOME}}', desc: 'Nome completo do funcionário', exemplo: 'António Manuel da Silva' },
      { tag: '{{FUNC_CARGO}}', desc: 'Cargo do funcionário', exemplo: 'Professor' },
      { tag: '{{FUNC_CATEGORIA}}', desc: 'Categoria / nível', exemplo: 'Técnico Superior' },
      { tag: '{{MES_ANO_FOLHA}}', desc: 'Mês e ano da folha de salário', exemplo: 'Março 2026' },
      { tag: '{{SALARIO_BASE}}', desc: 'Salário base (Kz)', exemplo: '150.000,00 Kz' },
      { tag: '{{SUB_ALIMENTACAO}}', desc: 'Subsídio de alimentação (Kz)', exemplo: '15.000,00 Kz' },
      { tag: '{{SUB_TRANSPORTE}}', desc: 'Subsídio de transporte (Kz)', exemplo: '10.000,00 Kz' },
      { tag: '{{SUB_HABITACAO}}', desc: 'Subsídio de habitação (Kz)', exemplo: '20.000,00 Kz' },
      { tag: '{{OUTROS_SUBSIDIOS}}', desc: 'Outros subsídios (Kz)', exemplo: '0,00 Kz' },
      { tag: '{{SALARIO_BRUTO}}', desc: 'Total bruto (Kz)', exemplo: '195.000,00 Kz' },
      { tag: '{{INSS_EMPREGADO}}', desc: 'INSS empregado 3% (Kz)', exemplo: '4.500,00 Kz' },
      { tag: '{{IRT}}', desc: 'IRT — tabela progressiva (Kz)', exemplo: '12.000,00 Kz' },
      { tag: '{{OUTROS_DESCONTOS}}', desc: 'Outros descontos (Kz)', exemplo: '0,00 Kz' },
      { tag: '{{TOTAL_DESCONTOS}}', desc: 'Total de descontos (Kz)', exemplo: '16.500,00 Kz' },
      { tag: '{{SALARIO_LIQUIDO}}', desc: 'Salário líquido a receber (Kz)', exemplo: '178.500,00 Kz' },
      { tag: '{{INSS_PATRONAL}}', desc: 'INSS patronal 8% — informativo (Kz)', exemplo: '12.000,00 Kz' },
      { tag: '{{STATUS_FOLHA}}', desc: 'Estado da folha de salário', exemplo: 'Aprovada' },
    ],
  },
  {
    grupo: 'Extracto de Propinas',
    icon: 'cash',
    cor: '#0d9488',
    vars: [
      { tag: '{{TOTAL_PAGO}}', desc: 'Total pago pelo aluno (Kz)', exemplo: '75.000,00 Kz' },
      { tag: '{{TOTAL_PENDENTE}}', desc: 'Total de propinas em atraso (Kz)', exemplo: '15.000,00 Kz' },
      { tag: '{{TOTAL_CANCELADO}}', desc: 'Total de pagamentos cancelados (Kz)', exemplo: '0,00 Kz' },
      { tag: '{{TOTAL_TRANSACCOES}}', desc: 'Número total de transacções', exemplo: '9' },
      { tag: '{{PERIODO_INICIO}}', desc: 'Data de início do período do extracto', exemplo: '01/01/2025' },
      { tag: '{{PERIODO_FIM}}', desc: 'Data de fim do período do extracto', exemplo: '31/12/2025' },
      { tag: '{{DOC_REF}}', desc: 'Referência única do documento', exemplo: 'EXTR-2025001-ABC123' },
      { tag: '{{CHEFE_SECRETARIA}}', desc: 'Nome do Chefe de Secretaria', exemplo: 'Maria da Silva' },
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
  mapa_aproveitamento: 'Mapa de Aproveitamento',
  mapa_frequencias: 'Mapa de Frequências',
  lista_turma: 'Lista da Turma',
  certificado_primario: 'Certificado Primário',
  ficha_inscricao: 'Boletim de Inscrição',
  recibo_salario: 'Recibo de Vencimento',
  extrato_propina: 'Extracto de Propinas',
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
  mapa_aproveitamento: '#065f46',
  mapa_frequencias: '#1e40af',
  lista_turma: '#0369a1',
  certificado_primario: '#7c3aed',
  ficha_inscricao: '#CC1A1A',
  recibo_salario: '#10b981',
  extrato_propina: '#0d9488',
  outro: Colors.textMuted,
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Map of all template variables → example values (for preview without real data)
const VARIABLE_EXAMPLE_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const group of VARIABLE_GROUPS) {
    for (const v of group.vars) {
      map[v.tag] = v.exemplo;
    }
  }
  return map;
})();

// ─── Rich Text Editor helpers ────────────────────────────────────────────────

function isHtmlContent(s: string): boolean {
  return s.trim().startsWith('<');
}

function plainTextToHtml(text: string): string {
  if (!text) return '';
  if (isHtmlContent(text)) return text;
  return text.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function buildQuillSrcdoc(initialHtml: string): string {
  const safeInitial = JSON.stringify(initialHtml);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overflow:hidden;background:#f0f0f0;font-family:sans-serif}
  body{display:flex;flex-direction:column}
  #toolbar{
    display:flex;flex-wrap:wrap;align-items:center;gap:2px;
    background:#1a2540;border-bottom:1px solid #2d3a5a;
    padding:5px 8px;flex-shrink:0;
  }
  #toolbar button,#toolbar select{
    background:transparent;border:none;color:#94a3b8;cursor:pointer;
    border-radius:4px;padding:3px 6px;font-size:13px;line-height:1;
    transition:background 0.15s,color 0.15s;
    display:inline-flex;align-items:center;justify-content:center;
  }
  #toolbar button:hover,#toolbar select:hover{background:rgba(255,255,255,0.1);color:#fff}
  #toolbar button.active{background:rgba(255,255,255,0.15);color:#fff}
  #toolbar select{color:#94a3b8;padding:3px 4px;font-size:12px;background:#1a2540;outline:none}
  #toolbar select option{background:#1a2540;color:#e2e8f0}
  #toolbar .sep{width:1px;height:18px;background:#2d3a5a;margin:0 3px}
  #editorWrap{flex:1;overflow-y:auto;background:#fff;padding:0;position:relative}
  #editor{
    min-height:100%;padding:28px 36px;
    font-family:'Times New Roman',Times,serif;
    font-size:14px;line-height:1.9;color:#111;
    background:#fff;
    outline:none;white-space:pre-wrap;word-break:break-word;
  }
  #editor:empty::before{
    content:'Escreva o conteúdo do documento aqui...';
    color:#aaa;font-style:italic;pointer-events:none;
  }
  #editor .var-tag{
    background:#dbeafe;color:#1d4ed8;border-radius:3px;
    padding:1px 4px;font-family:monospace;font-size:12px;
    font-style:normal;
  }
  #editor img{
    cursor:pointer;transition:outline 0.15s;
  }
  #editor img.img-selected{
    outline:2px solid #3b82f6;
    outline-offset:2px;
  }
  #imgToolbar{
    display:none;position:fixed;z-index:9999;
    background:#1a2540;border:1px solid #3b82f6;
    border-radius:8px;padding:4px 6px;
    gap:2px;align-items:center;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
  }
  #imgToolbar.visible{display:flex}
  #imgToolbar button{
    background:transparent;border:none;color:#94a3b8;cursor:pointer;
    border-radius:4px;padding:4px 7px;font-size:13px;line-height:1;
    transition:background 0.15s,color 0.15s;
    display:inline-flex;align-items:center;justify-content:center;
    white-space:nowrap;
  }
  #imgToolbar button:hover{background:rgba(255,255,255,0.12);color:#fff}
  #imgToolbar button.act{background:rgba(59,130,246,0.3);color:#60a5fa}
  #imgToolbar .isep{width:1px;height:16px;background:#2d3a5a;margin:0 2px;flex-shrink:0}
  #imgSizeLabel{color:#64748b;font-size:11px;padding:0 4px;white-space:nowrap}
</style>
</head>
<body>
<input type="file" id="imgInput" accept="image/*" style="display:none">

<!-- Floating image toolbar -->
<div id="imgToolbar">
  <button id="iBtn_sl" title="Alinhar à esquerda" onclick="imgAlign('left')">&#8676;</button>
  <button id="iBtn_sc" title="Centralizar" onclick="imgAlign('center')">&#9636;</button>
  <button id="iBtn_sr" title="Alinhar à direita" onclick="imgAlign('right')">&#8677;</button>
  <div class="isep"></div>
  <button title="Reduzir (−20%)" onclick="imgResize(-0.2)">&#8722;</button>
  <span id="imgSizeLabel">100%</span>
  <button title="Ampliar (+20%)" onclick="imgResize(+0.2)">&#43;</button>
  <button title="Largura total" onclick="imgFull()">&#8614;</button>
  <div class="isep"></div>
  <button title="Eliminar imagem" onclick="imgDelete()" style="color:#f87171">&#128465;</button>
</div>

<div id="toolbar">
  <select id="fontSize" title="Tamanho">
    <option value="1">Pequeno</option>
    <option value="3" selected>Normal</option>
    <option value="4">Grande</option>
    <option value="5">Maior</option>
    <option value="7">Muito grande</option>
  </select>
  <div class="sep"></div>
  <button id="btnBold" title="Negrito" onclick="fmt('bold')"><b>B</b></button>
  <button id="btnItalic" title="Itálico" onclick="fmt('italic')"><i>I</i></button>
  <button id="btnUnderline" title="Sublinhado" onclick="fmt('underline')"><u>U</u></button>
  <button id="btnStrike" title="Rasurado" onclick="fmt('strikeThrough')"><s>S</s></button>
  <div class="sep"></div>
  <button title="Alinhar à esquerda" onclick="fmt('justifyLeft')">&#8676;</button>
  <button title="Centrar" onclick="fmt('justifyCenter')">&#9636;</button>
  <button title="Alinhar à direita" onclick="fmt('justifyRight')">&#8677;</button>
  <button title="Justificar" onclick="fmt('justifyFull')">&#9636;&#9636;</button>
  <div class="sep"></div>
  <button title="Lista com pontos" onclick="fmt('insertUnorderedList')">&#8226;&#8212;</button>
  <button title="Lista numerada" onclick="fmt('insertOrderedList')">1.</button>
  <div class="sep"></div>
  <button title="Inserir imagem (ou cola com Ctrl+V)" onclick="document.getElementById('imgInput').click()" style="font-size:16px">&#128247;</button>
  <div class="sep"></div>
  <button title="Limpar formatação" onclick="fmt('removeFormat')" style="font-size:11px">&#10006; fmt</button>
</div>
<div id="editorWrap">
  <div id="editor" contenteditable="true" spellcheck="true"></div>
</div>
<script>
  var ed = document.getElementById('editor');
  var timer;
  var savedRange = null;
  var selectedImg = null;
  var imgToolbar = document.getElementById('imgToolbar');

  var initial = ${safeInitial};
  if (initial) { ed.innerHTML = initial; }

  // ── Image selection ──────────────────────────────────────────────────────

  function getImgNaturalWidth(img) {
    return img.naturalWidth || img.width || 300;
  }

  function getCurrentWidthPct(img) {
    var w = img.style.width;
    if (!w) return 100;
    if (w.endsWith('%')) return parseFloat(w);
    // px → convert to percentage of editor width
    var edW = ed.clientWidth - 72; // subtract padding
    return Math.round((parseFloat(w) / edW) * 100);
  }

  function positionImgToolbar(img) {
    var rect = img.getBoundingClientRect();
    var tb = imgToolbar;
    var tbH = tb.offsetHeight || 36;
    var tbW = tb.offsetWidth || 280;
    var top = rect.top - tbH - 8;
    if (top < 0) top = rect.bottom + 8;
    var left = rect.left + (rect.width - tbW) / 2;
    if (left < 4) left = 4;
    if (left + tbW > window.innerWidth - 4) left = window.innerWidth - tbW - 4;
    tb.style.top = top + 'px';
    tb.style.left = left + 'px';
    // update size label
    document.getElementById('imgSizeLabel').textContent = getCurrentWidthPct(img) + '%';
    // update alignment buttons
    var al = img.style.marginLeft;
    document.getElementById('iBtn_sl').classList.toggle('act', !img.style.marginLeft || img.style.marginLeft === '0px');
    document.getElementById('iBtn_sc').classList.toggle('act', img.style.marginLeft === 'auto' && img.style.marginRight === 'auto');
    document.getElementById('iBtn_sr').classList.toggle('act', img.style.marginLeft === 'auto' && img.style.marginRight === '0px');
  }

  function selectImg(img) {
    deselectImg();
    selectedImg = img;
    img.classList.add('img-selected');
    imgToolbar.classList.add('visible');
    positionImgToolbar(img);
  }

  function deselectImg() {
    if (selectedImg) {
      selectedImg.classList.remove('img-selected');
      selectedImg = null;
    }
    imgToolbar.classList.remove('visible');
  }

  // Click on image in editor → select it
  ed.addEventListener('click', function(e) {
    if (e.target && e.target.tagName === 'IMG') {
      e.preventDefault();
      selectImg(e.target);
    } else {
      deselectImg();
    }
  });

  // Hide toolbar when clicking outside
  document.addEventListener('click', function(e) {
    if (!imgToolbar.contains(e.target) && e.target !== selectedImg) {
      deselectImg();
    }
  });

  // Reposition toolbar on scroll
  document.getElementById('editorWrap').addEventListener('scroll', function() {
    if (selectedImg) positionImgToolbar(selectedImg);
  });

  // ── Image toolbar actions ────────────────────────────────────────────────

  function imgAlign(dir) {
    if (!selectedImg) return;
    selectedImg.style.display = 'block';
    if (dir === 'center') {
      selectedImg.style.marginLeft = 'auto';
      selectedImg.style.marginRight = 'auto';
      selectedImg.style.float = 'none';
    } else if (dir === 'left') {
      selectedImg.style.marginLeft = '0';
      selectedImg.style.marginRight = 'auto';
      selectedImg.style.float = 'none';
    } else if (dir === 'right') {
      selectedImg.style.marginLeft = 'auto';
      selectedImg.style.marginRight = '0';
      selectedImg.style.float = 'none';
    }
    positionImgToolbar(selectedImg);
    sendChange();
  }

  function imgResize(delta) {
    if (!selectedImg) return;
    var edW = ed.clientWidth - 72;
    var curPct = getCurrentWidthPct(selectedImg);
    var newPct = Math.max(10, Math.min(100, Math.round(curPct + delta * 100)));
    selectedImg.style.width = newPct + '%';
    selectedImg.style.height = 'auto';
    selectedImg.style.maxWidth = '100%';
    setTimeout(function(){ positionImgToolbar(selectedImg); }, 50);
    sendChange();
  }

  function imgFull() {
    if (!selectedImg) return;
    selectedImg.style.width = '100%';
    selectedImg.style.height = 'auto';
    selectedImg.style.maxWidth = '100%';
    selectedImg.style.marginLeft = '0';
    selectedImg.style.marginRight = '0';
    selectedImg.style.display = 'block';
    positionImgToolbar(selectedImg);
    sendChange();
  }

  function imgDelete() {
    if (!selectedImg) return;
    selectedImg.parentNode && selectedImg.parentNode.removeChild(selectedImg);
    deselectImg();
    sendChange();
  }

  // ── Editor core ──────────────────────────────────────────────────────────

  function fmt(cmd, val) {
    ed.focus();
    document.execCommand(cmd, false, val || null);
    sendChange();
    updateToolbar();
  }

  document.getElementById('fontSize').addEventListener('change', function() {
    fmt('fontSize', this.value);
  });

  function sendChange() {
    clearTimeout(timer);
    timer = setTimeout(function() {
      window.parent.postMessage({ type: 'ck_change', html: ed.innerHTML }, '*');
    }, 300);
  }

  ed.addEventListener('input', sendChange);
  ed.addEventListener('keyup', updateToolbar);
  ed.addEventListener('mouseup', function(e) {
    if (!e.target || e.target.tagName !== 'IMG') updateToolbar();
  });

  ed.addEventListener('blur', function() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
  });

  function insertImageDataUrl(dataUrl) {
    ed.focus();
    var sel = window.getSelection();
    var range;
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
      range = savedRange;
      savedRange = null;
    } else if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    }
    var img = document.createElement('img');
    img.src = dataUrl;
    img.style.width = '60%';
    img.style.height = 'auto';
    img.style.maxWidth = '100%';
    img.style.display = 'block';
    img.style.marginLeft = 'auto';
    img.style.marginRight = 'auto';
    img.style.margin = '8px auto';
    if (range) {
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      ed.appendChild(img);
    }
    setTimeout(function(){ selectImg(img); }, 50);
    sendChange();
  }

  function readFileAsDataUrl(file, cb) {
    var reader = new FileReader();
    reader.onload = function(e) { cb(e.target.result); };
    reader.readAsDataURL(file);
  }

  document.getElementById('imgInput').addEventListener('change', function() {
    var file = this.files[0];
    if (!file) return;
    readFileAsDataUrl(file, insertImageDataUrl);
    this.value = '';
  });

  ed.addEventListener('paste', function(e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file) readFileAsDataUrl(file, insertImageDataUrl);
        return;
      }
    }
  });

  function updateToolbar() {
    document.getElementById('btnBold').classList.toggle('active', document.queryCommandState('bold'));
    document.getElementById('btnItalic').classList.toggle('active', document.queryCommandState('italic'));
    document.getElementById('btnUnderline').classList.toggle('active', document.queryCommandState('underline'));
    document.getElementById('btnStrike').classList.toggle('active', document.queryCommandState('strikeThrough'));
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'ck_insert') {
      ed.focus();
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        var range = sel.getRangeAt(0);
        range.deleteContents();
        var span = document.createElement('span');
        span.className = 'var-tag';
        span.textContent = e.data.text;
        range.insertNode(span);
        range.setStartAfter(span);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        var span2 = document.createElement('span');
        span2.className = 'var-tag';
        span2.textContent = e.data.text;
        ed.appendChild(span2);
      }
      sendChange();
    }
  });
</script>
</body>
</html>`;
}

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

// ─── Certificado de Habilitações — I Ciclo do Ensino Secundário Geral ────────

const SEED_CERT_HAB_I_CICLO_ID = 'tpl_seed_cert_hab_i_ciclo_geral_v1';
const SEED_CERT_HAB_I_CICLO: DocTemplate = {
  id: SEED_CERT_HAB_I_CICLO_ID,
  nome: 'Certificado de Habilitações — Iº Ciclo Ensino Secundário Geral (7ª, 8ª, 9ª)',
  tipo: 'certificado',
  classeAlvo: 'I-CICLO-GERAL',
  bloqueado: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[CERTIFICADO DE HABILITAÇÕES — I CICLO — GERADO AUTOMATICAMENTE]

Este modelo gera o Certificado de Habilitações oficial do Iº Ciclo do Ensino Secundário Geral (7ª, 8ª e 9ª Classes).

Dados preenchidos automaticamente (da base de dados):
• Nome completo do aluno (em vermelho)
• Pai/Encarregado de educação
• Data de nascimento (dia, mês e ano)
• Município e Província
• Nome da escola, Director(a), ano lectivo
• Tabela de classificações por ciclo de aprendizagem:
  — Coluna 7ª Classe → notas da turma de 7ª classe do aluno
  — Coluna 8ª Classe → notas da turma de 8ª classe do aluno
  — Coluna 9ª Classe → notas da turma de 9ª classe do aluno
  — Média Final por disciplina (média das 3 classes)
• Média Geral Final (média de todas as disciplinas)

Campos a preencher manualmente:
• Nome da mãe do aluno
• Número e arquivo do Bilhete de Identidade + data de emissão
• Número e data do Decreto Executivo de criação da escola
• Livro de termos nº e folha (para efeitos legais)
• Cidade para a data ("Luanda aos...")

Director(a): {{NOME_DIRECTOR}}
Escola: {{NOME_ESCOLA}}`,
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

const SEED_LISTA_TURMA_ID = 'tpl_seed_lista_turma_v1';
const SEED_LISTA_TURMA: DocTemplate = {
  id: SEED_LISTA_TURMA_ID,
  nome: 'Lista da Turma',
  tipo: 'lista_turma',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[LISTA DA TURMA — GERADA AUTOMATICAMENTE]

Este modelo gera automaticamente a Lista da Turma completa com todos os alunos da turma seleccionada.

Ao emitir, seleccione a turma e o sistema irá:
• Listar todos os alunos por ordem alfabética
• Mostrar: Nº, Nome do Aluno, Idade, Sexo, Data de Nascimento, Contactos
• Gerar o Mapa Estatístico (género e distribuição de idades)
• Calcular totais e percentagens automaticamente

Escola: {{NOME_ESCOLA}}
Classe: {{CLASSE}} | Turma: {{TURMA}} | Período: {{TURNO}} | Ano Lectivo: {{ANO_LECTIVO}}
Professor(a): Director(a) de Turma`,
};

const SEED_CERT_PRIMARIO_ID = 'tpl_seed_cert_primario_v1';
const SEED_CERT_PRIMARIO: DocTemplate = {
  id: SEED_CERT_PRIMARIO_ID,
  nome: 'Certificado do Ensino Primário',
  tipo: 'certificado_primario',
  bloqueado: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[CERTIFICADO DO ENSINO PRIMÁRIO — GERADO AUTOMATICAMENTE]

Este modelo gera o Certificado oficial de conclusão do Ensino Primário conforme a LBSEE 17/16.

Ao emitir, seleccione o aluno e o sistema irá preencher automaticamente:
• Nome completo do aluno, data e local de nascimento
• Género (filho/filha)
• Município e Província
• Tabela de classificações por ciclo (2ª, 4ª e 6ª Classe)
• Médias finais por disciplina e por extenso
• Média Geral Final

Campos a preencher manualmente:
• Nome do pai e da mãe
• Número e data do Bilhete de Identidade / Passaporte
• Nº e data do Decreto Executivo de criação da escola
• Livro de registo e folha

Escola: {{NOME_ESCOLA}}
Director(a): {{NOME_DIRECTOR}}`,
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

// ─── Mapa de Aproveitamento ──────────────────────────────────────────────────

// ─── Mapa de Aproveitamento — Detalhado por Turma (IIIº Trimestre style) ──────

// ─── Mapa de Frequências — Por Curso e Classe (10ª–13ª) ──────────────────────

const SEED_MAPA_FREQUENCIAS_ID = 'tpl_seed_mapa_frequencias_v1';
const SEED_MAPA_FREQUENCIAS: DocTemplate = {
  id: SEED_MAPA_FREQUENCIAS_ID,
  nome: 'Mapa de Frequências — Por Curso e Classe (10ª–13ª)',
  tipo: 'mapa_frequencias',
  classeAlvo: 'FREQUENCIAS',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `MAPA DE FREQUÊNCIAS
(10ª, 11ª, 12ª, e 13ª CLASSES) ANO LECTIVO {{ANO_LECTIVO}}

Enviado à: Direcção Nacional do Ensino Técnico Profissional

Estrutura (por Curso × Classe):
  NOME DO CURSO | 10ª Classe [Nº Turmas | Alunos Matriculados M/F/Total]
               | 11ª Classe [...]  | 12ª Classe [...]  | 13ª Classe [...]
               | TOTAL GERAL [Nº Turmas | Alunos Matriculados M/F/Total]

Dados calculados automaticamente: número de turmas activas e alunos matriculados por sexo.
Assinado por: O Subdirector Pedagógico.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

// ─── Mapa de Aproveitamento — Por Curso e Classe (10ª–13ª) ───────────────────

const SEED_MAPA_POR_CURSO_CLASSE_ID = 'tpl_seed_mapa_por_curso_classe_v1';
const SEED_MAPA_POR_CURSO_CLASSE: DocTemplate = {
  id: SEED_MAPA_POR_CURSO_CLASSE_ID,
  nome: 'Mapa de Aproveitamento — Por Curso e Classe (10ª–13ª)',
  tipo: 'mapa_aproveitamento',
  classeAlvo: 'CURSO_CLASSE',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `MAPA DE APROVEITAMENTO ESCOLAR DOS ALUNOS
Referente ao {{TRIMESTRE}}º Trimestre do Ano Lectivo de {{ANO_LECTIVO}}
(10ª, 11ª, 12ª, 13ª Classes) — Regime Diurno

Nome da Escola: {{NOME_ESCOLA}}

Estrutura da tabela (por Curso × Classe):
  NOME DO CURSO | 10ª Classe [Aprovados M/F/Total | Reprovados M/F/Total | D-AM-T-E M/F/Total]
               | 11ª Classe [...]  | 12ª Classe [...]  | 13ª Classe [...] | TOTAL GERAL [Aptos | N/Apt | D-AM-T-E]

D: Desistente; AM: Anulação de Matrícula; T: Transferido; E: Excluído

Os dados são calculados automaticamente a partir dos alunos e notas lançados no sistema.
Assinado por: O Subdirector Pedagógico.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_MAPA_TURMA_DETALHADO_ID = 'tpl_seed_mapa_turma_detalhado_v1';
const SEED_MAPA_TURMA_DETALHADO: DocTemplate = {
  id: SEED_MAPA_TURMA_DETALHADO_ID,
  nome: 'Mapa de Aproveitamento — Detalhado por Turma',
  tipo: 'mapa_aproveitamento',
  classeAlvo: 'TURMA_DETALHADO',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `MAPA DE APROVEITAMENTO DOS ALUNOS — {{TRIMESTRE}}º TRIMESTRE
Regime: Diurno/Nocturno — Ano Lectivo de {{ANO_LECTIVO}}

Nome da Escola: {{NOME_ESCOLA}}

Este documento é gerado automaticamente a partir dos dados lançados no sistema.

Colunas por Turma:
CURSO | CLASSE | PERÍODO | Alunos Matriculados (MF/F) | Alunos Avaliados (MF/F) | Alunos Aprovados (MF/F) | Alunos Reprovados (MF/F) | Alunos Desistentes (MF/F) | Alunos Anulação de Matrícula (MF/F) | Alunos Transferidos (MF/F) | Alunos Excluídos (MF/F) | % Aptos | % N/Aptos

Cada linha corresponde a uma turma activa no sistema.
Os totais são calculados automaticamente por nível e para toda a escola.

Assinado por: O Subdirector Pedagógico

Para emitir: clique em "Emitir" e seleccione o trimestre pretendido.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

const SEED_MAPA_APROVEITAMENTO_ID = 'tpl_seed_mapa_aproveitamento_v2';
const SEED_MAPA_APROVEITAMENTO: DocTemplate = {
  id: SEED_MAPA_APROVEITAMENTO_ID,
  nome: 'Mapa de Aproveitamento — Por Trimestre',
  tipo: 'mapa_aproveitamento',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `MAPA DE APROVEITAMENTO — {{TRIMESTRE}}º TRIMESTRE / {{ANO_LECTIVO}}

Este documento é gerado automaticamente a partir dos dados lançados no sistema.

Colunas: NÍVEL | CLASSE | MATRICULADOS (MF/F) | DESISTÊNCIA (MF/F) | AVALIADOS (MF/F) | C/APROVEITAMENTO (MF/F/%) | S/APROVEITAMENTO (MF/F/%) | Nº DE PROFESSORES (MF/F)

Níveis abrangidos:
• Ensino Primário: Iniciação, 1ª, 2ª, 3ª, 4ª, 5ª, 6ª Classe
• 1º Ciclo: 7ª, 8ª, 9ª Classe
• 2º Ciclo: 10ª, 11ª, 12ª Classe

Para emitir: clique em "Emitir" e seleccione o trimestre pretendido.
O mapa será gerado em formato A3 paisagem com todos os dados calculados automaticamente.

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
};

// ─── Certificado II Ciclo (10ª, 11ª, 12ª) — Ensino Secundário Geral ─────────

const SEED_CERT_II_CICLO_ID = 'tpl_seed_cert_ii_ciclo_v1';
const SEED_CERT_II_CICLO: DocTemplate = {
  id: SEED_CERT_II_CICLO_ID,
  nome: 'Certificado — II Ciclo (10ª, 11ª, 12ª) Ensino Secundário Geral',
  tipo: 'certificado',
  classeAlvo: '12ª-II-CICLO',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `CERTIFICADO — IIº CICLO ENSINO SECUNDÁRIO GERAL (10ª, 11ª, 12ª)

Director(a): {{NOME_DIRECTOR}} — {{NOME_ESCOLA}}
Aluno: {{NOME_COMPLETO}}
Filho(a) de {{PAI}} e de {{MAE}}
Nascido(a) aos {{DIA_NASC}}/{{MES_NASC}}/{{ANO_NASC}}
Natural de {{NATURALIDADE}}, Município de {{MUNICIPIO}}, Província de {{PROVINCIA}}
BI nº {{BI_NUMERO}}, passado pelo Arquivo de {{BI_LOCAL_EMISSAO}}, aos {{BI_DATA_EMISSAO}}

Concluiu no Ano Lectivo {{ANO_LECTIVO}} o IIº Ciclo do Ensino Secundário Geral
Área: {{AREA}} | Média Final: {{RESULTADO}} ({{RESULTADO_LETRA}})

Tabela de notas: 10ª Classe | 11ª Classe | 12ª Classe | Média Final | Extenso
(gerada automaticamente a partir das notas lançadas por classe)

{{NOME_ESCOLA}}, {{DATA_ACTUAL}}.`,
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

// ─── Certificado de Habilitações Literárias (II Ciclo Pedagógico) Seed ──────

const SEED_CERT_HAB_LIT_ID = 'tpl_seed_cert_hab_lit_pedagogico_v1';
const SEED_CERT_HAB_LIT: DocTemplate = {
  id: SEED_CERT_HAB_LIT_ID,
  nome: 'Certificado de Habilitações Literárias — IIº Ciclo Pedagógico (10ª a 13ª)',
  tipo: 'certificado',
  classeAlvo: 'PEDAGOGICO-II-CICLO',
  bloqueado: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[CERTIFICADO DE HABILITAÇÕES LITERÁRIAS — GERADO AUTOMATICAMENTE]

Este modelo gera o Certificado oficial de conclusão do II Ciclo do Ensino Secundário Pedagógico (10ª a 13ª Classe).

Ao emitir, seleccione o aluno e o sistema irá preencher automaticamente:
• Nome completo, filiação e dados pessoais do aluno
• Turma e ano lectivo de cada classe (10ª, 11ª, 12ª, 13ª)
• Tabela de classificações por disciplina e por classe
• Médias gerais por classe e média curricular final
• Cabeçalho institucional e rodapé para assinatura

Campos a preencher manualmente:
• Número e data do Bilhete de Identidade
• Nº e data do Decreto Executivo de criação da escola
• Especialidade / área de formação
• Livro de registo e folha

Director(a): {{NOME_DIRECTOR}}
Escola: {{NOME_ESCOLA}}`,
};

// ─── Certificado Ensino Secundário Técnico-Profissional Seed ─────────────────

const SEED_CERT_TECNICO_PROF_ID = 'tpl_seed_cert_tecnico_profissional_v1';
const SEED_CERT_TECNICO_PROF: DocTemplate = {
  id: SEED_CERT_TECNICO_PROF_ID,
  nome: 'Certificado — Ensino Secundário Técnico-Profissional (IIº Ciclo)',
  tipo: 'certificado',
  classeAlvo: 'TECNICO-PROFISSIONAL',
  bloqueado: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `[CERTIFICADO TÉCNICO-PROFISSIONAL — GERADO AUTOMATICAMENTE]

Este modelo gera o Certificado oficial de conclusão do II Ciclo do Ensino Secundário Técnico-Profissional.

Dados preenchidos automaticamente (da base de dados):
• Nome completo, pai/encarregado, data de nascimento, município e província do aluno
• Ano lectivo (da turma actual do aluno)
• Nome da escola e Director(a) (das configurações)
• Tabela de classificações organizadas por componente:
  — Componente Sócio-cultural (L. Portuguesa, L. Estrangeira, F. Atitudes Integradoras, Ed. Física)
  — Componente Científica (Matemática, Biologia, Física, Química, Informática, Psicologia, etc.)
  — Componente Técnica, Tecnológica e Prática (todas as disciplinas restantes lançadas no sistema)
• Média por Plano Curricular (PC) = média de todas as disciplinas
• Prova de Aptidão Profissional (PAP) = se existir nota com nome "PAP" ou "Aptidão Profissional"
• Classificação Final por Curso = (2×PC + PAP) / 3 (se PAP disponível)

Campos a preencher manualmente:
• Número, data e arquivo do Bilhete de Identidade
• Nome da mãe do aluno
• Número e data do Decreto Executivo de criação da escola
• Especialidade / Área de formação técnica
• Livro de registo e folha (para efeitos legais)
• Assinatura do Director Provincial ("Visto")

Director(a): {{NOME_DIRECTOR}}
Escola: {{NOME_ESCOLA}}`,
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

// ─── Recibo de Vencimento Seed ───────────────────────────────────────────────

const SEED_RECIBO_SALARIO_ID = 'tpl_seed_recibo_salario_v1';

const SEED_RECIBO_SALARIO: DocTemplate = {
  id: SEED_RECIBO_SALARIO_ID,
  nome: 'Recibo de Vencimento',
  tipo: 'recibo_salario',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `<div style="font-family:'Times New Roman',Times,serif;max-width:700px;margin:0 auto;padding:32px;border:2px solid #1a2540;border-radius:8px;">

<div style="text-align:center;margin-bottom:20px;">
  <p style="font-size:13pt;font-weight:bold;letter-spacing:1px;margin:0;">{{NOME_ESCOLA}}</p>
  <h2 style="font-size:16pt;font-weight:bold;text-transform:uppercase;margin:6px 0 2px;">RECIBO DE VENCIMENTO</h2>
  <p style="font-size:12pt;margin:0;color:#444;">{{MES_ANO_FOLHA}}</p>
</div>

<hr style="border:1px solid #1a2540;margin:16px 0;">

<p style="font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Funcionário</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="padding:4px 8px;font-weight:bold;width:35%;">Nome</td>
    <td style="padding:4px 8px;">{{FUNC_NOME}}</td>
  </tr>
  <tr style="background:#f5f7ff;">
    <td style="padding:4px 8px;font-weight:bold;">Cargo</td>
    <td style="padding:4px 8px;">{{FUNC_CARGO}}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;font-weight:bold;">Categoria</td>
    <td style="padding:4px 8px;">{{FUNC_CATEGORIA}}</td>
  </tr>
</table>

<hr style="border:1px solid #ddd;margin:12px 0;">

<p style="font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Vencimentos</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="padding:4px 8px;width:65%;">Salário Base</td>
    <td style="padding:4px 8px;text-align:right;">{{SALARIO_BASE}}</td>
  </tr>
  <tr style="background:#f5f7ff;">
    <td style="padding:4px 8px;">Subsídio de Alimentação</td>
    <td style="padding:4px 8px;text-align:right;">{{SUB_ALIMENTACAO}}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;">Subsídio de Transporte</td>
    <td style="padding:4px 8px;text-align:right;">{{SUB_TRANSPORTE}}</td>
  </tr>
  <tr style="background:#f5f7ff;">
    <td style="padding:4px 8px;">Subsídio de Habitação</td>
    <td style="padding:4px 8px;text-align:right;">{{SUB_HABITACAO}}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;">Outros Subsídios</td>
    <td style="padding:4px 8px;text-align:right;">{{OUTROS_SUBSIDIOS}}</td>
  </tr>
  <tr style="background:#e8f5e9;">
    <td style="padding:6px 8px;font-weight:bold;">Total Bruto</td>
    <td style="padding:6px 8px;text-align:right;font-weight:bold;">{{SALARIO_BRUTO}}</td>
  </tr>
</table>

<hr style="border:1px solid #ddd;margin:12px 0;">

<p style="font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Descontos</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
  <tr>
    <td style="padding:4px 8px;width:65%;">INSS Empregado (3%)</td>
    <td style="padding:4px 8px;text-align:right;color:#c0392b;">{{INSS_EMPREGADO}}</td>
  </tr>
  <tr style="background:#fff5f5;">
    <td style="padding:4px 8px;">IRT (tabela progressiva)</td>
    <td style="padding:4px 8px;text-align:right;color:#c0392b;">{{IRT}}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;">Outros Descontos</td>
    <td style="padding:4px 8px;text-align:right;color:#c0392b;">{{OUTROS_DESCONTOS}}</td>
  </tr>
  <tr style="background:#fce8e8;">
    <td style="padding:6px 8px;font-weight:bold;">Total Descontos</td>
    <td style="padding:6px 8px;text-align:right;font-weight:bold;color:#c0392b;">{{TOTAL_DESCONTOS}}</td>
  </tr>
</table>

<hr style="border:2px solid #1a2540;margin:12px 0;">

<div style="background:#e8f5e9;border-radius:6px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
  <span style="font-size:13pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Salário Líquido a Receber</span>
  <span style="font-size:16pt;font-weight:bold;color:#1a7a40;">{{SALARIO_LIQUIDO}}</span>
</div>

<div style="background:#f0f4ff;border-radius:4px;padding:8px 12px;margin-bottom:20px;font-size:10pt;color:#555;">
  Encargo patronal INSS (8%) — não desconta no funcionário: <strong>{{INSS_PATRONAL}}</strong>
</div>

<hr style="border:1px solid #ddd;margin:16px 0;">

<div style="display:flex;justify-content:space-between;align-items:center;">
  <p style="font-size:9pt;color:#888;margin:0;">Documento gerado pelo SIGA · {{DATA_ACTUAL}}</p>
  <span style="font-size:10pt;color:#555;">Estado: <strong>{{STATUS_FOLHA}}</strong></span>
</div>

<div style="margin-top:40px;text-align:center;">
  <p style="margin:0;font-size:10pt;">O Director(a)</p>
  <p style="margin:4px 0 0;font-size:9pt;color:#888;">_________________________________</p>
  <p style="margin:4px 0 0;font-size:10pt;font-weight:bold;">{{NOME_DIRECTOR}}</p>
</div>

</div>`,
};

// ─── Boletim de Inscrição Seed ──────────────────────────────────────────────

const SEED_BOLETIM_INSCRICAO_ID = 'tpl_seed_boletim_inscricao_v1';

const SEED_BOLETIM_INSCRICAO: DocTemplate = {
  id: SEED_BOLETIM_INSCRICAO_ID,
  nome: 'Boletim de Inscrição',
  tipo: 'ficha_inscricao',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `BOLETIM DE INSCRIÇÃO — Processo de Admissão

Este modelo gera o Boletim de Inscrição oficial para candidatos ao processo de admissão.

Ao clicar em "Emitir", poderá pesquisar e seleccionar um candidato pelo nome ou código para gerar o seu boletim individual com QR Code e exportar em PDF.

Dados preenchidos automaticamente:
• Nome completo do candidato
• Data de nascimento e género
• Província e município
• Contacto e email
• Nível e classe pretendida
• Nome do encarregado de educação
• Estado do processo (pendente, aprovado, admitido, matriculado)
• Referência RUPE de inscrição (se gerada)
• Data do exame de admissão (se definida)
• Nota do exame de admissão (se lançada)
• Código único de inscrição e QR Code de verificação

O documento é emitido em formato A4 pronto para impressão e inclui declaração sob compromisso de honra com campos de assinatura.`,
};

// ─── Seed: Extracto de Propinas do Estudante ─────────────────────────────────

const SEED_EXTRATO_PROPINA_ID = 'tpl_seed_extrato_propina_v1';
const SEED_EXTRATO_PROPINA: DocTemplate = {
  id: SEED_EXTRATO_PROPINA_ID,
  nome: 'Extracto de Propinas do Estudante',
  tipo: 'extrato_propina',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
  conteudo: `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8"/>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff}
.page{max-width:210mm;margin:0 auto;padding:18mm 18mm 14mm;min-height:297mm;position:relative}
.print-btn{display:block;margin:10px auto 16px;padding:10px 40px;background:#1a2540;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold}
.doc-header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1a2540;padding-bottom:12px;margin-bottom:14px}
.doc-header-logo{width:56px;height:56px;object-fit:contain}
.doc-header-text{flex:1}
.rep{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#555;font-weight:600}
.escola-nome{font-size:14px;font-weight:800;color:#1a2540;text-transform:uppercase;letter-spacing:.5px}
.doc-header-title{text-align:right}
.titulo{font-size:13px;font-weight:800;color:#1a2540;text-transform:uppercase;letter-spacing:1px}
.docnum{font-size:9.5px;color:#888;margin-top:4px;font-family:monospace}
.periodo-badge{display:inline-block;margin-top:4px;background:#1a2540;color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;letter-spacing:.5px}
.aluno-box{background:#f0f4ff;border:1px solid #c5d0ee;border-radius:8px;padding:10px 14px;margin-bottom:14px}
.aluno-name{font-size:15px;font-weight:800;color:#1a2540}
.aluno-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 14px;margin-top:8px}
.field label{font-size:8.5px;text-transform:uppercase;color:#888;font-weight:600;letter-spacing:.5px;display:block}
.field span{font-size:10.5px;font-weight:600;color:#1a2540}
.resumo-row{display:grid;grid-template-columns:repeat(3,1fr) 1fr;gap:8px;margin-bottom:14px}
.resumo-card{border-radius:8px;padding:8px 10px;text-align:center}
.val{font-size:13px;font-weight:800;display:block}
.lbl{font-size:8.5px;text-transform:uppercase;letter-spacing:.5px;display:block;margin-top:2px}
.card-pago{background:#d4edda;color:#155724}
.card-pend{background:#fff3cd;color:#856404}
.card-canc{background:#e2e3e5;color:#495057}
.card-total{background:#1a2540;color:#fff}
.section-title{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;color:#1a2540;margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid #1a2540}
table{width:100%;border-collapse:collapse}
thead th{background:#1a2540;color:#fff;padding:7px 8px;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.qr-bar-row{display:flex;gap:24px;align-items:center;margin:14px 0 10px;padding:12px;border:1px solid #dde0ef;border-radius:8px;background:#f9faff}
.qr-box{text-align:center}
.qr-box img{width:110px;height:110px;border:1px solid #dde;border-radius:4px}
.qr-lbl{font-size:8px;text-transform:uppercase;color:#888;margin-top:4px;letter-spacing:.5px}
.bar-box{flex:1;text-align:center}
.bar-box svg{max-width:100%;height:60px}
.bar-lbl{font-size:8px;text-transform:uppercase;color:#888;margin-top:2px;letter-spacing:.5px}
.doc-info{flex:1.2;font-size:9.5px;line-height:1.7;color:#555}
.doc-info strong{color:#1a2540}
.sig-section{display:flex;gap:20px;margin-top:20px;justify-content:space-between}
.sig-block{text-align:center;flex:1}
.sig-label{font-size:9px;font-weight:700;color:#333;text-transform:uppercase;margin-bottom:24px}
.sig-line{border-top:1px solid #333;margin:0 auto 4px;width:150px}
.sig-name{font-size:9px;font-weight:700;color:#1a2540}
.footer-note{margin-top:18px;border-top:1px dashed #ccc;padding-top:8px;font-size:8.5px;color:#aaa;text-align:center;line-height:1.7}
@media print{
  @page{size:A4 portrait;margin:12mm 14mm}
  body{margin:0}
  .page{padding:0;max-width:100%}
  .print-btn{display:none!important}
}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar como PDF</button>
<div class="page">

  <!-- CABEÇALHO -->
  <div class="doc-header">
    <img class="doc-header-logo" src="/icons/icon-192.png" alt="Logo" onerror="this.style.display='none'"/>
    <div class="doc-header-text">
      <div class="rep">República de Angola</div>
      <div class="escola-nome">{{NOME_ESCOLA}}</div>
      <div style="font-size:9px;color:#888;margin-top:2px;">Sistema Integrado de Gestão Académica</div>
    </div>
    <div class="doc-header-title">
      <div class="titulo">Extracto de Propinas</div>
      <div class="docnum">{{DOC_REF}}</div>
      <div class="periodo-badge">Período: {{PERIODO_INICIO}} a {{PERIODO_FIM}}</div>
    </div>
  </div>

  <!-- DADOS DO ALUNO -->
  <div class="aluno-box">
    <div class="aluno-name">{{NOME_COMPLETO}}</div>
    <div class="aluno-grid">
      <div class="field"><label>Nº de Matrícula</label><span>{{NUMERO_MATRICULA}}</span></div>
      <div class="field"><label>Turma</label><span>{{TURMA}}</span></div>
      <div class="field"><label>Encarregado</label><span>{{NOME_ENCARREGADO}}</span></div>
      <div class="field"><label>Data de Emissão</label><span>{{DATA_ACTUAL}}</span></div>
    </div>
  </div>

  <!-- RESUMO FINANCEIRO -->
  <div class="resumo-row">
    <div class="resumo-card card-pago">
      <span class="val">{{TOTAL_PAGO}}</span>
      <span class="lbl">✓ Total Pago</span>
    </div>
    <div class="resumo-card card-pend">
      <span class="val">{{TOTAL_PENDENTE}}</span>
      <span class="lbl">⏳ Pendente</span>
    </div>
    <div class="resumo-card card-canc">
      <span class="val">{{TOTAL_CANCELADO}}</span>
      <span class="lbl">✗ Cancelado</span>
    </div>
    <div class="resumo-card card-total">
      <span class="val">{{TOTAL_TRANSACCOES}}</span>
      <span class="lbl">Transacções</span>
    </div>
  </div>

  <!-- TABELA DE MOVIMENTOS (gerada automaticamente ao emitir) -->
  <div class="section-title">Movimentos no Período</div>
  <table>
    <thead>
      <tr>
        <th style="width:80px;">Data</th>
        <th>Descrição</th>
        <th style="width:100px;">Método</th>
        <th style="width:110px;text-align:right;">Valor</th>
        <th style="width:70px;text-align:center;">Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#fff;">
        <td style="padding:6px 8px;font-size:10px;color:#555;">01/01/2025</td>
        <td style="padding:6px 8px;font-size:10px;"><span style="font-weight:600;color:#1a2540;">Propina · Jan · 2025</span></td>
        <td style="padding:6px 8px;font-size:10px;color:#555;">Dinheiro</td>
        <td style="padding:6px 8px;text-align:right;"><strong style="color:#1a6b2a;">15.000,00 Kz</strong></td>
        <td style="padding:4px 8px;text-align:center;"><span style="font-size:9px;font-weight:bold;padding:2px 6px;border-radius:4px;color:#1a6b2a;background:#d4edda;">Pago</span></td>
      </tr>
      <tr style="background:#f9f9ff;">
        <td style="padding:6px 8px;font-size:10px;color:#555;font-style:italic;" colspan="5">[ As restantes linhas são geradas automaticamente a partir dos dados do sistema ]</td>
      </tr>
    </tbody>
  </table>

  <!-- QR CODE + CÓDIGO DE BARRAS -->
  <div class="qr-bar-row">
    <div class="qr-box">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=DOC%3A{{DOC_REF}}%0AALUNO%3A{{NOME_COMPLETO}}%0AMATRICULA%3A{{NUMERO_MATRICULA}}%0ATOTAL%3A{{TOTAL_PAGO}}&bgcolor=ffffff&color=000000&margin=6" alt="QR Code"/>
      <div class="qr-lbl">QR Verificação</div>
    </div>
    <div class="bar-box">
      <svg id="barcode-extrato"></svg>
      <div class="bar-lbl">Código de Barras — Nº Matrícula</div>
    </div>
    <div class="doc-info">
      <strong>Documento:</strong> {{DOC_REF}}<br>
      <strong>Aluno:</strong> {{NOME_COMPLETO}}<br>
      <strong>Matrícula:</strong> {{NUMERO_MATRICULA}}<br>
      <strong>Data:</strong> {{DATA_ACTUAL}}<br>
      <strong>Total Pago:</strong> {{TOTAL_PAGO}}<br>
      <strong>Transacções:</strong> {{TOTAL_TRANSACCOES}}
    </div>
  </div>

  <!-- ASSINATURAS -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-label">O Director Geral</div>
      <div class="sig-line"></div>
      <div class="sig-name">{{NOME_DIRECTOR}}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">O Chefe de Secretaria</div>
      <div class="sig-line"></div>
      <div class="sig-name">{{CHEFE_SECRETARIA}}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">O(A) Encarregado(a)</div>
      <div class="sig-line"></div>
      <div class="sig-name">____________________________</div>
    </div>
  </div>

  <!-- RODAPÉ -->
  <div class="footer-note">
    Documento emitido em {{DATA_ACTUAL}} por {{NOME_ESCOLA}}<br>
    Este extracto é meramente informativo e não substitui recibo oficial de pagamento.
    Os dados apresentados reflectem o estado dos registos no sistema à data de emissão.<br>
    Ref. {{DOC_REF}}
  </div>
</div>

<script>
window.addEventListener('load', function() {
  try {
    JsBarcode('#barcode-extrato', '{{NUMERO_MATRICULA}}', {
      format: 'CODE128', width: 2, height: 50, displayValue: true,
      fontSize: 11, margin: 4, background: 'transparent',
      lineColor: '#1a2540', fontOptions: 'bold',
    });
  } catch(e) {
    var el = document.getElementById('barcode-extrato');
    if (el) el.style.display = 'none';
  }
});
</script>
</body>
</html>`,
};

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function EditorDocumentos() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { alunos, turmas, notas, professores } = useData();
  const { config } = useConfig();

  const directorGeral = config.directorGeral || user?.nome || '____________________________';
  const directorPedagogico = config.directorPedagogico || '____________________________';
  const directorProvincialEducacao = config.directorProvincialEducacao || '';

  function buildSigRow(dirG: string, dirP: string, dirProv: string): string {
    const block = (label: string, name: string) =>
      `<div style="text-align:center;min-width:140px;flex:1;">` +
        `<div style="font-size:11px;font-weight:bold;margin-bottom:28px;">${label}</div>` +
        `<div class="sig-line" style="width:170px;border-top:1px solid #000;margin:0 auto 5px;"></div>` +
        `<div style="font-size:11px;font-weight:bold;">${name}</div>` +
      `</div>`;
    return (
      `<div style="display:flex;justify-content:space-around;margin-top:40px;flex-wrap:wrap;gap:16px;">` +
        block('O Director Geral', dirG) +
        block('O Director Pedagógico', dirP) +
        (dirProv ? block('Director Provincial da Educação', dirProv) : '') +
      `</div>`
    );
  }
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const [mode, setMode] = useState<Mode>('list');
  const [templates, setTemplates] = useState<DocTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Planos de Aula state ────────────────────────────────────────────────
  const [planosAulaDoc, setPlanosAulaDoc] = useState<any[]>([]);
  const [planosAulaLoading, setPlanosAulaLoading] = useState(false);
  const [previewPlanoDoc, setPreviewPlanoDoc] = useState<any | null>(null);

  // ─── Lista de Aprovados state ─────────────────────────────────────────────
  const [listaAprovadosLoading, setListaAprovadosLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setPlanosAulaLoading(true);
      try {
        const r = await fetch('/api/planos-aula', { credentials: 'include' });
        if (r.ok) { const d = await r.json(); setPlanosAulaDoc(Array.isArray(d) ? d : []); }
      } catch { setPlanosAulaDoc([]); }
      finally { setPlanosAulaLoading(false); }
    })();
  }, []);

  function buildPlanoHTMLDoc(plano: any): string {
    const rows = (plano.fases || []).map((f: any) => `
      <tr>
        <td style="font-size:10pt;text-align:center;font-weight:bold;">${f.tempo||''}</td>
        <td style="font-size:10pt;font-weight:bold;">${f.fase||''}</td>
        <td style="font-size:9pt;">${(f.conteudo||'').replace(/\n/g,'<br>')}</td>
        <td style="font-size:9pt;">${(f.metodos||'').replace(/\n/g,'<br>')}</td>
        <td style="font-size:9pt;">${(f.actividades||'').replace(/\n/g,'<br>')}</td>
        <td style="font-size:9pt;">${(f.estrategiaEnsino||'').replace(/\n/g,'<br>')}</td>
        <td style="font-size:9pt;">${(f.meiosEnsino||'').replace(/\n/g,'<br>')}</td>
        <td style="font-size:9pt;text-align:center;">${f.avaliacao||''}</td>
        <td style="font-size:9pt;">${f.obs||''}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:11pt;color:#111;background:#fff}
    .page{width:297mm;min-height:210mm;margin:0 auto;padding:15mm 18mm}
    h1{text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;text-decoration:underline}
    .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #111;border-collapse:collapse;margin-bottom:10px}
    .info-cell{padding:4px 7px;border:1px solid #111;font-size:10pt;line-height:1.5}
    .info-cell .lbl{font-weight:bold}
    .obj-box{border:1px solid #111;padding:5px 8px;margin-bottom:10px;font-size:10pt;line-height:1.7}
    .obj-box .lbl{font-weight:bold}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#ddd;font-size:10pt;padding:5px 4px;border:1px solid #111;text-align:center;font-weight:bold}
    td{border:1px solid #111;padding:4px;vertical-align:top}
    .print-btn{display:block;margin:16px auto;padding:10px 32px;background:#1a2540;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold}
    @media print{.print-btn{display:none}}</style></head>
    <body>
    <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    <div class="page"><h1>Plano de Aula</h1>
    <div class="info-grid">
      <div class="info-cell"><span class="lbl">Nome:</span> ${plano.professorNome||''}</div>
      <div class="info-cell" style="grid-row:span 2;"><span class="lbl">Geral:</span> ${plano.objectivoGeral||''}</div>
      <div class="info-cell" style="grid-row:span 6;"><span class="lbl">Objectivos:</span><br><br><span class="lbl">Específicos:</span><br>${(plano.objectivosEspecificos||'').replace(/\n/g,'<br>')}</div>
      <div class="info-cell"><span class="lbl">Escola:</span> ${plano.escola||''}</div>
      <div class="info-cell"><span class="lbl">Data:</span> ${plano.data||''}</div>
      <div class="info-cell"></div>
      <div class="info-cell"><span class="lbl">Classe:</span> ${plano.classe||''} &nbsp;&nbsp; <span class="lbl">Turma:</span> ${plano.turmaNome||''}</div>
      <div class="info-cell"><span class="lbl">Período:</span> ${plano.periodo||''}</div>
      <div class="info-cell"><span class="lbl">Disciplina:</span> ${plano.disciplina||''}</div>
      <div class="info-cell"><span class="lbl">Tempo:</span> ${plano.tempo||''}</div>
      <div class="info-cell"><span class="lbl">Unidade:</span> ${plano.unidade||''}</div>
      <div class="info-cell"><span class="lbl">Duração:</span> ${plano.duracao||''}</div>
      <div class="info-cell"><span class="lbl">Sumário:</span> ${plano.sumario||''}</div>
      <div class="info-cell"><span class="lbl">Ano lectivo:</span> ${plano.anoLetivo||''}</div>
    </div>
    <div class="obj-box"><span class="lbl">Perfil de entrada:</span> ${plano.perfilEntrada||''}</div>
    <div class="obj-box"><span class="lbl">Perfil de saída:</span> ${plano.perfilSaida||''}</div>
    <table><thead><tr>
      <th style="width:55px">Tempo</th><th style="width:80px">Fases<br>didácticas</th>
      <th>Conteúdo</th><th style="width:80px">Métodos</th><th>Actividades</th>
      <th style="width:90px">Estratégia de<br>Ensino</th><th style="width:90px">Meios de<br>Ensino</th>
      <th style="width:70px">Avaliação</th><th style="width:50px">Obs</th>
    </tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
  }

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
  // Mapa de Aproveitamento emit state (trimestre-level)
  const [emitTrimestre, setEmitTrimestre] = useState<1 | 2 | 3>(1);
  // Document history for selected student in emit mode
  const [emitAlunoHistorico, setEmitAlunoHistorico] = useState<any[]>([]);
  // Extracto de Propinas — date filter
  const [emitExtratoDataInicio, setEmitExtratoDataInicio] = useState('');
  const [emitExtratoDataFim, setEmitExtratoDataFim] = useState('');

  const inputRef = useRef<TextInput>(null);

  // ─── Toast notification ───────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(message);
    setToastType(type);
    Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start();
    }, 3000);
  }

  // ─── Confirm modal (replaces Alert.alert — bloqueado por iframes) ──────────
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger: boolean;
    onConfirm: () => void;
  } | null>(null);

  function showConfirm(opts: {
    title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void;
  }) {
    setConfirmModal({ ...opts, danger: opts.danger ?? false });
  }
  const quillIframeRef = useRef<any>(null);
  const quillSrcdocRef = useRef<string>('');
  // Tracks latest iframe HTML without triggering re-renders (web only).
  // Re-rendering the parent unmounts EditorScreen and reloads the iframe, losing edits.
  const webEditorContentRef = useRef<string>('');
  const tinyEditorRef = useRef<any>(null);
  const [tinyInitContent, setTinyInitContent] = useState<string>('');
  const [editorKey, setEditorKey] = useState<number>(0);

  // Listen for content changes from the iframe (web only).
  // Update ref only — never state — to avoid re-renders that reload the iframe.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: any) => {
      if (e.data?.type === 'ck_change') {
        webEditorContentRef.current = e.data.html;
      }
    };
    (window as any).addEventListener('message', handler);
    return () => (window as any).removeEventListener('message', handler);
  }, []);

  // Fetch document history for the selected student in emit mode
  useEffect(() => {
    if (!emitAlunoId) { setEmitAlunoHistorico([]); return; }
    fetch(`/api/documentos-emitidos/aluno/${emitAlunoId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setEmitAlunoHistorico(Array.isArray(data) ? data : []))
      .catch(() => setEmitAlunoHistorico([]));
  }, [emitAlunoId]);

  // Load templates + seed defaults from database
  useEffect(() => {
    (async () => {
      try {
        const fetched = await api.get<DocTemplate[]>('/api/doc-templates');
        let list: DocTemplate[] = fetched ?? [];

        // Inject seed templates if not yet present in the database
        const seeds = [SEED_EXTRATO_PROPINA, SEED_RECIBO_SALARIO, SEED_BOLETIM_INSCRICAO, SEED_CERT_HAB_I_CICLO, SEED_CERT_TECNICO_PROF, SEED_CERT_HAB_LIT, SEED_CERT_PRIMARIO, SEED_LISTA_TURMA, SEED_MAPA_FREQUENCIAS, SEED_MAPA_POR_CURSO_CLASSE, SEED_MAPA_TURMA_DETALHADO, SEED_MAPA_APROVEITAMENTO, SEED_CERT_II_CICLO, SEED_CERT_ITAQ_13, SEED_CERT_HAB_13, SEED_CERT_HAB_12, SEED_CERT_HAB_11, SEED_FICHA_MATRICULA, SEED_PAUTA_FINAL, SEED_DECL_NOTA_10, SEED_DECL_NOTA_11, SEED_DECL_NOTA_12, SEED_DECL_NOTA_13, SEED_MINI_PAUTA, SEED_DECLARACAO_COM_NOTA, SEED_CERTIFICADO_I_CICLO, SEED_DECLARACAO_HABILITACOES_PRIMARIO, SEED_DECLARACAO_HABILITACOES, SEED_GUIA_TRANSFERENCIA];
        const existingIds = new Set(list.map(t => t.id));
        const toInsert = seeds.filter(s => !existingIds.has(s.id));
        for (const seed of toInsert) {
          try {
            const saved = await api.post<DocTemplate>('/api/doc-templates', seed);
            list = [saved, ...list];
          } catch {}
        }

        setTemplates(list);
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    })();
  }, []);

  function saveTemplates(list: DocTemplate[]) {
    setTemplates(list);
  }

  function openNew() {
    setEditingTemplate(null);
    setEditorNome('Novo Documento');
    setEditorTipo('declaracao');
    setEditorContent('');
    webEditorContentRef.current = '';
    setEditorInsignia(undefined);
    setEditorMarcaAgua(undefined);
    setShowVarsPanel(true);
    setShowAppearPanel(true);
    if (Platform.OS === 'web') {
      quillSrcdocRef.current = buildQuillSrcdoc('');
      setTinyInitContent('');
      setEditorKey(k => k + 1);
    }
    setMode('editor');
  }

  function openEdit(t: DocTemplate) {
    setEditingTemplate(t);
    setEditorNome(t.nome);
    setEditorTipo(t.tipo);
    setEditorContent(t.conteudo);
    webEditorContentRef.current = t.conteudo;
    setEditorInsignia(t.insigniaBase64);
    setEditorMarcaAgua(t.marcaAguaBase64);
    setShowVarsPanel(true);
    setShowAppearPanel(true);
    if (Platform.OS === 'web') {
      const html = plainTextToHtml(t.conteudo);
      quillSrcdocRef.current = buildQuillSrcdoc(html);
      setTinyInitContent(html);
      webEditorContentRef.current = html;
      setEditorKey(k => k + 1);
    }
    setMode('editor');
  }

  async function saveTemplate() {
    if (!editorNome.trim()) return;
    // On web, editorContent state is never updated while typing (to avoid iframe reload).
    // Read the latest content from the ref instead.
    const contentToSave = Platform.OS === 'web' ? webEditorContentRef.current : editorContent;
    setIsSaving(true);
    try {
      if (editingTemplate) {
        const saved = await api.put<DocTemplate>(`/api/doc-templates/${editingTemplate.id}`, {
          nome: editorNome.trim(), tipo: editorTipo, conteudo: contentToSave,
          insigniaBase64: editorInsignia ?? null, marcaAguaBase64: editorMarcaAgua ?? null,
        });
        saveTemplates(templates.map(t => t.id === editingTemplate.id ? saved : t));
      } else {
        const saved = await api.post<DocTemplate>('/api/doc-templates', {
          nome: editorNome.trim(), tipo: editorTipo, conteudo: contentToSave,
          insigniaBase64: editorInsignia ?? null, marcaAguaBase64: editorMarcaAgua ?? null,
        });
        saveTemplates([saved, ...templates]);
      }
      setMode('list');
      showToast(editingTemplate ? 'Modelo actualizado com sucesso.' : 'Novo modelo criado com sucesso.');
    } catch (e) {
      showToast('Não foi possível guardar o modelo. Tente novamente.', 'error');
    } finally {
      setIsSaving(false);
    }
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
    const template = templates.find(t => t.id === id);
    try {
      await api.delete(`/api/doc-templates/${id}`);
      saveTemplates(templates.filter(t => t.id !== id));
      showToast(`Modelo "${template?.nome ?? ''}" eliminado.`, 'info');
    } catch {
      showToast('Não foi possível eliminar o modelo.', 'error');
    }
  }

  const LOCK_ROLES: string[] = ['pca', 'ceo', 'admin', 'director'];
  const canManageLocks = LOCK_ROLES.includes(user?.role || '');

  async function toggleBloqueio(id: string) {
    if (!canManageLocks) {
      showToast('Acesso restrito: apenas PCA, CEO ou Administrador podem bloquear modelos.', 'error');
      return;
    }
    const template = templates.find(t => t.id === id);
    if (!template) return;
    const isBlocking = !template.bloqueado;
    Alert.alert(
      isBlocking ? 'Bloquear Modelo' : 'Desbloquear Modelo',
      isBlocking
        ? `O modelo "${template.nome}" ficará indisponível para emissão. Deseja continuar?`
        : `O modelo "${template.nome}" ficará disponível para todos os utilizadores autorizados. Deseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: isBlocking ? 'Bloquear' : 'Desbloquear',
          style: isBlocking ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const novoBloqueado = !template.bloqueado;
              await api.patch(`/api/doc-templates/${id}/bloqueado`, { bloqueado: novoBloqueado });
              saveTemplates(templates.map(t => t.id === id ? { ...t, bloqueado: novoBloqueado } : t));
              showToast(
                novoBloqueado
                  ? `Modelo "${template.nome}" bloqueado com sucesso.`
                  : `Modelo "${template.nome}" desbloqueado com sucesso.`,
                novoBloqueado ? 'info' : 'success'
              );
            } catch (e) {
              showToast('Erro ao actualizar o estado do modelo. Tente novamente.', 'error');
            }
          },
        },
      ]
    );
  }

  function previewTemplate(template: DocTemplate, previewContent?: string) {
    if (Platform.OS !== 'web') return;
    const win = window.open('', '_blank');
    if (!win) return;

    const now = new Date();
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    // Build content: use provided previewContent (from editor) or replace vars with examples
    let conteudo = previewContent ?? template.conteudo;
    const exampleMap = {
      ...VARIABLE_EXAMPLE_MAP,
      '{{DATA_ACTUAL}}': dataActual,
      '{{MES_ACTUAL}}': MESES[now.getMonth()],
      '{{ANO_ACTUAL}}': String(now.getFullYear()),
      '{{NOME_ESCOLA}}': config.nomeEscola || 'Escola Secundária N.º 1',
      '{{NOME_DIRECTOR}}': directorGeral,
    };
    Object.entries(exampleMap).forEach(([k, v]) => {
      conteudo = conteudo.split(k).join(v);
    });

    const escolaNome = config.nomeEscola || 'Escola Secundária N.º 1';
    const directorNome = directorGeral;

    const logoHtml = template.insigniaBase64
      ? `<img src="${template.insigniaBase64}" alt="Insígnia" style="height:90px;width:90px;object-fit:contain;margin-bottom:8px;" />`
      : `<div style="width:72px;height:72px;border-radius:50%;background:#e0e0e0;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:26px;font-weight:bold;color:#666;line-height:72px;text-align:center;border:2px solid #ccc;">${escolaNome.charAt(0).toUpperCase()}</div>`;

    const watermarkHtml = template.marcaAguaBase64
      ? `<img src="${template.marcaAguaBase64}" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;opacity:0.05;pointer-events:none;z-index:0;" />`
      : `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:72px;font-weight:bold;color:rgba(0,0,0,0.04);white-space:nowrap;pointer-events:none;z-index:0;letter-spacing:8px;">${escolaNome}</div>`;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Pré-visualização — ${template.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 60px; font-size: 14px; line-height: 1.8; color: #000; position: relative; }
    .preview-banner { position: fixed; top: 0; left: 0; right: 0; background: #f59e0b; color: #000; text-align: center; padding: 6px 0; font-family: sans-serif; font-size: 12px; font-weight: bold; letter-spacing: 1px; z-index: 999; }
    .content { position: relative; z-index: 1; margin-top: 30px; }
    .doc-header { text-align: center; margin-bottom: 32px; }
    h1 { font-size: 16px; margin: 4px 0; font-family: 'Times New Roman', serif; }
    .republika { font-size: 11px; color: #555; margin-bottom: 2px; letter-spacing: 1px; text-transform: uppercase; }
    .divider { width: 80px; height: 2px; background: #000; margin: 12px auto; }
    .doc-tipo { font-size: 14px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; margin: 8px 0; }
    .doc-meta { font-size: 11px; color: #777; font-style: italic; margin-bottom: 32px; }
    pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.9; text-align: justify; }
    .signature { margin-top: 60px; text-align: center; }
    .sig-line { width: 200px; height: 1px; background: #333; margin: 40px auto 6px; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: bold; cursor: pointer; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999; }
    .print-btn:hover { background: #1e40af; }
    @media print {
      .preview-banner, .print-btn { display: none !important; }
      body { margin: 30px 50px; }
      .content { margin-top: 0; }
    }
  </style>
</head>
<body>
  <div class="preview-banner">⚠ PRÉ-VISUALIZAÇÃO — Dados fictícios para demonstração</div>
  ${watermarkHtml}
  <div class="content">
    <div class="doc-header">
      ${logoHtml}
      <div class="republika">República de Angola</div>
      <h1>${escolaNome}</h1>
      <div class="divider"></div>
      <div class="doc-tipo">${template.nome}</div>
      <div class="doc-meta">Dados de exemplo — João Manuel Silva</div>
    </div>
    ${isHtmlContent(conteudo) ? `<div style="text-align:justify;line-height:1.9;font-family:'Times New Roman',serif;font-size:14px;">${conteudo}</div>` : `<pre>${conteudo}</pre>`}
    <div class="signature">
      <div style="font-size:13px;color:#444;">Luanda, ${dataActual}</div>
      <div class="sig-line"></div>
      <div style="font-weight:bold;font-size:13px;">${directorNome}</div>
      <div style="font-size:12px;color:#555;">Director(a)</div>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body>
</html>`);
    win.document.close();
  }

  function openEmit(t: DocTemplate) {
    setEmitTemplate(t);
    setEmitAlunoId('');
    setEmitPreview('');
    setAlunoSearch('');
    setEmitTurmaId('');
    setTurmaSearch('');
    setEmitExtratoDataInicio('');
    setEmitExtratoDataFim('');
    setMode('emit');
  }

  // Helper: checks if this template uses turma-level emit (pauta types)
  function isPautaType(t: DocTemplate | null) {
    return t?.tipo === 'pauta' || t?.tipo === 'pauta_final';
  }
  function isMapaType(t: DocTemplate | null) {
    return t?.tipo === 'mapa_aproveitamento' || t?.tipo === 'mapa_frequencias';
  }
  function isListaTurmaType(t: DocTemplate | null) {
    return t?.tipo === 'lista_turma';
  }
  function isCertificadoPrimarioType(t: DocTemplate | null) {
    return t?.tipo === 'certificado_primario';
  }
  function isExtratoPropinaType(t: DocTemplate | null) {
    return t?.tipo === 'extrato_propina';
  }

  // ─── Certificado do Ensino Primário HTML Builder ───────────────────────────

  function buildCertificadoPrimarioHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';

    const now = new Date();
    const MESES_LOCAL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    function numPorExtenso(n: number): string {
      const map: Record<number, string> = {
        1: 'Um Valor', 2: 'Dois Valores', 3: 'Três Valores', 4: 'Quatro Valores',
        5: 'Cinco Valores', 6: 'Seis Valores', 7: 'Sete Valores', 8: 'Oito Valores',
        9: 'Nove Valores', 10: 'Dez Valores',
      };
      return map[n] || `${n} Valores`;
    }

    const bDate = aluno.dataNascimento ? new Date(aluno.dataNascimento + 'T12:00:00') : null;
    const bDay = bDate ? String(bDate.getDate()).padStart(2, '0') : '__';
    const bMonth = bDate ? MESES_LOCAL[bDate.getMonth()] : '___________';
    const bYear = bDate ? String(bDate.getFullYear()) : '____';
    const filhoA = aluno.genero === 'F' ? 'filha' : 'filho';

    const escola = config.nomeEscola || '___________________________';
    const director = directorGeral;
    const cidade = aluno.provincia || 'Luanda';
    const dataActual = `${now.getDate()} de ${MESES_LOCAL[now.getMonth()]} de ${now.getFullYear()}`;

    const todasNotasAluno = notas.filter(n => n.alunoId === alunoId);

    function getClasseForTurma(tId: string): string {
      return turmas.find(t => t.id === tId)?.classe || '';
    }

    function getGradePorClasse(disciplinaNome: string, classe: string): number | null {
      const matchNome = disciplinaNome.trim().toLowerCase();
      const notasClasse = todasNotasAluno.filter(n => {
        const tClasse = getClasseForTurma(n.turmaId);
        return tClasse === classe && n.disciplina.trim().toLowerCase() === matchNome;
      });
      if (notasClasse.length === 0) return null;
      const withNf = notasClasse.find(n => n.nf > 0);
      if (withNf) return Math.round(withNf.nf);
      const mts = notasClasse.map(n => n.mt1).filter(v => v > 0);
      if (mts.length === 0) return null;
      return Math.round(mts.reduce((a, b) => a + b, 0) / mts.length);
    }

    const cicloClasses = ['2ª Classe', '4ª Classe', '6ª Classe'];

    const DISCIPLINAS_PRIMARIO: { nome: string; ciclos: number[]; bold: boolean }[] = [
      { nome: 'Língua Portuguesa',          ciclos: [1, 2, 3], bold: false },
      { nome: 'Matemática',                 ciclos: [1, 2, 3], bold: false },
      { nome: 'Estudo do Meio',             ciclos: [1, 2],    bold: false },
      { nome: 'Ciências Naturais',          ciclos: [3],       bold: false },
      { nome: 'História',                   ciclos: [3],       bold: true  },
      { nome: 'Geografia',                  ciclos: [3],       bold: false },
      { nome: 'Educação Moral e Cívica',    ciclos: [3],       bold: true  },
      { nome: 'Educação Manual e Plástica', ciclos: [1, 2, 3], bold: false },
      { nome: 'Educação Musical',           ciclos: [1, 2, 3], bold: false },
      { nome: 'Educação Física',            ciclos: [1, 2, 3], bold: false },
      { nome: 'Língua de Origem Africana',  ciclos: [],        bold: false },
    ];

    const tableRows = DISCIPLINAS_PRIMARIO.map(disc => {
      const grades: (number | null)[] = [1, 2, 3].map(ciclo => {
        if (!disc.ciclos.includes(ciclo)) return null;
        return getGradePorClasse(disc.nome, cicloClasses[ciclo - 1]);
      });
      const validGrades = grades.filter((g): g is number => g !== null);
      const mediaFinal = validGrades.length > 0
        ? Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length)
        : null;

      const cells = grades.map((g, idx) => {
        if (!disc.ciclos.includes(idx + 1)) {
          return `<td style="background:#c0c0c0;"></td>`;
        }
        return `<td style="text-align:center;">${g !== null ? g : ''}</td>`;
      }).join('');

      const fw = disc.bold ? 'font-weight:bold;' : '';
      return `<tr>
        <td style="${fw}padding:2px 4px;">${disc.nome}</td>
        ${cells}
        <td style="text-align:center;font-weight:bold;">${mediaFinal !== null ? mediaFinal : ''}</td>
        <td style="text-align:center;">${mediaFinal !== null ? numPorExtenso(mediaFinal) : ''}</td>
      </tr>`;
    }).join('');

    const allDiscMedias: number[] = [];
    for (const disc of DISCIPLINAS_PRIMARIO) {
      const validForDisc = [1, 2, 3]
        .filter(c => disc.ciclos.includes(c))
        .map(c => getGradePorClasse(disc.nome, cicloClasses[c - 1]))
        .filter((g): g is number => g !== null);
      if (validForDisc.length > 0) {
        allDiscMedias.push(Math.round(validForDisc.reduce((a, b) => a + b, 0) / validForDisc.length));
      }
    }
    const mediaGeral = allDiscMedias.length > 0
      ? Math.round(allDiscMedias.reduce((a, b) => a + b, 0) / allDiscMedias.length)
      : null;

    const notasTurma = turmas.find(t => t.id === aluno.turmaId);
    const anoLetivoConclusao = todasNotasAluno.length > 0
      ? [...todasNotasAluno].sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo))[0].anoLetivo
      : (notasTurma?.anoLetivo || String(now.getFullYear()));

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <title>Certificado Ensino Primário — ${aluno.nome} ${aluno.apelido}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; color: #000; background: #fff; padding: 20mm 20mm 15mm 25mm; }
    .visto-block { float: left; width: 200px; font-size: 10pt; margin-right: 20px; }
    .visto-block p { margin: 2px 0; }
    .visto-line { border-bottom: 1px solid #000; width: 180px; margin: 18px 0 4px; }
    .header-center { text-align: center; font-size: 12pt; line-height: 1.6; }
    .header-center .nivel { font-size: 12pt; margin-top: 6px; }
    .header-center .titulo { font-size: 18pt; font-weight: bold; margin: 10px 0 16px; letter-spacing: 2px; text-transform: uppercase; }
    .body-text { text-align: justify; font-size: 11pt; line-height: 1.7; margin-bottom: 14px; clear: both; }
    .underline { text-decoration: underline; font-style: italic; }
    .bold-caps { font-weight: bold; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
    table th, table td { border: 1px solid #000; padding: 3px 5px; }
    table th { background: #f2f2f2; font-weight: bold; text-align: center; font-size: 9.5pt; }
    .media-row td { font-weight: bold; background: #fffde7; }
    .legal-text { font-size: 11pt; text-align: justify; line-height: 1.6; margin: 14px 0; }
    .date-line { margin: 18px 0 10px; font-size: 11pt; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-block { text-align: center; min-width: 220px; }
    .sig-block .label { font-size: 11pt; margin-bottom: 30px; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin: 0 auto 4px; }
    .sig-name { font-size: 10pt; }
    .clearfix::after { content: ""; display: table; clear: both; }
    @media print { @page { size: A4 portrait; margin: 20mm 20mm 15mm 25mm; } body { padding: 0; } }
  </style>
</head>
<body>

  <div class="clearfix">
    <div class="visto-block">
      <p>Visto do(a)</p>
      <p>Director(a)/Secretário(a) Municipal</p>
      <div class="visto-line"></div>
      <p>___________________________</p>
    </div>
    <div class="header-center">
      <p><strong>REPÚBLICA DE ANGOLA</strong></p>
      <p><strong>MINISTÉRIO DA EDUCAÇÃO</strong></p>
      <p class="nivel">ENSINO PRIMÁRIO</p>
      <p class="titulo">Certificado</p>
    </div>
  </div>

  <div class="body-text">
    <p>a)&nbsp;&nbsp;<span class="underline">__________________________</span>, Director(a) da Escola Primária nº&nbsp;<span class="underline">_______</span>,&nbsp;Ex:&nbsp;<span class="underline">_______</span>,&nbsp;nome
    <span class="underline">${escola}</span>, criada sob Decreto Executivo nº&nbsp;<span class="underline">_____</span>&nbsp;/&nbsp;<span class="underline">____</span>&nbsp;de&nbsp;<span class="underline">_____________</span>,
    certifica que</p>
  </div>

  <div class="body-text">
    <span class="underline" style="color:#8B0000;font-weight:bold;">${aluno.nome} ${aluno.apelido}</span>,
    ${filhoA}(a) de&nbsp;<span class="underline">___________________________________</span>&nbsp;e de&nbsp;<span class="underline">___________________________________</span>,
    nascido(a) aos&nbsp;<span class="underline">${bDay} de ${bMonth} de ${bYear}</span>,
    natural de&nbsp;<span class="underline">${aluno.municipio}</span>,
    Município de&nbsp;<span class="underline">${aluno.municipio}</span>,
    Província de&nbsp;<span class="underline">${aluno.provincia}</span>,
    portador(a) do B.I./Passaporte nº&nbsp;<span class="underline">__________________</span>,
    passado(a) pela Conservatória do registo civil de&nbsp;<span class="underline">_____________</span>
    aos&nbsp;<span class="underline">_____________________</span>,
    concluiu no ano lectivo&nbsp;<span class="underline"><strong>${anoLetivoConclusao}</strong></span>&nbsp;
    o <span class="bold-caps">Ensino Primário,</span>
    conforme o disposto na alínea b) do artigo 109.º. da LBSEE 17/16, de 7 de Outubro,
    com a Média Final de&nbsp;<span class="underline"><strong>${mediaGeral !== null ? mediaGeral : '_____'}</strong></span>&nbsp;valores
    obtida nas seguintes classificações por ciclos de aprendizagem:
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="text-align:left;min-width:180px;">Disciplina</th>
        <th colspan="1">I Ciclo</th>
        <th colspan="1">II Ciclo</th>
        <th colspan="1">III Ciclo</th>
        <th rowspan="2">Média Final</th>
        <th rowspan="2">Média por Extenso</th>
      </tr>
      <tr>
        <th>2ª. Classe</th>
        <th>4ª. Classe</th>
        <th>6ª. Classe</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="legal-text">
    Para efeitos legais lhe é passado o presente <strong>CERTIFICADO</strong>, que consta no livro de registo nº&nbsp;___________,
    folha&nbsp;___________, assinado por mim e autenticado com carimbo a óleo/selo branco em uso neste estabelecimento de ensino.
  </div>

  <div class="date-line">${cidade}, aos ${dataActual}</div>

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}

</body>
</html>`;
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
    const director = directorGeral;
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
    @media print { @page { size: A4 landscape; margin: 8mm; } body { margin: 0; font-size: 6.5px; } }
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

  // ─── Pauta Final Excel Builder ────────────────────────────────────────────

  function buildPautaFinalExcel(turmaId: string) {
    const turma = turmas.find(t => t.id === turmaId);
    if (!turma) return;

    const alunosDaTurma = alunos
      .filter(a => a.ativo && a.turmaId === turmaId)
      .sort((a, b) => `${a.nome} ${a.apelido}`.localeCompare(`${b.nome} ${b.apelido}`));

    const notasDaTurma = notas.filter(n => n.turmaId === turmaId);

    const disciplinasSet: string[] = [];
    for (const n of notasDaTurma) {
      if (!disciplinasSet.includes(n.disciplina)) disciplinasSet.push(n.disciplina);
    }
    const disciplinas = disciplinasSet.sort((a, b) => a.localeCompare(b));

    function getMT(alunoId: string, disc: string, trim: number): string {
      const n = notasDaTurma.find(x => x.alunoId === alunoId && x.disciplina === disc && x.trimestre === trim);
      return n ? String(Math.round(n.mt1)) : '';
    }
    function getMFD(alunoId: string, disc: string): string {
      const ns = notasDaTurma.filter(x => x.alunoId === alunoId && x.disciplina === disc);
      if (ns.length === 0) return '';
      const withNf = ns.find(x => x.nf);
      if (withNf) return String(Math.round(withNf.nf));
      const mts = ns.map(x => x.mt1).filter(v => v > 0);
      if (mts.length === 0) return '';
      return String(Math.round(mts.reduce((a, b) => a + b, 0) / mts.length));
    }

    const escola = config.nomeEscola || '—';
    const anoLetivo = turma.anoLetivo;
    const now = new Date();

    // Header rows
    const headerRow1 = ['REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO'];
    const headerRow2 = [`PAUTA FINAL — ${turma.classe} ${turma.nome} — Ano Lectivo: ${anoLetivo}`];
    const headerRow3 = [`Escola: ${escola}   Turno: ${turma.turno}   Data: ${now.toLocaleDateString('pt-AO')}`];
    const emptyRow: string[] = [];

    // Column headers
    const colHeader1: string[] = ['Nº', 'Nome do Aluno'];
    const colHeader2: string[] = ['', ''];
    for (const d of disciplinas) {
      colHeader1.push(d, '', '', '');
      colHeader2.push('MT1', 'MT2', 'MT3', 'MFD');
    }
    colHeader1.push('OBS');
    colHeader2.push('');

    // Data rows
    const dataRows = alunosDaTurma.map((aluno, idx) => {
      const row: (string | number)[] = [idx + 1, `${aluno.nome.toUpperCase()} ${aluno.apelido.toUpperCase()}`];
      for (const disc of disciplinas) {
        const mt1 = getMT(aluno.id, disc, 1);
        const mt2 = getMT(aluno.id, disc, 2);
        const mt3 = getMT(aluno.id, disc, 3);
        const mfd = getMFD(aluno.id, disc);
        row.push(mt1 ? Number(mt1) : '', mt2 ? Number(mt2) : '', mt3 ? Number(mt3) : '', mfd ? Number(mfd) : '');
      }
      row.push('');
      return row;
    });

    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [
      headerRow1, headerRow2, headerRow3, emptyRow,
      colHeader1, colHeader2,
      ...dataRows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title cells
    const totalCols = 2 + disciplinas.length * 4 + 1;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },
    ];

    // Column widths
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, ...disciplinas.flatMap(() => [{ wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }]), { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Pauta Final');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pauta_Final_${turma.classe}_${turma.nome}_${anoLetivo}.xlsx`.replace(/\//g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Mini Pauta Excel Builder ─────────────────────────────────────────────

  function buildMiniPautaExcel(turmaId: string) {
    const turma = turmas.find(t => t.id === turmaId);
    if (!turma) return;

    const alunosDaTurma = alunos
      .filter(a => a.ativo && a.turmaId === turmaId)
      .sort((a, b) => `${a.nome} ${a.apelido}`.localeCompare(`${b.nome} ${b.apelido}`));

    const notasDaTurma = notas.filter(n => n.turmaId === turmaId);
    const disciplinasSet: string[] = [];
    for (const n of notasDaTurma) {
      if (!disciplinasSet.includes(n.disciplina)) disciplinasSet.push(n.disciplina);
    }
    const disciplinas = disciplinasSet.sort((a, b) => a.localeCompare(b));

    const escola = config.nomeEscola || '—';
    const anoLetivo = turma.anoLetivo;
    const now = new Date();

    const header1 = ['REPÚBLICA DE ANGOLA — MINISTÉRIO DA EDUCAÇÃO'];
    const header2 = [`MINI-PAUTA — ${turma.classe} ${turma.nome} — Ano Lectivo: ${anoLetivo}`];
    const header3 = [`Escola: ${escola}   Turno: ${turma.turno}   Data: ${now.toLocaleDateString('pt-AO')}`];
    const emptyRow: string[] = [];

    const colHeader: string[] = ['Nº', 'Nome do Aluno'];
    for (const d of disciplinas) {
      colHeader.push(`${d} MT1`, `${d} MT2`, `${d} MT3`, `${d} MFD`);
    }

    const dataRows = alunosDaTurma.map((aluno, idx) => {
      const row: (string | number)[] = [idx + 1, `${aluno.nome.toUpperCase()} ${aluno.apelido.toUpperCase()}`];
      for (const disc of disciplinas) {
        for (let tr = 1; tr <= 3; tr++) {
          const n = notasDaTurma.find(x => x.alunoId === aluno.id && x.disciplina === disc && x.trimestre === tr);
          row.push(n?.mt1 ? Math.round(n.mt1) : '');
        }
        const ns = notasDaTurma.filter(x => x.alunoId === aluno.id && x.disciplina === disc);
        const withNf = ns.find(x => x.nf);
        if (withNf) {
          row.push(Math.round(withNf.nf));
        } else {
          const mts = ns.map(x => x.mt1).filter(v => v > 0);
          row.push(mts.length ? Math.round(mts.reduce((a, b) => a + b, 0) / mts.length) : '');
        }
      }
      return row;
    });

    const wb = XLSX.utils.book_new();
    const wsData: (string | number)[][] = [header1, header2, header3, emptyRow, colHeader, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const totalCols = 2 + disciplinas.length * 4;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },
    ];
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, ...disciplinas.flatMap(() => [{ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }])];

    XLSX.utils.book_append_sheet(wb, ws, 'Mini-Pauta');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mini_Pauta_${turma.classe}_${turma.nome}_${anoLetivo}.xlsx`.replace(/\//g, '-');
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Lista da Turma HTML Builder ──────────────────────────────────────────

  function buildListaTurmaHtml(turmaId: string): string {
    const turma = turmas.find(t => t.id === turmaId);
    if (!turma) return '';

    const now = new Date();
    const professor = professores.find(p => p.id === turma.professorId);
    const professorNome = professor ? `${professor.nome} ${professor.apelido || ''}`.trim() : '___________________________';
    const escolaNome = config.nomeEscola || '___________________________';
    const director = directorGeral;
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    const alunosDaTurma = alunos
      .filter(a => a.ativo && a.turmaId === turmaId)
      .sort((a, b) => `${a.nome} ${a.apelido}`.localeCompare(`${b.nome} ${b.apelido}`));

    function calcAge(dataNasc: string): number {
      if (!dataNasc) return 0;
      const birth = new Date(dataNasc);
      if (isNaN(birth.getTime())) return 0;
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return age;
    }

    function fmtDate(d: string): string {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('pt-PT');
    }

    const studentRows = alunosDaTurma.map((aluno, idx) => {
      const age = calcAge(aluno.dataNascimento);
      const bg = idx % 2 === 1 ? '#FFF9C4' : '#ffffff';
      return `<tr style="background:${bg};">
        <td style="text-align:center;font-weight:bold;">${idx + 1}</td>
        <td style="text-align:left;padding-left:6px;">${aluno.nome.toUpperCase()} ${aluno.apelido.toUpperCase()}</td>
        <td style="text-align:center;">${age > 0 ? age : ''}</td>
        <td style="text-align:center;">${aluno.genero || ''}</td>
        <td style="text-align:center;">${fmtDate(aluno.dataNascimento)}</td>
        <td style="text-align:center;">${aluno.telefoneEncarregado || ''}</td>
      </tr>`;
    }).join('');

    const total = alunosDaTurma.length;
    const masculinos = alunosDaTurma.filter(a => a.genero === 'M').length;
    const femininos = alunosDaTurma.filter(a => a.genero === 'F').length;
    const pctM = total > 0 ? Math.round((masculinos / total) * 100) : 0;
    const pctF = total > 0 ? Math.round((femininos / total) * 100) : 0;

    const idadeGroups = [10, 11, 12, 13, 14, 15, 16];

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Lista da Turma — ${turma.classe} ${turma.nome} ${turma.anoLetivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px 30px; color: #000; }
    .header { text-align: center; margin-bottom: 12px; }
    .header p { margin: 1px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .info-block { margin-bottom: 6px; font-size: 11px; }
    .info-row { display: flex; gap: 24px; margin-bottom: 3px; }
    .info-row span { white-space: nowrap; }
    .doc-title { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin: 10px 0 8px; text-transform: uppercase; letter-spacing: 1px; }
    .main-table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 20px; }
    .main-table th { background: #00BCD4; color: #fff; font-style: italic; font-weight: bold; border: 1px solid #000; padding: 4px 6px; text-align: center; }
    .main-table td { border: 1px solid #000; padding: 3px 4px; }
    .main-table .num-col { width: 30px; }
    .main-table .name-col { width: 38%; }
    .stat-title { text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; }
    .stat-table { border-collapse: collapse; margin: 0 auto; min-width: 340px; font-size: 11px; }
    .stat-table th { background: #00BCD4; color: #fff; font-style: italic; font-weight: bold; border: 1px solid #000; padding: 4px 8px; text-align: center; }
    .stat-table td { border: 1px solid #000; padding: 3px 8px; text-align: center; }
    .stat-label { background: #00BCD4; color: #fff; font-weight: bold; font-style: italic; text-align: center; }
    .stat-genero-label { background: #00BCD4; color: #fff; font-weight: bold; font-style: italic; text-align: center; }
    .total-row td { font-weight: bold; background: #e3f2fd; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; }
    .sig-block { text-align: center; min-width: 160px; }
    .sig-line { width: 140px; border-top: 1px solid #000; margin: 30px auto 4px; }
    .print-btn { position: fixed; bottom: 20px; right: 20px; background: #0369a1; color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-size: 13px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 999; }
    .print-btn:hover { background: #0284c7; }
    @media print {
      .print-btn { display: none !important; }
      body { margin: 15px 20px; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <p>REPÚBLICA DE ANGOLA</p>
    <p>MINISTÉRIO DA EDUCAÇÃO</p>
    <p>ENSINO GERAL</p>
    <p style="margin-top:4px;">${escolaNome}</p>
  </div>

  <div class="info-block">
    <div class="info-row">
      <span><strong>${turma.classe}</strong></span>
      <span><strong>SALA:</strong> ${turma.sala || '___'}</span>
      <span><strong>TURMA:</strong> ${turma.nome}</span>
      <span><strong>PERÍODO:</strong> ${turma.turno.toUpperCase()}</span>
    </div>
    <div class="info-row">
      <span><strong>PROFESSOR(A):</strong> ${professorNome}</span>
      <span><strong>ANO LECTIVO:</strong> ${turma.anoLetivo}</span>
    </div>
  </div>

  <div class="doc-title">Lista da Turma</div>

  <table class="main-table">
    <thead>
      <tr>
        <th class="num-col">Nº</th>
        <th class="name-col">NOME DO ALUNO</th>
        <th>IDADE</th>
        <th>SEXO</th>
        <th>DATA DE<br>NASCIMENTO</th>
        <th>CONTACTOS</th>
      </tr>
    </thead>
    <tbody>
      ${studentRows}
    </tbody>
  </table>

  <div class="stat-title">Mapa Estatístico</div>
  <table class="stat-table">
    <thead>
      <tr>
        <th colspan="2"></th>
        <th>Nº DE ALUNOS</th>
        <th>VALOR PERCENTUAL</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td rowspan="2" class="stat-genero-label">GÉNERO</td>
        <td class="stat-genero-label" style="font-style:italic;font-weight:bold;">MASCULINO</td>
        <td>${masculinos}</td>
        <td>${pctM}%</td>
      </tr>
      <tr>
        <td class="stat-genero-label" style="font-style:italic;font-weight:bold;">FEMENINO</td>
        <td>${femininos}</td>
        <td>${pctF}%</td>
      </tr>
      ${idadeGroups.map((age, i) => {
        const count = alunosDaTurma.filter(a => calcAge(a.dataNascimento) === age).length;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        if (i === 0) {
          return `<tr>
            <td rowspan="${idadeGroups.length}" class="stat-label">IDADE</td>
            <td class="stat-label" style="font-style:italic;font-weight:bold;">${age} ANOS</td>
            <td>${count}</td>
            <td>${pct}%</td>
          </tr>`;
        }
        return `<tr>
          <td class="stat-label" style="font-style:italic;font-weight:bold;">${age} ANOS</td>
          <td>${count}</td>
          <td>${pct}%</td>
        </tr>`;
      }).join('')}
      <tr class="total-row">
        <td colspan="2" style="font-weight:bold;background:#e3f2fd;">TOTAL DE ALUNOS</td>
        <td colspan="2" style="font-weight:bold;background:#e3f2fd;">${total}</td>
      </tr>
    </tbody>
  </table>

  <div class="sig-row">
    <div class="sig-block">
      <div>O PROFESSOR DIRECTOR DE TURMA</div>
      <div class="sig-line"></div>
      <div>${professorNome}</div>
    </div>
    <div class="sig-block">
      <div>${dataActual}</div>
      <div class="sig-line"></div>
      <div>${director}</div>
      <div>O(A) DIRECTOR(A)</div>
    </div>
  </div>

  <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
</body>
</html>`;
  }

  // Insert variable into editor at cursor (web-aware)
  function insertVariable(tag: string) {
    if (Platform.OS === 'web' && tinyEditorRef.current) {
      tinyEditorRef.current.insertContent(tag);
      return;
    }
    if (Platform.OS === 'web' && quillIframeRef.current) {
      quillIframeRef.current.contentWindow?.postMessage({ type: 'ck_insert', text: tag }, '*');
      return;
    }
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
      '{{NOME_DIRECTOR}}': directorGeral,
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
    if (emitTemplate && !isExtratoPropinaType(emitTemplate)) {
      setEmitPreview(buildPreview(emitTemplate, alunoId));
    }
    setAlunoSearch('');
  }

  // ─── Extracto de Propinas — build HTML from editor template + real API data ─

  function buildExtratoFromEditorTemplate(template: DocTemplate, data: any): string {
    const { aluno, pagamentos: pags, resumo, filtros } = data;

    function fmtAOA(v: number) {
      return `${Number(v).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
    }
    function fmtDate(d: string) {
      if (!d) return '—';
      const parts = d.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return d;
    }

    const ts = Date.now().toString(36).toUpperCase();
    const mat = (aluno.numeroMatricula || 'X').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
    const docId = `EXTR-${mat}-${ts}`;
    const now = new Date();
    const dataEmissao = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    const hora = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

    const periodoInicio = filtros?.dataInicio ? fmtDate(filtros.dataInicio) : `01/01/${now.getFullYear()}`;
    const periodoFim = filtros?.dataFim ? fmtDate(filtros.dataFim) : `31/12/${now.getFullYear()}`;

    const turmaObj = turmas.find(t => t.id === aluno.turmaId);

    const varMap: Record<string, string> = {
      '{{NOME_COMPLETO}}': `${aluno.nome} ${aluno.apelido}`,
      '{{NOME}}': aluno.nome || '',
      '{{APELIDO}}': aluno.apelido || '',
      '{{NUMERO_MATRICULA}}': aluno.numeroMatricula || '',
      '{{NOME_ENCARREGADO}}': aluno.nomeEncarregado || '',
      '{{TURMA}}': aluno.turmaNome || turmaObj?.nome || '',
      '{{CLASSE}}': turmaObj?.classe || '',
      '{{ANO_LECTIVO}}': turmaObj?.anoLetivo || String(now.getFullYear()),
      '{{TURNO}}': turmaObj?.turno || '',
      '{{NIVEL}}': turmaObj?.nivel || '',
      '{{PROVINCIA}}': aluno.provincia || '',
      '{{MUNICIPIO}}': aluno.municipio || '',
      '{{NOME_ESCOLA}}': config.nomeEscola || '',
      '{{NOME_DIRECTOR}}': directorGeral,
      '{{CHEFE_SECRETARIA}}': (config as any).chefeSecretaria || '___________________________',
      '{{DATA_ACTUAL}}': dataEmissao,
      '{{MES_ACTUAL}}': MESES[now.getMonth()],
      '{{ANO_ACTUAL}}': String(now.getFullYear()),
      '{{TOTAL_PAGO}}': fmtAOA(resumo.totalPago),
      '{{TOTAL_PENDENTE}}': fmtAOA(resumo.totalPendente),
      '{{TOTAL_CANCELADO}}': fmtAOA(resumo.totalCancelado),
      '{{TOTAL_TRANSACCOES}}': String(resumo.total),
      '{{PERIODO_INICIO}}': periodoInicio,
      '{{PERIODO_FIM}}': periodoFim,
      '{{DOC_REF}}': docId,
    };

    let html = template.conteudo;
    Object.entries(varMap).forEach(([k, v]) => {
      html = html.split(k).join(v);
    });

    const METODO_LABEL: Record<string, string> = {
      dinheiro: 'Dinheiro', transferencia: 'Transferência', multicaixa: 'Multicaixa Express',
    };
    const TIPO_LABEL: Record<string, string> = {
      propina: 'Propina', matricula: 'Matrícula', material: 'Material',
      exame: 'Exame', multa: 'Multa', outro: 'Outro',
    };
    const MESES_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    const realRows = (pags || []).map((p: any, idx: number) => {
      const descricao = [
        p.taxaDescricao || TIPO_LABEL[p.taxaTipo || ''] || p.taxaTipo || '',
        p.mes ? (MESES_SHORT[(p.mes - 1) % 12] || '') : '',
        p.ano || '',
      ].filter(Boolean).join(' · ');

      const statusStyle = p.status === 'pago'
        ? 'color:#1a6b2a;background:#d4edda;'
        : p.status === 'pendente'
          ? 'color:#856404;background:#fff3cd;'
          : 'color:#6c757d;background:#e2e3e5;';

      const valor = p.status === 'cancelado'
        ? `<span style="color:#aaa;text-decoration:line-through;">${fmtAOA(Number(p.valor))}</span>`
        : `<strong style="color:${p.status === 'pago' ? '#1a6b2a' : '#856404'};">${fmtAOA(Number(p.valor))}</strong>`;

      const bg = idx % 2 === 0 ? '#fff' : '#f9f9ff';
      const ref = [p.referencia ? `Ref: ${p.referencia}` : '', p.observacao || ''].filter(Boolean).join(' · ');

      return `<tr style="background:${bg};">
        <td style="padding:6px 8px;font-size:10px;color:#555;white-space:nowrap;">${fmtDate(p.data)}</td>
        <td style="padding:6px 8px;font-size:10px;">
          <span style="font-weight:600;color:#1a2540;">${descricao}</span>
          ${ref ? `<br><span style="font-size:9px;color:#888;">${ref}</span>` : ''}
        </td>
        <td style="padding:6px 8px;font-size:10px;color:#555;">${METODO_LABEL[p.metodoPagamento] || p.metodoPagamento}</td>
        <td style="padding:6px 8px;text-align:right;white-space:nowrap;">${valor}</td>
        <td style="padding:4px 8px;text-align:center;">
          <span style="font-size:9px;font-weight:bold;padding:2px 6px;border-radius:4px;${statusStyle}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        </td>
      </tr>`;
    }).join('');

    const tbodyContent = pags?.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:30px;color:#aaa;font-size:12px;border:1px dashed #ddd;border-radius:8px;">Nenhum pagamento encontrado para o período seleccionado.</td></tr>`
      : realRows;

    html = html.replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody>${tbodyContent}</tbody>`);

    const qrLines = [
      `DOC: ${docId}`,
      `ESCOLA: ${config.nomeEscola || ''}`,
      `ALUNO: ${aluno.nome} ${aluno.apelido}`,
      `MATRICULA: ${aluno.numeroMatricula}`,
      `TOTAL PAGO: ${fmtAOA(resumo.totalPago)}`,
      `TRANSACCOES: ${resumo.total}`,
      `EMITIDO: ${dataEmissao} ${hora}`,
    ].join('\n');
    const newQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrLines)}&bgcolor=ffffff&color=000000&margin=6`;

    html = html.replace(/https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/[^"']*/g, newQrUrl);

    return html;
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
    const director = directorGeral;
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

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}
</body>
</html>`;
  }

  // ─── Mapa de Aproveitamento HTML Builder ─────────────────────────────────

  function buildMapaAproveitamentoHtml(trimestre: 1 | 2 | 3): string {
    const escola = config.nomeEscola || 'Complexo Escolar';
    const director = directorGeral;
    const now = new Date();
    const dataActual = `${escola.toUpperCase()}, ${now.getDate()} DE ${MESES[now.getMonth()].toUpperCase()} DE ${now.getFullYear()}`;

    // Detect anoLetivo from most recent turma
    const sortedTurmas = [...turmas].sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo));
    const anoLetivo = sortedTurmas[0]?.anoLetivo || String(now.getFullYear());

    // ── Define class groups ────────────────────────────────────────────────
    type ClasseRow = { label: string; classeKeys: string[]; nivel: string; span?: number };
    const NIVEIS: { nivel: string; span: number; classes: ClasseRow[] }[] = [
      {
        nivel: 'ENSINO\nPRIMÁRIO', span: 7,
        classes: [
          { label: 'Iniciação',   classeKeys: ['Iniciação','Iniciacao','iniciação','iniciacao'], nivel: '' },
          { label: '1ª Classe',   classeKeys: ['1ª','1a'], nivel: '' },
          { label: '2ª Classe',   classeKeys: ['2ª','2a'], nivel: '' },
          { label: '3ª Classe',   classeKeys: ['3ª','3a'], nivel: '' },
          { label: '4ª Classe',   classeKeys: ['4ª','4a'], nivel: '' },
          { label: '5ª Classe',   classeKeys: ['5ª','5a'], nivel: '' },
          { label: '6ª Classe',   classeKeys: ['6ª','6a'], nivel: '' },
        ],
      },
      {
        nivel: '1º CICLO', span: 3,
        classes: [
          { label: '7ª Classe',   classeKeys: ['7ª','7a'], nivel: '' },
          { label: '8ª Classe',   classeKeys: ['8ª','8a'], nivel: '' },
          { label: '9ª Classe',   classeKeys: ['9ª','9a'], nivel: '' },
        ],
      },
      {
        nivel: '2º CICLO', span: 3,
        classes: [
          { label: '10ª Classe',  classeKeys: ['10ª','10a'], nivel: '' },
          { label: '11ª Classe',  classeKeys: ['11ª','11a'], nivel: '' },
          { label: '12ª Classe',  classeKeys: ['12ª','12a'], nivel: '' },
        ],
      },
    ];

    // ── Stats computation ────────────────────────────────────────────────
    function turmasForClasse(keys: string[]): Turma[] {
      return turmas.filter(t => {
        const c = (t.classe || '').toLowerCase().trim();
        return keys.some(k => {
          const kl = k.toLowerCase().trim();
          // For numeric classes (e.g., '1ª', '10ª'): extract the number and match exactly
          const numMatch = kl.match(/^(\d+)/);
          if (numMatch) {
            const num = numMatch[1];
            // Must start with this exact number followed by 'ª' or space or end
            return new RegExp(`^${num}[ªa\\s]`).test(c) || c === num;
          }
          // Non-numeric (Iniciação): normalize and check
          const kNorm = kl.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const cNorm = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return cNorm.includes(kNorm) || cNorm.startsWith(kNorm);
        });
      });
    }

    function getStats(classeKeys: string[]) {
      const ts = turmasForClasse(classeKeys);
      const turmaIds = new Set(ts.map(t => t.id));

      // Matriculados
      const matriculados = alunos.filter(a => a.ativo && turmaIds.has(a.turmaId));
      const matMF = matriculados.length;
      const matF = matriculados.filter(a => a.genero === 'F').length;

      // Notas for this trimestre
      const notasTri = notas.filter(n => n.trimestre === trimestre && turmaIds.has(n.turmaId));

      // Avaliados: students with at least 1 nota in this trimestre
      const avaliadosSet = new Set(notasTri.map(n => n.alunoId));
      const avaliadosMF = avaliadosSet.size;
      const avaliadosF = matriculados.filter(a => a.genero === 'F' && avaliadosSet.has(a.id)).length;

      // Average per student in this trimestre
      const studentAvg = new Map<string, number>();
      for (const aid of avaliadosSet) {
        const studentNotas = notasTri.filter(n => n.alunoId === aid).map(n => n.nf);
        if (studentNotas.length > 0) {
          studentAvg.set(aid, studentNotas.reduce((a,b)=>a+b,0) / studentNotas.length);
        }
      }

      // C/Aproveitamento: avg >= 10
      const aprovIds = [...avaliadosSet].filter(id => (studentAvg.get(id) ?? 0) >= 10);
      const aprovMF = aprovIds.length;
      const aprovF = matriculados.filter(a => a.genero === 'F' && aprovIds.includes(a.id)).length;
      const aprovPct = avaliadosMF > 0 ? Math.round((aprovMF / avaliadosMF) * 100) : null;

      // S/Aproveitamento
      const sAprovMF = avaliadosMF - aprovMF;
      const sAprovF = avaliadosF - aprovF;
      const sAprovPct = avaliadosMF > 0 ? Math.round((sAprovMF / avaliadosMF) * 100) : null;

      // Nº de Professores: professors who teach at least one turma in this classe
      const profSet = new Set<string>();
      for (const prof of professores) {
        if (prof.turmasIds?.some(tid => turmaIds.has(tid))) profSet.add(prof.id);
      }
      const profMF = profSet.size;
      // Gender for professors not tracked → show '-'

      return { matMF, matF, avaliadosMF, avaliadosF, aprovMF, aprovF, aprovPct, sAprovMF, sAprovF, sAprovPct, profMF };
    }

    function dash(v: number | null): string {
      return v === null || v === 0 ? '-' : String(v);
    }
    function pct(v: number | null): string {
      return v === null ? '-' : `${v}%`;
    }

    // Build sub-total and grand-total accumulators
    type StatRow = ReturnType<typeof getStats>;
    function addStats(a: StatRow, b: StatRow): StatRow {
      return {
        matMF: a.matMF + b.matMF,
        matF: a.matF + b.matF,
        avaliadosMF: a.avaliadosMF + b.avaliadosMF,
        avaliadosF: a.avaliadosF + b.avaliadosF,
        aprovMF: a.aprovMF + b.aprovMF,
        aprovF: a.aprovF + b.aprovF,
        aprovPct: null, // recalculated
        sAprovMF: a.sAprovMF + b.sAprovMF,
        sAprovF: a.sAprovF + b.sAprovF,
        sAprovPct: null, // recalculated
        profMF: a.profMF + b.profMF,
      };
    }
    function calcPct(s: StatRow): StatRow {
      return {
        ...s,
        aprovPct: s.avaliadosMF > 0 ? Math.round((s.aprovMF / s.avaliadosMF) * 100) : null,
        sAprovPct: s.avaliadosMF > 0 ? Math.round((s.sAprovMF / s.avaliadosMF) * 100) : null,
      };
    }

    function row(label: string, s: StatRow, bold = false, bg = '') {
      const style = bold ? 'font-weight:bold;' : '';
      const bgStyle = bg ? `background:${bg};` : '';
      return `<tr style="${bgStyle}${style}">
        <td style="padding:3px 5px;${style}">${label}</td>
        <td style="text-align:center;">${s.matMF}</td>
        <td style="text-align:center;">${s.matF}</td>
        <td style="text-align:center;color:#aaa;">-</td>
        <td style="text-align:center;color:#aaa;">-</td>
        <td style="text-align:center;">${dash(s.avaliadosMF)}</td>
        <td style="text-align:center;">${dash(s.avaliadosF)}</td>
        <td style="text-align:center;color:#c00;font-weight:bold;">${dash(s.aprovMF)}</td>
        <td style="text-align:center;">${dash(s.aprovF)}</td>
        <td style="text-align:center;">${pct(s.aprovPct)}</td>
        <td style="text-align:center;">${dash(s.sAprovMF)}</td>
        <td style="text-align:center;">${dash(s.sAprovF)}</td>
        <td style="text-align:center;">${pct(s.sAprovPct)}</td>
        <td style="text-align:center;">${dash(s.profMF)}</td>
        <td style="text-align:center;">-</td>
      </tr>`;
    }

    let tableBody = '';
    const zeroStats: StatRow = { matMF:0, matF:0, avaliadosMF:0, avaliadosF:0, aprovMF:0, aprovF:0, aprovPct:null, sAprovMF:0, sAprovF:0, sAprovPct:null, profMF:0 };
    let grandTotal: StatRow = { ...zeroStats };

    for (const nivel of NIVEIS) {
      let nivelTotal: StatRow = { ...zeroStats };
      let firstInNivel = true;

      for (const classe of nivel.classes) {
        const s = getStats(classe.classeKeys);
        nivelTotal = addStats(nivelTotal, s);
        const nivelCell = firstInNivel
          ? `<td rowspan="${nivel.span}" style="font-weight:bold;text-align:center;vertical-align:middle;background:#f5f5f5;border:1px solid #ccc;white-space:pre;">${nivel.nivel}</td>`
          : '';
        tableBody += `<tr>
          ${nivelCell}
          <td style="padding:3px 5px;border:1px solid #ccc;">${classe.label}</td>
          <td style="text-align:center;border:1px solid #ccc;">${s.matMF}</td>
          <td style="text-align:center;border:1px solid #ccc;">${s.matF}</td>
          <td style="text-align:center;border:1px solid #ccc;color:#aaa;">-</td>
          <td style="text-align:center;border:1px solid #ccc;color:#aaa;">-</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.avaliadosMF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.avaliadosF)}</td>
          <td style="text-align:center;border:1px solid #ccc;color:#c00;font-weight:bold;">${dash(s.aprovMF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.aprovF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${pct(s.aprovPct)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.sAprovMF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.sAprovF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${pct(s.sAprovPct)}</td>
          <td style="text-align:center;border:1px solid #ccc;">${dash(s.profMF)}</td>
          <td style="text-align:center;border:1px solid #ccc;">-</td>
        </tr>`;
        firstInNivel = false;
      }

      nivelTotal = calcPct(nivelTotal);
      grandTotal = addStats(grandTotal, nivelTotal);
      tableBody += `<tr style="background:#e8e8e8;font-weight:bold;">
        <td colspan="2" style="padding:3px 8px;border:1px solid #999;">SUB-TOTAL</td>
        <td style="text-align:center;border:1px solid #999;">${nivelTotal.matMF}</td>
        <td style="text-align:center;border:1px solid #999;">${nivelTotal.matF}</td>
        <td style="text-align:center;border:1px solid #999;color:#aaa;">-</td>
        <td style="text-align:center;border:1px solid #999;color:#aaa;">-</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.avaliadosMF)}</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.avaliadosF)}</td>
        <td style="text-align:center;border:1px solid #999;color:#c00;">${dash(nivelTotal.aprovMF)}</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.aprovF)}</td>
        <td style="text-align:center;border:1px solid #999;">${pct(nivelTotal.aprovPct)}</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.sAprovMF)}</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.sAprovF)}</td>
        <td style="text-align:center;border:1px solid #999;">${pct(nivelTotal.sAprovPct)}</td>
        <td style="text-align:center;border:1px solid #999;">${dash(nivelTotal.profMF)}</td>
        <td style="text-align:center;border:1px solid #999;">-</td>
      </tr>`;
    }

    grandTotal = calcPct(grandTotal);
    tableBody += `<tr style="background:#d1d5db;font-weight:bold;font-size:11px;">
      <td colspan="2" style="padding:4px 8px;border:1px solid #888;">TOTAL GERAL</td>
      <td style="text-align:center;border:1px solid #888;">${grandTotal.matMF}</td>
      <td style="text-align:center;border:1px solid #888;">${grandTotal.matF}</td>
      <td style="text-align:center;border:1px solid #888;color:#aaa;">-</td>
      <td style="text-align:center;border:1px solid #888;color:#aaa;">-</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.avaliadosMF)}</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.avaliadosF)}</td>
      <td style="text-align:center;border:1px solid #888;color:#c00;">${dash(grandTotal.aprovMF)}</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.aprovF)}</td>
      <td style="text-align:center;border:1px solid #888;">${pct(grandTotal.aprovPct)}</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.sAprovMF)}</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.sAprovF)}</td>
      <td style="text-align:center;border:1px solid #888;">${pct(grandTotal.sAprovPct)}</td>
      <td style="text-align:center;border:1px solid #888;">${dash(grandTotal.profMF)}</td>
      <td style="text-align:center;border:1px solid #888;">-</td>
    </tr>`;

    const anoLetivoSlash = anoLetivo.includes('/') ? anoLetivo : `${anoLetivo}/${String(Number(anoLetivo)+1).slice(-2)}`;
    const tipoEscola = (config as any).tipoEscola || 'PRIVADA';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Mapa de Aproveitamento — ${trimestre}º Trimestre ${anoLetivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 14px 20px; }
    .header { text-align: center; margin-bottom: 6px; }
    .header p { margin: 1px 0; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .header p.sub { font-weight: normal; font-size: 9.5px; }
    .escola-row { text-align: left; font-weight: bold; font-size: 10px; margin-bottom: 4px; }
    .titulo { text-align: center; font-size: 10.5px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; border: 1px solid #000; padding: 4px; letter-spacing: 0.3px; }
    table { border-collapse: collapse; width: 100%; font-size: 9.5px; }
    th { border: 1px solid #000; padding: 3px 4px; text-align: center; background: #f0f0f0; font-weight: bold; font-size: 9px; line-height: 1.2; }
    td { border: 1px solid #ccc; font-size: 9.5px; }
    .sig-row { display: flex; justify-content: center; margin-top: 24px; }
    .sig-block { text-align: center; }
    .sig-label { font-size: 10px; font-style: italic; font-weight: bold; margin-bottom: 24px; }
    .sig-line { width: 200px; border-top: 1px solid #000; margin: 0 auto 3px; }
    .sig-name { font-size: 10px; font-weight: bold; }
    .date { text-align: left; font-size: 10px; margin: 14px 0 8px; font-weight: bold; }
    @media print { @page { size: A3 landscape; margin: 8mm 12mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Governo da Província de ${config.provincia || '_______________'}</p>
    <p>Administração Municipal de ${config.municipio || '_______________'}</p>
    <p class="sub">Repartição de Educação, Ensino Ciência e Tecnologia e Inovação</p>
    <p>Área do Ensino Geral</p>
  </div>

  <div class="escola-row">ESCOLA: ${escola.toUpperCase()}</div>

  <div class="titulo">
    MAPA DE APROVEITAMENTO DO ${trimestre}º TRIMESTRE DO ANO LECTIVO ${anoLetivoSlash} / ESCOLAS ${tipoEscola.toUpperCase()}
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2">NÍVEL</th>
        <th rowspan="2">CLASSE</th>
        <th colspan="2">MATRICULADOS</th>
        <th colspan="2">DESISTÊNCIA</th>
        <th colspan="2">AVALIADOS</th>
        <th colspan="3">C/APROVEITAMENTO</th>
        <th colspan="3">S/APROVEITAMENTO</th>
        <th colspan="2">Nº DE PROFESSORES</th>
      </tr>
      <tr>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th><th>%</th>
        <th>MF</th><th>F</th><th>%</th>
        <th>MF</th><th>F</th>
      </tr>
    </thead>
    <tbody>
      ${tableBody}
    </tbody>
  </table>

  <div class="date">${dataActual}.</div>

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}
</body>
</html>`;
  }

  // ─── Mapa de Aproveitamento — Detalhado por Turma ────────────────────────

  function buildMapaTurmaDetalhadoHtml(trimestre: 1 | 2 | 3): string {
    const escola = config.nomeEscola || 'Complexo Escolar';
    const subdirector = user?.nome || '____________________________';
    const now = new Date();
    const dataLocal = `${config.municipio || escola}, ${now.getDate()} / ${String(now.getMonth()+1).padStart(2,'0')} / ${now.getFullYear()}`;

    const sortedTurmas2 = [...turmas].sort((a,b) => b.anoLetivo.localeCompare(a.anoLetivo));
    const anoLetivo = sortedTurmas2[0]?.anoLetivo || String(now.getFullYear());
    const anoLetivoSlash2 = anoLetivo.includes('/') ? anoLetivo : `${anoLetivo}/${String(Number(anoLetivo)+1).slice(-2)}`;

    // Sort turmas by nivel order then classe
    const nivelOrder: Record<string, number> = { 'Primário': 0, 'I Ciclo': 1, 'II Ciclo': 2 };
    const activeTurmas = [...turmas]
      .filter(t => t.ativo)
      .sort((a, b) => {
        const no = (nivelOrder[a.nivel] ?? 9) - (nivelOrder[b.nivel] ?? 9);
        if (no !== 0) return no;
        return a.classe.localeCompare(b.classe, 'pt', { numeric: true });
      });

    // ── Per-turma stats ─────────────────────────────────────────────────────
    function getTurmaStats(turmaId: string) {
      const turmaAlunos = alunos.filter(a => a.ativo && a.turmaId === turmaId);
      const matMF = turmaAlunos.length;
      const matF = turmaAlunos.filter(a => a.genero === 'F').length;

      // Notas for this trimestre
      const notasTri = notas.filter(n => n.turmaId === turmaId && n.trimestre === trimestre);
      const avaliadosIds = [...new Set(notasTri.map(n => n.alunoId))];
      const avalMF = avaliadosIds.length;
      const avalF = turmaAlunos.filter(a => a.genero === 'F' && avaliadosIds.includes(a.id)).length;

      // Avg per student: use nf average across disciplines
      const aprovadosIds = avaliadosIds.filter(id => {
        const ns = notasTri.filter(n => n.alunoId === id);
        if (ns.length === 0) return false;
        return ns.reduce((s, n) => s + n.nf, 0) / ns.length >= 10;
      });
      const aprovMF = aprovadosIds.length;
      const aprovF = turmaAlunos.filter(a => a.genero === 'F' && aprovadosIds.includes(a.id)).length;

      const reprovMF = avalMF - aprovMF;
      const reprovF = avalF - aprovF;

      const aptosPct = avalMF > 0 ? Math.round((aprovMF / avalMF) * 100) : 0;
      const nAptosPct = 100 - aptosPct;

      return { matMF, matF, avalMF, avalF, aprovMF, aprovF, reprovMF, reprovF, aptosPct, nAptosPct };
    }

    // ── Build table rows grouped by nivel ───────────────────────────────────
    const nivelLabel: Record<string, string> = {
      'Primário': 'ENSINO PRIMÁRIO',
      'I Ciclo': 'Iº CICLO',
      'II Ciclo': 'IIº CICLO',
    };

    const zero = { matMF:0, matF:0, avalMF:0, avalF:0, aprovMF:0, aprovF:0, reprovMF:0, reprovF:0 };
    type TotRow = typeof zero;
    function addTot(a: TotRow, b: TotRow): TotRow {
      return { matMF: a.matMF+b.matMF, matF: a.matF+b.matF, avalMF: a.avalMF+b.avalMF, avalF: a.avalF+b.avalF, aprovMF: a.aprovMF+b.aprovMF, aprovF: a.aprovF+b.aprovF, reprovMF: a.reprovMF+b.reprovMF, reprovF: a.reprovF+b.reprovF };
    }
    function totPcts(t: TotRow) {
      const aptos = t.avalMF > 0 ? Math.round((t.aprovMF/t.avalMF)*100) : 0;
      return { aptos, nAptos: t.avalMF > 0 ? 100 - aptos : 0 };
    }

    // Group turmas by nivel
    const grupos = new Map<string, typeof activeTurmas>();
    for (const t of activeTurmas) {
      const key = t.nivel || 'Outro';
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(t);
    }

    let tableRows = '';
    let grandTotal: TotRow = { ...zero };

    for (const [nivel, nivelTurmas] of grupos) {
      let nivelTotal: TotRow = { ...zero };
      let firstRow = true;
      const nivelRowspan = nivelTurmas.length + 1; // +1 for total row

      for (const t of nivelTurmas) {
        const s = getTurmaStats(t.id);
        const nivelCell = firstRow
          ? `<td rowspan="${nivelRowspan}" style="font-weight:bold;text-align:center;vertical-align:middle;background:#2d2d2d;color:#fff;border:1px solid #000;white-space:pre-wrap;font-size:8.5px;">${nivelLabel[nivel] || nivel.toUpperCase()}</td>`
          : '';
        tableRows += `<tr>
          ${nivelCell}
          <td style="border:1px solid #ccc;padding:2px 4px;font-size:9px;">${t.classe} ${t.nome}</td>
          <td style="border:1px solid #ccc;padding:2px 4px;text-align:center;font-size:9px;">${t.turno}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.matMF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.matF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.avalMF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.avalF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#065f46;font-weight:bold;">${s.aprovMF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.aprovF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#991b1b;">${s.reprovMF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${s.reprovF}</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;color:#999;">0</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;font-weight:bold;color:#065f46;">${s.aptosPct}%</td>
          <td style="border:1px solid #ccc;text-align:center;font-size:9px;font-weight:bold;color:#991b1b;">${s.nAptosPct}%</td>
        </tr>`;
        nivelTotal = addTot(nivelTotal, { matMF: s.matMF, matF: s.matF, avalMF: s.avalMF, avalF: s.avalF, aprovMF: s.aprovMF, aprovF: s.aprovF, reprovMF: s.reprovMF, reprovF: s.reprovF });
        firstRow = false;
      }

      const np = totPcts(nivelTotal);
      tableRows += `<tr style="background:#e8e8e8;font-weight:bold;">
        <td colspan="2" style="border:1px solid #999;padding:2px 6px;font-size:9px;">Total</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.matMF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.matF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.avalMF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.avalF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;color:#065f46;">${nivelTotal.aprovMF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.aprovF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;color:#991b1b;">${nivelTotal.reprovMF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;">${nivelTotal.reprovF}</td>
        <td colspan="8" style="border:1px solid #999;text-align:center;font-size:8.5px;color:#777;">—</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;color:#065f46;">${np.aptos}%</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;color:#991b1b;">${np.nAptos}%</td>
      </tr>`;
      grandTotal = addTot(grandTotal, nivelTotal);
    }

    const gp = totPcts(grandTotal);
    tableRows += `<tr style="background:#c8c8c8;font-weight:bold;font-size:9px;">
      <td colspan="3" style="border:1px solid #888;padding:3px 6px;">TOTAL GERAL</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.matMF}</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.matF}</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.avalMF}</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.avalF}</td>
      <td style="border:1px solid #888;text-align:center;color:#065f46;">${grandTotal.aprovMF}</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.aprovF}</td>
      <td style="border:1px solid #888;text-align:center;color:#991b1b;">${grandTotal.reprovMF}</td>
      <td style="border:1px solid #888;text-align:center;">${grandTotal.reprovF}</td>
      <td colspan="8" style="border:1px solid #888;text-align:center;color:#777;">—</td>
      <td style="border:1px solid #888;text-align:center;color:#065f46;">${gp.aptos}%</td>
      <td style="border:1px solid #888;text-align:center;color:#991b1b;">${gp.nAptos}%</td>
    </tr>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Mapa de Aproveitamento — ${trimestre}º Trimestre (Detalhado) ${anoLetivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; padding: 12px 18px; }
    .header { text-align: center; margin-bottom: 10px; }
    .header p { margin: 1px 0; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .header p.inst { font-size: 11px; text-decoration: underline; }
    .titulo { font-size: 10px; font-weight: bold; margin-bottom: 2px; }
    .escola-label { font-size: 10px; margin-bottom: 8px; }
    .escola-label span { font-weight: bold; }
    table { border-collapse: collapse; width: 100%; font-size: 9px; margin-bottom: 16px; }
    th { border: 1px solid #000; padding: 3px 3px; text-align: center; background: #d0d0d0; font-weight: bold; font-size: 8.5px; line-height: 1.2; vertical-align: middle; }
    th.dark { background: #2d2d2d; color: #fff; }
    td { border: 1px solid #ccc; vertical-align: middle; }
    .sig-row { display: flex; justify-content: flex-end; margin-top: 28px; gap: 60px; }
    .sig-block { text-align: center; }
    .sig-label { font-size: 10px; font-weight: bold; margin-bottom: 28px; }
    .sig-line { width: 220px; border-top: 1px solid #000; margin: 0 auto 3px; }
    .sig-name { font-size: 10px; font-style: italic; }
    .date { font-size: 10px; margin: 12px 0 6px; font-weight: bold; }
    @media print { @page { size: A3 landscape; margin: 7mm 10mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p class="inst">${escola.toUpperCase()}</p>
  </div>

  <p class="titulo">Mapa de Aproveitamento dos alunos ${trimestre === 1 ? 'Iº' : trimestre === 2 ? 'IIº' : 'IIIº'} Trimestre &mdash; Regime Diurno &mdash; Ano Lectivo de ${anoLetivoSlash2}</p>
  <p class="escola-label">Nome da Escola: <span>${escola}</span></p>

  <table>
    <thead>
      <tr>
        <th rowspan="2" class="dark">CURSO</th>
        <th rowspan="2" class="dark">CLASSE</th>
        <th rowspan="2" class="dark">PERÍODO</th>
        <th colspan="2">Alunos<br/>Matriculados</th>
        <th colspan="2">Alunos<br/>Avaliados</th>
        <th colspan="2">Alunos<br/>Aprovados</th>
        <th colspan="2">Alunos<br/>Reprovados</th>
        <th colspan="2">Alunos<br/>Desistentes</th>
        <th colspan="2">Alunos Anul.<br/>Matrícula</th>
        <th colspan="2">Alunos<br/>Transferidos</th>
        <th colspan="2">Alunos<br/>Excluídos</th>
        <th colspan="2">%</th>
      </tr>
      <tr>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th>MF</th><th>F</th>
        <th style="color:#065f46;">Aptos</th>
        <th style="color:#991b1b;">N/Aptos</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="date">${dataLocal}.</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">O Subdirector Pedagógico</div>
      <div class="sig-line"></div>
      <div class="sig-name">${subdirector}</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Mapa de Frequências — Por Curso e Classe (10ª–13ª) ─────────────────────

  function buildMapaFrequenciasHtml(): string {
    const escola = config.nomeEscola || 'Complexo Escolar';
    const subdirector = user?.nome || '____________________________';
    const now = new Date();
    const dataLocal = `${config.municipio || 'Luanda'}, ___/___/${now.getFullYear()}`;

    const sortedTurmasFq = [...turmas].sort((a,b) => b.anoLetivo.localeCompare(a.anoLetivo));
    const anoLetivo = sortedTurmasFq[0]?.anoLetivo || String(now.getFullYear());
    const anoLetivoSlashFq = anoLetivo.includes('/') ? anoLetivo : `${anoLetivo}/${String(Number(anoLetivo)+1).slice(-2)}`;

    const TARGET_PREFIXES_FQ = ['10ª', '11ª', '12ª', '13ª'];
    const activeTurmasFq = turmas.filter(t => t.ativo && TARGET_PREFIXES_FQ.some(p => t.classe.startsWith(p)));

    const existingClassesFq = TARGET_PREFIXES_FQ.filter(p =>
      activeTurmasFq.some(t => t.classe.startsWith(p))
    );

    // Helper: stats for a group of turmaIds
    function fqGroupStats(turmaIds: string[]) {
      const nTurmas = turmaIds.length;
      const grpAlunos = alunos.filter(a => a.ativo && turmaIds.includes(a.turmaId || ''));
      const matM = grpAlunos.filter(a => a.genero !== 'F').length;
      const matF = grpAlunos.filter(a => a.genero === 'F').length;
      return { nTurmas, matM, matF, matTotal: matM + matF };
    }

    // Group turmas by nivel within target classes
    const nivelGroupsFq = new Map<string, string[]>();
    for (const t of activeTurmasFq) {
      const key = t.nivel || 'Ensino';
      if (!nivelGroupsFq.has(key)) nivelGroupsFq.set(key, []);
      nivelGroupsFq.get(key)!.push(t.id);
    }

    type FqCursoRow = { label: string; turmaIds: string[] };
    const cursoRowsFq: FqCursoRow[] = nivelGroupsFq.size <= 1
      ? [{ label: escola, turmaIds: activeTurmasFq.map(t => t.id) }]
      : [...nivelGroupsFq.entries()].map(([nivel, ids]) => ({ label: nivel, turmaIds: ids }));

    // Column headers
    const classColHeadersFq = existingClassesFq.map(cls =>
      `<th colspan="4" style="border:1px solid #000;background:#d0d0d0;font-size:8.5px;text-align:center;padding:3px;">${cls} Classe</th>`
    ).join('');

    const classSubHeadersFq = existingClassesFq.map(() =>
      `<th style="border:1px solid #ccc;background:#e8e8e8;font-size:7.5px;padding:2px;text-align:center;">Nº<br/>Turmas</th>
       <th style="border:1px solid #ccc;background:#e8e8e8;font-size:7.5px;padding:2px;text-align:center;">M</th>
       <th style="border:1px solid #ccc;background:#e8e8e8;font-size:7.5px;padding:2px;text-align:center;">F</th>
       <th style="border:1px solid #ccc;background:#e8e8e8;font-size:7.5px;padding:2px;text-align:center;">Total</th>`
    ).join('');

    // Build grand total accumulators
    const grandFq = { nTurmas: 0, matM: 0, matF: 0, matTotal: 0 };
    const classGrandFq: Record<string, { nTurmas: number; matM: number; matF: number; matTotal: number }> = {};
    for (const cls of existingClassesFq) classGrandFq[cls] = { nTurmas: 0, matM: 0, matF: 0, matTotal: 0 };

    // Build data rows
    const dataRowsFq = cursoRowsFq.map(cr => {
      let cells = '';
      let rowTurmas = 0, rowM = 0, rowF = 0, rowTotal = 0;

      for (const cls of existingClassesFq) {
        const clsIds = cr.turmaIds.filter(id => {
          const t = turmas.find(t => t.id === id);
          return t && t.classe.startsWith(cls);
        });
        const s = fqGroupStats(clsIds);
        cells += `
          <td style="border:1px solid #ddd;text-align:center;font-size:9px;">${s.nTurmas}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:9px;">${s.matM}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:9px;">${s.matF}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:9px;font-weight:bold;">${s.matTotal}</td>`;
        rowTurmas += s.nTurmas; rowM += s.matM; rowF += s.matF; rowTotal += s.matTotal;
        classGrandFq[cls].nTurmas += s.nTurmas;
        classGrandFq[cls].matM += s.matM;
        classGrandFq[cls].matF += s.matF;
        classGrandFq[cls].matTotal += s.matTotal;
      }

      grandFq.nTurmas += rowTurmas; grandFq.matM += rowM; grandFq.matF += rowF; grandFq.matTotal += rowTotal;

      return `<tr>
        <td style="border:1px solid #ccc;padding:3px 6px;font-size:9px;font-weight:bold;">${cr.label}</td>
        ${cells}
        <td style="border:1px solid #ccc;text-align:center;font-size:9px;font-weight:bold;">${rowTurmas}</td>
        <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${rowM}</td>
        <td style="border:1px solid #ccc;text-align:center;font-size:9px;">${rowF}</td>
        <td style="border:1px solid #ccc;text-align:center;font-size:9px;font-weight:bold;">${rowTotal}</td>
      </tr>`;
    });

    // Total row
    let totalCells = '';
    for (const cls of existingClassesFq) {
      const cg = classGrandFq[cls];
      totalCells += `
        <td style="border:1px solid #999;text-align:center;font-size:9px;font-weight:bold;">${cg.nTurmas}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;font-weight:bold;">${cg.matM}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;font-weight:bold;">${cg.matF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:9px;font-weight:bold;">${cg.matTotal}</td>`;
    }

    // NOME DA ESCOLA colspan = 1, class cols + total cols = existingClassesFq.length * 4 + 4
    const totalColspan = existingClassesFq.length * 4 + 5;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Mapa de Frequências ${anoLetivoSlashFq}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; padding: 12px 16px; }
    .header { text-align: center; margin-bottom: 10px; }
    .header p { margin: 1px 0; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .header p.inst { font-size: 11px; text-decoration: underline; }
    .titulo { font-size: 12px; font-weight: bold; color: #b91c1c; text-align: center; margin-bottom: 2px; }
    .subtitulo { font-size: 10px; font-weight: bold; text-align: center; margin-bottom: 14px; }
    .escola-box { border: 1px solid #000; text-align: center; font-weight: bold; font-size: 9px; padding: 4px; margin-bottom: 0; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    th { vertical-align: middle; }
    .sig-row { display: flex; justify-content: center; margin-top: 30px; }
    .sig-block { text-align: center; }
    .sig-label { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 28px; }
    .sig-line { width: 220px; border-top: 1px solid #000; margin: 0 auto 3px; }
    .sig-name { font-size: 10px; font-style: italic; }
    .date { font-size: 10px; margin: 14px 0 4px; font-weight: bold; }
    .visto { font-size: 9px; position: absolute; top: 12px; left: 14px; }
    @media print { @page { size: A3 landscape; margin: 6mm 10mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p class="inst">Direcção Nacional do Ensino Técnico Profissional</p>
  </div>

  <p class="titulo">MAPA DE FREQUÊNCIAS</p>
  <p class="subtitulo">(${existingClassesFq.join(', ')} CLASSES) ANO LECTIVO ${anoLetivoSlashFq}</p>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="border:1px solid #000;background:#f0f0f0;font-size:8.5px;text-align:center;padding:3px;vertical-align:middle;min-width:60px;">NOME DA<br/>ESCOLA</th>
        <th colspan="${totalColspan - 1}" style="border:1px solid #000;background:#d0d0d0;font-size:9px;text-align:center;padding:3px;">${escola.toUpperCase()}</th>
      </tr>
      <tr>
        <th style="border:1px solid #000;background:#2d2d2d;color:#fff;font-size:8.5px;text-align:center;padding:3px;min-width:130px;">Nome do Curso</th>
        ${classColHeadersFq}
        <th colspan="4" style="border:1px solid #000;background:#555;color:#fff;font-size:8.5px;text-align:center;padding:3px;">TOTAL GERAL</th>
      </tr>
      <tr>
        <td style="border:1px solid #ccc;"></td>
        ${classSubHeadersFq}
        <th style="border:1px solid #ccc;background:#d8d8e8;font-size:7.5px;padding:2px;text-align:center;">Nº<br/>Turmas</th>
        <th style="border:1px solid #ccc;background:#d8d8e8;font-size:7.5px;padding:2px;text-align:center;">M</th>
        <th style="border:1px solid #ccc;background:#d8d8e8;font-size:7.5px;padding:2px;text-align:center;">F</th>
        <th style="border:1px solid #ccc;background:#d8d8e8;font-size:7.5px;padding:2px;text-align:center;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${dataRowsFq.join('\n')}
      <tr style="background:#c8c8c8;font-weight:bold;">
        <td style="border:1px solid #888;padding:3px 6px;font-size:9px;">Total</td>
        ${totalCells}
        <td style="border:1px solid #888;text-align:center;font-size:9px;">${grandFq.nTurmas}</td>
        <td style="border:1px solid #888;text-align:center;font-size:9px;">${grandFq.matM}</td>
        <td style="border:1px solid #888;text-align:center;font-size:9px;">${grandFq.matF}</td>
        <td style="border:1px solid #888;text-align:center;font-size:9px;">${grandFq.matTotal}</td>
      </tr>
    </tbody>
  </table>

  <div class="date">${dataLocal}</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">O Subdirector Pedagógico</div>
      <div class="sig-line"></div>
      <div class="sig-name">${subdirector}</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Mapa de Aproveitamento — Por Curso e Classe (10ª–13ª) ─────────────────

  function buildMapaPorCursoClasseHtml(trimestre: 1 | 2 | 3): string {
    const escola = config.nomeEscola || 'Complexo Escolar';
    const subdirector = user?.nome || '____________________________';
    const now = new Date();
    const dataLocal = `${config.municipio || 'Luanda'}, ${now.getDate()} / ${String(now.getMonth()+1).padStart(2,'0')} / ${now.getFullYear()}`;

    const sortedTurmas3 = [...turmas].sort((a,b) => b.anoLetivo.localeCompare(a.anoLetivo));
    const anoLetivo = sortedTurmas3[0]?.anoLetivo || String(now.getFullYear());
    const anoLetivoSlash3 = anoLetivo.includes('/') ? anoLetivo : `${anoLetivo}/${String(Number(anoLetivo)+1).slice(-2)}`;

    // Target classes for this mapa (II Ciclo + 13ª)
    const TARGET_PREFIXES = ['10ª', '11ª', '12ª', '13ª'];
    const activeTurmas = turmas.filter(t => t.ativo && TARGET_PREFIXES.some(p => t.classe.startsWith(p)));

    // Detect which classes actually exist (in order)
    const existingClasses = TARGET_PREFIXES.filter(p =>
      activeTurmas.some(t => t.classe.startsWith(p))
    );

    // Helper: stats for a group of turmaIds
    function groupStats(turmaIds: string[]) {
      const groupAlunos = alunos.filter(a => a.ativo && turmaIds.includes(a.turmaId || ''));
      const notasTri = notas.filter(n => turmaIds.includes(n.turmaId || '') && n.trimestre === trimestre);

      const avaliadosIds = [...new Set(notasTri.map(n => n.alunoId))];
      const aprovadosIds = avaliadosIds.filter(id => {
        const ns = notasTri.filter(n => n.alunoId === id);
        return ns.length > 0 && (ns.reduce((s, n) => s + n.nf, 0) / ns.length) >= 10;
      });
      const reprovadosIds = avaliadosIds.filter(id => !aprovadosIds.includes(id));

      const aprovM = aprovadosIds.filter(id => groupAlunos.find(a => a.id === id)?.genero !== 'F').length;
      const aprovF = aprovadosIds.filter(id => groupAlunos.find(a => a.id === id)?.genero === 'F').length;
      const reprovM = reprovadosIds.filter(id => groupAlunos.find(a => a.id === id)?.genero !== 'F').length;
      const reprovF = reprovadosIds.filter(id => groupAlunos.find(a => a.id === id)?.genero === 'F').length;

      // D-AM-T-E: not tracked yet → always 0
      return {
        aprovM, aprovF, aprovT: aprovM + aprovF,
        reprovM, reprovF, reprovT: reprovM + reprovF,
        damteM: 0, damteF: 0, damteT: 0,
      };
    }

    // Build rows: one row per "curso" — since we don't have explicit curso field,
    // we derive groups by turma.nivel or show a single all-school row.
    // Approach: group turmas by nivel within target classes → one row per nivel group.
    type CursoRow = {
      label: string;
      turmaIds: string[];
    };

    const nivelGroups = new Map<string, string[]>();
    for (const t of activeTurmas) {
      const key = t.nivel || 'Ensino';
      if (!nivelGroups.has(key)) nivelGroups.set(key, []);
      nivelGroups.get(key)!.push(t.id);
    }

    // If only one nivel group (or all same), use a single row with school name
    const cursoRows: CursoRow[] = nivelGroups.size <= 1
      ? [{ label: escola, turmaIds: activeTurmas.map(t => t.id) }]
      : [...nivelGroups.entries()].map(([nivel, ids]) => ({ label: nivel, turmaIds: ids }));

    // Build class-level columns header
    const classColHeaders = existingClasses.map(cls => `
      <th colspan="9" style="border:1px solid #000;background:#d0d0d0;font-size:8px;text-align:center;">${cls} Classe</th>`).join('');

    const classSubHeaders = existingClasses.map(() => `
      <th colspan="3" style="border:1px solid #bbb;background:#e0e0e0;font-size:7.5px;text-align:center;">Alunos Aprovados</th>
      <th colspan="3" style="border:1px solid #bbb;background:#e0e0e0;font-size:7.5px;text-align:center;">Alunos Reprovados</th>
      <th colspan="3" style="border:1px solid #bbb;background:#e0e0e0;font-size:7.5px;text-align:center;">Alunos D-AM-T-E</th>`).join('');

    // 3 groups × 3 cols per class
    const mfRow = existingClasses.map(() => `
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">M</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">F</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">Total</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">M</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">F</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">Total</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">M</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">F</th>
      <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;">Total</th>`).join('');

    // Build data rows
    const totals = { aprovM: 0, aprovF: 0, aprovT: 0, reprovM: 0, reprovF: 0, reprovT: 0, damteM: 0, damteF: 0, damteT: 0 };

    const dataRows = cursoRows.map(cr => {
      let rowCells = '';
      let rowAprovT = 0, rowReprovT = 0, rowDamteT = 0;

      for (const cls of existingClasses) {
        const clsTurmaIds = cr.turmaIds.filter(id => {
          const t = turmas.find(t => t.id === id);
          return t && t.classe.startsWith(cls);
        });
        const s = groupStats(clsTurmaIds);
        rowCells += `
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#065f46;">${s.aprovM}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#065f46;">${s.aprovF}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;font-weight:bold;color:#065f46;">${s.aprovT}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#991b1b;">${s.reprovM}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#991b1b;">${s.reprovF}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;font-weight:bold;color:#991b1b;">${s.reprovT}</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#999;">0</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#999;">0</td>
          <td style="border:1px solid #ddd;text-align:center;font-size:8px;color:#999;">0</td>`;
        rowAprovT += s.aprovT;
        rowReprovT += s.reprovT;
        rowDamteT += s.damteT;
        totals.aprovM += s.aprovM; totals.aprovF += s.aprovF; totals.aprovT += s.aprovT;
        totals.reprovM += s.reprovM; totals.reprovF += s.reprovF; totals.reprovT += s.reprovT;
      }

      const totalEval = rowAprovT + rowReprovT;
      const aptosPct = totalEval > 0 ? Math.round((rowAprovT / totalEval) * 100) : 0;
      const nAptosPct = totalEval > 0 ? 100 - aptosPct : 0;

      return `<tr>
        <td style="border:1px solid #ccc;padding:2px 5px;font-size:8.5px;font-weight:bold;">${cr.label}</td>
        ${rowCells}
        <td style="border:1px solid #ccc;text-align:center;font-size:8.5px;font-weight:bold;color:#065f46;">${rowAprovT}</td>
        <td style="border:1px solid #ccc;text-align:center;font-size:8.5px;font-weight:bold;color:#991b1b;">${rowReprovT}</td>
        <td style="border:1px solid #ccc;text-align:center;font-size:8.5px;color:#999;">0</td>
      </tr>`;
    });

    // Total row
    const totalEvalGeral = totals.aprovT + totals.reprovT;
    const aptosPctGeral = totalEvalGeral > 0 ? Math.round((totals.aprovT / totalEvalGeral) * 100) : 0;
    const nAptosPctGeral = totalEvalGeral > 0 ? 100 - aptosPctGeral : 0;

    let totalRowCells = '';
    for (const cls of existingClasses) {
      const clsTurmaIds = activeTurmas.filter(t => t.classe.startsWith(cls)).map(t => t.id);
      const s = groupStats(clsTurmaIds);
      totalRowCells += `
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#065f46;">${s.aprovM}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#065f46;">${s.aprovF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#065f46;">${s.aprovT}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#991b1b;">${s.reprovM}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#991b1b;">${s.reprovF}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;font-weight:bold;color:#991b1b;">${s.reprovT}</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;color:#999;">0</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;color:#999;">0</td>
        <td style="border:1px solid #999;text-align:center;font-size:8px;color:#999;">0</td>`;
    }

    const triLabel3 = trimestre === 1 ? 'I' : trimestre === 2 ? 'II' : 'III';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Mapa de Aproveitamento por Curso e Classe — ${triLabel3}º Trimestre ${anoLetivo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; padding: 10px 14px; }
    .header { text-align: center; margin-bottom: 8px; }
    .header p { margin: 1px 0; font-size: 9.5px; font-weight: bold; text-transform: uppercase; }
    .header p.inst { text-decoration: underline; font-size: 10px; }
    .titulo { font-size: 9px; font-weight: bold; margin-bottom: 2px; }
    .escola-label { font-size: 9px; margin-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
    .sig-row { display: flex; justify-content: flex-end; margin-top: 24px; }
    .sig-block { text-align: center; }
    .sig-label { font-size: 9.5px; font-weight: bold; margin-bottom: 26px; text-transform: uppercase; }
    .sig-line { width: 200px; border-top: 1px solid #000; margin: 0 auto 3px; }
    .sig-name { font-size: 9px; font-style: italic; }
    .date { font-size: 9px; margin: 10px 0 5px; font-weight: bold; }
    .footnote { font-size: 8px; color: #555; margin-top: 4px; }
    @media print { @page { size: A3 landscape; margin: 6mm 10mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p class="inst">${escola.toUpperCase()}</p>
  </div>

  <p class="titulo">Mapa de Aproveitamento Escolar dos Alunos Referente ao ${triLabel3}º Trimestre do Ano Lectivo ${anoLetivoSlash3} (${existingClasses.join(', ')} Classes) — Regime Diurno</p>
  <p class="escola-label">Nome da Escola: <strong>${escola}</strong></p>

  <table>
    <thead>
      <tr>
        <th rowspan="3" style="border:1px solid #000;padding:2px 4px;background:#2d2d2d;color:#fff;font-size:8px;text-align:center;vertical-align:middle;min-width:120px;">Nome do Curso</th>
        ${classColHeaders}
        <th colspan="3" rowspan="2" style="border:1px solid #000;background:#555;color:#fff;font-size:8px;text-align:center;vertical-align:middle;">TOTAL GERAL</th>
      </tr>
      <tr>
        ${classSubHeaders}
      </tr>
      <tr>
        ${mfRow}
        <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;color:#065f46;">Aptos MF</th>
        <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;color:#991b1b;">N/Apt MF</th>
        <th style="border:1px solid #ccc;font-size:7px;padding:1px 2px;color:#777;">D-AM-T-E MF</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows.join('\n')}
      <tr style="background:#c8c8c8;font-weight:bold;">
        <td style="border:1px solid #888;padding:2px 5px;font-size:8.5px;">Total</td>
        ${totalRowCells}
        <td style="border:1px solid #888;text-align:center;font-size:8.5px;color:#065f46;">${totals.aprovT}</td>
        <td style="border:1px solid #888;text-align:center;font-size:8.5px;color:#991b1b;">${totals.reprovT}</td>
        <td style="border:1px solid #888;text-align:center;font-size:8.5px;color:#999;">0</td>
      </tr>
    </tbody>
  </table>

  <p class="footnote">D: Desistente; AM: Anulação de Matrícula; T: Transferido; E: Excluído</p>

  <div class="date">${dataLocal}.</div>

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-label">O Subdirector Pedagógico</div>
      <div class="sig-line"></div>
      <div class="sig-name">${subdirector}</div>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── Certificado de Habilitações — I Ciclo (7ª, 8ª, 9ª) HTML Builder ────────

  function buildCertificadoHabilitacoesICicloHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const escola = config.nomeEscola || 'Complexo Escolar';
    const director = directorGeral;
    const now = new Date();
    const nome = `${aluno.nome} ${aluno.apelido}`;
    const diaNasc  = aluno.dataNascimento ? new Date(aluno.dataNascimento).getDate()           : '__';
    const mesNasc  = aluno.dataNascimento ? MESES[new Date(aluno.dataNascimento).getMonth()]   : '__________';
    const anoNasc  = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear()        : '____';
    const municipio  = aluno.municipio || '______________';
    const provincia  = aluno.provincia || '______________';
    const encarregado = aluno.nomeEncarregado || '________________________';

    // ── Group notas by class (7ª, 8ª, 9ª) ─────────────────────────────────
    const CLASSES_ALVO = ['7ª', '8ª', '9ª'];
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);

    const gradesByClasse: Record<string, Map<string, number>> = {};
    for (const c of CLASSES_ALVO) gradesByClasse[c] = new Map();

    for (const nota of alunoNotas) {
      const t = turmas.find(tr => tr.id === nota.turmaId);
      if (!t) continue;
      const classeKey = CLASSES_ALVO.find(c => {
        const num = c.replace('ª', '');
        return t.classe?.startsWith(num) || t.classe === c;
      });
      if (!classeKey) continue;
      const dk = nota.disciplina.toLowerCase().trim();
      const prev = gradesByClasse[classeKey].get(dk);
      if (prev === undefined || nota.nf > prev) gradesByClasse[classeKey].set(dk, nota.nf);
    }

    // Collect unique disciplines (preserve display name from first occurrence)
    const discDisplayMap = new Map<string, string>();
    for (const nota of alunoNotas) {
      const key = nota.disciplina.toLowerCase().trim();
      if (!discDisplayMap.has(key)) discDisplayMap.set(key, nota.disciplina.trim());
    }
    const allDiscs = Array.from(discDisplayMap.entries());

    // Determine ano lectivo from 9ª class turma
    const turmas9 = turmas.filter(t => {
      const c = t.classe || '';
      return c.startsWith('9') || c === '9ª';
    });
    const alunoTurmaIds = new Set(alunoNotas.map(n => n.turmaId));
    const relevantTurma9 = turmas9.find(t => alunoTurmaIds.has(t.id));
    const anoLetivo = relevantTurma9?.anoLetivo || String(now.getFullYear());

    // ── Build table rows ──────────────────────────────────────────────────
    function getGrade(classeKey: string, discKey: string): number | null {
      return gradesByClasse[classeKey]?.get(discKey) ?? null;
    }

    let totalMedia = 0;
    let countMedia = 0;

    const rows = allDiscs.map(([key, display]) => {
      const grades = CLASSES_ALVO.map(c => getGrade(c, key));
      const validGrades = grades.filter(g => g !== null) as number[];
      const mediaFinal = validGrades.length > 0
        ? Math.round(validGrades.reduce((a, b) => a + b, 0) / validGrades.length)
        : null;
      if (mediaFinal !== null) { totalMedia += mediaFinal; countMedia++; }
      const cols = grades.map(g =>
        g !== null
          ? `<td style="text-align:center;font-weight:bold;">${Math.round(g)}</td>`
          : `<td style="text-align:center;color:#aaa;font-size:9px;">—</td>`
      ).join('');
      const mediaStr  = mediaFinal !== null ? String(mediaFinal)    : '—';
      const extensoStr = mediaFinal !== null ? numExtenso(mediaFinal) + ' Valores' : '—';
      return `<tr>
        <td style="padding:3px 8px;">${display}</td>
        ${cols}
        <td style="text-align:center;font-weight:bold;">${mediaStr}</td>
        <td style="padding:3px 8px;">${extensoStr}</td>
      </tr>`;
    }).join('');

    const mediaGeral        = countMedia > 0 ? Math.round(totalMedia / countMedia) : null;
    const mediaGeralStr     = mediaGeral !== null ? String(mediaGeral)        : '___';
    const mediaGeralExtenso = mediaGeral !== null ? numExtenso(mediaGeral)    : '______';
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado de Habilitações — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12px; color: #000; padding: 24px 40px; line-height: 1.7; }

    .header { text-align: center; margin-bottom: 14px; }
    .header p { margin: 1px 0; }
    .rep     { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .min     { font-size: 12px; font-weight: bold; text-transform: uppercase; }
    .escola  { font-size: 12px; font-style: italic; font-weight: bold; }
    .ensino  { font-size: 12px; font-weight: bold; text-transform: uppercase; }

    .titulo {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin: 14px 0 16px;
    }

    .body-text { text-align: justify; font-size: 12px; line-height: 1.85; margin-bottom: 16px; }
    .body-text p { margin-bottom: 10px; }
    .student-name { color: #c00; font-weight: bold; }
    .bold { font-weight: bold; }
    .bold-italic { font-weight: bold; font-style: italic; }
    .underline { text-decoration: underline; }

    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 11px; }
    table th {
      border: 1px solid #000;
      padding: 5px 8px;
      background: #fff;
      font-weight: bold;
      text-align: center;
    }
    table th:first-child { text-align: left; }
    table td { border: 1px solid #666; padding: 3px 6px; }
    .total-row td { background: #f2f2f2; font-weight: bold; border-top: 2px solid #000; }

    .legal { text-align: justify; font-size: 11.5px; line-height: 1.75; margin-top: 14px; }
    .date-line { text-align: center; margin: 20px 0 10px; font-size: 12px; }

    .sig-row { display: flex; justify-content: space-between; margin-top: 14px; }
    .sig-block { text-align: center; min-width: 200px; }
    .sig-label { font-size: 12px; font-weight: bold; margin-bottom: 34px; }
    .sig-line  { width: 180px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .sig-name  { font-size: 11.5px; font-weight: bold; }

    .mod-ref { font-size: 10px; margin-top: 24px; font-weight: bold; }

    @media print { @page { size: A4; margin: 12mm 18mm; } body { padding: 0; } }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <img src="/icons/icon-192.png" alt="Armas Angola" style="height:64px;width:64px;object-fit:contain;margin-bottom:6px;" onerror="this.style.display='none'" />
    <p class="rep">República de Angola</p>
    <p class="min">Ministério da Educação</p>
    <p class="escola">${escola}</p>
    <p class="ensino">Ensino Geral</p>
  </div>

  <!-- TITLE -->
  <div class="titulo">Certificado de Habilitações</div>

  <!-- BODY TEXT -->
  <div class="body-text">
    <p>
      <span class="bold">${director}</span>, Director (a) do
      <span class="bold-italic">${escola}</span>
      em <span class="bold">${municipio}</span>
      criado sob o <span class="bold">Decreto Executivo</span>
      <span class="bold">____/____</span> de ___ de ______________________.
      Certifica que: <span class="student-name">${nome}</span>,
      filho (a) de <span class="bold">${encarregado}</span>,
      e de <span class="bold">________________________________</span>,
      nascido (a) aos <span class="bold">${diaNasc}</span> de
      <span class="bold">${mesNasc}</span> de
      <span class="bold">${anoNasc}</span>,
      natural de <span class="bold">______________</span>,
      Município de <span class="bold">${municipio}</span>,
      Província de <span class="bold">${provincia}</span>,
      portador (a) do BI nº <span class="bold">________________________</span>,
      emitido aos <span class="bold">__</span> de <span class="bold">______________</span>
      de <span class="bold">______</span>,
      passado pelo Arquivo de Identificação Nacional de <span class="bold">${provincia}</span>.
    </p>
    <p>
      Concluiu no Ano Lectivo de <span class="bold">${anoLetivo}</span>
      o <span class="bold">I CICLO DO ENSINO SECUNDÁRIO GERAL</span>,
      conforme o disposto na alínea b) do artigo 109º da LBEE 17/16 de 7 de Outubro,
      com a Média Final de (<span class="bold underline">${mediaGeralStr}</span>)
      <span class="bold underline">${mediaGeralExtenso} Valores</span>
      obtida nas seguintes classificações por ciclos de aprendizagem:
    </p>
  </div>

  <!-- GRADES TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:36%;text-align:left;">Disciplina</th>
        <th style="width:10%;">7ª Classe</th>
        <th style="width:10%;">8ª Classe</th>
        <th style="width:10%;">9ª Classe</th>
        <th style="width:14%;">Media Final</th>
        <th style="width:20%;">Média por extenso</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right;padding:4px 8px;">Média Geral Final:</td>
        <td style="text-align:center;">${mediaGeralStr}</td>
        <td style="padding:4px 8px;">${mediaGeralExtenso} Valores</td>
      </tr>
    </tbody>
  </table>

  <!-- LEGAL TEXT -->
  <div class="legal">
    Por efeitos legais, lhe é passado o presente <strong>CERTIFICADO</strong>,
    que consta no livro de termos nº <strong>____</strong>,
    folha <strong>____</strong>,
    assinado por mim e autenticado com carimbo a óleo em uso neste Estabelecimento de Ensino.
  </div>

  <!-- DATE & SIGNATURES -->
  <div class="date-line">${municipio} aos ${dataActual}</div>

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}

  <div class="mod-ref">Mod. 01/MED</div>

</body>
</html>`;
  }

  // ─── Certificado II Ciclo HTML Builder (10ª, 11ª, 12ª) ───────────────────

  function buildCertificadoIiCicloHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const escola = config.nomeEscola || 'Liceu Público';
    const director = directorGeral;
    const now = new Date();
    const dataActual = `${escola.toUpperCase()}, ${now.getDate()} DE ${MESES[now.getMonth()].toUpperCase()} DE ${now.getFullYear()}`;
    const nome = `${aluno.nome} ${aluno.apelido}`;
    const diaNasc = aluno.dataNascimento ? String(new Date(aluno.dataNascimento).getDate()).padStart(2,'0') : '__';
    const mesNascNum = aluno.dataNascimento ? String(new Date(aluno.dataNascimento).getMonth()+1).padStart(2,'0') : '__';
    const anoNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear() : '____';
    const municipio = aluno.municipio || '______________';
    const provincia = aluno.provincia || '______________';
    const encarregado = aluno.nomeEncarregado || '____________________';

    // ── Gather grades by class year ──────────────────────────────────────────
    const CLASSES_ALVO = ['10ª', '11ª', '12ª'];
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);

    // Map classe → Map<disciplina_lower, nf>
    const gradesByClasse: Record<string, Map<string, number>> = {};
    for (const classe of CLASSES_ALVO) gradesByClasse[classe] = new Map();

    for (const nota of alunoNotas) {
      const t = turmas.find(tr => tr.id === nota.turmaId);
      if (!t) continue;
      const classeKey = CLASSES_ALVO.find(c => t.classe?.startsWith(c.replace('ª','')) || t.classe === c);
      if (!classeKey) continue;
      const discKey = nota.disciplina.toLowerCase().trim();
      const existing = gradesByClasse[classeKey].get(discKey);
      if (existing === undefined || nota.nf > existing) {
        gradesByClasse[classeKey].set(discKey, nota.nf);
      }
    }

    // Collect all unique disciplines (preserving display name from first occurrence)
    const discDisplayMap = new Map<string, string>();
    for (const nota of alunoNotas) {
      const key = nota.disciplina.toLowerCase().trim();
      if (!discDisplayMap.has(key)) discDisplayMap.set(key, nota.disciplina.trim());
    }
    const allDiscs = Array.from(discDisplayMap.entries()); // [key, displayName]

    // ── Determine ano lectivo from 12ª turma (latest) ──────────────────────
    const turmasDo12 = turmas.filter(t => {
      const c = t.classe || '';
      return c.startsWith('12') || c === '12ª';
    });
    const alunoTurmaIds = new Set(alunoNotas.map(n => n.turmaId));
    const relevantTurma12 = turmasDo12.find(t => alunoTurmaIds.has(t.id));
    const anoLetivo = relevantTurma12?.anoLetivo || String(now.getFullYear());

    // ── Build table rows ─────────────────────────────────────────────────────
    function getGrade(classeKey: string, discKey: string): number | null {
      return gradesByClasse[classeKey]?.get(discKey) ?? null;
    }

    let totalMedia = 0;
    let countMedia = 0;

    const rows = allDiscs.map(([key, display]) => {
      const grades = CLASSES_ALVO.map(c => getGrade(c, key));
      const validGrades = grades.filter(g => g !== null) as number[];
      const mediaFinal = validGrades.length > 0
        ? Math.round(validGrades.reduce((a,b) => a+b, 0) / validGrades.length)
        : null;
      if (mediaFinal !== null) { totalMedia += mediaFinal; countMedia++; }
      const cols = grades.map(g =>
        g !== null
          ? `<td style="text-align:center;color:#1a5276;font-weight:bold;">${Math.round(g)}</td>`
          : `<td style="text-align:center;color:#aaa;font-size:10px;">====//====</td>`
      ).join('');
      const mediaStr = mediaFinal !== null ? String(mediaFinal) : '---';
      const extensoStr = mediaFinal !== null ? numExtenso(mediaFinal) : '---';
      return `<tr>
        <td style="padding:4px 8px;">${display}</td>
        ${cols}
        <td style="text-align:center;color:#1a5276;font-weight:bold;">${mediaStr}</td>
        <td style="text-align:center;color:#555;font-style:italic;">${extensoStr}</td>
      </tr>`;
    }).join('');

    const mediaGeral = countMedia > 0 ? Math.round(totalMedia / countMedia) : null;
    const mediaGeralStr = mediaGeral !== null ? String(mediaGeral) : '___';
    const mediaGeralExtenso = mediaGeral !== null ? numExtenso(mediaGeral) : '______';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado II Ciclo — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; padding: 20px 36px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 10px; }
    .header p { margin: 1px 0; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; }
    .titulo { text-align: center; font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 4px; margin: 14px 0 12px; }
    .body { text-align: justify; margin-bottom: 12px; font-size: 11.5px; line-height: 1.8; }
    .nome-aluno { color: #c00; font-weight: bold; text-decoration: underline; }
    .media-final-text { color: #000; font-weight: bold; text-decoration: underline; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 11px; }
    table th { border: 1px solid #000; padding: 5px 6px; text-align: center; background: #f2f2f2; font-weight: bold; }
    table th:first-child { text-align: left; }
    table td { border: 1px solid #999; padding: 4px 6px; }
    .total-row td { background: #e8e8e8; font-weight: bold; border-top: 2px solid #000; }
    .legal { font-size: 11px; margin-top: 14px; text-align: justify; line-height: 1.75; }
    .date-footer { font-weight: bold; margin: 16px 0 20px; font-size: 11px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 10px; }
    .sig-block { text-align: center; min-width: 180px; }
    .sig-label { font-size: 11px; font-style: italic; margin-bottom: 30px; font-weight: bold; }
    .sig-line { width: 180px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .sig-name { font-size: 11px; font-weight: bold; }
    .conferiu { font-size: 10px; font-style: italic; margin-top: 20px; }
    .decreto { font-size: 10px; font-weight: bold; margin-top: 6px; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
    @media print { @page { size: A4; margin: 10mm 16mm; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <p>República de Angola</p>
    <p>Ministério da Educação</p>
    <p>Governo da Província de ${provincia}</p>
    <p>${escola}</p>
  </div>

  <div class="titulo">Certificado</div>

  <div class="body">
    <strong>${director}</strong>, Director do ${escola},
    criado sob o Decreto Executivo nº _______ — Iª Série nº ___ de __ de ____________,
    certifica que <span class="nome-aluno">${nome}</span>,
    filho de <strong>${encarregado}</strong>
    e de <strong>____________________</strong>,
    nascido aos ${diaNasc}/${mesNascNum}/${anoNasc},
    natural de ______________,
    Município de <strong>${municipio}</strong>,
    Província de <strong>${provincia}</strong>,
    portador do B.I nº ____________________,
    passado pelo arquivo de Identificação de ${provincia}, aos __ / __ / ______,
    concluiu no Ano Lectivo de <strong>${anoLetivo}</strong>
    o Curso do II Ciclo do Ensino Secundário Geral,
    na área de <strong>____________________________</strong>,
    conforme o disposto na alínea a) do artigo da LBSEE 17/16 de 07 de Outubro,
    com a Média Final de <span class="media-final-text">${mediaGeralStr} (${mediaGeralExtenso}) Valores</span>
    obtida nas seguintes classificações por disciplinas:
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:38%;text-align:left;">Disciplina</th>
        <th style="width:10%;">10ª Classe</th>
        <th style="width:10%;">11ª Classe</th>
        <th style="width:10%;">12ª Classe</th>
        <th style="width:16%;">Média Final</th>
        <th style="width:16%;">Média por Extenso</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right;padding:5px 8px;">Média Geral Final:</td>
        <td style="text-align:center;">${mediaGeralStr}</td>
        <td style="text-align:center;font-style:italic;">${mediaGeralExtenso}</td>
      </tr>
    </tbody>
  </table>

  <div class="legal">
    Para efeitos legais lhe é passado o presente <strong>CERTIFICADO</strong>,
    que consta no livro de registos nº ________,
    assinado por mim e autenticado com carimbo a óleo branco em uso neste Estabelecimento de Ensino.
  </div>

  <div class="date-footer">${dataActual}.</div>

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}

  <div class="conferiu">Conferiu: ____________________</div>
  <div class="decreto">Reconhecido pelo Ministério da Educação de Angola pelo decreto executivo conjunto nº _______ — Iª Série nº ___ de __ de ____________.</div>
</body>
</html>`;
  }

  // ─── Certificado ITAQ HTML Builder ────────────────────────────────────────

  function buildCertificadoItaqHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const escola = config.nomeEscola || 'Instituto Técnico';
    const director = directorGeral;
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

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}
</body>
</html>`;
  }

  // ─── Certificado de Habilitações Literárias — IIº Ciclo Pedagógico ──────────

  function buildCertificadoHabilitacoesLiterariasHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const escola = config.nomeEscola || 'Escola';
    const director = directorGeral;
    const now = new Date();
    const dataActual = `${now.getDate()} de ${MESES[now.getMonth()]} de ${now.getFullYear()}`;

    const nome = `${aluno.nome} ${aluno.apelido}`;
    const diaNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getDate() : '__';
    const mesNasc = aluno.dataNascimento ? MESES[new Date(aluno.dataNascimento).getMonth()] : '__________';
    const anoNasc = aluno.dataNascimento ? new Date(aluno.dataNascimento).getFullYear() : '____';
    const municipio = aluno.municipio || '______________';
    const provincia = aluno.provincia || '______________';
    const encarregado = aluno.nomeEncarregado || '________________________';

    const alunoNotas = notas.filter(n => n.alunoId === alunoId);

    function getGradesByClasse(classePrefix: string): Map<string, number> {
      const map = new Map<string, number>();
      const classTurmaIds = new Set(
        turmas.filter(t => (t.classe || '').trim().startsWith(classePrefix)).map(t => t.id)
      );
      for (const n of alunoNotas) {
        if (classTurmaIds.has(n.turmaId)) {
          map.set(n.disciplina.toLowerCase().trim(), n.nf);
        }
      }
      return map;
    }

    function getTurmaInfo(classePrefix: string): { nome: string; anoLetivo: string } {
      const classTurmas = turmas.filter(t => (t.classe || '').trim().startsWith(classePrefix));
      for (const t of classTurmas) {
        if (alunoNotas.some(n => n.turmaId === t.id)) {
          return { nome: t.nome, anoLetivo: t.anoLetivo };
        }
      }
      return { nome: '—', anoLetivo: '—' };
    }

    const g10 = getGradesByClasse('10');
    const g11 = getGradesByClasse('11');
    const g12 = getGradesByClasse('12');
    const g13 = getGradesByClasse('13');

    const t10 = getTurmaInfo('10');
    const t11 = getTurmaInfo('11');
    const t12 = getTurmaInfo('12');
    const t13 = getTurmaInfo('13');

    function resolveGrade(grades: Map<string, number>, ...searches: string[]): string {
      for (const s of searches) {
        const sl = s.toLowerCase();
        for (const [k, v] of grades) {
          if (k.includes(sl) || sl.includes(k)) return String(Math.round(v));
        }
      }
      return '—';
    }

    function classAvgDisplay(grades: Map<string, number>): { val: number | null; str: string; extenso: string } {
      if (grades.size === 0) return { val: null, str: '—', extenso: '—' };
      const vals = [...grades.values()];
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      return { val: avg, str: String(avg), extenso: numExtenso(avg) };
    }

    const ca10 = classAvgDisplay(g10);
    const ca11 = classAvgDisplay(g11);
    const ca12 = classAvgDisplay(g12);
    const ca13 = classAvgDisplay(g13);

    const anoLetivo = t13.anoLetivo !== '—' ? t13.anoLetivo
      : t12.anoLetivo !== '—' ? t12.anoLetivo
      : t11.anoLetivo !== '—' ? t11.anoLetivo
      : String(now.getFullYear());

    const mediaFinal = ca13.val ?? ca12.val ?? ca11.val ?? null;
    const mediaFinalDisplay = mediaFinal !== null ? String(mediaFinal) : '—';
    const mediaFinalExtenso = mediaFinal !== null ? numExtenso(mediaFinal) : '________';

    function dRow(label: string, grade: string): string {
      return `<tr><td class="disc-name">${label}</td><td class="disc-grade">${grade}</td></tr>`;
    }
    function gHeader(label: string): string {
      return `<tr><td colspan="2" class="group-hdr">${label}</td></tr>`;
    }

    const table10 = `<table class="class-table">
      <tr><td colspan="2" class="class-head">10ª CLASSE</td></tr>
      <tr><td colspan="2" class="turma-info">TURMA: ${t10.nome}</td></tr>
      <tr><td colspan="2" class="turma-info">ANO LECTIVO: ${t10.anoLetivo}</td></tr>
      ${gHeader('Formação Geral')}
      ${dRow('Francês', resolveGrade(g10, 'francês', 'frances'))}
      ${dRow('Inglês', resolveGrade(g10, 'inglês', 'ingles'))}
      ${dRow('História', resolveGrade(g10, 'história', 'historia'))}
      ${dRow('Matemática', resolveGrade(g10, 'matemática', 'matematica'))}
      ${dRow('Informática', resolveGrade(g10, 'informática', 'informatica'))}
      ${dRow('Empreend.', resolveGrade(g10, 'empreend'))}
      ${dRow('Ed.Física', resolveGrade(g10, 'ed.física', 'educação física', 'educacao fisica'))}
      ${gHeader('Formação Educacional')}
      ${dRow('Psicologia', resolveGrade(g10, 'psicologia'))}
      ${gHeader('Formação Específica')}
      ${dRow('Língua Portuguesa', resolveGrade(g10, 'língua portuguesa', 'lingua portuguesa'))}
      ${dRow('Deontologia', resolveGrade(g10, 'deontologia'))}
      ${dRow('Literactura', resolveGrade(g10, 'literactura', 'literatura'))}
    </table>`;

    const table11 = `<table class="class-table">
      <tr><td colspan="2" class="class-head">11ª CLASSE</td></tr>
      <tr><td colspan="2" class="turma-info">TURMA: ${t11.nome}</td></tr>
      <tr><td colspan="2" class="turma-info">ANO LECTIVO: ${t11.anoLetivo}</td></tr>
      ${gHeader('Formação Geral')}
      ${dRow('Francês', resolveGrade(g11, 'francês', 'frances'))}
      ${dRow('Inglês', resolveGrade(g11, 'inglês', 'ingles'))}
      ${dRow('Ed.Física', resolveGrade(g11, 'ed.física', 'educação física', 'educacao fisica'))}
      ${gHeader('Formação Educacional')}
      ${dRow('A.S.E.A.G.E', resolveGrade(g11, 'a.s.e.a.g.e', 'aseage'))}
      ${dRow('T.E.D.C', resolveGrade(g11, 't.e.d.c', 'tedc'))}
      ${gHeader('Formação Específica')}
      ${dRow('Língua Portuguesa', resolveGrade(g11, 'língua portuguesa', 'lingua portuguesa'))}
      ${dRow('Met. L. Portuguesa', resolveGrade(g11, 'met. l. portuguesa', 'metodologia lingua'))}
      ${dRow('PSEP L. Portuguesa', resolveGrade(g11, 'psep l. portuguesa', 'psep língua'))}
      ${dRow('Met. E.M.C', resolveGrade(g11, 'met. e.m.c', 'metodologia emc', 'met.e.m.c'))}
      ${dRow('PSEP E.M.C', resolveGrade(g11, 'psep e.m.c', 'psep emc'))}
      ${dRow('Deontologia', resolveGrade(g11, 'deontologia'))}
      ${dRow('Literactura', resolveGrade(g11, 'literactura', 'literatura'))}
    </table>`;

    const table12 = `<table class="class-table">
      <tr><td colspan="2" class="class-head">12ª CLASSE</td></tr>
      <tr><td colspan="2" class="turma-info">TURMA: ${t12.nome}</td></tr>
      <tr><td colspan="2" class="turma-info">ANO LECTIVO: ${t12.anoLetivo}</td></tr>
      ${gHeader('Formação Geral')}
      ${dRow('Filosofia', resolveGrade(g12, 'filosofia'))}
      ${dRow('Empreend.', resolveGrade(g12, 'empreend'))}
      ${dRow('Ed.Física', resolveGrade(g12, 'ed.física', 'educação física', 'educacao fisica'))}
      ${gHeader('Formação Educacional')}
      ${dRow('H.\\ Saúde escolar', resolveGrade(g12, 'saúde escolar', 'saude escolar', 'higiene'))}
      ${dRow('Ética', resolveGrade(g12, 'ética', 'etica'))}
      ${gHeader('Formação Específica')}
      ${dRow('Língua Portuguesa', resolveGrade(g12, 'língua portuguesa', 'lingua portuguesa'))}
      ${dRow('Deontologia', resolveGrade(g12, 'deontologia'))}
      ${dRow('Met. L. Portuguesa', resolveGrade(g12, 'met. l. portuguesa', 'metodologia lingua'))}
      ${dRow('PSEP L. Portuguesa', resolveGrade(g12, 'psep l. portuguesa', 'psep língua'))}
      ${dRow('Met. E.M.C', resolveGrade(g12, 'met. e.m.c', 'metodologia emc'))}
      ${dRow('PSEP DE E.M.C', resolveGrade(g12, 'psep de e.m.c', 'psep de emc'))}
    </table>`;

    const table13 = `<table class="class-table">
      <tr><td colspan="2" class="class-head">13ª CLASSE</td></tr>
      <tr><td colspan="2" class="turma-info">TURMA: ${t13.nome}</td></tr>
      <tr><td colspan="2" class="turma-info">ANO LECTIVO: ${t13.anoLetivo}</td></tr>
      ${gHeader('Formação Específica')}
      ${dRow('MÉDIA ANUAL', resolveGrade(g13, 'média anual', 'media anual'))}
      ${dRow('P.A. PROFISSIONAL', resolveGrade(g13, 'p.a. profissional', 'aptidão profissional', 'pa profissional'))}
      ${dRow('N. EST. CURRICULAR', resolveGrade(g13, 'n. est. curricular', 'estágio curricular'))}
      <tr><td colspan="2" class="group-hdr" style="background:#1a2540;color:#fff;font-size:9px;text-align:center;padding:4px;">MÉDIAS GERAIS POR CLASSES</td></tr>
      <tr><td colspan="2" class="group-hdr" style="font-size:8.5px;background:#e8e8e8;">MÉDIAS GERAIS POR CLASSES</td></tr>
      <tr style="background:#f9f9f9;"><td class="disc-name" style="font-size:9px;">10ª CLASSE</td><td class="disc-grade">${ca10.str}</td></tr>
      <tr><td class="disc-name" style="font-size:9px;">11ª CLASSE</td><td class="disc-grade">${ca11.str}</td></tr>
      <tr style="background:#f9f9f9;"><td class="disc-name" style="font-size:9px;">12ª CLASSE</td><td class="disc-grade">${ca12.str}</td></tr>
      <tr><td class="disc-name" style="font-size:9px;">13ª CLASSE</td><td class="disc-grade">${ca13.str}</td></tr>
      <tr><td colspan="2" style="font-size:8.5px;padding:4px;text-align:justify;line-height:1.5;border-top:1px solid #aaa;">
        Para efeitos legais lhe é passado o presente <strong>CERTIFICADO</strong>, que consta no livro de registo nº <strong>___</strong>, folha <strong>___</strong>, assinado por mim e autenticado com o selo branco em uso neste estabelecimento de ensino.
      </td></tr>
    </table>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado de Habilitações Literárias — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 11px; color: #000; background: #fff; }
    .page1 {
      padding: 20px 28px;
      border: 8px double #8B6914;
      min-height: 260mm;
      page-break-after: always;
      position: relative;
    }
    .coat-arms { text-align: center; margin-bottom: 6px; }
    .header-block { text-align: center; margin-bottom: 14px; line-height: 1.6; }
    .rep-angola { font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
    .gov-prov { font-size: 10.5px; font-weight: bold; text-transform: uppercase; }
    .escola-nome { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .ensino-nivel { font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .decorative-title {
      text-align: center;
      font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
      font-style: italic;
      font-size: 26px;
      color: #8B0000;
      margin: 14px 0 18px;
      letter-spacing: 1px;
    }
    .decorative-title .initial { font-size: 36px; font-weight: bold; }
    .body-text { text-align: justify; line-height: 1.85; font-size: 11.5px; }
    .body-text p { margin-bottom: 12px; }
    .student-name { color: #8B0000; font-weight: bold; }
    .bold { font-weight: bold; }
    .page2 { padding: 14px 18px; }
    .grades-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #555; }
    .class-table { width: 100%; border-collapse: collapse; border-right: 1px solid #555; }
    .class-table:last-child { border-right: none; }
    .class-head { background: #1a2540; color: #fff; font-size: 11px; font-weight: bold; text-align: center; padding: 5px 4px; border-bottom: 1px solid #555; }
    .turma-info { font-size: 9px; padding: 2px 4px; background: #f0f0f0; border-bottom: 1px solid #ddd; font-weight: bold; }
    .group-hdr { font-weight: bold; font-size: 9.5px; background: #ddd; padding: 3px 4px; border-top: 1px solid #aaa; border-bottom: 1px solid #ccc; }
    .disc-name { font-size: 9.5px; padding: 2px 4px; border-bottom: 1px solid #eee; }
    .disc-grade { font-size: 9.5px; font-weight: bold; text-align: center; padding: 2px 4px; border-bottom: 1px solid #eee; width: 22px; border-left: 1px solid #ccc; color: #1a2540; }
    .legal-text { margin-top: 12px; font-size: 10px; text-align: justify; line-height: 1.7; }
    .date-footer { margin-top: 10px; font-size: 10px; font-weight: bold; text-transform: uppercase; line-height: 1.7; }
    .sig-section { display: flex; justify-content: space-between; margin-top: 12px; }
    .sig-block { text-align: center; min-width: 150px; }
    .sig-label { font-size: 10px; font-weight: bold; }
    .sig-line { width: 140px; border-top: 1px solid #000; margin: 28px auto 4px; }
    .sig-name { font-size: 10px; font-style: italic; }
    @media print {
      @page { size: A4; margin: 12mm 15mm; }
      body { margin: 0; }
      .page1 { page-break-after: always; }
    }
  </style>
</head>
<body>

  <!-- PAGE 1: Header and introduction -->
  <div class="page1">
    <div class="coat-arms">
      <img src="/icons/icon-192.png" alt="Brasão" style="height:56px;width:56px;object-fit:contain;" onerror="this.style.display='none'" />
    </div>
    <div class="header-block">
      <p class="rep-angola">República de Angola</p>
      <p class="gov-prov">Governo Provincial de ${provincia}</p>
      <p class="escola-nome">${escola}</p>
      <p class="ensino-nivel">Ensino Secundário Pedagógico</p>
    </div>

    <div class="decorative-title">
      <span class="initial">C</span>ertificado de <span class="initial">H</span>abilitações <span class="initial">L</span>iterárias
    </div>

    <div class="body-text">
      <p>
        <span class="bold">${director}</span>, Director(a) da ${escola}, criada sob o
        Decreto Executivo Conjunto nº <span class="bold">____/____</span> de ___ de ____________,
        certifica que, <span class="student-name">${nome}</span>,
        filho(a) de <span class="bold">${encarregado}</span>
        e de <span class="bold">________________________________</span>,
        nascido(a) aos <span class="bold">${diaNasc}</span> de
        <span class="bold">${mesNasc}</span> de
        <span class="bold">${anoNasc}</span>,
        natural do <span class="bold">${municipio}</span>,
        Município do <span class="bold">${municipio}</span>,
        Província do <span class="bold">${provincia}</span>,
        titular do B.I nº <span class="bold">________________________________</span>,
        emitido aos <span class="bold">___</span> de <span class="bold">_______________</span>
        de <span class="bold">______</span>,
        pelo Departamento de Identificação Civil e Criminal do <span class="bold">${provincia}</span>.
      </p>
      <p>
        Concluiu no ano lectivo <span class="bold">${anoLetivo}</span>,
        o Curso do <span class="bold">II CICLO DO ENSINO SECUNDÁRIO PEDAGÓGICO</span>,
        na especialidade de <span class="bold" style="text-decoration:underline;font-style:italic;">________________________________</span>,
        o disposto na alínea f) do artigo 109º da LBSEE 17/16 de 7 de Outubro,
        com a Média Curricular de <span class="bold">${mediaFinalDisplay}</span>
        (<span class="bold">${mediaFinalExtenso} valores</span>)
        obtida nas seguintes classificações por disciplinas:
      </p>
    </div>
  </div>

  <!-- PAGE 2: Grades table -->
  <div class="page2">
    <div class="grades-section">
      ${table10}
      ${table11}
      ${table12}
      ${table13}
    </div>

    <p class="date-footer">
      ${escola.toUpperCase()} em ${municipio.toUpperCase()}, ${dataActual.toUpperCase()}.
    </p>

    ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}

    <p style="text-align:center;font-size:10px;color:#c00;margin-top:14px;font-style:italic;">
      Só é válido o Original
    </p>
  </div>

</body>
</html>`;
  }

  // ─── Certificado Ensino Secundário Técnico-Profissional ──────────────────────

  function buildCertificadoTecnicoProfissionalHtml(alunoId: string): string {
    const aluno = alunos.find(a => a.id === alunoId);
    if (!aluno) return '';
    const turma = turmas.find(t => t.id === aluno.turmaId);
    const escola = config.nomeEscola || 'Instituto Técnico';
    const director = directorGeral;
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

    // All notas for this student
    const alunoNotas = notas.filter(n => n.alunoId === alunoId);

    // Track which disciplinas are already matched (to avoid double-counting)
    const matchedKeys = new Set<string>();

    type DiscDef = { nome: string; lookup: string[] };
    type ResolvedRow = { nome: string; nota: number | null };

    function resolveRows(defs: DiscDef[]): ResolvedRow[] {
      return defs.map(d => {
        for (const n of alunoNotas) {
          const dk = n.disciplina.toLowerCase().trim();
          for (const s of d.lookup) {
            const sl = s.toLowerCase();
            if (dk.includes(sl) || sl.includes(dk)) {
              matchedKeys.add(dk);
              return { nome: d.nome, nota: n.nf };
            }
          }
        }
        return { nome: d.nome, nota: null };
      });
    }

    // ── Componente Sócio-cultural ──────────────────────────────────────────────
    const defsS: DiscDef[] = [
      { nome: 'L. Portuguesa',                    lookup: ['língua portuguesa', 'l. portuguesa', 'lingua portuguesa', 'português', 'portugues'] },
      { nome: 'L. Estrangeira',                   lookup: ['língua estrangeira', 'l. estrangeira', 'lingua estrangeira', 'inglês', 'ingles', 'francês', 'frances'] },
      { nome: 'Formação de Atitudes Integradoras', lookup: ['atitudes integradoras', 'formação de atitudes', 'formacao de atitudes'] },
      { nome: 'Educação Física',                  lookup: ['educação física', 'educacao fisica', 'ed. física', 'ed.física'] },
    ];

    // ── Componente Científica ─────────────────────────────────────────────────
    const defsC: DiscDef[] = [
      { nome: 'Matemática',     lookup: ['matemática', 'matematica'] },
      { nome: 'Biologia',       lookup: ['biologia'] },
      { nome: 'Física',         lookup: ['física', 'fisica'] },
      { nome: 'Química',        lookup: ['química', 'quimica'] },
      { nome: 'Informática',    lookup: ['informática', 'informatica'] },
      { nome: 'Psicologia Geral', lookup: ['psicologia geral', 'psicologia'] },
    ];

    const rowsS = resolveRows(defsS);
    const rowsC = resolveRows(defsC);

    // ── Componente Técnica — all remaining notas (dynamic, specialty-specific) ─
    // PAP lookup first (before technical block)
    const papSearches = ['pap', 'prova de aptidão', 'aptidão profissional', 'prova aptidão', 'prova de aptidao'];
    let papNota: number | null = null;
    for (const n of alunoNotas) {
      const dk = n.disciplina.toLowerCase().trim();
      for (const s of papSearches) {
        if (dk.includes(s) || s.includes(dk)) {
          papNota = n.nf;
          matchedKeys.add(dk);
          break;
        }
      }
      if (papNota !== null) break;
    }

    // Everything else goes into the technical component
    const rowsT: ResolvedRow[] = alunoNotas
      .filter(n => !matchedKeys.has(n.disciplina.toLowerCase().trim()))
      .map(n => ({ nome: n.disciplina, nota: n.nf }));

    // ── Statistics ────────────────────────────────────────────────────────────
    const allRows = [...rowsS, ...rowsC, ...rowsT].filter(r => r.nota !== null);
    const mpc = allRows.length > 0
      ? allRows.reduce((s, r) => s + (r.nota ?? 0), 0) / allRows.length
      : null;
    const mpcRounded  = mpc !== null ? Math.round(mpc) : null;
    const mpcDisplay  = mpcRounded  !== null ? String(mpcRounded)  : '—';
    const mpcExtenso  = mpcRounded  !== null ? numExtenso(mpcRounded)  : '________';

    const papRounded  = papNota !== null ? Math.round(papNota) : null;
    const papDisplay  = papRounded  !== null ? String(papRounded)  : '___';
    const papExtenso  = papRounded  !== null ? numExtenso(papRounded)  : '________';

    const finalCalc   = mpcRounded !== null && papRounded !== null
      ? Math.round((2 * mpcRounded + papRounded) / 3)
      : mpcRounded;
    const finalDisplay = finalCalc !== null ? String(finalCalc) : '—';
    const finalExtenso = finalCalc !== null ? numExtenso(finalCalc) : '________';

    // ── HTML row helpers ──────────────────────────────────────────────────────
    function sectionHeader(label: string): string {
      return `<tr style="background:#f0f0f0;">
        <td colspan="3" style="font-weight:bold;padding:5px 10px;border:1px solid #999;">${label}</td>
      </tr>`;
    }
    function discRow(r: ResolvedRow): string {
      const val = r.nota !== null ? Math.round(r.nota) : null;
      const valStr    = val !== null ? String(val)              : '—';
      const extensoStr = val !== null ? `(${numExtenso(val)}) Valores` : '—';
      return `<tr>
        <td style="padding:4px 10px;border:1px solid #ccc;">${r.nome}</td>
        <td style="text-align:center;font-weight:bold;border:1px solid #ccc;">${valStr}</td>
        <td style="text-align:center;border:1px solid #ccc;">${extensoStr}</td>
      </tr>`;
    }
    function summaryRow(label: string, val: string, extenso: string, isFinal = false): string {
      const bg = isFinal ? '#1a2540' : '#f5f5f5';
      const fg = isFinal ? '#fff'    : '#000';
      const fw = 'bold';
      return `<tr style="background:${bg};color:${fg};font-weight:${fw};">
        <td style="padding:5px 10px;border:1px solid ${isFinal ? '#1a2540' : '#999'};">${label}</td>
        <td style="text-align:center;border:1px solid ${isFinal ? '#1a2540' : '#999'};">${val}</td>
        <td style="text-align:center;border:1px solid ${isFinal ? '#1a2540' : '#999'};">${extenso.startsWith('(') ? extenso : `(${extenso}) Valores`}</td>
      </tr>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Certificado — ${nome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', serif; font-size: 12px; color: #000; padding: 20px 36px; line-height: 1.65; }

    .top-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .visto-box { width: 180px; border: 1px solid #999; padding: 6px 10px; font-size: 10px; text-align: center; min-height: 80px; }
    .visto-title { font-weight: bold; font-size: 10px; margin-bottom: 4px; }
    .visto-sig-line { width: 120px; border-top: 1px solid #000; margin: 30px auto 4px; }
    .stamp-box { width: 180px; border: 2px solid #333; padding: 8px 10px; font-size: 10px; text-align: center; min-height: 60px; display: flex; align-items: center; justify-content: center; }
    .stamp-text { font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; text-align: center; }

    .header-block { text-align: center; margin-bottom: 12px; }
    .header-block p { margin: 2px 0; }
    .rep { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .ministerio { font-size: 11.5px; font-weight: bold; text-transform: uppercase; }
    .nivel-ensino { font-size: 11px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
    .titulo-cert { font-size: 26px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; margin: 8px 0 14px; }

    .body-text { text-align: justify; font-size: 12px; line-height: 1.85; margin-bottom: 14px; }
    .director-name { color: #c00; font-weight: bold; }
    .student-name  { color: #c00; font-weight: bold; font-style: italic; }
    .especialidade { font-weight: bold; text-transform: uppercase; }
    .bold { font-weight: bold; }

    table { border-collapse: collapse; width: 100%; margin-bottom: 6px; font-size: 11.5px; }
    table th { background: #ddd; border: 1px solid #999; padding: 5px 10px; font-weight: bold; text-align: center; }
    table th:first-child { text-align: left; }

    .legal { text-align: justify; font-size: 11.5px; line-height: 1.7; margin-top: 10px; }
    .date-line { text-align: center; margin: 18px 0 8px; font-size: 12px; }
    .sig-row { display: flex; justify-content: space-between; margin-top: 10px; }
    .sig-block { text-align: center; min-width: 190px; }
    .sig-label { font-size: 11px; font-weight: bold; margin-bottom: 32px; }
    .sig-line  { width: 170px; border-top: 1px solid #000; margin: 0 auto 4px; }
    .sig-name  { font-size: 11px; }

    @media print { @page { size: A4; margin: 12mm 18mm; } body { padding: 0; } }
  </style>
</head>
<body>

  <!-- TOP ROW: Visto | Coat of Arms | Stamp -->
  <div class="top-row">
    <div class="visto-box">
      <div class="visto-title">Visto</div>
      <div style="font-size:10px;">Director Provincial da Educação</div>
      <div class="visto-sig-line"></div>
      <div style="font-size:10px;">${directorProvincialEducacao || '____________________________'}</div>
    </div>
    <div style="text-align:center;">
      <img src="/icons/icon-192.png" alt="Armas" style="height:70px;width:70px;object-fit:contain;" onerror="this.style.display='none'" />
    </div>
    <div class="stamp-box">
      <div class="stamp-text">Inspecção da Educação<br>${provincia}</div>
    </div>
  </div>

  <!-- INSTITUTION HEADER -->
  <div class="header-block">
    <p class="rep">República de Angola</p>
    <p class="ministerio">Ministério da Educação</p>
    <p class="nivel-ensino">Ensino Secundário Técnico-Professional</p>
    <p class="titulo-cert">Certificado</p>
  </div>

  <!-- BODY TEXT -->
  <div class="body-text">
    <span class="director-name">${director}</span>, Director(a) do
    <span class="bold">${escola}</span>,
    criado sob o Decreto Executivo n.º <span class="bold">_____</span>
    de ___ de ____________________,
    certifica que <span class="student-name">${nome}</span>,
    filho(a) de <span class="bold">${encarregado}</span>
    e de <span class="bold">________________________________</span>,
    natural de <span class="bold">${municipio}</span>,
    Província de <span class="bold">${provincia}</span>,
    nascido(a) aos <span class="bold">${diaNasc} de ${mesNasc} de ${anoNasc}</span>,
    portador(a) do Bilhete de Identificação n.º <span class="bold">________________________</span>,
    passado pelo arquivo de identificação de <span class="bold">${provincia}</span>
    aos ___ de _______________ de ______,
    concluiu no ano lectivo <span class="bold">${anoLetivo}</span>
    o Curso do <span class="bold">II CICLO DO ENSINO SECUNDÁRIO TÉCNICO</span>,
    na especialidade de <span class="especialidade">________________________________</span>,
    conforme o disposto na alínea f) do artigo 109.º da LBSEE 17/16, de 7 de Outubro,
    com Média de <span class="bold">${mpcDisplay}</span> valores
    obtida nas seguintes classificações por disciplinas:
  </div>

  <!-- GRADES TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:55%;text-align:left;">Componentes da Formação</th>
        <th style="width:22%;">Média Final</th>
        <th style="width:23%;">Média por Extenso</th>
      </tr>
    </thead>
    <tbody>
      ${sectionHeader('Componente Sócio-cultural')}
      ${rowsS.map(discRow).join('')}
      ${sectionHeader('Componente Científica')}
      ${rowsC.filter(r => r.nota !== null).map(discRow).join('')}
      ${rowsT.length > 0 ? sectionHeader('Componente Técnica, Tecnológica e Prática') : ''}
      ${rowsT.map(discRow).join('')}
      ${summaryRow('Média por Plano Curricular (PC)', mpcDisplay, mpcExtenso)}
      ${summaryRow('Prova de Aptidão Profissional (PAP)', papDisplay, papExtenso)}
      ${summaryRow('Classificação Final por Curso = (2×PC+PAP)/3', finalDisplay, finalExtenso, true)}
    </tbody>
  </table>

  <!-- LEGAL TEXT -->
  <div class="legal">
    Para efeitos legais lhe é passado o presente <strong>CERTIFICADO</strong>,
    que consta no livro de registo n.º <strong>____</strong>, folha <strong>____</strong>,
    assinado por mim e autenticado com carimbo a selo branco em uso neste estabelecimento de ensino.
  </div>

  <!-- DATE & SIGNATURES -->
  <div class="date-line">${municipio}, aos ${dataActual}</div>

  ${buildSigRow(directorGeral, directorPedagogico, directorProvincialEducacao)}

</body>
</html>`;
  }

  function saveDocumentoEmitido(alunoId: string, tipoNome: string) {
    if (!alunoId) return;
    const al = alunos.find(a => a.id === alunoId);
    if (!al) return;
    const turma = turmas.find(t => t.id === al.turmaId);
    fetch('/api/documentos-emitidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId: al.id,
        alunoNome: `${al.nome} ${al.apelido}`,
        alunoNum: al.numeroMatricula,
        alunoTurma: turma ? `${turma.classe} ${turma.nome}` : '',
        tipo: tipoNome,
        anoAcademico: turma?.anoLetivo || '',
        emitidoPor: user?.nome || 'Sistema',
      }),
    }).catch(() => {});
  }

  async function handlePrint() {
    if (Platform.OS !== 'web') return;
    const win = window.open('', '_blank');
    if (!win) return;

    // ── Mapa de Aproveitamento: generated HTML ────────────────────────────────
    if (emitTemplate?.tipo === 'mapa_aproveitamento') {
      const html = emitTemplate.classeAlvo === 'TURMA_DETALHADO'
        ? buildMapaTurmaDetalhadoHtml(emitTrimestre)
        : emitTemplate.classeAlvo === 'CURSO_CLASSE'
          ? buildMapaPorCursoClasseHtml(emitTrimestre)
          : buildMapaAproveitamentoHtml(emitTrimestre);
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

    // ── Mapa de Frequências: generated HTML ───────────────────────────────────
    if (emitTemplate?.tipo === 'mapa_frequencias') {
      const html = buildMapaFrequenciasHtml();
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

    // ── Certificado do Ensino Primário: use generated HTML directly ───────────
    if (emitTemplate?.tipo === 'certificado_primario' && emitAlunoId) {
      const html = buildCertificadoPrimarioHtml(emitAlunoId);
      win.document.write(html);
      win.document.close();
      win.print();
      saveDocumentoEmitido(emitAlunoId, emitTemplate.nome);
      return;
    }

    // ── Extracto de Propinas: fetch data and render using editor template ─────
    if (emitTemplate?.tipo === 'extrato_propina' && emitAlunoId) {
      win.document.write(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d1b3e;color:#fff;margin:0;"><div style="text-align:center"><p style="font-size:16px;">A gerar extracto de propinas...</p></div></body></html>`);
      win.document.close();
      try {
        const params = new URLSearchParams({ alunoId: emitAlunoId });
        if (emitExtratoDataInicio) params.append('dataInicio', emitExtratoDataInicio);
        if (emitExtratoDataFim) params.append('dataFim', emitExtratoDataFim);
        const resp = await fetch(`/api/extrato-propinas?${params}`);
        if (!resp.ok) { win.close(); showToast('Erro ao carregar os dados do extracto', 'error'); return; }
        const extratoData = await resp.json();
        const html = buildExtratoFromEditorTemplate(emitTemplate, extratoData);
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch {
        win.close();
        showToast('Erro ao gerar o extracto de propinas', 'error');
        return;
      }
      saveDocumentoEmitido(emitAlunoId, emitTemplate.nome);
      return;
    }

    // ── Lista da Turma: use generated HTML directly ───────────────────────────
    if (emitTemplate?.tipo === 'lista_turma' && emitTurmaId) {
      const html = buildListaTurmaHtml(emitTurmaId);
      win.document.write(html);
      win.document.close();
      win.print();
      return;
    }

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
      saveDocumentoEmitido(emitAlunoId, emitTemplate.nome);
      return;
    }

    // ── Certificado de Habilitações: rich HTML with grade table ───────────────
    if (emitTemplate?.tipo === 'certificado' && emitTemplate?.classeAlvo && emitAlunoId) {
      const classe = emitTemplate.classeAlvo;
      let html = '';
      if (classe === 'I-CICLO-GERAL') {
        html = buildCertificadoHabilitacoesICicloHtml(emitAlunoId);
      } else if (classe === '12ª-II-CICLO') {
        html = buildCertificadoIiCicloHtml(emitAlunoId);
      } else if (classe === '13ª-ITAQ') {
        html = buildCertificadoItaqHtml(emitAlunoId);
      } else if (classe === 'PEDAGOGICO-II-CICLO') {
        html = buildCertificadoHabilitacoesLiterariasHtml(emitAlunoId);
      } else if (classe === 'TECNICO-PROFISSIONAL') {
        html = buildCertificadoTecnicoProfissionalHtml(emitAlunoId);
      } else {
        html = buildCertificadoHabilitacoesHtml(emitAlunoId, classe);
      }
      win.document.write(html);
      win.document.close();
      win.print();
      saveDocumentoEmitido(emitAlunoId, emitTemplate.nome);
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
          ${isHtmlContent(emitPreview) ? `<div style="text-align:justify;line-height:1.9;font-family:'Times New Roman',serif;font-size:14px;">${emitPreview}</div>` : `<pre>${emitPreview}</pre>`}
          <div class="date-footer" style="font-size:13px;color:#444;margin-top:40px;">Luanda, ${new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          <div style="display:flex;justify-content:space-around;margin-top:30px;flex-wrap:wrap;gap:20px;">
            <div style="text-align:center;min-width:150px;">
              <div style="font-size:12px;font-weight:bold;margin-bottom:30px;">O Director Geral</div>
              <div class="sig-line"></div>
              <div style="font-weight:bold;font-size:12px;">${directorGeral}</div>
            </div>
            <div style="text-align:center;min-width:150px;">
              <div style="font-size:12px;font-weight:bold;margin-bottom:30px;">O Director Pedagógico</div>
              <div class="sig-line"></div>
              <div style="font-weight:bold;font-size:12px;">${directorPedagogico}</div>
            </div>
            ${directorProvincialEducacao ? `<div style="text-align:center;min-width:150px;"><div style="font-size:12px;font-weight:bold;margin-bottom:30px;">Director Provincial da Educação</div><div class="sig-line"></div><div style="font-weight:bold;font-size:12px;">${directorProvincialEducacao}</div></div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.print();
    if (emitAlunoId && emitTemplate) {
      saveDocumentoEmitido(emitAlunoId, emitTemplate.nome);
    }
  }

  function handleExportExcel() {
    if (Platform.OS !== 'web') return;
    if (emitTemplate?.tipo === 'pauta_final' && emitTurmaId) {
      buildPautaFinalExcel(emitTurmaId);
      return;
    }
    if (emitTemplate?.tipo === 'pauta' && emitTurmaId) {
      buildMiniPautaExcel(emitTurmaId);
      return;
    }
  }

  const screenWidth = Dimensions.get('window').width;
  const isWide = screenWidth >= 768;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  const toastColors = {
    success: { bg: '#064E3B', border: '#10B981', icon: 'checkmark-circle' as const, iconColor: '#10B981' },
    error:   { bg: '#4C0519', border: '#F43F5E', icon: 'close-circle'     as const, iconColor: '#F43F5E' },
    info:    { bg: '#0C1A6B', border: '#818CF8', icon: 'information-circle' as const, iconColor: '#818CF8' },
  };
  const tc = toastColors[toastType];

  return (
    <View style={{ flex: 1 }}>
      {mode === 'list' && <ListScreen />}
      {mode === 'editor' && <EditorScreen />}
      {mode === 'emit' && <EmitScreen />}

      {/* ── Toast notification overlay ── */}
      <Animated.View
        style={[
          styles.toastContainer,
          { pointerEvents: 'none', opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
        ] as any}
      >
        <View style={[styles.toastInner, { backgroundColor: tc.bg, borderColor: tc.border }]}>
          <Ionicons name={tc.icon} size={18} color={tc.iconColor} />
          <Text style={[styles.toastText, { color: tc.iconColor }]}>{toastMsg}</Text>
        </View>
      </Animated.View>
    </View>
  );

  // ─── LIST ─────────────────────────────────────────────────────────────────

  function ListScreen() {
    const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'bloqueados'>('todos');
    const [pesquisa, setPesquisa] = useState('');

    const totalBloqueados = templates.filter(t => t.bloqueado).length;
    const totalAtivos = templates.filter(t => !t.bloqueado).length;

    const byFiltro = canManageLocks
      ? (filtro === 'ativos'
          ? templates.filter(t => !t.bloqueado)
          : filtro === 'bloqueados'
            ? templates.filter(t => t.bloqueado)
            : templates)
      : templates.filter(t => !t.bloqueado);

    const visibleTemplates = pesquisa.trim()
      ? byFiltro.filter(t => {
          const q = pesquisa.toLowerCase();
          return (
            t.nome.toLowerCase().includes(q) ||
            (TIPO_LABELS[t.tipo] ?? t.tipo).toLowerCase().includes(q)
          );
        })
      : byFiltro;

    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Editor de Documentos</Text>
            <Text style={styles.headerSub}>
              {canManageLocks
                ? `${totalAtivos} activo${totalAtivos !== 1 ? 's' : ''} · ${totalBloqueados} bloqueado${totalBloqueados !== 1 ? 's' : ''}`
                : `${totalAtivos} modelo${totalAtivos !== 1 ? 's' : ''} disponíve${totalAtivos !== 1 ? 'is' : 'l'}`}
            </Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={openNew} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tabs — only for managers */}
        {canManageLocks && (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            {([
              { key: 'todos', label: `Todos (${templates.length})` },
              { key: 'ativos', label: `Activos (${totalAtivos})`, color: Colors.success },
              { key: 'bloqueados', label: `Bloqueados (${totalBloqueados})`, color: Colors.danger },
            ] as const).map(f => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFiltro(f.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: filtro === f.key ? (f.color || Colors.gold) + '22' : Colors.surface,
                  borderWidth: 1,
                  borderColor: filtro === f.key ? (f.color || Colors.gold) : Colors.border,
                }}
                activeOpacity={0.75}
              >
                {f.key === 'bloqueados' && <Ionicons name="lock-closed" size={11} color={filtro === f.key ? Colors.danger : Colors.textMuted} />}
                {f.key === 'ativos' && <Ionicons name="lock-open" size={11} color={filtro === f.key ? Colors.success : Colors.textMuted} />}
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: filtro === f.key ? (f.color || Colors.gold) : Colors.textMuted }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Barra de pesquisa */}
        <View style={listStyles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={listStyles.searchInput}
            placeholder="Pesquisar modelo por nome ou tipo..."
            placeholderTextColor={Colors.textMuted}
            value={pesquisa}
            onChangeText={setPesquisa}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {pesquisa.length > 0 && (
            <TouchableOpacity onPress={() => setPesquisa('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info banner for managers */}
        {canManageLocks && totalBloqueados > 0 && filtro !== 'bloqueados' && !pesquisa && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, backgroundColor: Colors.danger + '15', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.danger + '40' }}>
            <Ionicons name="lock-closed" size={14} color={Colors.danger} />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, flex: 1 }}>
              {totalBloqueados} modelo{totalBloqueados !== 1 ? 's' : ''} bloqueado{totalBloqueados !== 1 ? 's' : ''} — invisíve{totalBloqueados !== 1 ? 'is' : 'l'} para os outros utilizadores.
            </Text>
          </View>
        )}

        {visibleTemplates.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name={pesquisa ? 'search' : 'file-alt'} size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {pesquisa
                ? 'Nenhum modelo encontrado'
                : filtro === 'bloqueados' ? 'Sem modelos bloqueados' : filtro === 'ativos' ? 'Sem modelos activos' : 'Nenhum modelo criado'}
            </Text>
            <Text style={styles.emptyDesc}>
              {pesquisa
                ? `Não foi encontrado nenhum modelo com "${pesquisa}". Tente outro termo.`
                : filtro === 'bloqueados' ? 'Nenhum modelo foi bloqueado.' : filtro === 'ativos' ? 'Todos os modelos estão bloqueados.' : 'Crie o primeiro modelo de documento para a sua escola.'}
            </Text>
            {pesquisa ? (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setPesquisa('')}>
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Limpar pesquisa</Text>
              </TouchableOpacity>
            ) : filtro === 'todos' ? (
              <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Criar primeiro modelo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {visibleTemplates.map(item => <TemplateCard key={item.id} template={item} />)}

            {/* ─── Planos de Aula Section ─────────────────────────────── */}
            {planosAulaDoc.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.gold + '18', borderWidth: 1, borderColor: Colors.gold + '44' }}>
                    <Ionicons name="book-outline" size={14} color={Colors.gold} />
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.gold }}>Planos de Aula</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>({planosAulaDoc.filter((p: any) => p.status !== 'rascunho').length})</Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: Colors.border }} />
                </View>

                {planosAulaLoading ? (
                  <ActivityIndicator color={Colors.gold} />
                ) : (
                  planosAulaDoc
                    .filter((p: any) => p.status !== 'rascunho')
                    .map((plano: any) => {
                      const statusColors: Record<string, string> = { submetido: '#f59e0b', aprovado: Colors.success, rejeitado: Colors.danger };
                      const statusLabels: Record<string, string> = { submetido: 'Submetido', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };
                      const sc = statusColors[plano.status] || Colors.textMuted;
                      const sl = statusLabels[plano.status] || plano.status;
                      return (
                        <TouchableOpacity
                          key={plano.id}
                          style={[styles.card, { marginBottom: 10 }]}
                          onPress={() => setPreviewPlanoDoc(plano)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.cardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <View style={{ backgroundColor: Colors.gold + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold }}>Plano de Aula</Text>
                              </View>
                              <View style={{ backgroundColor: sc + '22', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: sc + '44' }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: sc }}>{sl.toUpperCase()}</Text>
                              </View>
                            </View>
                            <Ionicons name="eye-outline" size={18} color={Colors.info} />
                          </View>
                          <Text style={styles.cardNome}>{plano.disciplina} — {plano.sumario || plano.unidade || '—'}</Text>
                          <Text style={styles.cardPreview} numberOfLines={1}>
                            {plano.professorNome} · {plano.turmaNome || '—'} · {plano.classe}ª · {plano.data || '—'}
                          </Text>
                          <View style={styles.cardFooter}>
                            <Text style={styles.cardDate}>Ano Lectivo: {plano.anoLetivo}</Text>
                            <View style={styles.cardActions}>
                              <TouchableOpacity
                                style={styles.cardActionBtn}
                                onPress={() => setPreviewPlanoDoc(plano)}
                              >
                                <Ionicons name="print-outline" size={14} color={Colors.info} />
                                <Text style={[styles.cardActionText, { color: Colors.info }]}>Abrir / Imprimir</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                )}
              </View>
            )}
          </ScrollView>
        )}

        {/* Preview plano modal */}
        {previewPlanoDoc && Platform.OS === 'web' && (
          <Modal visible animationType="slide" onRequestClose={() => setPreviewPlanoDoc(null)}>
            <View style={{ flex: 1, backgroundColor: Colors.background }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface }}>
                <TouchableOpacity onPress={() => setPreviewPlanoDoc(null)} style={{ padding: 4 }}>
                  <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text }}>
                    Plano de Aula — {previewPlanoDoc.disciplina}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                    {previewPlanoDoc.professorNome} · {previewPlanoDoc.turmaNome} · {previewPlanoDoc.data}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.info, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                  onPress={() => {
                    const iframe = document.getElementById('plano-doc-iframe') as HTMLIFrameElement;
                    if (iframe?.contentWindow) iframe.contentWindow.print();
                  }}
                >
                  <Ionicons name="print" size={16} color="#fff" />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Imprimir</Text>
                </TouchableOpacity>
              </View>
              <iframe
                id="plano-doc-iframe"
                srcDoc={buildPlanoHTMLDoc(previewPlanoDoc)}
                style={{ flex: 1, border: 'none', width: '100%', height: '100%', minHeight: 600 } as any}
                title="Plano de Aula"
              />
            </View>
          </Modal>
        )}
      </View>
    );
  }

  function TemplateCard({ template }: { template: DocTemplate }) {
    const [showMenu, setShowMenu] = useState(false);
    const tipoColor = TIPO_COLORS[template.tipo];
    const preview = template.conteudo.slice(0, 120).replace(/\n/g, ' ');
    const bloqueado = !!template.bloqueado;
    const isBoletimInscricao = template.id === SEED_BOLETIM_INSCRICAO_ID;
    const isExtratoPropina = template.tipo === 'extrato_propina';

    function handleEmitir() {
      if (bloqueado) return;
      if (isBoletimInscricao) {
        router.push('/boletim-inscricao' as any);
      } else {
        openEmit(template);
      }
    }

    return (
      <View style={[
        styles.card,
        bloqueado && { borderColor: Colors.danger + '60', borderWidth: 1, backgroundColor: Colors.danger + '08' },
      ]}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={[styles.tipoBadge, { backgroundColor: tipoColor + '22' }]}>
              <Text style={[styles.tipoText, { color: tipoColor }]}>{TIPO_LABELS[template.tipo]}</Text>
            </View>
            {bloqueado ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.danger + '25', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.danger + '50' }}>
                <Ionicons name="lock-closed" size={11} color={Colors.danger} />
                <Text style={{ fontSize: 10, color: Colors.danger, fontFamily: 'Inter_700Bold' }}>BLOQUEADO</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.success + '20', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: Colors.success + '40' }}>
                <Ionicons name="lock-open" size={11} color={Colors.success} />
                <Text style={{ fontSize: 10, color: Colors.success, fontFamily: 'Inter_700Bold' }}>ACTIVO</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(v => !v)}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.cardNome, bloqueado && { color: Colors.textMuted }]}>{template.nome}</Text>
        <Text style={styles.cardPreview} numberOfLines={2}>{preview || 'Sem conteúdo'}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>Actualizado: {fmtDate(template.atualizadoEm)}</Text>
          <View style={styles.cardActions}>
            {/* Lock/Unlock quick button — managers only */}
            {canManageLocks && (
              <TouchableOpacity
                style={[styles.cardActionBtn, { backgroundColor: bloqueado ? Colors.success + '18' : Colors.danger + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }]}
                onPress={() => toggleBloqueio(template.id)}
              >
                <Ionicons name={bloqueado ? 'lock-open-outline' : 'lock-closed-outline'} size={14} color={bloqueado ? Colors.success : Colors.danger} />
                <Text style={[styles.cardActionText, { color: bloqueado ? Colors.success : Colors.danger }]}>
                  {bloqueado ? 'Desbloquear' : 'Bloquear'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.cardActionBtn, bloqueado && { opacity: 0.35 }]}
              onPress={handleEmitir}
              disabled={bloqueado}
            >
              <Ionicons name="document-text" size={14} color={bloqueado ? Colors.textMuted : Colors.success} />
              <Text style={[styles.cardActionText, { color: bloqueado ? Colors.textMuted : Colors.success }]}>Emitir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEdit(template)}>
              <Ionicons name="pencil" size={14} color={Colors.info} />
              <Text style={[styles.cardActionText, { color: Colors.info }]}>Editar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showMenu && (
          <View style={styles.dropMenu}>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); previewTemplate(template); }}>
              <Ionicons name="eye-outline" size={16} color={'#8b5cf6'} />
              <Text style={[styles.dropItemText, { color: '#8b5cf6' }]}>Pré-visualizar PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); openEdit(template); }}>
              <Ionicons name="pencil-outline" size={16} color={Colors.text} />
              <Text style={styles.dropItemText}>Editar</Text>
            </TouchableOpacity>
            {!bloqueado && (
              <TouchableOpacity style={styles.dropItem} onPress={() => { setShowMenu(false); handleEmitir(); }}>
                <Ionicons name="document-text-outline" size={16} color={Colors.success} />
                <Text style={[styles.dropItemText, { color: Colors.success }]}>Emitir documento</Text>
              </TouchableOpacity>
            )}
            {/* Lock/unlock — managers only */}
            {canManageLocks && (
              <>
                <View style={styles.dropDivider} />
                <TouchableOpacity
                  style={styles.dropItem}
                  onPress={() => { setShowMenu(false); toggleBloqueio(template.id); }}
                >
                  <Ionicons
                    name={bloqueado ? 'lock-open-outline' : 'lock-closed-outline'}
                    size={16}
                    color={bloqueado ? Colors.success : Colors.danger}
                  />
                  <Text style={[styles.dropItemText, { color: bloqueado ? Colors.success : Colors.danger }]}>
                    {bloqueado ? 'Desbloquear modelo' : 'Bloquear modelo'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={{ marginRight: 8, backgroundColor: '#8b5cf622', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => {
                const c = Platform.OS === 'web' ? webEditorContentRef.current : editorContent;
                const fakeTpl: DocTemplate = { id: editingTemplate?.id || 'preview', nome: editorNome, tipo: editorTipo, conteudo: c, criadoEm: '', atualizadoEm: '', insigniaBase64: editorInsignia, marcaAguaBase64: editorMarcaAgua };
                previewTemplate(fakeTpl, c);
              }}
            >
              <Ionicons name="eye-outline" size={16} color={'#8b5cf6'} />
              <Text style={{ color: '#8b5cf6', fontSize: 13, fontWeight: '600' }}>Pré-ver</Text>
            </TouchableOpacity>
          )}
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
            {Platform.OS === 'web' ? (
              <Editor
                key={editorKey}
                tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@7.9.1/tinymce.min.js"
                onInit={(_evt: any, editor: any) => { tinyEditorRef.current = editor; }}
                initialValue={tinyInitContent}
                onEditorChange={(content: string) => { webEditorContentRef.current = content; }}
                init={{
                  height: 520,
                  menubar: true,
                  branding: false,
                  promotion: false,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                    'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
                    'fullscreen', 'insertdatetime', 'media', 'table', 'wordcount',
                  ],
                  toolbar:
                    'undo redo | blocks | bold italic underline strikethrough | ' +
                    'alignleft aligncenter alignright alignjustify | ' +
                    'bullist numlist outdent indent | link image table | ' +
                    'forecolor backcolor | removeformat | fullscreen code',
                  content_style:
                    "body { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.9; color: #111; padding: 20px 28px; }",
                  skin: 'oxide',
                  content_css: 'default',
                  language: 'pt_PT',
                  resize: false,
                  statusbar: true,
                  image_uploadtab: true,
                  automatic_uploads: false,
                  file_picker_types: 'image',
                  file_picker_callback: (cb: any) => {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.addEventListener('change', (e: any) => {
                      const file = e.target.files[0];
                      const reader = new FileReader();
                      reader.addEventListener('load', () => {
                        const id = 'blobid' + Date.now();
                        const blobCache = (tinyEditorRef.current as any)?.editorUpload?.blobCache;
                        if (blobCache) {
                          const base64 = (reader.result as string).split(',')[1];
                          const blobInfo = blobCache.create(id, file, base64);
                          blobCache.add(blobInfo);
                          cb(blobInfo.blobUri(), { title: file.name });
                        } else {
                          cb(reader.result as string, { title: file.name });
                        }
                      });
                      reader.readAsDataURL(file);
                    });
                    input.click();
                  },
                } as any}
              />
            ) : (
              <TextInput
                ref={inputRef}
                style={styles.editorTextInput}
                value={editorContent}
                onChangeText={setEditorContent}
                multiline
                textAlignVertical="top"
                placeholder={`Escreva o conteúdo do documento aqui...\n\nUse as variáveis no painel ao lado para inserir dados automáticos.`}
                placeholderTextColor={Colors.textMuted}
              />
            )}
            <View style={styles.editorStats}>
              <Text style={styles.editorStatsText}>{stripHtmlTags(editorContent).length} caracteres</Text>
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
    const isMapa = isMapaType(emitTemplate);
    const isListaTurma = isListaTurmaType(emitTemplate);
    const isCertificadoPrimario = isCertificadoPrimarioType(emitTemplate);
    const isExtratoPropina = isExtratoPropinaType(emitTemplate);

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

    // ── Mapa de Aproveitamento stats for preview ──────────────────────────
    const totalAlunos = alunos.filter(a => a.ativo).length;
    const totalAlunosF = alunos.filter(a => a.ativo && a.genero === 'F').length;
    const notasTrimestre = notas.filter(n => n.trimestre === emitTrimestre);
    const avaliadosSet = new Set(notasTrimestre.map(n => n.alunoId));
    const totalAvaliados = avaliadosSet.size;
    const aprovados = [...avaliadosSet].filter(id => {
      const ns = notasTrimestre.filter(n => n.alunoId === id);
      if (ns.length === 0) return false;
      return ns.reduce((s, n) => s + n.nf, 0) / ns.length >= 10;
    }).length;
    const aprovPct = totalAvaliados > 0 ? Math.round((aprovados / totalAvaliados) * 100) : 0;
    const sortedTurmasForMapa = [...turmas].sort((a, b) => b.anoLetivo.localeCompare(a.anoLetivo));
    const anoLetivoMapa = sortedTurmasForMapa[0]?.anoLetivo || String(new Date().getFullYear());

    const canPrint = isMapa ? true : (isListaTurma ? !!emitTurmaId : (isPauta ? !!emitTurmaId : (isCertificadoPrimario ? !!emitAlunoId : (isExtratoPropina ? !!emitAlunoId : (!!emitAlunoId && !!emitPreview)))));

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
          {canPrint && (isPauta || emitTemplate?.tipo === 'pauta_final') && emitTurmaId ? (
            <TouchableOpacity style={[styles.printBtn, { backgroundColor: '#1a7a1a', marginRight: 6 }]} onPress={handleExportExcel} activeOpacity={0.8}>
              <Ionicons name="document-outline" size={16} color="#fff" />
              <Text style={styles.printBtnText}>Excel</Text>
            </TouchableOpacity>
          ) : null}
          {canPrint ? (
            <TouchableOpacity style={styles.printBtn} onPress={handlePrint} activeOpacity={0.8}>
              <Ionicons name="print" size={16} color="#fff" />
              <Text style={styles.printBtnText}>PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.emitBody, isWide && { flexDirection: 'row' }]}>
          {/* Left: Turma selector (pauta/lista_turma) or Student selector (documents) */}
          <View style={[styles.emitLeft, isWide && { width: 300 }]}>
            {isMapa ? (
              <>
                <Text style={styles.emitSectionTitle}>1. Seleccionar Trimestre</Text>
                <View style={{ gap: 8, paddingTop: 4 }}>
                  {([1, 2, 3] as const).map(t => {
                    const sel = emitTrimestre === t;
                    const triLabel = t === 1 ? '1º Trimestre' : t === 2 ? '2º Trimestre' : '3º Trimestre';
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.alunoItem, sel && { borderColor: '#065f46', borderWidth: 1.5, backgroundColor: '#065f4620' }]}
                        onPress={() => setEmitTrimestre(t)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.alunoAvatar, sel && { backgroundColor: '#065f46' }]}>
                          <Text style={styles.alunoAvatarText}>{t}T</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.alunoNome, sel && { color: '#065f46' }]}>{triLabel}</Text>
                          <Text style={styles.alunoMeta}>Ano Lectivo {anoLetivoMapa}</Text>
                        </View>
                        {sel && <Ionicons name="checkmark-circle" size={18} color="#065f46" />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flex: 1 }} />
                <View style={{ backgroundColor: '#0d2618', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#065f46', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <Ionicons name="information-circle-outline" size={18} color="#065f46" />
                  <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 }}>
                    O mapa será gerado automaticamente em formato A3 paisagem com todos os dados do sistema.
                  </Text>
                </View>
              </>
            ) : (isPauta || isListaTurma) ? (
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
                    const accentColor = isListaTurma ? '#0369a1' : '#dc2626';
                    return (
                      <TouchableOpacity
                        key={turma.id}
                        style={[styles.alunoItem, sel && { borderColor: accentColor, borderWidth: 1.5, backgroundColor: accentColor + '15' }]}
                        onPress={() => { setEmitTurmaId(turma.id); setTurmaSearch(''); }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.alunoAvatar, sel && { backgroundColor: accentColor }]}>
                          <Text style={styles.alunoAvatarText}>{turma.classe.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.alunoNome, sel && { color: accentColor }]}>{turma.classe} — {turma.nome}</Text>
                          <Text style={styles.alunoMeta}>{turma.anoLetivo} · {turma.turno} · {count} alunos</Text>
                        </View>
                        {sel && <Ionicons name="checkmark-circle" size={18} color={accentColor} />}
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
                    {isListaTurma && (
                      <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 6 }}>
                        {alunos.filter(a => a.ativo && a.turmaId === selectedTurmaObj.id).length} alunos · Lista com Mapa Estatístico
                      </Text>
                    )}
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
                {emitAlunoHistorico.length > 0 && (
                  <View style={{ marginTop: 10, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Ionicons name="time" size={13} color={Colors.gold} />
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Histórico de documentos ({emitAlunoHistorico.length})
                      </Text>
                    </View>
                    {emitAlunoHistorico.slice(0, 5).map(doc => (
                      <View key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                        <Ionicons name="document-text-outline" size={14} color={Colors.gold} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text }} numberOfLines={1}>{doc.tipo}</Text>
                          <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted }}>
                            {new Date(doc.emitidoEm).toLocaleDateString('pt-PT')}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: Colors.success + '22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.success }}>EMITIDO</Text>
                        </View>
                      </View>
                    ))}
                    {emitAlunoHistorico.length > 5 && (
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginTop: 6 }}>
                        +{emitAlunoHistorico.length - 5} documentos anteriores
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Right: Mapa summary, Pauta summary, or Document preview */}
          <View style={[styles.emitRight, isWide && { flex: 1 }]}>
            {isMapa ? (
              <>
                <Text style={styles.emitSectionTitle}>2. Resumo do Mapa</Text>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                  <View style={{ backgroundColor: '#0d2618', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#065f46' }}>
                    <Text style={{ color: '#4ade80', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>
                      MAPA DE APROVEITAMENTO — A3 PAISAGEM
                    </Text>
                    <Text style={{ color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>
                      {emitTrimestre === 1 ? '1º' : emitTrimestre === 2 ? '2º' : '3º'} Trimestre
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                      Ano Lectivo {anoLetivoMapa} · Todos os níveis
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                      <Ionicons name="people-outline" size={22} color={Colors.info} />
                      <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{totalAlunos}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Matriculados</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular' }}>{totalAlunosF}F</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
                      <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{totalAvaliados}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Avaliados</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                      <Ionicons name="trending-up-outline" size={22} color="#4ade80" />
                      <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{aprovados}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>C/Aproveitamento</Text>
                      <Text style={{ color: '#4ade80', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{aprovPct}%</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                      <Ionicons name="trending-down-outline" size={22} color={Colors.danger} />
                      <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{totalAvaliados - aprovados}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>S/Aproveitamento</Text>
                      <Text style={{ color: Colors.danger, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{100 - aprovPct}%</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>ESTRUTURA DO MAPA</Text>
                    {['Ensino Primário: Iniciação, 1ª–6ª Classe', '1º Ciclo: 7ª, 8ª, 9ª Classe', '2º Ciclo: 10ª, 11ª, 12ª Classe'].map(l => (
                      <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="layers-outline" size={14} color={Colors.success} />
                        <Text style={{ color: Colors.text, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{l}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ backgroundColor: '#0d2618', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#065f46', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="print-outline" size={18} color="#4ade80" />
                    <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 }}>
                      Clique em Imprimir para gerar o Mapa de Aproveitamento em formato A3 paisagem, pronto para submissão à Repartição de Educação.
                    </Text>
                  </View>
                </ScrollView>
              </>
            ) : isListaTurma ? (
              <>
                <Text style={styles.emitSectionTitle}>2. Resumo da Lista</Text>
                {!selectedTurmaObj ? (
                  <View style={styles.previewEmpty}>
                    <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.previewEmptyText}>Seleccione uma turma para gerar a Lista da Turma</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                    <View style={{ backgroundColor: '#0c2340', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#0369a1' }}>
                      <Text style={{ color: '#0369a1', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>LISTA DA TURMA — FORMATO A4</Text>
                      <Text style={{ color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>{selectedTurmaObj.classe} — {selectedTurmaObj.nome}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{selectedTurmaObj.nivel} · Ano Lectivo {selectedTurmaObj.anoLetivo} · {selectedTurmaObj.turno}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={22} color={Colors.info} />
                        <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{alunosDaTurma.length}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Total Alunos</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="man-outline" size={22} color={Colors.info} />
                        <Text style={{ color: Colors.text, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{alunosDaTurma.filter(a => a.genero === 'M').length}M / {alunosDaTurma.filter(a => a.genero === 'F').length}F</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Género</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>CONTEÚDO DO DOCUMENTO</Text>
                      {['Nº de ordem de cada aluno', 'Nome completo do aluno', 'Idade calculada automaticamente', 'Sexo (M/F)', 'Data de nascimento', 'Contacto do encarregado', 'Mapa Estatístico de género e idades'].map(l => (
                        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle-outline" size={14} color='#0369a1' />
                          <Text style={{ color: Colors.text, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{l}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ backgroundColor: '#0c2340', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#0369a1', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="print-outline" size={18} color='#0369a1' />
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 }}>
                        A lista será gerada em formato A4 retrato com alternância de cores e Mapa Estatístico no final.
                      </Text>
                    </View>
                  </ScrollView>
                )}
              </>
            ) : isCertificadoPrimario ? (
              <>
                <Text style={styles.emitSectionTitle}>2. Resumo do Certificado</Text>
                {!selectedAluno ? (
                  <View style={styles.previewEmpty}>
                    <Ionicons name="ribbon-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.previewEmptyText}>Seleccione um aluno para gerar o Certificado do Ensino Primário</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                    <View style={{ backgroundColor: '#2d1b69', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#7c3aed' }}>
                      <Text style={{ color: '#7c3aed', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>CERTIFICADO DO ENSINO PRIMÁRIO — A4</Text>
                      <Text style={{ color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                        {selectedTurmaForAluno?.classe || 'Sem turma'} · Nº {selectedAluno.numeroMatricula}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="person-outline" size={22} color='#7c3aed' />
                        <Text style={{ color: Colors.text, fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{selectedAluno.genero === 'F' ? 'Feminino' : 'Masculino'}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>Género</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
                        <Ionicons name="location-outline" size={22} color='#7c3aed' />
                        <Text style={{ color: Colors.text, fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{selectedAluno.provincia}</Text>
                        <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{selectedAluno.municipio}</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>CICLOS DE APRENDIZAGEM</Text>
                      {['2ª Classe (I Ciclo)', '4ª Classe (II Ciclo)', '6ª Classe (III Ciclo)'].map((ciclo, idx) => {
                        const classeLabel = ['2ª Classe', '4ª Classe', '6ª Classe'][idx];
                        const temNotas = notas.some(n => n.alunoId === emitAlunoId && turmas.find(t => t.id === n.turmaId)?.classe === classeLabel);
                        return (
                          <View key={ciclo} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name={temNotas ? 'checkmark-circle-outline' : 'ellipse-outline'} size={14} color={temNotas ? '#7c3aed' : Colors.textMuted} />
                            <Text style={{ color: temNotas ? Colors.text : Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{ciclo}</Text>
                            <Text style={{ color: temNotas ? '#7c3aed' : Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 'auto' }}>{temNotas ? 'Com dados' : 'Sem dados'}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>CAMPOS AUTOMÁTICOS DA BD</Text>
                      {['Nome completo do aluno', 'Data de nascimento', 'Género (filho/filha)', 'Município e Província', 'Classificações por ciclo', 'Médias finais e por extenso', 'Média Geral Final'].map(l => (
                        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="checkmark-circle-outline" size={14} color='#7c3aed' />
                          <Text style={{ color: Colors.text, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{l}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ backgroundColor: '#2d1b69', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#7c3aed', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="information-circle-outline" size={18} color='#7c3aed' />
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 }}>
                        Campos como pai, mãe, BI e Decreto Executivo aparecem em branco para preenchimento manual após impressão.
                      </Text>
                    </View>
                  </ScrollView>
                )}
              </>
            ) : isExtratoPropina ? (
              <>
                <Text style={styles.emitSectionTitle}>2. Configurar Extracto</Text>
                {!selectedAluno ? (
                  <View style={styles.previewEmpty}>
                    <Ionicons name="card-outline" size={48} color={Colors.textMuted} />
                    <Text style={styles.previewEmptyText}>Seleccione um aluno para configurar o Extracto de Propinas</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                    {/* Student header */}
                    <View style={{ backgroundColor: '#0f1f3d', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#3b82f6' }}>
                      <Text style={{ color: '#3b82f6', fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>EXTRACTO DE PROPINAS — FORMATO A4</Text>
                      <Text style={{ color: Colors.text, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 2 }}>{selectedAluno.nome} {selectedAluno.apelido}</Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                        {selectedTurmaForAluno?.classe || 'Sem turma'} · Nº {selectedAluno.numeroMatricula}
                      </Text>
                    </View>

                    {/* Date filter */}
                    <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 }}>PERÍODO DO EXTRACTO (OPCIONAL)</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 4 }}>Data início</Text>
                          <TextInput
                            style={{ backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 10, paddingVertical: 8 }}
                            value={emitExtratoDataInicio}
                            onChangeText={setEmitExtratoDataInicio}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor={Colors.textMuted}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 4 }}>Data fim</Text>
                          <TextInput
                            style={{ backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 10, paddingVertical: 8 }}
                            value={emitExtratoDataFim}
                            onChangeText={setEmitExtratoDataFim}
                            placeholder="AAAA-MM-DD"
                            placeholderTextColor={Colors.textMuted}
                          />
                        </View>
                      </View>
                      <Text style={{ color: Colors.textMuted, fontSize: 10, fontFamily: 'Inter_400Regular' }}>
                        Sem filtro de período serão incluídos todos os registos do aluno.
                      </Text>
                    </View>

                    {/* What's included */}
                    <View style={{ backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5, marginBottom: 4 }}>O EXTRACTO INCLUI</Text>
                      {[
                        'Data e valor de cada transacção',
                        'Método de pagamento',
                        'Estado de cada propina (pago / pendente / cancelado)',
                        'Totais calculados automaticamente',
                        'QR Code de verificação',
                        'Código de barras (nº de matrícula)',
                        'Assinaturas de Director e Secretaria',
                      ].map(l => (
                        <View key={l} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                          <Ionicons name="checkmark-circle-outline" size={14} color='#3b82f6' style={{ marginTop: 2 }} />
                          <Text style={{ color: Colors.text, fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1 }}>{l}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Info note */}
                    <View style={{ backgroundColor: '#0f1f3d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#3b82f6', flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Ionicons name="print-outline" size={18} color='#3b82f6' style={{ marginTop: 1 }} />
                      <Text style={{ color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 16 }}>
                        Os dados financeiros são carregados do sistema no momento da geração. O documento usa o modelo definido no editor para possíveis personalização.
                      </Text>
                    </View>
                  </ScrollView>
                )}
              </>
            ) : isPauta ? (
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
                      <Text style={{ color: '#dc2626', fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 6 }}>PAUTA FINAL — A4 PAISAGEM</Text>
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
                        A pauta será gerada em formato A4 paisagem com colunas MT1, MT2, MT3 e MFD por disciplina. Clique em PDF para imprimir ou Excel para exportar a folha de cálculo.
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
                      <View style={[styles.watermarkContainer, { pointerEvents: 'none' } as any]}>
                        <Image source={{ uri: emitTemplate.marcaAguaBase64 }} style={styles.watermarkImage} resizeMode="contain" />
                      </View>
                    ) : (
                      <View style={[styles.watermarkContainer, { pointerEvents: 'none' } as any]}>
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

  // Toast
  toastContainer: {
    position: 'absolute', top: 80, left: 16, right: 16, zIndex: 9999,
    alignItems: 'center',
  },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 10,
    maxWidth: 500, width: '100%' as any,
  },
  toastText: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18,
  },
});

const listStyles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
});
