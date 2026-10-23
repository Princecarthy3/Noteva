import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about StudyStation and how it helps students organize their learning.",
};

const sections: InfoSection[] = [
  {
    heading: "A more connected study routine",
    paragraphs: [
      "StudyStation is a learning workspace for students who want their lectures, notes, revision, planning, and group study in one place.",
      "The goal is to help you move from class materials to organized notes and active practice, while keeping your study routine in your own hands.",
    ],
  },
  {
    heading: "Built around your learning",
    paragraphs: [
      "Use StudyStation to capture or upload lectures, organize courses and notes, create revision materials, plan study time, and collaborate with classmates.",
      "AI-generated study materials are intended to support your learning. Review them against your course materials and your instructor’s guidance.",
    ],
  },
  {
    heading: "Your study space",
    paragraphs: [
      "Keep personal materials in your account and share only what you choose to share with a study group. Check group membership and sharing settings before adding material.",
    ],
  },
];

export default function AboutPage() {
  return (
    <InfoPage
      title="About StudyStation"
      description="A focused study workspace that helps turn lectures and coursework into a more organized learning routine."
      sections={sections}
    />
  );
}
