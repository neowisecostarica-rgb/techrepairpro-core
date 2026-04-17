import express from "express";
import db from "../db.js";
import { authenticate } from "../lib/auth.js";

const router = express.Router();

/*
========================================
GET ALL WORK ORDERS
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const result = await db.query(
      `
      SELECT wo.*, c.full_name AS client_name, c.phone
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      WHERE wo.organization_id = $1
      ORDER BY wo.created_at DESC
      `,
      [orgId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("GET WORK ORDERS ERROR:", err);
    res.status(500).json({ success: false, error: "Error fetching work orders" });
  }
});

/*
========================================
CREATE WORK ORDER
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const {
      client_id,
      diagnosis,
      solution,
      estimated_cost,
      final_cost,
      status = "pending"
    } = req.body;

    if (!client_id) {
      return res.status(400).json({
        success: false,
        error: "client_id is required"
      });
    }

    const result = await db.query(
      `
      INSERT INTO work_orders (
        organization_id,
        client_id,
        diagnosis,
        solution,
        estimated_cost,
        final_cost,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        orgId,
        client_id,
        diagnosis,
        solution,
        estimated_cost,
        final_cost,
        status
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
GET WORK ORDER BY ID
========================================
*/
router.get("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT wo.*, c.full_name AS client_name, c.phone
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      WHERE wo.id = $1 AND wo.organization_id = $2
      LIMIT 1
      `,
      [id, orgId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Work order not found"
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("GET WORK ORDER ERROR:", err);
    res.status(500).json({ success: false, error: "Error fetching work order" });
  }
});

/*
========================================
UPDATE WORK ORDER
========================================
*/
router.put("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;

    const {
      diagnosis,
      solution,
      estimated_cost,
      final_cost,
      status
    } = req.body;

    const result = await db.query(
      `
      UPDATE work_orders
      SET
        diagnosis = COALESCE($1, diagnosis),
        solution = COALESCE($2, solution),
        estimated_cost = COALESCE($3, estimated_cost),
        final_cost = COALESCE($4, final_cost),
        status = COALESCE($5, status),
        updated_at = NOW()
      WHERE id = $6 AND organization_id = $7
      RETURNING *
      `,
      [
        diagnosis,
        solution,
        estimated_cost,
        final_cost,
        status,
        id,
        orgId
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Work order not found"
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("UPDATE WORK ORDER ERROR:", err);
    res.status(500).json({ success: false, error: "Error updating work order" });
  }
});

export default router;
