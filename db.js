
// Configuración de conexión a Neon (PostgreSQL)
const { Pool } = require('pg');

const pool = new Pool({
  user: 'neondb_owner',
  host: 'ep-lingering-dawn-aed5twil-pooler.c-2.us-east-2.aws.neon.tech',
  database: 'neondb',
  password: 'npg_VoAUH1XC3vqR',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;


