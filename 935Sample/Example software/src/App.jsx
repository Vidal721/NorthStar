import { useState, useEffect } from "react"; // Added hooks
import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useNavigate,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMoon,
  faSun,
  faArrowUpRightFromSquare,
  faBinoculars,
  faX,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import MatchScout from "./pages/match";
import DataVis from "./pages/vis";
import PitScout from "./pages/pit";
import AdminDashboard from "./pages/admin";
import FormBuilder from "./pages/formbuilder";
import "./App.css";

function LoginScreen () {
  return (
    <fieldset class="fieldset-container">
  <legend class="fieldset-legend"><label for="email">Email Address</label></legend>
  <input type="email" id="email" class="fieldset-input" placeholder="Enter your email"></input>
</fieldset>


  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/pit" element={<PitScout />} />
        <Route path="/match" element={<MatchScout />} />
        <Route path="/vis" element={<DataVis />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/form" element={<FormBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
