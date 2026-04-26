import express from "express";
import db from "../db.js";
import { authenticate } from "../lib/auth.js";

const router = express.Router();

/*
========================================
GET ALL WORK ORDERS (CON FILTROS)
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
CREATE WORK ORDER
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const {
      client_id,
      equipment_id,
      intake_notes,
      priority
    } = req.body;

    // VALIDACIÓN BÁSICA
    if (!client_id || !equipment_id) {
      return res.status(400).json({
        success: false,
        error: "client_id and equipment_id are required"
      });
    }

    // VALIDAR CLIENTE
    const clientCheck = await db.query(
      `
      SELECT id FROM techrepairpro.clients
      WHERE id = $1 AND organization_id = $2
      `,
      [client_id, orgId]
    );

    if (!clientCheck.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }

    // VALIDAR EQUIPMENT
    const equipmentCheck = await db.query(
      `
      SELECT id, client_id FROM techrepairpro.equipment
      WHERE id = $1 AND organization_id = $2
      `,
      [equipment_id, orgId]
    );

    if (!equipmentCheck.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Equipment not found"
      });
    }

    // VALIDAR RELACIÓN CLIENT ↔ EQUIPMENT
    if (equipmentCheck.rows[0].client_id !== client_id) {
      return res.status(400).json({
        success: false,
        error: "Equipment does not belong to this client"
      });
    }

    // INSERT
    const result = await db.query(
      `
      INSERT INTO techrepairpro.work_orders (
        organization_id,
        client_id,
        equipment_id,
        intake_notes,
        priority,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        orgId,
        client_id,
        equipment_id,
        intake_notes || null,
        priority || "normal",
        "created"
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
UPDATE STATUS
========================================
*/
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "status is required"
      });
    }

    const result = await db.query(
      `
      UPDATE techrepairpro.work_orders
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      RETURNING *
      `,
      [status, id, orgId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Work order not found"
      });
    }

    res.json({ success: true, data: result.rows[0] });

  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ success: false, error: "Error updating status" });
  }
});

export default router;
