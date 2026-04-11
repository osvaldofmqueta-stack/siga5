import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador do Sistema',
  director: 'Subdiretor(a) Pedagógico',
  subdiretor_administrativo: 'Subdiretor(a) Administrativo',
  chefe_secretaria: 'Secretaria Académica',
  secretaria: 'Secretaria', professor: 'Professor',
  diretor_turma: 'Professor — Diretor de Turma',
  aluno: 'Aluno', financeiro: 'Gestor Financeiro',
  encarregado: 'Encarregado de Educação', rh: 'Gestor de Recursos Humanos',
  pedagogico: 'Diretor Académico',
};
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
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));

  // ── Perfis tab state ──
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editedRolePerms, setEditedRolePerms] = useState<Record<string, boolean>>({});
  const [savingRole, setSavingRole] = useState(false);
  const [savedRole, setSavedRole] = useState(false);
  const [expandedRoleCats, setExpandedRoleCats] = useState<Set<string>>(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));

  const canManage = user?.role === 'ceo' || user?.role === 'pca' || hasPermission('gestao_acessos');

  // ── Utilizadores tab logic ──
  const filteredUsers = users.filter(u =>
    u.id !== user?.id &&
    (u.nome.toLowerCase().includes(search.toLowerCase()) ||
      ROLE_LABEL[u.role]?.toLowerCase().includes(search.toLowerCase()))
  );
  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (!selectedUserId || !selectedUser) return;
    const perms = getUserPermissions(selectedUserId, selectedUser.role);
    setEditedPerms({ ...perms });
    setSaved(false);
  }, [selectedUserId, isLoading]);

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
                          <Text style={[styles.rolePillText, { color: roleColor }]}>{ROLE_LABEL[u.role]}</Text>
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
                          {ROLE_LABEL[selectedUser.role]}
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
                  </View>

                  <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
                  >
                    {FEATURE_CATEGORIES.map(cat => {
                      const isExpanded = expandedCats.has(cat.categoria);
                      const activeInCat = countActive(cat, editedPerms);
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
                            return (
                              <View key={feat.key} style={[styles.featRow, idx === cat.features.length - 1 && { borderBottomWidth: 0 }]}>
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

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {MANAGEABLE_ROLES.map(role => {
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
                          {ROLE_LABEL[role]}
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
                      <Text style={styles.permUserName}>{ROLE_LABEL[selectedRole]}</Text>
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
                      Estas permissões aplicam-se a todos os <Text style={{ fontFamily: 'Inter_700Bold' }}>{ROLE_LABEL[selectedRole]}</Text> que não tenham configuração individual.
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

                  <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
                  >
                    {FEATURE_CATEGORIES.map(cat => {
                      const isExpanded = expandedRoleCats.has(cat.categoria);
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
                        <Text style={styles.savedText}>Perfil guardado! Todos os {ROLE_LABEL[selectedRole]} foram actualizados.</Text>
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
                          {savingRole ? 'A guardar...' : `Guardar Perfil — ${ROLE_LABEL[selectedRole]}`}
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
});
