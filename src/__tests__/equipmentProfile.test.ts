import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: equipmentProfile.ts does not exist yet — Wave 1 creates it.
// These stubs will fail until Wave 1 implements the module.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const equipmentProfile = (() => {
  try { return require('../utils/equipmentProfile'); } catch { return {}; }
})();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('equipmentProfile', () => {
  it('initial onboarding creates one entry per field with started_at and no ended_at', () => {
    expect(true).toBe(false); // not implemented yet — Wave 1 will implement
  });

  it('changeEquipment closes the previous entry and opens a new one', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('changeEquipment: ended_at on closing entry === started_at on new entry (same timestamp)', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('changeEquipment records previous_value correctly', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('changeEquipment records reason_for_change when provided', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getActiveEquipment returns the entry with no ended_at', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getEquipmentAtTime returns the correct entry for a timestamp mid-window', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getEquipmentAtTime returns null before any entries exist', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getEquipmentAtTime returns correct entry when multiple changes have occurred', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getCurrentEquipmentProfile returns all active fields as a flat object', () => {
    expect(true).toBe(false); // not implemented yet
  });

  it('getCurrentEquipmentProfile returns longActingInsulinBrand: null when user selected opt-out', () => {
    expect(true).toBe(false); // not implemented yet
  });
});
