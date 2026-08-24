import { Request, Response } from "express";
import cloudinary from "../../config/cloudinary";
import { pool } from "../../config/database";
import {
  verifyEmployeeFace,
  FaceReferenceNotFoundError,
  GeminiParseError,
} from "../../shared/helpers/verifyEmployeeFace";

const MAX_IMAGE_BASE64_LENGTH = 8 * 1024 * 1024; // ~6MB binary

function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export async function verifyFace(req: Request, res: Response) {
  try {
    const employeeId = req.user.sub;
    const { capturedImage } = req.body as { capturedImage: string };

    if (!capturedImage) {
      return errorResponse(res, 400, "CAPTURED_IMAGE_REQUIRED", "capturedImage is required");
    }

    if (capturedImage.length > MAX_IMAGE_BASE64_LENGTH) {
      return errorResponse(res, 413, "IMAGE_TOO_LARGE", "Image is too large. Maximum size is 6MB.");
    }

    let result: { match: boolean; confidence?: number; reason?: string };
    try {
      result = await verifyEmployeeFace(employeeId, capturedImage);
    } catch (error) {
      if (error instanceof FaceReferenceNotFoundError) {
        return errorResponse(res, 404, "FACE_REFERENCE_NOT_FOUND", error.message);
      }
      if (error instanceof GeminiParseError) {
        return res.status(502).json({
          success: false,
          error: {
            code: "FACE_VERIFICATION_PARSE_ERROR",
            message: error.message,
            raw: error.raw,
          },
        });
      }
      throw error;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("[verifyFace] Error:", error);
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again later.");
  }
}

export async function registerFaceReference(req: Request, res: Response) {
  const client = await pool.connect();
  let previousPublicId: string | null = null;
  try {
    const requestedId =
      typeof req.body?.employeeId === "string" ? req.body.employeeId.trim() : "";
    const image = typeof req.body?.image === "string" ? req.body.image : "";

    if (!requestedId || !image) {
      return errorResponse(res, 400, "EMPLOYEE_ID_AND_IMAGE_REQUIRED", "employeeId and image are required");
    }
    if (image.length > MAX_IMAGE_BASE64_LENGTH) {
      return errorResponse(res, 413, "IMAGE_TOO_LARGE", "Image is too large. Maximum size is 6MB.");
    }

    const isSelf = requestedId === req.user.sub;
    const isAdmin = req.user.role === "admin";
    if (!isSelf && !isAdmin) {
      return errorResponse(res, 403, "FORBIDDEN", "You can only register your own face reference");
    }

    const targetResult = await client.query(
      `SELECT id FROM employees WHERE id = $1 AND company_id = $2`,
      [requestedId, req.user.companyId],
    );
    if (targetResult.rows.length === 0) {
      return errorResponse(res, 404, "EMPLOYEE_NOT_FOUND", "Employee not found in your company");
    }

    const oldRefResult = await client.query(
      `SELECT cloudinary_public_id FROM employee_face_references WHERE employee_id = $1 AND is_active = true LIMIT 1`,
      [requestedId],
    );
    previousPublicId = oldRefResult.rows[0]?.cloudinary_public_id ?? null;

    const dataUri = image.includes(",")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "sams/face-references",
    });

    await client.query("BEGIN");

    await client.query(
      `UPDATE employee_face_references SET is_active = false WHERE employee_id = $1 AND is_active = true`,
      [requestedId],
    );

    const insertResult = await client.query(
      `INSERT INTO employee_face_references (employee_id, image_url, cloudinary_public_id, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, image_url, created_at`,
      [requestedId, uploadResult.secure_url, uploadResult.public_id],
    );

    await client.query("COMMIT");

    if (previousPublicId) {
      cloudinary.uploader
        .destroy(previousPublicId)
        .catch((err) =>
          console.warn("[registerFaceReference] Failed to remove old reference asset:", err?.message ?? err),
        );
    }

    return res.status(201).json({ success: true, data: insertResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[registerFaceReference] Error:", error);
    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", "Something went wrong. Please try again later.");
  } finally {
    client.release();
  }
}
