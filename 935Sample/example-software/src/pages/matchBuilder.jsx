import React, { useState, useRef, useEffect } from "react";
import * as Blockly from "blockly";

/* ==========================================================================
   1. BLOCK DEFINITIONS (Layout, Logic, Math, Timers, and UI)
   ========================================================================== */
const BLOCK_DEFINITIONS = [
  // --- UI STRUCTURE ---
  {
    type: "form_page",
    category: "Pages & Layout",
    colour: "290",
    init: function () {
      this.appendDummyInput()
        .appendField("📄 Page / Shift")
        .appendField(new Blockly.FieldTextInput("Auto"), "PAGE_NAME")
        .appendField("⏱️ Switch After (s):")
        .appendField(new Blockly.FieldNumber(15, 0), "SWITCH_TIME");
      this.appendStatementInput("ELEMENTS").setCheck(["Button", "Results"]);
      this.setPreviousStatement(true, "Page");
      this.setNextStatement(true, "Page");
      this.setColour(290);
    },
    generate: (block, generator) => {
      const elements = generator.statementToCode(block, "ELEMENTS");
      return {
        type: "page",
        name: block.getFieldValue("PAGE_NAME"),
        switchTime: Number(block.getFieldValue("SWITCH_TIME")) || 0,
        children: elements
          ? JSON.parse(`[${elements.replace(/,\s*$/, "")}]`)
          : [],
      };
    },
  },
  {
    type: "form_button",
    category: "Pages & Layout",
    colour: "230",
    init: function () {
      this.appendDummyInput()
        .appendField("🔘 Button")
        .appendField(new Blockly.FieldTextInput("Score Amp"), "LABEL");
      this.appendStatementInput("ACTIONS").setCheck("Action");
      this.setPreviousStatement(true, ["Button", "Results"]);
      this.setNextStatement(true, ["Button", "Results"]);
      this.setColour(230);
    },
    generate: (block, generator) => {
      const actions = generator.statementToCode(block, "ACTIONS");
      return {
        type: "button",
        label: block.getFieldValue("LABEL"),
        actions: actions ? JSON.parse(`[${actions.replace(/,\s*$/, "")}]`) : [],
      };
    },
  },

  // --- VARIABLES & MATH ---
  {
    type: "var_init",
    category: "Variables & Math",
    colour: "330",
    init: function () {
      this.appendDummyInput()
        .appendField("📦 Create Variable")
        .appendField(new Blockly.FieldTextInput("is_defending"), "VAR_NAME")
        .appendField("as")
        .appendField(
          new Blockly.FieldDropdown([
            ["Number", "number"],
            ["Boolean", "boolean"],
          ]),
          "VAR_TYPE",
        )
        .appendField("Initial Value:")
        .appendField(new Blockly.FieldTextInput("0"), "INITIAL_VAL");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(330);
    },
    generate: (block) => ({
      type: "init_var",
      variable: block.getFieldValue("VAR_NAME"),
      varType: block.getFieldValue("VAR_TYPE"),
      value: block.getFieldValue("INITIAL_VAL"),
    }),
  },
  {
    type: "var_modify",
    category: "Variables & Math",
    colour: "330",
    init: function () {
      this.appendDummyInput()
        .appendField("🔄 Modify")
        .appendField(new Blockly.FieldTextInput("amp_notes"), "VAR_NAME")
        .appendField(
          new Blockly.FieldDropdown([
            ["Add", "add"],
            ["Subtract", "sub"],
            ["Set To", "set"],
          ]),
          "OPERATION",
        )
        .appendField(new Blockly.FieldNumber(1), "VALUE");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(330);
    },
    generate: (block) => ({
      type: "modify_var",
      variable: block.getFieldValue("VAR_NAME"),
      operation: block.getFieldValue("OPERATION"),
      value: Number(block.getFieldValue("VALUE")),
    }),
  },
  {
    type: "var_equation",
    category: "Variables & Math",
    colour: "330",
    init: function () {
      this.appendDummyInput()
        .appendField("🧮 Equation:")
        .appendField(new Blockly.FieldTextInput("total_score"), "RESULT_VAR")
        .appendField("=")
        .appendField(new Blockly.FieldTextInput("var1"), "VAR_1")
        .appendField(
          new Blockly.FieldDropdown([
            ["+", "+"],
            ["-", "-"],
            ["*", "*"],
            ["/", "/"],
          ]),
          "OPERATOR",
        )
        .appendField(new Blockly.FieldTextInput("var2"), "VAR_2");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(330);
    },
    generate: (block) => ({
      type: "equation",
      result: block.getFieldValue("RESULT_VAR"),
      var1: block.getFieldValue("VAR_1"),
      operator: block.getFieldValue("OPERATOR"),
      var2: block.getFieldValue("VAR_2"),
    }),
  },

  // --- TIMERS ---
  {
    type: "action_timer_start",
    category: "Timers & Data",
    colour: "45",
    init: function () {
      this.appendDummyInput()
        .appendField("⏱️ Start Timer")
        .appendField(new Blockly.FieldTextInput("cycle_time"), "TIMER_NAME");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(45);
    },
    generate: (block) => ({
      type: "start_timer",
      timerName: block.getFieldValue("TIMER_NAME"),
    }),
  },
  {
    type: "action_timer_stop",
    category: "Timers & Data",
    colour: "45",
    init: function () {
      this.appendDummyInput()
        .appendField("🛑 Stop Timer")
        .appendField(new Blockly.FieldTextInput("cycle_time"), "TIMER_NAME");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(45);
    },
    generate: (block) => ({
      type: "stop_timer",
      timerName: block.getFieldValue("TIMER_NAME"),
    }),
  },

  // --- RESULTS MAPPING ---
  {
    type: "results_mapping",
    category: "Results & Data",
    colour: "65",
    init: function () {
      this.appendDummyInput()
        .appendField("📊 Map Result:")
        .appendField(new Blockly.FieldTextInput("Display Label"), "LABEL")
        .appendField("-> Variable:")
        .appendField(new Blockly.FieldTextInput("total_score"), "VAR_NAME");
      this.setPreviousStatement(true, ["Button", "Results"]);
      this.setNextStatement(true, ["Button", "Results"]);
      this.setColour(65);
    },
    generate: (block) => ({
      type: "result_map",
      label: block.getFieldValue("LABEL"),
      variable: block.getFieldValue("VAR_NAME"),
    }),
  },

  // --- LOGIC & FLOW ---
  {
    type: "logic_if",
    category: "Logic & Flow",
    colour: "210",
    init: function () {
      this.appendDummyInput()
        .appendField("If Variable")
        .appendField(new Blockly.FieldTextInput("amp_notes"), "VAR_NAME")
        .appendField(">")
        .appendField(new Blockly.FieldNumber(0), "VALUE");
      this.appendStatementInput("DO").setCheck("Action").appendField("Do");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(210);
    },
    generate: (block, generator) => {
      const actions = generator.statementToCode(block, "DO");
      return {
        type: "if_greater",
        variable: block.getFieldValue("VAR_NAME"),
        value: Number(block.getFieldValue("VALUE")),
        actions: actions ? JSON.parse(`[${actions.replace(/,\s*$/, "")}]`) : [],
      };
    },
  },
  {
    type: "action_end_game",
    category: "Logic & Flow",
    colour: "0",
    init: function () {
      this.appendDummyInput().appendField("🚨 End Match / Breakdown");
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(0);
    },
    generate: () => ({ type: "end_match" }),
  },
  // --- NETWORK / SERVER ---
  {
    type: "action_push_server",
    category: "Results & Data",
    colour: "65",
    init: function () {
      this.appendDummyInput().appendField("☁️ Push Data to Server");
      this.appendDummyInput()
        .appendField("URL:")
        .appendField(
          new Blockly.FieldTextInput("https://your-api.com/submit"),
          "ENDPOINT",
        );
      this.setPreviousStatement(true, "Action");
      this.setNextStatement(true, "Action");
      this.setColour(65);
    },
    generate: (block) => ({
      type: "push_server",
      endpoint: block.getFieldValue("ENDPOINT"),
    }),
  },
];

