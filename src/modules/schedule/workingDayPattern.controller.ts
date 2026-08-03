import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function listWorkingDayPatterns(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM working_day_patterns WHERE company_id = $1 ORDER BY name`,
    [req.user.companyId],
  );
  res.json({ success: true, data: result.rows });
}

export async function createWorkingDayPattern(req: Request, res: Response) {
  const { name, active_days } = req.body; // active_days: number[] e.g. [1,2,3,4,5]
  const result = await pool.query(
    `INSERT INTO working_day_patterns (company_id, name, active_days) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.companyId, name, active_days],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function updateWorkingDayPattern(req: Request, res: Response) {
  const { name, active_days } = req.body;
  const result = await pool.query(
    `UPDATE working_day_patterns SET name = COALESCE($1, name), active_days = COALESCE($2, active_days)
     WHERE id = $3 AND company_id = $4 RETURNING *`,
    [name, active_days, req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0)
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Pola tidak ditemukan" },
      });
  res.json({ success: true, data: result.rows[0] });
}
