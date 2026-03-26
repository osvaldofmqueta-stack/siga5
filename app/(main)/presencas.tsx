import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, Alert, Platform, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Presenca } from '@/context/DataContext';
import { useConfig } from '@/context/ConfigContext';
import { useAuth } from '@/context/AuthContext';
import TopBar from '@/components/TopBar';
import { alertSucesso, alertErro, showToast } from '@/utils/toast';
import ExportMenu from '@/components/ExportMenu';
import { useLookup } from '@/hooks/useLookup';

const { width } = Dimensions.get('window');

function QRScannerModal({ visible, onClose, onScan }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  function handleBarCodeScanned({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScan(data);
  }

  if (!permission) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={scanStyles.overlay}>
          <View style={[scanStyles.container, { paddingBottom: bottomPad + 16 }]}>
            <Text style={scanStyles.loadingText}>A carregar câmara...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {!permission.granted ? (
          <View style={[scanStyles.permissionView, { paddingTop: insets.top + 20 }]}>
            <Ionicons name="camera-outline" size={48} color={Colors.textMuted} />
            <Text style={scanStyles.permissionText}>Permissão de câmara necessária para digitalizar QR codes.</Text>
            <TouchableOpacity style={scanStyles.permBtn} onPress={requestPermission}>
              <Text style={scanStyles.permBtnText}>Permitir Câmara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={scanStyles.cancelBtn} onPress={onClose}>
              <Text style={scanStyles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39'] }}
            />
            <View style={[scanStyles.overlay2, { paddingBottom: bottomPad + 20, paddingTop: insets.top + 16 }]}>
              <TouchableOpacity style={scanStyles.closeOverlay} onPress={onClose}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
              <View style={scanStyles.frame}>
                <View style={[scanStyles.corner, scanStyles.cornerTL]} />
                <View style={[scanStyles.corner, scanStyles.cornerTR]} />
                <View style={[scanStyles.corner, scanStyles.cornerBL]} />
                <View style={[scanStyles.corner, scanStyles.cornerBR]} />
              </View>
              <Text style={scanStyles.scanHint}>Aponte para o QR Code do aluno</Text>
              {scanned && (
                <TouchableOpacity style={scanStyles.rescanBtn} onPress={() => setScanned(false)}>
                  <Text style={scanStyles.rescanText}>Digitalizar Novamente</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function PresencasScreen() {
  const { alunos, turmas, presencas, addPresenca } = useData();
  const { config } = useConfig();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [filterTurma, setFilterTurma] = useState(turmas[0]?.id || '');
  const { values: disciplinasFallback } = useLookup('disciplinas_fallback', [
    'Matemática', 'Português', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Inglês', 'Educação Física', 'Filosofia',
  ]);
  const [disciplinasDisponiveis, setDisciplinasDisponiveis] = useState<string[]>([
    'Matemática', 'Português', 'Física', 'Química', 'Biologia',
    'História', 'Geografia', 'Inglês', 'Educação Física', 'Filosofia',
  ]);
  const [disciplina, setDisciplina] = useState('Matemática');
  const [date] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!filterTurma) {
      setDisciplinasDisponiveis(disciplinasFallback);
      return;
    }
    fetch(`/api/turmas/${filterTurma}/disciplinas`)
      .then(r => r.json())
      .then((list: { nome: string }[]) => {
        if (list && list.length > 0) {
          const nomes = list.map((d: { nome: string }) => d.nome);
          setDisciplinasDisponiveis(nomes);
          setDisciplina(prev => nomes.includes(prev) ? prev : nomes[0]);
        } else {
          setDisciplinasDisponiveis(disciplinasFallback);
        }
      })
      .catch(() => setDisciplinasDisponiveis(disciplinasFallback));
  }, [filterTurma, disciplinasFallback]);

  const [showScanner, setShowScanner] = useState(false);
  const [pendingAluno, setPendingAluno] = useState<string | null>(null);
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const turmaAlunos = useMemo(() => {
    return alunos.filter(a => a.turmaId === filterTurma && a.ativo);
  }, [alunos, filterTurma]);

  const todayPresencas = useMemo(() => {
    return presencas.filter(p => p.data === date && p.turmaId === filterTurma && p.disciplina === disciplina);
  }, [presencas, date, filterTurma, disciplina]);

  function getAlunoStatus(alunoId: string): 'P' | 'F' | 'J' | null {
    const p = todayPresencas.find(p => p.alunoId === alunoId);
    return p ? p.status : null;
  }

  async function markPresenca(alunoId: string, status: 'P' | 'F' | 'J') {
    const existing = todayPresencas.find(p => p.alunoId === alunoId);
    if (existing) return;
    await addPresenca({ alunoId, turmaId: filterTurma, disciplina, data: date, status });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function markAll(status: 'P' | 'F') {
    for (const aluno of turmaAlunos) {
      const existing = todayPresencas.find(p => p.alunoId === aluno.id);
      if (!existing) {
        await addPresenca({ alunoId: aluno.id, turmaId: filterTurma, disciplina, data: date, status });
      }
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    alertSucesso(
      status === 'P' ? 'Presenças registadas' : 'Faltas registadas',
      `Todos os alunos foram marcados como ${status === 'P' ? 'Presentes' : 'Faltosos'}.`
    );
  }

  function handleQRScan(data: string) {
    setShowScanner(false);
    const parts = data.split('|');
    if (parts[0] === 'SGAA' && parts[1] === 'ALUNO') {
      const alunoId = parts[2];
      const aluno = alunos.find(a => a.id === alunoId);
      if (aluno) {
        markPresenca(alunoId, 'P');
        showToast(`${aluno.nome} ${aluno.apelido} marcado como Presente.`, 'success');
      } else {
        showToast('QR Code não reconhecido. Aluno não encontrado.', 'error');
      }
    } else {
      showToast('QR Code inválido. Não pertence ao SGAA.', 'error');
    }
  }

  const stats = useMemo(() => {
    const present = todayPresencas.filter(p => p.status === 'P').length;
    const absent = todayPresencas.filter(p => p.status === 'F').length;
    const justified = todayPresencas.filter(p => p.status === 'J').length;
    return { present, absent, justified, total: turmaAlunos.length };
  }, [todayPresencas, turmaAlunos]);

  const statusColors = { P: Colors.success, F: Colors.danger, J: Colors.warning };
  const statusLabels = { P: 'P', F: 'F', J: 'J' };

  const renderAluno = ({ item }: { item: typeof alunos[0] }) => {
    const status = getAlunoStatus(item.id);
    return (
      <View style={styles.row}>
        <View style={[styles.initials, { backgroundColor: status ? `${statusColors[status]}15` : Colors.surface }]}>
          <Text style={[styles.initialsText, { color: status ? statusColors[status] : Colors.textMuted }]}>
            {item.nome.charAt(0)}{item.apelido.charAt(0)}
          </Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowNome}>{item.nome} {item.apelido}</Text>
          <Text style={styles.rowMeta}>{item.numeroMatricula}</Text>
        </View>
        <View style={styles.statusBtns}>
          {(['P', 'F', 'J'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusBtn, status === s && { backgroundColor: statusColors[s] }]}
              onPress={() => markPresenca(item.id, s)}
              disabled={!!status}
            >
              <Text style={[styles.statusBtnText, status === s && { color: Colors.text }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Presenças" subtitle={date} rightAction={{ icon: 'qr-code-outline', onPress: () => setShowScanner(true) }} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {turmas.map(t => (
          <TouchableOpacity key={t.id} style={[styles.chip, filterTurma === t.id && styles.chipActive]} onPress={() => setFilterTurma(t.id)}>
            <Text style={[styles.chipText, filterTurma === t.id && styles.chipTextActive]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {disciplinasDisponiveis.map(d => (
          <TouchableOpacity key={d} style={[styles.chip, disciplina === d && styles.chipActive]} onPress={() => setDisciplina(d)}>
            <Text style={[styles.chipText, disciplina === d && styles.chipTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.statsBar}>
        {[
          { label: 'Presentes', value: stats.present, color: Colors.success },
          { label: 'Faltas', value: stats.absent, color: Colors.danger },
          { label: 'Justific.', value: stats.justified, color: Colors.warning },
          { label: 'Total', value: stats.total, color: Colors.textSecondary },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bulkActions}>
        <TouchableOpacity style={[styles.bulkBtn, { borderColor: `${Colors.success}40` }]} onPress={() => markAll('P')}>
          <Ionicons name="checkmark-done" size={14} color={Colors.success} />
          <Text style={[styles.bulkBtnText, { color: Colors.success }]}>Todos Presentes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bulkBtn, { borderColor: `${Colors.danger}40` }]} onPress={() => markAll('F')}>
          <Ionicons name="close" size={14} color={Colors.danger} />
          <Text style={[styles.bulkBtnText, { color: Colors.danger }]}>Todos Faltaram</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bulkBtn, { borderColor: `${Colors.gold}40` }]} onPress={() => setShowScanner(true)}>
          <Ionicons name="qr-code" size={14} color={Colors.gold} />
          <Text style={[styles.bulkBtnText, { color: Colors.gold }]}>QR Code</Text>
        </TouchableOpacity>
        <ExportMenu
          title={`Presenças — ${turmas.find(t => t.id === filterTurma)?.nome ?? ''} — ${date}`}
          columns={[
            { header: 'Nº Matrícula', key: 'matricula', width: 14 },
            { header: 'Nome Completo', key: 'nome', width: 26 },
            { header: 'Turma', key: 'turma', width: 12 },
            { header: 'Disciplina', key: 'disciplina', width: 16 },
            { header: 'Data', key: 'data', width: 12 },
            { header: 'Estado', key: 'estado', width: 12 },
          ]}
          rows={turmaAlunos.map(a => {
            const p = todayPresencas.find(pr => pr.alunoId === a.id);
            return {
              matricula: a.numeroMatricula,
              nome: `${a.nome} ${a.apelido}`,
              turma: turmas.find(t => t.id === filterTurma)?.nome ?? '',
              disciplina,
              data: date,
              estado: p ? (p.status === 'P' ? 'Presente' : p.status === 'F' ? 'Falta' : 'Justificado') : 'Não marcado',
            };
          })}
          school={{ nomeEscola: config?.nomeEscola ?? 'Escola' }}
          filename={`presencas_${filterTurma}_${date}`}
          subtitle={`Disciplina: ${disciplina}`}
        />
      </View>

      <FlatList
        data={turmaAlunos}
        keyExtractor={i => i.id}
        renderItem={renderAluno}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="people-outline" size={36} color={Colors.textMuted} /><Text style={styles.emptyText}>Seleccione uma turma</Text></View>}
      />

      <QRScannerModal visible={showScanner} onClose={() => setShowScanner(false)} onScan={handleQRScan} />
    </View>
  );
}

const scanStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, alignItems: 'center', gap: 16, width: '100%', maxWidth: 480 },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  permissionView: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permissionText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  cancelBtn: { paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  overlay2: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  closeOverlay: { position: 'absolute', top: 0, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: Colors.gold },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanHint: { color: Colors.text, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 20, textAlign: 'center' },
  rescanBtn: { marginTop: 16, backgroundColor: Colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  rescanText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filterScroll: { maxHeight: 46 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 6, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  bulkActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  bulkBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: Colors.backgroundCard },
  bulkBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16 },
  row: { backgroundColor: Colors.backgroundCard, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  initials: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rowInfo: { flex: 1, gap: 2 },
  rowNome: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  rowMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  statusBtns: { flexDirection: 'row', gap: 5 },
  statusBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  statusBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
