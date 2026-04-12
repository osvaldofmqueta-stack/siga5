import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, TextInput, Platform, Modal, Clipboard,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import {
  usePermissoes,
  FEATURE_CATEGORIES,
  ROLE_DEFAULTS,
  PermKey,
} from '@/context/PermissoesContext';
import TopBar from '@/components/TopBar';
import { getRoleLabel } from '@/utils/genero';

const TIPO_CONTRATO = [
  { id: 'efectivo',           label: 'Efectivo',             color: '#4CAF50' },
  { id: 'colaborador',        label: 'Colaborador',          color: '#2196F3' },
  { id: 'contratado',         label: 'Contratado',           color: '#FF9800' },
  { id: 'prestacao_servicos', label: 'Prestação de Serviços', color: '#9C27B0' },
];

const PROFESSOR_ROLES = ['professor', 'diretor_turma'];
const ROLES_RESET_SENHA = ['ceo', 'pca', 'admin', 'director', 'subdiretor_administrativo', 'chefe_secretaria'];

const ROLE_COLOR: Record<string, string> = {
  ceo: '#8B5CF6', pca: '#F59E0B', admin: '#3B82F6', director: Colors.accent,
  subdiretor_administrativo: '#7C3AED',
  chefe_secretaria: '#E11D48',
  secretaria: Colors.gold, professor: Colors.info,
  diretor_turma: '#0EA5E9',
  aluno: Colors.success, financeiro: '#10B981',
  encarregado: '#F97316', rh: '#06B6D4',
  pedagogico: '#D97706',
};
const ROLE_ICON: Record<string, string> = {
  admin: 'shield-checkmark', director: 'briefcase',
  subdiretor_administrativo: 'business',
  chefe_secretaria: 'star', secretaria: 'documents',
  professor: 'book', diretor_turma: 'ribbon',
  aluno: 'school', financeiro: 'cash',
  encarregado: 'people', rh: 'person-circle',
  pedagogico: 'medal',
};

const MANAGEABLE_ROLES = [
  'professor', 'aluno', 'secretaria', 'financeiro', 'rh',
  'pedagogico', 'director', 'subdiretor_administrativo',
  'chefe_secretaria', 'admin', 'diretor_turma', 'encarregado',
];

const ALL_KEYS = FEATURE_CATEGORIES.flatMap(c => c.features.map(f => f.key));
const TOTAL_FEATURES = FEATURE_CATEGORIES.reduce((s, c) => s + c.features.length, 0);

function initials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

type TabType = 'utilizadores' | 'perfis';

