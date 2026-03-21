import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  style?: any;
  labelStyle?: any;
}

export default function DatePickerField({
  label,
  value,
  onChange,
  required,
  style,
  labelStyle,
}: DatePickerFieldProps) {
  const inputRef = useRef<any>(null);

  const displayValue = value
    ? (() => {
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
      })()
    : 'Seleccionar data';

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.group, style]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, labelStyle]}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} style={styles.icon} />
          <Text style={[styles.displayText, !value && styles.placeholder]}>
            {displayValue}
          </Text>
          <input
            ref={inputRef}
            type="date"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.group, style]}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, labelStyle]}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
      </View>
      <TouchableOpacity style={styles.inputWrap} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} style={styles.icon} />
        <Text style={[styles.displayText, !value && styles.placeholder]}>
          {displayValue}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </TouchableOpacity>
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
    position: 'relative' as any,
    overflow: 'hidden' as any,
  },
  icon: { flexShrink: 0 },
  displayText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  placeholder: { color: Colors.textMuted },
});
