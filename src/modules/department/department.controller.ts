import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function listDepartments(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM departments WHERE company_id = $1 ORDER BY name`,
    [req.user.companyId],
  );
  res.json({ success: true, data: result.rows });
}

export async function getDepartmentById(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM departments WHERE id = $1 AND company_id = $2`,
    [req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Departemen tidak ditemukan" },
      });
  }
  res.json({ success: true, data: result.rows[0] });
}

export async function createDepartment(req: Request, res: Response) {
  const { name } = req.body;
  const result = await pool.query(
    `INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING *`,
    [req.user.companyId, name],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function updateDepartment(req: Request, res: Response) {
  const { name } = req.body;
  const result = await pool.query(
    `UPDATE departments SET name = $1 WHERE id = $2 AND company_id = $3 RETURNING *`,
    [name, req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Departemen tidak ditemukan" },
      });
  }
  res.json({ success: true, data: result.rows[0] });
}

export async function deleteDepartment(req: Request, res: Response) {
  // cek dulu ada karyawan aktif di departemen ini apa nggak, biar nggak "yatim"
  const check = await pool.query(
    `SELECT id FROM employees WHERE department_id = $1 AND status = 'active' LIMIT 1`,
    [req.params.id],
  );
  if (check.rows.length > 0) {
    return res
      .status(400)
      .json({
        success: false,
        error: {
          code: "DEPARTMENT_IN_USE",
          message: "Masih ada karyawan aktif di departemen ini",
        },
      });
  }

  const result = await pool.query(
    `DELETE FROM departments WHERE id = $1 AND company_id = $2 RETURNING id`,
    [req.params.id, req.user.companyId],
  );
  if (result.rows.length === 0) {
    return res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "Departemen tidak ditemukan" },
      });
  }
  res.json({ success: true, data: { message: "Departemen dihapus" } });
}

export async function getDepartmentPolicy(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM department_policies WHERE department_id = $1 ORDER BY effective_date DESC LIMIT 1`,
    [req.params.id],
  );
  res.json({ success: true, data: result.rows[0] || null });
}

export async function updateDepartmentPolicy(req: Request, res: Response) {
  const {
    allow_overtime,
    allow_wfh,
    min_attendance_percentage,
    effective_date,
  } = req.body;
  // INSERT baris baru, bukan update — supaya histori kebijakan lama tetap ada
  const result = await pool.query(
    `INSERT INTO department_policies (department_id, allow_overtime, allow_wfh, min_attendance_percentage, effective_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      req.params.id,
      allow_overtime,
      allow_wfh,
      min_attendance_percentage,
      effective_date,
    ],
  );
  res.status(201).json({ success: true, data: result.rows[0] });
}
