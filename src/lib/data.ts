import type { DashboardSummary, Driver, DriverCard, Rider } from "@/lib/types";

export function buildDriverCards(drivers: Driver[], riders: Rider[]): DriverCard[] {
  const ridersByDriver = new Map<string, Rider[]>();

  riders.forEach((rider) => {
    if (!rider.assigned_driver_id || rider.status !== "assigned") {
      return;
    }

    const current = ridersByDriver.get(rider.assigned_driver_id) ?? [];
    current.push(rider);
    ridersByDriver.set(rider.assigned_driver_id, current);
  });

  return drivers.map((driver) => {
    const assignedRiders = ridersByDriver.get(driver.id) ?? [];
    const seatsFilled = assignedRiders.length;

    return {
      ...driver,
      riders: assignedRiders,
      seatsFilled,
      seatsRemaining: Math.max(driver.available_seats - seatsFilled, 0),
    };
  });
}

export function buildSummary(drivers: Driver[], riders: Rider[]): DashboardSummary {
  const totalDrivers = drivers.length;
  const totalRiders = riders.length;
  const confirmedRiders = riders.filter((rider) => rider.status === "assigned").length;
  const coordinatingRiders = riders.filter((rider) => rider.status === "pending_assignment").length;
  const cancelledRiders = riders.filter((rider) => rider.status === "cancelled").length;
  const totalSeats = drivers.reduce((acc, driver) => acc + driver.available_seats, 0);
  const seatsRemaining = drivers.reduce((acc, driver) => {
    const filledSeats = riders.filter(
      (rider) => rider.assigned_driver_id === driver.id && rider.status === "assigned",
    ).length;

    return acc + Math.max(driver.available_seats - filledSeats, 0);
  }, 0);

  const northCampusRiders = riders.filter((rider) => rider.pickup_location === "North Campus").length;
  const southCampusRiders = riders.filter((rider) => rider.pickup_location === "South Campus").length;

  return {
    totalDrivers,
    totalRiders,
    confirmedRiders,
    coordinatingRiders,
    cancelledRiders,
    totalSeats,
    seatsRemaining,
    northCampusRiders,
    southCampusRiders,
  };
}

export function groupedTimeSlots(drivers: Driver[]) {
  const map = new Map<string, Set<string>>();

  drivers.forEach((driver) => {
    if (!driver.active) return;

    const key = driver.pickup_location;
    const existing = map.get(key) ?? new Set<string>();
    existing.add(driver.pickup_time);
    map.set(key, existing);
  });

  return {
    "North Campus": Array.from(map.get("North Campus") ?? []).sort(),
    "South Campus": Array.from(map.get("South Campus") ?? []).sort(),
  };
}
