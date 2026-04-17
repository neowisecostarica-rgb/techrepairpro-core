import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import healthRoutes from "./routes/health.js";
import clientsRoutes from "./routes/clients.js";
import workOrdersRoutes from "./routes/workOrders.js";

import db from "./db.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

/*
========================================
START SERVER
========================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 TechRepairPro Core running on port ${PORT}`);
});
