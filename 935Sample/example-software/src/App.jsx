import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
  useActionData,
} from "react-router-dom";
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
import ProtectedLayout from "./componets/ProtectedLayout";
import { useURL } from "./urlConfig";
import "./App.css";

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

      const userRole = String(data.role).toLowerCase();

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
  
  // 1. Manage form fields using React state instead of DOM selections
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("students"); // Match the default option value
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
    const finalSubgroup = role === "students" || role === "programmer" ? subgroup : "none";

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
          <label htmlFor="regUsername">Username / Email</label>
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

      {/* Controlled Input: Password */}
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

      {/* Controlled Input: Role */}
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
          {/* NOTE: Changed option value to "students" to match state and your option tag */}
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
          <option value="programmer" style={{ background: "#ffffff" }}>
            Programmer
          </option>
          <option value="Mentor" style={{ background: "#ffffff" }}>
            Mentor
          </option>
        </select>
      </fieldset>

      {/* 2. Conditional Rendering: Only show Subgroup if role is "students" */}
      {(role === "students" || role === "programmer") && (
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
        {/* Public Hub Routes */}
        <Route path="/" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />

        <Route element={<ProtectedLayout allowedRoles={["admin", "family"]} />}>
          <Route path="/family" element={<FamilyPage />} />
        </Route>

        <Route element={<ProtectedLayout allowedRoles={["admin", "helper"]} />}>
          <Route path="/helper" element={<HelperPage />} />
        </Route>

        <Route element={<ProtectedLayout allowedRoles={["admin", "Mentor"]} />}>
          <Route path="/mentor" element={<MentorPage />} />
        </Route>

        <Route element={<ProtectedLayout allowedRoles={["admin", "coach"]} />}>
          <Route path="/coach" element={<CoachPage />} />
        </Route>

        <Route element={<ProtectedLayout allowedRoles={["admin", "students", "helper", "Mentor", "coach", "programmer"]} />}>
          <Route path="/student" element={<StudentFormsPage />} />
          <Route path="/form/:formId" element={<StudentFormsPage />} />
        </Route>

        <Route
          element={<ProtectedLayout allowedRoles={["scouter", "admin", "coach"]} />}
        >
          <Route path="/scout" element={<MainScout />} />
          <Route path="/pit" element={<PitScout />} />
          <Route path="/match" element={<MatchScout />} />
          <Route path="/vis" element={<DataVis />} />
          <Route path="/scoutSeettings" element={<ScoutSettings />} />
        </Route>

        {/* High Protection Level: Admins Only */}
        <Route element={<ProtectedLayout allowedRoles={["admin", "coach"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/form" element={<FormBuilder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
