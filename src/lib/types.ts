export type AppRole = "owner" | "admin" | "driver" | "rider";

export type AdminStatus = "not_requested" | "pending" | "approved" | "rejected";

export type RiderStatus = "pending_assignment" | "assigned" | "cancelled";

export type PickupLocation = "North Campus" | "South Campus";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
  admin_status: AdminStatus;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  sunday_date: string;
  full_name: string;
  phone: string;
  pickup_location: PickupLocation;
  pickup_time: string;
  available_seats: number;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Rider {
  id: string;
  user_id: string;
  sunday_date: string;
  full_name: string;
  phone: string;
  pickup_location: PickupLocation;
  selected_time: string;
  notes: string | null;
  admin_note: string | null;
  status: RiderStatus;
  assigned_driver_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RideAssignment {
  id: string;
  driver_id: string;
  rider_id: string;
  sunday_date: string;
  assigned_by: string | null;
  assignment_method: "auto" | "manual";
  created_at: string;
}

export interface AuditLog {
  id: string;
  sunday_date: string | null;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ReminderRun {
  id: string;
  sunday_date: string;
  reminder_group: "drivers" | "riders";
  trigger_source: "manual" | "cron";
  triggered_by: string | null;
  recipient_count: number;
  sent_count: number;
  status: "sent" | "skipped" | "failed";
  message: string | null;
  created_at: string;
}

export interface DriverCard extends Driver {
  riders: Rider[];
  seatsFilled: number;
  seatsRemaining: number;
}

export interface DashboardSummary {
  totalDrivers: number;
  totalRiders: number;
  confirmedRiders: number;
  coordinatingRiders: number;
  cancelledRiders: number;
  totalSeats: number;
  seatsRemaining: number;
  northCampusRiders: number;
  southCampusRiders: number;
}
