import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function myMessages(req: Request, res: Response) {
  try {
    const parsed = parseInt(req.query.limit as string, 10);
    const limit = Math.min(Number.isNaN(parsed) ? 50 : Math.max(parsed, 1), 100);

    const result = await pool.query(
      `SELECT m.id, m.employee_id, m.body, m.created_at,
              e.name AS employee_name, e.image AS employee_image
       FROM (
         SELECT id, employee_id, body, created_at
         FROM messages
         WHERE company_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) m
       JOIN employees e ON e.id = m.employee_id
       ORDER BY m.created_at ASC`,
      [req.user.companyId, limit],
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[myMessages] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}
