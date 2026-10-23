import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about StudyStation.",
};

const sections: InfoSection[] = [
  {
    heading: "What file formats can I use for lecture transcription?",
    paragraphs: [
      "You can record a lecture or upload supported audio or video files for processing. Available formats and upload limits may depend on your device and the current service configuration.",
    ],
  },
  {
    heading: "How are flashcards and quizzes created?",
    paragraphs: [
      "The AI Study Lab can use your lecture material to help create summaries, explanations, flashcards, and practice quizzes. Review generated material for accuracy before relying on it.",
    ],
  },
  {
    heading: "Are my study notes and recordings private?",
    paragraphs: [
      "Personal study materials are kept in your study space. Material you share with a group may be available to that group’s members. Read the Privacy Policy and check sharing settings before uploading or sharing sensitive material.",
    ],
  },
  {
    heading: "Can I import a timetable or syllabus?",
    paragraphs: [
      "StudyStation can help parse timetable CSV files and extract schedule information from supported syllabus documents or images. Review and edit extracted events before adding them to your planner.",
    ],
  },
  {
    heading: "Can I use StudyStation on my phone?",
    paragraphs: [
      "Yes. StudyStation works in a mobile browser and can be installed on supported devices using the browser’s Add to Home Screen or Install App option.",
    ],
  },
  {
    heading: "Are study calls private?",
    paragraphs: [
      "Study calls currently use Jitsi Meet. Jitsi is a third-party service, and anyone who learns a room name may be able to join directly. Do not discuss sensitive information in these prototype calls.",
    ],
  },
];

export default function FaqPage() {
  return (
    <InfoPage
      title="Frequently asked questions"
      description="Quick answers about using StudyStation’s study tools."
      sections={sections}
    />
  );
}
