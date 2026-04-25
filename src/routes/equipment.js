import express from "express";
import pool from "../db.js";
import { authenticate } from "../lib/auth.js";

const router = express.Router();

/*
========================================
CREATE EQUIPMENT
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    const organization_id = req.organization_id;

    const {
      client_id,
      type,
      brand,
      model,
      serial_number,
      notes
    } = req.body;

    // VALIDACIÓN BÁSICA
    if (!client_id) {
      return res.status(400).json({
        success: false,
        error: "client_id is required"
      });
    }

    // INSERT
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
        type || null,
        brand || null,
        model || null,
        serial_number || null,
        notes || null
      ]
    );

    return res.status(201).json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error("CREATE EQUIPMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/*
========================================
GET ALL EQUIPMENT (POR ORG)
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const organization_id = req.organization_id;

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
      data: rows
    });

  } catch (error) {
    console.error("GET EQUIPMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

export default router;
