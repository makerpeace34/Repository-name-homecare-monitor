"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type VitalRecord = {
  id: string;
  patientId: string;
  patient: string;
  date: string;
  filterDate: string;
  time: string;
  enteredBy: string;
  enteredByFull: string;
  bp: string;
  heartRate: string;
  spo2: string;
  temperature: string;
  glycemia: string;
  urineOutput: string;
  note: string;
};

type Patient = {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  active: boolean;
};

type PatientFormData = {
  patientCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  role: "admin" | "caregiver";
  active: boolean;
  organization_id: string;
};


type Treatment = {
  id: string;
  patientId: string;
  medication: string;
  createdAt: string;
};

type RosterAssignment = {
  id: string;
  shiftDate: string;
  shift: "day" | "night";
  userId: string;
  fullName: string;
};

type RosterStaff = {
  id: string;
  fullName: string;
};

const emptyPatientForm: PatientFormData = {
  patientCode: "",
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  address: "",
  emergencyContact: "",
  emergencyPhone: "",
};

function formatNumericDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatFilterDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
}

function formatStoredDate(dateString: string) {
  if (!dateString) {
    return "";
  }

  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return dateString;
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

export default function Home() {
  useEffect(() => {
    document.title = "Healthy HomeCare";
  }, []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [checkingSession, setCheckingSession] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const [authError, setAuthError] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
  async function checkSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setSession(session);
    setCheckingSession(false);
  }

  checkSession();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, newSession) => {
    if (event === "PASSWORD_RECOVERY") {
      setIsPasswordRecovery(true);
      setSession(newSession);
      setCheckingSession(false);
      return;
    }

    setSession(newSession);

    if (!newSession) {
      setProfile(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}, []);
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        return;
      }

      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, role, active, organization_id")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Profile error:", error);
        setProfile(null);
        setAuthError("Your user profile could not be loaded.");
        setProfileLoading(false);
        return;
      }

      if (!data.active) {
        await supabase.auth.signOut();
        setAuthError(
          "Your account is inactive. Please contact the administrator."
        );
        setProfileLoading(false);
        return;
      }

      setProfile(data as Profile);
      setProfileLoading(false);
    }

    loadProfile();
  }, [session]);

  if (isPasswordRecovery) {
  return (
    <ResetPasswordScreen
      onFinished={() => {
        setIsPasswordRecovery(false);
        setAuthError("");
      }}
    />
  );
}
  if (checkingSession || (session && profileLoading)) {
    return (
      <div className="authPage">
        <div className="authLoading">
          <div className="authLogo">+</div>
          <h2>Healthy HomeCare</h2>
          <p>Loading your account...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen authError={authError} setAuthError={setAuthError} />;
  }

  if (!profile) {
    return (
      <div className="authPage">
        <div className="loginCard">
          <div className="loginBrand">
            <div className="authLogo">+</div>
            <div>
              <h1>Healthy HomeCare</h1>
              <p>Patient Monitoring &amp; Care Management</p>
            </div>
          </div>

          <div className="loginError">
            Your account is signed in, but your Healthy HomeCare profile could not be
            loaded.
          </div>

          <button
            className="primaryButton"
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <HomeCareApp session={session} profile={profile} />;
}

function LoginScreen({
  authError,
  setAuthError,
}: {
  authError: string;
  setAuthError: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAuthError("");
    setSigningIn(true);

    if (!email.trim() || !password) {
      setAuthError("Please enter your email and password.");
      setSigningIn(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
  console.error("Supabase login error:", error);
  setAuthError(error.message);
  setSigningIn(false);
  return;
} 

    setSigningIn(false);
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim();

    setAuthError("");
    setResetMessage("");

    if (!cleanEmail) {
      setAuthError(
        "Enter your email address first, then select Forgot password."
      );
      return;
    }

    setResettingPassword(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      {
        redirectTo: "https://healthyhomecare.vercel.app/",
      }
    );

    if (error) {
      setAuthError(error.message);
      setResettingPassword(false);
      return;
    }

    setResetMessage(
      "Password reset link sent. Check your email and follow the link to create a new password."
    );
    setResettingPassword(false);
  }

  return (
    <div className="authPage">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="authLogo">+</div>

          <div>
            <h1>Healthy HomeCare</h1>
            <p>Patient Monitoring &amp; Care Management</p>
          </div>
        </div>

        <div className="loginWelcome">
          <h2>Welcome back</h2>
          <p>Sign in to access the homecare patient monitoring system.</p>
        </div>

        {authError && <div className="loginError">{authError}</div>}

        <form className="loginForm" onSubmit={handleLogin}>
          <div className="field">
            <label>Email Address</label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="primaryButton loginButton"
            disabled={signingIn}
          >
            {signingIn ? "Signing in..." : "Sign In"}
          </button>

          <button
            type="button"
            className="textButton"
            onClick={handleForgotPassword}
            disabled={resettingPassword}
            style={{
              alignSelf: "flex-end",
              marginTop: 4,
            }}
          >
            {resettingPassword
              ? "Sending reset link..."
              : "Forgot password?"}
          </button>
        </form>

        {resetMessage && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 8,
              background: "rgba(24, 128, 112, 0.10)",
            }}
          >
            {resetMessage}
          </div>
        )}

        <div className="loginSecurity">
          <span>🔒</span>
          <p>
            Access is restricted to authorized homecare staff.
          </p>
        </div>
      </div>
    </div>
  );
}
function ResetPasswordScreen({
  onFinished,
}: {
  onFinished: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (newPassword.length < 8) {
      setMessage(
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();

    setSaving(false);

    alert(
      "Your password has been changed successfully. Please sign in with your new password."
    );

    onFinished();
  }

  return (
    <div className="authPage">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="authLogo">+</div>

          <div>
            <h1>Healthy HomeCare</h1>
            <p>Patient Monitoring &amp; Care Management</p>
          </div>
        </div>

        <div className="loginWelcome">
          <h2>Create a new password</h2>

          <p>
            Enter a new password for your Healthy HomeCare account.
          </p>
        </div>

        {message && (
          <div className="loginError">
            {message}
          </div>
        )}

        <form
          className="loginForm"
          onSubmit={handleResetPassword}
        >
          <div className="field">
            <label>New Password</label>

            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div className="field">
            <label>Confirm New Password</label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="primaryButton loginButton"
            disabled={saving}
          >
            {saving
              ? "Saving Password..."
              : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "Dashboard") {
    return <svg {...common}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (name === "New Record") {
    return <svg {...common}><path d="M12 5v14M5 12h14" /><circle cx="12" cy="12" r="9" /></svg>;
  }
  if (name === "Patients") {
    return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M6 21v-2a6 6 0 0 1 12 0v2" /></svg>;
  }
  if (name === "Records") {
    return <svg {...common}><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></svg>;
  }
  if (name === "Users") {
    return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8a3 3 0 0 1 0 6M18 17a5 5 0 0 1 3 4" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /><circle cx="12" cy="12" r="10" /></svg>;
}

function DashboardStatIcon({ type }: { type: "patients" | "records" | "staff" | "notes" }) {
  if (type === "patients") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3" fill="currentColor" />
        <circle cx="16.5" cy="9" r="2.5" fill="currentColor" opacity="0.82" />
        <path d="M3.5 19c.5-4 2.8-6 5.5-6s5 2 5.5 6H3.5Z" fill="currentColor" />
        <path d="M13.5 19c.3-2.7 1.7-4.5 4-4.5 2.1 0 3.6 1.6 4 4.5h-8Z" fill="currentColor" opacity="0.82" />
      </svg>
    );
  }
  if (type === "staff") {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <circle cx="12" cy="7.5" r="4" fill="currentColor" />
        <path d="M5 20c.4-4.7 3-7 7-7s6.6 2.3 7 7H5Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="27" height="27" fill="none" aria-hidden="true">
      <path d="M7 3.5h7l4 4V20.5H7V3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 3.5v4h4M10 12h5M10 15.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HomeCareApp({
  session,
  profile,
}: {
  session: Session;
  profile: Profile;
}) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [signingOut, setSigningOut] = useState(false);
  const [dashboardNote, setDashboardNote] = useState<{
    patient: string;
    note: string;
  } | null>(null);
  const [showDashboardRoster, setShowDashboardRoster] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
const [patientsLoading, setPatientsLoading] = useState(true);
  const [records, setRecords] = useState<VitalRecord[]>([]);
const [recordsLoading, setRecordsLoading] = useState(true);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [organizationName, setOrganizationName] = useState("Your Organization");

  const activePatients = patients.filter((patient) => patient.active).length;

  // Dashboard summary values derived from the formatted VitalRecord data.
  const todayKey = formatNumericDate(new Date());

  const recordsTodayCount = records.filter(
    (record) => record.date === todayKey
  ).length;

  const notesTodayCount = records.filter(
    (record) =>
      record.date === todayKey &&
      Boolean(record.note && record.note !== "—")
  ).length;

  const recentRecords = records
    .filter((record) => record.note && record.note !== "—")
    .slice(0, 3);

  const displayName =
    profile.full_name ||
    session.user.email ||
    "HomeCare User";

  const initials = getInitials(displayName);

// Load patients from Supabase
async function loadPatients() {
  setPatientsLoading(true);

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading patients:", error);
    alert("Could not load patients.");
    setPatientsLoading(false);
    return;
  }

  setPatients(
  (data || []).map((patient) => ({
    id: patient.id,
    patientCode: patient.patient_code,
    firstName: patient.first_name,
    lastName: patient.last_name,
    dateOfBirth: patient.date_of_birth || "",
    gender: patient.gender || "",
    phone: patient.phone || "",
    address: patient.address || "",
    emergencyContact: patient.emergency_contact || "",
    emergencyPhone: patient.emergency_phone || "",
    active: patient.active,
  }))
);
  setPatientsLoading(false);
}
async function loadRecords() {
  setRecordsLoading(true);

  const { data, error } = await supabase
    .from("vital_records")
    .select(`
      id,
      patient_id,
      systolic,
      diastolic,
      heart_rate,
      spo2,
      temperature,
      glycemia,
      urine_output,
      progress_note,
      recorded_at,
      recorded_by,
      patients!vital_records_patient_organization_fkey (
  patient_code,
  first_name,
  last_name
)
    `)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error loading records:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    alert(
      `Could not load patient records.\n\n` +
      `Code: ${error.code || "none"}\n` +
      `Message: ${error.message || "none"}\n` +
      `Details: ${error.details || "none"}\n` +
      `Hint: ${error.hint || "none"}`
    );

    setRecordsLoading(false);
    return;
  }

  const recorderIds = Array.from(
    new Set(
      (data || [])
        .map((record: any) => record.recorded_by)
        .filter(Boolean)
    )
  );

  const recorderNames: Record<string, string> = {};
  const recorderFullNames: Record<string, string> = {};

  if (recorderIds.length > 0) {
    const {
      data: recorderProfiles,
      error: profileError,
    } = await supabase.rpc("get_homecare_staff_names", {
      staff_ids: recorderIds,
    });

    if (profileError) {
      console.error(
        "Error loading staff names:",
        profileError
      );
    } else {
      (recorderProfiles || []).forEach(
        (staff: any) => {
          const fullName =
            staff.full_name?.trim() || "";

          const nameParts = fullName.split(/\s+/);

recorderFullNames[staff.id] = fullName || "Unknown";

recorderNames[staff.id] =
  nameParts[nameParts.length - 1] ||
  "Unknown";
        }
      );
    }
  }

  const formattedRecords: VitalRecord[] = (
    data || []
  ).map((record: any) => {
    const recordedDate = new Date(
      record.recorded_at
    );

    const patientData = Array.isArray(
      record.patients
    )
      ? record.patients[0]
      : record.patients;

    const patientName = patientData
      ? `${patientData.patient_code} - ${patientData.first_name} ${patientData.last_name}`
      : "Unknown Patient";

    const bloodPressure =
      record.systolic !== null &&
      record.diastolic !== null
        ? `${record.systolic}/${record.diastolic}`
        : record.systolic !== null
        ? `${record.systolic}/—`
        : record.diastolic !== null
        ? `—/${record.diastolic}`
        : "—";

    return {
      id: record.id,
      patientId: record.patient_id,
      patient: patientName,

      date: formatNumericDate(recordedDate),
      filterDate: formatFilterDate(recordedDate),

      time: recordedDate.toLocaleTimeString(
        undefined,
        {
          hour: "numeric",
          minute: "2-digit",
        }
      ),

      enteredBy:
        recorderNames[record.recorded_by] ||
        "Unknown",

      enteredByFull:
        recorderFullNames[record.recorded_by] ||
        "Unknown",

      bp: bloodPressure,

      heartRate:
        record.heart_rate !== null
          ? String(record.heart_rate)
          : "—",

      spo2:
        record.spo2 !== null
          ? String(record.spo2)
          : "—",

      temperature:
        record.temperature !== null
          ? String(record.temperature)
          : "—",

      glycemia:
        record.glycemia !== null
          ? String(record.glycemia)
          : "—",

      urineOutput:
        record.urine_output !== null
          ? String(record.urine_output)
          : "—",

      note: record.progress_note || "—",
    };
  });

  setRecords(formattedRecords);
  setRecordsLoading(false);
}

// Load patients when HomeCare opens
useEffect(() => {
  loadPatients();
  loadRecords();
}, []);

async function loadOrganizationName() {
  const { data, error } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .single();

  if (error) {
    console.error("Error loading organization name:", error);
    return;
  }

  if (data?.name) {
    setOrganizationName(data.name);
  }
}

async function loadActiveStaffCount() {
  const { data, error } = await supabase.rpc("get_active_roster_staff");
  if (error) {
    console.error("Error loading active staff count:", error);
    setActiveStaffCount(0);
    return;
  }
  setActiveStaffCount((data || []).length);
}

useEffect(() => {
  loadActiveStaffCount();
  loadOrganizationName();
}, [profile.organization_id]);

async function handleSignOut() {
  setSigningOut(true);

  await supabase.auth.signOut();

  setSigningOut(false);
}

  const menuItems =
    profile.role === "admin"
      ? [
          "Dashboard",
          "New Record",
          "Patients",
          "Records",
          "Users",
          "My Account",
        ]
      : [
          "Dashboard",
          "New Record",
          "Patients",
          "Records",
          "My Account",
        ];

  return (
    <div className="app">
      <style>{`
        /* Dashboard shell: override the older fixed-sidebar layout in globals.css. */
        .app {
          display: flex !important;
          align-items: stretch !important;
          min-height: 100vh !important;
          width: 100% !important;
          background: #f5f9fa !important;
          overflow: visible !important;
        }

        .app > .sidebar {
          position: sticky !important;
          top: 0 !important;
          left: auto !important;
          bottom: auto !important;
          width: 310px !important;
          min-width: 310px !important;
          flex: 0 0 310px !important;
          height: 100vh !important;
          min-height: 100vh !important;
          box-sizing: border-box !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          z-index: 20 !important;
        }

        .app > .main {
          position: relative !important;
          margin-left: 0 !important;
          left: auto !important;
          width: auto !important;
          max-width: none !important;
          min-width: 0 !important;
          flex: 1 1 auto !important;
          box-sizing: border-box !important;
          padding-left: 34px !important;
          padding-right: 34px !important;
          padding-bottom: 36px !important;
          overflow-x: hidden !important;
        }

        .app > .main > .topbar {
          width: 100% !important;
          box-sizing: border-box !important;
        }

        .hh-stat-grid > div {
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        @media (max-width: 1380px) {
          .app > .sidebar {
            width: 270px !important;
            min-width: 270px !important;
            flex-basis: 270px !important;
          }
          .app > .main {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          .hh-stat-grid {
            gap: 14px !important;
          }
          .hh-stat-grid > div {
            grid-template-columns: 54px minmax(0,1fr) !important;
            gap: 12px !important;
            padding: 18px !important;
          }
          .hh-stat-grid > div > div:first-child {
            width: 52px !important;
            height: 52px !important;
          }
        }

        @media (max-width:1180px) {
          .hh-stat-grid {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          }
          .hh-dashboard-lower {
            grid-template-columns:1fr !important;
          }
        }

        @media (max-width:820px) {
          .app {
            display:block !important;
          }
          .app > .sidebar {
            position:relative !important;
            width:100% !important;
            min-width:100% !important;
            height:auto !important;
            min-height:auto !important;
          }
          .app > .main {
            width:100% !important;
            padding-left:18px !important;
            padding-right:18px !important;
          }
          .hh-stat-grid {
            grid-template-columns:1fr !important;
          }
        }

        /* Keep the sidebar usable on shorter laptop screens without browser zoom. */
        @media (min-width:821px) and (max-height:700px) {
          .app > .sidebar .logo {
            margin-bottom: 12px !important;
          }
          .app > .sidebar .navButton {
            min-height: 48px !important;
          }
          .app > .sidebar .sidebarBottom {
            padding-top: 6px !important;
          }
          .app > .sidebar .logoutButton {
            min-height: 54px !important;
            margin-top: 10px !important;
          }
        }

        /* FINAL APPROVED COMPACT DASHBOARD */
        @media (min-width: 821px) {
          .app > .sidebar {
            width: 265px !important;
            min-width: 265px !important;
            flex-basis: 265px !important;
            padding: 22px 16px 16px !important;
          }
          .app > .sidebar .logo {
            margin-bottom: 18px !important;
          }
          .app > .sidebar .logoIcon {
            width: 50px !important;
            height: 50px !important;
            min-width: 50px !important;
          }
          .app > .sidebar .logo h2 {
            font-size: 20px !important;
          }
          .app > .sidebar .logo span {
            font-size: 12px !important;
          }
          .app > .sidebar nav {
            gap: 3px !important;
          }
          .app > .sidebar .navButton {
            min-height: 48px !important;
            padding: 0 14px !important;
          }
          .app > .sidebar .navButton span:last-child {
            font-size: 15px !important;
          }
          .app > .sidebar .sidebarBottom {
            padding-top: 10px !important;
          }
          .app > .sidebar .organizationBadge {
            margin-bottom: 12px !important;
          }
          .app > .sidebar .userMini {
            margin-top: 10px !important;
          }
          .app > .sidebar .logoutButton {
            min-height: 56px !important;
            margin-top: 12px !important;
          }
          .app > .main {
            padding-left: 28px !important;
            padding-right: 28px !important;
            padding-bottom: 24px !important;
          }
          .app > .main > .topbar {
            min-height: 92px !important;
            padding-top: 16px !important;
            padding-bottom: 14px !important;
            margin-bottom: 20px !important;
          }
          .app > .main > .topbar h1 {
            font-size: 29px !important;
          }
        }

        /* ONE-SCREEN DASHBOARD AT 100% ZOOM */
        @media (min-width: 821px) {
          html, body {
            height: 100%;
          }

          .app {
            height: 100vh !important;
            min-height: 100vh !important;
            overflow: hidden !important;
          }

          .app > .sidebar {
            height: 100vh !important;
            min-height: 100vh !important;
            overflow: hidden !important;
          }

          .app > .main.dashboardMain {
            height: 100vh !important;
            min-height: 0 !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            padding-bottom: 14px !important;
          }

          .app > .main.dashboardMain > .topbar {
            flex: 0 0 82px !important;
            min-height: 82px !important;
            height: 82px !important;
            margin-bottom: 14px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
          }

          .app > .main.dashboardMain > .topbar h1 {
            font-size: 27px !important;
            line-height: 1.05 !important;
          }

          .app > .main.dashboardMain > .topbar .eyebrow {
            margin-bottom: 6px !important;
          }

          .hh-dashboard-screen {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            height: calc(100vh - 110px) !important;
            display: grid !important;
            grid-template-rows: 108px 116px minmax(0, 1fr) !important;
            gap: 14px !important;
            overflow: hidden !important;
          }

          .hh-dashboard-hero {
            min-height: 0 !important;
            height: 108px !important;
            padding: 18px 28px !important;
          }

          .hh-dashboard-hero h2 {
            font-size: 27px !important;
          }

          .hh-stat-grid {
            margin-top: 0 !important;
            height: 116px !important;
            gap: 12px !important;
          }

          .hh-stat-grid > div {
            min-height: 0 !important;
            height: 116px !important;
            padding: 14px 17px !important;
          }

          .hh-dashboard-lower {
            margin-top: 0 !important;
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
          }

          .hh-recent-panel,
          .hh-quick-panel {
            min-height: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }

          .hh-recent-panel {
            display: flex !important;
            flex-direction: column !important;
          }

          .hh-records-scroll {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: auto !important;
          }

          .hh-quick-panel {
            display: flex !important;
            flex-direction: column !important;
          }

          .hh-quick-panel > button {
            min-height: 58px !important;
            height: 58px !important;
            margin-top: 7px !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }

          .hh-quick-panel > button span {
            line-height: 1.15 !important;
          }
        }

        @media (min-width: 821px) and (max-height: 760px) {
          .app > .sidebar {
            padding-top: 14px !important;
            padding-bottom: 10px !important;
          }
          .app > .sidebar .logo {
            margin-bottom: 10px !important;
          }
          .app > .sidebar .navButton {
            min-height: 43px !important;
          }
          .app > .sidebar .sidebarBottom {
            padding-top: 5px !important;
          }
          .app > .sidebar .organizationBadge {
            margin-bottom: 6px !important;
          }
          .app > .sidebar .userMini {
            margin-top: 5px !important;
          }
          .app > .sidebar .logoutButton {
            min-height: 48px !important;
            margin-top: 7px !important;
          }
          .hh-dashboard-screen {
            grid-template-rows: 96px 104px minmax(0, 1fr) !important;
            gap: 10px !important;
          }
          .hh-dashboard-hero {
            height: 96px !important;
            padding: 14px 24px !important;
          }
          .hh-stat-grid,
          .hh-stat-grid > div {
            height: 104px !important;
          }
        }


        /* Non-dashboard pages must keep their original scrolling and interactions. */
        @media (min-width: 821px) {
          .app > .main:not(.dashboardMain) {
            height: auto !important;
            min-height: 100vh !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            display: block !important;
          }

          .app > .main:not(.dashboardMain) > .topbar {
            height: auto !important;
            min-height: 92px !important;
            margin-bottom: 20px !important;
          }
        }


        /* Dashboard spacing safety fix — layout only.
           Keep the four KPI cards above the lower panels with a real gap. */
        @media (min-width: 821px) {
          .dashboardMain .hh-dashboard-screen {
            display: grid !important;
            grid-template-rows: auto 122px minmax(0, 1fr) !important;
            row-gap: 10px !important;
            min-height: 0 !important;
          }

          .dashboardMain .hh-stat-grid {
            align-self: start !important;
            min-height: 0 !important;
            margin: 0 !important;
            position: relative !important;
            z-index: 2 !important;
          }

          .dashboardMain .hh-stat-grid > * {
            min-height: 122px !important;
            height: 122px !important;
          }

          .dashboardMain .hh-stat-grid > * > div:last-child > div:nth-child(2) {
            margin-top: 3px !important;
          }

          .dashboardMain .hh-stat-grid > * > div:last-child > div:nth-child(3) {
            margin-top: 7px !important;
            line-height: 1.2 !important;
          }

          .dashboardMain .hh-dashboard-lower {
            align-self: stretch !important;
            min-height: 0 !important;
            margin-top: 0 !important;
            position: relative !important;
            z-index: 1 !important;
          }
        }

        /* FINAL COMPACT DASHBOARD — approved one-screen layout */
        @media (min-width: 821px) {
          .hh-dashboard-screen {
            grid-template-rows: 96px 112px minmax(0, 1fr) !important;
            gap: 12px !important;
          }

          .hh-dashboard-hero {
            height: 96px !important;
            min-height: 96px !important;
            padding: 14px 24px !important;
          }

          .hh-dashboard-hero h2 {
            font-size: 25px !important;
            line-height: 1.08 !important;
          }

          .hh-dashboard-hero p {
            margin-top: 7px !important;
            font-size: 15px !important;
            line-height: 1.25 !important;
          }

          .hh-stat-grid {
            height: 112px !important;
            min-height: 112px !important;
            gap: 12px !important;
          }

          .hh-stat-grid > div {
            height: 112px !important;
            min-height: 112px !important;
            padding: 12px 14px !important;
            grid-template-columns: 50px minmax(0, 1fr) !important;
            gap: 12px !important;
            overflow: hidden !important;
          }

          .hh-stat-grid > div > div:first-child {
            width: 48px !important;
            height: 48px !important;
            border-radius: 12px !important;
          }

          .hh-stat-grid > div > div:last-child {
            min-width: 0 !important;
          }

          .hh-stat-grid > div > div:last-child > div:nth-child(1) {
            font-size: 14px !important;
            line-height: 1.1 !important;
            white-space: nowrap !important;
          }

          .hh-stat-grid > div > div:last-child > div:nth-child(2) {
            margin-top: 3px !important;
            font-size: 29px !important;
            line-height: 1 !important;
          }

          .hh-stat-grid > div > div:last-child > div:nth-child(3) {
            margin-top: 7px !important;
            font-size: 12px !important;
            line-height: 1.15 !important;
            white-space: normal !important;
          }

          .hh-dashboard-lower {
            gap: 16px !important;
            min-height: 0 !important;
          }

          .hh-recent-panel,
          .hh-quick-panel {
            padding: 16px 18px !important;
          }

          .hh-recent-panel > div:first-child {
            margin-bottom: 8px !important;
          }

          .hh-recent-panel h3,
          .hh-quick-panel h3 {
            font-size: 18px !important;
            line-height: 1.15 !important;
          }

          .hh-recent-panel p,
          .hh-quick-panel p {
            margin-top: 3px !important;
            font-size: 12px !important;
          }

          .hh-records-scroll {
            overflow: hidden !important;
          }

          .hh-records-scroll table {
            table-layout: fixed !important;
          }

          .hh-records-scroll thead th {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
            font-size: 10px !important;
          }

          .hh-records-scroll tbody td {
            padding-top: 9px !important;
            padding-bottom: 9px !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }

          .hh-records-scroll tbody tr {
            height: 58px !important;
          }

          .hh-quick-panel > button {
            height: 58px !important;
            min-height: 58px !important;
            margin-top: 7px !important;
            padding: 7px 12px !important;
            grid-template-columns: 36px minmax(0,1fr) 14px !important;
            gap: 9px !important;
          }

          .hh-quick-panel > button span span:first-child {
            font-size: 13px !important;
          }

          .hh-quick-panel > button span span:last-child {
            margin-top: 2px !important;
            font-size: 12px !important;
            line-height: 1.1 !important;
          }
        }

        @media (min-width: 821px) and (max-height: 700px) {
          .hh-dashboard-screen {
            grid-template-rows: 88px 102px minmax(0, 1fr) !important;
            gap: 9px !important;
          }

          .hh-dashboard-hero {
            height: 88px !important;
            min-height: 88px !important;
          }

          .hh-stat-grid,
          .hh-stat-grid > div {
            height: 102px !important;
            min-height: 102px !important;
          }

          .hh-records-scroll tbody tr {
            height: 52px !important;
          }

          .hh-records-scroll tbody td {
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }

          .hh-quick-panel > button {
            height: 52px !important;
            min-height: 52px !important;
            margin-top: 5px !important;
          }
        }
      `}</style>
      <aside className="sidebar" style={{ minHeight:"100vh", width:310, flex:"0 0 310px", display:"flex", flexDirection:"column", background:"linear-gradient(180deg,#0d4f54 0%,#005d5c 100%)" }}>
        <div>
          <div className="logo">
            <div className="logoIcon">+</div>

            <div style={{ minWidth: 0 }}>
              <h2 style={{ lineHeight: 1.15, margin: 0 }}>Healthy HomeCare</h2>
              <span style={{ display: "block", marginTop: 5, lineHeight: 1.25 }}>
                Patient Monitoring &amp; Care Management
              </span>
            </div>
          </div>

          <nav>
            {menuItems.map((item) => (
              <button key={item} className={activePage === item ? "navButton active" : "navButton"} onClick={() => setActivePage(item)} style={{ display:"grid", gridTemplateColumns:"34px minmax(0,1fr)", alignItems:"center", gap:12, width:"100%", minHeight:58, padding:"0 18px", borderRadius:10, textAlign:"left" }}>
                <span className="navIcon" style={{ width:34, height:34, display:"grid", placeItems:"center", flexShrink:0 }}><NavIcon name={item} /></span>
                <span style={{ fontSize:16, lineHeight:1.2 }}>{item}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebarBottom" style={{ marginTop:"auto", paddingTop:12 }}>
          <div
            className="organizationBadge"
            style={{
              display: "grid",
              gap: 4,
              padding: "12px 0",
              marginBottom: 10,
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.7,
              }}
            >
              Organization
            </span>
            <strong style={{ lineHeight: 1.3, overflowWrap: "anywhere" }}>
              {organizationName}
            </strong>
          </div>

          <div className="userMini">
            <div className="avatar">{initials}</div>

            <div>
              <strong>{displayName}</strong>
              <span>
                {profile.role === "admin" ? "Administrator" : "Caregiver"}
              </span>
            </div>
          </div>

          <button type="button" className="logoutButton" onClick={handleSignOut} disabled={signingOut} style={{ width:"100%", minHeight:66, marginTop:18, padding:"0 18px", borderRadius:11, border:"1px solid rgba(255,255,255,.55)", background:"rgba(255,255,255,.035)", color:"#fff", display:"flex", alignItems:"center", gap:18, fontSize:17, fontWeight:750, cursor:signingOut ? "not-allowed" : "pointer" }}>
            <span style={{ fontSize:28, lineHeight:1 }}>⇥</span><span>{signingOut ? "Signing Out..." : "Sign Out"}</span>
          </button>
        </div>
      </aside>

      <main className={activePage === "Dashboard" ? "main dashboardMain" : "main"} style={{ minWidth:0, paddingLeft:34, paddingRight:34, paddingBottom:36 }}>
        <header className="topbar">
          <div>
            <p className="eyebrow">HEALTHY HOMECARE</p>
            <h1>{activePage}</h1>
          </div>

          <div className="headerUser">
            <div className="statusDot"></div>

            <div>
              <small className="headerOrganization">{organizationName}</small>
              <strong>{displayName}</strong>
              <span>
                {profile.role === "admin" ? "Administrator" : "Caregiver"}
              </span>
            </div>
          </div>
        </header>

        {activePage === "Dashboard" && (
        <div className="hh-dashboard-screen" style={{ width: "100%", maxWidth: 1450, margin: "0 auto" }}>
          <section className="hh-dashboard-hero" style={{ minHeight: 118, borderRadius: 16, padding: "22px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, color: "#fff", background: "radial-gradient(circle at 92% 20%, rgba(255,255,255,.08) 0 120px, transparent 121px), radial-gradient(circle at 95% 40%, rgba(255,255,255,.045) 0 210px, transparent 211px), linear-gradient(135deg,#0c7773 0%,#14988f 100%)", boxShadow: "0 8px 24px rgba(10,75,72,.10)" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "clamp(26px,2vw,34px)", lineHeight: 1.15, fontWeight: 700, letterSpacing: "-.02em" }}>Patient monitoring dashboard</h2>
              <p style={{ margin: "10px 0 0", fontSize: 17, lineHeight: 1.45, color: "rgba(255,255,255,.92)" }}>Review recent homecare activity and quickly enter new patient observations.</p>
            </div>
            <button type="button" onClick={() => setActivePage("New Record")} style={{ flexShrink: 0, minWidth: 190, height: 54, border: 0, borderRadius: 12, background: "#fff", color: "#006b68", fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.08)" }}>+&nbsp; New Record</button>
          </section>

          <section className="hh-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginTop: 18 }}>
            {[
              { label: "Active Patients", value: activePatients, note: "Currently monitored", icon: "patients" as const, color: "#07936f", bg: "#e2f7ef" },
              { label: "Records Today", value: recordsTodayCount, note: "Clinical observations today", icon: "records" as const, color: "#1677df", bg: "#e6f2ff" },
              { label: "Active Staff", value: activeStaffCount, note: "View weekly roster", icon: "staff" as const, color: "#07936f", bg: "#e2f7ef" },
              { label: "Today's Notes", value: notesTodayCount, note: "Progress notes recorded today", icon: "notes" as const, color: "#6938ef", bg: "#f0eaff" },
            ].map((item) => {
              const isStaffCard = item.label === "Active Staff";

              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={
                    isStaffCard
                      ? () => setShowDashboardRoster(true)
                      : undefined
                  }
                  aria-label={
                    isStaffCard
                      ? "Open weekly staff roster"
                      : undefined
                  }
                  style={{
                    minHeight: 132,
                    padding: "18px 20px",
                    display: "grid",
                    gridTemplateColumns: "56px minmax(0,1fr)",
                    alignItems: "center",
                    gap: 18,
                    border: "1px solid #dce4e8",
                    borderRadius: 16,
                    background: "#fff",
                    boxShadow: "0 4px 16px rgba(20,45,60,.035)",
                    width: "100%",
                    font: "inherit",
                    textAlign: "left",
                    cursor: isStaffCard ? "pointer" : "default",
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 15,
                      display: "grid",
                      placeItems: "center",
                      background: item.bg,
                      color: item.color,
                    }}
                  >
                    <DashboardStatIcon type={item.icon} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, color: "#4f6272", fontWeight: 500 }}>
                      {item.label}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 34, lineHeight: 1, color: "#071b2a", fontWeight: 700 }}>
                      {item.value}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 14, color: "#627384" }}>
                      {item.note}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <section className="hh-dashboard-lower" style={{ display: "grid", gridTemplateColumns: "minmax(0,2.15fr) minmax(310px,1fr)", gap: 20, marginTop: 16, alignItems: "start" }}>
            <div className="hh-recent-panel" style={{ border: "1px solid #dce4e8", borderRadius: 16, background: "#fff", padding: "20px 22px", minWidth: 0, boxShadow: "0 4px 16px rgba(20,45,60,.035)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 18 }}>
                <div><h3 style={{ margin: 0, fontSize: 20, color: "#071b2a", fontWeight: 750 }}>Recent patient records</h3><p style={{ margin: "5px 0 0", color: "#657686", fontSize: 14 }}>Latest progress notes</p></div>
                <button type="button" onClick={() => setActivePage("Records")} style={{ border: 0, background: "transparent", color: "#00736d", fontSize: 16, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>View all</button>
              </div>
              <div className="hh-records-scroll" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead><tr style={{ borderBottom: "1px solid #dce4e8", color: "#657686", fontSize: 12, textTransform: "uppercase", letterSpacing: ".03em" }}>
                    <th style={{ width: "17%", padding: "12px 8px", textAlign: "left" }}>Patient</th><th style={{ width: "16%", padding: "12px 8px", textAlign: "left" }}>Date &amp; Time</th><th style={{ width: "17%", padding: "12px 8px", textAlign: "left" }}>Entered By</th><th style={{ width: "50%", padding: "12px 8px", textAlign: "left" }}>Progress Note</th>
                  </tr></thead>
                  <tbody>
                    {recentRecords.length === 0 ? <tr><td colSpan={4} style={{ padding: "34px 8px", textAlign: "center", color: "#71808e" }}>No records yet.</td></tr> :
                      recentRecords.map((record) => (
                        <tr key={record.id} style={{ borderBottom: "1px solid #e5eaed", verticalAlign: "top" }}>
                          <td style={{ padding: "18px 8px", fontSize: 14, fontWeight: 750, color: "#071b2a" }}>{record.patient}</td>
                          <td style={{ padding: "18px 8px", fontSize: 14, lineHeight: 1.45, color: "#203849" }}>{`${record.date} · ${record.time}`}</td>
                          <td style={{ padding: "18px 8px", fontSize: 14, color: "#203849" }}>{record.enteredBy}</td>
                          <td
                            style={{
                              padding: "18px 8px",
                              fontSize: 14,
                              lineHeight: 1.35,
                              color: "#203849",
                              overflowWrap: "anywhere",
                            }}
                          >
                            <div
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {record.note}
                            </div>
                            {record.note.length > 90 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDashboardNote({
                                    patient: record.patient,
                                    note: record.note,
                                  })
                                }
                                style={{
                                  marginTop: 3,
                                  padding: 0,
                                  border: 0,
                                  background: "transparent",
                                  color: "#007b76",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                View more
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="hh-quick-panel" style={{ border: "1px solid #dce4e8", borderRadius: 16, background: "#fff", padding: 20, boxShadow: "0 4px 16px rgba(20,45,60,.035)" }}>
              <h3 style={{ margin: 0, fontSize: 20, color: "#071b2a", fontWeight: 750 }}>Quick actions</h3>
              <p style={{ margin: "5px 0 16px", color: "#657686", fontSize: 14 }}>Common activities</p>
              {[
                { title: "New record", subtitle: "Add progress note or vitals", page: "New Record", icon: "plus" },
                { title: "Patients", subtitle: "View patient list", page: "Patients", icon: "patients" },
                { title: "Clinical records", subtitle: "Search patient history", page: "Records", icon: "records" },
              ].map((action) => (
                <button type="button" key={action.title} onClick={() => setActivePage(action.page)} style={{ width: "100%", minHeight: 66, marginTop: 8, border: "1px solid #d9e2e6", borderRadius: 12, background: "#fbfdfd", display: "grid", gridTemplateColumns: "42px minmax(0,1fr) 18px", alignItems: "center", gap: 12, padding: "12px 16px", textAlign: "left", cursor: "pointer", color: "#071b2a" }}>
                  <span style={{ display: "grid", placeItems: "center", color: "#00847e" }}>{action.icon === "plus" ? <span style={{ fontSize: 34, lineHeight: 1, fontWeight: 700 }}>+</span> : action.icon === "patients" ? <DashboardStatIcon type="patients" /> : <DashboardStatIcon type="records" />}</span>
                  <span><span style={{ display: "block", fontSize: 15, fontWeight: 750 }}>{action.title}</span><span style={{ display: "block", marginTop: 4, fontSize: 14, color: "#657686" }}>{action.subtitle}</span></span>
                  <span style={{ color: "#007b76", fontSize: 24 }}>›</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {showDashboardRoster && (
        <StaffRoster
          profile={profile}
          session={session}
          onClose={() => setShowDashboardRoster(false)}
        />
      )}

      {dashboardNote && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full progress note"
          onClick={() => setDashboardNote(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(4, 25, 32, 0.52)",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(620px, 94vw)",
              maxHeight: "78vh",
              overflowY: "auto",
              borderRadius: 16,
              background: "#ffffff",
              boxShadow: "0 24px 70px rgba(0,0,0,.22)",
              padding: "22px 24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 20,
                marginBottom: 16,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#071b2a",
                    fontSize: 20,
                    fontWeight: 800,
                  }}
                >
                  Progress note
                </h3>
                <div
                  style={{
                    marginTop: 4,
                    color: "#647584",
                    fontSize: 13,
                  }}
                >
                  {dashboardNote.patient}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close progress note"
                onClick={() => setDashboardNote(null)}
                style={{
                  width: 34,
                  height: 34,
                  border: "1px solid #d8e2e6",
                  borderRadius: 9,
                  background: "#ffffff",
                  color: "#405461",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                color: "#203849",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {dashboardNote.note}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                type="button"
                onClick={() => setDashboardNote(null)}
                style={{
                  minWidth: 92,
                  height: 40,
                  border: 0,
                  borderRadius: 9,
                  background: "#007b76",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {activePage === "New Record" && (
          <NewRecord
  patients={patients}
  onRecordSaved={loadRecords}
  organizationId={profile.organization_id}
/>
        )}

        {activePage === "Patients" && (
          <Patients
  patients={patients}
  setPatients={setPatients}
  records={records}
  onRecordsChanged={loadRecords}
  currentUserRole={profile.role}
  organizationId={profile.organization_id}
/>
        )}

        {activePage === "Records" && (
          <Records
            records={records}
            patients={patients}
            downloaderName={profile.full_name || session.user.email || "Unknown User"}
          />
        )}

        {activePage === "Users" && profile.role === "admin" && (
          <Users />
        )}

        {activePage === "My Account" && (
          <MyAccount
            profile={profile}
            email={session.user.email || ""}
          />
        )}
      </main>
    </div>
  );
}

function getInitials(name: string) {
  const cleanedName = name.trim();

  if (!cleanedName) {
    return "HC";
  }

  const pieces = cleanedName.split(/\s+/);

  if (pieces.length === 1) {
    return pieces[0].substring(0, 2).toUpperCase();
  }

  return `${pieces[0][0]}${pieces[pieces.length - 1][0]}`.toUpperCase();
}

function Dashboard({
  records,
  activePatients,
  setActivePage,
  profile,
  session,
  activeStaffCount,
}: {
  records: VitalRecord[];
  activePatients: number;
  setActivePage: (page: string) => void;
  profile: Profile;
  session: Session;
  activeStaffCount: number;
}) {
  const [showRoster, setShowRoster] = useState(false);

  const today = formatNumericDate(new Date());

  const recordsToday = records.filter(
    (record) => record.date === today
  );

  const notesToday = recordsToday.filter(
    (record) =>
      record.note &&
      record.note !== "—"
  );

  // Dashboard recent records intentionally show progress notes only.
  const recentRecords = records
    .filter(
      (record) =>
        record.note && record.note !== "—"
    )
    .slice(0, 5);

  function shouldShowPatientName(
    record: VitalRecord,
    index: number
  ) {
    return (
      index === 0 ||
      recentRecords[index - 1]?.patientId !==
        record.patientId
    );
  }

  return (
    <>
      <section className="welcome">
        <div>
          <h2>Patient monitoring dashboard</h2>
          <p>
            Review recent homecare activity and quickly
            enter new patient observations.
          </p>
        </div>

        <button
          className="primaryButton"
          onClick={() => setActivePage("New Record")}
        >
          + New Record
        </button>
      </section>

      <section className="statsGrid">
        <StatCard
          title="Active Patients"
          value={String(activePatients)}
          detail="Currently monitored"
        />

        <StatCard
          title="Records Today"
          value={String(recordsToday.length)}
          detail="Clinical observations today"
        />

        <StatCard
          title="Active Staff"
          value={String(activeStaffCount)}
          detail="View weekly roster"
          onClick={() => setShowRoster(true)}
        />

        <StatCard
          title="Today's Notes"
          value={String(notesToday.length)}
          detail="Progress notes recorded today"
        />
      </section>

      <section className="contentGrid">
        <div className="panel largePanel">
          <div className="panelHeader">
            <div>
              <h3>Recent patient records</h3>
              <p>Latest progress notes</p>
            </div>

            <button
              className="textButton"
              onClick={() => setActivePage("Records")}
            >
              View all
            </button>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date & Time</th>
                  <th>Entered By</th>
                  <th>Progress Note</th>
                </tr>
              </thead>

              <tbody>
                {recentRecords.length > 0 ? (
                  recentRecords.map((record, index) => (
                    <tr key={record.id}>
                      <td className="patientName">
                        {shouldShowPatientName(record, index)
                          ? record.patient
                          : ""}
                      </td>

                      <td>
                        {record.date} · {record.time}
                      </td>

                      <td>{record.enteredBy}</td>

                      <td
                        style={{
                          minWidth: 280,
                          whiteSpace: "normal",
                        }}
                      >
                        {record.note}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center" }}
                    >
                      No progress notes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panelHeader">
            <div>
              <h3>Quick actions</h3>
              <p>Common activities</p>
            </div>
          </div>

          <div className="quickActions">
            <button
              onClick={() => setActivePage("New Record")}
            >
              <span aria-hidden="true">✚</span>
              <div>
                <strong>New record</strong>
                <small>Add progress note or vitals</small>
              </div>
            </button>

            <button
              onClick={() => setActivePage("Patients")}
            >
              <span aria-hidden="true">◎</span>
              <div>
                <strong>Patients</strong>
                <small>View patient list</small>
              </div>
            </button>

            <button
              onClick={() => setActivePage("Records")}
            >
              <span aria-hidden="true">▦</span>
              <div>
                <strong>Clinical records</strong>
                <small>Search patient history</small>
              </div>
            </button>
          </div>
        </div>
      </section>

      {showRoster && (
        <StaffRoster
          profile={profile}
          session={session}
          onClose={() => setShowRoster(false)}
        />
      )}
    </>
  );
}

function StatCard({
  title,
  value,
  detail,
  onClick,
}: {
  title: string;
  value: string;
  detail: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p>{title}</p>
      <h2>{value}</h2>
      <span>{detail}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="statCard"
        onClick={onClick}
        style={{
          textAlign: "left",
          width: "100%",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        {content}
      </button>
    );
  }

  return <div className="statCard">{content}</div>;
}

function StaffRoster({
  profile,
  session,
  onClose,
}: {
  profile: Profile;
  session: Session;
  onClose: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [staff, setStaff] = useState<RosterStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    date: string;
    shift: "day" | "night";
  } | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");

  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayDistance = day === 0 ? -6 : 1 - day;

    const monday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayDistance + weekOffset * 7
    );

    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [weekOffset]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return date;
      }),
    [weekStart]
  );

  const weekEndExclusive = useMemo(() => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + 7);
    return date;
  }, [weekStart]);

  function databaseDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async function loadRoster() {
    setLoading(true);

    const weekStartValue = databaseDate(weekStart);
    const weekEndValue = databaseDate(weekEndExclusive);

    const { data: rosterData, error: rosterError } = await supabase
      .from("staff_roster")
      .select("id, shift_date, shift, user_id")
      .gte("shift_date", weekStartValue)
      .lt("shift_date", weekEndValue)
      .order("shift_date");

    if (rosterError) {
      console.error("Roster error:", rosterError);
      alert(
        "Could not load the staff roster. Make sure the staff_roster table has been created in Supabase."
      );
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .rpc("get_active_roster_staff");

    if (profileError) {
      console.error("Staff profile error:", profileError);
    }

    const activeStaff: RosterStaff[] = (profileData || []).map(
      (member: any) => ({
        id: member.id,
        fullName: member.full_name || "Unnamed Staff",
      })
    );

    // Always keep the logged-in user available, even if profile RLS
    // only exposes their own profile.
    if (!activeStaff.some((member) => member.id === session.user.id)) {
      activeStaff.push({
        id: session.user.id,
        fullName:
          profile.full_name || session.user.email || "Current User",
      });
    }

    const nameById: Record<string, string> = {};
    activeStaff.forEach((member) => {
      nameById[member.id] = member.fullName;
    });

    setStaff(activeStaff);
    setAssignments(
      (rosterData || []).map((item: any) => ({
        id: item.id,
        shiftDate: item.shift_date,
        shift: item.shift,
        userId: item.user_id,
        fullName: nameById[item.user_id] || "Staff",
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadRoster();
  }, [weekStart]);

  function assignmentFor(
    date: Date,
    shift: "day" | "night"
  ) {
    const dateValue = databaseDate(date);
    return assignments.find(
      (item) =>
        item.shiftDate === dateValue && item.shift === shift
    );
  }

  async function handleCaregiverCell(
    date: Date,
    shift: "day" | "night"
  ) {
    const existing = assignmentFor(date, shift);

    if (existing && existing.userId !== session.user.id) {
      alert("This shift has already been selected by another staff member.");
      return;
    }

    if (existing && existing.userId === session.user.id) {
      const { error } = await supabase
        .from("staff_roster")
        .delete()
        .eq("id", existing.id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadRoster();
      return;
    }

    const { error } = await supabase
      .from("staff_roster")
      .insert({
        shift_date: databaseDate(date),
        shift,
        user_id: session.user.id,
        assigned_by: session.user.id,
        organization_id: profile.organization_id,
      });

    if (error) {
      alert(error.message);
      return;
    }

    await loadRoster();
  }

  function handleCellClick(
    date: Date,
    shift: "day" | "night"
  ) {
    if (profile.role === "admin") {
      const existing = assignmentFor(date, shift);
      setEditingCell({
        date: databaseDate(date),
        shift,
      });
      setSelectedStaffId(existing?.userId || "");
      return;
    }

    handleCaregiverCell(date, shift);
  }

  async function sendRosterSms(
    userId: string,
    action: "assigned" | "removed",
    shiftDate: string,
    shift: "day" | "night"
  ) {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    const token = currentSession?.access_token;

    if (!token) {
      alert(
        "The shift was saved, but the SMS could not be sent because your login session could not be verified."
      );
      return false;
    }

    try {
      const response = await fetch("/api/roster-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          action,
          shiftDate,
          shift,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Roster SMS error:", data);
        alert(
          `The shift was saved, but the SMS could not be sent: ${
            data.error || "Unknown SMS error."
          }`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Roster SMS error:", error);
      alert(
        "The shift was saved, but the SMS could not be sent."
      );
      return false;
    }
  }

  async function saveAdminAssignment() {
    if (!editingCell) {
      return;
    }

    const existing = assignments.find(
      (item) =>
        item.shiftDate === editingCell.date &&
        item.shift === editingCell.shift
    );

    // Nothing actually changed.
    if (existing?.userId === selectedStaffId) {
      setEditingCell(null);
      return;
    }

    // Admin cleared an existing shift.
    if (!selectedStaffId) {
      if (existing) {
        const { error } = await supabase
          .from("staff_roster")
          .delete()
          .eq("id", existing.id);

        if (error) {
          alert(error.message);
          return;
        }

        await sendRosterSms(
          existing.userId,
          "removed",
          editingCell.date,
          editingCell.shift
        );
      }

      setEditingCell(null);
      await loadRoster();
      return;
    }

    // Admin changed the staff member already assigned to this shift.
    if (existing) {
      const previousStaffId = existing.userId;

      const { error } = await supabase
        .from("staff_roster")
        .update({
          user_id: selectedStaffId,
          assigned_by: session.user.id,
        })
        .eq("id", existing.id);

      if (error) {
        alert(error.message);
        return;
      }

      await sendRosterSms(
        previousStaffId,
        "removed",
        editingCell.date,
        editingCell.shift
      );

      await sendRosterSms(
        selectedStaffId,
        "assigned",
        editingCell.date,
        editingCell.shift
      );
    } else {
      // Admin assigned an empty shift.
      const { error } = await supabase
        .from("staff_roster")
        .insert({
          shift_date: editingCell.date,
          shift: editingCell.shift,
          user_id: selectedStaffId,
          assigned_by: session.user.id,
          organization_id: profile.organization_id,
        });

      if (error) {
        alert(error.message);
        return;
      }

      await sendRosterSms(
        selectedStaffId,
        "assigned",
        editingCell.date,
        editingCell.shift
      );
    }

    setEditingCell(null);
    await loadRoster();
  }

  const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="modalOverlay">
      <div
        className="modalCard"
        style={{ maxWidth: 980, width: "94%" }}
      >
        <div className="panelHeader">
          <div>
            <h3>
              Staff Roster · {formatNumericDate(weekStart)} - {" "}
              {formatNumericDate(weekEndExclusive)}
            </h3>
            <p>
              Staff can select an empty shift. Administrators can assign or clear any shift.
            </p>
          </div>

          <button
            type="button"
            className="closeButton"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setWeekOffset((value) => value - 1)}
          >
            ← Previous Week
          </button>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => setWeekOffset(0)}
          >
            Current Week
          </button>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => setWeekOffset((value) => value + 1)}
          >
            Next Week →
          </button>
        </div>

        <div className="tableWrapper">
          <table>
            <thead>
              <tr>
                <th>SHIFTS</th>
                {weekDays.map((date, index) => (
                  <th key={databaseDate(date)} style={{ textAlign: "center" }}>
                    <div>{dayLetters[index]}</div>
                    <small>{formatNumericDate(date).slice(0, 5)}</small>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(["day", "night"] as const).map((shift) => (
                <tr key={shift}>
                  <th>{shift === "day" ? "DAY" : "NIGHT"}</th>

                  {weekDays.map((date) => {
                    const assignment = assignmentFor(date, shift);
                    const initials = assignment
                      ? getInitials(assignment.fullName)
                      : "＋";

                    return (
                      <td
                        key={`${databaseDate(date)}-${shift}`}
                        style={{ textAlign: "center" }}
                      >
                        <button
                          type="button"
                          className="tableButton"
                          title={
                            assignment
                              ? assignment.fullName
                              : "Select this shift"
                          }
                          onClick={() => handleCellClick(date, shift)}
                          style={{
                            minWidth: 54,
                            minHeight: 42,
                            fontWeight: 700,
                          }}
                        >
                          {loading ? "…" : initials}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingCell && profile.role === "admin" && (
          <div
            style={{
              marginTop: 18,
              padding: 16,
              border: "1px solid #dbe3e6",
              borderRadius: 10,
            }}
          >
            <strong>Assign Staff</strong>
            <p style={{ marginTop: 4 }}>
              {formatStoredDate(editingCell.date)} · {editingCell.shift === "day" ? "Day" : "Night"} shift
            </p>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Staff member</label>
              <select
                value={selectedStaffId}
                onChange={(event) => setSelectedStaffId(event.target.value)}
              >
                <option value="">Clear / No staff</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="formActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => setEditingCell(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={saveAdminAssignment}
              >
                Save Shift
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewRecord({
  patients,
  onRecordSaved,
  organizationId,
}: {
  patients: Patient[];
  onRecordSaved: () => Promise<void>;
  organizationId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [recordType, setRecordType] = useState<"note" | "vitals">("note");

  async function handleRecordSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSaving(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const patientId = String(
      formData.get("patientId") || ""
    );

    if (!patientId) {
      alert("Please select a patient.");
      setSaving(false);
      return;
    }

    const numberOrNull = (value: FormDataEntryValue | null) => {
      const text = String(value || "").trim();
      if (text === "") {
        return null;
      }
      return Number(text);
    };

    const progressNote = String(
      formData.get("progressNote") || ""
    ).trim();

    const vitalValues = {
      systolic: numberOrNull(formData.get("systolic")),
      diastolic: numberOrNull(formData.get("diastolic")),
      heart_rate: numberOrNull(formData.get("heartRate")),
      spo2: numberOrNull(formData.get("spo2")),
      temperature: numberOrNull(formData.get("temperature")),
      glycemia: numberOrNull(formData.get("glycemia")),
      urine_output: numberOrNull(formData.get("urineOutput")),
    };

    if (recordType === "note" && !progressNote) {
      alert("Please enter a progress note.");
      setSaving(false);
      return;
    }

    if (
      recordType === "vitals" &&
      Object.values(vitalValues).every((value) => value === null)
    ) {
      alert("Please enter at least one vital sign.");
      setSaving(false);
      return;
    }

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Your login session could not be verified.");
      setSaving(false);
      return;
    }

    // Verify the organization directly from the signed-in user's profile.
    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("organization_id, active")
      .eq("id", userData.user.id)
      .single();

    if (
      profileError ||
      !currentProfile ||
      !currentProfile.active ||
      !currentProfile.organization_id
    ) {
      console.error("Could not verify organization:", profileError);
      alert("Your organization could not be verified. Please sign out and sign in again.");
      setSaving(false);
      return;
    }

    // Confirm the selected patient is in the same organization.
    const { data: selectedPatient, error: patientError } = await supabase
      .from("patients")
      .select("id, organization_id")
      .eq("id", patientId)
      .single();

    if (
      patientError ||
      !selectedPatient ||
      selectedPatient.organization_id !== currentProfile.organization_id
    ) {
      console.error("Patient organization verification failed:", patientError);
      alert("This patient does not belong to your organization.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("vital_records")
      .insert({
        patient_id: patientId,
        organization_id: currentProfile.organization_id,
        systolic:
          recordType === "vitals" ? vitalValues.systolic : null,
        diastolic:
          recordType === "vitals" ? vitalValues.diastolic : null,
        heart_rate:
          recordType === "vitals" ? vitalValues.heart_rate : null,
        spo2:
          recordType === "vitals" ? vitalValues.spo2 : null,
        temperature:
          recordType === "vitals" ? vitalValues.temperature : null,
        glycemia:
          recordType === "vitals" ? vitalValues.glycemia : null,
        urine_output:
          recordType === "vitals" ? vitalValues.urine_output : null,
        progress_note:
          recordType === "note" ? progressNote : null,
        recorded_by: userData.user.id,
      });

    if (error) {
      console.error("Error saving patient record:", error);
      alert(error.message);
      setSaving(false);
      return;
    }

    alert(
      recordType === "note"
        ? "Progress note saved successfully."
        : "Vital signs saved successfully."
    );

    await onRecordSaved();
    form.reset();
    setSaving(false);
  }

  return (
    <section className="panel formPanel">
      <div className="panelHeader">
        <div>
          <h3>New patient record</h3>
          <p>
            Choose whether you are recording a progress note or vital signs.
          </p>
        </div>
      </div>

      <form
        className="recordForm"
        onSubmit={handleRecordSubmit}
      >
        <div className="field full">
          <label>Patient *</label>
          <select
            name="patientId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Select a patient
            </option>

            {patients
              .filter((patient) => patient.active)
              .map((patient) => (
                <option
                  key={patient.id}
                  value={patient.id}
                >
                  {patient.patientCode} - {patient.firstName} {patient.lastName}
                </option>
              ))}
          </select>
        </div>

        <div className="field full">
          <label>Record Type *</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <button
              type="button"
              className={
                recordType === "note"
                  ? "primaryButton"
                  : "secondaryButton"
              }
              onClick={() => setRecordType("note")}
            >
              Progress Note
            </button>

            <button
              type="button"
              className={
                recordType === "vitals"
                  ? "primaryButton"
                  : "secondaryButton"
              }
              onClick={() => setRecordType("vitals")}
            >
              Vital Signs
            </button>
          </div>
        </div>

        {recordType === "note" ? (
          <div className="field full">
            <label>Progress Note *</label>
            <textarea
              name="progressNote"
              rows={7}
              placeholder="Enter the patient's progress note..."
            />
          </div>
        ) : (
          <>
            <div className="formSectionTitle">
              <h4>Vital signs</h4>
              <p>Only enter measurements that were taken.</p>
            </div>

            <div className="vitalGrid">
              <div className="vitalCard">
                <label>Blood Pressure</label>
                <div className="dualInput">
                  <input
                    name="systolic"
                    type="number"
                    min="1"
                    placeholder="Systolic"
                  />
                  <span>/</span>
                  <input
                    name="diastolic"
                    type="number"
                    min="1"
                    placeholder="Diastolic"
                  />
                </div>
                <small>mmHg</small>
              </div>

              <VitalInput
                name="heartRate"
                title="Heart Rate"
                placeholder="e.g. 72"
                unit="bpm"
              />
              <VitalInput
                name="spo2"
                title="SpO₂"
                placeholder="e.g. 98"
                unit="%"
                step="0.1"
              />
              <VitalInput
                name="temperature"
                title="Temperature"
                placeholder="e.g. 36.7"
                unit="°C"
                step="0.1"
              />
              <VitalInput
                name="glycemia"
                title="Glycemia"
                placeholder="e.g. 95"
                unit="mg/dL"
                step="0.1"
              />
              <VitalInput
                name="urineOutput"
                title="Urine Output (UOP)"
                placeholder="e.g. 450"
                unit="mL"
                step="0.1"
              />
            </div>
          </>
        )}

        <div className="formActions">
          <button
            type="reset"
            className="secondaryButton"
            disabled={saving}
          >
            Clear
          </button>

          <button
            type="submit"
            className="primaryButton"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Record"}
          </button>
        </div>
      </form>
    </section>
  );
}

function VitalInput({
  name,
  title,
  placeholder,
  unit,
  step = "1",
}: {
  name: string;
  title: string;
  placeholder: string;
  unit: string;
  step?: string;
}) {
  return (
    <div className="vitalCard">
      <label>{title}</label>
      <input
        name={name}
        type="number"
        placeholder={placeholder}
        step={step}
      />
      <small>{unit}</small>
    </div>
  );
}

function Patients({
  patients,
  setPatients,
  records,
  onRecordsChanged,
  currentUserRole,
  organizationId,
}: {
  patients: Patient[];
  setPatients: React.Dispatch<
    React.SetStateAction<Patient[]>
  >;
  records: VitalRecord[];
  onRecordsChanged: () => Promise<void>;
  currentUserRole: "admin" | "caregiver";
  organizationId: string;
}) {
  const [showForm, setShowForm] = useState(false);

  const [editingPatientId, setEditingPatientId] =
  useState<string | null>(null);

const [viewPatientId, setViewPatientId] =
  useState<string | null>(null);

  const [editingRecord, setEditingRecord] =
  useState<VitalRecord | null>(null);

  const [search, setSearch] = useState("");
  const [patientHistoryView, setPatientHistoryView] =
    useState<"notes" | "vitals">("notes");
  const [showPatientVitalOptions, setShowPatientVitalOptions] =
    useState(false);
  const [patientVisibleVitals, setPatientVisibleVitals] = useState({
    bp: true,
    heartRate: true,
    spo2: true,
    temperature: true,
    glycemia: true,
    urineOutput: true,
  });

  const [formData, setFormData] =
    useState<PatientFormData>(emptyPatientForm);

  const filteredPatients = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return patients.filter((patient) => {
      const combined =
        `${patient.patientCode} ${patient.firstName} ${patient.lastName} ${patient.phone}`.toLowerCase();

      return combined.includes(searchValue);
    });
  }, [patients, search]);

  const selectedPatient =
    patients.find(
      (patient) => patient.id === viewPatientId
    ) ?? null;

  function openAddPatient() {
    setEditingPatientId(null);
    setFormData(emptyPatientForm);
    setShowForm(true);
  }

  function openEditPatient(patient: Patient) {
    setEditingPatientId(patient.id);

    setFormData({
      patientCode: patient.patientCode,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
      emergencyPhone: patient.emergencyPhone,
    });

    setShowForm(true);
  }

  async function handlePatientSubmit(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (
    !formData.patientCode.trim() ||
    !formData.firstName.trim() ||
    !formData.lastName.trim()
  ) {
    alert(
      "Patient code, first name and last name are required."
    );
    return;
  }

  const patientData = {
    patient_code: formData.patientCode.trim(),
    first_name: formData.firstName.trim(),
    last_name: formData.lastName.trim(),
    date_of_birth: formData.dateOfBirth || null,
    gender: formData.gender || null,
    phone: formData.phone || null,
    address: formData.address || null,
    emergency_contact:
      formData.emergencyContact || null,
    emergency_phone:
      formData.emergencyPhone || null,
  };

  if (editingPatientId !== null) {
    const { data, error } = await supabase
      .from("patients")
      .update(patientData)
      .eq("id", editingPatientId)
      .select()
      .single();

    if (error) {
      console.error("Error updating patient:", error);
      alert(error.message);
      return;
    }

    setPatients((currentPatients) =>
      currentPatients.map((patient) =>
        patient.id === editingPatientId
          ? {
              id: data.id,
              patientCode: data.patient_code,
              firstName: data.first_name,
              lastName: data.last_name,
              dateOfBirth: data.date_of_birth || "",
              gender: data.gender || "",
              phone: data.phone || "",
              address: data.address || "",
              emergencyContact:
                data.emergency_contact || "",
              emergencyPhone:
                data.emergency_phone || "",
              active: data.active,
            }
          : patient
      )
    );

    alert("Patient updated successfully.");
  } else {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Your login session could not be verified.");
      return;
    }

    const { data, error } = await supabase
      .from("patients")
      .insert({
  ...patientData,
  active: true,
  created_by: userData.user.id,
  organization_id: organizationId,
})
      .select()
      .single();

    if (error) {
      console.error("Error adding patient:", error);
      alert(error.message);
      return;
    }

    const newPatient: Patient = {
      id: data.id,
      patientCode: data.patient_code,
      firstName: data.first_name,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth || "",
      gender: data.gender || "",
      phone: data.phone || "",
      address: data.address || "",
      emergencyContact:
        data.emergency_contact || "",
      emergencyPhone:
        data.emergency_phone || "",
      active: data.active,
    };

    setPatients((currentPatients) => [
      newPatient,
      ...currentPatients,
    ]);

    alert("Patient added successfully.");
  }

  setShowForm(false);
  setEditingPatientId(null);
  setFormData(emptyPatientForm);
}

  async function togglePatientStatus(id: string) {
  if (currentUserRole !== "admin") {
    alert("Only administrators can activate or deactivate patients.");
    return;
  }

  const patient = patients.find(
    (currentPatient) => currentPatient.id === id
  );

  if (!patient) {
    return;
  }

  const newStatus = !patient.active;

  const { error } = await supabase
    .from("patients")
    .update({
      active: newStatus,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating patient status:", error);
    alert(error.message);
    return;
  }

  setPatients((currentPatients) =>
    currentPatients.map((currentPatient) =>
      currentPatient.id === id
        ? {
            ...currentPatient,
            active: newStatus,
          }
        : currentPatient
    )
  );
}

async function handleRecordUpdate() {
  if (!editingRecord) {
    return;
  }

  const parseNumber = (value: string) => {
    if (!value || value === "—") {
      return null;
    }

    const numberValue = Number(value);

    return Number.isNaN(numberValue)
      ? null
      : numberValue;
  };

  const bpParts =
    editingRecord.bp && editingRecord.bp !== "—"
      ? editingRecord.bp.split("/")
      : ["", ""];

  const systolic = parseNumber(bpParts[0] || "");
  const diastolic = parseNumber(bpParts[1] || "");

  const { data, error } = await supabase
    .from("vital_records")
    .update({
      systolic,
      diastolic,
      heart_rate: parseNumber(editingRecord.heartRate),
      spo2: parseNumber(editingRecord.spo2),
      temperature: parseNumber(editingRecord.temperature),
      glycemia: parseNumber(editingRecord.glycemia),
      urine_output: parseNumber(editingRecord.urineOutput),
      progress_note:
        editingRecord.note &&
        editingRecord.note !== "—"
          ? editingRecord.note.trim()
          : null,
    })
    .eq("id", editingRecord.id)
    .select();

  if (error) {
    alert(
      "Supabase error:\n" +
        JSON.stringify(error, null, 2)
    );
    return;
  }

  if (!data || data.length === 0) {
    alert(
      "The record was not updated. Supabase may be blocking record edits."
    );
    return;
  }

  await onRecordsChanged();

  alert("Patient record updated successfully.");

  setEditingRecord(null);
}

  if (selectedPatient) {
    const patientRecords = records.filter(
      (record) =>
        record.patientId === selectedPatient.id
    );

    const patientNoteRecords = patientRecords.filter(
      (record) => record.note !== "—"
    );

    const patientVitalRecords = patientRecords.filter(
      (record) =>
        record.bp !== "—" ||
        record.heartRate !== "—" ||
        record.spo2 !== "—" ||
        record.temperature !== "—" ||
        record.glycemia !== "—" ||
        record.urineOutput !== "—"
    );

    const patientVitalColumns = [
      {
        key: "bp" as const,
        label: "BP",
        display: (record: VitalRecord) => record.bp,
      },
      {
        key: "heartRate" as const,
        label: "HR",
        display: (record: VitalRecord) =>
          record.heartRate !== "—"
            ? `${record.heartRate} bpm`
            : "—",
      },
      {
        key: "spo2" as const,
        label: "SpO₂",
        display: (record: VitalRecord) =>
          record.spo2 !== "—"
            ? `${record.spo2}%`
            : "—",
      },
      {
        key: "temperature" as const,
        label: "Temp",
        display: (record: VitalRecord) =>
          record.temperature !== "—"
            ? `${record.temperature} °C`
            : "—",
      },
      {
        key: "glycemia" as const,
        label: "Glycemia",
        display: (record: VitalRecord) =>
          record.glycemia !== "—"
            ? `${record.glycemia} mg/dL`
            : "—",
      },
      {
        key: "urineOutput" as const,
        label: "UOP",
        display: (record: VitalRecord) =>
          record.urineOutput !== "—"
            ? `${record.urineOutput} mL`
            : "—",
      },
    ];

    const selectedPatientVitalColumns = patientVitalColumns.filter(
      (column) => patientVisibleVitals[column.key]
    );

    return (
      <section className="panel">
        <div className="panelHeader">
          <div>
            <button
              className="textButton"
              onClick={() =>
                setViewPatientId(null)
              }
            >
              ← Back to Patients
            </button>

            <h3 style={{ marginTop: 12 }}>
              {selectedPatient.firstName}{" "}
              {selectedPatient.lastName}
            </h3>

            <p>
              {selectedPatient.patientCode} ·{" "}
              {selectedPatient.active
                ? "Active"
                : "Inactive"}
            </p>
          </div>

          <button
            className="secondaryButton"
            onClick={() =>
              openEditPatient(selectedPatient)
            }
          >
            Edit Patient
          </button>
        </div>

        <div className="patientProfileGrid">
          <ProfileItem
            label="Patient Code"
            value={selectedPatient.patientCode}
          />

          <ProfileItem
            label="Date of Birth"
            value={
              selectedPatient.dateOfBirth
                ? formatStoredDate(selectedPatient.dateOfBirth)
                : "Not entered"
            }
          />

          <ProfileItem
            label="Gender"
            value={
              selectedPatient.gender ||
              "Not entered"
            }
          />

          <ProfileItem
            label="Phone"
            value={
              selectedPatient.phone ||
              "Not entered"
            }
          />

          <ProfileItem
            label="Address"
            value={
              selectedPatient.address ||
              "Not entered"
            }
          />

          <ProfileItem
            label="Emergency Contact"
            value={
              selectedPatient.emergencyContact ||
              "Not entered"
            }
          />

          <ProfileItem
            label="Emergency Phone"
            value={
              selectedPatient.emergencyPhone ||
              "Not entered"
            }
          />

          <ProfileItem
            label="Status"
            value={
              selectedPatient.active
                ? "Active"
                : "Inactive"
            }
          />
        </div>

        <PatientTreatments
          patientId={selectedPatient.id}
          organizationId={organizationId}
        />

        <div
          className="formSectionTitle"
          style={{ marginTop: 28 }}
        >
          <h4>Patient Record History</h4>
          <p>
            Progress notes are shown by default. Open Vitals when you need vital-sign records.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            className={
              patientHistoryView === "notes"
                ? "primaryButton"
                : "secondaryButton"
            }
            onClick={() => setPatientHistoryView("notes")}
          >
            Progress Notes
          </button>

          <button
            type="button"
            className={
              patientHistoryView === "vitals"
                ? "primaryButton"
                : "secondaryButton"
            }
            onClick={() => setPatientHistoryView("vitals")}
          >
            Vitals
          </button>
        </div>

        {patientHistoryView === "vitals" && (
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() =>
                setShowPatientVitalOptions((value) => !value)
              }
            >
              Vitals to display {showPatientVitalOptions ? "▲" : "▼"}
            </button>

            {showPatientVitalOptions && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: "1px solid #dbe3e6",
                  borderRadius: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                {patientVitalColumns.map((column) => (
                  <label
                    key={column.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={patientVisibleVitals[column.key]}
                      onChange={() =>
                        setPatientVisibleVitals((current) => ({
                          ...current,
                          [column.key]: !current[column.key],
                        }))
                      }
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="tableWrapper">
          {patientHistoryView === "notes" ? (
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Entered By</th>
                  <th>Progress Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patientNoteRecords.length > 0 ? (
                  patientNoteRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date} · {record.time}</td>
                      <td>{record.enteredBy}</td>
                      <td
                        style={{
                          minWidth: 300,
                          whiteSpace: "normal",
                        }}
                      >
                        {record.note}
                      </td>
                      <td>
                        <button
                          className="tableButton"
                          onClick={() => setEditingRecord(record)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center" }}>
                      No progress notes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Entered By</th>
                  {selectedPatientVitalColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patientVitalRecords.length > 0 ? (
                  patientVitalRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date} · {record.time}</td>
                      <td>{record.enteredBy}</td>
                      {selectedPatientVitalColumns.map((column) => (
                        <td key={column.key}>
                          {column.display(record)}
                        </td>
                      ))}
                      <td>
                        <button
                          className="tableButton"
                          onClick={() => setEditingRecord(record)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3 + selectedPatientVitalColumns.length}
                      style={{ textAlign: "center" }}
                    >
                      No vital-sign records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

{editingRecord && (
  <div className="modalOverlay">
    <div className="modalCard">
      <div className="panelHeader">
        <div>
          <h3>Edit Patient Record</h3>
          <p>
            Update vital signs or the progress note.
          </p>
        </div>

        <button
          type="button"
          className="closeButton"
          onClick={() => setEditingRecord(null)}
        >
          ×
        </button>
      </div>

      <div className="patientFormGrid">
        <div className="field">
          <label>Blood Pressure</label>
          <div className="field">
  <label>Blood Pressure</label>
  <input
    value={
      editingRecord.bp === "—"
        ? ""
        : editingRecord.bp
    }
    onChange={(event) =>
      setEditingRecord({
        ...editingRecord,
        bp: event.target.value,
      })
    }
    placeholder="120/80"
  />
</div>
        </div>

        <div className="field">
          <label>Heart Rate</label>
          <input
            value={editingRecord.heartRate}
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                heartRate: event.target.value,
              })
            }
          />
        </div>

        <div className="field">
          <label>SpO₂</label>
          <input
            value={editingRecord.spo2}
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                spo2: event.target.value,
              })
            }
          />
        </div>

        <div className="field">
          <label>Temperature</label>
          <input
            value={editingRecord.temperature}
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                temperature: event.target.value,
              })
            }
          />
        </div>

        <div className="field">
          <label>Glycemia</label>
          <input
            value={editingRecord.glycemia}
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                glycemia: event.target.value,
              })
            }
          />
        </div>

        <div className="field">
          <label>UOP</label>
          <input
            value={editingRecord.urineOutput}
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                urineOutput: event.target.value,
              })
            }
          />
        </div>

        <div className="field full">
          <label>Progress Note</label>
          <textarea
            rows={5}
            value={
              editingRecord.note === "—"
                ? ""
                : editingRecord.note
            }
            onChange={(event) =>
              setEditingRecord({
                ...editingRecord,
                note: event.target.value,
              })
            }
          />
        </div>

        <div className="formActions full">
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setEditingRecord(null)}
          >
            Cancel
          </button>

          <button
  type="button"
  className="primaryButton"
  onClick={handleRecordUpdate}
>
  Save Changes
</button>
        </div>
      </div>
    </div>
  </div>
)}

        
        {showForm && (
          <PatientFormModal
            formData={formData}
            setFormData={setFormData}
            onSubmit={handlePatientSubmit}
            onClose={() => setShowForm(false)}
            isEditing={
              editingPatientId !== null
            }
          />
        )}
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h3>Patients</h3>

          <p>
            Manage patients receiving homecare
            services.
          </p>
        </div>

        <button
          className="primaryButton"
          onClick={openAddPatient}
        >
          + Add Patient
        </button>
      </div>

      <div className="filters patientFilters">
        <div className="field">
          <label>Search patient</label>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Name, patient code or phone"
          />
        </div>
      </div>

      <div className="tableWrapper">
        <table>
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Patient Name</th>
              <th>Date of Birth</th>
              <th>Gender</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.patientCode}</td>

                <td className="patientName">
                  {patient.firstName}{" "}
                  {patient.lastName}
                </td>

                <td>
                  {patient.dateOfBirth
                    ? formatStoredDate(patient.dateOfBirth)
                    : "-"}
                </td>

                <td>{patient.gender || "-"}</td>

                <td>{patient.phone || "-"}</td>

                <td>
                  <span
                    className={
                      patient.active
                        ? "activeBadge"
                        : "inactiveBadge"
                    }
                  >
                    {patient.active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </td>

                <td>
                  <div className="actionButtons">
                    <button
                      className="tableButton"
                      onClick={() =>
                        setViewPatientId(patient.id)
                      }
                    >
                      View
                    </button>

                    <button
                      className="tableButton"
                      onClick={() =>
                        openEditPatient(patient)
                      }
                    >
                      Edit
                    </button>

                    {currentUserRole === "admin" && (
                      <button
                        className="tableButton dangerText"
                        onClick={() =>
                          togglePatientStatus(
                            patient.id
                          )
                        }
                      >
                        {patient.active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filteredPatients.length === 0 && (
              <tr>
                <td colSpan={7}>
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PatientFormModal
          formData={formData}
          setFormData={setFormData}
          onSubmit={handlePatientSubmit}
          onClose={() => setShowForm(false)}
          isEditing={
            editingPatientId !== null
          }
        />
      )}
    </section>
  );
}

function PatientTreatments({
  patientId,
  organizationId,
}: {
  patientId: string;
  organizationId: string;
}) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [medication, setMedication] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadTreatments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("patient_treatments")
      .select("id, patient_id, medication, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Treatment loading error:", error);
      setTreatments([]);
      setLoading(false);
      return;
    }

    setTreatments(
      (data || []).map((item: any) => ({
        id: item.id,
        patientId: item.patient_id,
        medication: item.medication,
        createdAt: item.created_at,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadTreatments();
  }, [patientId]);

  async function addTreatment() {
    const cleanMedication = medication.trim();

    if (!cleanMedication) {
      alert("Enter a treatment or medication first.");
      return;
    }

    setSaving(true);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Your login session could not be verified.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("patient_treatments")
      .insert({
        patient_id: patientId,
        medication: cleanMedication,
        created_by: userData.user.id,
        organization_id: organizationId,
      });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setMedication("");
    await loadTreatments();
    setSaving(false);
  }

  async function removeTreatment(id: string) {
    const confirmed = window.confirm(
      "Remove this treatment from the patient's current treatment list?"
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("patient_treatments")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTreatments();
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 18,
        border: "1px solid #dbe3e6",
        borderRadius: 12,
      }}
    >
      <div className="panelHeader">
        <div>
          <h4>Patient Treatments</h4>
          <p>
            Current medication or treatment list for this patient.
          </p>
        </div>
      </div>

      {loading ? (
        <p>Loading treatments...</p>
      ) : treatments.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {treatments.map((treatment) => (
            <div
              key={treatment.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <span>• {treatment.medication}</span>
              <button
                type="button"
                className="tableButton dangerText"
                onClick={() => removeTreatment(treatment.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ marginBottom: 16 }}>
          No treatments added yet.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div className="field">
          <label>Add Treatment</label>
          <input
            type="text"
            value={medication}
            onChange={(event) => setMedication(event.target.value)}
            placeholder="e.g. Tramadol p.o 50 mg TID"
          />
        </div>

        <button
          type="button"
          className="primaryButton"
          onClick={addTreatment}
          disabled={saving}
        >
          {saving ? "Adding..." : "+ Add"}
        </button>
      </div>
    </div>
  );
}

function ProfileItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="profileItem">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PatientFormModal({
  formData,
  setFormData,
  onSubmit,
  onClose,
  isEditing,
}: {
  formData: PatientFormData;
  setFormData: React.Dispatch<
    React.SetStateAction<PatientFormData>
  >;
  onSubmit: (
    event: FormEvent<HTMLFormElement>
  ) => void;
  onClose: () => void;
  isEditing: boolean;
}) {
  function updateField(
    field: keyof PatientFormData,
    value: string
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div className="modalOverlay">
      <div className="modalCard">
        <div className="panelHeader">
          <div>
            <h3>
              {isEditing
                ? "Edit Patient"
                : "Add Patient"}
            </h3>

            <p>
              {isEditing
                ? "Update the patient's information."
                : "Enter the new patient's information."}
            </p>
          </div>

          <button
            type="button"
            className="closeButton"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form
          className="patientFormGrid"
          onSubmit={onSubmit}
        >
          <div className="field">
            <label>Patient Code *</label>

            <input
              value={formData.patientCode}
              onChange={(event) =>
                updateField(
                  "patientCode",
                  event.target.value
                )
              }
              placeholder="e.g. PT-003"
            />
          </div>

          <div className="field">
            <label>First Name *</label>

            <input
              value={formData.firstName}
              onChange={(event) =>
                updateField(
                  "firstName",
                  event.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>Last Name *</label>

            <input
              value={formData.lastName}
              onChange={(event) =>
                updateField(
                  "lastName",
                  event.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>Date of Birth</label>

            <input
              type="date"
              value={formData.dateOfBirth}
              onChange={(event) =>
                updateField(
                  "dateOfBirth",
                  event.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>Gender</label>

            <select
              value={formData.gender}
              onChange={(event) =>
                updateField(
                  "gender",
                  event.target.value
                )
              }
            >
              <option value="">Select</option>
              <option value="Female">
                Female
              </option>
              <option value="Male">
                Male
              </option>
              <option value="Other">
                Other
              </option>
              <option value="Prefer not to say">
                Prefer not to say
              </option>
            </select>
          </div>

          <div className="field">
            <label>Phone</label>

            <input
              value={formData.phone}
              onChange={(event) =>
                updateField(
                  "phone",
                  event.target.value
                )
              }
              placeholder="e.g. 078..."
            />
          </div>

          <div className="field full">
            <label>Address</label>

            <input
              value={formData.address}
              onChange={(event) =>
                updateField(
                  "address",
                  event.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>Emergency Contact</label>

            <input
              value={
                formData.emergencyContact
              }
              onChange={(event) =>
                updateField(
                  "emergencyContact",
                  event.target.value
                )
              }
            />
          </div>

          <div className="field">
            <label>Emergency Phone</label>

            <input
              value={
                formData.emergencyPhone
              }
              onChange={(event) =>
                updateField(
                  "emergencyPhone",
                  event.target.value
                )
              }
            />
          </div>

          <div className="formActions full">
            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primaryButton"
            >
              {isEditing
                ? "Save Changes"
                : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Records({
  records,
  patients,
  downloaderName,
}: {
  records: VitalRecord[];
  patients: Patient[];
  downloaderName: string;
}) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [showVitalOptions, setShowVitalOptions] = useState(false);
  const [recordView, setRecordView] = useState<"notes" | "vitals" | "all">("notes");

  const [visibleVitals, setVisibleVitals] = useState({
    bp: true,
    heartRate: true,
    spo2: true,
    temperature: true,
    glycemia: true,
    urineOutput: true,
  });

  function displayValue(value: string, unit: string) {
    if (!value || value === "—") {
      return "—";
    }
    return `${value}${unit}`;
  }

  const vitalColumns = [
    {
      key: "bp" as const,
      label: "BP",
      downloadLabel: "BP",
      value: (record: VitalRecord) => record.bp,
      display: (record: VitalRecord) => record.bp,
    },
    {
      key: "heartRate" as const,
      label: "HR",
      downloadLabel: "Heart Rate",
      value: (record: VitalRecord) => record.heartRate,
      display: (record: VitalRecord) =>
        displayValue(record.heartRate, " bpm"),
    },
    {
      key: "spo2" as const,
      label: "SpO₂",
      downloadLabel: "SpO2",
      value: (record: VitalRecord) => record.spo2,
      display: (record: VitalRecord) =>
        displayValue(record.spo2, "%"),
    },
    {
      key: "temperature" as const,
      label: "Temp",
      downloadLabel: "Temperature",
      value: (record: VitalRecord) => record.temperature,
      display: (record: VitalRecord) =>
        displayValue(record.temperature, " °C"),
    },
    {
      key: "glycemia" as const,
      label: "Glycemia",
      downloadLabel: "Glycemia",
      value: (record: VitalRecord) => record.glycemia,
      display: (record: VitalRecord) =>
        displayValue(record.glycemia, " mg/dL"),
    },
    {
      key: "urineOutput" as const,
      label: "UOP",
      downloadLabel: "Urine Output",
      value: (record: VitalRecord) => record.urineOutput,
      display: (record: VitalRecord) =>
        displayValue(record.urineOutput, " mL"),
    },
  ];

  const selectedVitalColumns = vitalColumns.filter(
    (column) => visibleVitals[column.key]
  );

  function hasVitals(record: VitalRecord) {
    return (
      record.bp !== "—" ||
      record.heartRate !== "—" ||
      record.spo2 !== "—" ||
      record.temperature !== "—" ||
      record.glycemia !== "—" ||
      record.urineOutput !== "—"
    );
  }

  const filteredRecords = records.filter((record) => {
    const searchValue = search.toLowerCase().trim();

    const matchesSearch =
      !searchValue ||
      record.patient.toLowerCase().includes(searchValue);

    const matchesFrom =
      !fromDate || record.filterDate >= fromDate;

    const matchesTo =
      !toDate || record.filterDate <= toDate;

    const matchesType =
      recordView === "notes"
        ? record.note !== "—"
        : recordView === "vitals"
        ? hasVitals(record)
        : true;

    return matchesSearch && matchesFrom && matchesTo && matchesType;
  });

  const uniquePatientIds = Array.from(
    new Set(filteredRecords.map((record) => record.patientId))
  );

  const singlePatient =
    uniquePatientIds.length === 1
      ? patients.find(
          (patient) => patient.id === uniquePatientIds[0]
        ) || null
      : null;

  function shouldShowPatientName(
    record: VitalRecord,
    index: number
  ) {
    return (
      index === 0 ||
      filteredRecords[index - 1]?.patientId !== record.patientId
    );
  }

  function toggleVital(
    key: keyof typeof visibleVitals
  ) {
    setVisibleVitals((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function escapeCsv(value: string) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function escapeHtml(value: string) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function startDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowDownloadOptions(false);
  }

  function downloadRecords(
    mode: "vitals" | "notes" | "both"
  ) {
    if (filteredRecords.length === 0) {
      alert("There are no records to download.");
      return;
    }

    if (mode === "vitals") {
      const headers = [
        "Patient",
        "Date & Time",
        "Entered By",
        ...selectedVitalColumns.map(
          (column) => column.downloadLabel
        ),
      ];

      const rows = filteredRecords
        .filter(hasVitals)
        .map((record, index) => [
          index === 0 ||
          filteredRecords[index - 1]?.patientId !== record.patientId
            ? record.patient
            : "",
          `${record.date} ${record.time}`,
          record.enteredBy,
          ...selectedVitalColumns.map(
            (column) => column.value(record)
          ),
        ]);

      const csvContent = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) =>
          row.map(escapeCsv).join(",")
        ),
      ].join("\n");

      const blob = new Blob(
        ["\uFEFF" + csvContent],
        { type: "text/csv;charset=utf-8;" }
      );

      startDownload(blob, "homecare-vitals.csv");
      return;
    }

    const includeVitals = mode === "both";
    const sourceRows = filteredRecords.filter((record) =>
      mode === "notes" ? record.note !== "—" : true
    );

    const wordHeaders = [
      "Patient",
      "Date & Time",
      "Entered By",
      "Progress Note",
      ...(includeVitals
        ? selectedVitalColumns.map(
            (column) => column.downloadLabel
          )
        : []),
    ];

    const wordRows = sourceRows.map((record, index) => [
      index === 0 ||
      sourceRows[index - 1]?.patientId !== record.patientId
        ? record.patient
        : "",
      `${record.date} ${record.time}`,
      record.enteredBy,
      record.note,
      ...(includeVitals
        ? selectedVitalColumns.map(
            (column) => column.value(record)
          )
        : []),
    ]);

    const headerHtml = wordHeaders
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join("");

    const rowsHtml = wordRows
      .map(
        (row) =>
          `<tr>${row
            .map(
              (value, index) =>
                `<td${
                  index === 3
                    ? ' class="progress-note"'
                    : ""
                }>${escapeHtml(value)}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    const patientDetailsHtml = singlePatient
      ? `
        <div class="patient-details">
          <h2>Patient Details</h2>
          <div class="patient-detail-line"><strong>Name:</strong> ${escapeHtml(
            `${singlePatient.firstName} ${singlePatient.lastName}`
          )}</div>
          <div class="patient-detail-line"><strong>Patient Code:</strong> ${escapeHtml(
            singlePatient.patientCode
          )}</div>
          <div class="patient-detail-line"><strong>Date of Birth:</strong> ${escapeHtml(
            singlePatient.dateOfBirth
              ? formatStoredDate(singlePatient.dateOfBirth)
              : "Not entered"
          )}</div>
          <div class="patient-detail-line"><strong>Gender:</strong> ${escapeHtml(
            singlePatient.gender || "Not entered"
          )}</div>
          <div class="patient-detail-line"><strong>Phone:</strong> ${escapeHtml(
            singlePatient.phone || "Not entered"
          )}</div>
          <div class="patient-detail-line"><strong>Address:</strong> ${escapeHtml(
            singlePatient.address || "Not entered"
          )}</div>
        </div>
      `
      : `
        <div class="patient-details">
          <h2>Patient Details</h2>
          <p>Multiple patients are included in this report.</p>
        </div>
      `;

    const downloaderHtml = `
      <div class="signature-section">
        <h2>Caregiver Electronic Record Details</h2>
        <div class="downloaded-by">
          <strong>Downloaded By:</strong> ${escapeHtml(downloaderName)}
        </div>
      </div>
    `;

    const documentTitle =
      mode === "notes"
        ? "Progress Notes"
        : "Vitals and Progress Notes";

    const wordDocument = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(documentTitle)}</title>
          <style>
            @page { size: landscape; margin: 0.5in; }
            body {
              font-family: Arial, sans-serif;
              font-size: 9pt;
              color: #111827;
              margin: 0;
            }
            .company {
              text-align: center;
              margin-bottom: 16px;
            }
            .company h1 {
              margin: 0;
              font-size: 20pt;
            }
            .company p {
              margin: 4px 0 0;
              color: #4b5563;
            }
            h2 {
              font-size: 12pt;
              margin: 16px 0 8px;
            }
            .subtitle {
              margin-top: 4px;
              font-size: 11pt;
              font-weight: 700;
            }
            .patient-details { margin-bottom: 18px; }
            .patient-detail-line {
              margin: 4px 0;
              line-height: 1.45;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px;
              vertical-align: top;
              text-align: left;
              overflow-wrap: anywhere;
            }
            th {
              background: #eef6f5;
              font-weight: 700;
            }
            .records-table th:nth-child(1),
            .records-table td:nth-child(1) { width: 15%; }
            .records-table th:nth-child(2),
            .records-table td:nth-child(2) { width: 13%; }
            .records-table th:nth-child(3),
            .records-table td:nth-child(3) { width: 10%; }
            .records-table th:nth-child(4),
            .records-table td:nth-child(4) { width: 30%; }
            .progress-note {
              white-space: pre-wrap;
              line-height: 1.35;
            }
            .signature-section {
              margin-top: 20px;
              page-break-inside: avoid;
            }
            .downloaded-by {
              margin-top: 6px;
              line-height: 1.45;
            }
          </style>
        </head>
        <body>
          <div class="company">
            <h1>Healthy HomeCare</h1>
            <p>Patient Monitoring &amp; Care Management</p>
            <div class="subtitle">
              ${escapeHtml(documentTitle)}
            </div>
          </div>

          ${patientDetailsHtml}

          <table class="records-table">
            <thead>
              <tr>${headerHtml}</tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          ${downloaderHtml}
        </body>
      </html>
    `;

    const blob = new Blob(
      ["\uFEFF", wordDocument],
      { type: "application/msword;charset=utf-8;" }
    );

    startDownload(
      blob,
      mode === "notes"
        ? "homecare-progress-notes.doc"
        : "homecare-vitals-and-notes.doc"
    );
  }

  const showNotesColumn = recordView !== "vitals";
  const showVitalsColumns = recordView !== "notes";

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h3>Patient records</h3>
          <p>
            Progress notes are shown by default. Choose Vitals when you need vital-sign records.
          </p>
        </div>

        <button
          className="secondaryButton"
          onClick={() => setShowDownloadOptions(true)}
        >
          Download Records
        </button>
      </div>

      <div className="filters">
        <div className="field">
          <label>Search patient</label>
          <input
            type="text"
            placeholder="Patient name or ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="field">
          <label>Record Type</label>
          <select
            value={recordView}
            onChange={(event) =>
              setRecordView(
                event.target.value as "notes" | "vitals" | "all"
              )
            }
          >
            <option value="notes">Progress Notes</option>
            <option value="vitals">Vitals</option>
            <option value="all">All Records</option>
          </select>
        </div>

        <div className="field">
          <label>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>

        <div className="field">
          <label>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>

        <div className="field">
          <label>Clear Filters</label>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setSearch("");
              setFromDate("");
              setToDate("");
              setRecordView("notes");
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {recordView !== "notes" && (
        <div
          style={{
            marginTop: 18,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setShowVitalOptions((value) => !value)}
          >
            Vitals to display {showVitalOptions ? "▲" : "▼"}
          </button>

          {showVitalOptions && (
            <div
              style={{
                marginTop: 10,
                padding: 14,
                border: "1px solid #dbe3e6",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                {vitalColumns.map((column) => (
                  <label
                    key={column.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibleVitals[column.key]}
                      onChange={() => toggleVital(column.key)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="tableWrapper">
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date & Time</th>
              <th>Entered By</th>
              {showNotesColumn && <th>Progress Note</th>}
              {showVitalsColumns &&
                selectedVitalColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
            </tr>
          </thead>

          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record, index) => (
                <tr key={record.id}>
                  <td className="patientName">
                    {shouldShowPatientName(record, index)
                      ? record.patient
                      : ""}
                  </td>
                  <td>{record.date} · {record.time}</td>
                  <td>{record.enteredBy}</td>
                  {showNotesColumn && (
                    <td
                      style={{
                        minWidth: 260,
                        whiteSpace: "normal",
                      }}
                    >
                      {record.note}
                    </td>
                  )}
                  {showVitalsColumns &&
                    selectedVitalColumns.map((column) => (
                      <td key={column.key}>
                        {column.display(record)}
                      </td>
                    ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={
                    3 +
                    (showNotesColumn ? 1 : 0) +
                    (showVitalsColumns
                      ? selectedVitalColumns.length
                      : 0)
                  }
                  style={{ textAlign: "center" }}
                >
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDownloadOptions && (
        <div className="modalOverlay">
          <div className="modalCard">
            <div className="panelHeader">
              <div>
                <h3>Download Records</h3>
                <p>
                  Downloads use the current patient/date filters and your selected vital signs.
                </p>
              </div>
              <button
                type="button"
                className="closeButton"
                onClick={() => setShowDownloadOptions(false)}
              >
                ×
              </button>
            </div>

            <div className="formActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => downloadRecords("vitals")}
              >
                Vitals Only (CSV)
              </button>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => downloadRecords("notes")}
              >
                Progress Notes (Word)
              </button>
              <button
                type="button"
                className="primaryButton"
                onClick={() => downloadRecords("both")}
              >
                Vitals + Notes (Word)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  active: boolean;
};

function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreateUser, setShowCreateUser] =
    useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");
const [password, setPassword] = useState("");
const [role, setRole] = useState("caregiver");
  const [creatingUser, setCreatingUser] =
    useState(false);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    async function toggleUserStatus(
  user: AppUser
) {
  const token = await getAccessToken();

  if (!token) {
    alert(
      "Your login session could not be verified."
    );
    return;
  }

  const response = await fetch(
    "/api/admin/users",
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        userId: user.id,
        active: !user.active,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(
      data.error ||
        "Could not change user status."
    );
    return;
  }

  await loadUsers();
}

    return session?.access_token || "";
  }

  async function loadUsers() {
    setLoadingUsers(true);

    const token = await getAccessToken();

    if (!token) {
      alert("Your login session could not be verified.");
      setLoadingUsers(false);
      return;
    }

    const response = await fetch(
      "/api/admin/users",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not load users.");
      setLoadingUsers(false);
      return;
    }

    setUsers(data.users || []);
    setLoadingUsers(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreateUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanPhoneNumber = phoneNumber.trim();

    if (!/^\+2507\d{8}$/.test(cleanPhoneNumber)) {
      alert("Enter the phone number in Rwanda international format, for example +250788123456.");
      return;
    }

    setCreatingUser(true);

    const token = await getAccessToken();

    if (!token) {
      alert("Your login session could not be verified.");
      setCreatingUser(false);
      return;
    }

    const response = await fetch(
      "/api/admin/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          phoneNumber: cleanPhoneNumber,
          password,
          role,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not create user.");
      setCreatingUser(false);
      return;
    }

    alert("User created successfully.");

    setFullName("");
    setEmail("");
    setPhoneNumber("");
    setPassword("");
    setRole("caregiver");
    setShowCreateUser(false);

    await loadUsers();

    setCreatingUser(false);
  }

async function toggleUserStatus(
  user: AppUser
) {
  const token = await getAccessToken();

  if (!token) {
    alert(
      "Your login session could not be verified."
    );
    return;
  }

  const response = await fetch(
    "/api/admin/users",
    {
      method: "PATCH",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        userId: user.id,
        active: !user.active,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(
      data.error ||
        "Could not change user status."
    );
    return;
  }

  await loadUsers();
}

async function editUserPhone(user: AppUser) {
  const value = window.prompt(
    `Enter the phone number for ${user.fullName || user.email}:`,
    user.phoneNumber || "+2507"
  );

  if (value === null) {
    return;
  }

  const cleanPhoneNumber = value.trim();

  if (!/^\+2507\d{8}$/.test(cleanPhoneNumber)) {
    alert(
      "Enter the phone number in Rwanda international format, for example +250788123456."
    );
    return;
  }

  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  const token = currentSession?.access_token;

  if (!token) {
    alert("Your login session could not be verified.");
    return;
  }

  try {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        phoneNumber: cleanPhoneNumber,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Could not update phone number.");
      return;
    }

    await loadUsers();

    alert("Phone number updated successfully.");
  } catch (error) {
    console.error("Phone update error:", error);
    alert("Could not update phone number.");
  }
}

async function resetUserPassword(
  user: AppUser
) {
  const newPassword = window.prompt(
    `Enter a new temporary password for ${user.fullName || user.email}`
  );

  if (!newPassword) {
    return;
  }

  if (newPassword.length < 8) {
    alert(
      "Temporary password must contain at least 8 characters."
    );
    return;
  }

  const token = await getAccessToken();

  if (!token) {
    alert(
      "Your login session could not be verified."
    );
    return;
  }

  const response = await fetch(
    "/api/admin/users",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.id,
        newPassword,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(
      data.error ||
        "Could not reset password."
    );
    return;
  }

  alert(
    "Temporary password updated successfully."
  );
}

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h3>User management</h3>

          <p>
            Administrator access to homecare staff
            accounts.
          </p>
        </div>

        <button
          className="primaryButton"
          onClick={() =>
            setShowCreateUser(true)
          }
        >
          + Create User
        </button>
      </div>

      {showCreateUser && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
          }}
        >
          <h4>Create Staff User</h4>

          <form
            className="recordForm"
            onSubmit={handleCreateUser}
          >
            <div className="field">
              <label>Full Name</label>

              <input
                type="text"
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                required
              />
            </div>

            <div className="field">
              <label>Email</label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
              />
            </div>

            <div className="field">
              <label>Phone Number</label>

              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) =>
                  setPhoneNumber(event.target.value)
                }
                placeholder="+250788123456"
                pattern="\+2507[0-9]{8}"
                required
              />
            </div>

            <div className="field">
              <label>Temporary Password</label>

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                minLength={8}
                required
              />
            </div>

            <div className="field">
              <label>Role</label>

              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value)
                }
              >
                <option value="caregiver">
                  Caregiver
                </option>

                <option value="admin">
                  Admin
                </option>
              </select>
            </div>

            <div className="formActions">
              <button
                type="button"
                className="secondaryButton"
                onClick={() =>
                  setShowCreateUser(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primaryButton"
                disabled={creatingUser}
              >
                {creatingUser
                  ? "Creating..."
                  : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="tableWrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loadingUsers ? (
              <tr>
                <td colSpan={6}>
                  Loading users...
                </td>
              </tr>
            
            ) : users.length > 0 ? (
  users.map((user) => (
    <tr key={user.id}>
      <td>
        {user.fullName ||
          "Not entered"}
      </td>

      <td>{user.email}</td>

      <td>{user.phoneNumber || "Not entered"}</td>

      <td>
        {user.role === "admin"
          ? "Admin"
          : "Caregiver"}
      </td>

      <td>
        {user.active
          ? "Active"
          : "Inactive"}
      </td>

      <td>
  <div
  style={{
    display: "flex",
    gap: "10px",
    alignItems: "center",
  }}
>
  <button
    className="tableButton"
    onClick={() => toggleUserStatus(user)}
  >
    {user.active ? "Deactivate" : "Activate"}
  </button>

  <button
    className="tableButton"
    onClick={() => editUserPhone(user)}
  >
    Edit Phone
  </button>

  <button
    className="tableButton"
    onClick={() => resetUserPassword(user)}
  >
    Reset Password
  </button>
</div>
</td>
    </tr>
  ))
) : (
  <tr>
    <td colSpan={6}>
      No users found.
    </td>
  </tr>
)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MyAccount({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [changingPassword, setChangingPassword] =
    useState(false);

  async function handlePasswordChange(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");

    if (newPassword.length < 8) {
      setMessage(
        "Your new password must contain at least 8 characters."
      );

      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(
        "The new passwords do not match."
      );

      return;
    }

    setChangingPassword(true);

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (error) {
      setMessage(error.message);
      setChangingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");

    setMessage(
      "Your password was changed successfully."
    );

    setChangingPassword(false);
  }

  return (
    <section className="panel accountPanel">
      <div className="panelHeader">
        <div>
          <h3>My Account</h3>

          <p>
            Manage your account information and
            password.
          </p>
        </div>
      </div>

      <div className="accountInfo">
        <div>
          <span>Name</span>

          <strong>
            {profile.full_name ||
              "HomeCare User"}
          </strong>
        </div>

        <div>
          <span>Email</span>
          <strong>{email}</strong>
        </div>

        <div>
          <span>Phone</span>
          <strong>{profile.phone_number || "Not entered"}</strong>
        </div>

        <div>
          <span>Role</span>

          <strong>
            {profile.role === "admin"
              ? "Administrator"
              : "Caregiver"}
          </strong>
        </div>
      </div>

      <h3>Change Password</h3>

      {message && (
        <div className="accountMessage">
          {message}
        </div>
      )}

      <form
        className="passwordForm"
        onSubmit={handlePasswordChange}
      >
        <div className="field">
          <label>New Password</label>

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value
              )
            }
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label>
            Confirm New Password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            autoComplete="new-password"
          />
        </div>

        <button
          className="primaryButton"
          disabled={changingPassword}
        >
          {changingPassword
            ? "Changing Password..."
            : "Change Password"}
        </button>
      </form>
    </section>
  );
}