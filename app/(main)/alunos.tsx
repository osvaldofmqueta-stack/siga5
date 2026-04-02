import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useData, Aluno } from '@/context/DataContext';
import { useUsers } from '@/context/UsersContext';
import { alertSucesso } from '@/utils/toast';
import { useConfig } from '@/context/ConfigContext';
import TopBar from '@/components/TopBar';
import QRCodeModal from '@/components/QRCodeModal';
import DatePickerField from '@/components/DatePickerField';
import ProvinciaMunicipioSelector from '@/components/ProvinciaMunicipioSelector';
import ExportMenu from '@/components/ExportMenu';
import { webAlert } from '@/utils/webAlert';

function normalizeEmail(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.');
}

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'Enc@';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function getClasseFromTurma(turmaId: string, turmas: any[]) {
  return turmas.find(t => t.id === turmaId)?.nome ?? '—';
}

function calcIdade(dataNascimento: string) {
  const diff = Date.now() - new Date(dataNascimento).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
}

function AlunoFormModal({ visible, onClose, onSave, aluno, turmas }: any) {
  const [form, setForm] = useState<Partial<Aluno>>(aluno || {
    nome: '', apelido: '', dataNascimento: '2008-01-01', genero: 'M',
    provincia: 'Luanda', municipio: '', turmaId: turmas[0]?.id || '',
    nomeEncarregado: '', telefoneEncarregado: '', emailEncarregado: '', ativo: true,
  });

  const set = (k: keyof Aluno, v: any) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.nome || !form.apelido || !form.turmaId) {
      webAlert('Campos obrigatórios', 'Preencha nome, apelido e turma.');
      return;
    }
    onSave(form);
  }

  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { paddingBottom: bottomPad + 16 }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{aluno ? 'Editar Aluno' : 'Nova Matrícula'}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={Colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            <Text style={modalStyles.sectionLabel}>DADOS DO ALUNO</Text>
            {[
              { label: 'Nome', key: 'nome', placeholder: 'Nome' },
              { label: 'Apelido', key: 'apelido', placeholder: 'Apelido' },
            ].map(f => (
              <View key={f.key} style={modalStyles.field}>
                <Text style={modalStyles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={modalStyles.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Aluno, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            ))}

            <DatePickerField
              label="Data de Nascimento"
              value={form.dataNascimento ?? ''}
              onChange={v => set('dataNascimento', v)}
              required
              style={modalStyles.field}
              labelStyle={modalStyles.fieldLabel}
            />

            <ProvinciaMunicipioSelector
              provinciaValue={form.provincia ?? ''}
              municipioValue={form.municipio ?? ''}
              onProvinciaChange={v => { set('provincia', v); set('municipio', ''); }}
              onMunicipioChange={v => set('municipio', v)}
              labelStyle={modalStyles.fieldLabel}
              fieldStyle={modalStyles.field}
            />

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Género</Text>
              <View style={modalStyles.toggleRow}>
                {(['M', 'F'] as const).map(g => (
                  <TouchableOpacity key={g} style={[modalStyles.toggleBtn, form.genero === g && modalStyles.toggleActive]} onPress={() => set('genero', g)}>
                    <Text style={[modalStyles.toggleText, form.genero === g && modalStyles.toggleTextActive]}>{g === 'M' ? 'Masculino' : 'Feminino'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Turma</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={modalStyles.toggleRow}>
                  {turmas.map((t: any) => (
                    <TouchableOpacity key={t.id} style={[modalStyles.toggleBtn, form.turmaId === t.id && modalStyles.toggleActive]} onPress={() => set('turmaId', t.id)}>
                      <Text style={[modalStyles.toggleText, form.turmaId === t.id && modalStyles.toggleTextActive]}>{t.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Text style={[modalStyles.sectionLabel, { marginTop: 12 }]}>ENCARREGADO DE EDUCAÇÃO</Text>

            {[
              { label: 'Nome Completo', key: 'nomeEncarregado', placeholder: 'Ex: José Manuel Paulo' },
              { label: 'Telefone', key: 'telefoneEncarregado', placeholder: '9XX XXX XXX' },
              { label: 'Email (para acesso ao portal)', key: 'emailEncarregado', placeholder: 'Ex: jose.paulo@gmail.com (opcional)' },
            ].map(f => (
              <View key={f.key} style={modalStyles.field}>
                <Text style={modalStyles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={modalStyles.input}
                  value={(form as any)[f.key] ?? ''}
                  onChangeText={v => set(f.key as keyof Aluno, v)}
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={f.key === 'emailEncarregado' ? 'email-address' : 'default'}
                  autoCapitalize={f.key === 'emailEncarregado' ? 'none' : 'words'}
                />
              </View>
            ))}

            {!aluno && (
              <View style={modalStyles.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
                <Text style={modalStyles.infoText}>
                  Uma conta de acesso ao portal de encarregado será criada automaticamente e as credenciais serão mostradas ao guardar.
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={modalStyles.saveBtn} onPress={handleSave}>
            <Ionicons name="checkmark" size={18} color={Colors.text} />
            <Text style={modalStyles.saveBtnText}>Guardar Matrícula</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CredenciaisModal({ visible, onClose, creds }: { visible: boolean; onClose: () => void; creds: { nome: string; email: string; senha: string; nomeAluno: string; isRegen?: boolean } | null }) {
  if (!creds) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={credStyles.overlay}>
        <View style={credStyles.container}>
          <View style={credStyles.iconRow}>
            <View style={credStyles.iconCircle}>
              <MaterialCommunityIcons name="account-key" size={32} color={Colors.gold} />
            </View>
          </View>
          <Text style={credStyles.title}>{creds.isRegen ? 'Credenciais Geradas!' : 'Conta Criada!'}</Text>
          <Text style={credStyles.subtitle}>
            {creds.isRegen
              ? `A senha de acesso do encarregado de ${creds.nomeAluno} foi regenerada. A senha anterior já não é válida.`
              : `Foram criadas as credenciais de acesso ao portal para o encarregado de ${creds.nomeAluno}.`
            }
          </Text>

          <View style={credStyles.credBox}>
            <Text style={credStyles.credLabel}>ENCARREGADO</Text>
            <Text style={credStyles.credValue}>{creds.nome}</Text>

            <View style={credStyles.separator} />

            <Text style={credStyles.credLabel}>EMAIL DE ACESSO</Text>
            <View style={credStyles.credRow}>
              <Ionicons name="mail" size={16} color={Colors.gold} />
              <Text style={credStyles.credEmail}>{creds.email}</Text>
            </View>

            <View style={credStyles.separator} />

            <Text style={credStyles.credLabel}>{creds.isRegen ? 'NOVA SENHA' : 'SENHA INICIAL'}</Text>
            <View style={credStyles.credRow}>
              <Ionicons name="lock-closed" size={16} color={Colors.gold} />
              <Text style={credStyles.credSenha}>{creds.senha}</Text>
            </View>
          </View>

          <Text style={credStyles.warningText}>
            Anote estas credenciais e entregue ao encarregado. O encarregado acede ao portal em: <Text style={{ color: Colors.info }}>Portal do Encarregado</Text>
          </Text>

          <TouchableOpacity style={credStyles.closeBtn} onPress={onClose}>
            <Text style={credStyles.closeBtnText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AlunosScreen() {
  const router = useRouter();
  const { alunos, turmas, addAluno, updateAluno, deleteAluno } = useData();
  const { addUser, users, updateUser } = useUsers();
  const { config } = useConfig();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAluno, setEditAluno] = useState<Aluno | null>(null);
  const [qrData, setQrData] = useState<{ data: string; title: string; subtitle: string } | null>(null);
  const [credenciais, setCredenciais] = useState<{ nome: string; email: string; senha: string; nomeAluno: string } | null>(null);
  const [showCredenciais, setShowCredenciais] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [atribuirTurmaAluno, setAtribuirTurmaAluno] = useState<Aluno | null>(null);

  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const alunosSemTurma = useMemo(() => alunos.filter(a => a.ativo && !a.turmaId), [alunos]);

  const filtered = useMemo(() => {
    return alunos.filter(a => {
      const nome = `${a.nome} ${a.apelido}`.toLowerCase();
      const searchMatch = nome.includes(search.toLowerCase()) || a.numeroMatricula.toLowerCase().includes(search.toLowerCase());
      const turmaMatch = filterTurma === 'sem-turma'
        ? !a.turmaId
        : !filterTurma || a.turmaId === filterTurma;
      return searchMatch && turmaMatch;
    });
  }, [alunos, search, filterTurma]);

  async function handleAtribuirTurmaRapida(aluno: Aluno, turmaId: string) {
    await updateAluno(aluno.id, { turmaId } as any);
    setAtribuirTurmaAluno(null);
    alertSucesso('Turma atribuída', `${aluno.nome} ${aluno.apelido} foi atribuído à turma.`);
  }

  async function handleSave(form: Partial<Aluno>) {
    const isNew = !editAluno;

    if (editAluno) {
      await updateAluno(editAluno.id, form);
    } else {
      const totalAlunos = alunos.length;
      const novoAluno = await addAluno({
        ...form,
        numeroMatricula: `AL-2025-${String(totalAlunos + 1).padStart(3, '0')}`,
        ativo: true,
      } as any);

      if (isNew && form.nomeEncarregado) {
        try {
          const escola = config?.nomeEscola || 'SIGE Escola';
          const nomeEnc = form.nomeEncarregado.trim();
          const emailBase = normalizeEmail(nomeEnc);
          const emailEnc = form.emailEncarregado?.trim() || `enc.${emailBase}@escola.ao`;
          const senha = gerarSenha();
          const alunoId = (novoAluno as any)?.id;

          await addUser({
            nome: nomeEnc,
            email: emailEnc,
            senha,
            role: 'encarregado',
            escola,
            ativo: true,
            alunoId: alunoId ?? undefined,
          } as any);

          if (emailEnc) {
            await updateAluno(alunoId, { emailEncarregado: emailEnc } as any).catch(() => {});
          }

          setCredenciais({
            nome: nomeEnc,
            email: emailEnc,
            senha,
            nomeAluno: `${form.nome} ${form.apelido}`,
          });
          setShowCredenciais(true);
        } catch (err) {
          console.warn('Erro ao criar conta encarregado:', err);
        }
      }
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    alertSucesso(
      editAluno ? 'Aluno actualizado' : 'Aluno registado',
      editAluno
        ? `Os dados de ${form.nome} ${form.apelido} foram actualizados.`
        : `${form.nome} ${form.apelido} foi registado com sucesso.`
    );
    setShowForm(false);
    setEditAluno(null);
  }

  async function handleVerCredenciais(aluno: Aluno) {
    setRegenerating(aluno.id);
    try {
      const escola = config?.nomeEscola || 'SIGE Escola';
      const encExistente = users.find(u => u.alunoId === aluno.id && u.role === 'encarregado');

      if (encExistente) {
        const novaSenha = gerarSenha();
        await updateUser(encExistente.id, { senha: novaSenha });
        setCredenciais({
          nome: encExistente.nome,
          email: encExistente.email,
          senha: novaSenha,
          nomeAluno: `${aluno.nome} ${aluno.apelido}`,
          isRegen: true,
        } as any);
        setShowCredenciais(true);
      } else {
        const nomeEnc = aluno.nomeEncarregado?.trim() || 'Encarregado';
        const emailBase = normalizeEmail(nomeEnc);
        const emailEnc = aluno.emailEncarregado?.trim() || `enc.${emailBase}@escola.ao`;
        const senha = gerarSenha();

        await addUser({
          nome: nomeEnc,
          email: emailEnc,
          senha,
          role: 'encarregado',
          escola,
          ativo: true,
          alunoId: aluno.id,
        } as any);

        await updateAluno(aluno.id, { emailEncarregado: emailEnc } as any).catch(() => {});

        setCredenciais({
          nome: nomeEnc,
          email: emailEnc,
          senha,
          nomeAluno: `${aluno.nome} ${aluno.apelido}`,
        });
        setShowCredenciais(true);
      }
    } catch {
      webAlert('Erro', 'Não foi possível gerar as credenciais. Tente novamente.');
    } finally {
      setRegenerating(null);
    }
  }

  function confirmDelete(aluno: Aluno) {
    webAlert('Remover Aluno', `Remover ${aluno.nome} ${aluno.apelido}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => deleteAluno(aluno.id) },
    ]);
  }

  const renderAluno = ({ item }: { item: Aluno }) => {
    const turmaName = getClasseFromTurma(item.turmaId, turmas);
    const idade = calcIdade(item.dataNascimento);
    const semTurma = !item.turmaId;
    return (
      <View style={[styles.alunoCard, semTurma && { borderLeftWidth: 3, borderLeftColor: Colors.warning }]}>
        <View style={[styles.avatar, { backgroundColor: item.genero === 'F' ? `${Colors.accent}30` : `${Colors.info}30` }]}>
          <Text style={[styles.avatarText, { color: item.genero === 'F' ? Colors.accent : Colors.info }]}>
            {item.nome.charAt(0)}{item.apelido.charAt(0)}
          </Text>
        </View>
        <View style={styles.alunoInfo}>
          <Text style={styles.alunoNome}>{item.nome} {item.apelido}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text style={styles.alunoMeta}>{item.numeroMatricula} · {idade} anos</Text>
            {semTurma ? (
              <TouchableOpacity
                onPress={() => setAtribuirTurmaAluno(item)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.warning + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.warning + '50' }}
              >
                <Ionicons name="warning-outline" size={10} color={Colors.warning} />
                <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.warning }}>Sem turma — Toque para atribuir</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.alunoMeta}>· {turmaName}</Text>
            )}
          </View>
          <Text style={styles.alunoProvinvia}>{item.provincia} · {item.genero === 'M' ? 'Masculino' : 'Feminino'}</Text>
          {item.emailEncarregado && (
            <View style={styles.encRow}>
              <MaterialCommunityIcons name="account-key" size={11} color={Colors.gold} />
              <Text style={styles.encEmail}>{item.emailEncarregado}</Text>
            </View>
          )}
        </View>
        <View style={styles.alunoActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(main)/boletim-matricula' as any)}>
            <Ionicons name="newspaper-outline" size={18} color={Colors.warning} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setQrData({ data: `SGAA|ALUNO|${item.id}|${item.numeroMatricula}|${item.nome} ${item.apelido}`, title: item.nome + ' ' + item.apelido, subtitle: item.numeroMatricula })}>
            <Ionicons name="qr-code-outline" size={18} color={Colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleVerCredenciais(item)} disabled={regenerating === item.id}>
            <MaterialCommunityIcons name="account-key" size={18} color={regenerating === item.id ? Colors.textMuted : '#F97316'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditAluno(item); setShowForm(true); }}>
            <Ionicons name="create-outline" size={18} color={Colors.info} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Alunos" subtitle={`${filtered.length} alunos`} rightAction={{ icon: 'person-add', onPress: () => { setEditAluno(null); setShowForm(true); } }} />

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Pesquisar por nome ou matrícula..."
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
        <ExportMenu
          title="Lista de Alunos"
          columns={[
            { header: 'Nº Matrícula', key: 'numeroMatricula', width: 16 },
            { header: 'Nome Completo', key: 'nomeCompleto', width: 26 },
            { header: 'Turma', key: 'turmaNome', width: 14 },
            { header: 'Género', key: 'genero', width: 10 },
            { header: 'Data Nasc.', key: 'dataNascimento', width: 14 },
            { header: 'Província', key: 'provincia', width: 14 },
            { header: 'Encarregado', key: 'nomeEncarregado', width: 24 },
            { header: 'Tel. Encarregado', key: 'telefoneEncarregado', width: 18 },
            { header: 'Estado', key: 'estado', width: 10 },
          ]}
          rows={filtered.map(a => ({
            numeroMatricula: a.numeroMatricula,
            nomeCompleto: `${a.nome} ${a.apelido}`,
            turmaNome: turmas.find(t => t.id === a.turmaId)?.nome ?? '—',
            genero: a.genero === 'M' ? 'Masculino' : 'Feminino',
            dataNascimento: a.dataNascimento,
            provincia: a.provincia,
            nomeEncarregado: a.nomeEncarregado ?? '',
            telefoneEncarregado: a.telefoneEncarregado ?? '',
            estado: a.ativo ? 'Activo' : 'Inactivo',
          }))}
          school={{ nomeEscola: config?.nomeEscola ?? 'Escola' }}
          filename="lista_alunos"
        />
      </View>

      {alunosSemTurma.length > 0 && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warning + '15', borderRadius: 10, marginHorizontal: 16, marginBottom: 8, padding: 10, borderWidth: 1, borderColor: Colors.warning + '40' }}
          onPress={() => setFilterTurma(filterTurma === 'sem-turma' ? '' : 'sem-turma')}
        >
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.warning }}>
            {alunosSemTurma.length} aluno{alunosSemTurma.length !== 1 ? 's' : ''} sem turma atribuída
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.warning, textDecorationLine: 'underline' }}>
            {filterTurma === 'sem-turma' ? 'Ver todos' : 'Ver'}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.filterChip, !filterTurma && styles.filterChipActive]} onPress={() => setFilterTurma('')}>
          <Text style={[styles.filterChipText, !filterTurma && styles.filterChipTextActive]}>Todas</Text>
        </TouchableOpacity>
        {turmas.map(t => (
          <TouchableOpacity key={t.id} style={[styles.filterChip, filterTurma === t.id && styles.filterChipActive]} onPress={() => setFilterTurma(t.id)}>
            <Text style={[styles.filterChipText, filterTurma === t.id && styles.filterChipTextActive]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
        {alunosSemTurma.length > 0 && (
          <TouchableOpacity style={[styles.filterChip, filterTurma === 'sem-turma' && { backgroundColor: Colors.warning, borderColor: Colors.warning }]} onPress={() => setFilterTurma(filterTurma === 'sem-turma' ? '' : 'sem-turma')}>
            <Text style={[styles.filterChipText, filterTurma === 'sem-turma' && { color: '#000' }]}>Sem Turma ({alunosSemTurma.length})</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderAluno}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum aluno encontrado</Text>
          </View>
        }
      />

      {showForm && (
        <AlunoFormModal
          visible={showForm}
          onClose={() => { setShowForm(false); setEditAluno(null); }}
          onSave={handleSave}
          aluno={editAluno}
          turmas={turmas}
        />
      )}

      {qrData && (
        <QRCodeModal
          visible={!!qrData}
          onClose={() => setQrData(null)}
          data={qrData.data}
          title={qrData.title}
          subtitle={qrData.subtitle}
        />
      )}

      <CredenciaisModal
        visible={showCredenciais}
        onClose={() => setShowCredenciais(false)}
        creds={credenciais}
      />

      {/* Modal de atribuição rápida de turma */}
      {atribuirTurmaAluno && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setAtribuirTurmaAluno(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 24, paddingBottom: bottomPad + 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text }}>Atribuir Turma</Text>
                <TouchableOpacity onPress={() => setAtribuirTurmaAluno(null)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 16 }}>
                Seleccione a turma para <Text style={{ fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{atribuirTurmaAluno.nome} {atribuirTurmaAluno.apelido}</Text>
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {turmas.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: Colors.textMuted, fontFamily: 'Inter_400Regular', padding: 16 }}>
                    Não existem turmas criadas. Crie uma turma primeiro.
                  </Text>
                ) : (
                  turmas.map((t: any) => (
                    <TouchableOpacity
                      key={t.id}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border }}
                      onPress={() => handleAtribuirTurmaRapida(atribuirTurmaAluno, t.id)}
                    >
                      <View>
                        <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text }}>{t.nome}</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary }}>{t.classe} · {t.turno} · {t.anoLetivo}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const credStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { backgroundColor: Colors.backgroundCard, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, padding: 24, width: '100%', maxWidth: 420 },
  iconRow: { alignItems: 'center', marginBottom: 16 },
  iconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: `${Colors.gold}20`, borderWidth: 1.5, borderColor: `${Colors.gold}50`, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  credBox: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 18, marginBottom: 16 },
  credLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  credValue: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credEmail: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.info, flex: 1 },
  credSenha: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold, letterSpacing: 2 },
  separator: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  warningText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  closeBtn: { backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: Colors.backgroundCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: Colors.border, padding: 20, maxHeight: '90%', width: '100%', maxWidth: 480 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 12 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  toggleActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  toggleText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  toggleTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: `${Colors.info}12`, borderRadius: 12, borderWidth: 1, borderColor: `${Colors.info}30`, padding: 12, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 18 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 12 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundCard, marginHorizontal: 16, marginVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, gap: 8, height: 44 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text },
  filterScroll: { maxHeight: 44 },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: `${Colors.gold}20`, borderColor: Colors.gold },
  filterChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.goldLight, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16 },
  separator: { height: 8 },
  alunoCard: { backgroundColor: Colors.backgroundCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  alunoInfo: { flex: 1, gap: 2 },
  alunoNome: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  alunoMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  alunoProvinvia: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  encEmail: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.gold },
  alunoActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
});
