import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useUsers } from '@/context/UsersContext';
import {
  usePermissoes,
  FEATURE_CATEGORIES,
  ROLE_DEFAULTS,
  PermKey,
} from '@/context/PermissoesContext';
import { useAuth } from '@/context/AuthContext';

const ROLE_LABEL: Record<string, string> = {
  ceo: 'CEO', pca: 'PCA', admin: 'Administrador', director: 'Director',
  secretaria: 'Secretaria', professor: 'Professor', aluno: 'Aluno',
  financeiro: 'Financeiro', encarregado: 'Encarregado',
};
const ROLE_COLOR: Record<string, string> = {
  ceo: '#8B5CF6', pca: '#F59E0B', admin: '#3B82F6', director: Colors.accent,
  secretaria: Colors.gold, professor: Colors.info, aluno: Colors.success,
  financeiro: '#10B981', encarregado: '#F97316',
};

const TOTAL_FEATURES = FEATURE_CATEGORIES.reduce((s, c) => s + c.features.length, 0);

function initials(nome: string) {
  return nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

interface IntelBadgeProps {
  isOn: boolean;
  isRoleDefault: boolean;
}
function IntelBadge({ isOn, isRoleDefault }: IntelBadgeProps) {
  if (isOn && isRoleDefault) {
    return (
      <View style={[badge.base, { backgroundColor: Colors.success + '20', borderColor: Colors.success + '44' }]}>
        <Ionicons name="eye" size={9} color={Colors.success} />
        <Text style={[badge.text, { color: Colors.success }]}>Visível</Text>
      </View>
    );
  }
  if (isOn && !isRoleDefault) {
    return (
      <View style={[badge.base, { backgroundColor: Colors.info + '20', borderColor: Colors.info + '44' }]}>
        <Ionicons name="add-circle" size={9} color={Colors.info} />
        <Text style={[badge.text, { color: Colors.info }]}>Extra</Text>
      </View>
    );
  }
  if (!isOn && isRoleDefault) {
    return (
      <View style={[badge.base, { backgroundColor: Colors.danger + '20', borderColor: Colors.danger + '44' }]}>
        <Ionicons name="eye-off" size={9} color={Colors.danger} />
        <Text style={[badge.text, { color: Colors.danger }]}>Oculto</Text>
      </View>
    );
  }
  return (
    <View style={[badge.base, { backgroundColor: Colors.border, borderColor: Colors.border }]}>
      <Ionicons name="remove-circle-outline" size={9} color={Colors.textMuted} />
      <Text style={[badge.text, { color: Colors.textMuted }]}>Inactivo</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  text: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
});

export default function GestaoAcessosPanel() {
  const { user } = useAuth();
  const { users } = useUsers();
  const { getUserPermissions, saveUserPermissions, resetUserPermissions, isLoading, allUserPermissions } = usePermissoes();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editedPerms, setEditedPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const managedUsers = users.filter(u => u.id !== user?.id);
  const filteredUsers = managedUsers.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABEL[u.role] || '').toLowerCase().includes(search.toLowerCase())
  );
  const selectedUser = users.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (!selectedUserId || !selectedUser) return;
    const perms = getUserPermissions(selectedUserId, selectedUser.role);
    setEditedPerms({ ...perms });
    setSaved(false);
    setExpandedCats(new Set(FEATURE_CATEGORIES.map(c => c.categoria)));
  }, [selectedUserId, isLoading]);

  function togglePerm(key: PermKey) {
    setEditedPerms(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function enableAll() {
    const all: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(c => c.features.forEach(f => { all[f.key] = true; }));
    setEditedPerms(all); setSaved(false);
  }
  function disableAll() {
    const none: Record<string, boolean> = {};
    FEATURE_CATEGORIES.forEach(c => c.features.forEach(f => { none[f.key] = false; }));
    setEditedPerms(none); setSaved(false);
  }
  async function handleReset() {
    if (!selectedUserId || !selectedUser) return;
    setSaving(true);
    try {
      await resetUserPermissions(selectedUserId);
      const defaults = ROLE_DEFAULTS[selectedUser.role] || [];
      const reset: Record<string, boolean> = {};
      FEATURE_CATEGORIES.forEach(c => c.features.forEach(f => { reset[f.key] = defaults.includes(f.key as PermKey); }));
      setEditedPerms(reset); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }
  async function handleSave() {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await saveUserPermissions(selectedUserId, editedPerms);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  const totalEnabled = Object.values(editedPerms).filter(Boolean).length;
  const usersWithOverrides = allUserPermissions.filter(p => Object.keys(p.permissoes).length > 0).length;

  const pctFill = totalEnabled / TOTAL_FEATURES;
  const barColor = pctFill > 0.7 ? Colors.success : pctFill > 0.4 ? Colors.warning : Colors.danger;

  return (
    <View style={s.root}>
      {/* ── Header do painel ── */}
      <View style={s.panelHeader}>
        <View style={s.panelHeaderLeft}>
          <View style={s.panelIconWrap}>
            <MaterialCommunityIcons name="account-key" size={22} color={Colors.gold} />
          </View>
          <View>
            <Text style={s.panelTitle}>Centro de Controlo de Acessos</Text>
            <Text style={s.panelSub}>
              {managedUsers.length} utilizadores · {TOTAL_FEATURES} funcionalidades · {usersWithOverrides} personalizados
            </Text>
          </View>
        </View>
      </View>

      {/* ── Descrição de inteligência ── */}
      <View style={s.intelBanner}>
        <Ionicons name="bulb" size={14} color={Colors.gold} />
        <Text style={s.intelText}>
          O sistema aplica as permissões automaticamente — menus ocultos, ecrãs bloqueados e funcionalidades desactivadas em tempo real após guardar.
        </Text>
      </View>

      {/* ── Barra de pesquisa ── */}
      <View style={s.searchRow}>
        <Ionicons name="search" size={14} color={Colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Pesquisar utilizador ou cargo..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Lista de utilizadores (scroll horizontal em mobile, wrap em desktop) ── */}
      <ScrollView
        horizontal={Platform.OS !== 'web'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.userListContent}
        style={s.userList}
      >
        {filteredUsers.length === 0 && (
          <Text style={s.emptyMsg}>Nenhum utilizador encontrado</Text>
        )}
        {filteredUsers.map(u => {
          const isSelected = u.id === selectedUserId;
          const roleColor = ROLE_COLOR[u.role] || Colors.textMuted;
          const perms = getUserPermissions(u.id, u.role);
          const active = Object.values(perms).filter(Boolean).length;
          const hasOverride = allUserPermissions.some(p => p.userId === u.id && Object.keys(p.permissoes).length > 0);
          return (
            <TouchableOpacity
              key={u.id}
              style={[s.userChip, isSelected && s.userChipSelected, { borderColor: isSelected ? roleColor : Colors.border }]}
              onPress={() => { setSelectedUserId(u.id); setSaved(false); }}
              activeOpacity={0.75}
            >
              {/* Dot de override */}
              {hasOverride && <View style={[s.overrideDot, { backgroundColor: Colors.warning }]} />}
              <View style={[s.userAvatar, { backgroundColor: roleColor + '22' }]}>
                <Text style={[s.userAvatarTxt, { color: roleColor }]}>{initials(u.nome)}</Text>
              </View>
              <View style={s.userChipInfo}>
                <Text style={[s.userChipName, isSelected && { color: roleColor }]} numberOfLines={1}>{u.nome}</Text>
                <Text style={[s.userChipRole, { color: roleColor }]}>{ROLE_LABEL[u.role]}</Text>
                <Text style={s.userChipCount}>{active}/{TOTAL_FEATURES}</Text>
              </View>
              {isSelected && (
                <View style={[s.selectedIndicator, { backgroundColor: roleColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Painel de permissões do utilizador selecionado ── */}
      {!selectedUser ? (
        <View style={s.noSelection}>
          <MaterialCommunityIcons name="cursor-pointer" size={36} color={Colors.border} />
          <Text style={s.noSelTitle}>Seleccione um utilizador acima</Text>
          <Text style={s.noSelSub}>As permissões de acesso serão apresentadas aqui para edição.</Text>
        </View>
      ) : (
        <View style={s.permArea}>
          {/* Cabeçalho do utilizador selecionado */}
          <View style={s.selUserHeader}>
            <View style={[s.selUserAvatar, { backgroundColor: ROLE_COLOR[selectedUser.role] + '22' }]}>
              <Text style={[s.selUserAvatarTxt, { color: ROLE_COLOR[selectedUser.role] }]}>
                {initials(selectedUser.nome)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.selUserName}>{selectedUser.nome}</Text>
              <Text style={s.selUserEmail}>{selectedUser.email}</Text>
              <View style={[s.rolePill, { backgroundColor: ROLE_COLOR[selectedUser.role] + '22' }]}>
                <Text style={[s.rolePillTxt, { color: ROLE_COLOR[selectedUser.role] }]}>
                  {ROLE_LABEL[selectedUser.role]}
                </Text>
              </View>
            </View>
            {/* Contador de permissões activas */}
            <View style={s.permCounter}>
              <Text style={[s.permCountNum, { color: barColor }]}>{totalEnabled}</Text>
              <Text style={s.permCountDen}>/{TOTAL_FEATURES}</Text>
              <Text style={s.permCountLbl}>activas</Text>
            </View>
          </View>

          {/* Barra de progresso */}
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${(totalEnabled / TOTAL_FEATURES) * 100}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={s.progressLbl}>
            {totalEnabled === TOTAL_FEATURES ? 'Acesso total' : totalEnabled === 0 ? 'Sem acesso' : `${Math.round((totalEnabled / TOTAL_FEATURES) * 100)}% das funcionalidades activas`}
          </Text>

          {/* Acções rápidas */}
          <View style={s.quickActions}>
            <TouchableOpacity style={s.qBtn} onPress={enableAll}>
              <Ionicons name="checkmark-done" size={13} color={Colors.success} />
              <Text style={[s.qBtnTxt, { color: Colors.success }]}>Activar Tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.qBtn} onPress={disableAll}>
              <Ionicons name="close-circle-outline" size={13} color={Colors.danger} />
              <Text style={[s.qBtnTxt, { color: Colors.danger }]}>Desactivar Tudo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.qBtn} onPress={handleReset} disabled={saving}>
              <MaterialCommunityIcons name="restore" size={13} color={Colors.info} />
              <Text style={[s.qBtnTxt, { color: Colors.info }]}>Repor Padrão</Text>
            </TouchableOpacity>
          </View>

          {/* Legenda de inteligência */}
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <Ionicons name="eye" size={11} color={Colors.success} />
              <Text style={[s.legendTxt, { color: Colors.success }]}>Visível (padrão)</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="add-circle" size={11} color={Colors.info} />
              <Text style={[s.legendTxt, { color: Colors.info }]}>Extra (fora do cargo)</Text>
            </View>
            <View style={s.legendItem}>
              <Ionicons name="eye-off" size={11} color={Colors.danger} />
              <Text style={[s.legendTxt, { color: Colors.danger }]}>Oculto</Text>
            </View>
          </View>

          {/* Categorias de funcionalidades */}
          {FEATURE_CATEGORIES.map(cat => {
            const isExpanded = expandedCats.has(cat.categoria);
            const activeInCat = cat.features.filter(f => editedPerms[f.key]).length;
            const catColor = activeInCat === cat.features.length ? Colors.success
              : activeInCat === 0 ? Colors.danger : Colors.warning;

            return (
              <View key={cat.categoria} style={s.catCard}>
                <TouchableOpacity style={s.catHeader} onPress={() => toggleCat(cat.categoria)} activeOpacity={0.75}>
                  <View style={[s.catIconWrap, { backgroundColor: Colors.gold + '18' }]}>
                    <Ionicons name={cat.icon as any} size={15} color={Colors.gold} />
                  </View>
                  <Text style={s.catTitle}>{cat.categoria}</Text>
                  <View style={[s.catBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={[s.catBadgeTxt, { color: catColor }]}>{activeInCat}/{cat.features.length}</Text>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={Colors.textMuted} />
                </TouchableOpacity>

                {isExpanded && cat.features.map((feat, idx) => {
                  const isOn = editedPerms[feat.key] === true;
                  const isRoleDefault = (ROLE_DEFAULTS[selectedUser.role] || []).includes(feat.key as PermKey);
                  const isFeatRole = feat.roles.includes(selectedUser.role);

                  return (
                    <View
                      key={feat.key}
                      style={[
                        s.featRow,
                        idx < cat.features.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                        isOn && { backgroundColor: Colors.success + '06' },
                        !isOn && { backgroundColor: Colors.danger + '04' },
                      ]}
                    >
                      {/* Barra lateral de estado */}
                      <View style={[s.featSidebar, { backgroundColor: isOn ? Colors.success : Colors.danger }]} />

                      <View style={s.featInfo}>
                        <View style={s.featLabelRow}>
                          <Text style={[s.featLabel, !isOn && { color: Colors.textMuted }]}>{feat.label}</Text>
                          <IntelBadge isOn={isOn} isRoleDefault={isRoleDefault} />
                          {!isFeatRole && (
                            <View style={s.outOfRolePill}>
                              <Text style={s.outOfRoleTxt}>Fora do cargo</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.featDesc} numberOfLines={1}>{feat.desc}</Text>
                        {/* Nota de impacto */}
                        <Text style={[s.featImpact, { color: isOn ? Colors.success : Colors.danger }]}>
                          {isOn
                            ? '→ Menu visível & ecrã acessível'
                            : '→ Menu ocultado & ecrã bloqueado'}
                        </Text>
                      </View>

                      <Switch
                        value={isOn}
                        onValueChange={() => togglePerm(feat.key as PermKey)}
                        trackColor={{ false: Colors.danger + '44', true: Colors.success + '66' }}
                        thumbColor={isOn ? Colors.success : Colors.danger}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* Botão Guardar */}
          <View style={s.saveArea}>
            {saved ? (
              <View style={s.savedBanner}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={s.savedTxt}>Permissões guardadas e aplicadas!</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="save" size={18} color="#fff" />
                }
                <Text style={s.saveBtnTxt}>{saving ? 'A guardar...' : 'Guardar Alterações'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },

  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  panelIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.gold + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold + '33' },
  panelTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  panelSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },

  intelBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: Colors.gold + '0E', borderBottomWidth: 1, borderBottomColor: Colors.gold + '22' },
  intelText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 16 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text, padding: 0 },

  userList: { maxHeight: Platform.OS === 'web' ? undefined : 140 },
  userListContent: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap', flexDirection: 'row' },

  userChip: { width: 120, borderRadius: 12, borderWidth: 1.5, backgroundColor: Colors.surface, overflow: 'hidden', position: 'relative' },
  userChipSelected: { backgroundColor: Colors.backgroundCard },
  overrideDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, zIndex: 1 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', margin: 10, marginBottom: 4 },
  userAvatarTxt: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  userChipInfo: { paddingHorizontal: 10, paddingBottom: 10 },
  userChipName: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text, marginBottom: 2 },
  userChipRole: { fontSize: 10, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  userChipCount: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  selectedIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  noSelection: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  noSelTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  noSelSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center' },

  permArea: { borderTopWidth: 1, borderTopColor: Colors.border },

  selUserHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surface },
  selUserAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  selUserAvatarTxt: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  selUserName: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text },
  selUserEmail: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 3 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rolePillTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  permCounter: { alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: 10, padding: 10, minWidth: 56, borderWidth: 1, borderColor: Colors.border },
  permCountNum: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  permCountDen: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  permCountLbl: { fontSize: 9, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textTransform: 'uppercase', marginTop: 1 },

  progressBg: { height: 5, backgroundColor: Colors.border, marginHorizontal: 14, borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3 },
  progressLbl: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginHorizontal: 14, marginTop: 4, marginBottom: 2 },

  quickActions: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface, flexWrap: 'wrap' },
  qBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundCard, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  qBtnTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  legendRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border, flexWrap: 'wrap', backgroundColor: Colors.backgroundCard },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendTxt: { fontSize: 10, fontFamily: 'Inter_500Medium' },

  catCard: { marginHorizontal: 12, marginTop: 8, borderRadius: 10, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  catIconWrap: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  catTitle: { flex: 1, fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.4 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeTxt: { fontSize: 11, fontFamily: 'Inter_700Bold' },

  featRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 14, paddingVertical: 11, gap: 10 },
  featSidebar: { width: 3, height: '100%', minHeight: 40 },
  featInfo: { flex: 1 },
  featLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  featLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  featDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 2 },
  featImpact: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  outOfRolePill: { backgroundColor: Colors.warning + '25', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  outOfRoleTxt: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: Colors.warning },

  saveArea: { padding: 14, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8, backgroundColor: Colors.surface },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 13 },
  saveBtnTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.success + '18', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: Colors.success + '44' },
  savedTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.success },

  emptyMsg: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textMuted, padding: 16 },
});
