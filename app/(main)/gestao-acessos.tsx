import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
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
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador', director: 'Director',
  secretaria: 'Secretaria', professor: 'Professor', aluno: 'Aluno', financeiro: 'Financeiro',
  encarregado: 'Encarregado',
};
const ROLE_COLOR: Record<string, string> = {
  ceo: '#8B5CF6', pca: '#F59E0B', admin: '#3B82F6', director: Colors.accent,
  secretaria: Colors.gold, professor: Colors.info, aluno: Colors.success, financeiro: '#10B981',
  encarregado: '#F97316',
};

function initials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function GestaoAcessosScreen() {
  const { user } = useAuth();
  const { users } = useUsers();
  const { getUserPermissions, saveUserPermissions, resetUserPermissions, isLoading, reload } = usePermissoes();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editedPerms, setEditedPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));

  const canManage = user?.role === 'ceo' || user?.role === 'pca';

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

  function togglePerm(key: PermKey) {
    setEditedPerms(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function toggleCategory(categoria: string) {
    setExpandedCats(prev => {
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

  function getRelevantCategories() {
    if (!selectedUser) return FEATURE_CATEGORIES;
    return FEATURE_CATEGORIES.filter(cat =>
      cat.features.some(f => f.roles.includes(selectedUser.role) || Object.keys(editedPerms).length > 0)
    );
  }

  function countActive(cat: typeof FEATURE_CATEGORIES[0]) {
    return cat.features.filter(f => editedPerms[f.key]).length;
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
  const totalFeatures = FEATURE_CATEGORIES.reduce((s, c) => s + c.features.length, 0);

  return (
    <View style={styles.container}>
      <TopBar title="Gestão de Acessos" subtitle="Controlo de permissões por utilizador" />

      <View style={styles.body}>
        {/* ── Painel esquerdo: lista de utilizadores ── */}
        <View style={styles.userPanel}>
          {/* Pesquisa */}
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
                  style={[styles.userCard, isSelected && styles.userCardSelected]}
                  onPress={() => {
                    setSelectedUserId(u.id);
                    setSaved(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.userAvatar, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
                    <Text style={[styles.userAvatarText, { color: roleColor }]}>{initials(u.nome)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, isSelected && { color: Colors.gold }]} numberOfLines={1}>
                      {u.nome}
                    </Text>
                    <View style={styles.userMeta}>
                      <View style={[styles.rolePill, { backgroundColor: roleColor + '20' }]}>
                        <Text style={[styles.rolePillText, { color: roleColor }]}>{ROLE_LABEL[u.role]}</Text>
                      </View>
                    </View>
                    <Text style={styles.permCount}>{active}/{totalFeatures} funcionalidades</Text>
                  </View>
                  {isSelected && <Ionicons name="chevron-forward" size={16} color={Colors.gold} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Painel direito: matrix de permissões ── */}
        <View style={styles.permPanel}>
          {!selectedUser ? (
            <View style={styles.noSelection}>
              <MaterialCommunityIcons name="account-key" size={52} color={Colors.border} />
              <Text style={styles.noSelTitle}>Selecione um utilizador</Text>
              <Text style={styles.noSelSub}>Escolha um utilizador na lista para gerir as suas permissões de acesso.</Text>
            </View>
          ) : (
            <>
              {/* Header do utilizador */}
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
                {/* Progresso */}
                <View style={styles.progressBox}>
                  <Text style={styles.progressNum}>{totalEnabled}</Text>
                  <Text style={styles.progressDen}>/{totalFeatures}</Text>
                  <Text style={styles.progressLbl}>activas</Text>
                </View>
              </View>

              {/* Barra de progresso */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, {
                  width: `${(totalEnabled / totalFeatures) * 100}%`,
                  backgroundColor: totalEnabled > totalFeatures * 0.7 ? Colors.success : totalEnabled > totalFeatures * 0.4 ? Colors.warning : Colors.danger,
                }]} />
              </View>

              {/* Ações rápidas */}
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

              {/* Lista de categorias */}
              <ScrollView style={styles.catScroll} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottomInset + 80 }}
              >
                {FEATURE_CATEGORIES.map(cat => {
                  const isExpanded = expandedCats.has(cat.categoria);
                  const activeInCat = countActive(cat);
                  return (
                    <View key={cat.categoria} style={styles.catCard}>
                      {/* Category header */}
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
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16} color={Colors.textMuted}
                        />
                      </TouchableOpacity>

                      {/* Features */}
                      {isExpanded && cat.features.map((feat, idx) => {
                        const isOn = editedPerms[feat.key] === true;
                        const isRoleFeature = feat.roles.includes(selectedUser.role);
                        return (
                          <View key={feat.key} style={[
                            styles.featRow,
                            idx === cat.features.length - 1 && { borderBottomWidth: 0 },
                          ]}>
                            <View style={styles.featInfo}>
                              <View style={styles.featLabelRow}>
                                <Text style={[styles.featLabel, !isOn && { color: Colors.textMuted }]}>
                                  {feat.label}
                                </Text>
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

              {/* Botão Guardar fixo */}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, flexDirection: 'row' },

  // User panel
  userPanel: { width: 260, borderRightWidth: 1, borderRightColor: Colors.border, backgroundColor: Colors.backgroundCard },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, padding: 0 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  userCardSelected: { backgroundColor: Colors.gold + '15', borderLeftWidth: 3, borderLeftColor: Colors.gold },
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  userAvatarText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 3 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rolePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  rolePillText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  permCount: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  emptyMsg: { textAlign: 'center', color: Colors.textMuted, fontSize: 13, fontFamily: 'Inter_400Regular', padding: 20 },

  // Perm panel
  permPanel: { flex: 1, backgroundColor: Colors.background },
  noSelection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  noSelTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  noSelSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },
  noAccess: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  noAccessTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.danger },
  noAccessSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  // Header
  permHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border },
  permUserAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  permUserAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  permUserName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text },
  permUserEmail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  progressBox: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, minWidth: 60 },
  progressNum: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.gold },
  progressDen: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  progressLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase' },

  progressBarBg: { height: 4, backgroundColor: Colors.border, marginHorizontal: 16, borderRadius: 2 },
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
  savedText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.success },
});
