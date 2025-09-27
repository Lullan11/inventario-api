const express = require('express');
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const pool = require('./db'); // conexión a la BD

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡La API está funcionando!');
});

// ====================
// REGISTRO DE USUARIO
// ====================
app.post("/usuarios/register", async (req, res) => {
  const { nombre, documento, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO usuarios (nombre, documento, email, password) VALUES ($1,$2,$3,$4) RETURNING id, nombre, documento, email",
      [nombre, documento, email, hashed]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error registrando usuario:", err);
    if (err.code === "23505") {
      res.status(400).json({ error: "El correo o documento ya están registrados" });
    } else {
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  }
});

// ====================
// LOGIN DE USUARIO
// ====================
app.post("/usuarios/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const usuario = result.rows[0];
    const valid = await bcrypt.compare(password, usuario.password);

    if (!valid) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { id: usuario.id },
      process.env.JWT_SECRET || "mi_secreto",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login exitoso",
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        documento: usuario.documento,
        email: usuario.email,
      },
      token,
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en login" });
  }
});

// ====================
// OLVIDÉ CONTRASEÑA
// ====================
app.post("/usuarios/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Correo electrónico es necesario." });
  }

  try {
    const result = await pool.query("SELECT id, email FROM usuarios WHERE email=$1", [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Correo no registrado." });
    }

    const usuario = result.rows[0];

    // Generar token y fecha de expiración
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hora desde ahora

    await pool.query(
      "UPDATE usuarios SET reset_token=$1, reset_token_expires=$2 WHERE email=$3",
      [token, expires, email]
    );

    // Crear enlace de recuperación
    const resetUrl = `http://127.0.0.1:5500/src/views/reset-password.html?token=${token}&email=${email}`;

    // Configurar nodemailer
    // Configurar nodemailer con Brevo
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // en 587 se usa STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Recuperación de Contraseña',
      text: `Hola, para restablecer tu contraseña, haz clic en este enlace: ${resetUrl}`,
      html: `<p>Hola, para restablecer tu contraseña haz clic aquí:</p>
         <a href="${resetUrl}">${resetUrl}</a>`,
    };

    await transporter.sendMail(mailOptions);


    res.json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
  } catch (error) {
    console.error("Error al enviar el enlace de recuperación:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ====================
// RESET DE CONTRASEÑA
// ====================
app.post("/usuarios/reset-password", async (req, res) => {
  const { token, email, newPassword } = req.body;

  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: "Faltan parámetros." });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE email=$1 AND reset_token=$2",
      [email, token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Token o correo incorrectos." });
    }

    const usuario = result.rows[0];

    if (usuario.reset_token_expires < new Date()) {
      return res.status(400).json({ error: "El enlace de recuperación ha expirado." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE usuarios SET password=$1, reset_token=NULL, reset_token_expires=NULL WHERE email=$2",
      [hashedPassword, email]
    );

    res.json({ message: "Contraseña actualizada correctamente." });
  } catch (error) {
    console.error("Error al restablecer la contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});







// Total equipos
app.get("/stats/total-equipos", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM equipos");
    res.json({ total: result.rows[0].count });
  } catch (err) {
    console.error("Error obteniendo total equipos:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Total areas
app.get("/stats/total-areas", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM areas");
    res.json({ total: result.rows[0].count });
  } catch (err) {
    console.error("Error obteniendo total areas:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Total sedes
app.get("/stats/total-sedes", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM sedes");
    res.json({ total: result.rows[0].count });
  } catch (err) {
    console.error("Error obteniendo total sedes:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Total puestos
app.get("/stats/total-puestos", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM puestos_trabajo");
    res.json({ total: result.rows[0].count });
  } catch (err) {
    console.error("Error obteniendo total puestos de trabajo:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
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
// Obtener equipos de un área (solo los que están directamente en el área)
app.get('/areas/:id/equipos', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT e.id, e.nombre, e.codigo_interno, e.descripcion, e.responsable_nombre
       FROM equipos e
       WHERE e.id_area = $1 AND e.ubicacion = 'area'`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener equipos del área:", err);
    res.status(500).json({ error: "Error al obtener equipos" });
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


// ========================= EQUIPOS =========================
// ========================= EQUIPOS =========================
// ========================= EQUIPOS =========================

// Obtener todos los equipos con área, sede y puesto
// Obtener equipos, opcionalmente filtrando por puesto
// Obtener todos los equipos con área, sede y puesto
app.get('/equipos', async (req, res) => {
  const { puesto_id } = req.query; // viene de ?puesto_id=123
  try {
    let query = `
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo,
        e.intervalo_dias, e.fecha_inicio_mantenimiento, e.proximo_mantenimiento,
        s.id AS id_sede, s.nombre AS sede_nombre
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
    `;

    const params = [];
    if (puesto_id) {
      query += ` WHERE e.id_puesto = $1`;
      params.push(puesto_id);
    }

    query += ` ORDER BY e.id ASC`;

    const result = await pool.query(query, params);

    // 🟢 Calcular estado de mantenimiento
    const hoy = new Date();
    const equiposConEstado = result.rows.map(eq => {
      let estado = "SIN_DATOS";

      if (eq.proximo_mantenimiento) {
        const proxima = new Date(eq.proximo_mantenimiento);
        const diffDias = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24));

        if (diffDias > 10) {
          estado = "OK";
        } else if (diffDias > 0 && diffDias <= 10) {
          estado = "PRÓXIMO";
        } else {
          estado = "VENCIDO";
        }
      }

      return { ...eq, estado_mantenimiento: estado };
    });

    res.json(equiposConEstado);

  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener los equipos' });
  }
});



// Obtener un equipo por ID
app.get('/equipos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo,
        s.id AS id_sede, s.nombre AS sede_nombre
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      WHERE e.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener equipo por id:', error);
    res.status(500).json({ error: 'Error al obtener el equipo' });
  }
});

// crear equipo
// Crear un equipo
// Crear un equipo
app.post('/equipos', async (req, res) => {
  const {
    nombre,
    descripcion,
    codigo_interno,
    ubicacion_tipo,
    id_ubicacion,
    responsable_nombre,
    responsable_documento,
    id_tipo_equipo,
    campos_personalizados,
    intervalo_dias,                // 🟢 ahora sí lo leemos del body
    fecha_inicio_mantenimiento     // 🟢 ahora sí lo leemos del body
  } = req.body;

  try {
    let id_area = null;
    let id_puesto = null;
    let final_responsable_nombre = responsable_nombre;
    let final_responsable_documento = responsable_documento;

    // Obtener IDs de área o puesto según la ubicación
    if (ubicacion_tipo === 'puesto') {
      const puesto = await pool.query(
        'SELECT id_area, responsable_nombre, responsable_documento FROM puestos_trabajo WHERE id=$1',
        [id_ubicacion]
      );
      if (puesto.rows.length === 0)
        return res.status(404).json({ msg: 'Puesto no encontrado' });

      id_puesto = id_ubicacion;
      id_area = puesto.rows[0].id_area;

      if (!final_responsable_nombre) final_responsable_nombre = puesto.rows[0].responsable_nombre;
      if (!final_responsable_documento) final_responsable_documento = puesto.rows[0].responsable_documento;

    } else if (ubicacion_tipo === 'area') {
      const area = await pool.query('SELECT id FROM areas WHERE id=$1', [id_ubicacion]);
      if (area.rows.length === 0)
        return res.status(404).json({ msg: 'Área no encontrada' });

      id_area = id_ubicacion;
    } else {
      return res.status(400).json({ msg: 'Tipo de ubicación inválido' });
    }

    // Definir ubicación
    let ubicacion = (ubicacion_tipo === 'puesto') ? 'puesto' : 'area';

    // 🟢 Calcular próxima fecha de mantenimiento
    let proximo_mantenimiento = null;
    if (intervalo_dias && fecha_inicio_mantenimiento) {
      const inicio = new Date(fecha_inicio_mantenimiento);
      inicio.setDate(inicio.getDate() + parseInt(intervalo_dias));
      proximo_mantenimiento = inicio.toISOString().split('T')[0];
    }

    // 🟢 Insertar equipo con campos de mantenimiento incluidos
    const result = await pool.query(
      `INSERT INTO equipos
      (nombre, descripcion, codigo_interno, ubicacion, id_area, id_puesto,
       responsable_nombre, responsable_documento, id_tipo_equipo,
       intervalo_dias, fecha_inicio_mantenimiento, proximo_mantenimiento)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        nombre, descripcion, codigo_interno, ubicacion, id_area, id_puesto,
        final_responsable_nombre, final_responsable_documento, id_tipo_equipo,
        intervalo_dias, fecha_inicio_mantenimiento, proximo_mantenimiento
      ]
    );

    const id_equipo = result.rows[0].id;

    // Guardar valores personalizados
    for (const [nombreCampo, valor] of Object.entries(campos_personalizados || {})) {
      const campoRes = await pool.query(
        'SELECT id FROM campos_personalizados WHERE nombre_campo=$1 AND id_tipo_equipo=$2',
        [nombreCampo, id_tipo_equipo]
      );
      if (campoRes.rows.length > 0) {
        await pool.query(
          'INSERT INTO valores_personalizados (id_equipo, id_campo, valor) VALUES ($1, $2, $3)',
          [id_equipo, campoRes.rows[0].id, valor]
        );
      }
    }

    res.status(201).json({ msg: 'Equipo creado correctamente', equipo: result.rows[0] });

  } catch (err) {
    console.error("Error al crear equipo:", err);
    res.status(500).json({ msg: err.message, stack: err.stack });
  }
});



// Actualizar un equipo
app.put('/equipos/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    descripcion,
    codigo_interno,
    ubicacion,
    id_area,
    id_puesto,
    responsable_nombre,
    responsable_documento,
    id_tipo_equipo
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE equipos
       SET nombre=$1, descripcion=$2, codigo_interno=$3, ubicacion=$4,
           id_area=$5, id_puesto=$6, responsable_nombre=$7, responsable_documento=$8, id_tipo_equipo=$9
       WHERE id=$10
       RETURNING *`,
      [nombre, descripcion, codigo_interno, ubicacion, id_area, id_puesto, responsable_nombre, responsable_documento, id_tipo_equipo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    res.json({ message: 'Equipo actualizado correctamente', equipo: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar equipo:', error);
    res.status(500).json({ error: 'Error al actualizar el equipo' });
  }
});

// Eliminar un equipo
app.delete('/equipos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM equipos WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    res.json({ message: 'Equipo eliminado correctamente', equipo: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar equipo:', error);
    res.status(500).json({ error: 'Error al eliminar el equipo' });
  }
});


// ========================= TIPO DE EQUIPO Y CAMPOS PERSONALIZADOS =========================
// POST /tipos-equipo
app.post("/tipos-equipo", async (req, res) => {
  const { nombre, campos } = req.body;

  if (!nombre || !campos || campos.length === 0) {
    return res.status(400).json({ msg: "Datos incompletos" });
  }

  try {
    // 1️⃣ Guardar el tipo de equipo y obtener su ID
    const tipoRes = await pool.query(
      "INSERT INTO tipos_equipo(nombre) VALUES($1) RETURNING id",
      [nombre]
    );
    const id_tipo_equipo = tipoRes.rows[0].id;

    // 2️⃣ Guardar campos personalizados
    const insertCampos = campos.map(campo =>
      pool.query(
        "INSERT INTO campos_personalizados(nombre_campo, tipo_dato, id_tipo_equipo) VALUES($1, $2, $3)",
        [campo.nombre, campo.tipo_dato || "texto", id_tipo_equipo]
      )
    );

    await Promise.all(insertCampos);

    res.json({ msg: "Tipo de equipo y campos guardados correctamente", id_tipo_equipo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al guardar tipo de equipo" });
  }
});


// GET /tipos-equipo
app.get("/tipos-equipo", async (req, res) => {
  try {
    const tiposRes = await pool.query("SELECT * FROM tipos_equipo ORDER BY id");
    const tipos = tiposRes.rows;

    for (let tipo of tipos) {
      const camposRes = await pool.query(
        "SELECT * FROM campos_personalizados WHERE id_tipo_equipo = $1 ORDER BY id",
        [tipo.id]
      );
      tipo.campos = camposRes.rows;
    }

    res.json(tipos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener tipos de equipo" });
  }
});






// Obtener información de ubicación (puesto o área) para autocompletar responsable y código
app.get('/ubicacion/:tipo/:id', async (req, res) => {
  const { tipo, id } = req.params;
  try {
    if (tipo === 'puesto') {
      const result = await pool.query(
        `SELECT codigo, responsable_nombre FROM puestos_trabajo WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ msg: 'Puesto no encontrado' });
      return res.json(result.rows[0]);
    } else if (tipo === 'area') {
      const result = await pool.query(
        `SELECT codigo, nombre AS responsable_nombre FROM areas WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ msg: 'Área no encontrada' });
      return res.json(result.rows[0]);
    } else {
      return res.status(400).json({ msg: 'Tipo de ubicación inválido' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener ubicación' });
  }
});





// ========================= MANTENIMIENTOS PREVENTIVOS =========================

// Registrar un mantenimiento preventivo (cuando validas)
app.post('/mantenimientos/preventivos', async (req, res) => {
  const { id_equipo, realizado_por } = req.body;

  try {
    const hoy = new Date().toISOString().split("T")[0];

    // Guardar mantenimiento
    const insert = await pool.query(
      `INSERT INTO mantenimientos_preventivos (id_equipo, fecha, realizado_por)
       VALUES ($1, $2, $3) RETURNING *`,
      [id_equipo, hoy, realizado_por]
    );

    // Buscar datos del equipo para recalcular próximo mantenimiento
    const eqRes = await pool.query(
      `SELECT intervalo_dias FROM equipos WHERE id=$1`,
      [id_equipo]
    );

    if (eqRes.rows.length === 0) {
      return res.status(404).json({ msg: "Equipo no encontrado" });
    }

    const intervalo = eqRes.rows[0].intervalo_dias;
    let proximo_mantenimiento = null;
    if (intervalo) {
      const proxima = new Date(hoy);
      proxima.setDate(proxima.getDate() + intervalo);
      proximo_mantenimiento = proxima.toISOString().split("T")[0];
    }

    // Actualizar equipo con nueva fecha de próximo mantenimiento
    await pool.query(
      `UPDATE equipos SET proximo_mantenimiento=$1 WHERE id=$2`,
      [proximo_mantenimiento, id_equipo]
    );

    res.json({
      msg: "Mantenimiento preventivo registrado",
      mantenimiento: insert.rows[0],
      proximo_mantenimiento
    });

  } catch (err) {
    console.error("Error al registrar mantenimiento preventivo:", err);
    res.status(500).json({ msg: "Error al registrar mantenimiento preventivo" });
  }
});

// Historial de mantenimientos preventivos de un equipo
app.get('/mantenimientos/preventivos/:id_equipo', async (req, res) => {
  try {
    const { id_equipo } = req.params;
    const result = await pool.query(
      `SELECT * FROM mantenimientos_preventivos WHERE id_equipo=$1 ORDER BY fecha DESC`,
      [id_equipo]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener mantenimientos preventivos:", err);
    res.status(500).json({ msg: "Error al obtener mantenimientos preventivos" });
  }
});


// ========================= MANTENIMIENTOS CORRECTIVOS =========================

// Registrar un correctivo
app.post('/mantenimientos/correctivos', async (req, res) => {
  const { id_equipo, descripcion, realizado_por, observaciones } = req.body;

  try {
    const insert = await pool.query(
      `INSERT INTO mantenimientos_correctivos (id_equipo, fecha, descripcion, realizado_por, observaciones)
       VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
      [id_equipo, descripcion, realizado_por, observaciones]
    );

    res.json({
      msg: "Mantenimiento correctivo registrado",
      mantenimiento: insert.rows[0]
    });
  } catch (err) {
    console.error("Error al registrar mantenimiento correctivo:", err);
    res.status(500).json({ msg: "Error al registrar mantenimiento correctivo" });
  }
});

// Historial correctivos de un equipo
app.get('/mantenimientos/correctivos/:id_equipo', async (req, res) => {
  try {
    const { id_equipo } = req.params;
    const result = await pool.query(
      `SELECT * FROM mantenimientos_correctivos WHERE id_equipo=$1 ORDER BY fecha DESC`,
      [id_equipo]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener mantenimientos correctivos:", err);
    res.status(500).json({ msg: "Error al obtener mantenimientos correctivos" });
  }
});



// ========================= EQUIPOS CON CAMPOS PERSONALIZADOS =========================

// Obtener un equipo por ID (con campos personalizados + mantenimiento)
app.get('/equipos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Traemos los datos principales del equipo
    const result = await pool.query(`
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo,
        e.intervalo_dias, e.fecha_inicio_mantenimiento, e.proximo_mantenimiento,
        s.id AS id_sede, s.nombre AS sede_nombre
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      WHERE e.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    const equipo = result.rows[0];

    // 🟢 Traemos valores personalizados del equipo
    const camposRes = await pool.query(`
      SELECT c.nombre_campo, v.valor
      FROM valores_personalizados v
      JOIN campos_personalizados c ON v.id_campo = c.id
      WHERE v.id_equipo = $1
    `, [id]);

    equipo.campos_personalizados = {};
    camposRes.rows.forEach(c => {
      equipo.campos_personalizados[c.nombre_campo] = c.valor;
    });

    // 🟢 Calcular estado de mantenimiento
    let estado = "SIN_DATOS";
    if (equipo.proximo_mantenimiento) {
      const hoy = new Date();
      const proxima = new Date(equipo.proximo_mantenimiento);
      const diffDias = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24));

      if (diffDias > 10) {
        estado = "OK";
      } else if (diffDias > 0 && diffDias <= 10) {
        estado = "PRÓXIMO";
      } else {
        estado = "VENCIDO";
      }
    }
    equipo.estado_mantenimiento = estado;

    res.json(equipo);

  } catch (error) {
    console.error('Error al obtener equipo con campos personalizados:', error);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});





// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
