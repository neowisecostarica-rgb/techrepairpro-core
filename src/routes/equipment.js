/*
====================================================
TRP — EQUIPMENT ROUTES (SOT HARDENED FINAL)
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
  return String(type || "").toLowerCase().trim();
}

/*
========================================
UTIL: NORMALIZE SERIAL
========================================
*/
function normalizeSerial(serial) {
  return String(serial || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

/*
========================================
VALID TYPES (SOT CONTROL)
========================================
*/
const VALID_TYPES = ["laptop", "desktop", "printer", "other"];

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
      const orgId = req.user.organization_id;

      let {
        client_id,
        type,
        brand,
        model,
        serial_number,
        notes,
      } = req.body;

      if (!client_id || !type) {
        return res.status(400).json({
          success: false,
          error: "client_id and type are required",
        });
      }

      type = normalizeType(type);

      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Invalid equipment type",
        });
      }

      /*
      VALIDAR CLIENT
      */
      const clientCheck = await pool.query(
        `SELECT id FROM clients WHERE id = $1 AND organization_id = $2`,
        [client_id, orgId]
      );

      if (!clientCheck.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Client not found",
        });
      }

      /*
      VALIDAR SERIAL
      */
      if (serial_number) {
        serial_number = normalizeSerial(serial_number);

        const serialCheck = await pool.query(
          `
          SELECT id FROM equipment
          WHERE serial_number = $1 AND organization_id = $2
          `,
          [serial_number, orgId]
        );

        if (serialCheck.rows.length) {
          return res.status(400).json({
            success: false,
            error: "Equipment with this serial already exists",
          });
        }
      }

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
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          orgId,
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

    } catch {
      return res.status(500).json({
        success: false,
        error: "Error creating equipment",
      });
    }
  }
);

/*
========================================
GET ALL EQUIPMENT (MEJORADO)
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const { rows } = await pool.query(
      `
      SELECT 
        e.*,
        c.full_name AS client_name
      FROM equipment e
      LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.organization_id = $1
      ORDER BY e.created_at DESC
      `,
      [orgId]
    );

    return res.json({
      success: true,
      data: rows,
    });

  } catch {
    return res.status(500).json({
      success: false,
      error: "Error fetching equipment",
    });
  }
});

/*
========================================
GET EQUIPMENT BY ID
========================================
*/
router.get("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { id } = req.params;

    const { rows } = await pool.query(
      `
      SELECT *
      FROM equipment
      WHERE id = $1 AND organization_id = $2
      LIMIT 1
      `,
      [id, orgId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: "Equipment not found",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });

  } catch {
    return res.status(500).json({
      success: false,
      error: "Error fetching equipment",
    });
  }
});

/*
========================================
DELETE EQUIPMENT (PROTEGIDO)
========================================
*/
router.delete(
  "/:id",
  authenticate,
  authorize(["owner"]),
  async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const { id } = req.params;

      /*
      🔒 VALIDAR QUE NO TENGA WORK ORDERS
      */
      const checkWO = await pool.query(
        `SELECT id FROM work_orders WHERE equipment_id = $1 LIMIT 1`,
        [id]
      );

      if (checkWO.rows.length) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete equipment with work orders",
        });
      }

      const result = await pool.query(
        `
        DELETE FROM equipment
        WHERE id = $1 AND organization_id = $2
        RETURNING id
        `,
        [id, orgId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          error: "Equipment not found",
        });
      }

      return res.json({
        success: true,
      });

    } catch {
      return res.status(500).json({
        success: false,
        error: "Error deleting equipment",
      });
    }
  }
);

export default router;
