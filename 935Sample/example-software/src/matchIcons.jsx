// ============================================================
//  MATCH SCOUTING ICON REGISTRY
// ============================================================
// Single source of truth mapping a plain string key (stored in the
// match config JSON) to a Font Awesome icon. Both the scouting page
// (match.jsx) and the admin builder (matchBuilder.jsx) import this
// file, so adding a new icon here makes it available in both places
// automatically — no other code needs to change.
// ============================================================
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHandFist,
  faCrosshairs,
  faCircleCheck,
  faBolt,
  faXmark,
  faTriangleExclamation,
  faCircle,
  faShield,
  faMinus,
  faRocket,
  faBomb,
  faHandPointRight,
  faArrowTurnUp,
  faStar,
  faFlag,
  faGear,
  faPlus,
  faArrowUp,
  faArrowDown,
  faClock,
  faFire,
  faTrophy,
  faThumbsUp,
  faThumbsDown,
  faBan,
  faCheck,
  faArrowRightArrowLeft,
  faLocationDot,
  faPersonRunning,
  faBullseye,
  faHandshake,
  faQuestion,
  faBatteryFull,
  faWrench,
  faExplosion,
} from "@fortawesome/free-solid-svg-icons";

export const ICON_MAP = {
  handFist: faHandFist,
  crosshairs: faCrosshairs,
  circleCheck: faCircleCheck,
  bolt: faBolt,
  xmark: faXmark,
  triangleExclamation: faTriangleExclamation,
  circle: faCircle,
  shield: faShield,
  minus: faMinus,
  rocket: faRocket,
  bomb: faBomb,
  handPointRight: faHandPointRight,
  arrowTurnUp: faArrowTurnUp,
  star: faStar,
  flag: faFlag,
  gear: faGear,
  plus: faPlus,
  arrowUp: faArrowUp,
  arrowDown: faArrowDown,
  clock: faClock,
  fire: faFire,
  trophy: faTrophy,
  thumbsUp: faThumbsUp,
  thumbsDown: faThumbsDown,
  ban: faBan,
  check: faCheck,
  exchange: faArrowRightArrowLeft,
  locationDot: faLocationDot,
  personRunning: faPersonRunning,
  bullseye: faBullseye,
  handshake: faHandshake,
  question: faQuestion,
  batteryFull: faBatteryFull,
  wrench: faWrench,
  explosion: faExplosion,
};

// Friendly labels for the builder's icon picker.
export const ICON_OPTIONS = Object.keys(ICON_MAP).map((key) => ({
  key,
  label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
}));

// Resolve a stored icon key to a rendered <FontAwesomeIcon>. Falls back to
// a generic "?" icon so a bad/missing key never crashes the scouting page.
export function resolveIcon(key) {
  return <FontAwesomeIcon icon={ICON_MAP[key] || faQuestion} />;
}
