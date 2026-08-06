import type { Route } from "./+types/admin-api-opposition-upload";
import { requireAdmin } from "~/lib/session.server";

type FileKind = "pdf" | "docx" | "xlsx" | "xls" | "txt" | "unsupported";

function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (name.endsWith(".pdf") || type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || type.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".doc") || type === "application/msword") return "docx";
  if (name.endsWith(".xlsx") || type.includes("spreadsheetml")) return "xlsx";
  if (name.endsWith(".xls") || type === "application/vnd.ms-excel") return "xls";
  if (name.endsWith(".txt") || type === "text/plain") return "txt";
  return "unsupported";
}

async function extractRawText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const kind = detectKind(file);

  if (kind === "pdf") {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    return Array.isArray(result.text) ? result.text.join("\n") : String(result.text);
  }

  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }

  if (kind === "xlsx" || kind === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(Buffer.from(buffer), { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(ws, { header: 1 });
      for (const row of rows) {
        if (!row?.length) continue;
        const cols = row.map((c) => String(c ?? "").trim()).filter(Boolean);
        if (cols.length >= 2) {
          lines.push(`${cols[0]}: ${cols[1]}`);
        } else if (cols.length === 1) {
          lines.push(cols[0]);
        }
      }
    }
    return lines.join("\n");
  }

  if (kind === "txt") {
    return new TextDecoder().decode(buffer);
  }

  throw new Error("unsupported");
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const kind = detectKind(file);
  if (kind === "unsupported") {
    return Response.json(
      { error: "Unsupported file type. Please upload a PDF, Word document (.docx), Excel spreadsheet (.xlsx), or plain text file." },
      { status: 400 },
    );
  }

  try {
    const rawText = await extractRawText(file);
    return Response.json(parseOppositionText(rawText), { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "unsupported") {
      return Response.json({ error: "Unsupported file type." }, { status: 400 });
    }
    return Response.json({ error: "Failed to read the file — it may be corrupted or password protected." }, { status: 500 });
  }
}

function parseOppositionText(rawText: string) {
  const allLines = rawText.split("\n").map((l) => l.trim());

  let coloursStart = -1;
  let historyStart = -1;
  let managementStart = -1;
  let squadStart = -1;

  for (let i = 0; i < allLines.length; i++) {
    const lc = allLines[i].toLowerCase().replace(/:$/, "").trim();
    if (lc === "club colours" || lc === "club colors") coloursStart = i;
    else if (lc === "club history") historyStart = i;
    else if (lc === "management team") managementStart = i;
    else if (lc === "squad list") squadStart = i;
  }

  function getSection(start: number, ...ends: number[]): string[] {
    if (start < 0) return [];
    const validEnds = ends.filter((e) => e > start);
    const end = validEnds.length ? Math.min(...validEnds) : allLines.length;
    return allLines.slice(start + 1, end);
  }

  const colourLines = getSection(coloursStart, historyStart, managementStart, squadStart).filter(Boolean);
  const historyLines = getSection(historyStart, managementStart, squadStart);
  const managementLines = getSection(managementStart, squadStart).filter(Boolean);
  const squadLines = getSection(squadStart).filter(Boolean);

  // Profile: colours + history
  const profileParts: string[] = [];
  if (colourLines.length) profileParts.push(colourLines.join("\n"));
  if (historyLines.length) {
    const paragraphs: string[] = [];
    let current: string[] = [];
    for (const line of historyLines) {
      if (line === "") {
        if (current.length) { paragraphs.push(current.join(" ")); current = []; }
      } else {
        current.push(line);
      }
    }
    if (current.length) paragraphs.push(current.join(" "));
    if (paragraphs.length) profileParts.push(paragraphs.join("\n\n"));
  }

  // Management: "Bill Gill: Manager" → "Manager: Bill Gill" (Role: Name)
  const managementOut = managementLines
    .filter((l) => l.includes(":"))
    .map((l) => {
      const idx = l.indexOf(":");
      const name = l.slice(0, idx).trim();
      const role = l.slice(idx + 1).trim();
      return `${role}: ${name}`;
    })
    .join("\n");

  // Squad: "Taylor Adams: Central Midfielder" → "Taylor Adams" (name only)
  const squadOut = squadLines
    .map((l) => {
      const idx = l.indexOf(":");
      return idx >= 0 ? l.slice(0, idx).trim() : l;
    })
    .filter(Boolean)
    .join("\n");

  // If no sections were recognised, return the raw text for the profile
  const profile = profileParts.join("\n\n") || rawText.trim().slice(0, 2000);

  return { profile, management: managementOut, squad: squadOut };
}
