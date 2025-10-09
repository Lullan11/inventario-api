require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ====================
// Ruta de prueba
// ====================
app.get("/", (req, res) => {
  res.send("¡La API está funcionando!");
});

// ====================
// OBTENER TODOS LOS USUARIOS
// ====================
app.get("/usuarios", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, documento, email, security_question FROM usuarios ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// ====================
// REGISTRAR USUARIO
// ====================
app.post("/usuarios", async (req, res) => {
  const { nombre, documento, email, password, security_question, security_answer } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedAnswer = await bcrypt.hash(security_answer, 10);

    const result = await pool.query(
      `INSERT INTO usuarios 
       (nombre, documento, email, password, security_question, security_answer) 
       VALUES ($1,$2,$3,$4,$5,$6) 
       RETURNING id, nombre, documento, email, security_question`,
      [nombre, documento, email, hashedPassword, security_question, hashedAnswer]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      res.status(400).json({ error: "El correo o documento ya están registrados" });
    } else {
      res.status(500).json({ error: "Error al registrar usuario" });
    }
  }
});

// ====================
// EDITAR USUARIO
// ====================
app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, documento, email, password, security_question, security_answer } = req.body;

  try {
    let query = "UPDATE usuarios SET nombre=$1, documento=$2, email=$3, security_question=$4";
    const params = [nombre, documento, email, security_question];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ", password=$5";
      params.push(hashedPassword);
    }

    if (security_answer) {
      const hashedAnswer = await bcrypt.hash(security_answer, 10);
      query += password ? ", security_answer=$6" : ", security_answer=$5";
      params.push(hashedAnswer);
    }

    query += " WHERE id=$" + (params.length + 1) + " RETURNING id, nombre, documento, email, security_question";
    params.push(id);

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// ====================
// ELIMINAR USUARIO
// ====================
app.delete("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM usuarios WHERE id=$1", [id]);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// ====================
// LOGIN DE USUARIO
// ====================
app.post("/usuarios/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM usuarios WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    const valid = await bcrypt.compare(password, usuario.password);
    if (!valid) return res.status(400).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET || "mi_secreto", { expiresIn: "1h" });
    res.json({
      message: "Login exitoso",
      usuario: { id: usuario.id, nombre: usuario.nombre, documento: usuario.documento, email: usuario.email },
      token,
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en login" });
  }
});

