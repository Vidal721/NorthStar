// 1. Added Link to the imports
import { BrowserRouter, Route, Routes, Link } from 'react-router-dom'
import MatchScout from "./pages/match"
import DataVis from "./pages/vis"
import PitScout from "./pages/pit"
import './App.css'

function MainMenu() {
  return (
    <>
      <h1>Welcome scouter!</h1>
      <div>
        <h1>choose what to start</h1>
        
        <div id="pitscout">
          <h1>Pitscouting</h1>
          {/* ✅ target="_blank" opens the route in a new tab */}
          <Link to="/pit" target="_blank" rel="noopener noreferrer" className="launch-btn">
            Launch
          </Link>
        </div>

        <div id="mainscout">
          <h1>Match Scouting</h1>
          <Link to="/match" target="_blank" rel="noopener noreferrer" className="launch-btn" id="startMatchScout">
            Launch
          </Link>
        </div>

        <div id="datavis">
          <h1>Data visualization</h1>
          <Link to="/vis" target="_blank" rel="noopener noreferrer" className="launch-btn" id="startVis">
            Launch
          </Link>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/pit" element={<PitScout />} />
        <Route path="/match" element={<MatchScout />} />
        <Route path="/vis" element={<DataVis />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