export default function GestaoAcessosScreen() {
  const { user } = useAuth();
  const { users } = useUsers();
  const {
    getUserPermissions, saveUserPermissions, resetUserPermissions,
    getRolePermissions, saveRolePermissions, resetRolePermissions,
    isLoading, reload, hasPermission,
  } = usePermissoes();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const [activeTab, setActiveTab] = useState<TabType>('utilizadores');

  // ── Utilizadores tab state ──
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editedPerms, setEditedPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [searchPerms, setSearchPerms] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));

  // ── Vínculo do professor ──
  const [professorRecordId, setProfessorRecordId] = useState<string | null>(null);
  const [selectedVinculo, setSelectedVinculo] = useState<string>('efectivo');

  // ── Reset de senha ──
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ tempPassword: string; userNome: string; userEmail: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Perfis tab state ──
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editedRolePerms, setEditedRolePerms] = useState<Record<string, boolean>>({});
  const [savingRole, setSavingRole] = useState(false);
  const [savedRole, setSavedRole] = useState(false);
  const [searchRole, setSearchRole] = useState('');
  const [searchRolePerms, setSearchRolePerms] = useState('');
  const [expandedRoleCats, setExpandedRoleCats] = useState<Set<string>>(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));

  const canManage = user?.role === 'ceo' || user?.role === 'pca' || hasPermission('gestao_acessos');
  const canResetSenha = user?.role ? ROLES_RESET_SENHA.includes(user.role) : false;

  // ── Utilizadores tab logic ──
  const filteredUsers = users.filter(u =>
    u.id !== user?.id &&
    (u.nome.toLowerCase().includes(search.toLowerCase()) ||
      getRoleLabel(u.role, (u as any).genero).toLowerCase().includes(search.toLowerCase()))
  );
  const selectedUser = users.find(u => u.id === selectedUserId);

  // ── Filtro de perfis de cargo ──
  const filteredRoles = MANAGEABLE_ROLES.filter(role =>
    getRoleLabel(role, '').toLowerCase().includes(searchRole.toLowerCase())
  );

  // ── Filtragem de categorias de permissões ──
  function filterCategories(q: string) {
    if (!q.trim()) return FEATURE_CATEGORIES;
    const lq = q.toLowerCase();
    return FEATURE_CATEGORIES
      .map(cat => ({
        ...cat,
        features: cat.features.filter(f =>
          f.label.toLowerCase().includes(lq) || f.desc.toLowerCase().includes(lq)
        ),
      }))
      .filter(cat => cat.features.length > 0);
  }
  const visibleCats = filterCategories(searchPerms);
  const visibleRoleCats = filterCategories(searchRolePerms);

  useEffect(() => {
    if (!selectedUserId || !selectedUser) return;
    const perms = getUserPermissions(selectedUserId, selectedUser.role);
    setEditedPerms({ ...perms });
    setSaved(false);
  }, [selectedUserId, isLoading]);

  // ── Busca o registo do professor quando um utilizador professor é seleccionado ──
  useEffect(() => {
    if (!selectedUserId || !selectedUser) {
      setProfessorRecordId(null);
      setSelectedVinculo('efectivo');
      return;
    }
    if (!PROFESSOR_ROLES.includes(selectedUser.role)) {
      setProfessorRecordId(null);
      setSelectedVinculo('efectivo');
      return;
    }
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@siga_token');
        const res = await fetch('/api/professores', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : data.professores ?? [];
        const prof = list.find((p: any) =>
          (p.utilizadorId && (p.utilizadorId === selectedUserId || p.utilizadorId === String(selectedUserId))) ||
          (selectedUser?.email && p.email && p.email.toLowerCase() === selectedUser.email.toLowerCase())
        );
        if (prof) {
          setProfessorRecordId(prof.id);
          setSelectedVinculo(prof.tipoContrato ?? 'efectivo');
        } else {
          setProfessorRecordId(null);
          setSelectedVinculo('efectivo');
        }
      } catch {
        setProfessorRecordId(null);
        setSelectedVinculo('efectivo');
      }
    })();
  }, [selectedUserId]);

  // ── Perfis tab logic ──
  useEffect(() => {
    if (!selectedRole) return;
    const perms = getRolePermissions(selectedRole);
    setEditedRolePerms({ ...perms });
    setSavedRole(false);
  }, [selectedRole, isLoading]);

  function togglePerm(key: PermKey) {
    setEditedPerms(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }
  function toggleRolePerm(key: PermKey) {
    setEditedRolePerms(prev => ({ ...prev, [key]: !prev[key] }));
    setSavedRole(false);
  }

  function toggleCategory(categoria: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(categoria)) next.delete(categoria);
      else next.add(categoria);
      return next;
    });
  }
  function toggleRoleCategory(categoria: string) {
    setExpandedRoleCats(prev => {
      const next = new Set(prev);
      if (next.has(categoria)) next.delete(categoria);
      else next.add(categoria);
      return next;
    });
  }

  async function handleSave() {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await saveUserPermissions(selectedUserId, editedPerms);

      // Se o utilizador for professor, actualiza também o tipo de vínculo no perfil
      if (professorRecordId && selectedUser && PROFESSOR_ROLES.includes(selectedUser.role)) {
        const token = await AsyncStorage.getItem('@siga_token');
        await fetch(`/api/professores/${professorRecordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ tipoContrato: selectedVinculo }),
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!selectedUserId || !selectedUser) return;
    setSaving(true);
    try {
      await resetUserPermissions(selectedUserId);
      const defaults = ROLE_DEFAULTS[selectedUser.role] || [];
      const resetted: Record<string, boolean> = {};
      FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => {
        resetted[f.key] = defaults.includes(f.key as PermKey);
      }));
      setEditedPerms(resetted);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRole() {
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      await saveRolePermissions(selectedRole, editedRolePerms);
      setSavedRole(true);
      setTimeout(() => setSavedRole(false), 2500);
    } finally {
      setSavingRole(false);
    }
  }

  async function handleResetRole() {
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      await resetRolePermissions(selectedRole);
      const defaults = ROLE_DEFAULTS[selectedRole] || [];
      const resetted: Record<string, boolean> = {};
      FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => {
        resetted[f.key] = defaults.includes(f.key as PermKey);
      }));
      setEditedRolePerms(resetted);
      setSavedRole(true);
      setTimeout(() => setSavedRole(false), 2500);
    } finally {
      setSavingRole(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedUserId) return;
    setResetLoading(true);
    setResetError(null);
    setResetResult(null);
    try {
      const token = await AsyncStorage.getItem('@siga_token');
      const res = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || 'Erro ao redefinir senha.');
      } else {
        setResetResult({ tempPassword: data.tempPassword, userNome: data.userNome, userEmail: data.userEmail });
      }
    } catch {
      setResetError('Erro de ligação. Tente novamente.');
    } finally {
      setResetLoading(false);
    }
  }

  function handleCopyPassword() {
    if (!resetResult) return;
    Clipboard.setString(resetResult.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function enableAll() {
    const all: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => { all[f.key] = true; }));
    setEditedPerms(all);
    setSaved(false);
  }
  function disableAll() {
    const none: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => { none[f.key] = false; }));
    setEditedPerms(none);
    setSaved(false);
  }
  function enableAllRole() {
    const all: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => { all[f.key] = true; }));
    setEditedRolePerms(all);
    setSavedRole(false);
  }
  function disableAllRole() {
    const none: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(cat => cat.features.forEach(f => { none[f.key] = false; }));
    setEditedRolePerms(none);
    setSavedRole(false);
  }

  function countActive(cat: typeof FEATURE_CATEGORIES[0], perms: Record<string, boolean>) {
    return cat.features.filter(f => perms[f.key]).length;
  }

  if (!canManage) {
    return (
      <View style={styles.container}>
        <TopBar title="Gestão de Acessos" subtitle="Controlo de permissões" />
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={48} color={Colors.danger} />
          <Text style={styles.noAccessTitle}>Acesso Restrito</Text>
          <Text style={styles.noAccessSub}>Apenas CEO e PCA podem gerir permissões.</Text>
        </View>
      </View>
    );
  }

  const totalEnabled = Object.values(editedPerms).filter(Boolean).length;
  const totalRoleEnabled = Object.values(editedRolePerms).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <TopBar title="Gestão de Acessos" subtitle="Permissões por utilizador e por cargo" />

      {/* ── Tab Switcher ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabCard, activeTab === 'utilizadores' && styles.tabCardActive]}
          onPress={() => setActiveTab('utilizadores')}
          activeOpacity={0.8}
        >
          <View style={[styles.tabCardIconBox, { backgroundColor: activeTab === 'utilizadores' ? Colors.gold + '25' : Colors.surface }]}>
            <Ionicons name="people" size={22} color={activeTab === 'utilizadores' ? Colors.gold : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tabCardTitle, activeTab === 'utilizadores' && { color: Colors.gold }]}>
              Utilizadores
            </Text>
            <Text style={styles.tabCardDesc}>Permissões individuais por utilizador</Text>
          </View>
          {activeTab === 'utilizadores' && <Ionicons name="checkmark-circle" size={18} color={Colors.gold} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabCard, activeTab === 'perfis' && styles.tabCardActive]}
          onPress={() => setActiveTab('perfis')}
          activeOpacity={0.8}
        >
          <View style={[styles.tabCardIconBox, { backgroundColor: activeTab === 'perfis' ? Colors.accent + '25' : Colors.surface }]}>
            <Ionicons name="shield-half" size={22} color={activeTab === 'perfis' ? Colors.accent : Colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tabCardTitle, activeTab === 'perfis' && { color: Colors.accent }]}>
              Perfis de Cargo
            </Text>
            <Text style={styles.tabCardDesc}>Professor · Aluno · Secretaria · e mais…</Text>
          </View>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>NOVO</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {activeTab === 'utilizadores' ? (
          <>
            {/* ── Painel esquerdo: lista de utilizadores ── */}
            <View style={styles.leftPanel}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar utilizador..."
                  placeholderTextColor={Colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredUsers.length === 0 && (
                  <Text style={styles.emptyMsg}>Nenhum utilizador encontrado</Text>
                )}
                {filteredUsers.map(u => {
                  const isSelected = u.id === selectedUserId;
                  const roleColor = ROLE_COLOR[u.role] || Colors.textMuted;
                  const perms = getUserPermissions(u.id, u.role);
                  const active = Object.values(perms).filter(Boolean).length;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.listCard, isSelected && styles.listCardSelected]}
                      onPress={() => { setSelectedUserId(u.id); setSaved(false); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.userAvatar, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
                        <Text style={[styles.userAvatarText, { color: roleColor }]}>{initials(u.nome)}</Text>
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={[styles.listName, isSelected && { color: Colors.gold }]} numberOfLines={1}>
                          {u.nome}
                        </Text>
                        <View style={[styles.rolePill, { backgroundColor: roleColor + '20' }]}>
                          <Text style={[styles.rolePillText, { color: roleColor }]}>{getRoleLabel(u.role, (u as any).genero)}</Text>
                        </View>
                        <Text style={styles.permCount}>{active}/{TOTAL_FEATURES} funcionalidades</Text>
                      </View>
                      {isSelected && <Ionicons name="chevron-forward" size={16} color={Colors.gold} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Painel direito: matrix de permissões ── */}
            <View style={styles.rightPanel}>
              {!selectedUser ? (
                <View style={styles.noSelection}>
                  <MaterialCommunityIcons name="account-key" size={52} color={Colors.border} />
                  <Text style={styles.noSelTitle}>Selecione um utilizador</Text>
                  <Text style={styles.noSelSub}>Escolha um utilizador na lista para gerir as suas permissões individuais.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.permHeader}>
                    <View style={[styles.permUserAvatar, { backgroundColor: ROLE_COLOR[selectedUser.role] + '22' }]}>
                      <Text style={[styles.permUserAvatarText, { color: ROLE_COLOR[selectedUser.role] }]}>
                        {initials(selectedUser.nome)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permUserName}>{selectedUser.nome}</Text>
                      <Text style={styles.permUserEmail}>{selectedUser.email}</Text>
                      <View style={[styles.rolePill, { backgroundColor: ROLE_COLOR[selectedUser.role] + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.rolePillText, { color: ROLE_COLOR[selectedUser.role] }]}>
                          {getRoleLabel(selectedUser.role, (selectedUser as any).genero)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBox}>
                      <Text style={styles.progressNum}>{totalEnabled}</Text>
                      <Text style={styles.progressDen}>/{TOTAL_FEATURES}</Text>
                      <Text style={styles.progressLbl}>activas</Text>
                    </View>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {
                      width: `${(totalEnabled / TOTAL_FEATURES) * 100}%`,
                      backgroundColor: totalEnabled > TOTAL_FEATURES * 0.7 ? Colors.success : totalEnabled > TOTAL_FEATURES * 0.4 ? Colors.warning : Colors.danger,
                    }]} />
                  </View>

                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.qBtn} onPress={enableAll}>
                      <Ionicons name="checkmark-done" size={14} color={Colors.success} />
                      <Text style={[styles.qBtnText, { color: Colors.success }]}>Activar Tudo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qBtn} onPress={disableAll}>
                      <Ionicons name="close-circle-outline" size={14} color={Colors.danger} />
                      <Text style={[styles.qBtnText, { color: Colors.danger }]}>Desactivar Tudo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qBtn} onPress={handleReset}>
                      <MaterialCommunityIcons name="restore" size={14} color={Colors.info} />
                      <Text style={[styles.qBtnText, { color: Colors.info }]}>Repor Padrão</Text>
                    </TouchableOpacity>
                    {canResetSenha && (
                      <TouchableOpacity
                        style={[styles.qBtn, { borderColor: Colors.warning + '55', backgroundColor: Colors.warning + '10' }]}
                        onPress={() => { setResetResult(null); setResetError(null); setResetModalVisible(true); }}
                      >
                        <Ionicons name="key" size={14} color={Colors.warning} />
                        <Text style={[styles.qBtnText, { color: Colors.warning }]}>Reset Senha</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Pesquisa de permissões */}
                  <View style={styles.permSearchBox}>
                    <Ionicons name="search" size={15} color={Colors.textMuted} />
                    <TextInput
                      style={styles.permSearchInput}
                      placeholder="Pesquisar permissão..."
                      placeholderTextColor={Colors.textMuted}
                      value={searchPerms}
                      onChangeText={setSearchPerms}
                    />
                    {searchPerms.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchPerms('')}>
                        <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
                  >
                    {visibleCats.length === 0 && (
                      <View style={styles.noSearchResult}>
                        <Ionicons name="search" size={32} color={Colors.border} />
                        <Text style={styles.noSearchResultText}>Nenhuma permissão encontrada para "{searchPerms}"</Text>
                      </View>
                    )}
                    {visibleCats.map(cat => {
                      const isExpanded = searchPerms.trim() ? true : expandedCats.has(cat.categoria);
                      const activeInCat = countActive(cat, editedPerms);
                      const isProfessor = selectedUser && PROFESSOR_ROLES.includes(selectedUser.role);
                      return (
                        <View key={cat.categoria} style={styles.catCard}>
                          <TouchableOpacity
                            style={styles.catHeader}
                            onPress={() => toggleCategory(cat.categoria)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={cat.icon as any} size={18} color={Colors.gold} />
                            <Text style={styles.catTitle}>{cat.categoria}</Text>
                            <View style={styles.catBadge}>
                              <Text style={[styles.catBadgeText, { color: activeInCat === cat.features.length ? Colors.success : activeInCat === 0 ? Colors.danger : Colors.warning }]}>
                                {activeInCat}/{cat.features.length}
                              </Text>
                            </View>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                          </TouchableOpacity>
                          {isExpanded && cat.features.map((feat, idx) => {
                            const isOn = editedPerms[feat.key] === true;
                            const isRoleFeature = feat.roles.includes(selectedUser.role);
                            const isLastFeat = idx === cat.features.length - 1;
                            const showVinculo = feat.key === 'alterar_tipo_contrato' && isProfessor && professorRecordId;
                            return (
                              <View key={feat.key}>
                                <View style={[styles.featRow, isLastFeat && !showVinculo && { borderBottomWidth: 0 }]}>
                                  <View style={styles.featInfo}>
                                    <View style={styles.featLabelRow}>
                                      <Text style={[styles.featLabel, !isOn && { color: Colors.textMuted }]}>{feat.label}</Text>
                                      {!isRoleFeature && (
                                        <View style={styles.outOfRolePill}>
                                          <Text style={styles.outOfRoleText}>Fora do cargo</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={styles.featDesc} numberOfLines={1}>{feat.desc}</Text>
                                  </View>
                                  <Switch
                                    value={isOn}
                                    onValueChange={() => togglePerm(feat.key as PermKey)}
                                    trackColor={{ false: Colors.border, true: Colors.success + '66' }}
                                    thumbColor={isOn ? Colors.success : Colors.textMuted}
                                  />
                                </View>
                                {showVinculo && (
                                  <View style={[styles.vinculoRow, isLastFeat && { borderBottomWidth: 0 }]}>
                                    <View style={styles.vinculoHeader}>
                                      <Ionicons name="link" size={13} color={Colors.gold} />
                                      <Text style={styles.vinculoTitle}>Tipo de Vínculo Contratual</Text>
                                    </View>
                                    <View style={styles.vinculoTags}>
                                      {TIPO_CONTRATO.map(t => {
                                        const isActive = selectedVinculo === t.id;
                                        return (
                                          <TouchableOpacity
                                            key={t.id}
                                            style={[
                                              styles.vinculoTag,
                                              isActive && { backgroundColor: `${t.color}22`, borderColor: t.color + '99' },
                                            ]}
                                            onPress={() => { setSelectedVinculo(t.id); setSaved(false); }}
                                            activeOpacity={0.75}
                                          >
                                            {isActive && <Ionicons name="checkmark-circle" size={12} color={t.color} />}
                                            <Text style={[styles.vinculoTagText, isActive && { color: t.color, fontFamily: 'Inter_600SemiBold' }]}>
                                              {t.label}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      })}
                                    </View>
                                    <Text style={styles.vinculoHint}>
                                      Afecta o cálculo salarial. Guardado junto com as permissões.
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.saveBar}>
                    {saved ? (
                      <View style={styles.savedConfirm}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                        <Text style={styles.savedText}>Permissões guardadas!</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                        onPress={handleSave}
                        disabled={saving}
                      >
                        {saving
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="save" size={18} color="#fff" />
                        }
                        <Text style={styles.saveBtnText}>{saving ? 'A guardar...' : 'Guardar Alterações'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            {/* ── Painel esquerdo: lista de perfis/cargos ── */}
            <View style={styles.leftPanel}>
              <View style={styles.profilesHeader}>
                <Ionicons name="shield-half" size={18} color={Colors.gold} />
                <Text style={styles.profilesHeaderTitle}>Perfis de Cargo</Text>
              </View>
              <Text style={styles.profilesHeaderDesc}>
                Alterações aqui afectam automaticamente todos os utilizadores do cargo.
              </Text>

              {/* Pesquisa de cargos */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar cargo..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchRole}
                  onChangeText={setSearchRole}
                />
                {searchRole.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchRole('')}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {filteredRoles.length === 0 && (
                  <Text style={styles.emptyMsg}>Nenhum cargo encontrado</Text>
                )}
                {filteredRoles.map(role => {
                  const isSelected = role === selectedRole;
                  const roleColor = ROLE_COLOR[role] || Colors.textMuted;
                  const icon = ROLE_ICON[role] || 'person';
                  const usersOfRole = users.filter(u => u.role === role);
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.listCard, isSelected && styles.listCardSelected]}
                      onPress={() => { setSelectedRole(role); setSavedRole(false); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.roleIconBox, { backgroundColor: roleColor + '22', borderColor: roleColor + '44' }]}>
                        <Ionicons name={icon as any} size={20} color={roleColor} />
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={[styles.listName, isSelected && { color: Colors.gold }]} numberOfLines={1}>
                          {getRoleLabel(role, '')}
                        </Text>
                        <Text style={styles.permCount}>{usersOfRole.length} utilizador{usersOfRole.length !== 1 ? 'es' : ''}</Text>
                      </View>
                      {isSelected && <Ionicons name="chevron-forward" size={16} color={Colors.gold} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Painel direito: matrix de permissões do perfil ── */}
            <View style={styles.rightPanel}>
              {!selectedRole ? (
                <View style={styles.noSelection}>
                  <MaterialCommunityIcons name="shield-account" size={52} color={Colors.border} />
                  <Text style={styles.noSelTitle}>Selecione um perfil de cargo</Text>
                  <Text style={styles.noSelSub}>Escolha um cargo na lista. As permissões definidas aqui aplicam-se a todos os utilizadores desse cargo.</Text>
                </View>
              ) : (
                <>
                  {/* Header do perfil */}
                  <View style={styles.permHeader}>
                    <View style={[styles.permUserAvatar, { backgroundColor: (ROLE_COLOR[selectedRole] || Colors.textMuted) + '22' }]}>
                      <Ionicons
                        name={(ROLE_ICON[selectedRole] || 'person') as any}
                        size={24}
                        color={ROLE_COLOR[selectedRole] || Colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permUserName}>{getRoleLabel(selectedRole, '')}</Text>
                      <Text style={styles.permUserEmail}>
                        {users.filter(u => u.role === selectedRole).length} utilizador(es) afectados
                      </Text>
                      <View style={[styles.rolePill, { backgroundColor: (ROLE_COLOR[selectedRole] || Colors.textMuted) + '20', alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.rolePillText, { color: ROLE_COLOR[selectedRole] || Colors.textMuted }]}>
                          Perfil de Cargo
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBox}>
                      <Text style={styles.progressNum}>{totalRoleEnabled}</Text>
                      <Text style={styles.progressDen}>/{TOTAL_FEATURES}</Text>
                      <Text style={styles.progressLbl}>activas</Text>
                    </View>
                  </View>

                  {/* Info banner */}
                  <View style={styles.infoBanner}>
                    <Ionicons name="information-circle" size={16} color={Colors.info} />
                    <Text style={styles.infoBannerText}>
                      Estas permissões aplicam-se a todos os <Text style={{ fontFamily: 'Inter_700Bold' }}>{getRoleLabel(selectedRole, '')}</Text> que não tenham configuração individual.
                    </Text>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, {
                      width: `${(totalRoleEnabled / TOTAL_FEATURES) * 100}%`,
                      backgroundColor: totalRoleEnabled > TOTAL_FEATURES * 0.7 ? Colors.success : totalRoleEnabled > TOTAL_FEATURES * 0.4 ? Colors.warning : Colors.danger,
                    }]} />
                  </View>

                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.qBtn} onPress={enableAllRole}>
                      <Ionicons name="checkmark-done" size={14} color={Colors.success} />
                      <Text style={[styles.qBtnText, { color: Colors.success }]}>Activar Tudo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qBtn} onPress={disableAllRole}>
                      <Ionicons name="close-circle-outline" size={14} color={Colors.danger} />
                      <Text style={[styles.qBtnText, { color: Colors.danger }]}>Desactivar Tudo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qBtn} onPress={handleResetRole}>
                      <MaterialCommunityIcons name="restore" size={14} color={Colors.info} />
                      <Text style={[styles.qBtnText, { color: Colors.info }]}>Repor Padrão</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pesquisa de permissões do perfil */}
                  <View style={styles.permSearchBox}>
                    <Ionicons name="search" size={15} color={Colors.textMuted} />
                    <TextInput
                      style={styles.permSearchInput}
                      placeholder="Pesquisar permissão..."
                      placeholderTextColor={Colors.textMuted}
                      value={searchRolePerms}
                      onChangeText={setSearchRolePerms}
                    />
                    {searchRolePerms.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchRolePerms('')}>
                        <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
                  >
                    {visibleRoleCats.length === 0 && (
                      <View style={styles.noSearchResult}>
                        <Ionicons name="search" size={32} color={Colors.border} />
                        <Text style={styles.noSearchResultText}>Nenhuma permissão encontrada para "{searchRolePerms}"</Text>
                      </View>
                    )}
                    {visibleRoleCats.map(cat => {
                      const isExpanded = searchRolePerms.trim() ? true : expandedRoleCats.has(cat.categoria);
                      const activeInCat = countActive(cat, editedRolePerms);
                      return (
                        <View key={cat.categoria} style={styles.catCard}>
                          <TouchableOpacity
                            style={styles.catHeader}
                            onPress={() => toggleRoleCategory(cat.categoria)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={cat.icon as any} size={18} color={Colors.gold} />
                            <Text style={styles.catTitle}>{cat.categoria}</Text>
                            <View style={styles.catBadge}>
                              <Text style={[styles.catBadgeText, { color: activeInCat === cat.features.length ? Colors.success : activeInCat === 0 ? Colors.danger : Colors.warning }]}>
                                {activeInCat}/{cat.features.length}
                              </Text>
                            </View>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                          </TouchableOpacity>
                          {isExpanded && cat.features.map((feat, idx) => {
                            const isOn = editedRolePerms[feat.key] === true;
                            const isRoleDefault = feat.roles.includes(selectedRole);
                            return (
                              <View key={feat.key} style={[styles.featRow, idx === cat.features.length - 1 && { borderBottomWidth: 0 }]}>
                                <View style={styles.featInfo}>
                                  <View style={styles.featLabelRow}>
                                    <Text style={[styles.featLabel, !isOn && { color: Colors.textMuted }]}>{feat.label}</Text>
                                    {!isRoleDefault && (
                                      <View style={styles.outOfRolePill}>
                                        <Text style={styles.outOfRoleText}>Fora do cargo</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.featDesc} numberOfLines={1}>{feat.desc}</Text>
                                </View>
                                <Switch
                                  value={isOn}
                                  onValueChange={() => toggleRolePerm(feat.key as PermKey)}
                                  trackColor={{ false: Colors.border, true: Colors.success + '66' }}
                                  thumbColor={isOn ? Colors.success : Colors.textMuted}
                                />
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.saveBar}>
                    {savedRole ? (
                      <View style={styles.savedConfirm}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                        <Text style={styles.savedText}>Perfil guardado! Todos os {getRoleLabel(selectedRole, '')} foram actualizados.</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.saveBtn, savingRole && { opacity: 0.6 }]}
                        onPress={handleSaveRole}
                        disabled={savingRole}
                      >
                        {savingRole
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="save" size={18} color="#fff" />
                        }
                        <Text style={styles.saveBtnText}>
                          {savingRole ? 'A guardar...' : `Guardar Perfil — ${getRoleLabel(selectedRole, '')}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </View>

      {/* ── Modal Reset de Senha ── */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resetModal}>
            {/* Header */}
            <View style={styles.resetModalHeader}>
              <View style={styles.resetModalIconBox}>
                <Ionicons name="key" size={22} color={Colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetModalTitle}>Redefinir Senha</Text>
                {selectedUser && (
                  <Text style={styles.resetModalSubtitle} numberOfLines={1}>{selectedUser.nome}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setResetModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {!resetResult ? (
              <>
                {/* Aviso antes de confirmar */}
                <View style={styles.resetWarningBox}>
                  <Ionicons name="warning" size={16} color={Colors.warning} />
                  <Text style={styles.resetWarningText}>
                    Isto vai gerar uma senha temporária e invalidar imediatamente a senha actual deste utilizador.
                    Comunique a nova senha ao utilizador pessoalmente ou por canal seguro.
                  </Text>
                </View>

                {resetError && (
                  <View style={styles.resetErrorBox}>
                    <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                    <Text style={styles.resetErrorText}>{resetError}</Text>
                  </View>
                )}

                <View style={styles.resetModalActions}>
                  <TouchableOpacity
                    style={styles.resetCancelBtn}
                    onPress={() => setResetModalVisible(false)}
                  >
                    <Text style={styles.resetCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.resetConfirmBtn, resetLoading && { opacity: 0.6 }]}
                    onPress={handleResetPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="key" size={16} color="#fff" />
                    }
                    <Text style={styles.resetConfirmText}>
                      {resetLoading ? 'A redefinir...' : 'Confirmar Reset'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Resultado — senha temporária */}
                <View style={styles.resetSuccessBox}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={styles.resetSuccessText}>
                    Senha redefinida com sucesso para <Text style={{ fontFamily: 'Inter_700Bold' }}>{resetResult.userNome}</Text>
                  </Text>
                </View>

                <Text style={styles.resetTempLabel}>Senha Temporária</Text>
                <View style={styles.resetTempBox}>
                  <Text style={styles.resetTempPassword} selectable>{resetResult.tempPassword}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={handleCopyPassword}>
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? Colors.success : Colors.gold} />
                    <Text style={[styles.copyBtnText, copied && { color: Colors.success }]}>
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.resetNoteBox}>
                  <Ionicons name="information-circle" size={14} color={Colors.info} />
                  <Text style={styles.resetNoteText}>
                    Comunique esta senha ao utilizador. Recomende que a altere no perfil após o primeiro acesso.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.resetDoneBtn}
                  onPress={() => { setResetModalVisible(false); setResetResult(null); }}
                >
                  <Text style={styles.resetDoneText}>Fechar</Text>
                </TouchableOpacity>
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  tabCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  tabCardActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '0D',
  },
  tabCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text, marginBottom: 2 },
  tabCardDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  tabBadge: { backgroundColor: Colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },

  body: { flex: 1, flexDirection: 'row' },

  // Left panel (shared)
  leftPanel: { width: 260, borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.backgroundCard },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, padding: 0 },

  // List cards (shared)
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  listCardSelected: { backgroundColor: Colors.gold + '15', borderLeftWidth: 3, borderLeftColor: Colors.gold },
  listInfo: { flex: 1 },
  listName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 3 },

  // User avatar
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  userAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Role icon box
  roleIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Profiles header
  profilesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  profilesHeaderTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text },
  profilesHeaderDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, paddingHorizontal: 14, paddingBottom: 10, lineHeight: 16 },

  // Role/perm pills
  rolePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  rolePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  permCount: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  emptyMsg: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', padding: 20 },

  // Right panel
  rightPanel: { flex: 1, backgroundColor: Colors.background },
  noSelection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  noSelTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  noSelSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', maxWidth: 360 },
  noAccess: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noAccessTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.danger },
  noAccessSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Header
  permHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permUserAvatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  permUserAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  permUserName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  permUserEmail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  progressBox: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, minWidth: 60 },
  progressNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
  progressDen: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  progressLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase' },

  // Info banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 12, marginTop: 10, backgroundColor: Colors.info + '15', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.info + '33' },
  infoBannerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 17 },

  progressBarBg: { height: 4, backgroundColor: Colors.border, marginHorizontal: 16, marginVertical: 4, borderRadius: 2 },
  progressBarFill: { height: 4, borderRadius: 2 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.backgroundCard },
  qBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  qBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Permission search bar (inside right panel)
  permSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  permSearchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, padding: 0 },
  noSearchResult: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  noSearchResultText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },

  // Categories
  catScroll: { flex: 1, paddingTop: 8 },
  catCard: { marginHorizontal: 12, marginBottom: 8, backgroundColor: Colors.backgroundCard, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  catTitle: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  catBadge: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  featRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  featInfo: { flex: 1 },
  featLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  featLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  featDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  outOfRolePill: { backgroundColor: Colors.warning + '25', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  outOfRoleText: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.warning },

  // Save bar
  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, backgroundColor: Colors.backgroundCard, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14 },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  savedConfirm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.success + '22', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: Colors.success + '44' },
  savedText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.success },

  // Vínculo selector
  vinculoRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.gold + '08' },
  vinculoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  vinculoTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  vinculoTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vinculoTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  vinculoTagText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  vinculoHint: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 8, lineHeight: 14 },

  // Reset Senha Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  resetModal: { backgroundColor: Colors.backgroundCard, borderRadius: 18, padding: 22, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: Colors.border },
  resetModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  resetModalIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.warning + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.warning + '40' },
  resetModalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  resetModalSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  resetWarningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.warning + '15', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.warning + '40', marginBottom: 16 },
  resetWarningText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.warning, lineHeight: 18 },
  resetErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '15', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.danger + '40', marginBottom: 12 },
  resetErrorText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.danger },
  resetModalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resetCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  resetCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted },
  resetConfirmBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.warning },
  resetConfirmText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  resetSuccessBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.success + '15', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.success + '40', marginBottom: 16 },
  resetSuccessText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.success, lineHeight: 18 },
  resetTempLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  resetTempBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  resetTempPassword: { flex: 1, fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold, letterSpacing: 1.5 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.gold + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.gold + '40' },
  copyBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  resetNoteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.info + '15', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: Colors.info + '30', marginBottom: 16 },
  resetNoteText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.info, lineHeight: 16 },
  resetDoneBtn: { alignItems: 'center', paddingVertical: 13, borderRadius: 10, backgroundColor: Colors.accent },
  resetDoneText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
});
