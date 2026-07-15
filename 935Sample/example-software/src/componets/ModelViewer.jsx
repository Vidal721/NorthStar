import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import occtimportjs from "occt-import-js";
import occtWasmUrl from "occt-import-js/dist/occt-import-js.wasm?url";

const CAD_EXTENSIONS = ["step", "stp", "iges", "igs", "brep"];

const closestPointOnTriangleEdges = (intersection) => {
  const geometry = intersection.object.geometry;
  const position = geometry?.attributes?.position;
  if (!position || intersection.faceIndex == null) return intersection.point;
  const index = geometry.index;
  const first = intersection.faceIndex * 3;
  const ids = index
    ? [index.getX(first), index.getX(first + 1), index.getX(first + 2)]
    : [first, first + 1, first + 2];
  const points = ids.map((id) => new THREE.Vector3().fromBufferAttribute(position, id).applyMatrix4(intersection.object.matrixWorld));
  const closest = new THREE.Vector3();
  let result = intersection.point.clone();
  let distance = Infinity;
  [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
    new THREE.Line3(points[a], points[b]).closestPointToPoint(intersection.point, true, closest);
    const nextDistance = closest.distanceToSquared(intersection.point);
    if (nextDistance < distance) {
      result = closest.clone();
      distance = nextDistance;
    }
  });
  return result;
};

export default function ModelViewer({ sourceUrl, fileName }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [color, setColor] = useState("#3b82f6");
  const colorRef = useRef(color);
  const [measuring, setMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState(null);
  const [status, setStatus] = useState("Loading model…");

  useEffect(() => {
    colorRef.current = color;
    const state = stateRef.current;
    if (!state?.model) return;
    state.model.traverse((child) => {
      if (child.isMesh) child.material.color.set(color);
    });
  }, [color]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5);
    light.position.set(5, 8, 5);
    scene.add(light, new THREE.GridHelper(200, 20, 0x94a3b8, 0xdbeafe));
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const markers = [];
    let model;
    let animationFrame;
    let measurePoints = [];

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(width || 1, height || 1, false);
      camera.aspect = (width || 1) / (height || 1);
      camera.updateProjectionMatrix();
    };
    const frame = () => {
      animationFrame = requestAnimationFrame(frame);
      controls.update();
      renderer.render(scene, camera);
    };
    const clearMeasurement = () => {
      markers.splice(0).forEach((item) => scene.remove(item));
      measurePoints = [];
      setMeasurement(null);
    };
    const fitModel = () => {
      if (!model) return;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      camera.position.copy(center).add(new THREE.Vector3(size, size * 0.7, size));
      controls.target.copy(center);
      controls.update();
    };
    const onPointerDown = (event) => {
      if (!stateRef.current?.measuring || !model) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(model, true).find((item) => item.object.isMesh);
      if (!hit) return;
      const point = closestPointOnTriangleEdges(hit);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      marker.position.copy(point);
      scene.add(marker);
      markers.push(marker);
      measurePoints.push(point);
      if (measurePoints.length === 2) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(measurePoints), new THREE.LineBasicMaterial({ color: 0xef4444 }));
        scene.add(line);
        markers.push(line);
        setMeasurement(measurePoints[0].distanceTo(measurePoints[1]));
        measurePoints = [];
      }
    };
    const load = async () => {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error("Could not load this model.");
        const buffer = await response.arrayBuffer();
        const extension = fileName.split(".").pop()?.toLowerCase();
        const material = new THREE.MeshStandardMaterial({ color: colorRef.current, metalness: 0.08, roughness: 0.65 });
        if (extension === "stl") model = new THREE.Mesh(new STLLoader().parse(buffer), material);
        else if (extension === "ply") model = new THREE.Mesh(new PLYLoader().parse(buffer), material);
        else if (extension === "obj") model = new OBJLoader().parse(new TextDecoder().decode(buffer));
        else if (["gltf", "glb"].includes(extension)) model = (await new GLTFLoader().parseAsync(buffer, "")).scene;
        else if (CAD_EXTENSIONS.includes(extension)) {
          const occt = await occtimportjs({ locateFile: () => occtWasmUrl });
          const file = new Uint8Array(buffer);
          const result = extension === "brep" ? occt.ReadBrepFile(file, null) : ["iges", "igs"].includes(extension) ? occt.ReadIgesFile(file, null) : occt.ReadStepFile(file, null);
          if (!result.success) throw new Error("This CAD file could not be converted for viewing.");
          model = new THREE.Group();
          result.meshes.forEach((meshData) => {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.attributes.position.array.flat(), 3));
            if (meshData.attributes.normal) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.attributes.normal.array.flat(), 3));
            else geometry.computeVertexNormals();
            geometry.setIndex(meshData.index.array.flat());
            model.add(new THREE.Mesh(geometry, material.clone()));
          });
        } else throw new Error("Supported 3D formats are STEP, IGES, BREP, STL, OBJ, PLY, GLTF, and GLB.");
        model.traverse((child) => {
          if (child.isMesh) {
            child.material = material.clone();
            child.material.color.set(colorRef.current);
            child.geometry.computeBoundingSphere();
          }
        });
        scene.add(model);
        stateRef.current = { model, controls, fitModel, clearMeasurement, measuring: false };
        fitModel();
        setStatus("");
      } catch (error) {
        setStatus(error.message);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    resize();
    frame();
    load();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (!disposed) return;
    };
  }, [sourceUrl, fileName]);

  const toggleMeasure = () => {
    const next = !measuring;
    setMeasuring(next);
    if (stateRef.current) stateRef.current.measuring = next;
  };

  return (
    <div className="model-viewer">
      <div className="model-viewer-toolbar">
        <label>Color <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <button type="button" className={measuring ? "is-active" : ""} onClick={toggleMeasure}>Measure</button>
        <button type="button" onClick={() => stateRef.current?.clearMeasurement()}>Clear measurement</button>
        <button type="button" onClick={() => stateRef.current?.fitModel()}>Reset view</button>
      </div>
      <div className="model-viewer-canvas" ref={mountRef} />
      <div className="model-viewer-status">{status || (measurement != null ? `Distance: ${measurement.toFixed(2)} model units` : measuring ? "Click two model edges to measure." : "Drag to orbit • scroll or pinch to zoom")}</div>
    </div>
  );
}
