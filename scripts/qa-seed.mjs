import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = (process.env.OWNER_EMAIL || "").toLowerCase();
const QA_PASSWORD = process.env.QA_PASSWORD || "Test1234!";

if (!url || !serviceRoleKey || !ownerEmail) {
  console.error("Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const QA_USERS = [
  { key: "admin_pending_a", email: "qa-admin-pending-a@example.com", full_name: "QA Admin Pending A", role: "admin", admin_status: "pending", phone: "+17185550101" },
  { key: "admin_pending_b", email: "qa-admin-pending-b@example.com", full_name: "QA Admin Pending B", role: "admin", admin_status: "pending", phone: "+17185550102" },
  { key: "driver_n1", email: "qa-driver-n1@example.com", full_name: "QA Driver North 1", role: "driver", admin_status: "not_requested", phone: "+17185550201" },
  { key: "driver_n2", email: "qa-driver-n2@example.com", full_name: "QA Driver North 2", role: "driver", admin_status: "not_requested", phone: "+17185550202" },
  { key: "rider_n1", email: "qa-rider-n1@example.com", full_name: "QA Rider North 1", role: "rider", admin_status: "not_requested", phone: "+17185550301" },
  { key: "rider_n2", email: "qa-rider-n2@example.com", full_name: "QA Rider North 2", role: "rider", admin_status: "not_requested", phone: "+17185550302" },
  { key: "rider_n3", email: "qa-rider-n3@example.com", full_name: "QA Rider North 3", role: "rider", admin_status: "not_requested", phone: "+17185550303" },
  { key: "rider_n4", email: "qa-rider-n4@example.com", full_name: "QA Rider North 4", role: "rider", admin_status: "not_requested", phone: "+17185550304" },
  { key: "rider_south", email: "qa-rider-south@example.com", full_name: "QA Rider South No Slot", role: "rider", admin_status: "not_requested", phone: "+17185550305" },
  { key: "rider_cancel", email: "qa-rider-cancel@example.com", full_name: "QA Rider Cancelled", role: "rider", admin_status: "not_requested", phone: "+17185550306" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextSundayET() {
  const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dow = etNow.getDay();
  const addDays = (7 - dow) % 7;
  etNow.setDate(etNow.getDate() + addDays);
  const y = etNow.getFullYear();
  const m = String(etNow.getMonth() + 1).padStart(2, "0");
  const d = String(etNow.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function listAllAuthUsers() {
  const all = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }

  return all;
}

async function ensureProfileExists(userId, email) {
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!error && data) return;
    await sleep(250);
  }
  throw new Error(`Profile row did not appear for ${email}`);
}

async function seed() {
  const { data: ownerProfile, error: ownerErr } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("email", ownerEmail)
    .maybeSingle();

  if (ownerErr || !ownerProfile) {
    throw new Error(`Owner profile not found for OWNER_EMAIL=${ownerEmail}`);
  }

  const existingUsers = await listAllAuthUsers();
  const byEmail = new Map(existingUsers.map((u) => [String(u.email || "").toLowerCase(), u]));
  const qaUserIds = {};

  for (const qa of QA_USERS) {
    const emailLower = qa.email.toLowerCase();
    let user = byEmail.get(emailLower);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: qa.email,
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: qa.full_name },
      });
      if (error || !data?.user) throw new Error(`createUser failed for ${qa.email}: ${error?.message}`);
      user = data.user;
    } else {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: QA_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: qa.full_name },
      });
      if (error) throw new Error(`updateUserById failed for ${qa.email}: ${error.message}`);
    }

    qaUserIds[qa.key] = user.id;
    await ensureProfileExists(user.id, qa.email);
  }

  for (const qa of QA_USERS) {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: qa.full_name,
        phone: qa.phone,
        role: qa.role,
        admin_status: qa.admin_status,
      })
      .eq("id", qaUserIds[qa.key]);

    if (error) throw new Error(`profiles update failed for ${qa.email}: ${error.message}`);
  }

  let sundayDate = nextSundayET();
  const sundayRpc = await supabase.rpc("current_service_sunday");
  if (!sundayRpc.error && sundayRpc.data) {
    sundayDate = sundayRpc.data;
  }

  const qaIds = Object.values(qaUserIds);

  await supabase
    .from("system_settings")
    .upsert({ id: true, schedule_locked: false, updated_by: ownerProfile.id }, { onConflict: "id" });

  const { data: existingDrivers, error: driverFetchErr } = await supabase
    .from("drivers")
    .select("id")
    .in("user_id", qaIds)
    .eq("sunday_date", sundayDate);
  if (driverFetchErr) throw new Error(driverFetchErr.message);

  const { data: existingRiders, error: riderFetchErr } = await supabase
    .from("riders")
    .select("id")
    .in("user_id", qaIds)
    .eq("sunday_date", sundayDate);
  if (riderFetchErr) throw new Error(riderFetchErr.message);

  const driverIds = (existingDrivers ?? []).map((r) => r.id);
  const riderIds = (existingRiders ?? []).map((r) => r.id);

  if (riderIds.length) {
    const { error } = await supabase.from("ride_assignments").delete().in("rider_id", riderIds);
    if (error) throw new Error(`Delete assignments by rider failed: ${error.message}`);
  }
  if (driverIds.length) {
    const { error } = await supabase.from("ride_assignments").delete().in("driver_id", driverIds);
    if (error) throw new Error(`Delete assignments by driver failed: ${error.message}`);
  }

  {
    const { error } = await supabase.from("riders").delete().in("user_id", qaIds).eq("sunday_date", sundayDate);
    if (error) throw new Error(`Delete riders failed: ${error.message}`);
  }
  {
    const { error } = await supabase.from("drivers").delete().in("user_id", qaIds).eq("sunday_date", sundayDate);
    if (error) throw new Error(`Delete drivers failed: ${error.message}`);
  }

  const driverSeedRows = [
    {
      user_id: qaUserIds.driver_n1,
      sunday_date: sundayDate,
      full_name: "QA Driver North 1",
      phone: "+17185550201",
      pickup_location: "North Campus",
      pickup_time: "10:10 AM",
      available_seats: 2,
      notes: "QA seed: North driver 1",
      active: true,
    },
    {
      user_id: qaUserIds.driver_n2,
      sunday_date: sundayDate,
      full_name: "QA Driver North 2",
      phone: "+17185550202",
      pickup_location: "North Campus",
      pickup_time: "10:10 AM",
      available_seats: 1,
      notes: "QA seed: North driver 2",
      active: true,
    },
  ];

  {
    const { error } = await supabase.from("drivers").upsert(driverSeedRows, { onConflict: "user_id,sunday_date" });
    if (error) throw new Error(`Upsert drivers failed: ${error.message}`);
  }

  const riderSeedRows = [
    {
      user_id: qaUserIds.rider_n1,
      sunday_date: sundayDate,
      full_name: "QA Rider North 1",
      phone: "+17185550301",
      pickup_location: "North Campus",
      selected_time: "10:10 AM",
      notes: "QA seed: pending for assignment test",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
    {
      user_id: qaUserIds.rider_n2,
      sunday_date: sundayDate,
      full_name: "QA Rider North 2",
      phone: "+17185550302",
      pickup_location: "North Campus",
      selected_time: "10:10 AM",
      notes: "QA seed: pending for assignment test",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
    {
      user_id: qaUserIds.rider_n3,
      sunday_date: sundayDate,
      full_name: "QA Rider North 3",
      phone: "+17185550303",
      pickup_location: "North Campus",
      selected_time: "10:10 AM",
      notes: "QA seed: pending for drag-and-drop test",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
    {
      user_id: qaUserIds.rider_n4,
      sunday_date: sundayDate,
      full_name: "QA Rider North 4",
      phone: "+17185550304",
      pickup_location: "North Campus",
      selected_time: "10:10 AM",
      notes: "QA seed: extra rider for capacity/rematch test",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
    {
      user_id: qaUserIds.rider_south,
      sunday_date: sundayDate,
      full_name: "QA Rider South No Slot",
      phone: "+17185550305",
      pickup_location: "South Campus",
      selected_time: "To be coordinated",
      notes: "QA seed: no South driver slot scenario",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
    {
      user_id: qaUserIds.rider_cancel,
      sunday_date: sundayDate,
      full_name: "QA Rider Cancelled",
      phone: "+17185550306",
      pickup_location: "North Campus",
      selected_time: "10:10 AM",
      notes: "QA seed: use this for cancel scenario in UI",
      admin_note: null,
      status: "pending_assignment",
      assigned_driver_id: null,
    },
  ];

  {
    const { error } = await supabase.from("riders").upsert(riderSeedRows, { onConflict: "user_id,sunday_date" });
    if (error) throw new Error(`Upsert riders failed: ${error.message}`);
  }

  const reminderInsert = await supabase.from("reminder_runs").insert([
    {
      sunday_date: sundayDate,
      reminder_group: "drivers",
      trigger_source: "manual",
      triggered_by: ownerProfile.id,
      recipient_count: 2,
      sent_count: 0,
      status: "skipped",
      message: "QA seed reminder run (safe test record)",
    },
  ]);
  if (reminderInsert.error && reminderInsert.error.code !== "42P01") {
    throw new Error(`Insert reminder_runs failed: ${reminderInsert.error.message}`);
  }

  const auditInsert = await supabase.from("audit_logs").insert([
    {
      sunday_date: sundayDate,
      actor_id: ownerProfile.id,
      actor_email: ownerProfile.email,
      action: "qa_seed_loaded",
      entity_type: "system",
      entity_id: null,
      details: { source: "scripts/qa-seed.mjs" },
    },
  ]);
  if (auditInsert.error && auditInsert.error.code !== "42P01") {
    throw new Error(`Insert audit_logs failed: ${auditInsert.error.message}`);
  }

  console.log("\nSeed complete.");
  console.log(`Sunday cycle: ${sundayDate}`);
  console.log(`QA password for all accounts: ${QA_PASSWORD}`);
  console.log("\nQA accounts:");
  for (const qa of QA_USERS) {
    console.log(`- ${qa.key}: ${qa.email}`);
  }
  console.log("\nNext in UI:");
  console.log("1) Owner: approve qa-admin-pending-a@example.com, reject qa-admin-pending-b@example.com");
  console.log("2) Admin board: run auto-match, then drag/move riders and test capacity");
  console.log("3) Admin board: test remove rider/driver + auto-rematch");
  console.log("4) Rider South: verify coordinating/no-slot behavior");
  console.log("5) Rider Cancel user: open rider dashboard and test cancel flow");
  console.log("6) Owner: lock/unlock schedule and verify rider/driver save behavior");
  console.log("7) History page: check reminder run + audit log visibility");
}

seed().catch((err) => {
  console.error("\nSeed failed:");
  console.error(err.message || err);
  process.exit(1);
});
