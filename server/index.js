const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');
const cors = require('cors');
const { getRandomQuestion } = require('./quiz-questions');
const { QuizBattle } = require('./quiz-battle');

const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Avatar upload setup
const avatarDir = path.join(__dirname, 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir);
app.use('/avatars', express.static(avatarDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: avatarDir,
    filename: (req, file, cb) => cb(null, `${req.userId}-${Date.now()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

const JWT_SECRET = 'quiz-please-messenger-secret-2026';
const PORT = process.env.PORT || 3500;

// --- Database setup ---
const db = new Database(path.join(__dirname, 'messenger.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    passwordHash TEXT NOT NULL,
    avatarColor TEXT DEFAULT '#7C3AED',
    quizStreak INTEGER DEFAULT 0,
    totalQuizCorrect INTEGER DEFAULT 0,
    totalQuizAnswered INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    lastSeen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    userId TEXT NOT NULL,
    contactId TEXT NOT NULL,
    addedAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (userId, contactId),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (contactId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct', -- direct | group
    name TEXT,
    createdBy TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (createdBy) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chatId TEXT NOT NULL,
    odId TEXT NOT NULL,
    joinedAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chatId, odId),
    FOREIGN KEY (chatId) REFERENCES chats(id),
    FOREIGN KEY (odId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chatId TEXT NOT NULL,
    senderId TEXT NOT NULL,
    type TEXT DEFAULT 'text', -- text | quiz_start | quiz_result | system
    content TEXT NOT NULL,
    metadata TEXT, -- JSON for quiz data etc
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chatId) REFERENCES chats(id),
    FOREIGN KEY (senderId) REFERENCES users(id)
  );
`);

// Migration: add avatarUrl column
try { db.exec('ALTER TABLE users ADD COLUMN avatarUrl TEXT DEFAULT NULL'); } catch (e) { /* already exists */ }

// Prepared statements
const stmts = {
  createUser: db.prepare('INSERT INTO users (id, nickname, displayName, passwordHash, avatarColor) VALUES (?, ?, ?, ?, ?)'),
  getUserByNickname: db.prepare('SELECT * FROM users WHERE nickname = ?'),
  getUserById: db.prepare('SELECT id, nickname, displayName, avatarColor, avatarUrl, quizStreak, totalQuizCorrect, totalQuizAnswered, lastSeen FROM users WHERE id = ?'),
  updateLastSeen: db.prepare("UPDATE users SET lastSeen = datetime('now') WHERE id = ?"),
  updateQuizStats: db.prepare('UPDATE users SET quizStreak = ?, totalQuizCorrect = ?, totalQuizAnswered = ? WHERE id = ?'),
  searchUsers: db.prepare("SELECT id, nickname, displayName, avatarColor, avatarUrl FROM users WHERE nickname LIKE ? AND id != ? LIMIT 20"),
  addContact: db.prepare('INSERT OR IGNORE INTO contacts (userId, contactId) VALUES (?, ?)'),
  getContacts: db.prepare(`
    SELECT u.id, u.nickname, u.displayName, u.avatarColor, u.avatarUrl, u.lastSeen
    FROM contacts c JOIN users u ON c.contactId = u.id
    WHERE c.userId = ? ORDER BY u.displayName
  `),
  createChat: db.prepare('INSERT INTO chats (id, type, name, createdBy) VALUES (?, ?, ?, ?)'),
  addChatMember: db.prepare('INSERT OR IGNORE INTO chat_members (chatId, odId) VALUES (?, ?)'),
  getChatMembers: db.prepare(`
    SELECT u.id, u.nickname, u.displayName, u.avatarColor, u.avatarUrl
    FROM chat_members cm JOIN users u ON cm.odId = u.id
    WHERE cm.chatId = ?
  `),
  getUserChats: db.prepare(`
    SELECT c.*,
      (SELECT m.content FROM messages m WHERE m.chatId = c.id ORDER BY m.createdAt DESC LIMIT 1) as lastMessage,
      (SELECT m.createdAt FROM messages m WHERE m.chatId = c.id ORDER BY m.createdAt DESC LIMIT 1) as lastMessageAt,
      (SELECT m.senderId FROM messages m WHERE m.chatId = c.id ORDER BY m.createdAt DESC LIMIT 1) as lastMessageBy
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chatId
    WHERE cm.odId = ?
    ORDER BY lastMessageAt DESC NULLS LAST
  `),
  getDirectChat: db.prepare(`
    SELECT c.id FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chatId AND cm1.odId = ?
    JOIN chat_members cm2 ON c.id = cm2.chatId AND cm2.odId = ?
    WHERE c.type = 'direct'
  `),
  insertMessage: db.prepare('INSERT INTO messages (id, chatId, senderId, type, content, metadata) VALUES (?, ?, ?, ?, ?, ?)'),
  getMessages: db.prepare('SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC LIMIT 100'),
  getMessagesBefore: db.prepare('SELECT * FROM messages WHERE chatId = ? AND createdAt < ? ORDER BY createdAt DESC LIMIT 50'),
};

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- REST API ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { nickname, displayName, password } = req.body;
    if (!nickname || !displayName || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (nickname.length < 3 || nickname.length > 20) {
      return res.status(400).json({ error: 'Nickname must be 3-20 chars' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
      return res.status(400).json({ error: 'Nickname: only letters, numbers, underscore' });
    }
    const existing = stmts.getUserByNickname.get(nickname);
    if (existing) return res.status(409).json({ error: 'Nickname taken' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const colors = ['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#EC4899', '#8B5CF6', '#06B6D4'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    stmts.createUser.run(id, nickname.toLowerCase(), displayName, passwordHash, avatarColor);
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: { id, nickname: nickname.toLowerCase(), displayName, avatarColor } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login — returns quiz question
app.post('/api/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    const user = stmts.getUserByNickname.get(nickname?.toLowerCase());
    if (!user) return res.status(401).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });

    // Return quiz question to answer before getting token
    const question = getRandomQuestion();
    const quizToken = jwt.sign({ userId: user.id, questionId: question.id, correct: question.correct }, JWT_SECRET, { expiresIn: '5m' });

    res.json({
      quizToken,
      question: {
        id: question.id,
        question: question.question,
        options: question.options
      },
      user: {
        id: user.id,
        nickname: user.nickname,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        quizStreak: user.quizStreak
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify quiz answer to complete login
app.post('/api/login/verify', (req, res) => {
  try {
    const { quizToken, answer } = req.body;
    const decoded = jwt.verify(quizToken, JWT_SECRET);
    const isCorrect = answer === decoded.correct;

    const user = stmts.getUserById.get(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update quiz stats
    const newAnswered = user.totalQuizAnswered + 1;
    let newCorrect = user.totalQuizCorrect;
    let newStreak = user.quizStreak;

    if (isCorrect) {
      newCorrect++;
      newStreak++;
    } else {
      newStreak = 0;
    }
    stmts.updateQuizStats.run(newStreak, newCorrect, newAnswered, decoded.userId);

    if (isCorrect) {
      // Correct — issue auth token
      const token = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: '30d' });
      stmts.updateLastSeen.run(decoded.userId);
      res.json({
        token,
        isCorrect: true,
        streak: newStreak,
        user: { ...user, quizStreak: newStreak, totalQuizCorrect: newCorrect, totalQuizAnswered: newAnswered }
      });
    } else {
      // Wrong — return a new question, no token
      const nextQuestion = getRandomQuestion([decoded.questionId]);
      const newQuizToken = jwt.sign({ userId: decoded.userId, questionId: nextQuestion.id, correct: nextQuestion.correct }, JWT_SECRET, { expiresIn: '5m' });
      res.json({
        isCorrect: false,
        streak: 0,
        quizToken: newQuizToken,
        question: {
          id: nextQuestion.id,
          question: nextQuestion.question,
          options: nextQuestion.options
        }
      });
    }
  } catch (err) {
    res.status(401).json({ error: 'Quiz expired, try again' });
  }
});

// Get current user profile
app.get('/api/me', authMiddleware, (req, res) => {
  const user = stmts.getUserById.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  stmts.updateLastSeen.run(req.userId);
  res.json(user);
});

// Upload avatar
app.post('/api/me/avatar', authMiddleware, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const avatarUrl = `/avatars/${req.file.filename}`;
    // Delete old avatar file
    const user = stmts.getUserById.get(req.userId);
    if (user?.avatarUrl) {
      const oldPath = path.join(__dirname, user.avatarUrl);
      fs.unlink(oldPath, () => {}); // ignore errors
    }
    db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(avatarUrl, req.userId);
    const updatedUser = stmts.getUserById.get(req.userId);
    res.json(updatedUser);
  });
});

// Search users by nickname
app.get('/api/users/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const users = stmts.searchUsers.all(`%${q}%`, req.userId);
  res.json(users);
});

// Get contacts
app.get('/api/contacts', authMiddleware, (req, res) => {
  const contacts = stmts.getContacts.all(req.userId);
  res.json(contacts);
});

// Add contact
app.post('/api/contacts', authMiddleware, (req, res) => {
  const { userId: contactId } = req.body;
  if (contactId === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });
  const contact = stmts.getUserById.get(contactId);
  if (!contact) return res.status(404).json({ error: 'User not found' });
  stmts.addContact.run(req.userId, contactId);
  stmts.addContact.run(contactId, req.userId); // mutual
  res.json(contact);
});

// Get chats
app.get('/api/chats', authMiddleware, (req, res) => {
  const chats = stmts.getUserChats.all(req.userId);
  const enriched = chats.map(chat => {
    const members = stmts.getChatMembers.all(chat.id);
    return { ...chat, members };
  });
  res.json(enriched);
});

// Create or get direct chat
app.post('/api/chats/direct', authMiddleware, (req, res) => {
  const { userId: otherId } = req.body;
  if (otherId === req.userId) return res.status(400).json({ error: 'Cannot chat with yourself' });

  // Check if direct chat exists
  const existing = stmts.getDirectChat.get(req.userId, otherId);
  if (existing) {
    const members = stmts.getChatMembers.all(existing.id);
    return res.json({ id: existing.id, type: 'direct', members });
  }

  const chatId = uuidv4();
  stmts.createChat.run(chatId, 'direct', null, req.userId);
  stmts.addChatMember.run(chatId, req.userId);
  stmts.addChatMember.run(chatId, otherId);
  const members = stmts.getChatMembers.all(chatId);
  res.json({ id: chatId, type: 'direct', members });
});

// Create group chat
app.post('/api/chats/group', authMiddleware, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name required' });

  const chatId = uuidv4();
  stmts.createChat.run(chatId, 'group', name, req.userId);
  stmts.addChatMember.run(chatId, req.userId);
  (memberIds || []).forEach(id => stmts.addChatMember.run(chatId, id));

  // System message
  const user = stmts.getUserById.get(req.userId);
  stmts.insertMessage.run(uuidv4(), chatId, req.userId, 'system', `${user.displayName} создал(а) группу «${name}»`, null);

  const members = stmts.getChatMembers.all(chatId);
  res.json({ id: chatId, type: 'group', name, members });
});

// Get messages
app.get('/api/chats/:chatId/messages', authMiddleware, (req, res) => {
  const messages = stmts.getMessages.all(req.chatId || req.params.chatId);
  res.json(messages);
});

// --- Socket.IO ---
const onlineUsers = new Map(); // userId -> socketId
const activeBattles = new Map(); // chatId -> QuizBattle

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);
  stmts.updateLastSeen.run(userId);

  // Notify contacts user is online
  const contacts = stmts.getContacts.all(userId);
  contacts.forEach(c => {
    const contactSocket = onlineUsers.get(c.id);
    if (contactSocket) {
      io.to(contactSocket).emit('user:online', { userId });
    }
  });

  // Join all chat rooms
  const chats = stmts.getUserChats.all(userId);
  chats.forEach(chat => socket.join(`chat:${chat.id}`));

  // Send message
  socket.on('message:send', (data) => {
    const { chatId, content, type = 'text' } = data;
    const msgId = uuidv4();
    stmts.insertMessage.run(msgId, chatId, userId, type, content, data.metadata ? JSON.stringify(data.metadata) : null);

    const user = stmts.getUserById.get(userId);
    const message = {
      id: msgId,
      chatId,
      senderId: userId,
      senderName: user.displayName,
      senderNickname: user.nickname,
      senderColor: user.avatarColor,
      type,
      content,
      metadata: data.metadata || null,
      createdAt: new Date().toISOString()
    };

    io.to(`chat:${chatId}`).emit('message:new', message);
  });

  // Typing indicator
  socket.on('typing:start', ({ chatId }) => {
    const user = stmts.getUserById.get(userId);
    socket.to(`chat:${chatId}`).emit('typing:update', { chatId, odId: userId, displayName: user.displayName, isTyping: true });
  });

  socket.on('typing:stop', ({ chatId }) => {
    socket.to(`chat:${chatId}`).emit('typing:update', { chatId, odId: userId, isTyping: false });
  });

  // Join chat room
  socket.on('chat:join', ({ chatId }) => {
    socket.join(`chat:${chatId}`);
  });

  // --- Quiz Battle ---
  socket.on('quiz:start', ({ chatId, questionCount }) => {
    const user = stmts.getUserById.get(userId);
    const battle = new QuizBattle(chatId, userId, questionCount || 5);
    battle.join(userId, user.displayName);
    activeBattles.set(chatId, battle);

    // System message
    const msgId = uuidv4();
    stmts.insertMessage.run(msgId, chatId, userId, 'quiz_start', `${user.displayName} запускает викторину! 🎯`, JSON.stringify({ questionCount: battle.questionCount }));

    io.to(`chat:${chatId}`).emit('quiz:started', {
      chatId,
      startedBy: user.displayName,
      questionCount: battle.questionCount,
      messageId: msgId
    });

    // Auto-start first question after 5 seconds
    setTimeout(() => {
      const q = battle.startNextQuestion();
      if (q) {
        io.to(`chat:${chatId}`).emit('quiz:question', { chatId, ...q });
        // Auto-end after timeLimit
        setTimeout(() => {
          if (battle.status === 'question') {
            const results = battle.endQuestion();
            io.to(`chat:${chatId}`).emit('quiz:questionResult', { chatId, ...results });

            // Next question after 5s or finish
            if (!results.isLast) {
              setTimeout(() => {
                const nextQ = battle.startNextQuestion();
                if (nextQ) {
                  io.to(`chat:${chatId}`).emit('quiz:question', { chatId, ...nextQ });
                  scheduleQuestionEnd(chatId, battle, nextQ.timeLimit);
                }
              }, 5000);
            } else {
              finishBattle(chatId, battle);
            }
          }
        }, q.timeLimit * 1000);
      }
    }, 5000);
  });

  socket.on('quiz:join', ({ chatId }) => {
    const battle = activeBattles.get(chatId);
    if (!battle) return;
    const user = stmts.getUserById.get(userId);
    battle.join(userId, user.displayName);
    io.to(`chat:${chatId}`).emit('quiz:playerJoined', { chatId, userId, displayName: user.displayName, participants: battle.participants.size });
  });

  socket.on('quiz:answer', ({ chatId, answerIndex }) => {
    const battle = activeBattles.get(chatId);
    if (!battle) return;
    const result = battle.submitAnswer(userId, answerIndex);
    if (result) {
      socket.emit('quiz:answerResult', { chatId, ...result });
      // If all answered, end question early
      if (result.answeredCount >= result.totalParticipants) {
        const results = battle.endQuestion();
        io.to(`chat:${chatId}`).emit('quiz:questionResult', { chatId, ...results });

        if (!results.isLast) {
          setTimeout(() => {
            const nextQ = battle.startNextQuestion();
            if (nextQ) {
              io.to(`chat:${chatId}`).emit('quiz:question', { chatId, ...nextQ });
              scheduleQuestionEnd(chatId, battle, nextQ.timeLimit);
            }
          }, 5000);
        } else {
          finishBattle(chatId, battle);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    contacts.forEach(c => {
      const contactSocket = onlineUsers.get(c.id);
      if (contactSocket) {
        io.to(contactSocket).emit('user:offline', { userId });
      }
    });
  });
});

function scheduleQuestionEnd(chatId, battle, timeLimit) {
  setTimeout(() => {
    if (battle.status === 'question') {
      const results = battle.endQuestion();
      io.to(`chat:${chatId}`).emit('quiz:questionResult', { chatId, ...results });

      if (!results.isLast) {
        setTimeout(() => {
          const nextQ = battle.startNextQuestion();
          if (nextQ) {
            io.to(`chat:${chatId}`).emit('quiz:question', { chatId, ...nextQ });
            scheduleQuestionEnd(chatId, battle, nextQ.timeLimit);
          }
        }, 5000);
      } else {
        finishBattle(chatId, battle);
      }
    }
  }, timeLimit * 1000);
}

function finishBattle(chatId, battle) {
  const finalResults = battle.getFinalResults();
  io.to(`chat:${chatId}`).emit('quiz:finished', { chatId, ...finalResults });

  // Save result as message
  const msgId = uuidv4();
  const winnerText = finalResults.winner ? `🏆 ${finalResults.winner.nickname}: ${finalResults.winner.score} очков` : 'Нет участников';
  stmts.insertMessage.run(msgId, chatId, battle.startedBy, 'quiz_result', `Викторина завершена! ${winnerText}`, JSON.stringify(finalResults));

  activeBattles.delete(chatId);
}

// Serve static for web
app.use(express.static(path.join(__dirname, '..', 'web-build')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(__dirname, '..', 'web-build', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Quiz Messenger server running on port ${PORT}`);
});
