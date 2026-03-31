import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../theme';
import type { HypoTreatmentSheetProps } from './types';
import type { HypoTreatment } from '../types/equipment';

const TREATMENT_TYPES = ['Glucose tablets', 'Juice', 'Sweets', 'Gel', 'Other'] as const;
const AMOUNT_UNITS: Array<'tablets' | 'ml' | 'g'> = ['tablets', 'ml', 'g'];

export default function HypoTreatmentSheet({
  visible,
  currentGlucose,
  onClose,
  onSave,
}: HypoTreatmentSheetProps) {
  const [treatmentType, setTreatmentType] = useState<string>('Glucose tablets');
  const [amountValue, setAmountValue] = useState('');
  const [amountUnit, setAmountUnit] = useState<'tablets' | 'ml' | 'g'>('tablets');

  function handleClose() {
    // Reset state on close
    setTreatmentType('Glucose tablets');
    setAmountValue('');
    setAmountUnit('tablets');
    onClose();
  }

  const parsedAmount = parseFloat(amountValue);
  const saveDisabled = amountValue.trim() === '' || isNaN(parsedAmount);

  function handleSave() {
    if (saveDisabled) return;
    onSave({
      glucose_at_event: currentGlucose ?? 0,
      treatment_type: treatmentType,
      amount_value: parsedAmount,
      amount_unit: amountUnit,
    });
    // Reset state after save
    setTreatmentType('Glucose tablets');
    setAmountValue('');
    setAmountUnit('tablets');
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>Treating a low?</Text>

          {/* 1. Current glucose — read-only */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>CURRENT GLUCOSE</Text>
            <View style={styles.glucoseDisplay}>
              <Text style={styles.glucoseValue}>
                {currentGlucose != null
                  ? `${currentGlucose.toFixed(1)} mmol/L`
                  : 'No reading'}
              </Text>
            </View>
          </View>

          {/* 2. Treatment type picker */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>TREATMENT TYPE</Text>
            <View style={styles.chipRow}>
              {TREATMENT_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={[styles.chip, treatmentType === type && styles.chipActive]}
                  onPress={() => setTreatmentType(type)}
                >
                  <Text style={[styles.chipText, treatmentType === type && styles.chipTextActive]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 3. Amount row — value input + unit picker chips */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                value={amountValue}
                onChangeText={setAmountValue}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <View style={styles.unitChipRow}>
                {AMOUNT_UNITS.map(unit => (
                  <Pressable
                    key={unit}
                    style={[styles.unitChip, amountUnit === unit && styles.chipActive]}
                    onPress={() => setAmountUnit(unit)}
                  >
                    <Text style={[styles.chipText, amountUnit === unit && styles.chipTextActive]}>
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* 4. Save / Cancel buttons */}
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saveDisabled && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saveDisabled}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#48484A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
    fontFamily: FONTS.semiBold,
  },
  section: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: FONTS.semiBold,
    marginBottom: 8,
  },
  glucoseDisplay: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 12,
    padding: 14,
  },
  glucoseValue: {
    fontSize: 17,
    color: COLORS.text,
    fontFamily: FONTS.mono,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.surfaceRaised,
  },
  chipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  chipTextActive: {
    color: COLORS.red,
    fontFamily: FONTS.semiBold,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceRaised,
    color: COLORS.text,
    fontSize: 17,
    padding: 14,
    borderRadius: 12,
    fontFamily: FONTS.regular,
  },
  unitChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceRaised,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.red,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.semiBold,
  },
});
