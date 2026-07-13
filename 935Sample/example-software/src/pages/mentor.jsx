import HelperPage from "./helper";

// Mentors share the helper workspace, including the shared Drive.
export default function MentorPage({ roleLabel = "Mentor" }) {
  return <HelperPage roleLabel={roleLabel} />;
}
