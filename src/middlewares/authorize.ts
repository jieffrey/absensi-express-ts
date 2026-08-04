import { Request, Response, NextFunction } from "express";

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          success: false,
          error: { code: "FORBIDDEN", message: "Tidak punya akses" },
        });
    }
    next();
  };
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.user.actorType !== "superadmin") {
    return res
      .status(403)
      .json({
        success: false,
        error: { code: "FORBIDDEN", message: "Khusus SuperAdmin" },
      });
  }
  next();
}
