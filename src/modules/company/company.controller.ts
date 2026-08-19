import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function listCompanies(req: Request, res: Response) {
  try {
    const result = await pool.query(`SELECT * FROM companies ORDER BY name`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("[listCompanies] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function getCompanyById(req: Request, res: Response) {
  try {
    const result = await pool.query(`SELECT * FROM companies WHERE id = $1`, [
      req.params.id,
    ]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Company not found" },
        });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[getCompanyById] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function createCompany(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const result = await pool.query(
      `INSERT INTO companies (name, status) VALUES ($1, 'active') RETURNING *`,
      [name],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[createCompany] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function updateCompany(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const result = await pool.query(
      `UPDATE companies SET name = COALESCE($1, name), updated_at = now() WHERE id = $2 RETURNING *`,
      [name, req.params.id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Company not found" },
        });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[updateCompany] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function updateCompanyStatus(req: Request, res: Response) {
  try {
    const { status } = req.body; // 'active' | 'inactive'
    const result = await pool.query(
      `UPDATE companies SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          error: { code: "NOT_FOUND", message: "Company not found" },
        });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("[updateCompanyStatus] Error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please try again later.",
      },
    });
  }
}

export async function deleteCompany(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const companyRes = await client.query<{ id: string }>(
      `SELECT id FROM companies WHERE id = $1`,
      [req.params.id],
    );
    if (companyRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Company not found" },
      });
    }
    const companyId = companyRes.rows[0].id;

    const empRes = await client.query<{ id: string }>(
      `SELECT id FROM employees WHERE company_id = $1`,
      [companyId],
    );
    const empIds = empRes.rows.map((r) => r.id);

    if (empIds.length > 0) {
      await client.query(`DELETE FROM attendances WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM overtime_requests WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM personal_agendas WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM calendar_events WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM holidays WHERE company_id = $1`, [companyId]);
      await client.query(
        `DELETE FROM leave_quota_ledger WHERE reference_id IN (SELECT id FROM leave_requests WHERE company_id = $1)`,
        [companyId],
      );
      await client.query(`DELETE FROM leave_requests WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM reimbursements WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM announcements WHERE company_id = $1`, [companyId]);
      await client.query(
        `DELETE FROM leave_quota_ledger WHERE employee_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM notifications WHERE employee_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM employee_face_references WHERE employee_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM password_reset_tokens WHERE account_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM employee_schedules WHERE employee_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])`,
        [empIds],
      );
      await client.query(
        `DELETE FROM department_policies WHERE department_id IN (SELECT id FROM departments WHERE company_id = $1)`,
        [companyId],
      );
      await client.query(
        `UPDATE employees SET supervisor_id = NULL WHERE company_id = $1`,
        [companyId],
      );
      await client.query(`DELETE FROM employees WHERE company_id = $1`, [companyId]);
    } else {
      await client.query(
        `DELETE FROM department_policies WHERE department_id IN (SELECT id FROM departments WHERE company_id = $1)`,
        [companyId],
      );
    }

    await client.query(`DELETE FROM leave_types WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM shifts WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM working_day_patterns WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM office_locations WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM positions WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM departments WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM roles WHERE company_id = $1`, [companyId]);
    await client.query(`DELETE FROM companies WHERE id = $1`, [companyId]);

    await client.query("COMMIT");
    res.json({
      success: true,
      data: { message: "Company and all related data deleted" },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[deleteCompany] Error:", err);
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
