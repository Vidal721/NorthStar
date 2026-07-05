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
import StudentFormsPage from "./pages/studentForms";
import MainScout from "./pages/scout";
import ScoutSettings from "./pages/settings";
import ProtectedLayout from "./componets/ProtectedLayout"; 
import { useURL } from "./urlConfig"
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

      const userRole = String(data.role).toLowerCase();

      if (userRole === "admin") {
        navigate("/admin");
      } else if (userRole === "family") {
        navigate("/family")
      } else if (userRole === "helper") {
        navigate("/helper");
      } else if (userRole === "student" || userRole === "students") {
        navigate("/student");
      } else {
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
      
      {errorMessage && <p id="loginError" style={{ color: "#ff6b6b", fontWeight: "bold" }}>{errorMessage}</p>}
      
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
      <button id="mainLogin" onClick={handleLogin}>Login</button>
        <p style={{ marginTop: "15px" }}>
        Don't have an account? <Link to="/register" style={{ color: "#4f46e5", textDecoration: "none" }}>Sign Up</Link>
      </p>
    </div>
  );
}

function RegisterScreen() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleRegister() {
    setMessage("");
    setIsError(false);

    const username = document.getElementById("regUsername").value;
    const password = document.getElementById("regPassword").value;
    const role = document.getElementById("regRole").value;
    const subgroup = document.getElementById("buildSeason").value;

    if (!username || !password || !role) {
      setIsError(true);
      setMessage("All registration fields are required.");
      return;
    }

    try {
      const response = await fetch(`${useURL()}/auth/register`, {
        method: "POST",
        headers: defaultHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ username, password, role, subgroup }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setIsError(false);
      setMessage("Registration successful! Redirecting to login...");
      
      // Delay navigation slightly so they can see the confirmation banner message
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

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regUsername">Username / Email</label>
        </legend>
        <input type="text" id="regUsername" className="fieldset-input" placeholder="e.g. scouter935" />
      </fieldset>

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regPassword">Password</label>
        </legend>
        <input type="password" id="regPassword" className="fieldset-input" placeholder="••••••••" />
      </fieldset>

      <fieldset className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="regRole">Role</label>
        </legend>
        <select id="regRole" className="fieldset-input" style={{ width: "100%", background: "transparent", color: "inherit", border: "none", outline: "none" }}>
          <option value="students" style={{ background: "#ffffff" }}>Student</option>
          <option value="coach" style={{ background: "#ffffff" }}>Coach</option>
          <option value="family" style={{ background: "#ffffff" }}>Family Member</option>
          <option value="helper" style={{ background: "#ffffff" }}>Parent Helper</option>
          <option value="mentor" style={{ background: "#ffffff" }}>Mentor</option>
        </select>
      </fieldset>
      <fieldset id="studentOnly" className="fieldset-container">
        <legend className="fieldset-legend">
          <label htmlFor="buildSeason">Subgroup</label>
        </legend>
        <select id="buildSeason" className="fieldset-input" style={{ width: "100%", background: "transparent", color: "inherit", border: "none", outline: "none" }}>
          {/*<option value="admin" style={{ background: "#222" }}>Admin</option>
          <option value="teamMember" style={{ background: "#222" }}>Team Member</option>
          <option value="scouter" style={{ background: "#222" }}>Scouter</option>*/}
          <option value="Manufacturing" style={{ background: "#ffffff" }}>Manufacturing</option>
          <option value="Programming" style={{ background: "#ffffff" }}>Programming</option>
          <option value="Design" style={{ background: "#ffffff" }}>Design</option>
          <option value="Electronics" style={{ background: "#ffffff" }}>Electronics</option>
          <option value="Media" style={{ background: "#ffffff" }}>Media</option>
        </select>
      </fieldset>


      <button id="mainRegister" onClick={handleRegister} style={{ marginTop: "15px" }}>
        Register Account
      </button>

      <p style={{ marginTop: "15px" }}>
        Already have an account? <Link to="/" style={{ color: "#4f46e5", textDecoration: "none" }}>Log In</Link>
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

        <Route element={<ProtectedLayout allowedRoles={["admin", "students"]} />}>
          <Route path="/student" element={<StudentFormsPage />} />
          <Route path="/form/:formId" element={<StudentFormsPage />} />
        </Route>

        {/* Base Protection Level: Any Logged In Scouter */}
        <Route element={<ProtectedLayout allowedRoles={["scouter", "admin"]} />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
