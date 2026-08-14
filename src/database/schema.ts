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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'employee'
        CHECK (account_type IN ('employee','superadmin')),
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_account
    ON password_reset_tokens(account_type, account_id)
  `);

  await pool.query(`
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS image TEXT
  `);
}