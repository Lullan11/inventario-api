const express = require('express');
const app = express();
const port = 3000;

// Importamos la conexión desde db.js
const pool = require('./db');

// Middleware para aceptar JSON
app.use(express.json());

// Ruta de prueba para verificar que todo funciona
app.get('/', (req, res) => {
  res.send('¡La API está funcionando!');
});

// ✅ Ruta para obtener todas las sedes (debe estar antes de app.listen)
app.get('/sedes', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM sedes');
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener sedes:', error);
    res.status(500).json({ error: 'Error al obtener las sedes' });
  }
});
app.delete('/sedes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM sedes WHERE id = $1', [id]);
    res.json({ mensaje: 'Sede eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar la sede:', error);
    res.status(500).json({ error: 'Error al eliminar la sede' });
  }
});

// OBTENER LAS AREAS DE UNA SEDE
// Áreas de una sede específica
app.get('/sedes/:id/areas', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.id, a.codigo, a.nombre
       FROM areas a
       WHERE a.id_sede = $1
       ORDER BY a.id`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener áreas de la sede:', error);
    res.status(500).json({ error: 'Error al obtener áreas de la sede' });
  }
});






app.post('/sedes', async (req, res) => {
  const { codigo, nombre, direccion } = req.body;
  try {
    await pool.query(
      'INSERT INTO sedes (codigo, nombre, direccion) VALUES ($1, $2, $3)',
      [codigo, nombre, direccion]
    );
    res.status(201).json({ mensaje: 'Sede creada correctamente' });
  } catch (error) {
    console.error('Error al crear sede:', error);
    res.status(500).json({ error: 'Error al crear sede' });
  }
});


// GET /sedes/:id  -> devuelve una sede por id
app.get('/sedes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, codigo, nombre, direccion FROM sedes WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Sede no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener sede por id:', error);
    res.status(500).json({ message: 'Error al obtener la sede' });
  }
});

// PUT /sedes/:id  -> actualiza una sede por id
app.put('/sedes/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, direccion } = req.body;

  if (!codigo || !nombre || !direccion) {
    return res.status(400).json({ message: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(
      `UPDATE sedes
       SET codigo = $1, nombre = $2, direccion = $3
       WHERE id = $4
       RETURNING id, codigo, nombre, direccion`,
      [codigo, nombre, direccion, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Sede no encontrada' });
    }

    res.json({ message: 'Sede actualizada correctamente', sede: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar sede:', error);
    res.status(500).json({ message: 'Error al actualizar la sede' });
  }
});





// ========================= ÁREAS =========================

// Obtener todas las áreas con nombre de la sede
app.get('/areas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.codigo, a.nombre, s.nombre AS sede_nombre
      FROM areas a
      JOIN sedes s ON a.id_sede = s.id
      ORDER BY a.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener áreas:', error);
    res.status(500).json({ error: 'Error al obtener las áreas' });
  }
});

// Obtener un área por id
app.get('/areas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.id, a.codigo, a.nombre, a.id_sede, s.nombre AS sede_nombre
       FROM areas a
       JOIN sedes s ON a.id_sede = s.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }

    res.json(result.rows[0]); // Devuelve {id, codigo, nombre, id_sede, sede_nombre}
  } catch (error) {
    console.error('Error al obtener área:', error);
    res.status(500).json({ message: 'Error al obtener el área' });
  }
});



// Crear un área
app.post('/areas', async (req, res) => {
  const { codigo, nombre, id_sede } = req.body;
  try {
    await pool.query(
      'INSERT INTO areas (codigo, nombre, id_sede) VALUES ($1, $2, $3)',
      [codigo, nombre, id_sede]
    );
    res.status(201).json({ message: 'Área creada correctamente' });
  } catch (error) {
    console.error('Error al crear área:', error);
    res.status(500).json({ error: 'Error al crear el área' });
  }
});

// Actualizar un área
app.put('/areas/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, id_sede } = req.body;

  try {
    const result = await pool.query(
      `UPDATE areas
       SET codigo = $1, nombre = $2, id_sede = $3
       WHERE id = $4
       RETURNING *`,
      [codigo, nombre, id_sede, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }

    res.json({ message: 'Área actualizada correctamente', area: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar área:', error);
    res.status(500).json({ error: 'Error al actualizar el área' });
  }
});

// Eliminar un área
app.delete('/areas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM areas WHERE id = $1', [id]);
    res.json({ message: 'Área eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar área:', error);
    res.status(500).json({ error: 'Error al eliminar el área' });
  }
});




// ========================= PUESTOS DE TRABAJO =========================

// Obtener todos los puestos con área y sede
app.get('/puestos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.codigo, p.responsable_nombre, p.responsable_documento,
             a.nombre AS area_nombre, s.nombre AS sede_nombre
      FROM puestos_trabajo p
      JOIN areas a ON p.id_area = a.id
      JOIN sedes s ON a.id_sede = s.id
      ORDER BY p.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener puestos:', error);
    res.status(500).json({ error: 'Error al obtener los puestos' });
  }
});

// Obtener un puesto por id
app.get('/puestos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id, p.codigo, p.responsable_nombre, p.responsable_documento,
             a.id AS id_area, a.nombre AS area_nombre, s.nombre AS sede_nombre
      FROM puestos_trabajo p
      JOIN areas a ON p.id_area = a.id
      JOIN sedes s ON a.id_sede = s.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Puesto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener puesto:', error);
    res.status(500).json({ error: 'Error al obtener el puesto' });
  }
});

// Crear un puesto
app.post('/puestos', async (req, res) => {
  const { codigo, responsable_nombre, responsable_documento, id_area } = req.body;
  try {
    await pool.query(
      `INSERT INTO puestos_trabajo (codigo, responsable_nombre, responsable_documento, id_area)
       VALUES ($1, $2, $3, $4)`,
      [codigo, responsable_nombre, responsable_documento, id_area]
    );
    res.status(201).json({ message: 'Puesto creado correctamente' });
  } catch (error) {
    console.error('Error al crear puesto:', error);
    res.status(500).json({ error: 'Error al crear el puesto' });
  }
});

// Actualizar un puesto
app.put('/puestos/:id', async (req, res) => {
  const { id } = req.params;
  const { codigo, responsable_nombre, responsable_documento, id_area } = req.body;

  try {
    const result = await pool.query(
      `UPDATE puestos_trabajo
       SET codigo = $1, responsable_nombre = $2, responsable_documento = $3, id_area = $4
       WHERE id = $5
       RETURNING *`,
      [codigo, responsable_nombre, responsable_documento, id_area, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Puesto no encontrado' });
    }

    res.json({ message: 'Puesto actualizado correctamente', puesto: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar puesto:', error);
    res.status(500).json({ error: 'Error al actualizar el puesto' });
  }
});

// Eliminar un puesto
app.delete('/puestos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM puestos_trabajo WHERE id = $1', [id]);
    res.json({ message: 'Puesto eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar puesto:', error);
    res.status(500).json({ error: 'Error al eliminar el puesto' });
  }
});

// ✅ Obtener todos los puestos de un área específica
app.get('/areas/:id/puestos', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id, p.codigo, p.responsable_nombre, p.responsable_documento
      FROM puestos_trabajo p
      WHERE p.id_area = $1
      ORDER BY p.id
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener puestos de área:', error);
    res.status(500).json({ error: 'Error al obtener puestos del área' });
  }
});


// -----------------------------------------
// EQUIPOS
// ✅ Obtener todos los equipos (con filtros opcionales)
app.get("/equipos", async (req, res) => {
  const { puesto_id, area_id, sede_id } = req.query;

  try {
    let query = `
      SELECT e.id, e.codigo_interno, e.nombre, e.descripcion, e.marca, e.serial, e.estado,
             e.responsable, e.puesto_id, e.area_id, e.sede_id,
             COALESCE(p.nombre, a.nombre, s.nombre) AS ubicacion
      FROM equipos e
      LEFT JOIN puestos_trabajo p ON e.puesto_id = p.id
      LEFT JOIN areas a ON e.area_id = a.id
      LEFT JOIN sedes s ON e.sede_id = s.id
      WHERE e.estado = 'activo'
    `;

    let params = [];

    if (puesto_id) {
      query += " AND e.puesto_id = $1";
      params.push(puesto_id);
    } else if (area_id) {
      query += " AND e.area_id = $1";
      params.push(area_id);
    } else if (sede_id) {
      query += " AND e.sede_id = $1";
      params.push(sede_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error al obtener equipos:", error);
    res.status(500).json({ error: "Error al obtener equipos" });
  }
});


// ✅ Crear un nuevo equipo
app.post("/equipos", async (req, res) => {
  const { codigo_interno, nombre, descripcion, marca, serial, responsable, puesto_id, area_id, sede_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO equipos (codigo_interno, nombre, descripcion, marca, serial, responsable, puesto_id, area_id, sede_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [codigo_interno, nombre, descripcion, marca, serial, responsable, puesto_id, area_id, sede_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al crear equipo:", error);
    res.status(500).json({ error: "Error al crear equipo" });
  }
});


// ✅ Actualizar un equipo
app.put("/equipos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, marca, serial, responsable } = req.body;

  try {
    const result = await pool.query(
      `UPDATE equipos
       SET nombre=$1, descripcion=$2, marca=$3, serial=$4, responsable=$5
       WHERE id=$6 RETURNING *`,
      [nombre, descripcion, marca, serial, responsable, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ Error al actualizar equipo:", error);
    res.status(500).json({ error: "Error al actualizar equipo" });
  }
});


// ✅ Eliminar un equipo (requiere formulario de baja)
app.post("/equipos/:id/baja", async (req, res) => {
  const { id } = req.params;
  const { reporte_no, motivo_baja, como_detecto, observaciones } = req.body;

  try {
    // 1. Traer datos del equipo
    const equipo = await pool.query(
      `SELECT e.*, COALESCE(p.nombre, a.nombre, s.nombre) AS ubicacion
       FROM equipos e
       LEFT JOIN puestos_trabajo p ON e.puesto_id = p.id
       LEFT JOIN areas a ON e.area_id = a.id
       LEFT JOIN sedes s ON e.sede_id = s.id
       WHERE e.id=$1`,
      [id]
    );

    if (equipo.rows.length === 0) {
      return res.status(404).json({ error: "Equipo no encontrado" });
    }

    const eq = equipo.rows[0];

    // 2. Guardar reporte de baja
    const reporte = await pool.query(
      `INSERT INTO reportes_baja
         (reporte_no, nombre_equipo, codigo_equipo, ubicacion, motivo_baja, como_detecto, responsable, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        reporte_no,
        eq.nombre,
        eq.codigo_interno,
        eq.ubicacion,
        motivo_baja,
        como_detecto,
        eq.responsable,
        observaciones,
      ]
    );

    // 3. Eliminar el equipo de la tabla principal
    await pool.query("DELETE FROM equipos WHERE id=$1", [id]);

    res.json({
      mensaje: "✅ Equipo dado de baja y eliminado",
      reporte: reporte.rows[0],
    });
  } catch (error) {
    console.error("❌ Error al dar de baja equipo:", error);
    res.status(500).json({ error: "Error al dar de baja equipo" });
  }
});


// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
