import { Router } from "express";
import { myMessages } from "./message.controller";
import { authenticate } from "../../middlewares/authenticate";

const router = Router();
router.get("/me", authenticate, myMessages);

export default router;
