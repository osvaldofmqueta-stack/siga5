import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Alert, Platform, Image,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pickAndUploadPhoto } from '@/lib/uploadPhoto';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFinanceiro, formatAOA } from '@/context/FinanceiroContext';
import { useAnoAcademico } from '@/context/AnoAcademicoContext';
import GestaoAcessosPanel from '@/components/GestaoAcessosPanel';
import TopBar from '@/components/TopBar';

const PROVINCIAS = ['Luanda', 'Benguela', 'Huambo', 'Bié', 'Malanje', 'Uíge', 'Zaire', 'Cabinda', 'Kwanza Norte', 'Kwanza Sul', 'Lunda Norte', 'Lunda Sul', 'Huíla', 'Namibe', 'Moxico', 'Cuando Cubango', 'Cunene', 'Kuando Kubango'];

function AvatarCircle({ nome, avatar, size = 72, fontSize = 28 }: { nome: string; avatar?: string; size?: number; fontSize?: number }) {
  const initials = nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize }]}>{initials}</Text>
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={16} color={Colors.gold} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value, editable, onEdit }: { label: string; value: string; editable?: boolean; onEdit?: () => void }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue} numberOfLines={2}>{value || '—'}</Text>
        {editable && (
          <TouchableOpacity onPress={onEdit} style={styles.editIcon}>
            <Ionicons name="pencil" size={14} color={Colors.gold} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador', director: 'Director',
  secretaria: 'Secretaria', professor: 'Professor', aluno: 'Aluno', financeiro: 'Financeiro',
  encarregado: 'Encarregado',
};
const ROLE_COLOR: Record<string, string> = {
  ceo: '#8B5CF6', pca: '#F59E0B', admin: '#3B82F6', director: Colors.accent,
  secretaria: Colors.gold, professor: Colors.info, aluno: Colors.success,
  financeiro: '#10B981', encarregado: '#F97316',
};

export default function PerfilScreen() {
  const { user, updateUser, setBiometric, logout } = useAuth();
  const { alunos, professores, turmas, notas, presencas } = useData();
  const { pagamentos, taxas, bloqueados, getTotalRecebido, getTotalPendente, getMesesEmAtraso } = useFinanceiro();
  const { anoSelecionado } = useAnoAcademico();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [biometricEnabled, setBiometricState] = useState(user?.biometricEnabled || false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const roleLabel = ({
    ceo: 'CEO / Super Administrador',
    pca: 'Presidente do Conselho',
    admin: 'Administrador',
    director: 'Director Académico',
    secretaria: 'Secretaria',
    professor: 'Professor',
    aluno: 'Aluno',
  } as Record<string, string>)[user.role] || user.role;

  const roleBadgeColor = ({
    ceo: '#8B5CF6',
    pca: '#F59E0B',
    admin: '#3B82F6',
    director: Colors.accent,
    secretaria: Colors.gold,
    professor: Colors.info,
    aluno: Colors.success,
  } as Record<string, string>)[user.role] || Colors.textMuted;

  function startEdit(field: string, currentValue: string) {
    setEditField(field);
    setEditValue(currentValue || '');
  }

  async function saveEdit() {
    if (!editField) return;
    await updateUser({ [editField]: editValue });
    setEditField(null);
  }

  async function handleBiometric(val: boolean) {
    setBiometricState(val);
    await setBiometric(val);
  }

  async function handlePickPhoto() {
    const url = await pickAndUploadPhoto();
    if (url) {
      await updateUser({ avatar: url });
    }
  }

  async function doLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login' as any);
    } catch {
      setIsLoggingOut(false);
      setConfirmLogout(false);
    }
  }

  // Role-specific stats
  function renderRoleSection() {
    if (user.role === 'ceo' || user.role === 'pca' || user.role === 'admin') {
      const anoAtual = anoSelecionado?.ano || String(new Date().getFullYear());
      const totalAlunos = alunos.filter(a => a.ativo).length;
      const totalProf = professores.filter(p => p.ativo).length;
      const totalTurmas = turmas.filter(t => t.ativo).length;
      const mediaNotas = notas.length > 0 ? (notas.reduce((s, n) => s + n.mac, 0) / notas.length).toFixed(1) : '—';

      // PCA financial data
      const totalRecebido = getTotalRecebido(anoAtual);
      const totalPendente = getTotalPendente(anoAtual);
      const totalPagamentos = pagamentos.filter(p => p.ano === anoAtual && p.status === 'pago').length;
      const alunosBloqueados = bloqueados.length;
      const alunosEmAtraso = alunos.filter(a => a.ativo && getMesesEmAtraso(a.id, anoAtual) > 0).length;
      const taxaPropina = taxas.find(t => t.tipo === 'propina' && t.ativo);
      const taxaTotal = taxaPropina ? (taxaPropina.valor * totalAlunos * 11) : 0;
      const taxaCobranca = taxaTotal > 0 ? Math.round((totalRecebido / taxaTotal) * 100) : 0;

      // Monthly breakdown (paid per month)
      const MESES_LET = [
        { num: 9, nome: 'Set' }, { num: 10, nome: 'Out' }, { num: 11, nome: 'Nov' },
        { num: 12, nome: 'Dez' }, { num: 1, nome: 'Jan' }, { num: 2, nome: 'Fev' },
        { num: 3, nome: 'Mar' }, { num: 4, nome: 'Abr' }, { num: 5, nome: 'Mai' },
        { num: 6, nome: 'Jun' }, { num: 7, nome: 'Jul' },
      ];
      const anoBase = parseInt(anoAtual.split('/')[0]) || new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1;

      return (
        <>
          <View style={styles.card}>
            <SectionHeader title="Visão Geral do Sistema" icon="shield-checkmark" />
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.info }]}>{totalAlunos}</Text>
                <Text style={styles.statLbl}>Alunos</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.gold }]}>{totalProf}</Text>
                <Text style={styles.statLbl}>Professores</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.success }]}>{totalTurmas}</Text>
                <Text style={styles.statLbl}>Turmas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: Colors.accent }]}>{mediaNotas}</Text>
                <Text style={styles.statLbl}>Média Geral</Text>
              </View>
            </View>
            <InfoRow label="Cargo" value={roleLabel} />
            <InfoRow label="Instituição" value={user.escola} />
          </View>

          {/* Painel Financeiro — visível ao PCA e Administradores */}
          <View style={styles.card}>
            <SectionHeader title="Controlo Financeiro" icon="cash" />

            {/* KPIs principais */}
            <View style={styles.statsGrid}>
              <View style={[styles.statItem, { borderTopWidth: 2, borderTopColor: Colors.success }]}>
                <Text style={[styles.statNum, { color: Colors.success, fontSize: 13 }]}>{formatAOA(totalRecebido)}</Text>
                <Text style={styles.statLbl}>Recebido</Text>
              </View>
              <View style={[styles.statItem, { borderTopWidth: 2, borderTopColor: Colors.warning }]}>
                <Text style={[styles.statNum, { color: Colors.warning, fontSize: 13 }]}>{formatAOA(totalPendente)}</Text>
                <Text style={styles.statLbl}>Pendente</Text>
              </View>
              <View style={[styles.statItem, { borderTopWidth: 2, borderTopColor: Colors.info }]}>
                <Text style={[styles.statNum, { color: Colors.info }]}>{totalPagamentos}</Text>
                <Text style={styles.statLbl}>Transacções</Text>
              </View>
            </View>

            {/* Taxa de cobrança */}
            <View style={{ marginTop: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.statLbl}>Taxa de Cobrança {anoAtual}</Text>
                <Text style={[styles.statLbl, { color: taxaCobranca >= 80 ? Colors.success : taxaCobranca >= 50 ? Colors.warning : Colors.danger, fontFamily: 'Inter_700Bold' }]}>
                  {taxaCobranca}%
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{
                  height: 8, borderRadius: 4,
                  width: `${Math.min(taxaCobranca, 100)}%`,
                  backgroundColor: taxaCobranca >= 80 ? Colors.success : taxaCobranca >= 50 ? Colors.warning : Colors.danger,
                }} />
              </View>
            </View>

            {/* Alertas */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <View style={{ flex: 1, minWidth: 120, backgroundColor: Colors.danger + '18', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.danger + '44' }}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={[styles.statNum, { color: Colors.danger }]}>{alunosEmAtraso}</Text>
                <Text style={styles.statLbl}>Alunos em Atraso</Text>
              </View>
              <View style={{ flex: 1, minWidth: 120, backgroundColor: Colors.warning + '18', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.warning + '44' }}>
                <Ionicons name="lock-closed" size={16} color={Colors.warning} />
                <Text style={[styles.statNum, { color: Colors.warning }]}>{alunosBloqueados}</Text>
                <Text style={styles.statLbl}>Bloqueados</Text>
              </View>
              <View style={{ flex: 1, minWidth: 120, backgroundColor: Colors.success + '18', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.success + '44' }}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={[styles.statNum, { color: Colors.success }]}>{totalAlunos - alunosEmAtraso}</Text>
                <Text style={styles.statLbl}>Em Dia</Text>
              </View>
            </View>

            {/* Distribuição mensal */}
            <Text style={[styles.statLbl, { marginTop: 14, marginBottom: 6 }]}>PAGAMENTOS POR MÊS — {anoAtual}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {MESES_LET.map(m => {
                const anoMes = m.num >= 8 ? anoBase : anoBase + 1;
                const countPago = pagamentos.filter(p =>
                  p.mes === m.num && p.ano === String(anoMes) && p.status === 'pago'
                ).length;
                const totalMes = pagamentos.filter(p =>
                  p.mes === m.num && p.ano === String(anoMes)
                ).reduce((s, p) => s + (p.status === 'pago' ? p.valor : 0), 0);
                const isAtual = m.num === mesAtual;
                return (
                  <View key={m.num} style={{
                    flex: 1, minWidth: 70, borderRadius: 6, padding: 6,
                    backgroundColor: countPago > 0 ? Colors.success + '18' : Colors.border,
                    borderWidth: isAtual ? 2 : 1,
                    borderColor: isAtual ? Colors.gold : countPago > 0 ? Colors.success + '55' : Colors.border,
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: countPago > 0 ? Colors.success : Colors.textMuted }}>
                      {m.nome}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: countPago > 0 ? Colors.success : Colors.textMuted }}>
                      {countPago}
                    </Text>
                    {totalMes > 0 && (
                      <Text style={{ fontSize: 7, color: Colors.textMuted, fontFamily: 'Inter_400Regular' }}>
                        {formatAOA(totalMes)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, backgroundColor: Colors.primary + '22', borderRadius: 8, paddingVertical: 10, borderWidth: 1, borderColor: Colors.primary + '55' }}
              onPress={() => router.push('/financeiro' as any)}
            >
              <Ionicons name="analytics" size={16} color={Colors.primary} />
              <Text style={{ color: Colors.primary, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Abrir Gestão Financeira Completa</Text>
            </TouchableOpacity>
          </View>
        </>
      );
    }

    if (user.role === 'director') {
      const totalAlunos = alunos.filter(a => a.ativo).length;
      const totalProf = professores.filter(p => p.ativo).length;
      const totalTurmas = turmas.filter(t => t.ativo).length;
      const mediaNotas = notas.length > 0 ? (notas.reduce((s, n) => s + n.mac, 0) / notas.length).toFixed(1) : '—';
      return (
        <View style={styles.card}>
          <SectionHeader title="Estatísticas da Escola" icon="bar-chart" />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.info }]}>{totalAlunos}</Text>
              <Text style={styles.statLbl}>Alunos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.gold }]}>{totalProf}</Text>
              <Text style={styles.statLbl}>Professores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.success }]}>{totalTurmas}</Text>
              <Text style={styles.statLbl}>Turmas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.accent }]}>{mediaNotas}</Text>
              <Text style={styles.statLbl}>Média Notas</Text>
            </View>
          </View>
          <InfoRow label="Cargo" value="Director Geral" editable onEdit={() => {}} />
          <InfoRow label="Departamento" value="Direcção Académica" editable onEdit={() => {}} />
        </View>
      );
    }

    if (user.role === 'secretaria') {
      const totalRegistos = alunos.length;
      const totalEventos = 12;
      return (
        <View style={styles.card}>
          <SectionHeader title="Dados da Secretaria" icon="document-text" />
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.info }]}>{totalRegistos}</Text>
              <Text style={styles.statLbl}>Registos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: Colors.gold }]}>{totalEventos}</Text>
              <Text style={styles.statLbl}>Processos</Text>
            </View>
          </View>
          <InfoRow label="Cargo" value="Técnica de Secretaria" editable onEdit={() => {}} />
          <InfoRow label="Departamento" value="Secretaria Escolar" editable onEdit={() => {}} />
        </View>
      );
    }

    if (user.role === 'professor') {
      const prof = professores.find(p => p.email === user.email);
      const minhasTurmas = prof ? turmas.filter(t => prof.turmasIds.includes(t.id)) : [];
      const meusAlunos = prof ? alunos.filter(a => minhasTurmas.some(t => t.id === a.turmaId)).length : 0;
      return (
        <View style={styles.card}>
          <SectionHeader title="Dados do Professor" icon="school" />
          {prof && (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.info }]}>{minhasTurmas.length}</Text>
                  <Text style={styles.statLbl}>Turmas</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.gold }]}>{meusAlunos}</Text>
                  <Text style={styles.statLbl}>Alunos</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.success }]}>{prof.disciplinas.length}</Text>
                  <Text style={styles.statLbl}>Disciplinas</Text>
                </View>
              </View>
              <InfoRow label="N.º Professor" value={prof.numeroProfessor} />
              <InfoRow label="Habilitações" value={prof.habilitacoes} />
              <InfoRow label="Disciplinas" value={prof.disciplinas.join(', ')} />
              <InfoRow label="Turmas" value={minhasTurmas.map(t => t.nome).join(', ')} />
            </>
          )}
        </View>
      );
    }

    if (user.role === 'aluno') {
      const aluno = alunos.find(a => a.nome.includes(user.nome.split(' ')[0]));
      const turmaAluno = aluno ? turmas.find(t => t.id === aluno.turmaId) : null;
      const notasAluno = aluno ? notas.filter(n => n.alunoId === aluno.id) : [];
      const mediaAluno = notasAluno.length > 0 ? (notasAluno.reduce((s, n) => s + n.mac, 0) / notasAluno.length).toFixed(1) : '—';
      const presAluno = aluno ? presencas.filter(p => p.alunoId === aluno.id) : [];
      const pctPresenca = presAluno.length > 0 ? Math.round((presAluno.filter(p => p.status === 'P').length / presAluno.length) * 100) : 100;

      return (
        <View style={styles.card}>
          <SectionHeader title="Dados Académicos" icon="library" />
          {aluno && (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.gold }]}>{mediaAluno}</Text>
                  <Text style={styles.statLbl}>Média</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.success }]}>{pctPresenca}%</Text>
                  <Text style={styles.statLbl}>Presenças</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: Colors.info }]}>{notasAluno.length}</Text>
                  <Text style={styles.statLbl}>Avaliações</Text>
                </View>
              </View>
              <InfoRow label="N.º Matrícula" value={aluno.numeroMatricula} />
              <InfoRow label="Turma" value={turmaAluno?.nome || '—'} />
              <InfoRow label="Nível" value={turmaAluno?.nivel || '—'} />
              <InfoRow label="Encarregado" value={aluno.nomeEncarregado} />
              <InfoRow label="Tel. Encarregado" value={aluno.telefoneEncarregado} />
              <TouchableOpacity
                style={styles.portalBtn}
                onPress={() => router.push('/(main)/portal-estudante' as any)}
              >
                <Ionicons name="grid" size={18} color="#fff" />
                <Text style={styles.portalBtnText}>Aceder ao Portal do Estudante</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.container}>
      <TopBar title="Perfil" subtitle="Dados pessoais e configurações" />

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: bottomInset + 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickPhoto} activeOpacity={0.8}>
            <AvatarCircle nome={user.nome} avatar={(user as any).avatar} size={80} fontSize={30} />
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
            <View style={[styles.roleIndicator, { backgroundColor: roleBadgeColor }]}>
              <Text style={styles.roleIndicatorText}>{roleLabel}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user.nome}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          <Text style={styles.profileEscola}>{user.escola}</Text>
        </View>

        {/* Role-specific section */}
        {renderRoleSection()}

        {/* Dados Pessoais */}
        <View style={styles.card}>
          <SectionHeader title="Dados Pessoais" icon="person" />
          <InfoRow label="Nome completo" value={user.nome} editable onEdit={() => startEdit('nome', user.nome)} />
          <InfoRow label="Email" value={user.email} editable onEdit={() => startEdit('email', user.email)} />
          <InfoRow label="Instituição" value={user.escola} editable onEdit={() => startEdit('escola', user.escola)} />
          <InfoRow label="Telefone" value="923 000 000" editable onEdit={() => {}} />
          <InfoRow label="BI / Passaporte" value="006348521LA041" editable onEdit={() => {}} />
          <InfoRow label="Data de Nascimento" value="01/01/1985" editable onEdit={() => {}} />
          <InfoRow label="Endereço" value="Rua da Missão, N.º 45, Luanda" editable onEdit={() => {}} />
          <InfoRow label="Município" value="Luanda" editable onEdit={() => {}} />
          <InfoRow label="Província" value="Luanda" editable onEdit={() => {}} />
        </View>

        {/* Segurança */}
        <View style={styles.card}>
          <SectionHeader title="Segurança" icon="lock-closed" />
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Ionicons name="finger-print" size={20} color={Colors.info} />
              <View>
                <Text style={styles.switchLabel}>Autenticação Biométrica</Text>
                <Text style={styles.switchSub}>Face ID / Impressão Digital</Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometric}
              trackColor={{ false: Colors.border, true: Colors.info + '66' }}
              thumbColor={biometricEnabled ? Colors.info : Colors.textMuted}
            />
          </View>
          <TouchableOpacity style={styles.actionRow} onPress={() => Alert.alert('Mudar Senha', 'Funcionalidade disponível na próxima versão.')}>
            <Ionicons name="key" size={18} color={Colors.gold} />
            <Text style={styles.actionLabel}>Mudar Senha</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sessão */}
        <View style={styles.card}>
          <SectionHeader title="Sessão" icon="time" />
          <InfoRow label="Último acesso" value={new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          <InfoRow label="Dispositivo" value={Platform.OS === 'web' ? 'Navegador Web' : Platform.OS === 'ios' ? 'iPhone' : 'Android'} />
          <InfoRow label="Versão da app" value="SGAA v1.0.0" />
        </View>

        {/* Centro de Controlo de Acessos — CEO / PCA */}
        {(user.role === 'ceo' || user.role === 'pca') && (
          <View style={styles.card}>
            <SectionHeader title="Controlo de Acessos e Permissões" icon="shield-checkmark" />
            <GestaoAcessosPanel />
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => setConfirmLogout(true)}>
          <Ionicons name="log-out-outline" size={20} color={Colors.accent} />
          <Text style={styles.logoutText}>Terminar Sessão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Confirm Modal */}
      {confirmLogout && (
        <View style={styles.editOverlay}>
          <View style={[styles.editBox, { alignItems: 'center', gap: 6 }]}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(231,76,60,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Ionicons name="log-out" size={26} color={Colors.danger} />
            </View>
            <Text style={[styles.editTitle, { textAlign: 'center' }]}>Terminar Sessão?</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
              A sua sessão será encerrada.
            </Text>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => setConfirmLogout(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, { backgroundColor: Colors.danger, opacity: isLoggingOut ? 0.6 : 1 }]}
                onPress={doLogout}
                disabled={isLoggingOut}
              >
                <Text style={styles.editSaveText}>{isLoggingOut ? 'A sair...' : 'Sair'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Modal */}
      {editField && (
        <View style={styles.editOverlay}>
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Editar Campo</Text>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              placeholderTextColor={Colors.textMuted}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditField(null)}>
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
                <Text style={styles.editSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  profileHeader: { alignItems: 'center', padding: 28, paddingBottom: 20, backgroundColor: Colors.primaryDark, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatarWrapper: { alignItems: 'center', marginBottom: 12, position: 'relative' },
  cameraOverlay: { position: 'absolute', bottom: 18, right: -2, backgroundColor: Colors.accent, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.backgroundCard },
  avatarCircle: { backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.gold },
  avatarText: { fontFamily: 'Inter_700Bold', color: '#fff' },
  roleIndicator: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12 },
  roleIndicatorText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 4 },
  profileEmail: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, marginBottom: 2 },
  profileEscola: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  card: { margin: 16, marginBottom: 0, backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionHeaderText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  statItem: { flex: 1, minWidth: '22%', backgroundColor: Colors.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoValue: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  editIcon: { padding: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  switchInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  switchLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  switchSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, marginTop: 16, padding: 15, backgroundColor: Colors.accent + '22', borderRadius: 14, borderWidth: 1, borderColor: Colors.accent + '44' },
  logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.accent },
  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, padding: 13, backgroundColor: Colors.accent, borderRadius: 12 },
  portalBtnText: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff', textAlign: 'center' },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editBox: { backgroundColor: Colors.backgroundCard, borderRadius: 16, padding: 20, width: '100%' },
  editTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 14 },
  editInput: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  editActions: { flexDirection: 'row', gap: 10 },
  editCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center' },
  editCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  editSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center' },
  editSaveText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
});
