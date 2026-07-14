import HelperPage from "./helper";
import UpdateModal from '../componets/UpdateModal';
import appInfo from './info.json';

// Coaches have their own workspace, including forms, Drive controls, and leader appointments.
export default function CoachPage() {
  return <HelperPage roleLabel="Coach" />;
}
