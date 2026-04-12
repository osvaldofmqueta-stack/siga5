import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/context/UsersContext';
import { useChatInterno, ChatMsg } from '@/context/ChatInternoContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';

import { getRoleLabel } from '@/utils/genero';

const ROLE_COLORS: Record<string, string> = {
  admin: '#8B5CF6',
  director: '#EF4444',
  secretaria: '#F59E0B',
  chefe_secretaria: '#D97706',
  professor: '#3B82F6',
  financeiro: '#10B981',
  rh: '#EC4899',
  ceo: '#6366F1',
  pca: '#6366F1',
};

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? '#64748B';
}

function Avatar({ name, role, size = 40 }: { name: string; role: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: roleColor(role) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return d.toLocaleDateString('pt-PT', { weekday: 'short' });
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

interface StaffContact {
  id: string;
  nome: string;
  role: string;
  escola: string;
}

export default function ChatInternoScreen() {
  const { user } = useAuth();
  const { users: utilizadores } = useUsers();
  const { conversations, sendMensagem, markConversationRead, isLoading, loadMensagens } = useChatInterno();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  const bottomInset = Platform.OS === 'web' ? 24 : insets.bottom;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchContact, setSearchContact] = useState('');

  const flatListRef = useRef<FlatList>(null);

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
      getRoleLabel(c.role, (c as any).genero).toLowerCase().includes(q)
    );
  }, [staffContacts, searchContact]);

  const selectedConv = useMemo(
    () => conversations.find(c => c.userId === selectedUserId),
    [conversations, selectedUserId],
  );

  const selectedContact = useMemo(
    () => staffContacts.find(c => c.id === selectedUserId),
    [staffContacts, selectedUserId],
  );

  useEffect(() => {
    if (selectedUserId) {
      markConversationRead(selectedUserId);
    }
  }, [selectedUserId, conversations]);

  useEffect(() => {
    if (flatListRef.current && selectedConv?.msgs.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [selectedConv?.msgs.length]);

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

  function renderBubble(msg: ChatMsg) {
    const mine = msg.remetenteId === user?.id;
    return (
      <View key={msg.id} style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        {!mine && (
          <Avatar name={msg.remetenteNome} role={msg.remetenteRole} size={28} />
        )}
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
                size={12}
                color={msg.lida ? '#93C5FD' : 'rgba(255,255,255,0.5)'}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  const chatName = selectedConv?.userName ?? selectedContact?.nome ?? '';
  const chatRole = selectedConv?.userRole ?? selectedContact?.role ?? '';

  return (
    <View style={styles.root}>
      <TopBar title="Chat Interno" />

      <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
        {/* ── Sidebar (conversas) ── */}
        <View style={[styles.sidebar, isDesktop ? styles.sidebarDesktop : (selectedUserId ? styles.sidebarHidden : styles.sidebarFull)]}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Conversas</Text>
            <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.newChatBtn}>
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading && conversations.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chat-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sem conversas ainda</Text>
              <Text style={styles.emptySubtext}>Toque em   para iniciar uma conversa</Text>
              <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.emptyBtn}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Nova Conversa</Text>
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
                    <View style={styles.convTopRow}>
                      <Text style={styles.convName} numberOfLines={1}>{conv.userName}</Text>
                      <Text style={styles.convTime}>{timeLabel(conv.lastMsg.createdAt)}</Text>
                    </View>
                    <View style={styles.convBottomRow}>
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
                      {getRoleLabel(conv.userRole, (conv as any).genero)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Painel de chat ── */}
        {selectedUserId ? (
          <KeyboardAvoidingView
            style={styles.chatPanel}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={80}
          >
            {/* Header da conversa */}
            <View style={styles.chatHeader}>
              {!isDesktop && (
                <TouchableOpacity onPress={() => setSelectedUserId(null)} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
              )}
              <Avatar name={chatName} role={chatRole} size={38} />
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>{chatName}</Text>
                <Text style={[styles.chatHeaderRole, { color: roleColor(chatRole) }]}>
                  {getRoleLabel(chatRole, undefined)}
                </Text>
              </View>
              <TouchableOpacity onPress={loadMensagens} style={styles.refreshBtn}>
                <Ionicons name="refresh-outline" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Mensagens */}
            <FlatList
              ref={flatListRef}
              data={selectedConv?.msgs ?? []}
              keyExtractor={m => m.id}
              renderItem={({ item }) => renderBubble(item)}
              contentContainerStyle={[styles.messagesContent, { paddingBottom: bottomInset + 8 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <MaterialCommunityIcons name="message-text-outline" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyChatText}>Inicie a conversa com {chatName}</Text>
                </View>
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Input */}
            <View style={[styles.inputRow, { paddingBottom: bottomInset + 8 }]}>
              <TextInput
                style={styles.textInput}
                placeholder="Escreva uma mensagem..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onSubmitEditing={Platform.OS === 'web' ? undefined : handleSend}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
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
          isDesktop && (
            <View style={styles.noConvSelected}>
              <MaterialCommunityIcons name="chat-processing-outline" size={56} color={Colors.textMuted} />
              <Text style={styles.noConvText}>Selecione uma conversa</Text>
              <Text style={styles.noConvSubtext}>ou inicie uma nova</Text>
              <TouchableOpacity onPress={() => setShowNewChat(true)} style={styles.emptyBtn}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Nova Conversa</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>

      {/* Modal: Nova conversa */}
      <Modal visible={showNewChat} transparent animationType="fade" onRequestClose={() => setShowNewChat(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNewChat(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
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
                <Text style={styles.noContacts}>Nenhum colaborador encontrado.</Text>
              ) : (
                filteredContacts.map((c: StaffContact) => (
                  <TouchableOpacity key={c.id} style={styles.contactItem} onPress={() => startChat(c)}>
                    <Avatar name={c.nome} role={c.role} size={40} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.contactName}>{c.nome}</Text>
                      <Text style={[styles.contactRole, { color: roleColor(c.role) }]}>
                        {getRoleLabel(c.role, (c as any).genero)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1 },
  bodyDesktop: { flexDirection: 'row' },

  // Sidebar
  sidebar: { backgroundColor: Colors.card, borderRightWidth: 1, borderRightColor: Colors.border },
  sidebarDesktop: { width: 320 },
  sidebarFull: { flex: 1 },
  sidebarHidden: { display: 'none' },
  sidebarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sidebarTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  newChatBtn: { padding: 4 },

  // Conversation item
  convItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  convItemActive: { backgroundColor: Colors.primary + '15' },
  convInfo: { flex: 1, marginLeft: 12 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 6 },
  convTime: { fontSize: 11, color: Colors.textMuted },
  convBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  convPreview: { fontSize: 13, color: Colors.textMuted, flex: 1, marginRight: 6 },
  convPreviewUnread: { color: Colors.text, fontWeight: '600' },
  roleChip: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  unreadBadge: {
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Empty state (sidebar)
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: Colors.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySubtext: { color: Colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10, marginTop: 16,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Chat panel
  chatPanel: { flex: 1, flexDirection: 'column' },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  backBtn: { marginRight: 10, padding: 4 },
  chatHeaderInfo: { flex: 1, marginLeft: 10 },
  chatHeaderName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  chatHeaderRole: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  refreshBtn: { padding: 6 },

  // Messages
  messagesContent: { paddingHorizontal: 12, paddingTop: 12, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '72%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, marginLeft: 8 },
  bubbleTheirs: { backgroundColor: Colors.card, borderBottomLeftRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: Colors.text },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  bubbleTime: { fontSize: 10 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.6)' },
  bubbleTimeTheirs: { color: Colors.textMuted },

  // Empty chat
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyChatText: { color: Colors.textMuted, fontSize: 14, marginTop: 12, textAlign: 'center' },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.card,
  },
  textInput: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
    maxHeight: 120, minHeight: 42,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  // No conv selected (desktop placeholder)
  noConvSelected: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  noConvText: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 12 },
  noConvSubtext: { fontSize: 14, color: Colors.textMuted },

  // Avatar
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalSheet: {
    backgroundColor: Colors.card, borderRadius: 16,
    width: '100%', maxWidth: 480, maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  contactList: { paddingHorizontal: 16, paddingBottom: 16 },
  contactItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  contactName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  contactRole: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  noContacts: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
});
