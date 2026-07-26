import React, { useRef, useState, useEffect } from "react";

// Import your image here so Webpack/Vite bundles it correctly
import bgImage from "../assets/field.png";

const DrawingPage = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff0000");
  const [brushSize, setBrushSize] = useState(5);

  // History tracking for Undo/Redo
  const historyRef = useRef([]);
  const historyStepRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Use the imported image variable directly
  const myImagePath = bgImage;

  const [headerJSON, setHeaderJSON] = useState([]);

  useEffect(() => {
    async function getData() {
      try {
        const res = await fetch(`http://localhost:3000/api/regionals`);
        if (res.ok) {
          const json = await res.json();
          console.log(json);
          // 3. Save the data to React state
          setHeaderJSON(json);
        }
      } catch (err) {
        console.error("Could not fetch regionals listing:", err);
      }
    }
    
    getData();
  }, []);

  const updateHistoryState = () => {
    setCanUndo(historyStepRef.current > 0);
    setCanRedo(historyStepRef.current < historyRef.current.length - 1);
  };

  const saveState = (canvas = canvasRef.current) => {
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);

    historyRef.current = historyRef.current.slice(
      0,
      historyStepRef.current + 1,
    );
    historyRef.current.push(data);
    historyStepRef.current += 1;
    updateHistoryState();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // 1. Set the canvas size immediately
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // 2. Save a completely blank canvas as the baseline right away.
    // This fixes the "Clear" bug even if the image fails to load.
    historyRef.current = [];
    historyStepRef.current = -1;
    saveState(canvas);

    if (!myImagePath) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = myImagePath;

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const widthScale = CANVAS_WIDTH / img.width;
      const heightScale = CANVAS_HEIGHT / img.height;
      const scaledWidth = img.width * widthScale;
      const scaledHeight = img.height * heightScale;
      const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
      const offsetY = 0;

      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        img.height,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight,
      );

      // 3. Once the image loads successfully, reset the history to make the image the NEW baseline.
      historyRef.current = [];
      historyStepRef.current = -1;
      saveState(canvas);
    };

    img.onerror = () => {
      console.error("The image failed to load! Check your file path.");
    };
  }, []); // Only runs once on mount

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getCoordinates(e);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = brushColor;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.cancelable && e.type === "touchmove") e.preventDefault();

    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleUndo = () => {
    if (historyStepRef.current > 0) {
      historyStepRef.current -= 1;
      const ctx = canvasRef.current.getContext("2d");
      ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
      updateHistoryState();
    }
  };

  const handleRedo = () => {
    if (historyStepRef.current < historyRef.current.length - 1) {
      historyStepRef.current += 1;
      const ctx = canvasRef.current.getContext("2d");
      ctx.putImageData(historyRef.current[historyStepRef.current], 0, 0);
      updateHistoryState();
    }
  };

  const handleDelete = () => {
    if (historyRef.current.length > 0) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.putImageData(historyRef.current[0], 0, 0);
      saveState();
    }
  };

  const exportImage = () => {
    const dataUrl = canvasRef.current.toDataURL("image/png");
    console.log("Combined base64 image data string:", dataUrl);
  };

  async function getData() {
    try {
      const res = await fetch(`http://localhost:3000/api/regionals`);
      if (res.ok) {
        const json = await res.json();
        console.log(json);
        headerJSON = json
      }
    } catch (err) {
      console.error("Could not fetch regionals listing:", err);
    }
  }


  return (
    <div className="app-container">
<div className="sidebar">
        {/* 4. Use .map() instead of .forEach() and add a unique key */}
        {headerJSON.map((item, index) => (
            <h1 key={item.id || index}>{item.name}</h1>
        ))}
      </div>

      <div className="main-content">
        <div className="toolbar">
          <div className="tool-group">
            <label htmlFor="colorPicker" title="Brush Color">
              🎨
            </label>
            <input
              id="colorPicker"
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
            />
          </div>

          <div className="tool-group">
            <label htmlFor="brushSize" title="Brush Size">
              🖌️ {brushSize}px
            </label>
            <input
              id="brushSize"
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
            />
          </div>

          <div className="divider"></div>

          <button onClick={handleUndo} disabled={!canUndo} className="icon-btn">
            ↩️ Undo
          </button>
          <button onClick={handleRedo} disabled={!canRedo} className="icon-btn">
            ↪️ Redo
          </button>
          <button onClick={handleDelete} className="icon-btn delete-btn">
            🗑️ Clear
          </button>

          <div className="divider"></div>

          <button className="export-btn" onClick={exportImage}>
            Export
          </button>
        </div>

        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="drawing-canvas fixed-size"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingPage;
