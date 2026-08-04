import { Request, Response } from "express";
import { pool } from "../../config/database";

export async function listLeaveTypes(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM leave_types WHERE company_id = $1`,
    [req.user.companyId],
  );
  res.json({ success: true, data: result.rows });
}

export async function createLeaveRequest(req: Request, res: Response) {
  const { leave_type_id, start_date, end_date, reason } = req.body;
  const employeeId = req.user.sub;

  // hitung jumlah hari (simpel: selisih tanggal, belum exclude weekend/libur)
  const start = new Date(start_date);
  const end = new Date(end_date);
  const totalDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // cek saldo kuota dulu
  const balanceResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as balance FROM leave_quota_ledger WHERE employee_id = $1`,
    [employeeId],
  );
  const balance = Number(balanceResult.rows[0].balance);

  if (balance < totalDays) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INSUFFICIENT_QUOTA",
        message: `Saldo kuota tidak cukup (saldo: ${balance}, dibutuhkan: ${totalDays})`,
      },
    });
  }

  const result = await pool.query(
    `INSERT INTO leave_requests (company_id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
    [
      req.user.companyId,
      employeeId,
      leave_type_id,
      start_date,
      end_date,
      totalDays,
      reason,
    ],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function myLeaveRequests(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT lr.*, lt.name as leave_type_name FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.employee_id = $1 ORDER BY lr.created_at DESC`,
    [req.user.sub],
  );
  res.json({ success: true, data: result.rows });
}

export async function approveLeaveRequest(req: Request, res: Response) {
  const { id } = req.params;
  const { approval_note } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Ambil data leave request, pastikan masih pending
    const leaveResult = await client.query(
      `SELECT * FROM leave_requests WHERE id = $1 AND company_id = $2 AND status = 'pending' FOR UPDATE`,
      [id, req.user.companyId],
    );
    if (leaveResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Pengajuan tidak ditemukan atau sudah diproses",
        },
      });
    }
    const leave = leaveResult.rows[0];

    // 2. Update status jadi approved
    await client.query(
      `UPDATE leave_requests SET status = 'approved', approved_by = $1, approved_at = now(), approval_note = $2 WHERE id = $3`,
      [req.user.sub, approval_note, id],
    );

    // 3. Insert ke ledger — kuota terpakai (amount negatif)
    await client.query(
      `INSERT INTO leave_quota_ledger (employee_id, period, entry_type, amount, reference_id, created_by)
       VALUES ($1, date_trunc('month', $2::date), 'use', $3, $4, $5)`,
      [
        leave.employee_id,
        leave.start_date,
        -leave.total_days,
        leave.id,
        req.user.sub,
      ],
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      data: { message: "Pengajuan disetujui, kuota telah diperbarui" },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectLeaveRequest(req: Request, res: Response) {
  const { id } = req.params;
  const { approval_note } = req.body;

  if (!approval_note) {
    return res.status(400).json({
      success: false,
      error: {
        code: "REASON_REQUIRED",
        message: "Alasan penolakan wajib diisi",
      },
    });
  }

  const result = await pool.query(
    `UPDATE leave_requests SET status = 'rejected', approved_by = $1, approved_at = now(), approval_note = $2
     WHERE id = $3 AND company_id = $4 AND status = 'pending' RETURNING *`,
    [req.user.sub, approval_note, id, req.user.companyId],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Pengajuan tidak ditemukan atau sudah diproses",
      },
    });
  }
  res.json({ success: true, data: result.rows[0] });
}

export async function getLeaveQuota(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as balance FROM leave_quota_ledger WHERE employee_id = $1`,
    [req.params.employeeId],
  );
  res.json({
    success: true,
    data: { balance: Number(result.rows[0].balance) },
  });
}

export async function adjustLeaveQuota(req: Request, res: Response) {
  const { amount, reason } = req.body;
  const { employeeId } = req.params;

  if (!reason) {
    return res
      .status(400)
      .json({
        success: false,
        error: {
          code: "REASON_REQUIRED",
          message: "Alasan penyesuaian wajib diisi",
        },
      });
  }

  const result = await pool.query(
    `INSERT INTO leave_quota_ledger (employee_id, period, entry_type, amount, reason, created_by)
     VALUES ($1, date_trunc('month', CURRENT_DATE), 'adjustment', $2, $3, $4) RETURNING *`,
    [employeeId, amount, reason, req.user.sub],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
}
