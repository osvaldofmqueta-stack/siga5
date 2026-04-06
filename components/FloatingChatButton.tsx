import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Modal,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useChatInterno, ChatMsg } from '@/context/ChatInternoContext';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_W = Math.min(SCREEN_WIDTH * 0.95, 480);
const PANEL_H = SCREEN_HEIGHT * 0.78;

const HIDDEN_ROUTES = ['/chat-interno', '/(main)/chat-interno'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', director: 'Director', secretaria: 'Secretaria',
  chefe_secretaria: 'Chefe de Secretaria', professor: 'Professor',
  financeiro: 'Financeiro', rh: 'Recursos Humanos', ceo: 'CEO', pca: 'PCA',
};

const ROLE_COLORS: Record<string, string> = {
  admin: '#8B5CF6', director: '#EF4444', secretaria: '#F59E0B',
  chefe_secretaria: '#D97706', professor: '#3B82F6', financeiro: '#10B981',
  rh: '#EC4899', ceo: '#6366F1', pca: '#6366F1',
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? '#64748B';
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return d.toLocaleDateString('pt-PT', { weekday: 'short' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function Avatar({ name, role, size = 40 }: { name: string; role: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: roleColor(role), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

interface StaffContact { id: string; nome: string; role: string; escola: string; }

export default function FloatingChatButton() {
  const pathname = usePathname();
  const { unreadTotal, conversations, sendMensagem, markConversationRead, isLoading, loadMensagens } = useChatInterno();
  const { user } = useAuth();
  const { users: utilizadores } = useUsers();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;
  const prevUnread = useRef(0);
  const flatListRef = useRef<FlatList>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchContact, setSearchContact] = useState('');

  const staffContacts: StaffContact[] = useMemo(() => {
    if (!utilizadores) return [];
    const staffRoles = ['admin', 'director', 'secretaria', 'chefe_secretaria', 'professor', 'financeiro', 'rh', 'ceo', 'pca'];
    return utilizadores
      .filter((u: any) => u.id !== user?.id && staffRoles.includes(u.role) && u.ativo)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
  }, [utilizadores, user]);

  const filteredContacts = useMemo(() => {
    const q = searchContact.toLowerCase().trim();
    if (!q) return staffContacts;
    return staffContacts.filter((c: StaffContact) =>
      c.nome.toLowerCase().includes(q) ||
      (ROLE_LABELS[c.role] ?? c.role).toLowerCase().includes(q)
    );
  }, [staffContacts, searchContact]);

  const selectedConv = useMemo(
    () => conversations.find(c => c.userId === selectedUserId),
    [conversations, selectedUserId]
  );

  const selectedContact = useMemo(
    () => staffContacts.find(c => c.id === selectedUserId),
    [staffContacts, selectedUserId]
  );

  useEffect(() => {
    if (unreadTotal > prevUnread.current) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: true, speed: 20 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
      Animated.spring(badgeAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 14 }).start();
    }
    prevUnread.current = unreadTotal;
  }, [unreadTotal]);

  useEffect(() => {
    if (selectedUserId) markConversationRead(selectedUserId);
  }, [selectedUserId, conversations]);

  useEffect(() => {
    if (flatListRef.current && selectedConv?.msgs.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [selectedConv?.msgs?.length]);

  const isHidden = HIDDEN_ROUTES.some(() => pathname?.includes('chat-interno'));
  if (isHidden) return null;

  async function handleSend() {
    if (!inputText.trim() || !selectedUserId || sending) return;
    const contact = selectedContact ?? { nome: selectedConv?.userName ?? '', role: selectedConv?.userRole ?? '' };
    setSending(true);
    try {
      await sendMensagem(selectedUserId, contact.nome, contact.role, inputText.trim());
      setInputText('');
    } finally {
      setSending(false);
    }
  }

  function startChat(contact: StaffContact) {
    setSelectedUserId(contact.id);
    setShowNewChat(false);
    setSearchContact('');
  }

  function closePanel() {
    setPanelOpen(false);
    setSelectedUserId(null);
    setInputText('');
    setShowNewChat(false);
    setSearchContact('');
  }

  const chatName = selectedConv?.userName ?? selectedContact?.nome ?? '';
  const chatRole = selectedConv?.userRole ?? selectedContact?.role ?? '';

  return (
    <>
      {/* Floating Button */}
      <Animated.View
        style={[styles.container, { transform: [{ scale: scaleAnim }], pointerEvents: 'box-none' } as any]}
      >
        <TouchableOpacity
          style={[styles.btn, panelOpen && styles.btnActive]}
          onPress={() => setPanelOpen(v => !v)}
          activeOpacity={0.85}
        >
          <Ionicons name={panelOpen ? 'close' : 'chatbubbles'} size={24} color="#fff" />
          {!panelOpen && unreadTotal > 0 && (
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnim }] }]}>
              <Text style={styles.badgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Chat Panel Modal */}
      <Modal
        visible={panelOpen}
        transparent
        animationType="slide"
        onRequestClose={closePanel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closePanel} />
          <View style={[styles.panel, { width: PANEL_W, maxHeight: PANEL_H }]}>
            {/* Panel Header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <View style={styles.panelHeaderIcon}>
                  <Ionicons name="chatbubbles" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.panelTitle}>Chat Interno</Text>
                  {unreadTotal > 0 && (
                    <Text style={styles.panelSubtitle}>{unreadTotal} mensagem{unreadTotal > 1 ? 's' : ''} não lida{unreadTotal > 1 ? 's' : ''}</Text>
                  )}
                </View>
              </View>
              <View style={styles.panelHeaderRight}>
                {selectedUserId && (
                  <TouchableOpacity onPress={loadMensagens} style={styles.headerIconBtn}>
                    <Ionicons name="refresh-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.headerIconBtn}>
                  <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={closePanel} style={[styles.headerIconBtn, styles.closeIconBtn]}>
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Body: conversations list or chat */}
            {selectedUserId ? (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                {/* Chat sub-header */}
                <View style={styles.chatSubHeader}>
                  <TouchableOpacity onPress={() => setSelectedUserId(null)} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.text} />
                  </TouchableOpacity>
                  <Avatar name={chatName} role={chatRole} size={34} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.chatSubHeaderName}>{chatName}</Text>
                    <Text style={[styles.chatSubHeaderRole, { color: roleColor(chatRole) }]}>
                      {ROLE_LABELS[chatRole] ?? chatRole}
                    </Text>
                  </View>
                </View>

                {/* Messages */}
                <FlatList
                  ref={flatListRef}
                  data={selectedConv?.msgs ?? []}
                  keyExtractor={m => m.id}
                  renderItem={({ item: msg }) => {
                    const mine = msg.remetenteId === user?.id;
                    return (
                      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                        {!mine && <Avatar name={msg.remetenteNome} role={msg.remetenteRole} size={26} />}
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                          <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                            {msg.corpo}
                          </Text>
                          <View style={styles.bubbleMeta}>
                            <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                              {timeLabel(msg.createdAt)}
                            </Text>
                            {mine && (
                              <Ionicons
                                name={msg.lida ? 'checkmark-done' : 'checkmark'}
                                size={11}
                                color={msg.lida ? '#93C5FD' : 'rgba(255,255,255,0.5)'}
                                style={{ marginLeft: 3 }}
                              />
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  }}
                  contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, flexGrow: 1 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
                      <MaterialCommunityIcons name="message-text-outline" size={36} color={Colors.textMuted} />
                      <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 10 }}>
                        Inicie a conversa com {chatName}
                      </Text>
                    </View>
                  }
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />

                {/* Input row */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Escreva uma mensagem..."
                    placeholderTextColor={Colors.textMuted}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                    maxLength={1000}
                    onKeyPress={({ nativeEvent }: any) => {
                      if (Platform.OS === 'web' && nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
                        nativeEvent.preventDefault?.();
                        handleSend();
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!inputText.trim() || sending) && { opacity: 0.4 }]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || sending}
                  >
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="send" size={18} color="#fff" />
                    }
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            ) : (
              /* Conversations list */
              <View style={{ flex: 1 }}>
                {isLoading && conversations.length === 0 ? (
                  <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
                ) : conversations.length === 0 ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <MaterialCommunityIcons name="chat-outline" size={48} color={Colors.textMuted} />
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '600', marginTop: 12 }}>
                      Sem conversas ainda
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                      Toque em ✏️ para iniciar uma conversa
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowNewChat(true)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginTop: 16 }}
                    >
                      <Ionicons name="create-outline" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Nova Conversa</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {conversations.map(conv => (
                      <TouchableOpacity
                        key={conv.userId}
                        style={[styles.convItem, selectedUserId === conv.userId && styles.convItemActive]}
                        onPress={() => setSelectedUserId(conv.userId)}
                      >
                        <Avatar name={conv.userName} role={conv.userRole} size={44} />
                        <View style={styles.convInfo}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.convName} numberOfLines={1}>{conv.userName}</Text>
                            <Text style={styles.convTime}>{timeLabel(conv.lastMsg.createdAt)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={[styles.convPreview, conv.unread > 0 && styles.convPreviewUnread]} numberOfLines={1}>
                              {conv.lastMsg.remetenteId === user?.id ? 'Você: ' : ''}{conv.lastMsg.corpo}
                            </Text>
                            {conv.unread > 0 && (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{conv.unread}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.roleChip, { color: roleColor(conv.userRole) }]}>
                            {ROLE_LABELS[conv.userRole] ?? conv.userRole}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* New Chat Modal */}
            <Modal visible={showNewChat} transparent animationType="fade" onRequestClose={() => setShowNewChat(false)}>
              <TouchableOpacity style={styles.newChatOverlay} activeOpacity={1} onPress={() => setShowNewChat(false)}>
                <View style={[styles.newChatSheet, { width: PANEL_W }]} onStartShouldSetResponder={() => true}>
                  <View style={styles.newChatHeader}>
                    <Text style={styles.newChatTitle}>Nova Conversa</Text>
                    <TouchableOpacity onPress={() => setShowNewChat(false)}>
                      <Ionicons name="close" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Pesquisar colaborador..."
                      placeholderTextColor={Colors.textMuted}
                      value={searchContact}
                      onChangeText={setSearchContact}
                      autoFocus
                    />
                  </View>
                  <ScrollView style={styles.contactList} showsVerticalScrollIndicator={false}>
                    {filteredContacts.length === 0 ? (
                      <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 }}>
                        Nenhum colaborador encontrado.
                      </Text>
                    ) : filteredContacts.map((c: StaffContact) => (
                      <TouchableOpacity key={c.id} style={styles.contactItem} onPress={() => startChat(c)}>
                        <Avatar name={c.nome} role={c.role} size={40} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.contactName}>{c.nome}</Text>
                          <Text style={[styles.contactRole, { color: roleColor(c.role) }]}>
                            {ROLE_LABELS[c.role] ?? c.role}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  btn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    lineHeight: 13,
  },

  /* Modal overlay */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'web' ? 90 : 80,
  },

  /* Panel */
  panel: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.primaryDark,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  panelTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  panelSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.gold,
    marginTop: 1,
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconBtn: {
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.2)',
  },

  /* Chat sub-header */
  chatSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
    gap: 8,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatSubHeaderName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  chatSubHeaderRole: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },

  /* Bubbles */
  bubbleRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '72%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, marginLeft: 8 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 13, lineHeight: 19 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: Colors.text },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  bubbleTime: { fontSize: 10 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.6)' },
  bubbleTimeTheirs: { color: Colors.textMuted },

  /* Input */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 100,
    minHeight: 40,
    fontFamily: 'Inter_400Regular',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Conversations */
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  convItemActive: { backgroundColor: `${Colors.primary}15` },
  convInfo: { flex: 1, marginLeft: 12 },
  convName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text, flex: 1, marginRight: 6 },
  convTime: { fontSize: 11, color: Colors.textMuted },
  convPreview: { fontSize: 13, color: Colors.textMuted, flex: 1, marginRight: 6 },
  convPreviewUnread: { color: Colors.text, fontFamily: 'Inter_600SemiBold' },
  roleChip: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 2 },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  /* New Chat */
  newChatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  newChatSheet: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  newChatTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, fontFamily: 'Inter_400Regular' },
  contactList: { paddingHorizontal: 16, paddingBottom: 16, maxHeight: 400 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text },
  contactRole: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
});
