import { useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import DataWidget from "../componets/dataWidget";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function LeadScoutPage() {
  const [layout, setLayout] = useState([
    {
      i: "widget-top-scorers",
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      minW: 2,
      minH: 2,
      maxH: 8,
      config: {
        title: "Top Scorers",
        endpoint: "/teams/leaderboard",
        type: "leaderboard",
        dataMapping: {
          name: "teamName",
          score: "totalPoints",
        },
      },
    },
    {
      i: "widget-recent-matches",
      x: 4,
      y: 0,
      w: 8,
      h: 5,
      minW: 2,
      minH: 2,
      maxH: 8,
      config: {
        title: "Recent Matches",
        endpoint: "/matches/recent",
        type: "table",
        dataMapping: {
          col1Label: "Match",
          col1Key: "matchNumber",
          col2Label: "Winner",
          col2Key: "winningAlliance",
        },
      },
    },
  ]);

  const addWidget = () => {
    const newId = `widget-${Date.now()}`;

    setLayout((prev) => [
      ...prev,
      {
        i: newId,
        x: 0,
        y: Infinity,
        w: 4,
        h: 3,
        minW: 2,
        minH: 2,
        maxH: 8,
        config: null,
      },
    ]);
  };

  const removeWidget = (id) => {
    console.log("Removing:", id);

    setLayout((prev) => prev.filter((item) => item.i !== id));
  };

  const handleLayoutChange = (newLayout) => {
    setLayout((prev) =>
      prev.map((item) => {
        const updated = newLayout.find((l) => l.i === item.i);
        return updated ? { ...item, ...updated } : item;
      })
    );
  };

  return (
    <div className="dashboard-container" id="leadScoutContent">
      <header className="dashboard-header">
        <h2 className="dashboard-title">Lead Scout Analytics</h2>

        <button className="btn-add-widget" onClick={addWidget}>
          + Add Widget
        </button>
      </header>

      <main className="grid-wrapper">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{
            lg: 1200,
            md: 996,
            sm: 768,
            xs: 480,
            xxs: 0,
          }}
          cols={{
            lg: 12,
            md: 10,
            sm: 6,
            xs: 4,
            xxs: 2,
          }}
          rowHeight={80}
          margin={[20, 20]}
          maxRows={10}
          useCSSTransforms
          draggableHandle=".drag-handle"

          // ⭐ THIS IS THE IMPORTANT LINE
          draggableCancel=".btn-delete-widget"

          onLayoutChange={handleLayoutChange}
        >
          {layout.map((item) => (
            <div key={item.i} className="widget-card">
              <div
                className="drag-handle"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>⠿</span>
                  {item.config?.title ?? "New Widget"}
                </div>

                <button
                  type="button"
                  className="btn-delete-widget"
                  onClick={() => removeWidget(item.i)}
                >
                  ✕
                </button>
              </div>

              <div className="widget-content-area">
                {item.config ? (
                  <DataWidget config={item.config} />
                ) : (
                  <div style={{ padding: 20 }}>
                    Configure this widget.
                  </div>
                )}
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </main>
    </div>
  );
}