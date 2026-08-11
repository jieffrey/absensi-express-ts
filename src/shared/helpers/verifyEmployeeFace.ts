import { GoogleGenAI } from "@google/genai";
import { pool } from "../../config/database";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class FaceReferenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceReferenceNotFoundError";
  }
}

export class GeminiParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "GeminiParseError";
  }
}

function stripBase64Prefix(base64: string): string {
  return base64.includes(",") ? base64.split(",")[1] : base64;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function verifyEmployeeFace(
  employeeId: string,
  capturedImage: string,
): Promise<{ match: boolean; confidence?: number; reason?: string }> {
  const referenceResult = await pool.query(
    `SELECT image_url
     FROM employee_face_references
     WHERE employee_id = $1
       AND is_active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [employeeId],
  );

  if (referenceResult.rows.length === 0) {
    throw new FaceReferenceNotFoundError(
      "This employee does not have a reference face photo yet",
    );
  }

  const referenceImageBase64 = await fetchImageAsBase64(
    referenceResult.rows[0].image_url,
  );

  const prompt = `Kamu adalah sistem verifikasi wajah untuk aplikasi absensi karyawan.
Bandingkan foto pertama (foto referensi karyawan saat registrasi) dengan foto kedua (foto selfie saat absen).
Tentukan apakah kedua foto menunjukkan orang yang sama.
Jawab HANYA dalam format JSON tanpa teks tambahan, dengan struktur persis seperti ini:
{"match": boolean, "confidence": number antara 0 dan 1, "reason": "penjelasan singkat"}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: referenceImageBase64,
            },
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: stripBase64Prefix(capturedImage),
            },
          },
        ],
      },
    ],
  });

  const rawText = response.text ?? "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  let result: { match: boolean; confidence: number; reason: string };
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new GeminiParseError("Failed to parse Gemini response", rawText);
  }

  return result;
}