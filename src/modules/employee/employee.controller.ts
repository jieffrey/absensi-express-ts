import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../../config/database";

export async function listEmployees(req: Request, res: Response) {
  const { department_id, status, search } = req.query;

  let sql = `SELECT e.id, e.name, e.email, e.status, r.name as role_name, e.department_id, e.position_id
             FROM employees e JOIN roles r ON e.role_id = r.id
             WHERE e.company_id = $1`;
  const params: any[] = [req.user.companyId];

  if (department_id) {
    params.push(department_id);
    sql += ` AND e.department_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND e.status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND e.name ILIKE $${params.length}`;
  }

  const result = await pool.query(sql, params);
  res.json({ success: true, data: result.rows });
}

export async function createEmployee(req: Request, res: Response) {
  const {
    name,
    email,
    password,
    role_id,
    department_id,
    position_id,
    join_date,
  } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO employees (company_id, role_id, department_id, position_id, name, email, password_hash, join_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
     RETURNING id, name, email, status`,
    [
      req.user.companyId,
      role_id,
      department_id,
      position_id,
      name,
      email,
      passwordHash,
      join_date,
    ],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
}
