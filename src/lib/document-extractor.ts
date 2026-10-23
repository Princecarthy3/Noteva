import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ExtractedDocument = {
  text: string;
  wordCount: number;
  pageCount?: number;
  format: "pdf" | "docx" | "doc" | "pptx" | "ppt" | "text";
};

/**
 * Extracts plain text from an uploaded PDF file using pdfjs-dist.
 */
async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings: string[] = [];

    for (const item of content.items) {
      if ("str" in item && typeof item.str === "string") {
        strings.push(item.str);
      }
    }

    const pageText = strings.join(" ").trim();
    if (pageText) {
      pageTexts.push(`--- Page ${pageNum} ---\n${pageText}`);
    }
  }

  return {
    text: pageTexts.join("\n\n").trim(),
    pageCount: pdf.numPages,
  };
}

/**
 * Extracts plain text from an uploaded Word document (.docx).
 */
async function extractDocxText(buffer: Buffer): Promise<{ text: string }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: (result.value || "").trim() };
  } catch (err) {
    // If mammoth fails or it's an older/different binary format, try fallback text extraction
    const raw = buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    const cleaned = raw.replace(/\s{2,}/g, " ").trim();
    if (cleaned.length > 50) {
      return { text: cleaned };
    }
    throw new Error(`Word document could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extracts text from an uploaded PowerPoint presentation (.pptx)
 * by inspecting slide XML entries in the OpenXML package.
 */
function extractPptxText(buffer: Buffer): { text: string; slideCount: number } {
  try {
    const cfb = XLSX.CFB.read(buffer, { type: "buffer" });
    if (!cfb || !cfb.FileIndex) {
      throw new Error("Invalid presentation format");
    }

    // Find all slide files: ppt/slides/slide1.xml, slide2.xml, etc.
    const slideEntries: { name: string; num: number; content: string }[] = [];

    for (const file of cfb.FileIndex) {
      const name = file.name || "";
      const match = name.match(/ppt\/slides\/slide(\d+)\.xml$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        let rawContent = "";
        if (file.content) {
          rawContent = Buffer.from(file.content).toString("utf8");
        }
        slideEntries.push({ name, num, content: rawContent });
      }
    }

    // Sort slides in presentation order
    slideEntries.sort((a, b) => a.num - b.num);

    const slides: string[] = [];

    for (const slide of slideEntries) {
      // Extract text content inside <a:t>...</a:t> XML tags
      const textMatches = slide.content.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi);
      const textParts: string[] = [];
      for (const m of textMatches) {
        if (m[1]) {
          // Decode basic XML entities
          const decoded = m[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
          if (decoded) textParts.push(decoded);
        }
      }

      if (textParts.length > 0) {
        slides.push(`--- Slide ${slide.num} ---\n${textParts.join(" ")}`);
      }
    }

    if (slides.length > 0) {
      return {
        text: slides.join("\n\n").trim(),
        slideCount: slides.length,
      };
    }

    // Fallback if slide structure differed: extract all <a:t> or <w:t> tags across all XMLs
    const allXmlText: string[] = [];
    for (const file of cfb.FileIndex) {
      if (file.name?.endsWith(".xml") && file.content) {
        const str = Buffer.from(file.content).toString("utf8");
        const matches = str.matchAll(/<[aw]:t[^>]*>([\s\S]*?)<\/[aw]:t>/gi);
        for (const m of matches) {
          if (m[1]) allXmlText.push(m[1].trim());
        }
      }
    }

    return {
      text: allXmlText.join(" ").trim(),
      slideCount: slideEntries.length || 1,
    };
  } catch (err) {
    throw new Error(`PowerPoint file could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extracts text from plain text or markdown files.
 */
function extractPlainText(buffer: Buffer): { text: string } {
  // Strip UTF-8 BOM if present
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  return { text: text.trim() };
}

/**
 * Master document extraction function.
 * Accepts any supported document buffer and returns clean structured text.
 */
export async function extractDocumentText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ExtractedDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  let text = "";
  let pageCount: number | undefined;
  let format: ExtractedDocument["format"] = "text";

  if (ext === "pdf" || mimeType === "application/pdf") {
    format = "pdf";
    const res = await extractPdfText(buffer);
    text = res.text;
    pageCount = res.pageCount;
  } else if (ext === "docx" || ext === "doc" || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
    format = ext === "doc" ? "doc" : "docx";
    const res = await extractDocxText(buffer);
    text = res.text;
  } else if (ext === "pptx" || ext === "ppt" || mimeType?.includes("presentationml") || mimeType?.includes("powerpoint")) {
    format = ext === "ppt" ? "ppt" : "pptx";
    const res = extractPptxText(buffer);
    text = res.text;
    pageCount = res.slideCount;
  } else if (["txt", "text", "md", "markdown", "rtf"].includes(ext) || mimeType?.startsWith("text/")) {
    format = "text";
    const res = extractPlainText(buffer);
    text = res.text;
  } else {
    // Attempt plain text as a last resort
    const res = extractPlainText(buffer);
    text = res.text;
  }

  if (!text || text.length < 5) {
    throw new Error(
      `No readable text could be extracted from "${fileName}". Make sure the file is not empty or password-protected.`
    );
  }

  // Calculate approximate word count
  const words = text.split(/\s+/).filter(Boolean);

  return {
    text,
    wordCount: words.length,
    pageCount,
    format,
  };
}
