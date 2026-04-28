/*
====================================================
TRP — EQUIPMENT ROUTES (SOT AUTH P3)
====================================================
*/
import express from "express";
import pool from "../db.js";
import { authenticate } from "../lib/auth.js";
import { authorize } from "../lib/authorize.js";

const router = express.Router();

/*
========================================
UTIL: NORMALIZE TYPE
========================================
*/
function normalizeType(type) {
  return String(type || "")
    .toLowerCase()
    .trim();
}

/*
========================================
CREATE EQUIPMENT
========================================
*/
router.post(
  "/",
  authenticate,
  authorize(["owner", "admin"]),
  async (req, res) => {
    try {
      const organization_id = req.user.organization_id;

      let {
        client_id,
        type,
        brand,
        model,
        serial_number,
        notes,
      } = req.body;

      // ========================================
      // VALIDACIÓN BÁSICA
      // ========================================
      if (!client_id || !type) {
        return res.status(400).json({
          success: false,
          error: "client_id and type are required",
        });
      }

      // ========================================
      // NORMALIZACIÓN
      // ========================================
      type = normalizeType(type);

      // ========================================
      // VALIDAR CLIENTE EXISTE (MULTITENANT SAFE)
      // ========================================
      const clientCheck = await pool.query(
        `
        SELECT id FROM clients
        WHERE id = $1 AND organization_id = $2
        `,
        [client_id, organization_id]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Client not found",
        });
      }

      // ========================================
      // VALIDAR SERIAL ÚNICO (SI VIENE)
      // ========================================
      if (serial_number) {
        const serialCheck = await pool.query(
          `
          SELECT id FROM equipment
          WHERE serial_number = $1
          AND organization_id = $2
          `,
          [serial_number, organization_id]
        );

        if (serialCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: "Equipment with this serial already exists",
          });
        }
      }

      // ========================================
      // INSERT
      // ========================================
      const { rows } = await pool.query(
        `
        INSERT INTO equipment (
          organization_id,
          client_id,
          type,
          brand,
          model,
          serial_number,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          organization_id,
          client_id,
          type,
          brand || null,
          model || null,
          serial_number || null,
          notes || null,
        ]
      );

      return res.status(201).json({
        success: true,
        data: rows[0],
      });
    } catch (error) {
      console.error("❌ CREATE EQUIPMENT ERROR:", error.message);

      return res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
);

/*
========================================
GET ALL EQUIPMENT (POR ORG)
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const organization_id = req.user.organization_id;

    const { rows } = await pool.query(
      `
      SELECT * FROM equipment
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [organization_id]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("❌ GET EQUIPMENT ERROR:", error.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
