import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Features",
  description: "Explore StudyStation’s lecture, revision, planning, and group study tools.",
};

const sections: InfoSection[] = [
  {
    heading: "Lecture Studio",
    paragraphs: [
      "Record or upload lecture media and organize the resulting transcripts and notes with your course materials.",
    ],
  },
  {
    heading: "Notes and revision",
    paragraphs: [
      "Review organized lecture notes, create flashcards, and practice with quizzes based on your study material.",
    ],
  },
  {
    heading: "AI Study Lab and tutor",
    paragraphs: [
      "Use AI tools to help explain course material and generate study aids. AI output can be incomplete or inaccurate, so verify important details using trusted course sources.",
    ],
  },
  {
    heading: "Planner and progress",
    paragraphs: [
      "Organize study sessions and review upcoming tasks with a study planner and calendar.",
    ],
  },
  {
    heading: "Study groups",
    paragraphs: [
      "Create or join groups to share selected resources and study with classmates. Study calls currently use a third-party Jitsi service; they are not private rooms, and anyone who learns a room name may be able to join.",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <InfoPage
      title="Study tools for the whole semester"
      description="StudyStation brings lecture capture, revision, planning, and collaboration tools into one workspace."
      sections={sections}
    />
  );
}
