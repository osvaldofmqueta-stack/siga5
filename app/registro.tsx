import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useRegistro } from '@/context/RegistroContext';
import DatePickerField from '@/components/DatePickerField';
import ProvinciaMunicipioSelector from '@/components/ProvinciaMunicipioSelector';

const NIVEIS = ['Primário', 'I Ciclo', 'II Ciclo'];
const CLASSES_POR_NIVEL: Record<string, string[]> = {
  'Primário': ['1ª Classe', '2ª Classe', '3ª Classe', '4ª Classe', '5ª Classe', '6ª Classe'],
  'I Ciclo': ['7ª Classe', '8ª Classe', '9ª Classe'],
  'II Ciclo': ['10ª Classe', '11ª Classe', '12ª Classe', '13ª Classe'],
};

interface FormData {
  nomeCompleto: string;
  dataNascimento: string;
  genero: 'M' | 'F';
  provincia: string;
  municipio: string;
  nivel: string;
  classe: string;
  nomeEncarregado: string;
  telefoneEncarregado: string;
  observacoes: string;
}

function InputField({
  label, value, onChangeText, placeholder, required, keyboardType, multiline, hint,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; required?: boolean; keyboardType?: any; multiline?: boolean; hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.fieldRequired}>*</Text>}
      </View>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused, multiline && styles.inputWrapMulti]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType || 'default'}
          autoCapitalize="words"
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

