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
          <h2>HomeCare</h2>
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
              <h1>HomeCare</h1>
              <p>Patient Monitor</p>
            </div>
          </div>

          <div className="loginError">
            Your account is signed in, but your HomeCare profile could not be
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
            <h1>HomeCare</h1>
            <p>Patient Monitor</p>
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
            <h1>HomeCare</h1>
            <p>Patient Monitor</p>
          </div>
        </div>

        <div className="loginWelcome">
          <h2>Create a new password</h2>

          <p>
            Enter a new password for your HomeCare account.
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

function HomeCareApp({
  session,
  profile,
}: {
  session: Session;
  profile: Profile;
}) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [signingOut, setSigningOut] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
const [patientsLoading, setPatientsLoading] = useState(true);
  const [records, setRecords] = useState<VitalRecord[]>([]);
const [recordsLoading, setRecordsLoading] = useState(true);

  const activePatients = patients.filter((patient) => patient.active).length;

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
      <aside className="sidebar">
        <div>
          <div className="logo">
            <div className="logoIcon">+</div>

            <div>
              <h2>HomeCare</h2>
              <span>Patient Monitor</span>
            </div>
          </div>

          <nav>
            {menuItems.map((item) => (
              <button
                key={item}
                className={
                  activePage === item ? "navButton active" : "navButton"
                }
                onClick={() => setActivePage(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebarBottom">
          <div className="userMini">
            <div className="avatar">{initials}</div>

            <div>
              <strong>{displayName}</strong>
              <span>
                {profile.role === "admin" ? "Administrator" : "Caregiver"}
              </span>
            </div>
          </div>

          <button
            className="logoutButton"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">HOMECARE MANAGEMENT</p>
            <h1>{activePage}</h1>
          </div>

          <div className="headerUser">
            <div className="statusDot"></div>

            <div>
              <strong>{displayName}</strong>
              <span>
                {profile.role === "admin" ? "Administrator" : "Caregiver"}
              </span>
            </div>
          </div>
        </header>

        {activePage === "Dashboard" && (
          <Dashboard
            records={records}
            activePatients={activePatients}
            setActivePage={setActivePage}
            profile={profile}
            session={session}
          />
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
}: {
  records: VitalRecord[];
  activePatients: number;
  setActivePage: (page: string) => void;
  profile: Profile;
  session: Session;
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
          title="Staff"
          value="👥"
          detail="Open weekly roster"
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
              <span>＋</span>
              <div>
                <strong>New record</strong>
                <small>Add progress note or vitals</small>
              </div>
            </button>

            <button
              onClick={() => setActivePage("Patients")}
            >
              <span>♙</span>
              <div>
                <strong>Patients</strong>
                <small>View patient list</small>
              </div>
            </button>

            <button
              onClick={() => setActivePage("Records")}
            >
              <span>▤</span>
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
            <h1>HomeCare</h1>
            <p>Patient Monitor</p>
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