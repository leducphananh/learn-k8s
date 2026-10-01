const http = require('http');
const { Client } = require('pg');

const PORT = process.env.PORT || 3000;

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'app',
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'app',
});

async function connectDatabase() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('Database connection failed:', error.message);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
    });

    res.end(
      JSON.stringify({
        status: 'ok',
      }),
    );

    return;
  }

  if (req.url === '/db') {
    try {
      const result = await client.query('SELECT NOW()');

      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      res.end(
        JSON.stringify({
          database: 'connected',
          time: result.rows[0].now,
        }),
      );
    } catch (error) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
      });

      res.end(
        JSON.stringify({
          database: 'error',
          message: error.message,
        }),
      );
    }

    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      message: 'Hello from Docker Compose!',
      environment: process.env.APP_ENV,
    }),
  );
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});

connectDatabase();
