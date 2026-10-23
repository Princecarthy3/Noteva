import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how StudyStation handles account information and study materials.",
};

const sections: InfoSection[] = [
  {
    heading: "Information you provide",
    paragraphs: [
      "StudyStation processes information you enter or upload, which may include account and profile details, courses, lecture recordings and transcripts, notes, planner entries, study-group content, and learning activity.",
    ],
  },
  {
    heading: "How information is used",
    paragraphs: [
      "Information is used to provide and maintain the features you use, protect accounts, support collaboration, and process study requests. StudyStation does not need your lecture content for features you do not use.",
    ],
  },
  {
    heading: "Service providers",
    paragraphs: [
      "The application uses Supabase for authentication, database, and storage services. When you request AI features, the relevant text or files may be sent to the AI or transcription provider configured for the service, such as OpenRouter, Groq, or Google Gemini. Those providers process data under their own terms and privacy policies.",
      "Study calls use Jitsi Meet, a third-party service that may process connection details and in-call content. StudyStation checks group membership before providing the room name, but Jitsi does not enforce that membership, and anyone who learns the room name may be able to join. Avoid sensitive discussions in study calls.",
    ],
  },
  {
    heading: "Sharing and visibility",
    paragraphs: [
      "Your personal study data is intended for your account. If you share a resource or post content in a study group, group members may access it. Do not upload information you are not permitted to share.",
    ],
  },
  {
    heading: "Retention and account controls",
    paragraphs: [
      "Information is retained as needed to provide the service and until it is deleted or the account is removed, subject to technical and legal requirements. Backups or provider records may persist for periods set by the relevant service providers.",
      "You can manage profile information in account settings. Account deletion is available in the application when the deployment has the required server configuration; deletion may not immediately remove provider backups.",
    ],
  },
  {
    heading: "Policy updates",
    paragraphs: [
      "This policy may be updated as the service and its providers change. Review it periodically, especially before using features that process or share your study materials.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      title="Privacy Policy"
      description="This page describes how StudyStation handles information when you use the application."
      sections={sections}
    />
  );
}
