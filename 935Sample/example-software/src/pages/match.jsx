import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPause, faPlay } from "@fortawesome/free-solid-svg-icons";
import { useURL } from "../urlConfig";

export default function MatchScoutingApp({ onBackToDashboard }) {
  // --- CONFIG & LOADING STATE ---
  const [formSchema, setFormSchema] = useState([]);
  const [matchTotal, setMatchTotal] = useState(60); // Total match length in seconds
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- MATCH SETUP STATE ---
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchInfo, setMatchInfo] = useState({
    teamNumber: "",
    matchNumber: "",
    scouterName: localStorage.getItem("userFirstName") || "",
  });

  const apiBaseUrl = useURL();

  // --- RUNTIME ENGINE STATE ---
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [matchData, setMatchData] = useState({});
  const [activeTimers, setActiveTimers] = useState({});
  const [matchEnded, setMatchEnded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- TIMER STATE ---
  const [currentTime, setCurrentTime] = useState(0); // Counts up in seconds
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Fetch saved form configuration from backend on mount
  useEffect(() => {
    const fetchFormConfig = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(apiBaseUrl+"/match/form", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(
            "Failed to load match form configuration. Please build and save a form first.",
          );
        }

        const data = await response.json();

        let pages = [];
        let totalSecs = 0;

        if (Array.isArray(data)) {
          pages = data;
        } else if (data && typeof data === "object") {
          pages =
            data.pages || data.formSchema || data.formSchema?.fields || [];
          totalSecs = Number(
            data.totalTime || data.matchTotal || data.timing?.matchTotal || 0,
          );
        }

        if (pages.length === 0) {
          throw new Error("Form configuration contains no pages.");
        }

        // Derive total match time from highest switchTime if totalSecs isn't explicitly set
        if (!totalSecs) {
          const maxSwitch = Math.max(
            ...pages.map((p) => Number(p.switchTime) || 0),
          );
          totalSecs = maxSwitch > 0 ? maxSwitch : 60;
        }

        setFormSchema(pages);
        setMatchTotal(totalSecs);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFormConfig();
  }, []);

  // --- DYNAMIC SWITCH TIME EVALUATOR ---
  const getActiveStateForTime = (time, schema, totalTime) => {
    if (totalTime > 0 && time >= totalTime) {
      return { pageIndex: Math.max(0, schema.length - 1), shouldEnd: true };
    }

    if (!schema || schema.length === 0) {
      return { pageIndex: 0, shouldEnd: false };
    }

    const switchThresholds = schema
      .map((p) => Number(p.switchTime))
      .filter((st) => !isNaN(st) && st > 0)
      .sort((a, b) => a - b);

    let thresholdCount = 0;
    for (const threshold of switchThresholds) {
      if (time >= threshold) {
        thresholdCount++;
      }
    }

    if (thresholdCount >= schema.length) {
      return { pageIndex: schema.length - 1, shouldEnd: true };
    }

    return {
      pageIndex: Math.min(thresholdCount, schema.length - 1),
      shouldEnd: false,
    };
  };

  // --- MATCH TIMER EFFECT ---
  useEffect(() => {
    if (!matchStarted || matchEnded || isTimerPaused) return;

    const interval = setInterval(() => {
      setCurrentTime((prevTime) => {
        const nextTime = prevTime + 1;

        const { pageIndex, shouldEnd } = getActiveStateForTime(
          nextTime,
          formSchema,
          matchTotal,
        );

        if (shouldEnd) {
          setMatchEnded(true);
          return nextTime;
        }

        setActivePageIndex(pageIndex);
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchStarted, matchEnded, isTimerPaused, matchTotal, formSchema]);

  // --- ACTION ENGINE ---
  const executeActionList = (actions) => {
    if (matchEnded) return;

    let newData = { ...matchData };
    let newTimers = { ...activeTimers };
    let shouldEnd = false;

    actions.forEach((action) => {
      if (action.type === "init_var") {
        let val = action.value;
        if (action.varType === "number") val = Number(val) || 0;
        if (action.varType === "boolean")
          val = String(val).toLowerCase() === "true";
        if (newData[action.variable] === undefined) {
          newData[action.variable] = val;
        }
      } else if (action.type === "modify_var") {
        let currentVal = newData[action.variable] || 0;
        if (action.operation === "add")
          newData[action.variable] = currentVal + action.value;
        if (action.operation === "sub")
          newData[action.variable] = currentVal - action.value;
        if (action.operation === "set") newData[action.variable] = action.value;
      } else if (action.type === "equation") {
        const v1 =
          typeof newData[action.var1] !== "undefined"
            ? newData[action.var1]
            : Number(action.var1);
        const v2 =
          typeof newData[action.var2] !== "undefined"
            ? newData[action.var2]
            : Number(action.var2);
        let result = 0;
        if (action.operator === "+") result = v1 + v2;
        if (action.operator === "-") result = v1 - v2;
        if (action.operator === "*") result = v1 * v2;
        if (action.operator === "/") result = v2 !== 0 ? v1 / v2 : 0;
        newData[action.result] = result;
      } else if (action.type === "start_timer") {
        newTimers[action.timerName] = Date.now();
      } else if (action.type === "stop_timer") {
        if (newTimers[action.timerName]) {
          const elapsedSeconds = Number(
            ((Date.now() - newTimers[action.timerName]) / 1000).toFixed(2),
          );
          if (!Array.isArray(newData[action.timerName])) {
            newData[action.timerName] = [];
          }
          newData[action.timerName] = [
            ...newData[action.timerName],
            elapsedSeconds,
          ];
          delete newTimers[action.timerName];
        }
      } else if (action.type === "end_match") {
        shouldEnd = true;
      }
    });

    setMatchData(newData);
    setActiveTimers(newTimers);
    if (shouldEnd) setMatchEnded(true);
  };

  const incrementMatchNumber = (str) => {
    if (!str) return "";
    return str.replace(/(\d+)(?=\D*$)/, (match) => String(Number(match) + 1));
  };

  // --- SUBMISSION & RESET HANDLER ---
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...matchInfo,
        matchData,
        submittedAt: new Date().toISOString(),
      };

      const response = await fetch(apiBaseUrl+"/match/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || response.statusText);
      }

      alert("🎉 Match data successfully submitted!");

      setMatchInfo((prev) => ({
        ...prev,
        teamNumber: "",
        matchNumber: incrementMatchNumber(prev.matchNumber),
      }));

      setMatchStarted(false);
      setCurrentTime(0);
      setActivePageIndex(0);
      setMatchData({});
      setActiveTimers({});
      setMatchEnded(false);
      setIsTimerPaused(false);
    } catch (error) {
      alert(`❌ Failed to submit match data: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER: LOADING OR ERROR ---
  if (isLoading) {
    return (
      <div className="match-app__center-container">
        <h2>Loading Match Form Configuration...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="match-app__error-container">
        <h2 className="match-app__error-title">Configuration Error</h2>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="match-app__retry-btn"
        >
          Retry
        </button>
      </div>
    );
  }

  // --- RENDER: PRE-MATCH START SCREEN ---
  if (!matchStarted) {
    return (
      <div className="match-app__start-screen">
        <div className="match-app__start-card">
          <h2 className="match-app__start-title">Match Scouting</h2>

          <div className="match-app__form-group">
            <label className="match-app__form-label">Team Number</label>
            <input
              type="text"
              placeholder="e.g. 254"
              value={matchInfo.teamNumber}
              onChange={(e) =>
                setMatchInfo({ ...matchInfo, teamNumber: e.target.value })
              }
              className="match-app__form-input"
            />
          </div>

          <div className="match-app__form-group">
            <label className="match-app__form-label">Match Number</label>
            <input
              type="text"
              placeholder="e.g. Qual 12"
              value={matchInfo.matchNumber}
              onChange={(e) =>
                setMatchInfo({ ...matchInfo, matchNumber: e.target.value })
              }
              className="match-app__form-input"
            />
          </div>

          <div className="match-app__form-group match-app__form-group--large">
            <label className="match-app__form-label">Scouter Name</label>
            <input
              type="text"
              placeholder="Your Name"
              value={matchInfo.scouterName}
              onChange={(e) =>
                setMatchInfo({ ...matchInfo, scouterName: e.target.value })
              }
              className="match-app__form-input"
            />
          </div>

          <button
            onClick={() => {
              if (!matchInfo.teamNumber || !matchInfo.matchNumber) {
                alert("Please fill in Team Number and Match Number.");
                return;
              }
              setMatchStarted(true);
            }}
            className="match-app__start-btn"
          >
            Start Match
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: ACTIVE MATCH INTERFACE ---
  const activePage = formSchema[activePageIndex] || {};
const resultsMappings = formSchema.flatMap(
  (page) => page.children?.filter((c) => c.type === "result_map") || []
);
  const activeButtons =
    activePage.children?.filter((c) => c.type === "button") || [];

  return (
    <div className="match-app">
      {/* Top Header / Match Timer Bar */}
      <div className="match-app__header">
        <div>
          <strong>Team {matchInfo.teamNumber}</strong> | Match{" "}
          {matchInfo.matchNumber}
        </div>
        <div className="match-app__timer-wrapper">
          <div
            className={`match-app__timer-badge ${
              currentTime >= matchTotal - 10
                ? "match-app__timer-badge--warning"
                : ""
            }`}
          >
            {currentTime}s
          </div>
          <button
            onClick={() => setIsTimerPaused(!isTimerPaused)}
            className="match-app__pause-btn"
          >
            {isTimerPaused ? (
              <FontAwesomeIcon icon={faPlay} />
            ) : (
              <FontAwesomeIcon icon={faPause} />
            )}
          </button>
        </div>
      </div>

      {/* Main Scouting App Content Area */}
      <div className="match-app__main">
        <div className="match-app__card">
          {/* Tab Navigation */}
          <div className="match-app__nav">
            {formSchema.map((page, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setActivePageIndex(idx);
                  setMatchEnded(false);
                }}
                className={`match-app__tab ${
                  !matchEnded && idx === activePageIndex
                    ? "match-app__tab--active"
                    : ""
                }`}
              >
                {page.name}
              </button>
            ))}
            <button
              onClick={() => setMatchEnded(true)}
              className={`match-app__tab match-app__tab--results ${
                matchEnded ? "match-app__tab--results-active" : ""
              }`}
            >
              Match Results
            </button>
          </div>

          {/* Content Area */}
          <div className="match-app__content">
            {matchEnded ? (
              <div className="match-app__summary">
                <h3 className="match-app__summary-title">
                  Match Summary Results
                </h3>
                <div className="match-app__summary-grid">
                  {resultsMappings.map((mapping, idx) => {
                    const val = matchData[mapping.variable];

                    return (
                      <div key={idx} className="match-app__result-card">
                        <div className="match-app__result-label">
                          {mapping.label}
                        </div>
                        {Array.isArray(val) ? (
                          <div className="match-app__timer-runs">
                            {val.map((t, i) => (
                              <div
                                key={i}
                                className="match-app__timer-run-item"
                              >
                                Cycle {i + 1}: {t}s
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="match-app__result-value">
                            {typeof val === "number"
                              ? val.toFixed(2)
                              : String(val ?? "None")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="match-app__submit-btn"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            ) : activeButtons.length > 0 ? (
              activeButtons.map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => executeActionList(btn.actions)}
                  className="match-app__action-btn"
                >
                  {btn.label}
                </button>
              ))
            ) : (
              <div className="match-app__empty-state">
                <p>No buttons configured on this page.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
