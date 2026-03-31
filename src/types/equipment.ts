export interface EquipmentChangeEntry {
  id: string;
  field: 'rapid_insulin_brand' | 'long_acting_insulin_brand' | 'delivery_method'
       | 'cgm_device' | 'pen_needle_brand';
  value: string;
  started_at: string;        // ISO — when this value became active
  ended_at?: string;         // ISO — when replaced (undefined = currently active)
                             // CRITICAL: ended_at === started_at on new entry
                             // Both generated from a single Date.now() call
  reason_for_change?: string;
  previous_value?: string;   // undefined for initial setup
}

export interface HypoTreatment {
  id: string;
  logged_at: string;
  glucose_at_event: number;           // mmol/L from latest Nightscout reading
  treatment_type: string;             // Glucose tablets | Juice | Sweets | Gel | Other
  amount_value: number;
  amount_unit: 'tablets' | 'ml' | 'g';
  insulin_brand?: string;             // stamp from active equipment profile
  glucose_readings_after?: number[];  // up to 12 readings, partial arrays valid
}

export interface DailyTIR {
  date: string;             // YYYY-MM-DD
  readings_count: number;
  in_range_count: number;   // 3.9–10.0 mmol/L inclusive
  tir_percentage: number;
  below_range_pct: number;  // < 3.9
  above_range_pct: number;  // > 10.0
}

export interface DataConsent {
  consented: boolean;
  consented_at?: string;    // ISO
  version: string;          // "1.0" — for future consent versioning
}
