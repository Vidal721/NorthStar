import HelperPage from "./helper";
import UpdateModal from '../componets/UpdateModal';
import appInfo from './info.json';

// Mentors share the helper workspace, including the shared Drive.
export default function MentorPage({ roleLabel = "Mentor" }) {
  return <HelperPage roleLabel={roleLabel} />;
}
