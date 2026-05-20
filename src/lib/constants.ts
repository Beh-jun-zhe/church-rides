import type { PickupLocation, RiderStatus } from "@/lib/types";

export const APP_NAME = "Church Ride Link";

export const PICKUP_LOCATIONS: PickupLocation[] = ["North Campus", "South Campus"];

export const RIDER_STATUS_LABELS: Record<RiderStatus, string> = {
  pending_assignment: "Coordinating ride",
  assigned: "Ride confirmed",
  cancelled: "Cancelled",
};

export const RIDER_STATUS_TONE: Record<RiderStatus, "green" | "amber" | "slate"> = {
  pending_assignment: "amber",
  assigned: "green",
  cancelled: "slate",
};

export const FLEXIBLE_TIME_SLOT = "To be coordinated";

export const COORDINATION_MESSAGE =
  "Your ride request has been received. We are currently coordinating available seats, and you will be notified as soon as a driver is confirmed. An admin will reach out regardless, so don't worry. Final ride details will be sorted out by Saturday noon.";

export const ADMIN_PENDING_MESSAGE =
  "Your admin access request has been submitted. The owner will review and approve your access.";
