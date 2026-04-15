import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "TechRepairPro Core",
  });
});

export default router;
