import { Request, Response } from "express";
import { pool } from "../../config/database";
import { getDistanceMeters } from "../../shared/helpers/geoDistance";

export async function clockIn(req: Request, res: Response) {
  const { lat, lng } = req.body;
  const employeeId = req.user.sub;

  const scheduleResult = await pool.query(
    `SELECT es.id as schedule_id, s.start_time, s.tolerance_minutes, l.latitude, l.longitude, l.radius_meters
     FROM employee_schedules es
     JOIN shifts s ON es.shift_id = s.id
     JOIN office_locations l ON es.location_id = l.id
     WHERE es.employee_id = $1 AND (es.end_date IS NULL OR es.end_date >= CURRENT_DATE)
     ORDER BY es.start_date DESC LIMIT 1`,
    [employeeId],
  );

  if (scheduleResult.rows.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: "NO_SCHEDULE", message: "Belum ada jadwal kerja aktif" },
    });
  }
  const schedule = scheduleResult.rows[0];

  const distance = getDistanceMeters(
    lat,
    lng,
    schedule.latitude,
    schedule.longitude,
  );
  if (distance > schedule.radius_meters) {
    return res.status(400).json({
      success: false,
      error: {
        code: "OUTSIDE_RADIUS",
        message: `Kamu di luar radius kantor (jarak: ${Math.round(distance)}m)`,
      },
    });
  }

  const faceMatchStatus = "skipped";

  const now = new Date();
  const [schedHour, schedMin] = schedule.start_time.split(":").map(Number);
  const scheduledTime = new Date(now);
  scheduledTime.setHours(schedHour, schedMin, 0, 0);
  const toleranceMs = schedule.tolerance_minutes * 60 * 1000;

  const status =
    now.getTime() > scheduledTime.getTime() + toleranceMs ? "telat" : "hadir";

  const result = await pool.query(
    `INSERT INTO attendances (company_id, employee_id, schedule_id, clock_in_time, clock_in_lat, clock_in_lng, clock_in_distance_m, face_match_status, status)
     VALUES ($1, $2, $3, now(), $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      req.user.companyId,
      employeeId,
      schedule.schedule_id,
      lat,
      lng,
      distance,
      faceMatchStatus,
      status,
    ],
  );

  res.status(201).json({ success: true, data: result.rows[0] });
}

export async function clockOut(req: Request, res: Response) {
  const { lat, lng } = req.body;
  const employeeId = req.user.sub;

  const todayResult = await pool.query(
    `SELECT a.*, l.latitude, l.longitude, l.radius_meters
     FROM attendances a
     JOIN employee_schedules es ON a.schedule_id = es.id
     JOIN office_locations l ON es.location_id = l.id
     WHERE a.employee_id = $1 AND a.clock_out_time IS NULL
     ORDER BY a.clock_in_time DESC LIMIT 1`,
    [employeeId],
  );

  if (todayResult.rows.length === 0) {
    return res
      .status(400)
      .json({
        success: false,
        error: {
          code: "NO_CLOCK_IN",
          message: "Belum ada clock-in aktif hari ini",
        },
      });
  }
  const attendance = todayResult.rows[0];

  const distance = getDistanceMeters(
    lat,
    lng,
    attendance.latitude,
    attendance.longitude,
  );

  const result = await pool.query(
    `UPDATE attendances SET clock_out_time = now(), clock_out_lat = $1, clock_out_lng = $2, clock_out_distance_m = $3
     WHERE id = $4 RETURNING *`,
    [lat, lng, distance, attendance.id],
  );

  res.json({ success: true, data: result.rows[0] });
}

export async function myAttendance(req: Request, res: Response) {
  const result = await pool.query(
    `SELECT * FROM attendances WHERE employee_id = $1 ORDER BY clock_in_time DESC LIMIT 30`,
    [req.user.sub],
  );
  res.json({ success: true, data: result.rows });
}
