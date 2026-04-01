import React, { useState, useEffect } from 'react';
import { TextInput } from 'react-native';
import { Colors } from '@/constants/colors';

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

interface DateInputProps {
  value: string;
  onChangeText: (v: string) => void;
  style?: any;
  placeholderTextColor?: string;
  placeholder?: string;
}

export default function DateInput({
  value,
  onChangeText,
  style,
  placeholderTextColor,
  placeholder = 'DD-MM-AAAA',
}: DateInputProps) {
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
      onChangeText(`${yyyy}-${mm}-${dd}`);
    } else {
      onChangeText('');
    }
  }

  return (
    <TextInput
      style={style}
      value={inputText}
      onChangeText={handleChange}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor ?? Colors.textMuted}
      keyboardType="numeric"
      maxLength={10}
    />
  );
}
