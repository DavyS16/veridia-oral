import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";

    if (name.endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      text = (await pdfParse(buffer)).text;
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Unsupported file type. Upload PDF, DOCX, or TXT." }, { status: 400 });
    }

    text = text.replace(/\n{3,}/g, "\n\n").trim();
    return NextResponse.json({ text, wordCount: text.split(/\s+/).filter(Boolean).length, fileName: file.name });
  } catch (err) {
    return NextResponse.json({ error: "Failed to extract text" }, { status: 500 });
  }
}
