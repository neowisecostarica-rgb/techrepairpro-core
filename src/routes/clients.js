import express from "express";
import pool from "../db.js";
import { authenticate } from "../lib/auth.js";

const router = express.Router();

/*
========================================
GET ALL CLIENTS
========================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const result = await pool.query(
      `
      SELECT *
      FROM clients
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [orgId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("GET CLIENTS ERROR:", err);
    res.status(500).json({ success: false, error: "Error fetching clients" });
  }
});

/*
========================================
GET CLIENT BY ID
========================================
*/
router.get("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM clients
      WHERE id = $1 AND organization_id = $2
      LIMIT 1
      `,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Client not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("GET CLIENT ERROR:", err);
    res.status(500).json({ success: false, error: "Error fetching client" });
  }
});

/*
========================================
CREATE CLIENT
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;

    const {
      full_name,
      phone,
      email,
      id_number,
      client_type = "individual",
      notes,
    } = req.body;

    if (!full_name) {
      return res
        .status(400)
        .json({ success: false, error: "full_name is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO clients (
        organization_id,
        full_name,
        phone,
        email,
        id_number,
        client_type,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        orgId,
        full_name,
        phone,
        email,
        id_number,
        client_type,
        notes,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("CREATE CLIENT ERROR:", err);
    res.status(500).json({ success: false, error: "Error creating client" });
  }
});

/*
========================================
UPDATE CLIENT
========================================
*/
router.put("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;

    const {
      full_name,
      phone,
      email,
      id_number,
      client_type,
      notes,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE clients
      SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        id_number = COALESCE($4, id_number),
        client_type = COALESCE($5, client_type),
        notes = COALESCE($6, notes),
        updated_at = NOW()
      WHERE id = $7 AND organization_id = $8
      RETURNING *
      `,
      [
        full_name,
        phone,
        email,
        id_number,
        client_type,
        notes,
        id,
        orgId,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Client not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("UPDATE CLIENT ERROR:", err);
    res.status(500).json({ success: false, error: "Error updating client" });
  }
});

/*
========================================
DELETE CLIENT
========================================
*/
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const orgId = req.organization.id;
    const { id } = req.params;

    await pool.query(
      `
      DELETE FROM clients
      WHERE id = $1 AND organization_id = $2
      `,
      [id, orgId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE CLIENT ERROR:", err);
    res.status(500).json({ success: false, error: "Error deleting client" });
  }
});

export default router;
