import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function listHolidays(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM holidays WHERE company_id = $1 ORDER BY date`,
    [req.user.companyId],
  );
  res.json({ success: true, data: result.rows });
}

export async function createHoliday(req: Request, res: Response) {
  const { date, name } = req.body;
  const result = await pool.query(
    `INSERT INTO holidays (company_id, date, name) VALUES ($1, $2, $3) RETURNING *`,
    [req.user.companyId, date, name],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function deleteHoliday(req: Request, res: Response) {
  const result = await pool.query(
    `DELETE FROM holidays WHERE id = $1 AND company_id = $2 RETURNING id`,
    [req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Hari libur tidak ditemukan" },
      });
  }
  res.json({ success: true, data: { message: "Hari libur dihapus" } });
}

export async function listCalendarEvents(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM calendar_events WHERE company_id = $1 ORDER BY event_date`,
    [req.user.companyId],
  );
  res.json({ success: true, data: result.rows });
}

export async function createCalendarEvent(req: Request, res: Response) {
  const { title, description, event_date } = req.body;
  const result = await pool.query(
    `INSERT INTO calendar_events (company_id, title, description, event_date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user.companyId, title, description, event_date, req.user.sub],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function updateCalendarEvent(req: Request, res: Response) {
  const { title, description, event_date } = req.body;
  const result = await pool.query(
    `UPDATE calendar_events SET title = COALESCE($1, title), description = COALESCE($2, description),
     event_date = COALESCE($3, event_date) WHERE id = $4 AND company_id = $5 RETURNING *`,
    [title, description, event_date, req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Event tidak ditemukan" },
      });
  }
  res.json({ success: true, data: result.rows[0] });
}

export async function deleteCalendarEvent(req: Request, res: Response) {
  const result = await pool.query(
    `DELETE FROM calendar_events WHERE id = $1 AND company_id = $2 RETURNING id`,
    [req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Event tidak ditemukan" },
      });
  }
  res.json({ success: true, data: { message: "Event dihapus" } });
}