// ====================
// OBTENER PREGUNTA SECRETA
// ====================
app.post("/usuarios/get-security-question", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Correo electrónico es necesario." });

  try {
    const result = await pool.query("SELECT security_question FROM usuarios WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Usuario no encontrado" });

    res.json({ question: result.rows[0].security_question });
  } catch (error) {
    console.error("Error obteniendo pregunta secreta:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ====================
// VERIFICAR RESPUESTA SECRETA Y CAMBIAR CONTRASEÑA
// ====================
app.post("/usuarios/verify-security-answer", async (req, res) => {
  const { email, answer, newPassword } = req.body;

  if (!email || !answer || !newPassword)
    return res.status(400).json({ error: "Faltan parámetros" });

  try {
    const result = await pool.query("SELECT security_answer FROM usuarios WHERE email=$1", [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    const valid = await bcrypt.compare(answer, usuario.security_answer);
    if (!valid) return res.status(400).json({ error: "Respuesta incorrecta" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE usuarios SET password=$1 WHERE email=$2", [hashedPassword, email]);

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
// El endpoint /puestos debería incluir sede_nombre
app.get('/puestos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        a.nombre AS area_nombre,
        s.nombre AS sede_nombre,
        s.id AS sede_id
      FROM puestos_trabajo p
      LEFT JOIN areas a ON p.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      ORDER BY p.id ASC
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
// Obtener equipos con mantenimiento
// Obtener equipos con sus mantenimientos configurados
// Obtener equipos con sus mantenimientos configurados E IMÁGENES
app.get('/equipos', async (req, res) => {
  const { puesto_id } = req.query;
  try {
    let query = `
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo,
        s.id AS id_sede, s.nombre AS sede_nombre,
        te.nombre AS tipo_equipo_nombre,
        e.estado,
        e.imagen_url, e.imagen_public_id  -- 🆕 INCLUIR CAMPOS DE IMAGEN
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      LEFT JOIN tipos_equipo te ON e.id_tipo_equipo = te.id
      WHERE e.estado = 'activo'
    `;

    const params = [];
    if (puesto_id) {
      query += ` AND e.id_puesto = $1`;
      params.push(puesto_id);
    }

    query += ` ORDER BY e.id ASC`;
    const result = await pool.query(query, params);

    // Para cada equipo, obtener sus mantenimientos configurados
    const equiposConMantenimientos = await Promise.all(
      result.rows.map(async (equipo) => {
        // Obtener configuraciones de mantenimiento del equipo
        const mantConfigRes = await pool.query(
          `SELECT em.*, tm.nombre as tipo_mantenimiento_nombre
           FROM equipos_mantenimientos em
           LEFT JOIN tipos_mantenimiento tm ON em.id_tipo_mantenimiento = tm.id
           WHERE em.id_equipo = $1 AND em.activo = true`,
          [equipo.id]
        );

        equipo.mantenimientos_configurados = mantConfigRes.rows;

        // Calcular estado general (tomando el más urgente)
        let estadoGeneral = "OK";
        const hoy = new Date();

        mantConfigRes.rows.forEach(mant => {
          if (mant.proxima_fecha) {
            const proxima = new Date(mant.proxima_fecha);
            const diffDias = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24));

            if (diffDias <= 0 && estadoGeneral !== "VENCIDO") {
              estadoGeneral = "VENCIDO";
            } else if (diffDias <= 10 && estadoGeneral === "OK") {
              estadoGeneral = "PRÓXIMO";
            }
          }
        });

        equipo.estado_mantenimiento = estadoGeneral;
        return equipo;
      })
    );

    res.json(equiposConMantenimientos);
  } catch (error) {
    console.error('Error al obtener equipos:', error);
    res.status(500).json({ error: 'Error al obtener los equipos' });
  }
});

// ========================= EQUIPOS =========================

// Crear equipo con mantenimientos - VERSIÓN CORREGIDA
// Crear equipo con mantenimientos - VERSIÓN CORREGIDA
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
    mantenimientos,
    imagen_url,
    imagen_public_id
  } = req.body;

  console.log('📥 Datos recibidos para crear equipo:', {
    nombre,
    codigo_interno,
    imagen_url: imagen_url ? 'PRESENTE' : 'NO HAY',
    imagen_public_id: imagen_public_id ? 'PRESENTE' : 'NO HAY'
  });

  try {
    let id_area = null;
    let id_puesto = null;
    let final_responsable_nombre = responsable_nombre;
    let final_responsable_documento = responsable_documento;

    // Obtener IDs de área o puesto
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

    let ubicacion = (ubicacion_tipo === 'puesto') ? 'puesto' : 'area';

    // ✅ CORRECCIÓN: Query corregida con parámetros correctos
    const result = await pool.query(
      `INSERT INTO equipos
      (nombre, descripcion, codigo_interno, ubicacion, id_area, id_puesto,
       responsable_nombre, responsable_documento, id_tipo_equipo, estado,
       imagen_url, imagen_public_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        nombre, 
        descripcion, 
        codigo_interno, 
        ubicacion, 
        id_area, 
        id_puesto,
        final_responsable_nombre, 
        final_responsable_documento, 
        id_tipo_equipo,
        'activo',  // estado
        imagen_url || null,
        imagen_public_id || null
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

    // Guardar configuraciones de mantenimiento
    if (mantenimientos && mantenimientos.length > 0) {
      for (const mantenimiento of mantenimientos) {
        const proximaFecha = new Date(mantenimiento.fecha_inicio);
        proximaFecha.setDate(proximaFecha.getDate() + mantenimiento.intervalo_dias);

        await pool.query(
          `INSERT INTO equipos_mantenimientos 
          (id_equipo, id_tipo_mantenimiento, intervalo_dias, fecha_inicio, proxima_fecha, nombre_personalizado)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id_equipo,
            mantenimiento.id_tipo,
            mantenimiento.intervalo_dias,
            mantenimiento.fecha_inicio,
            proximaFecha.toISOString().split('T')[0],
            mantenimiento.nombre_personalizado || `${mantenimiento.tipo_nombre} ${mantenimiento.intervalo_dias}d`
          ]
        );
      }
    }

    console.log('✅ Equipo creado exitosamente:', {
      id: id_equipo,
      nombre,
      codigo_interno,
      imagen_url: imagen_url ? 'GUARDADA' : 'NO HAY'
    });

    res.status(201).json({
      msg: 'Equipo creado correctamente',
      equipo: result.rows[0],
      mantenimientos_configurados: mantenimientos
    });

  } catch (err) {
    console.error("❌ Error al crear equipo:", err);
    
    if (err.code === '23505') {
      return res.status(409).json({ 
        msg: 'El código del equipo ya existe en el sistema' 
      });
    } else if (err.code === '23503') {
      return res.status(400).json({ 
        msg: 'Datos de referencia inválidos (tipo de equipo, área o puesto no existe)' 
      });
    }
    
    res.status(500).json({ 
      msg: 'Error interno del servidor al crear equipo',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Actualizar un equipo (versión mejorada) - CORREGIDA
// Actualizar un equipo - VERSIÓN SIMPLIFICADA
app.put('/equipos/:id', async (req, res) => {
  const { id } = req.params;
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
    estado,
    imagen_url,           // 🆕 Puede ser null para eliminar imagen
    imagen_public_id      // 🆕 Puede ser null para eliminar imagen
  } = req.body;

  console.log('📥 Datos recibidos para actualizar equipo:', {
    id,
    nombre,
    imagen_url: imagen_url ? 'PRESENTE' : 'ELIMINAR/SIN CAMBIOS',
    imagen_public_id: imagen_public_id ? 'PRESENTE' : 'ELIMINAR/SIN CAMBIOS'
  });

  try {
    let id_area = null;
    let id_puesto = null;
    let final_responsable_nombre = responsable_nombre;
    let final_responsable_documento = responsable_documento || "N/A";

    // Obtener IDs de área o puesto (código existente)
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

    let ubicacion = (ubicacion_tipo === 'puesto') ? 'puesto' : 'area';

    // 🆕 Obtener imagen actual ANTES de actualizar (para cleanup opcional)
    const equipoActual = await pool.query(
      'SELECT imagen_public_id FROM equipos WHERE id = $1',
      [id]
    );

    const publicIdAnterior = equipoActual.rows[0]?.imagen_public_id;

    // 🆕 ACTUALIZAR EQUIPO (incluye manejo de imagen)
    const result = await pool.query(
      `UPDATE equipos
       SET nombre=$1, descripcion=$2, codigo_interno=$3, ubicacion=$4,
           id_area=$5, id_puesto=$6, responsable_nombre=$7, responsable_documento=$8, 
           id_tipo_equipo=$9, estado=$10, imagen_url=$11, imagen_public_id=$12
       WHERE id=$13
       RETURNING *`,
      [
        nombre, descripcion, codigo_interno, ubicacion, id_area, id_puesto,
        final_responsable_nombre, final_responsable_documento, id_tipo_equipo,
        estado, 
        imagen_url,      // ✅ Puede ser null (eliminar imagen)
        imagen_public_id, // ✅ Puede ser null (eliminar imagen)
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado' });
    }

    // 🆕 CLEANUP OPCIONAL: Eliminar imagen anterior de Cloudinary si fue reemplazada
    if (publicIdAnterior && publicIdAnterior !== imagen_public_id) {
      console.log('🔄 Imagen reemplazada, eliminando anterior de Cloudinary:', publicIdAnterior);
      
      // ⚠️ OPCIONAL: Descomenta si quieres auto-eliminar imágenes antiguas
      /*
      try {
        const cloudinary = require('cloudinary').v2;
        await cloudinary.uploader.destroy(publicIdAnterior);
        console.log('✅ Imagen anterior eliminada de Cloudinary');
      } catch (cloudinaryError) {
        console.warn('⚠️ No se pudo eliminar imagen anterior de Cloudinary:', cloudinaryError);
        // No falla la operación principal por esto
      }
      */
    }

    // Actualizar valores personalizados (código existente)
    if (campos_personalizados) {
      await pool.query(
        'DELETE FROM valores_personalizados WHERE id_equipo = $1',
        [id]
      );

      for (const [nombreCampo, valor] of Object.entries(campos_personalizados)) {
        const campoRes = await pool.query(
          'SELECT id FROM campos_personalizados WHERE nombre_campo=$1 AND id_tipo_equipo=$2',
          [nombreCampo, id_tipo_equipo]
        );
        if (campoRes.rows.length > 0) {
          await pool.query(
            'INSERT INTO valores_personalizados (id_equipo, id_campo, valor) VALUES ($1, $2, $3)',
            [id, campoRes.rows[0].id, valor]
          );
        }
      }
    }

    console.log('✅ Equipo actualizado exitosamente:', {
      id,
      nombre,
      imagen_actualizada: imagen_url ? 'NUEVA' : (imagen_url === null ? 'ELIMINADA' : 'SIN CAMBIOS')
    });

    res.json({ 
      message: 'Equipo actualizado correctamente', 
      equipo: result.rows[0] 
    });

  } catch (error) {
    console.error('❌ Error al actualizar equipo:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({ 
        message: 'El código del equipo ya existe en el sistema' 
      });
    }
    
    res.status(500).json({ 
      error: 'Error al actualizar el equipo',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Obtener un equipo por ID con todos sus datos (incluyendo mantenimientos configurados)
app.get('/equipos/:id/completo', async (req, res) => {
  const { id } = req.params;
  try {
    // Traemos los datos principales del equipo
    const result = await pool.query(`
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo, te.nombre AS tipo_equipo_nombre,
        s.id AS id_sede, s.nombre AS sede_nombre,
        e.estado
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      LEFT JOIN tipos_equipo te ON e.id_tipo_equipo = te.id
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

    // 🟢 Traemos mantenimientos configurados del equipo
    const mantenimientosRes = await pool.query(`
      SELECT em.*, tm.nombre as tipo_mantenimiento_nombre
      FROM equipos_mantenimientos em
      LEFT JOIN tipos_mantenimiento tm ON em.id_tipo_mantenimiento = tm.id
      WHERE em.id_equipo = $1 AND em.activo = true
      ORDER BY em.id
    `, [id]);

    equipo.mantenimientos_configurados = mantenimientosRes.rows;

    res.json(equipo);

  } catch (error) {
    console.error('Error al obtener equipo completo:', error);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});






// ========================= INACTIVACIÓN DE EQUIPOS =========================

// Inactivar equipo (cambiar estado a 'inactivo')
app.put('/equipos/:id/inactivar', async (req, res) => {
  const { id } = req.params;
  const { motivo, observaciones, fecha_baja, realizado_por } = req.body;

  try {
    // Verificar que el equipo existe
    const equipoRes = await pool.query('SELECT * FROM equipos WHERE id = $1', [id]);
    if (equipoRes.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    // Actualizar estado del equipo
    const result = await pool.query(
      'UPDATE equipos SET estado = $1 WHERE id = $2 RETURNING *',
      ['inactivo', id]
    );

    // Registrar historial de baja
    await pool.query(
      `INSERT INTO historial_bajas_equipos 
      (id_equipo, motivo, observaciones, fecha_baja, realizado_por)
      VALUES ($1, $2, $3, $4, $5)`,
      [id, motivo, observaciones, fecha_baja || new Date(), realizado_por]
    );

    res.json({
      message: 'Equipo inactivado correctamente',
      equipo: result.rows[0]
    });

  } catch (error) {
    console.error('Error al inactivar equipo:', error);
    res.status(500).json({ error: 'Error al inactivar el equipo' });
  }
});

// Obtener equipos inactivos
app.get('/equipos/inactivos', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id, e.nombre, e.descripcion, e.codigo_interno, e.ubicacion,
        e.responsable_nombre, e.responsable_documento,
        e.id_area, a.nombre AS area_nombre,
        e.id_puesto, p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        e.id_tipo_equipo, te.nombre AS tipo_equipo_nombre,
        s.id AS id_sede, s.nombre AS sede_nombre,
        e.estado,
        hb.motivo, hb.observaciones, hb.fecha_baja, hb.realizado_por
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      LEFT JOIN tipos_equipo te ON e.id_tipo_equipo = te.id
      LEFT JOIN historial_bajas_equipos hb ON e.id = hb.id_equipo
      WHERE e.estado = 'inactivo'
      ORDER BY hb.fecha_baja DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener equipos inactivos:', error);
    res.status(500).json({ error: 'Error al obtener equipos inactivos' });
  }
});

// Obtener datos completos de equipo inactivo para PDF
app.get('/equipos/:id/inactivo-completo', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        e.*,
        a.nombre AS area_nombre,
        p.codigo AS puesto_codigo, p.responsable_nombre AS puesto_responsable,
        s.nombre AS sede_nombre,
        te.nombre AS tipo_equipo_nombre,
        hb.motivo, hb.observaciones, hb.fecha_baja, hb.realizado_por
      FROM equipos e
      LEFT JOIN areas a ON e.id_area = a.id
      LEFT JOIN puestos_trabajo p ON e.id_puesto = p.id
      LEFT JOIN sedes s ON a.id_sede = s.id
      LEFT JOIN tipos_equipo te ON e.id_tipo_equipo = te.id
      LEFT JOIN historial_bajas_equipos hb ON e.id = hb.id_equipo
      WHERE e.id = $1 AND e.estado = 'inactivo'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo inactivo no encontrado' });
    }

    const equipo = result.rows[0];

    // Obtener valores personalizados
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

    // Obtener historial de mantenimientos
    const mantenimientosRes = await pool.query(`
      SELECT m.*, tm.nombre as tipo_mantenimiento
      FROM mantenimientos m
      LEFT JOIN tipos_mantenimiento tm ON m.id_tipo = tm.id
      WHERE m.id_equipo = $1
      ORDER BY m.fecha_realizado DESC
    `, [id]);

    equipo.historial_mantenimientos = mantenimientosRes.rows;

    res.json(equipo);

  } catch (error) {
    console.error('Error al obtener equipo inactivo completo:', error);
    res.status(500).json({ error: 'Error al obtener equipo inactivo' });
  }
});








// ========================= CONFIGURACIÓN DE MANTENIMIENTOS POR EQUIPO =========================

// Obtener mantenimientos configurados para un equipo
app.get('/equipos/:id/mantenimientos', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT em.*, tm.nombre as tipo_mantenimiento_nombre
       FROM equipos_mantenimientos em
       LEFT JOIN tipos_mantenimiento tm ON em.id_tipo_mantenimiento = tm.id
       WHERE em.id_equipo = $1 AND em.activo = true
       ORDER BY em.proxima_fecha ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener mantenimientos del equipo:', error);
    res.status(500).json({ error: 'Error al obtener mantenimientos del equipo' });
  }
});

// Agregar mantenimiento a un equipo
app.post('/equipos/:id/mantenimientos', async (req, res) => {
  const { id } = req.params;
  const { id_tipo_mantenimiento, intervalo_dias, fecha_inicio } = req.body;

  try {
    // Calcular próxima fecha
    const proximaFecha = new Date(fecha_inicio);
    proximaFecha.setDate(proximaFecha.getDate() + intervalo_dias);

    const result = await pool.query(
      `INSERT INTO equipos_mantenimientos 
      (id_equipo, id_tipo_mantenimiento, intervalo_dias, fecha_inicio, proxima_fecha)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [id, id_tipo_mantenimiento, intervalo_dias, fecha_inicio, proximaFecha.toISOString().split('T')[0]]
    );

    res.status(201).json({
      msg: 'Mantenimiento configurado correctamente',
      mantenimiento: result.rows[0]
    });
  } catch (error) {
    console.error('Error al configurar mantenimiento:', error);
    res.status(500).json({ error: 'Error al configurar mantenimiento' });
  }
});

// ========================= EJECUCIÓN DE MANTENIMIENTOS =========================

// Registrar mantenimiento realizado
app.post('/mantenimientos', async (req, res) => {
  const {
    id_equipo,
    id_tipo_mantenimiento,
    fecha_realizado,
    descripcion,
    realizado_por,
    observaciones
  } = req.body;

  try {
    // 1. Registrar en historial
    const result = await pool.query(
      `INSERT INTO mantenimientos 
      (id_equipo, id_tipo, fecha_programada, fecha_realizado, descripcion, realizado_por, observaciones, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'realizado')
      RETURNING *`,
      [id_equipo, id_tipo_mantenimiento, fecha_realizado, fecha_realizado, descripcion, realizado_por, observaciones]
    );

    // 2. Actualizar próxima fecha en la configuración
    const configRes = await pool.query(
      `SELECT intervalo_dias FROM equipos_mantenimientos 
       WHERE id_equipo = $1 AND id_tipo_mantenimiento = $2 AND activo = true`,
      [id_equipo, id_tipo_mantenimiento]
    );

    if (configRes.rows.length > 0) {
      const intervalo = configRes.rows[0].intervalo_dias;
      const proximaFecha = new Date(fecha_realizado);
      proximaFecha.setDate(proximaFecha.getDate() + intervalo);

      await pool.query(
        `UPDATE equipos_mantenimientos 
         SET fecha_inicio = $1, proxima_fecha = $2
         WHERE id_equipo = $3 AND id_tipo_mantenimiento = $4 AND activo = true`,
        [fecha_realizado, proximaFecha.toISOString().split('T')[0], id_equipo, id_tipo_mantenimiento]
      );
    }

    res.status(201).json({
      msg: 'Mantenimiento registrado correctamente',
      mantenimiento: result.rows[0],
      proxima_fecha_calculada: proximaFecha ? proximaFecha.toISOString().split('T')[0] : null
    });

  } catch (error) {
    console.error('Error al registrar mantenimiento:', error);
    res.status(500).json({ error: 'Error al registrar mantenimiento' });
  }
});

// Obtener historial de mantenimientos de un equipo
app.get('/mantenimientos/equipo/:id_equipo', async (req, res) => {
  try {
    const { id_equipo } = req.params;
    const result = await pool.query(
      `SELECT m.*, tm.nombre as tipo_mantenimiento 
       FROM mantenimientos m
       LEFT JOIN tipos_mantenimiento tm ON m.id_tipo = tm.id
       WHERE m.id_equipo = $1 
       ORDER BY m.fecha_realizado DESC, m.fecha_programada DESC`,
      [id_equipo]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener mantenimientos:', error);
    res.status(500).json({ error: 'Error al obtener mantenimientos' });
  }
});



// ========================= ELIMINACIÓN DE MANTENIMIENTOS =========================

// Eliminar todos los mantenimientos de un equipo
app.delete('/equipos/:id/mantenimientos', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM equipos_mantenimientos WHERE id_equipo = $1 RETURNING *',
      [id]
    );
    
    res.json({
      message: 'Mantenimientos eliminados correctamente',
      eliminados: result.rows.length
    });
  } catch (error) {
    console.error('Error al eliminar mantenimientos:', error);
    res.status(500).json({ error: 'Error al eliminar mantenimientos' });
  }
});

// Eliminar un mantenimiento específico por ID
app.delete('/mantenimientos-programados/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM equipos_mantenimientos WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    }
    
    res.json({
      message: 'Mantenimiento eliminado correctamente',
      mantenimiento: result.rows[0]
    });
  } catch (error) {
    console.error('Error al eliminar mantenimiento:', error);
    res.status(500).json({ error: 'Error al eliminar mantenimiento' });
  }
});

// Actualizar un mantenimiento existente
app.put('/mantenimientos-programados/:id', async (req, res) => {
  const { id } = req.params;
  const { id_tipo_mantenimiento, intervalo_dias, fecha_inicio, nombre_personalizado } = req.body;
  
  try {
    // Calcular próxima fecha
    const proximaFecha = new Date(fecha_inicio);
    proximaFecha.setDate(proximaFecha.getDate() + intervalo_dias);

    const result = await pool.query(
      `UPDATE equipos_mantenimientos 
       SET id_tipo_mantenimiento = $1, intervalo_dias = $2, fecha_inicio = $3, 
           proxima_fecha = $4, nombre_personalizado = $5
       WHERE id = $6 
       RETURNING *`,
      [id_tipo_mantenimiento, intervalo_dias, fecha_inicio, 
       proximaFecha.toISOString().split('T')[0], nombre_personalizado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    }

    res.json({
      message: 'Mantenimiento actualizado correctamente',
      mantenimiento: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar mantenimiento:', error);
    res.status(500).json({ error: 'Error al actualizar mantenimiento' });
  }
});



// ========================= TIPOS DE MANTENIMIENTO =========================

// Obtener tipos de mantenimiento (EXCLUYENDO Correctivo)
app.get('/tipos-mantenimiento', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tipos_mantenimiento WHERE LOWER(nombre) != $1 ORDER BY id',
      ['correctivo']
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener tipos de mantenimiento:', error);
    res.status(500).json({ error: 'Error al obtener tipos de mantenimiento' });
  }
});

// Obtener TODOS los tipos de mantenimiento (incluyendo Correctivo para otros usos)
app.get('/tipos-mantenimiento/todos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_mantenimiento ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener tipos de mantenimiento:', error);
    res.status(500).json({ error: 'Error al obtener tipos de mantenimiento' });
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

// DELETE /tipos-equipo/:id
app.delete("/tipos-equipo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Borrar los campos personalizados asociados
    await pool.query("DELETE FROM campos_personalizados WHERE id_tipo_equipo = $1", [id]);

    // 2️⃣ Borrar el tipo de equipo
    const result = await pool.query("DELETE FROM tipos_equipo WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: "Tipo de equipo no encontrado" });
    }

    res.json({ msg: "Tipo de equipo eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar tipo de equipo" });
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
