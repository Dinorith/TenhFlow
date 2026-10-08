import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tenhflowRouter from "./tenhflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tenhflowRouter);

export default router;
