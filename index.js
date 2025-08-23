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
    JOIN sedes s ON a.sede_id = s.id
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
    const result = await pool.query(`
      SELECT a.id, a.codigo, a.nombre, s.nombre AS sede
      FROM areas a
      JOIN sedes s ON a.sede_id = s.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener área:', error);
    res.status(500).json({ message: 'Error al obtener el área' });
  }
});

// Crear un área
app.post('/areas', async (req, res) => {
  const { codigo, nombre, sede_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO areas (codigo, nombre, sede_id) VALUES ($1, $2, $3)',
      [codigo, nombre, sede_id]
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
  const { codigo, nombre, sede_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE areas
       SET codigo = $1, nombre = $2, sede_id = $3
       WHERE id = $4
       RETURNING *`,
      [codigo, nombre, sede_id, id]
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
// ✅ Obtener todas las áreas con nombre de la sede
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

// ✅ Obtener un área por id
app.get('/areas/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT a.id, a.codigo, a.nombre, s.nombre AS sede_nombre
      FROM areas a
      JOIN sedes s ON a.id_sede = s.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Área no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener área:', error);
    res.status(500).json({ message: 'Error al obtener el área' });
  }
});

// ✅ Crear un área
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

// ✅ Actualizar un área
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



// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
