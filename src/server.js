import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import healthRoutes from "./routes/health.js";
import clientsRoutes from "./routes/clients.js";
import workOrdersRoutes from "./routes/workOrders.js";
import equipmentRoutes from "./routes/equipment.js";
import authRoutes from "./routes/auth.js";

import db from "./db.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/*
========================================
ROOT (IMPORTANTE PARA RENDER)
========================================
*/
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "TechRepairPro Core",
  });
});

/*
========================================
DB TEST
========================================
*/
async function testDB() {
  try {
    const result = await db.query("SELECT NOW()");
    console.log("✅ DB connected:", result.rows[0]);
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
  }
}

testDB();

/*
========================================
ROUTES
========================================
*/
app.use("/health", healthRoutes);
app.use("/v1/clients", clientsRoutes);
app.use("/v1/work-orders", workOrdersRoutes);
app.use("/v1/equipment", equipmentRoutes);
app.use("/v1/auth", authRoutes);

/*
========================================
404 HANDLER
========================================
*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/*
========================================
GLOBAL ERROR HANDLER
========================================
*/
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err);

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/*
========================================
START SERVER
========================================
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 TechRepairPro Core running on port ${PORT}`);
});
