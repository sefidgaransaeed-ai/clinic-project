export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "arrived"
  | "done"
  | "no_show"
  | "cancelled";

export type AppointmentSource = "site" | "panel";

/**
 * This intentionally mirrors the fields planned for the patients table.
 * It exists locally only until the patients module and database are connected.
 */
export interface Patient {
  id: string;
  full_name: string;
  mobile: string;
  national_id: string;
  insurance_type_name: string;
}

/** Matches the planned appointments table shape, using database column names. */
export interface Appointment {
  id: string;
  patient_id: string | null;
  requester_name: string;
  requester_mobile: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  created_by: string;
  note: string | null;
}

export interface AppointmentWithPatient extends Appointment {
  patient: Patient | null;
}

export interface Closure {
  date: string;
  reason: string;
}

export interface WorkingDay {
  weekday: number;
  label: string;
  start_time: string;
  end_time: string;
}

export interface AppointmentSnapshot {
  appointments: AppointmentWithPatient[];
  patients: Patient[];
}

export interface NewPatientInput {
  full_name: string;
  mobile: string;
  national_id: string;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}
