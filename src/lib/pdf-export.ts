import { jsPDF } from "jspdf";
import type { OrganizedNoteData } from "@/components/stage6-workspace";

/**
 * Generates an executive, beautifully formatted study guide PDF
 * from an OrganizedNoteData structure and triggers an instant download.
 */
export function exportNoteToPdf(
  note: OrganizedNoteData,
  lectureTitle: string,
  courseName?: string
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 16;
  const marginRight = 16;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const bottomMargin = 20;

  let y = 18;

  function checkBreak(needed: number) {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = 18;
    }
  }

  // 1. Accent Top Stripe
  doc.setFillColor(114, 89, 232); // Primary Brand Purple #7259e8
  doc.rect(0, 0, pageWidth, 5, "F");

  // 2. Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(114, 89, 232);
  doc.text("StudyStation · AI STUDY COMPANION", marginLeft, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(23, 19, 45); // #17132d
  const titleLines = doc.splitTextToSize(lectureTitle, contentWidth);
  doc.text(titleLines, marginLeft, y);
  y += titleLines.length * 7 + 2;

  // Metadata sub-line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 114, 133);
  const courseLabel = courseName ? `Course: ${courseName}  |  ` : "";
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  doc.text(`${courseLabel}Generated: ${dateStr}`, marginLeft, y);
  y += 5;

  // Divider Line
  doc.setDrawColor(230, 226, 238);
  doc.setLineWidth(0.4);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 7;

  // 3. Executive Summary Box
  checkBreak(35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(114, 89, 232);
  doc.text("EXECUTIVE SUMMARY", marginLeft, y);
  y += 5;

  const summaryLines = doc.splitTextToSize(note.summary || "Summary not available.", contentWidth - 8);
  const summaryBoxHeight = summaryLines.length * 4.5 + 8;

  doc.setFillColor(248, 246, 255); // Soft lavender fill
  doc.setDrawColor(218, 210, 245);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y, contentWidth, summaryBoxHeight, 2, 2, "FD");

  // Accent left border
  doc.setFillColor(114, 89, 232);
  doc.rect(marginLeft, y, 1.8, summaryBoxHeight, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(45, 40, 58);
  doc.text(summaryLines, marginLeft + 5, y + 5.5);
  y += summaryBoxHeight + 8;

  // 4. Key Terms & Definitions
  if (note.content?.keyTerms && note.content.keyTerms.length > 0) {
    checkBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 19, 45);
    doc.text("KEY CONCEPTS & DEFINITIONS", marginLeft, y);
    y += 5;

    for (const item of note.content.keyTerms) {
      const termTitle = item.term;
      const termDef = item.definition;
      const defLines = doc.splitTextToSize(`${termTitle}: ${termDef}`, contentWidth - 6);
      const itemHeight = defLines.length * 4.5 + 3;

      checkBreak(itemHeight);

      // Bullet dot
      doc.setFillColor(114, 89, 232);
      doc.circle(marginLeft + 2, y - 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(23, 19, 45);
      doc.text(termTitle + ": ", marginLeft + 6, y);

      const titleWidth = doc.getTextWidth(termTitle + ": ");
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 55, 75);

      // Print full line wrapped
      const fullLines = doc.splitTextToSize(termDef, contentWidth - 6 - titleWidth);
      if (fullLines.length === 1) {
        doc.text(termDef, marginLeft + 6 + titleWidth, y);
        y += 5;
      } else {
        // Multi-line definition
        const allLines = doc.splitTextToSize(termDef, contentWidth - 6);
        y += 4;
        doc.text(allLines, marginLeft + 6, y);
        y += allLines.length * 4.5 + 1;
      }
    }
    y += 4;
  }

  // 5. Organized Topic Sections
  if (note.content?.sections && note.content.sections.length > 0) {
    checkBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 19, 45);
    doc.text("STRUCTURED TOPIC BREAKDOWN", marginLeft, y);
    y += 6;

    let sectionIndex = 1;
    for (const section of note.content.sections) {
      checkBreak(20);

      // Section Header with small pill background
      doc.setFillColor(242, 239, 252);
      doc.roundedRect(marginLeft, y - 4, contentWidth, 7, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(98, 71, 222);
      doc.text(`${sectionIndex}. ${section.heading}`, marginLeft + 3, y + 1);
      y += 8;

      // Body paragraph
      if (section.body) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.8);
        doc.setTextColor(55, 50, 68);
        const bodyLines = doc.splitTextToSize(section.body, contentWidth - 2);
        checkBreak(bodyLines.length * 4.2);
        doc.text(bodyLines, marginLeft + 2, y);
        y += bodyLines.length * 4.2 + 3;
      }

      // Section Bullets
      if (section.bullets && section.bullets.length > 0) {
        for (const bullet of section.bullets) {
          const bulletLines = doc.splitTextToSize(bullet, contentWidth - 8);
          checkBreak(bulletLines.length * 4.2 + 2);

          doc.setFillColor(114, 89, 232);
          doc.circle(marginLeft + 3, y - 0.8, 0.8, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(60, 55, 75);
          doc.text(bulletLines, marginLeft + 7, y);
          y += bulletLines.length * 4.2 + 1.5;
        }
        y += 2;
      }

      // Section Takeaways
      if (section.takeaways && section.takeaways.length > 0) {
        for (const t of section.takeaways) {
          const tLines = doc.splitTextToSize(`Takeaway: ${t}`, contentWidth - 8);
          checkBreak(tLines.length * 4.2 + 2);

          doc.setFont("helvetica", "italic");
          doc.setFontSize(8.2);
          doc.setTextColor(114, 89, 232);
          doc.text(tLines, marginLeft + 5, y);
          y += tLines.length * 4.2 + 1.5;
        }
      }

      y += 4;
      sectionIndex++;
    }
    y += 3;
  }

  // 6. High-Yield Exam Takeaways
  if (note.content?.takeaways && note.content.takeaways.length > 0) {
    checkBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 19, 45);
    doc.text("EXAM & REVISION TAKEAWAYS", marginLeft, y);
    y += 6;

    for (const takeaway of note.content.takeaways) {
      const tLines = doc.splitTextToSize(takeaway, contentWidth - 8);
      checkBreak(tLines.length * 4.2 + 2);

      // Checkmark icon placeholder (bullet)
      doc.setFillColor(16, 185, 129); // Green accent
      doc.circle(marginLeft + 3, y - 0.8, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(30, 27, 42);
      doc.text(tLines, marginLeft + 7, y);
      y += tLines.length * 4.2 + 2;
    }
    y += 5;
  }

  // 7. Active Recall Practice Questions & Answers
  if (note.content?.studyQuestions && note.content.studyQuestions.length > 0) {
    checkBreak(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(23, 19, 45);
    doc.text("ACTIVE RECALL TEST QUESTIONS", marginLeft, y);
    y += 6;

    let qIndex = 1;
    for (const sq of note.content.studyQuestions) {
      const qLines = doc.splitTextToSize(`Q${qIndex}: ${sq.question}`, contentWidth - 4);
      const aLines = sq.answer ? doc.splitTextToSize(`Answer: ${sq.answer}`, contentWidth - 8) : [];
      const totalBlock = qLines.length * 4.5 + aLines.length * 4 + 4;

      checkBreak(totalBlock);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(23, 19, 45);
      doc.text(qLines, marginLeft + 2, y);
      y += qLines.length * 4.5;

      if (sq.answer) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.2);
        doc.setTextColor(90, 85, 105);
        doc.text(aLines, marginLeft + 6, y);
        y += aLines.length * 4 + 2;
      }
      y += 2;
      qIndex++;
    }
  }

  // 8. Add Running Footers to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 135, 150);

    // Footer divider line
    doc.setDrawColor(235, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);

    // Left footer text
    const cleanTitle = lectureTitle.length > 40 ? `${lectureTitle.slice(0, 38)}…` : lectureTitle;
    doc.text(`StudyStation Study Assistant  ·  ${cleanTitle}`, marginLeft, pageHeight - 7);

    // Right footer text (Page X of Y)
    const pageText = `Page ${i} of ${totalPages}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - marginRight - pageTextWidth, pageHeight - 7);
  }

  // Trigger browser download
  const safeFilename = lectureTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`${safeFilename || "lecture"}-study-guide.pdf`);
}