function ChipSelector({
  label, options, value, onSelect, required,
}: {
  label: string; options: string[]; value: string;
  onSelect: (v: string) => void; required?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.fieldRequired}>*</Text>}
      </View>
      <View style={styles.chipsWrap}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => onSelect(opt)}
            activeOpacity={0.75}
          >
            {value === opt && (
              <Ionicons name="checkmark" size={11} color={Colors.accent} style={{ marginRight: 3 }} />
            )}
            <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function RegistroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { submeterSolicitacao } = useRegistro();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<FormData>({
    nomeCompleto: '',
    dataNascimento: '',
    genero: 'M',
    provincia: '',
    municipio: '',
    nivel: '',
    classe: '',
    nomeEncarregado: '',
    telefoneEncarregado: '',
    observacoes: '',
  });

  const set = (key: keyof FormData, value: any) => setForm(f => ({ ...f, [key]: value }));

  function validateStep1() {
    if (!form.nomeCompleto.trim()) {
      Alert.alert('Campo obrigatório', 'Introduza o nome completo do estudante.');
      return false;
    }
    if (!form.dataNascimento.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Data inválida', 'Introduza a data no formato AAAA-MM-DD.\nExemplo: 2010-05-15');
      return false;
    }
    if (!form.provincia) {
      Alert.alert('Campo obrigatório', 'Seleccione a província.');
      return false;
    }
    return true;
  }

  function validateStep2() {
    if (!form.nivel) {
      Alert.alert('Campo obrigatório', 'Seleccione o nível de ensino.');
      return false;
    }
    if (!form.classe) {
      Alert.alert('Campo obrigatório', 'Seleccione a classe.');
      return false;
    }
    if (!form.nomeEncarregado.trim()) {
      Alert.alert('Campo obrigatório', 'Introduza o nome do encarregado de educação.');
      return false;
    }
    if (!form.telefoneEncarregado.trim()) {
      Alert.alert('Campo obrigatório', 'Introduza o contacto do encarregado.');
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setIsLoading(true);
    try {
      if (Platform.OS !== 'web') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await submeterSolicitacao({
        nomeCompleto: form.nomeCompleto.trim(),
        dataNascimento: form.dataNascimento.trim(),
        genero: form.genero,
        provincia: form.provincia,
        municipio: form.municipio.trim(),
        nivel: form.nivel,
        classe: form.classe,
        nomeEncarregado: form.nomeEncarregado.trim(),
        telefoneEncarregado: form.telefoneEncarregado.trim(),
        observacoes: form.observacoes.trim(),
      });
      if (Platform.OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Solicitação Enviada com Sucesso',
        'A sua solicitação de matrícula foi registada no sistema.\n\nSerá analisada pela direcção escolar e receberá uma resposta através do encarregado de educação.',
        [{ text: 'Voltar ao Início', onPress: () => router.replace('/login') }]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a solicitação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  const classeOptions = form.nivel ? CLASSES_POR_NIVEL[form.nivel] || [] : [];
  const topPad = Platform.OS === 'web' ? 56 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 24 : insets.bottom;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#061029', '#0A1628', '#0F1F40']} style={styles.header}>
        <View style={[styles.headerTop, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <Ionicons name="arrow-back" size={19} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>Solicitação de Matrícula</Text>
            <Text style={styles.headerSubtitle}>Preencha todos os campos obrigatórios</Text>
          </View>
        </View>

        <View style={styles.stepsContainer}>
          <View style={styles.stepConnector}>
            <View style={[styles.stepConnectorLine, step > 1 && styles.stepConnectorLineDone]} />
          </View>
          {[1, 2].map(s => (
            <View key={s} style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                step === s && styles.stepCircleActive,
                step > s && styles.stepCircleDone,
              ]}>
                {step > s
                  ? <Ionicons name="checkmark" size={13} color="#fff" />
                  : <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>{s}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {s === 1 ? 'Dados Pessoais' : 'Escolaridade'}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 110 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <View style={styles.stepCard}>
              <View style={styles.stepCardHead}>
                <View style={[styles.stepCardIcon, { backgroundColor: 'rgba(52,152,219,0.12)' }]}>
                  <Ionicons name="person-outline" size={16} color="#3498DB" />
                </View>
                <Text style={styles.stepCardTitle}>Dados do Estudante</Text>
              </View>

              <InputField
                label="Nome Completo"
                value={form.nomeCompleto}
                onChangeText={v => set('nomeCompleto', v)}
                placeholder="Nome completo do estudante"
                required
              />
              <DatePickerField
                label="Data de Nascimento"
                value={form.dataNascimento}
                onChange={v => set('dataNascimento', v)}
                required
              />

              <ChipSelector
                label="Género"
                options={['M', 'F']}
                value={form.genero}
                onSelect={v => set('genero', v)}
                required
              />

              <ProvinciaMunicipioSelector
                provinciaValue={form.provincia}
                municipioValue={form.municipio}
                onProvinciaChange={v => { set('provincia', v); set('municipio', ''); }}
                onMunicipioChange={v => set('municipio', v)}
                required
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepCard}>
              <View style={styles.stepCardHead}>
                <View style={[styles.stepCardIcon, { backgroundColor: 'rgba(240,165,0,0.12)' }]}>
                  <Ionicons name="school-outline" size={16} color={Colors.gold} />
                </View>
                <Text style={styles.stepCardTitle}>Dados Escolares & Encarregado</Text>
              </View>

              <ChipSelector
                label="Nível de Ensino"
                options={NIVEIS}
                value={form.nivel}
                onSelect={v => { set('nivel', v); set('classe', ''); }}
                required
              />

              {classeOptions.length > 0 && (
                <ChipSelector
                  label="Classe"
                  options={classeOptions}
                  value={form.classe}
                  onSelect={v => set('classe', v)}
                  required
                />
              )}

              <View style={styles.sectionDivider}>
                <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.sectionDividerText}>Encarregado de Educação</Text>
              </View>

              <InputField
                label="Nome do Encarregado"
                value={form.nomeEncarregado}
                onChangeText={v => set('nomeEncarregado', v)}
                placeholder="Nome completo do encarregado"
                required
              />
              <InputField
                label="Telefone de Contacto"
                value={form.telefoneEncarregado}
                onChangeText={v => set('telefoneEncarregado', v)}
                placeholder="+244 9XX XXX XXX"
                required
                keyboardType="phone-pad"
              />
              <InputField
                label="Observações Adicionais"
                value={form.observacoes}
                onChangeText={v => set('observacoes', v)}
                placeholder="Necessidades especiais, transferência de outra escola, etc..."
                multiline
              />

              <View style={styles.approvalNotice}>
                <View style={styles.approvalNoticeHeader}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={Colors.gold} />
                  <Text style={styles.approvalNoticeTitle}>Processo de Aprovação</Text>
                </View>
                <Text style={styles.approvalNoticeText}>
                  A sua solicitação será analisada exclusivamente por:
                </Text>
                <View style={styles.approvalRoles}>
                  {['CEO', 'PCA', 'Administrador', 'Director', 'Chefe de Secretária'].map(role => (
                    <View key={role} style={styles.approvalRoleBadge}>
                      <Ionicons name="person-circle-outline" size={11} color={Colors.gold} />
                      <Text style={styles.approvalRoleText}>{role}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.approvalNoticeFooter}>
                  Após aprovação, receberá as credenciais de acesso via encarregado de educação.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
          <View style={styles.footerActions}>
            {step > 1 && (
              <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(s => s - 1)} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
                <Text style={styles.prevBtnText}>Anterior</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextBtn, isLoading && styles.nextBtnDisabled]}
              onPress={() => step === 1 ? (validateStep1() && setStep(2)) : handleSubmit()}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={step === 2
                  ? [Colors.success, '#27AE60']
                  : ['#1A5276', '#2980B9']
                }
                style={styles.nextBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading
                  ? <Text style={styles.nextBtnText}>A enviar...</Text>
                  : <>
                      <Text style={styles.nextBtnText}>
                        {step === 2 ? 'Submeter Solicitação' : 'Continuar'}
                      </Text>
                      <Ionicons
                        name={step === 2 ? 'checkmark-circle-outline' : 'arrow-forward'}
                        size={17} color="#fff"
                      />
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingBottom: 20 },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 18, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: Colors.text },
  headerSubtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },

  stepsContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, gap: 0, position: 'relative',
  },
  stepConnector: {
    position: 'absolute', left: '30%', right: '30%', top: '50%',
    height: 2, justifyContent: 'center',
  },
  stepConnectorLine: {
    flex: 1, height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepConnectorLineDone: { backgroundColor: Colors.success },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { borderColor: '#2980B9', backgroundColor: 'rgba(41,128,185,0.15)' },
  stepCircleDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  stepNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.textMuted },
  stepNumActive: { color: '#2980B9' },
  stepLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.textMuted, flex: 1 },
  stepLabelActive: { color: Colors.text },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 0 },

  stepCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18, borderWidth: 1,
    borderColor: Colors.border, padding: 20, gap: 20,
  },
  stepCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stepCardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text },

  fieldGroup: { gap: 7 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fieldLabel: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.7, textTransform: 'uppercase',
  },
  fieldRequired: { fontSize: 12, color: Colors.accent, fontFamily: 'Inter_700Bold' },
  fieldHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: -3 },

  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14, height: 52,
    justifyContent: 'center',
  },
  inputWrapFocused: { borderColor: Colors.gold, backgroundColor: 'rgba(240,165,0,0.04)' },
  inputWrapMulti: { height: 110, paddingVertical: 12, justifyContent: 'flex-start' },
  input: { fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  inputMulti: { textAlignVertical: 'top', lineHeight: 22 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    backgroundColor: 'rgba(204,26,26,0.12)',
    borderColor: Colors.accent,
  },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: Colors.accent, fontFamily: 'Inter_700Bold' },

  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingTop: 8, paddingBottom: 2,
    borderTopWidth: 1, borderTopColor: Colors.border,
    marginTop: 4,
  },
  sectionDividerText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase',
  },

  approvalNotice: {
    backgroundColor: 'rgba(240,165,0,0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(240,165,0,0.18)',
    padding: 16, gap: 10,
    marginTop: 4,
  },
  approvalNoticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  approvalNoticeTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: Colors.gold },
  approvalNoticeText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  approvalRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  approvalRoleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(240,165,0,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(240,165,0,0.2)',
  },
  approvalRoleText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.gold },
  approvalNoticeFooter: {
    fontSize: 11, fontFamily: 'Inter_400Regular',
    color: Colors.textMuted, lineHeight: 17, marginTop: 2,
  },

  footer: {
    backgroundColor: Colors.primaryDark,
    borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, paddingTop: 12,
  },
  footerActions: { flexDirection: 'row', gap: 12 },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 15,
    borderRadius: 13, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: 'rgba(255,255,255,0.05)',
  },
  prevBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  nextBtn: { flex: 1, borderRadius: 13, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 16, gap: 8,
  },
  nextBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.1 },
});
