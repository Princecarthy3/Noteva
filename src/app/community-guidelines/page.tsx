import type { Metadata } from "next";
import { InfoPage, type InfoSection } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "Guidelines for respectful and safe StudyStation group collaboration.",
};

const sections: InfoSection[] = [
  {
    heading: "Learn together respectfully",
    paragraphs: [
      "Study groups work best when members can ask questions, share ideas, and disagree without being demeaned. Treat other students with respect.",
    ],
    bullets: [
      "Do not harass, threaten, bully, or discriminate against other members.",
      "Keep discussion relevant and constructive; do not spam or deliberately disrupt a group.",
      "Respect different backgrounds, viewpoints, and levels of experience.",
    ],
  },
  {
    heading: "Respect privacy and consent",
    paragraphs: [
      "Do not share another person’s personal information, messages, recordings, or work without permission. Do not record or redistribute study calls without everyone’s consent.",
      "Only upload or share lectures, documents, and other materials when you have permission to do so. Respect copyright and your institution’s rules.",
    ],
  },
  {
    heading: "Keep academic work honest",
    paragraphs: [
      "Use StudyStation and AI-generated study aids to support your own learning. Follow your institution’s academic-integrity rules, and do not present another person’s work or AI-generated output as your own where that is prohibited.",
    ],
  },
  {
    heading: "When a guideline is broken",
    paragraphs: [
      "Group owners and moderators may set additional rules for their groups. If a group no longer feels appropriate, stop participating and use available account or group controls. Serious or repeated misuse may result in access restrictions where the service supports them.",
    ],
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <InfoPage
      title="Community Guidelines"
      description="Help make StudyStation a respectful, useful place for students to learn together."
      sections={sections}
    />
  );
}