// Setup Generator Engine
const jsonGenerator = new Blockly.Generator("JSON");
jsonGenerator.init = () => {};
jsonGenerator.finish = (code) => code;

jsonGenerator.scrub_ = (block, code, thisOnly) => {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  if (nextBlock && !thisOnly) {
    return code + jsonGenerator.blockToCode(nextBlock);
  }
  return code;
};

// Initialize Blocks and Categories
const toolboxCategories = {};
BLOCK_DEFINITIONS.forEach((def) => {
  if (!Blockly.Blocks[def.type]) {
    Blockly.Blocks[def.type] = { init: def.init };
  }
  jsonGenerator.forBlock[def.type] = (block) =>
    JSON.stringify(def.generate(block, jsonGenerator)) + ",\n";

  if (!toolboxCategories[def.category]) {
    toolboxCategories[def.category] = {
      kind: "category",
      name: def.category,
      colour: def.colour,
      contents: [],
    };
  }
  toolboxCategories[def.category].contents.push({
    kind: "block",
    type: def.type,
  });
});

/* ==========================================================================
   2. MAIN COMPONENT
   ========================================================================== */
export default function ScoutingBuilder() {
  const [formSchema, setFormSchema] = useState([]);
  const blocklyDivRef = useRef(null);
  const workspaceRef = useRef(null);

  // --- RUNTIME STATE ---
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [matchData, setMatchData] = useState({});
  const [activeTimers, setActiveTimers] = useState({});
  const [matchEnded, setMatchEnded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Total match length input at the top of the screen (in seconds)
  const [matchLength, setMatchLength] = useState(150);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // --- CONFIG EXPORT & API HELPERS ---
  const getApiBaseUrl = () => {
    return "http://localhost:3000";
  };

  const getDefaultHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const generateFormConfig = () => {
    let pages = formSchema;
    if (workspaceRef.current) {
      const rawLines = jsonGenerator.workspaceToCode(workspaceRef.current);
      try {
        const validJson = "[" + rawLines.trim().replace(/,\s*$/, "") + "]";
        pages = JSON.parse(validJson);
      } catch (error) {
        console.warn(
          "Could not parse workspace directly, falling back to state schema",
          error,
        );
      }
    }
    return {
      totalTime: matchLength,
      pages: pages,
    };
  };

  const handleUploadToServer = async () => {
    try {
      setIsUploading(true);
      setUploadStatus("");

      const formConfig = generateFormConfig();

      const response = await fetch(`${getApiBaseUrl()}/match/form/upload`, {
        method: "POST",
        headers: {
          ...getDefaultHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formConfig),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload failed");

      setUploadStatus("✅ Uploaded successfully!");
      setTimeout(() => setUploadStatus(""), 4000);
    } catch (err) {
      console.error(err);
      setUploadStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Initialize Blockly
  useEffect(() => {
    if (!blocklyDivRef.current) return;
    const activeWorkspace = Blockly.inject(blocklyDivRef.current, {
      toolbox: {
        kind: "categoryToolbox",
        contents: Object.values(toolboxCategories),
      },
      grid: { spacing: 20, length: 3, colour: "#ccc", snap: true },
      trashcan: true,
    });
    workspaceRef.current = activeWorkspace;

    const updateSchema = () => {
      const rawLines = jsonGenerator.workspaceToCode(activeWorkspace);
      try {
        const validJson = "[" + rawLines.trim().replace(/,\s*$/, "") + "]";
        setFormSchema(JSON.parse(validJson));
      } catch (error) {}
    };
    activeWorkspace.addChangeListener(updateSchema);
    return () => activeWorkspace.dispose();
  }, []);

  // --- PAGE AUTO-SWITCHING TIMER ---
  useEffect(() => {
    if (matchEnded || formSchema.length === 0) return;
    const currentPage = formSchema[activePageIndex];
    if (currentPage && currentPage.switchTime > 0) {
      const timer = setTimeout(() => {
        if (activePageIndex < formSchema.length - 1) {
          setActivePageIndex((prev) => prev + 1);
        } else {
          setMatchEnded(true);
        }
      }, currentPage.switchTime * 1000);
      return () => clearTimeout(timer);
    }
  }, [activePageIndex, formSchema, matchEnded]);

  // --- THE INTERPRETER ---
  const executeActionList = (actions) => {
    if (matchEnded) return;

    let newData = { ...matchData };
    let newTimers = { ...activeTimers };
    let shouldEnd = false;

    actions.forEach((action) => {
      if (action.type === "init_var") {
        let val = action.value;
        if (action.varType === "number") val = Number(val) || 0;
        if (action.varType === "boolean") val = val.toLowerCase() === "true";
        if (newData[action.variable] === undefined)
          newData[action.variable] = val;
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
      } else if (action.type === "if_greater") {
        const val = newData[action.variable] || 0;
        if (val > action.value) {
          executeActionList(action.actions);
        }
      } else if (action.type === "end_match") {
        shouldEnd = true;
      } else if (action.type === "push_server") {
        fetch(action.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newData),
        })
          .then((response) => {
            if (response.ok) {
              alert("✅ Data successfully pushed to server!");
            } else {
              alert("⚠️ Server received the request, but returned an error.");
            }
          })
          .catch((error) => {
            alert(
              "❌ Failed to push data. Check your network or URL.\n" +
                error.message,
            );
          });
      }
    });

    setMatchData(newData);
    setActiveTimers(newTimers);
    if (shouldEnd) setMatchEnded(true);
  };

  // --- SERVER SUBMISSION HANDLER ---
  const handleServerSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${getApiBaseUrl()}/match/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(matchData),
      });

      if (response.ok) {
        alert("🎉 Match data successfully submitted to the server!");
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(
          `⚠️ Failed to submit match data: ${errData.error || response.statusText}`,
        );
      }
    } catch (error) {
      alert(`❌ Network error while submitting: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePage = formSchema[activePageIndex] || {};
  const resultsMappings =
    activePage.children?.filter((c) => c.type === "result_map") || [];
  const activeButtons =
    activePage.children?.filter((c) => c.type === "button") || [];

  return (
    <div className="scout-builder">
      <div className="scout-builder__layout">
        {/* LEFT: Blockly Workspace */}
        <div ref={blocklyDivRef} className="scout-builder__canvas" />

        {/* RIGHT: Live App Preview & Data Console */}
        <div className="scout-builder__preview">
          <div className="scout-app">
            {/* Top Bar: Match Length Input */}
            <div className="scout-app__header">
              <label htmlFor="matchLengthInput">⏱️ Match Length (s):</label>
              <input
                id="matchLengthInput"
                type="number"
                value={matchLength}
                onChange={(e) => setMatchLength(Number(e.target.value) || 0)}
                className="scout-app__match-length-input"
              />
            </div>

            {/* Tab Navigation */}
            <div className="scout-app__nav">
              {formSchema.map((page, idx) => (
                <button
                  key={idx}
                  className={`scout-app__tab ${!matchEnded && idx === activePageIndex ? "scout-app__tab--active" : ""}`}
                  onClick={() => {
                    setActivePageIndex(idx);
                    setMatchEnded(false);
                  }}
                >
                  {page.name}
                  {page.switchTime > 0 && ` (${page.switchTime}s)`}
                </button>
              ))}
              <button
                className={`scout-app__tab ${matchEnded ? "scout-app__tab--active scout-app__tab--ended" : ""}`}
                onClick={() => setMatchEnded(true)}
              >
                🏁 Match Results
              </button>
              <button
                className="scout-btn scout-btn-primary scout-app__upload-btn"
                onClick={handleUploadToServer}
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "☁️ Upload to Server"}
              </button>

              {uploadStatus && (
                <span className="scout-app__upload-status">
                  {uploadStatus}
                </span>
              )}
            </div>

            {/* Active Page / Results Content */}
            <div className="scout-app__content">
              {matchEnded ? (
                <div className="scout-app__summary-container">
                  <h3 className="scout-app__summary-title">
                    Match Summary
                  </h3>
                  <div className="scout-app__results-grid">
                    {resultsMappings.length > 0 ? (
                      resultsMappings.map((mapping, idx) => {
                        const val = matchData[mapping.variable];
                        return (
                          <div key={idx} className="scout-app__result-card">
                            <div className="scout-app__result-label">
                              {mapping.label}
                            </div>
                            {Array.isArray(val) ? (
                              <div className="scout-app__timer-runs">
                                {val.map((t, i) => (
                                  <div
                                    key={i}
                                    className="scout-app__timer-run-item"
                                  >
                                    Run {i + 1}: {t}s
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="scout-app__result-value">
                                {typeof val === "number"
                                  ? val.toFixed(2)
                                  : String(val ?? "0")}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="scout-app__empty-message">
                        Drag "Map Result" blocks into a page to show variables
                        side-by-side here!
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleServerSubmit}
                    disabled={isSubmitting}
                    className="scout-app__submit-btn"
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : "🚀 Submit Data to Server"}
                  </button>
                </div>
              ) : activeButtons.length > 0 ? (
                activeButtons.map((btn, idx) => (
                  <button
                    key={idx}
                    className="scout-app__button"
                    onClick={() => executeActionList(btn.actions)}
                  >
                    {btn.label}
                  </button>
                ))
              ) : (
                <p className="scout-app__empty-message">
                  Add Buttons or Results Mapping blocks to this page.
                </p>
              )}
            </div>
          </div>

          {/* Real-time Data Console */}
          <div className="scout-builder__console">
            <div className="scout-builder__console-header">
              <strong className="scout-builder__console-title">
                Live Variable Engine (Memory):
              </strong>
              <button
                onClick={() => {
                  setMatchData({});
                  setActiveTimers({});
                  setMatchEnded(false);
                  setActivePageIndex(0);
                }}
                className="scout-builder__reset-btn"
              >
                Reset Math
              </button>
            </div>

            {Object.keys(activeTimers).length > 0 && (
              <div className="scout-builder__active-timers">
                ⏱️ Running Timers: {Object.keys(activeTimers).join(", ")}
              </div>
            )}

            <pre className="scout-builder__console-json">
              {JSON.stringify(matchData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}