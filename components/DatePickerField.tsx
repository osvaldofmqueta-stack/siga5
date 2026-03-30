import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface DatePickerFieldProps {
  label: string;
  value: string; // ISO format: YYYY-MM-DD
  onChange: (v: string) => void;
  required?: boolean;
  style?: any;
  labelStyle?: any;
  hasError?: boolean;
}

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return iso;
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  let result = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) result += '-';
    result += digits[i];
  }
  return result;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  required,
  style,
  labelStyle,
  hasError,
}: DatePickerFieldProps) {
  const [inputText, setInputText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setInputText(isoToDisplay(value));
  }, [value]);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    const masked = applyMask(text);
    setInputText(masked);

    if (digits.length === 8) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      onChange(`${yyyy}-${mm}-${dd}`);
    } else {
      onChange('');
    }
  }

  return (
    <View style={[styles.group, style]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
      </View>
      <View style={[styles.inputWrap, hasError && { borderColor: Colors.danger, backgroundColor: 'rgba(231,76,60,0.04)' }]}>
        <Ionicons name="calendar-outline" size={16} color={Colors.gold} style={styles.icon} />
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={handleChange}
          placeholder="DD-MM-AAAA"
          placeholderTextColor={Colors.textMuted}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 3 },
  label: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.textSecondary },
  required: { fontSize: 12, color: Colors.accent, fontFamily: 'Inter_600SemiBold' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    padding: 0,
    margin: 0,
    outlineStyle: 'none',
  },
});
