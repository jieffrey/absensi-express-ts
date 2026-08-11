import { Request, Response } from "express";
import cloudinary from "../../config/cloudinary";
import { pool } from "../../config/database";
import {
  verifyEmployeeFace,
  FaceReferenceNotFoundError,
  GeminiParseError,
} from "../../shared/helpers/verifyEmployeeFace";

interface RegisterFaceBody {
  employeeId: string; // UUID
  image: string; // base64
}

export async function verifyFace(req: Request, res: Response) {
  try {
    const employeeId = req.user.sub;
    const { capturedImage } = req.body as { capturedImage: string };

    if (!capturedImage) {
      return res.status(400).json({
        success: false,
        error: {
          code: "CAPTURED_IMAGE_REQUIRED",
          message: "capturedImage is required",
        },
      });
    }

    let result: { match: boolean; confidence?: number; reason?: string };
    try {
      result = await verifyEmployeeFace(employeeId, capturedImage);
    } catch (error) {
      if (error instanceof FaceReferenceNotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: "FACE_REFERENCE_NOT_FOUND",
            message: error.message,
          },
        });
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
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function registerFaceReference(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    const { employeeId, image } = req.body as RegisterFaceBody;

    if (!employeeId || !image) {
      return res
        .status(400)
        .json({ message: "employeeId and image are required" });
    }

    const dataUri = image.includes(",")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "sams/face-references",
    });

    await client.query("BEGIN");

    await client.query(
      `UPDATE employee_face_references SET is_active = false WHERE employee_id = $1 AND is_active = true`,
      [employeeId],
    );

    const insertResult = await client.query(
      `INSERT INTO employee_face_references (employee_id, image_url, cloudinary_public_id, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, image_url, created_at`,
      [employeeId, uploadResult.secure_url, uploadResult.public_id],
    );

    await client.query("COMMIT");

    return res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[registerFaceReference] Error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  } finally {
    client.release();
  }
}
