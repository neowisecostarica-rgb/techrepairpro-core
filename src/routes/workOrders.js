/*
====================================================
TRP — WORK ORDERS ROUTES (SOT HARDENED FIXED)
====================================================
*/

import express from "express";
import db from "../db.js";
import { authenticate } from "../lib/auth.js";
import { authorize } from "../lib/authorize.js";

const router = express.Router();

/*
========================================
GET WORK ORDER METRICS
========================================
*/
router.get("/metrics/summary", authenticate, async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const result = await db.query(
      `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'created') AS created,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE priority = 'high') AS high_priority,
        COUNT(*) FILTER (WHERE priority = 'normal') AS normal_priority,
        COUNT(*) FILTER (WHERE priority = 'low') AS low_priority,
        COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS backlog,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS avg_hours,
        COALESCE(SUM(final_cost), 0) AS revenue,
        COALESCE(SUM(final_cost - estimated_cost), 0) AS total_margin,
        COALESCE(AVG(final_cost - estimated_cost), 0) AS avg_margin
      FROM work_orders
      WHERE organization_id = $1
      `,
      [orgId]
    );

    const row = result.rows[0];

    return res.json({
      success: true,
      data: {
        summary: {
          total: Number(row.total),
          created: Number(row.created),
          in_progress: Number(row.in_progress),
          completed: Number(row.completed),
          cancelled: Number(row.cancelled),
        },
        operations: {
          backlog: Number(row.backlog),
          avg_hours: Number(row.avg_hours || 0),
        },
        business: {
          revenue: Number(row.revenue),
          total_margin: Number(row.total_margin),
          avg_margin: Number(row.avg_margin),
        },
        priority: {
          high: Number(row.high_priority),
          normal: Number(row.normal_priority),
          low: Number(row.low_priority),
        },
      },
    });

  } catch {
    return res.status(500).json({
      success: false,
      error: "Error fetching metrics",
    });
  }
});

/*
========================================
GET ALL WORK ORDERS
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { status, priority } = req.query;

    let query = `
      SELECT 
        wo.*, 
        c.full_name AS client_name, 
        c.phone,
        e.brand,
        e.model,
        e.serial_number
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN equipment e ON wo.equipment_id = e.id
      WHERE wo.organization_id = $1
    `;

    const params = [orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND wo.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND wo.priority = $${paramIndex}`;
      params.push(priority);
    }

    query += ` ORDER BY wo.created_at DESC`;

    const result = await db.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
    });

  } catch {
    return res.status(500).json({
      success: false,
      error: "Error fetching work orders",
    });
  }
});

/*
========================================
CREATE WORK ORDER (FIXED)
========================================
*/
router.post(
  "/",
  authenticate,
  authorize(["owner", "admin"]),
  async (req, res) => {
    try {
      const orgId = req.user.organization_id;

      const {
        client_id,
        equipment_id,
        intake_notes,
        priority,
        estimated_cost,
      } = req.body;

      if (!client_id || !equipment_id) {
        return res.status(400).json({
          success: false,
          error: "client_id and equipment_id are required",
        });
      }

      /*
      🔒 VALIDAR CLIENT
      */
      const clientCheck = await db.query(
        `SELECT id FROM clients WHERE id = $1 AND organization_id = $2`,
        [client_id, orgId]
      );

      if (!clientCheck.rows.length) {
        return res.status(400).json({
          success: false,
          error: "Invalid client_id",
        });
      }

      /*
      🔒 VALIDAR EQUIPMENT
      */
      const equipmentCheck = await db.query(
        `SELECT id FROM equipment WHERE id = $1 AND organization_id = $2`,
        [equipment_id, orgId]
      );

      if (!equipmentCheck.rows.length) {
        return res.status(400).json({
          success: false,
          error: "Invalid equipment_id",
        });
      }

      const result = await db.query(
        `
        INSERT INTO work_orders (
          organization_id,
          client_id,
          equipment_id,
          intake_notes,
          priority,
          status,
          estimated_cost,
          final_cost
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          orgId,
          client_id,
          equipment_id,
          intake_notes || null,
          priority || "normal",
          "created",
          Number(estimated_cost) || 0,
          0,
        ]
      );

      return res.json({
        success: true,
        data: result.rows[0],
      });

    } catch {
      return res.status(500).json({
        success: false,
        error: "Error creating work order",
      });
    }
  }
);

export default router;
