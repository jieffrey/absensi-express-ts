import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function getEmployeeSchedule(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT es.*, s.name as shift_name, s.start_time, s.end_time, l.name as location_name
     FROM employee_schedules es
     JOIN shifts s ON es.shift_id = s.id
     JOIN office_locations l ON es.location_id = l.id
     WHERE es.employee_id = $1 AND (es.end_date IS NULL OR es.end_date >= CURRENT_DATE)
     ORDER BY es.start_date DESC LIMIT 1`,
    [req.params.employeeId],
  );
  res.json({ success: true, data: result.rows[0] || null });
}

export async function assignSchedule(req: Request, res: Response) {
  const {
    employee_id,
    shift_id,
    working_day_pattern_id,
    location_id,
    start_date,
  } = req.body;
  const result = await pool.query(
    `INSERT INTO employee_schedules (employee_id, shift_id, working_day_pattern_id, location_id, start_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [employee_id, shift_id, working_day_pattern_id, location_id, start_date],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function endSchedule(req: Request, res: Response) {
  const { end_date } = req.body;
  const result = await pool.query(
    `UPDATE employee_schedules SET end_date = $1 WHERE id = $2 RETURNING *`,
    [end_date, req.params.id],
  );
  if (result.rows.length === 0)
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Schedule not found" },
      });
  res.json({ success: true, data: result.rows[0] });
}
