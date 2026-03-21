import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Platform,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';

interface Disciplina {
  nome: string;
  codigo: string;
  horasSemana: number;
  horasAnuais: number;
  notaMinima: number;
  obrigatoria: boolean;
  observacao?: string;
}

interface NivelGrelha {
  nivel: string;
  classes: string;
  descricao: string;
  disciplinas: Disciplina[];
  cor: string;
}

const GRELHA: NivelGrelha[] = [
  {
    nivel: 'Primário',
    classes: '1ª — 6ª Classe',
    descricao: 'Ensino Primário obrigatório (6 anos). Foco no desenvolvimento de competências básicas de leitura, escrita e cálculo.',
    cor: Colors.success,
    disciplinas: [
      { nome: 'Língua Portuguesa', codigo: 'LP', horasSemana: 8, horasAnuais: 320, notaMinima: 10, obrigatoria: true },
      { nome: 'Matemática', codigo: 'MAT', horasSemana: 6, horasAnuais: 240, notaMinima: 10, obrigatoria: true },
      { nome: 'Estudo do Meio', codigo: 'EM', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Física', codigo: 'EF', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Artística', codigo: 'EA', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Moral e Cívica', codigo: 'EMC', horasSemana: 1, horasAnuais: 40, notaMinima: 10, obrigatoria: true },
      { nome: 'Língua Estrangeira', codigo: 'LE', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: false, observacao: 'A partir da 4ª Classe' },
    ],
  },
  {
    nivel: 'I Ciclo',
    classes: '7ª — 9ª Classe',
    descricao: 'Primeiro ciclo do Ensino Secundário (3 anos). Aprofundamento das ciências e humanidades com base multidisciplinar.',
    cor: Colors.info,
    disciplinas: [
      { nome: 'Língua Portuguesa', codigo: 'LP', horasSemana: 5, horasAnuais: 200, notaMinima: 10, obrigatoria: true },
      { nome: 'Matemática', codigo: 'MAT', horasSemana: 5, horasAnuais: 200, notaMinima: 10, obrigatoria: true },
      { nome: 'Física', codigo: 'FIS', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Química', codigo: 'QUI', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Biologia', codigo: 'BIO', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'História', codigo: 'HIS', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Geografia', codigo: 'GEO', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Língua Estrangeira I', codigo: 'LEI', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Física', codigo: 'EF', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Visual e Plástica', codigo: 'EVP', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
    ],
  },
  {
    nivel: 'II Ciclo',
    classes: '10ª — 13ª Classe',
    descricao: 'Segundo ciclo do Ensino Secundário (4 anos). Preparação para o Ensino Superior e mercado de trabalho.',
    cor: Colors.gold,
    disciplinas: [
      { nome: 'Língua Portuguesa', codigo: 'LP', horasSemana: 4, horasAnuais: 160, notaMinima: 10, obrigatoria: true },
      { nome: 'Matemática', codigo: 'MAT', horasSemana: 5, horasAnuais: 200, notaMinima: 10, obrigatoria: true },
      { nome: 'Física', codigo: 'FIS', horasSemana: 4, horasAnuais: 160, notaMinima: 10, obrigatoria: true },
      { nome: 'Química', codigo: 'QUI', horasSemana: 4, horasAnuais: 160, notaMinima: 10, obrigatoria: true },
      { nome: 'Biologia', codigo: 'BIO', horasSemana: 4, horasAnuais: 160, notaMinima: 10, obrigatoria: true },
      { nome: 'História', codigo: 'HIS', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Geografia', codigo: 'GEO', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Língua Estrangeira I', codigo: 'LEI', horasSemana: 3, horasAnuais: 120, notaMinima: 10, obrigatoria: true },
      { nome: 'Filosofia', codigo: 'FIL', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
      { nome: 'Educação Física', codigo: 'EF', horasSemana: 2, horasAnuais: 80, notaMinima: 10, obrigatoria: true },
    ],
  },
];

function calcTotal(disciplinas: Disciplina[]) {
  return {
    semana: disciplinas.reduce((s, d) => s + d.horasSemana, 0),
    anual: disciplinas.reduce((s, d) => s + d.horasAnuais, 0),
    count: disciplinas.length,
  };
}

export default function GrelhaScreen() {
  const [nivel, setNivel] = useState(0);
  const [detalheDisc, setDetalheDisc] = useState<Disciplina | null>(null);

  const nivelAtual = GRELHA[nivel];
  const total = calcTotal(nivelAtual.disciplinas);

  return (
    <View style={styles.container}>
      <TopBar title="Grelha Curricular" subtitle="Sistema Educativo Angolano" />

      <View style={styles.nivelTabs}>
        {GRELHA.map((n, i) => (
          <TouchableOpacity
            key={n.nivel}
            style={[styles.nivelTab, nivel === i && { borderBottomColor: n.cor, borderBottomWidth: 3 }]}
            onPress={() => setNivel(i)}
          >
            <Text style={[styles.nivelTabText, nivel === i && { color: n.cor }]}>{n.nivel}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.enquadramentoCard, { borderLeftColor: nivelAtual.cor }]}>
          <View style={styles.enquadramentoHeader}>
            <Ionicons name="information-circle" size={20} color={nivelAtual.cor} />
            <Text style={styles.enquadramentoTitle}>Enquadramento</Text>
          </View>
          <Text style={styles.enquadramentoClasses}>{nivelAtual.classes}</Text>
          <Text style={styles.enquadramentoDesc}>{nivelAtual.descricao}</Text>
          <View style={styles.enquadramentoLei}>
            <FontAwesome5 name="balance-scale" size={12} color={Colors.textMuted} />
            <Text style={styles.enquadramentoLeiText}>Lei n.º 17/16 de 7 de Outubro — Lei de Bases do Sistema de Educação e Ensino (Angola)</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: nivelAtual.cor }]}>{total.count}</Text>
            <Text style={styles.statLabel}>Disciplinas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: nivelAtual.cor }]}>{total.semana}h</Text>
            <Text style={styles.statLabel}>Por Semana</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: nivelAtual.cor }]}>{total.anual}h</Text>
            <Text style={styles.statLabel}>Por Ano</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.success }]}>10</Text>
            <Text style={styles.statLabel}>Mín. Aprov.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Disciplinas da Grelha</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Disciplina</Text>
          <Text style={[styles.tableHeaderText, { width: 36, textAlign: 'center' }]}>H/Sem</Text>
          <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'center' }]}>H/Ano</Text>
          <View style={{ width: 24 }} />
        </View>

        {nivelAtual.disciplinas.map((disc, i) => (
          <TouchableOpacity
            key={disc.codigo}
            style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}
            onPress={() => setDetalheDisc(disc)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.discNameRow}>
                <View style={[styles.codBadge, { backgroundColor: nivelAtual.cor + '22' }]}>
                  <Text style={[styles.codText, { color: nivelAtual.cor }]}>{disc.codigo}</Text>
                </View>
                <Text style={styles.discNome} numberOfLines={1}>{disc.nome}</Text>
              </View>
              {disc.observacao && <Text style={styles.discObs}>{disc.observacao}</Text>}
            </View>
            <Text style={[styles.tableCell, { width: 36 }]}>{disc.horasSemana}h</Text>
            <Text style={[styles.tableCell, { width: 50, color: Colors.textMuted }]}>{disc.horasAnuais}h</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[styles.totalValue, { width: 36, color: nivelAtual.cor }]}>{total.semana}h</Text>
          <Text style={[styles.totalValue, { width: 50, color: Colors.textMuted }]}>{total.anual}h</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.sistemaNota}>
          <View style={styles.sistemaHeader}>
            <Ionicons name="school" size={18} color={Colors.gold} />
            <Text style={styles.sistemaNoteTitle}>Sistema de Avaliação</Text>
          </View>
          <View style={styles.sistemaRow}>
            <View style={styles.sistemaItem}>
              <Text style={styles.sistemaItemLabel}>PP (Prova Periódica)</Text>
              <Text style={styles.sistemaItemValue}>30%</Text>
            </View>
            <View style={styles.sistemaItem}>
              <Text style={styles.sistemaItemLabel}>MT (Média de Trabalhos)</Text>
              <Text style={styles.sistemaItemValue}>30%</Text>
            </View>
            <View style={styles.sistemaItem}>
              <Text style={styles.sistemaItemLabel}>PT (Prova Trimestral)</Text>
              <Text style={styles.sistemaItemValue}>40%</Text>
            </View>
          </View>
          <View style={styles.macInfo}>
            <Text style={styles.macLabel}>MAC = (PP + MT + PT) / 3  —  Mínimo de Aprovação: 10 valores</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={!!detalheDisc} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {detalheDisc && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.codBadgeLg, { backgroundColor: nivelAtual.cor + '22' }]}>
                    <Text style={[styles.codTextLg, { color: nivelAtual.cor }]}>{detalheDisc.codigo}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{detalheDisc.nome}</Text>
                    <Text style={styles.modalSub}>{nivelAtual.nivel} — {nivelAtual.classes}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetalheDisc(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={22} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.detalheGrid}>
                  <View style={styles.detalheItem}>
                    <Text style={styles.detalheItemLabel}>Horas / Semana</Text>
                    <Text style={[styles.detalheItemValue, { color: nivelAtual.cor }]}>{detalheDisc.horasSemana}h</Text>
                  </View>
                  <View style={styles.detalheItem}>
                    <Text style={styles.detalheItemLabel}>Horas / Ano</Text>
                    <Text style={[styles.detalheItemValue, { color: nivelAtual.cor }]}>{detalheDisc.horasAnuais}h</Text>
                  </View>
                  <View style={styles.detalheItem}>
                    <Text style={styles.detalheItemLabel}>Nota Mínima</Text>
                    <Text style={[styles.detalheItemValue, { color: Colors.success }]}>{detalheDisc.notaMinima} valores</Text>
                  </View>
                  <View style={styles.detalheItem}>
                    <Text style={styles.detalheItemLabel}>Tipo</Text>
                    <Text style={[styles.detalheItemValue, { color: detalheDisc.obrigatoria ? Colors.accent : Colors.info }]}>
                      {detalheDisc.obrigatoria ? 'Obrigatória' : 'Optativa'}
                    </Text>
                  </View>
                </View>
                {detalheDisc.observacao && (
                  <View style={styles.obsCard}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                    <Text style={styles.obsText}>{detalheDisc.observacao}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  nivelTabs: { flexDirection: 'row', backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  nivelTab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  nivelTabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  scroll: { flex: 1 },
  enquadramentoCard: { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  enquadramentoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  enquadramentoTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  enquadramentoClasses: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 6 },
  enquadramentoDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  enquadramentoLei: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  enquadramentoLeiText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, fontStyle: 'italic', lineHeight: 16 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, paddingHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surface },
  tableHeaderText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tableRowAlt: { backgroundColor: 'rgba(26,43,95,0.3)' },
  discNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  codText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  discNome: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  discObs: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info, marginTop: 2, marginLeft: 50 },
  tableCell: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, textAlign: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface },
  totalLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  totalValue: { fontSize: 14, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  sistemaNota: { margin: 16, backgroundColor: Colors.backgroundCard, borderRadius: 14, padding: 16 },
  sistemaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sistemaNoteTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  sistemaRow: { gap: 8 },
  sistemaItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sistemaItemLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  sistemaItemValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },
  macInfo: { marginTop: 12, backgroundColor: Colors.surface, borderRadius: 8, padding: 10 },
  macLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, width: '100%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  modalSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  modalClose: { padding: 4 },
  codBadgeLg: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codTextLg: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  detalheGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detalheItem: { width: '47%', backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  detalheItemLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 4 },
  detalheItemValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  obsCard: { flexDirection: 'row', gap: 8, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, alignItems: 'flex-start' },
  obsText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.info },
});
