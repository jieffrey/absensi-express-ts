import { pool } from "../config/database";

export async function syncSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS overtime_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      overtime_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      total_hours NUMERIC(5,2) NOT NULL,
      category TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by UUID,
      approved_at TIMESTAMPTZ,
      rejection_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS personal_agendas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      employee_id UUID NOT NULL,
      agenda_date DATE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_time TIME,
      end_time TIME,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}