import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

app.use(cors());
app.use(express.json());

// --- Database Logic ---
let pool: mysql.Pool | null = null;

async function getDb() {
  if (!pool) {
    const config = {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    };

    if (!config.host || !config.user || !config.database) {
      console.warn('MySQL environment variables missing. Falling back to memory-based auth for demo.');
      return null;
    }

    try {
      pool = mysql.createPool(config);
      await pool.getConnection(); // Test connection
      console.log('Connected to MySQL successfully.');
      await initializeDatabase(pool);
    } catch (err) {
      console.error('Failed to connect to MySQL:', err);
      pool = null;
      return null;
    }
  }
  return pool;
}

async function initializeDatabase(db: mysql.Pool) {
  try {
    // Create Users Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') NOT NULL
      )
    `);

    // Create Tickets Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('open', 'pending', 'resolved', 'closed') DEFAULT 'open',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        category VARCHAR(50),
        assigned_to VARCHAR(36),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Messages Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        ticketId VARCHAR(36) NOT NULL,
        senderId VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed Demo Users
    const [adminRows]: any = await db.query('SELECT * FROM users WHERE email = ?', ['admin@zenith.com']);
    if (adminRows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)', 
        ['a1', 'admin@zenith.com', hashedPassword, 'Support Admin', 'admin']);
      console.log('Admin user seeded into database.');
    }

    const [userRows]: any = await db.query('SELECT * FROM users WHERE email = ?', ['user@example.com']);
    if (userRows.length === 0) {
      const hashedPassword = await bcrypt.hash('user123', 10);
      await db.query('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)', 
        ['u1', 'user@example.com', hashedPassword, 'Demo User', 'user']);
      console.log('Demo user seeded into database.');
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
  }
}

// --- Auth Middleware ---
const authenticateJWT = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// --- API Routes ---

// Create Ticket API
app.post('/api/tickets', authenticateJWT, async (req: any, res) => {
  const { subject, description, category, priority } = req.body;
  const userId = req.user.id;
  const ticketId = Math.random().toString(36).substr(2, 9);
  
  const db = await getDb();
  if (db) {
    try {
      await db.query(
        'INSERT INTO tickets (id, userId, subject, description, category, priority) VALUES (?, ?, ?, ?, ?, ?)',
        [ticketId, userId, subject, description, category, priority || 'medium']
      );
      return res.json({ id: ticketId, userId, subject, description, category, priority: priority || 'medium', status: 'open' });
    } catch (err) {
      console.error('Database create ticket error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  res.json({ id: ticketId, userId, subject, description, category, priority: priority || 'medium', status: 'open' });
});

// List Tickets API
app.get('/api/tickets', authenticateJWT, async (req: any, res) => {
  const db = await getDb();
  if (db) {
    try {
      let query = 'SELECT * FROM tickets';
      let params: any[] = [];
      
      if (req.user.role === 'user') {
        query += ' WHERE userId = ?';
        params.push(req.user.id);
      }
      
      query += ' ORDER BY createdAt DESC';
      const [rows] = await db.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error('Database list tickets error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  res.json([]); // Fallback to empty list or mock data could be handled here
});

// Get Ticket Detail API
app.get('/api/tickets/:id', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      const [rows]: any = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
      
      const ticket = rows[0];
      if (req.user.role === 'user' && ticket.userId !== req.user.id) {
        return res.sendStatus(403);
      }
      
      return res.json(ticket);
    } catch (err) {
      console.error('Database get ticket error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.status(404).json({ message: 'Not found in demo mode' });
});

// List Messages API
app.get('/api/tickets/:id/messages', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      const [rows] = await db.query('SELECT * FROM messages WHERE ticketId = ? ORDER BY createdAt ASC', [id]);
      return res.json(rows);
    } catch (err) {
      console.error('Database list messages error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json([]);
});

// Login API
app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  
  const db = await getDb();
  if (db) {
    try {
      const [rows]: any = await db.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role]);
      if (rows.length > 0) {
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
          const token = jwt.sign({ email, role, id: user.id }, JWT_SECRET, { expiresIn: '24h' });
          return res.json({ token, user: { email, role, id: user.id, name: user.name } });
        }
      }
      return res.status(401).json({ message: 'Invalid credentials' });
    } catch (err) {
      console.error('Database login error:', err);
      // Fallback is below
    }
  }

  // Fallback for demo when DB is not configured
  const isValid = (email === 'admin@zenith.com' && password === 'admin123' && role === 'admin') ||
                  (email === 'user@example.com' && password === 'user123' && role === 'user');

  if (isValid) {
    const token = jwt.sign({ email, role, id: role === 'admin' ? 'a1' : 'u1' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { email, role, id: role === 'admin' ? 'a1' : 'u1', name: role === 'admin' ? 'Support Admin' : 'Demo User' } });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Canned Responses API
app.get('/api/admin/canned-responses', authenticateJWT, (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/canned-responses.json'), 'utf-8'));
  res.json(data.responses);
});

// Assign Ticket API
app.patch('/api/tickets/:id/assign', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { id } = req.params;
  const { assignedTo } = req.body;
  
  const db = await getDb();
  if (db) {
    try {
      await db.query('UPDATE tickets SET assigned_to = ? WHERE id = ?', [assignedTo, id]);
      return res.json({ message: 'Ticket assigned successfully' });
    } catch (err) {
      console.error('Database assign error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  res.json({ message: 'Ticket assigned (demo mode)' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: pool ? 'connected' : 'disconnected' });
});

// --- Socket Intelligence ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (ticketId) => {
    socket.join(ticketId);
    console.log(`Socket ${socket.id} joined room: ${ticketId}`);
  });

  socket.on('typing', ({ ticketId, userId, isTyping }) => {
    socket.to(ticketId).emit('user-typing', { userId, isTyping });
  });

  socket.on('new-message', async (message) => {
    // Persist to DB if possible
    const db = await getDb();
    if (db) {
      try {
        await db.query(
          'INSERT INTO messages (id, ticketId, senderId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
          [message.id, message.ticketId, message.senderId, message.content, new Date(message.createdAt)]
        );
      } catch (err) {
        console.error('Failed to persist message via socket:', err);
      }
    }
    // Broadcast to the ticket room
    io.to(message.ticketId).emit('message-received', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
