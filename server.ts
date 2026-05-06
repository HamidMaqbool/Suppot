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
import multer from 'multer';
import crypto from 'crypto';

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

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
        rating INT,
        feedback TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: ensure columns exist if table was created earlier
    try {
      await db.query('ALTER TABLE tickets ADD COLUMN rating INT');
      console.log('Added rating column to tickets table.');
    } catch (err: any) {
      if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
        console.error('Migration error (rating):', err);
      }
    }
    
    try {
      await db.query('ALTER TABLE tickets ADD COLUMN feedback TEXT');
      console.log('Added feedback column to tickets table.');
    } catch (err: any) {
      if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
        console.error('Migration error (feedback):', err);
      }
    }

    // Create Messages Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        ticketId VARCHAR(36) NOT NULL,
        senderId VARCHAR(36) NOT NULL,
        content TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Attachments Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id VARCHAR(36) PRIMARY KEY,
        ticketId VARCHAR(36) NOT NULL,
        messageId VARCHAR(36),
        fileName VARCHAR(255) NOT NULL,
        fileUrl VARCHAR(500) NOT NULL,
        fileType VARCHAR(100),
        fileSize INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Tags Tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(20) DEFAULT '#000000'
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS ticket_tags (
        ticketId VARCHAR(36) NOT NULL,
        tagId VARCHAR(36) NOT NULL,
        PRIMARY KEY (ticketId, tagId)
      )
    `);

    // Create Secure Links Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS secure_links (
        token VARCHAR(128) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE
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
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length < 2) return res.sendStatus(401);
    const token = parts[1];
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

// File Upload API
app.post('/api/upload', authenticateJWT, upload.single('file'), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  const { ticketId, messageId } = req.body;
  const fileUrl = `/uploads/${req.file.filename}`;
  const attachmentId = Math.random().toString(36).substr(2, 9);
  
  const db = await getDb();
  if (db && ticketId) {
    try {
      await db.query(
        'INSERT INTO attachments (id, ticketId, messageId, fileName, fileUrl, fileType, fileSize) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [attachmentId, ticketId, messageId || null, req.file.originalname, fileUrl, req.file.mimetype, req.file.size]
      );
    } catch (err) {
      console.error('Database attachment error:', err);
    }
  }
  
  res.json({ id: attachmentId, url: fileUrl, fileName: req.file.originalname });
});

// List Attachments API
app.get('/api/tickets/:id/attachments', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      const [rows] = await db.query('SELECT * FROM attachments WHERE ticketId = ?', [id]);
      return res.json(rows);
    } catch (err) {
      console.error('Database list attachments error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json([]);
});

// Tags API
app.get('/api/tags', authenticateJWT, async (req: any, res) => {
  const db = await getDb();
  if (db) {
    try {
      const [rows] = await db.query('SELECT * FROM tags');
      return res.json(rows);
    } catch (err) {
      console.error('Database list tags error:', err);
    }
  }
  res.json([{ id: 't1', name: 'Billing', color: '#3b82f6' }, { id: 't2', name: 'Technical', color: '#ef4444' }]);
});

app.post('/api/tickets/:id/tags', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;
  const { tagName, color } = req.body;
  
  const db = await getDb();
  if (db) {
    try {
      let tagId;
      const [tagRows]: any = await db.query('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (tagRows.length > 0) {
        tagId = tagRows[0].id;
      } else {
        tagId = Math.random().toString(36).substr(2, 9);
        await db.query('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', [tagId, tagName, color || '#3b82f6']);
      }
      
      await db.query('REPLACE INTO ticket_tags (ticketId, tagId) VALUES (?, ?)', [id, tagId]);
      return res.json({ id: tagId, name: tagName, color: color || '#3b82f6' });
    } catch (err) {
      console.error('Database add tag error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ message: 'Tag added (demo mode)' });
});

app.get('/api/tickets/:id/tags', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const db = await getDb();
  if (db) {
    try {
      const [rows] = await db.query(`
        SELECT t.* FROM tags t
        JOIN ticket_tags tt ON t.id = tt.tagId
        WHERE tt.ticketId = ?
      `, [id]);
      return res.json(rows);
    } catch (err) {
      console.error('Database list ticket tags error:', err);
    }
  }
  res.json([]);
});

// Secure Login API
app.post('/api/auth/secure-link', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { userId } = req.body;
  
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
  
  const db = await getDb();
  if (db) {
    try {
      await db.query('INSERT INTO secure_links (token, userId, expiresAt) VALUES (?, ?, ?)', [token, userId, expiresAt]);
      return res.json({ token });
    } catch (err) {
      console.error('Database secure link error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ token: 'mock-secure-token' });
});

app.post('/api/auth/login-secure', async (req, res) => {
  const { token } = req.body;
  
  const db = await getDb();
  if (db) {
    try {
      const [rows]: any = await db.query(`
        SELECT u.*, sl.expiresAt, sl.used 
        FROM users u
        JOIN secure_links sl ON u.id = sl.userId
        WHERE sl.token = ? AND sl.expiresAt > NOW() AND sl.used = FALSE
      `, [token]);
      
      if (rows.length > 0) {
        const user = rows[0];
        await db.query('UPDATE secure_links SET used = TRUE WHERE token = ?', [token]);
        const jwtToken = jwt.sign({ email: user.email, role: user.role, id: user.id }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token: jwtToken, user: { email: user.email, role: user.role, id: user.id, name: user.name } });
      }
    } catch (err) {
      console.error('Database secure login error:', err);
    }
  }
  res.status(401).json({ message: 'Invalid or expired secure link' });
});

// User Management API
app.get('/api/admin/users', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  const db = await getDb();
  if (db) {
    try {
      const [countResult]: any = await db.query('SELECT COUNT(*) as total FROM users');
      const [rows] = await db.query('SELECT id, email, name, role FROM users LIMIT ? OFFSET ?', [limit, offset]);
      
      return res.json({
        users: rows,
        pagination: {
          total: countResult[0].total,
          page,
          limit,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      });
    } catch (err) {
      console.error('Database list users error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ users: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
});

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
      io.emit('new-ticket', { id: ticketId, subject, userId });
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

// Update Ticket Status API
app.patch('/api/tickets/:id/status', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const { id } = req.params;
  const { status } = req.body;
  
  const db = await getDb();
  if (db) {
    try {
      await db.query('UPDATE tickets SET status = ? WHERE id = ?', [status, id]);
      io.emit('ticket-status-updated', { id, status });
      return res.json({ message: `Ticket status updated to ${status}` });
    } catch (err) {
      console.error('Database status update error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  res.json({ message: 'Status updated (demo mode)' });
});

// Submit Feedback API
app.post('/api/tickets/:id/feedback', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const { rating, feedback } = req.body;
  const userId = req.user.id;

  const db = await getDb();
  if (db) {
    try {
      // Ensure the user owns the ticket
      const [ticketRows]: any = await db.query('SELECT userId FROM tickets WHERE id = ?', [id]);
      if (ticketRows.length === 0 || ticketRows[0].userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await db.query('UPDATE tickets SET rating = ?, feedback = ?, status = "resolved" WHERE id = ?', [rating, feedback, id]);
      io.emit('ticket-status-updated', { id, status: 'resolved' });
      return res.json({ message: 'Feedback submitted successfully. Ticket remains resolved.' });
    } catch (err) {
      console.error('Database feedback error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ message: 'Feedback submitted (demo mode)' });
});

// Reopen Ticket API
app.patch('/api/tickets/:id/reopen', authenticateJWT, async (req: any, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const db = await getDb();
  if (db) {
    try {
      // Check if user owns the ticket and it is resolved but feedback is pending
      const [ticketRows]: any = await db.query('SELECT userId, status, rating FROM tickets WHERE id = ?', [id]);
      if (ticketRows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
      
      const ticket = ticketRows[0];
      if (ticket.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (req.user.role !== 'admin' && (ticket.status !== 'resolved' || ticket.rating !== null)) {
        return res.status(400).json({ message: 'Cannot reopen ticket after feedback or if not resolved' });
      }

      await db.query('UPDATE tickets SET status = "open", rating = NULL, feedback = NULL WHERE id = ?', [id]);
      io.emit('ticket-status-updated', { id, status: 'open', rating: null, feedback: null });
      return res.json({ message: 'Ticket reopened successfully' });
    } catch (err) {
      console.error('Database reopen error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ message: 'Ticket reopened (demo mode)' });
});

// Delete Ticket API (with file cleanup)
app.delete('/api/tickets/:id', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  const { id } = req.params;

  const db = await getDb();
  if (db) {
    try {
      // 1. Get all attachments for this ticket
      const [attachments]: any = await db.query('SELECT filePath FROM attachments WHERE ticketId = ?', [id]);
      
      // 2. Delete physical files
      for (const attachment of attachments) {
        const fullPath = path.join(process.cwd(), attachment.filePath);
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (fileErr) {
          console.error(`Error deleting file ${fullPath}:`, fileErr);
        }
      }

      // 3. Delete from DB records
      await db.query('DELETE FROM attachments WHERE ticketId = ?', [id]);
      await db.query('DELETE FROM messages WHERE ticketId = ?', [id]);
      await db.query('DELETE FROM ticket_tags WHERE ticket_id = ?', [id]);
      await db.query('DELETE FROM tickets WHERE id = ?', [id]);

      return res.json({ message: 'Ticket and all associated files deleted successfully' });
    } catch (err) {
      console.error('Database delete error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ message: 'Ticket deleted (demo mode)' });
});

// Feedback Statistics API
app.get('/api/admin/feedback-stats', authenticateJWT, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 5;
  const offset = (page - 1) * limit;

  const db = await getDb();
  if (db) {
    try {
      const [statsRows]: any = await db.query(`
        SELECT 
          AVG(rating) as averageRating,
          COUNT(rating) as totalRatings,
          COUNT(*) as totalTickets
        FROM tickets
      `);
      
      const [totalFeedbackCount]: any = await db.query('SELECT COUNT(*) as total FROM tickets WHERE rating IS NOT NULL');
      
      const [latestFeedback]: any = await db.query(`
        SELECT t.id, t.rating, t.feedback, u.name as userName, t.subject
        FROM tickets t
        JOIN users u ON t.userId = u.id
        WHERE t.rating IS NOT NULL
        ORDER BY t.createdAt DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);
      
      return res.json({
        stats: statsRows[0],
        latestFeedback,
        pagination: {
          total: totalFeedbackCount[0].total,
          page,
          limit,
          totalPages: Math.ceil(totalFeedbackCount[0].total / limit)
        }
      });
    } catch (err) {
      console.error('Database feedback stats error:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  res.json({ stats: { averageRating: 0, totalRatings: 0, totalTickets: 0 }, latestFeedback: [], pagination: { total: 0, page: 1, limit: 5, totalPages: 0 } });
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
