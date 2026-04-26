import express from "express";
import db from "../db.js";
import { authenticate } from "../lib/auth.js";

const router = express.Router();

/*
========================================
GET WORK ORDER METRICS (PRO)
========================================
*/
router.get("/metrics/summary", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

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

        -- BACKLOG
        COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS backlog,

        -- TIEMPO PROMEDIO (HORAS)
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS avg_hours,

        -- NEGOCIO
        SUM(final_cost) AS revenue,
        SUM(final_cost - estimated_cost) AS total_margin,
        AVG(final_cost - estimated_cost) AS avg_margin

      FROM techrepairpro.work_orders
      WHERE organization_id = $1
      `,
      [orgId]
    );

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        summary: {
          total: Number(row.total),
          created: Number(row.created),
          in_progress: Number(row.in_progress),
          completed: Number(row.completed),
          cancelled: Number(row.cancelled)
        },
        operations: {
          backlog: Number(row.backlog),
          avg_hours: Number(row.avg_hours || 0)
        },
        business: {
          revenue: Number(row.revenue || 0),
          total_margin: Number(row.total_margin || 0),
          avg_margin: Number(row.avg_margin || 0)
        },
        priority: {
          high: Number(row.high_priority),
          normal: Number(row.normal_priority),
          low: Number(row.low_priority)
        }
      }
    });

  } catch (err) {
    console.error("METRICS ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Error fetching metrics"
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
    const orgId = req.organization.id;
    const { status, priority } = req.query;

    let query = `
      SELECT 
        wo.*, 
        c.full_name AS client_name, 
        c.phone,
        e.brand,
        e.model,
        e.serial_number
      FROM techrepairpro.work_orders wo
      LEFT JOIN techrepairpro.clients c ON wo.client_id = c.id
      LEFT JOIN techrepairpro.equipment e ON wo.equipment_id = e.id
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
      paramIndex++;
    }

    query += ` ORDER BY wo.created_at DESC`;

    const result = await db.query(query, params);

    res.json({ success: true, data: result.rows });

  } catch (err) {
    console.error("GET WORK ORDERS ERROR:", err);
    res.status(500).json({ success: false, error: "Error fetching work orders" });
  }
});

/*
========================================
CREATE WORK ORDER (UPDATED)
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const {
      client_id,
      equipment_id,
      intake_notes,
      priority,
      estimated_cost
    } = req.body;

    if (!client_id || !equipment_id) {
      return res.status(400).json({
        success: false,
        error: "client_id and equipment_id are required"
      });
    }

    const result = await db.query(
      `
      INSERT INTO techrepairpro.work_orders (
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
        estimated_cost || 0,
        0
      ]
    );

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error("CREATE WORK ORDER ERROR:", err);
    res.status(500).json({ success: false, error: "Error creating work order" });
  }
});

/*
========================================
UPDATE FINAL COST (NUEVO)
========================================
*/
router.patch("/:id/cost", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;
    const { final_cost } = req.body;

    const result = await db.query(
      `
      UPDATE techrepairpro.work_orders
      SET final_cost = $1,
          updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      RETURNING *
      `,
      [final_cost, id, orgId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Work order not found"
      });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error("UPDATE COST ERROR:", err);
    res.status(500).json({ success: false, error: "Error updating cost" });
  }
});

export default router;
