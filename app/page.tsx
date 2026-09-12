"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type VitalRecord = {
  id: string;
  patientId: string;
  patient: string;
  date: string;
  time: string;
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
  role: "admin" | "caregiver";
  active: boolean;
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

export default function Home() {
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
        .select("id, full_name, role, active")
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
        </form>

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
      patients (
        patient_code,
        first_name,
        last_name
      )
    `)
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Error loading records:", error);
    alert("Could not load patient records.");
    setRecordsLoading(false);
    return;
  }

  const formattedRecords: VitalRecord[] = (data || []).map(
    (record: any) => {
      const recordedDate = new Date(record.recorded_at);

      const patientData = Array.isArray(record.patients)
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

        date: recordedDate.toLocaleDateString(
          undefined,
          {
            year: "numeric",
            month: "short",
            day: "numeric",
          }
        ),

        time: recordedDate.toLocaleTimeString(
          undefined,
          {
            hour: "numeric",
            minute: "2-digit",
          }
        ),

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
    }
  );

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
          />
        )}

        {activePage === "New Record" && (
          <NewRecord
  patients={patients}
  onRecordSaved={loadRecords}
/>
        )}

        {activePage === "Patients" && (
          <Patients
  patients={patients}
  setPatients={setPatients}
  records={records}
  onRecordsChanged={loadRecords}
/>
        )}

        {activePage === "Records" && (
          <Records records={records} />
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
}: {
  records: VitalRecord[];
  activePatients: number;
  setActivePage: (page: string) => void;
}) {
  const today = new Date().toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );

  const recordsToday = records.filter(
    (record) => record.date === today
  );

  const notesToday = recordsToday.filter(
    (record) =>
      record.note &&
      record.note !== "—"
  );

  const recentRecords = records.slice(0, 5);

  function displayValue(
    value: string,
    unit: string
  ) {
    if (!value || value === "—") {
      return "—";
    }

    

    return `${value} ${unit}`;
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
          onClick={() =>
            setActivePage("New Record")
          }
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
          title="Total Records"
          value={String(records.length)}
          detail="All saved clinical records"
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

              <p>
                Latest recorded observations
              </p>
            </div>

            <button
              className="textButton"
              onClick={() =>
                setActivePage("Records")
              }
            >
              View all
            </button>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>BP</th>
                  <th>HR</th>
                  <th>SpO₂</th>
                  <th>Temp</th>
                </tr>
              </thead>

              <tbody>
                {recentRecords.length > 0 ? (
                  recentRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="patientName">
                        {record.patient}
                      </td>

                      <td>{record.date}</td>

                      <td>{record.time}</td>

                      <td>{record.bp}</td>

                      <td>
                        {displayValue(
                          record.heartRate,
                          "bpm"
                        )}
                      </td>

                      <td>
                        {displayValue(
                          record.spo2,
                          "%"
                        )}
                      </td>

                      <td>
                        {displayValue(
                          record.temperature,
                          "°C"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                      }}
                    >
                      No patient records yet.
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
              onClick={() =>
                setActivePage("New Record")
              }
            >
              <span>＋</span>

              <div>
                <strong>Record vitals</strong>

                <small>
                  Add patient observations
                </small>
              </div>
            </button>

            <button
              onClick={() =>
                setActivePage("Patients")
              }
            >
              <span>♙</span>

              <div>
                <strong>Patients</strong>

                <small>
                  View patient list
                </small>
              </div>
            </button>

            <button
              onClick={() =>
                setActivePage("Records")
              }
            >
              <span>▤</span>

              <div>
                <strong>
                  Clinical records
                </strong>

                <small>
                  Search patient history
                </small>
              </div>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="statCard">
      <p>{title}</p>
      <h2>{value}</h2>
      <span>{detail}</span>
    </div>
  );
}

function NewRecord({
  patients,
  onRecordSaved,
}: {
  patients: Patient[];
  onRecordSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

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
      .from("vital_records")
      .insert({
        patient_id: patientId,

        systolic: numberOrNull(
          formData.get("systolic")
        ),

        diastolic: numberOrNull(
          formData.get("diastolic")
        ),

        heart_rate: numberOrNull(
          formData.get("heartRate")
        ),

        spo2: numberOrNull(
          formData.get("spo2")
        ),

        temperature: numberOrNull(
          formData.get("temperature")
        ),

        glycemia: numberOrNull(
          formData.get("glycemia")
        ),

        urine_output: numberOrNull(
          formData.get("urineOutput")
        ),

        progress_note:
          String(
            formData.get("progressNote") || ""
          ).trim() || null,

        recorded_by: userData.user.id,
      });

    if (error) {
      console.error(
        "Error saving vital record:",
        error
      );

      alert(error.message);
      setSaving(false);
      return;
    }

    alert("Patient record saved successfully.");
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
            Enter the observations collected during the
            homecare visit.
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
                  {patient.patientCode} -{" "}
                  {patient.firstName}{" "}
                  {patient.lastName}
                </option>
              ))}
          </select>
        </div>

        <div className="formSectionTitle">
          <h4>Vital signs</h4>

          <p>
            Only enter measurements that were taken.
          </p>
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

        <div className="field full">
          <label>Progress Note</label>

          <textarea
            name="progressNote"
            rows={6}
            placeholder="Enter a short patient progress note..."
          />
        </div>

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
            {saving
              ? "Saving..."
              : "Save Record"}
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
}: {
  patients: Patient[];
  setPatients: React.Dispatch<
    React.SetStateAction<Patient[]>
  >;
  records: VitalRecord[];
  onRecordsChanged: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);

  const [editingPatientId, setEditingPatientId] =
  useState<string | null>(null);

const [viewPatientId, setViewPatientId] =
  useState<string | null>(null);

  const [editingRecord, setEditingRecord] =
  useState<VitalRecord | null>(null);

  const [search, setSearch] = useState("");

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
              selectedPatient.dateOfBirth ||
              "Not entered"
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

        <div
  className="formSectionTitle"
  style={{ marginTop: 28 }}
>
  <h4>Patient Record History</h4>

  <p>
    Recent vital-sign observations and progress
    notes for this patient.
  </p>
</div>

<div
  className="tableWrapper"
  style={{ marginTop: 14 }}
>
  <table>
    <thead>
      <tr>
        <th>Date & Time</th>
        <th>Progress Note</th>
        <th>BP</th>
        <th>HR</th>
        <th>SpO₂</th>
        <th>Temp</th>
        <th>Glycemia</th>
        <th>UOP</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      {patientRecords.length > 0 ? (
        patientRecords.map((record) => (
          <tr key={record.id}>
            <td>
              {record.date} · {record.time}
            </td>

            <td>{record.note}</td>

            <td>{record.bp}</td>

            <td>
              {record.heartRate !== "—"
                ? `${record.heartRate} bpm`
                : "—"}
            </td>

            <td>
              {record.spo2 !== "—"
                ? `${record.spo2}%`
                : "—"}
            </td>

            <td>
              {record.temperature !== "—"
                ? `${record.temperature} °C`
                : "—"}
            </td>

            <td>
        {record.glycemia !== "—"
  ? `${record.glycemia} mg/dL`
  : "—"}
</td>

<td>
  {record.urineOutput !== "—"
    ? `${record.urineOutput} mL`
    : "—"}
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
          <td
            colSpan={9}
            style={{ textAlign: "center" }}
          >
            No patient records yet.
          </td>
          <td>
  
</td>
        </tr>
      )}
    </tbody>
  </table>
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
                  {patient.dateOfBirth || "-"}
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
}: {
  records: VitalRecord[];
}) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showDownloadOptions, setShowDownloadOptions] =
  useState(false);

  function formatRecordDateForFilter(
    dateString: string
  ) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const filteredRecords = records.filter(
    (record) => {
      const matchesSearch =
        record.patient
          .toLowerCase()
          .includes(search.toLowerCase());

      const recordDate =
        formatRecordDateForFilter(record.date);

      const matchesFrom =
        !fromDate || recordDate >= fromDate;

      const matchesTo =
        !toDate || recordDate <= toDate;

function downloadRecords(
  mode: "vitals" | "notes" | "both"
) {
  if (filteredRecords.length === 0) {
    alert("There are no records to download.");
    return;
  }

  let headers: string[] = [];
  let rows: string[][] = [];

  if (mode === "vitals") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "BP",
      "Heart Rate",
      "SpO2",
      "Temperature",
      "Glycemia",
      "Urine Output",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.bp,
      record.heartRate,
      record.spo2,
      record.temperature,
      record.glycemia,
      record.urineOutput,
    ]);
  }

  if (mode === "notes") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "Progress Note",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.note,
    ]);
  }

  if (mode === "both") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "BP",
      "Heart Rate",
      "SpO2",
      "Temperature",
      "Glycemia",
      "Urine Output",
      "Progress Note",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.bp,
      record.heartRate,
      record.spo2,
      record.temperature,
      record.glycemia,
      record.urineOutput,
      record.note,
    ]);
  }

  const escapeCsv = (value: string) =>
    `"${String(value ?? "")
      .replace(/"/g, '""')}"`;

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    mode === "vitals"
      ? "homecare-vitals.csv"
      : mode === "notes"
      ? "homecare-progress-notes.csv"
      : "homecare-vitals-and-notes.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  setShowDownloadOptions(false);
}

      return (
        matchesSearch &&
        matchesFrom &&
        matchesTo
      );
    }
  );

  function downloadRecords(
  mode: "vitals" | "notes" | "both"
) {
  if (filteredRecords.length === 0) {
    alert("There are no records to download.");
    return;
  }

  let headers: string[] = [];
  let rows: string[][] = [];

  if (mode === "vitals") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "BP",
      "Heart Rate",
      "SpO2",
      "Temperature",
      "Glycemia",
      "Urine Output",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.bp,
      record.heartRate,
      record.spo2,
      record.temperature,
      record.glycemia,
      record.urineOutput,
    ]);
  }

  if (mode === "notes") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "Progress Note",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.note,
    ]);
  }

  if (mode === "both") {
    headers = [
      "Date",
      "Time",
      "Patient",
      "BP",
      "Heart Rate",
      "SpO2",
      "Temperature",
      "Glycemia",
      "Urine Output",
      "Progress Note",
    ];

    rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.patient,
      record.bp,
      record.heartRate,
      record.spo2,
      record.temperature,
      record.glycemia,
      record.urineOutput,
      record.note,
    ]);
  }

  const escapeCsv = (value: string) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    mode === "vitals"
      ? "homecare-vitals.csv"
      : mode === "notes"
      ? "homecare-progress-notes.csv"
      : "homecare-vitals-and-notes.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  setShowDownloadOptions(false);
}

  function displayValue(
    value: string,
    unit: string
  ) {
    if (!value || value === "—") {
      return "—";
    }

    return `${value}${unit}`;
  }
  
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <h3>Patient records</h3>

          <p>
            Search and filter patient observations.
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
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="field">
          <label>From</label>

          <input
            type="date"
            value={fromDate}
            onChange={(event) =>
              setFromDate(event.target.value)
            }
          />
        </div>

        <div className="field">
          <label>To</label>

          <input
            type="date"
            value={toDate}
            onChange={(event) =>
              setToDate(event.target.value)
            }
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
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="tableWrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Patient</th>
              <th>BP</th>
              <th>HR</th>
              <th>SpO₂</th>
              <th>Temp</th>
              <th>Glycemia</th>
              <th>UOP</th>
            </tr>
          </thead>

          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.date}</td>

                  <td>{record.time}</td>

                  <td className="patientName">
                    {record.patient}
                  </td>

                  <td>{record.bp}</td>

                  <td>
                    {displayValue(
                      record.heartRate,
                      " bpm"
                    )}
                  </td>

                  <td>
                    {displayValue(
                      record.spo2,
                      "%"
                    )}
                  </td>

                  <td>
                    {displayValue(
                      record.temperature,
                      " °C"
                    )}
                  </td>

                  <td>
                    {displayValue(
                      record.glycemia,
                      " mg/dL"
                    )}
                  </td>

                  <td>
                    {displayValue(
                      record.urineOutput,
                      " mL"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    textAlign: "center",
                  }}
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
                  Choose what you want to include.
                </p>
              </div>

              <button
                type="button"
                className="closeButton"
                onClick={() =>
                  setShowDownloadOptions(false)
                }
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
  Vitals Only
</button>

<button
  type="button"
  className="secondaryButton"
  onClick={() => downloadRecords("notes")}
>
  Progress Notes Only
</button>

<button
  type="button"
  className="primaryButton"
  onClick={() => downloadRecords("both")}
>
  Vitals + Notes
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
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loadingUsers ? (
              <tr>
                <td colSpan={4}>
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
      onClick={() =>
        toggleUserStatus(user)
      }
    >
      {user.active
        ? "Deactivate"
        : "Activate"}
    </button>

    <button
  className="tableButton"
  style={{ marginLeft: "16px" }}
  onClick={() =>
    resetUserPassword(user)
  }
>
  Reset Password
</button>
  </div>
</td>
    </tr>
  ))
) : (
  <tr>
    <td colSpan={5}>
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