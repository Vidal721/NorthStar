import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRocket,
  faPlus
} from "@fortawesome/free-solid-svg-icons";
import appInfo from '../pages/info.json'; 

function UpdateModal({ onClose }) {
  // State to manage whether sections are collapsed by default
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isBugsOpen, setIsBugsOpen] = useState(false);

  // Helper to parse the JSON notes into structured sections
  const getGroupedNotes = () => {
    const groups = {
      features: [],
      bugs: []
    };

    appInfo.releaseNotes.forEach((note) => {
      if (note.match(/^\[\s*New Feature\s*[\]\}]/i)) {
        const cleanText = note.replace(/^\[\s*New Feature\s*[\]\}]\s*/i, '');
        groups.features.push(cleanText);
      } else if (note.match(/^\[\s*Bug Fix\s*[\]\}]/i)) {
        const cleanText = note.replace(/^\[\s*Bug Fix\s*[\]\}]\s*/i, '');
        groups.bugs.push(cleanText);
      } else {
        groups.features.push(note);
      }
    });

    return groups;
  };

  const groupedNotes = getGroupedNotes();

  return (
    <div className="upd-mdl-overlay-backdrop">
      <div className="upd-mdl-content-card">
        <span className="upd-mdl-hero-emoji"><FontAwesomeIcon icon={faRocket} /></span>
        <h1 className="upd-mdl-header-title">Software Updated to v{appInfo.version}</h1>
        <p className="upd-mdl-header-subtitle">Here is what is new in this release:</p>
        
        {/* Render Features Section if they exist */}
        {groupedNotes.features.length > 0 && (
          <div className="upd-mdl-section">
            <div 
              className="upd-mdl-section-header" 
              onClick={() => setIsFeaturesOpen(!isFeaturesOpen)}
            >
              <h2 className="upd-mdl-section-title">New Features</h2>
              <span className={`upd-mdl-toggle-icon ${isFeaturesOpen ? 'upd-mdl-rotate-90' : ''}`}>
                <FontAwesomeIcon icon={faPlus} />
              </span>
            </div>
            
            <div className={`upd-mdl-collapsible-content ${isFeaturesOpen ? 'upd-mdl-expanded' : ''}`}>
              <ul className="upd-mdl-features-list">
                {groupedNotes.features.map((note, index) => (
                  <li key={`feat-${index}`} className="upd-mdl-features-item">
                    <span className="upd-mdl-badge upd-mdl-badge-feature">New</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Render Bug Fixes Section if they exist */}
        {groupedNotes.bugs.length > 0 && (
          <div className="upd-mdl-section">
            <div 
              className="upd-mdl-section-header" 
              onClick={() => setIsBugsOpen(!isBugsOpen)}
            >
              <h2 className="upd-mdl-section-title">Bug Fixes</h2>
              <span className={`upd-mdl-toggle-icon ${isBugsOpen ? 'upd-mdl-rotate-90' : ''}`}>
                <FontAwesomeIcon icon={faPlus} />
              </span>
            </div>

            <div className={`upd-mdl-collapsible-content ${isBugsOpen ? 'upd-mdl-expanded' : ''}`}>
              <ul className="upd-mdl-features-list">
                {groupedNotes.bugs.map((note, index) => (
                  <li key={`bug-${index}`} className="upd-mdl-features-item">
                    <span className="upd-mdl-badge upd-mdl-badge-bug">Fixed</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <button onClick={onClose} className="upd-mdl-action-btn">
          Got it, let's explore!
        </button>
      </div>
    </div>
  );
}

export default UpdateModal;