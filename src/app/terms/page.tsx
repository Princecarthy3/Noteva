import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using StudyStation.",
};

const sections: InfoSection[] = [
  {
    heading: "Using StudyStation",
    paragraphs: [
      "By using StudyStation, you agree to use the service lawfully and to follow these terms. You are responsible for activity under your account and for keeping your sign-in details secure.",
      "You must have the rights and permissions needed to upload, record, process, or share any material you provide. Do not use the service to violate another person’s privacy or intellectual property rights.",
    ],
  },
  {
    heading: "Your content and sharing",
    paragraphs: [
      "You retain responsibility for your content. You authorize StudyStation to process it as needed to provide the features you request, such as transcription, AI study generation, storage, and group sharing.",
      "Content shared with a study group may be seen by group members. Check the audience and membership before sharing.",
    ],
  },
  {
    heading: "AI and educational use",
    paragraphs: [
      "AI-generated notes, explanations, transcripts, and practice materials may contain errors, omissions, or bias. They are study aids, not authoritative academic, professional, or institutional advice. Verify important information against course materials and qualified sources.",
      "StudyStation does not guarantee grades, academic outcomes, uninterrupted availability, or the accuracy of generated content.",
    ],
  },
  {
    heading: "Third-party services",
    paragraphs: [
      "Some features rely on third-party services, including AI processing and Jitsi study calls. Those providers may have their own terms and privacy practices. Study calls are a prototype and are not private rooms; anyone who obtains a room name may be able to join.",
    ],
  },
  {
    heading: "Changes and availability",
    paragraphs: [
      "Features may change, be unavailable, or be discontinued. We may update these terms as the service evolves. Continued use after updated terms are posted means you accept the revised terms.",
      "These terms explain the service at a general level and are not legal advice. Applicable consumer rights under local law remain unaffected.",
    ],
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      title="Terms of Service"
      description="Please read these terms before using StudyStation."
      sections={sections}
    />
  );
}
