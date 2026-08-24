import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../shared/types/jwt.types";
import { pool } from "../config/database";

let io: SocketServer | null = null;

export function getIo(): SocketServer | null {
  return io;
}

interface SocketData {
  employeeId: string;
  companyId: string;
  role: string;
}

const lastMessageAt = new Map<string, number>();
const RATE_LIMIT_MS = 300;

export function initSocketServer(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin:
        process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ??
        ["http://localhost:3000"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("NO_TOKEN"));

      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      } catch {
        return next(new Error("INVALID_TOKEN"));
      }

      if (payload.actorType !== "employee") {
        return next(new Error("FORBIDDEN"));
      }

      const result = await pool.query(
        `SELECT id, company_id, status FROM employees WHERE id = $1`,
        [payload.sub],
      );
      const employee = result.rows[0];
      if (!employee || employee.status !== "active") {
        return next(new Error("ACCOUNT_INACTIVE"));
      }

      socket.data.employeeId = employee.id;
      socket.data.companyId = employee.company_id;
      socket.data.role = payload.role;
      next();
    } catch (err) {
      console.error("[socket] auth error:", err);
      next(new Error("INTERNAL_SERVER_ERROR"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const { employeeId, companyId } = socket.data as SocketData;
    socket.join(`company:${companyId}`);
    lastMessageAt.delete(socket.id);

    socket.on(
      "message:send",
      async (
        raw: { body?: unknown },
        ack?: (response: unknown) => void,
      ) => {
        try {
          const now = Date.now();
          const last = lastMessageAt.get(socket.id) ?? 0;
          if (now - last < RATE_LIMIT_MS) {
            ack?.({ success: false, error: { code: "TOO_FAST" } });
            return;
          }

          const body =
            typeof raw?.body === "string" ? raw.body.trim().slice(0, 1000) : "";
          if (!body) {
            ack?.({ success: false, error: { code: "EMPTY_MESSAGE" } });
            return;
          }
          lastMessageAt.set(socket.id, now);

          const result = await pool.query(
            `WITH ins AS (
               INSERT INTO messages (company_id, employee_id, body)
               VALUES ($1, $2, $3)
               RETURNING id, company_id, employee_id, body, created_at
             )
             SELECT ins.*, e.name AS employee_name, e.image AS employee_image
             FROM ins
             JOIN employees e ON e.id = ins.employee_id`,
            [companyId, employeeId, body],
          );
          const message = result.rows[0];

          io!.to(`company:${companyId}`).emit("message:new", message);
          ack?.({ success: true, data: message });
        } catch (err) {
          console.error("[socket] message:send error:", err);
          ack?.({
            success: false,
            error: { code: "INTERNAL_SERVER_ERROR" },
          });
        }
      },
    );

    socket.on("disconnect", () => {
      lastMessageAt.delete(socket.id);
    });
  });

  console.log("[socket] WebSocket server initialized");
}
