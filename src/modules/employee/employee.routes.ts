import { Router } from "express";
import { listEmployees, createEmployee } from "./employee.controller";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";

const router = Router();
router.get("/", authenticate, authorize("admin"), listEmployees);
router.post("/", authenticate, authorize("admin"), createEmployee);

export default router;
