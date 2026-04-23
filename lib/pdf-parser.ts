type ParsedRecordResult = {
  category: string;
  extractedText: string;
  extractionStatus: string;
};

function hasEnoughExtractedText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length >= 40 && normalized.split(" ").length >= 8;
}

function formatPageCount(pageCount: number) {
  return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
}

export async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return {
    text: pages.join("\n\n"),
    pageCount: pdf.numPages
  };
}

async function createOcrWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng");
}

async function extractImageTextWithOcr(file: File) {
  const worker = await createOcrWorker();

  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\s+\n/g, "\n").trim();
  } finally {
    await worker.terminate();
  }
}

async function renderPdfPageToCanvas(page: any) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas rendering is unavailable in this browser.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport } as any).promise;
  return canvas;
}

async function extractPdfTextWithOcr(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const worker = await createOcrWorker();
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const canvas = await renderPdfPageToCanvas(page);
      const result = await worker.recognize(canvas);
      const text = result.data.text.replace(/\s+\n/g, "\n").trim();

      if (text) {
        pages.push(text);
      }
    }
  } finally {
    await worker.terminate();
  }

  return {
    text: pages.join("\n\n"),
    pageCount: pdf.numPages
  };
}

export async function parseRecordFile(file: File): Promise<ParsedRecordResult> {
  const isPdf = file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (isPdf) {
    try {
      const parsed = await extractPdfText(file);

      if (hasEnoughExtractedText(parsed.text)) {
        return {
          category: "PDF record",
          extractedText: parsed.text,
          extractionStatus: `Parsed ${formatPageCount(parsed.pageCount)} with embedded PDF text`
        };
      }

      const ocr = await extractPdfTextWithOcr(file);

      if (hasEnoughExtractedText(ocr.text)) {
        return {
          category: "Scanned PDF record",
          extractedText: ocr.text,
          extractionStatus: `OCR extracted text from ${formatPageCount(ocr.pageCount)}`
        };
      }
    } catch {
      try {
        const ocr = await extractPdfTextWithOcr(file);

        if (hasEnoughExtractedText(ocr.text)) {
          return {
            category: "Scanned PDF record",
            extractedText: ocr.text,
            extractionStatus: `OCR extracted text from ${formatPageCount(ocr.pageCount)}`
          };
        }
      } catch {
        return {
          category: "PDF record",
          extractedText: "",
          extractionStatus: "PDF parsing and OCR were unsuccessful for this file"
        };
      }
    }

    return {
      category: "PDF record",
      extractedText: "",
      extractionStatus: "No readable text was found in this PDF"
    };
  }

  if (isImage) {
    try {
      const text = await extractImageTextWithOcr(file);

      if (hasEnoughExtractedText(text)) {
        return {
          category: "Image record",
          extractedText: text,
          extractionStatus: "OCR extracted text from the uploaded image"
        };
      }
    } catch {
      return {
        category: "Image record",
        extractedText: "",
        extractionStatus: "Image OCR was unsuccessful for this file"
      };
    }

    return {
      category: "Image record",
      extractedText: "",
      extractionStatus: "No readable text was found in this image"
    };
  }

  return {
    category: "Uploaded file",
    extractedText: "",
    extractionStatus: "Text extraction is currently available for PDFs and images"
  };
}
