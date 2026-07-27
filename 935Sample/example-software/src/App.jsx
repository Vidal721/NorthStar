import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
  useActionData,
} from "react-router-dom";

// Pages
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import FormBuilder from "./pages/formbuilder";
import FamilyPage from "./pages/family";
import HelperPage from "./pages/helper";
import MentorPage from "./pages/mentor";
import CoachPage from "./pages/coach";
import StudentFormsPage from "./pages/studentForms";
import MainScout from "./pages/scout";
import ScoutSettings from "./pages/settings";
import LeadScoutPage from './pages/leadScout'
import DrivePage from './pages/drive'
import MatchBuilder from './pages/matchBuilder'

// Componets
import ProtectedLayout from "./componets/ProtectedLayout";

// URL Config
import { useURL } from "./urlConfig";

// CSS
import "./App.css";

// Headers to bypass CORS errors on backend
const defaultHeaders = (extra = {}) => ({
  "ngrok-skip-browser-warning": "69420",
  ...extra,
});

function LoginScreen() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin() {
    setErrorMessage("");
    const username = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!username || !password) {
      setErrorMessage("Please enter both a username and password.");
      return;
    }

    try {
      const response = await fetch(`${useURL()}/auth/login`, {
        method: "POST",
        headers: defaultHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      localStorage.setItem("currentUser", data.username);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("userSubgroup", data.subgroup || "");
      localStorage.setItem('userCompetitionRole', data.competitionRole || "");

      const userRole = String(data.role).toLowerCase();

      // TODO: Consider changing to switch and case if we need to add more
      // Determins what page to send the user too
      if (userRole === "admin") {
        navigate("/admin");
      } else if (userRole === "family") {
        navigate("/family");
      } else if (userRole === "helper") {
        navigate("/helper");
      } else if (userRole === "mentor") {
        navigate("/mentor");
      } else if (
        userRole === "student" ||
        userRole === "students" ||
        userRole === "programmer" ||
        userRole === "programmers"
      ) {
        navigate("/student");
      } else if (userRole === "coach") {
        navigate("/coach");
      } else{
        navigate("/scout");
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleLogin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div id="loginContainer">
      <img
        src="/pwa-512x512-removebg.png"
        alt="935 scouting logo"
        className="mainLogo"
        id="mainLogo"
      />
      <p>Welcome! Please Login</p>

      {errorMessage && (
        <p id="loginError" style={{ color: "#ff6b6b", fontWeight: "bold" }}>
          {errorMessage}
        </p>
      )}

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="email">Username</label>
        </legend>
        <input type="email" id="email" className="fieldset-input" />
      </fieldset>
      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="password">Password</label>
        </legend>
        <input type="password" id="password" className="fieldset-input" />
      </fieldset>
      <button id="mainLogin" onClick={handleLogin}>
        Login
      </button>
      <p style={{ marginTop: "15px" }}>
        Don't have an account?{" "}
        <Link
          to="/register"
          style={{ color: "#4f46e5", textDecoration: "none" }}
        >
          Sign Up
        </Link>
      </p>
    </div>
  );
}

function RegisterScreen() {
  const navigate = useNavigate();
  
  // Login variables
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("students");

  // Subgroup
  const [subgroup, setSubgroup] = useState("Manufacturing");
  const [subgroups, setSubgroups] = useState(["Manufacturing", "Programming", "Design", "Electronics", "Media"]);
  
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    fetch(`${useURL()}/subgroups`)
      .then((res) => res.ok ? res.json() : [])
      .then((groups) => {
        if (groups.length) {
          setSubgroups(groups);
          setSubgroup((current) => groups.includes(current) ? current : groups[0]);
        }
      })
      .catch(() => {});
  }, []);

  async function handleRegister() {
    setMessage("");
    setIsError(false);

    if (!username || !password || !role) {
      setIsError(true);
      setMessage("All registration fields are required.");
      return;
    }

    // Only submit subgroup if the user is a student or programmer
    const finalSubgroup = role === "students" ? subgroup : "none";
    
    // Only submit competition role if the user is a student, coach, or parent helper

    try {
      const response = await fetch(`${useURL()}/auth/register`, {
        method: "POST",
        headers: defaultHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ 
          username,
          password,
          role,
          subgroup: finalSubgroup
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setIsError(false);
      setMessage("Registration successful! Redirecting to login...");

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      setIsError(true);
      setMessage(err.message);
    }
  }

  return (
    <div id="registerContainer">
      <img
        src="/pwa-512x512-removebg.png"
        alt="935 scouting logo"
        className="mainLogo"
        id="registerLogo"
      />
      <h2>Create New Account</h2>

      {message && (
        <p
          id="registerStatusMessage"
          style={{ color: isError ? "#ff6b6b" : "#4ade80", fontWeight: "bold" }}
        >
          {message}
        </p>
      )}

      {/* Controlled Input: Username */}
      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regUsername">Name (First and Last)</label>
        </legend>
        <input
          type="text"
          id="regUsername"
          className="fieldset-input"
          placeholder="e.g. scouter935"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </fieldset>

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regPassword">Password</label>
        </legend>
        <input
          type="password"
          id="regPassword"
          className="fieldset-input"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </fieldset>

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regRole">Role</label>
        </legend>
        <select
          id="regRole"
          className="fieldset-input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            width: "100%",
            background: "transparent",
            color: "inherit",
            border: "none",
            outline: "none",
          }}
        >
          <option value="students" style={{ background: "#ffffff" }}>
            Student
          </option>
          <option value="coach" style={{ background: "#ffffff" }}>
            Coach
          </option>
          <option value="family" style={{ background: "#ffffff" }}>
            Family Member
          </option>
          <option value="helper" style={{ background: "#ffffff" }}>
            Parent Helper
          </option>
          <option value="Mentor" style={{ background: "#ffffff" }}>
            Mentor
          </option>
        </select>
      </fieldset>

      {/* 2. Conditional Rendering: Only show Subgroup if role is "students" */}
      {(role === "students") && (
        <fieldset id="studentOnly" className="fieldset-container">
          <legend className="fieldset-legend">
            <label htmlFor="buildSeason">Subgroup</label>
          </legend>
          <select
            id="buildSeason"
            className="fieldset-input"
            value={subgroup}
            onChange={(e) => setSubgroup(e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              color: "inherit",
              border: "none",
              outline: "none",
            }}
          >
            {subgroups.map((group) => <option key={group} value={group} style={{ background: "#ffffff" }}>{group}</option>)}
          </select>
        </fieldset>
      )}
      {(role === "students" || "helper" || "coach") && (
        <fieldset id="studentOnly" className="fieldset-container">
          <legend className="fieldset-legend">
            <label htmlFor="buildSeason">Subgroup</label>
          </legend>
          <select
            id="buildSeason"
            className="fieldset-input"
            value={subgroup}
            onChange={(e) => setSubgroup(e.target.value)}
            style={{
              width: "100%",
              background: "transparent",
              color: "inherit",
              border: "none",
              outline: "none",
            }}
          >
            {subgroups.map((group) => <option key={group} value={group} style={{ background: "#ffffff" }}>{group}</option>)}
          </select>
        </fieldset>
      )}

      <button
        id="mainRegister"
        onClick={handleRegister}
        style={{ marginTop: "15px" }}
      >
        Register Account
      </button>

      <p style={{ marginTop: "15px" }}>
        Already have an account?{" "}
        <Link to="/" style={{ color: "#4f46e5", textDecoration: "none" }}>
          Log In
        </Link>
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />

        {/* Family Only Routes */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "family"]} />}>
          <Route path="/family" element={<FamilyPage />} />
        </Route>

        {/* Helper Only Routes */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "helper"]} />}>
          <Route path="/helper" element={<HelperPage />} />
        </Route>

        {/* Mentor Only Routes */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "Mentor"]} />}>
          <Route path="/mentor" element={<MentorPage />} />
        </Route>

        {/* Coach/Admin Routes */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "coach"]} />}>
          <Route path="/coach" element={<CoachPage />} />
        </Route>

        {/* All Authenticated Users Login */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "students", "helper", "Mentor", "coach"]} />}>
          <Route path="/student" element={<StudentFormsPage />} />
          <Route path="/form/:formId" element={<StudentFormsPage />} />
        </Route>

        {/* Competition Roles */}
        <Route
          element={<ProtectedLayout allowedRoles={["scouter"]} />}
        >
          <Route path="/scout" element={<MainScout />} />
          <Route path="/pit" element={<PitScout />} />
          <Route path="/match" element={<MatchScout />} />
          <Route path="/vis" element={<DataVis />} />
          <Route path="/scoutSeettings" element={<ScoutSettings />} />
        </Route>

        {/* High Protection Level: Admins Only */}
        <Route element={<ProtectedLayout allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/form" element={<FormBuilder />} />
          <Route path="/lead" element={<LeadScoutPage />} />
          <Route path="/drive" element={<DrivePage />} />
          <Route path="/matchBuilder" element={<MatchBuilder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
