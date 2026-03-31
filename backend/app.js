/**
 * Quiz Game – Express Backend
 *
 * Endpoints:
 *   GET  /question?userId=xxx  →  return a question at the user's current level
 *   POST /answer               →  check the answer, update stats, return result
 *
 * All data is stored in local JSON files (no database required).
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

const { getNextDifficulty, calculateAccuracy } = require('./services/ai');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());                  // Allow requests from the frontend (any origin)
app.use(express.json());          // Parse JSON request bodies

// Serve the frontend folder as static files so both app and API run on one port
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── File paths ────────────────────────────────────────────────────────────────

const QUESTIONS_FILE  = path.join(__dirname, 'data', 'questions.json');
const USER_STATS_FILE = path.join(__dirname, 'data', 'userStats.json');

// ─── JSON file helpers ─────────────────────────────────────────────────────────

/** Read and parse a JSON file synchronously */
function readJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/** Serialise data and write it to a JSON file synchronously */
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── GET /question ─────────────────────────────────────────────────────────────

/**
 * Return one random question that matches the user's current difficulty level.
 * Creates a fresh user profile (level 1) if this userId is new.
 *
 * Query params:
 *   userId {string}  – unique player identifier
 *
 * Response:
 *   { id, content, answers, difficulty, currentLevel, accuracy, score }
 *   NOTE: correctAnswer is intentionally omitted so the client cannot cheat.
 */
app.get('/question', (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    // ── Load user stats ──────────────────────────────────────────────────────
    const userStats = readJSON(USER_STATS_FILE);
    let user = userStats.find(u => u.userId === userId);

    // First visit – create a default profile at level 1
    if (!user) {
      user = {
        userId,
        correct:      0,
        wrong:        0,
        avgTime:      0,   // Average response time in milliseconds
        currentLevel: 1,
        // seenQuestions: theo dõi câu hỏi đã hiện ở mỗi cấp độ
        // { "1": ["q1", "q3"], "2": [], ... }
        seenQuestions: {}
      };
      userStats.push(user);
      writeJSON(USER_STATS_FILE, userStats);
    }

    // Đảm bảo seenQuestions tồn tại (hỗ trợ user cũ chưa có trường này)
    if (!user.seenQuestions) user.seenQuestions = {};

    // ── Chọn câu hỏi theo cấp độ hiện tại ───────────────────────────────────
    const questions = readJSON(QUESTIONS_FILE);
    const level     = user.currentLevel;
    let pool = questions.filter(q => q.difficulty === level);

    // Safety fallback: nếu không có câu hỏi ở cấp này, dùng toàn bộ
    if (pool.length === 0) pool = questions;

    // Lấy danh sách ID đã hiện ở cấp này
    const seen = user.seenQuestions[level] || [];

    // Lọc ra những câu chưa hiện
    let remaining = pool.filter(q => !seen.includes(q.id));

    // Nếu đã hiện hết tất cả câu ở cấp này → reset để bắt đầu vòng mới
    if (remaining.length === 0) {
      user.seenQuestions[level] = [];
      remaining = pool;
    }

    // Chọn ngẫu nhiên một câu trong danh sách chưa hiện
    const question = remaining[Math.floor(Math.random() * remaining.length)];

    // Ghi nhận câu này đã được hiện
    user.seenQuestions[level] = [...(user.seenQuestions[level] || []), question.id];

    // Lưu lại userStats sau khi cập nhật seenQuestions
    const idx = userStats.findIndex(u => u.userId === userId);
    userStats[idx] = user;
    writeJSON(USER_STATS_FILE, userStats);

    // Trả về câu hỏi (không kèm đáp án đúng để tránh gian lận)
    res.json({
      id:           question.id,
      content:      question.content,
      answers:      question.answers,
      difficulty:   question.difficulty,
      currentLevel: user.currentLevel,
      accuracy:     Math.round(calculateAccuracy(user.correct, user.wrong)),
      score:        user.correct
    });

  } catch (err) {
    console.error('[GET /question] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /answer ──────────────────────────────────────────────────────────────

/**
 * Check the player's answer, update their stats, and return the result.
 * The adaptive-difficulty AI decides the next level after every submission.
 *
 * Request body:
 *   { userId, questionId, selectedAnswer, responseTime }
 *   responseTime – milliseconds elapsed from question display to answer click
 *
 * Response:
 *   { isCorrect, correctAnswer, nextLevel, accuracy, score, avgTime }
 */
app.post('/answer', (req, res) => {
  const { userId, questionId, selectedAnswer, responseTime } = req.body;

  // Basic input validation
  if (!userId || !questionId || selectedAnswer === undefined || responseTime === undefined) {
    return res.status(400).json({ error: 'Missing required fields: userId, questionId, selectedAnswer, responseTime' });
  }

  try {
    // ── Find the question ────────────────────────────────────────────────────
    const questions = readJSON(QUESTIONS_FILE);
    const question  = questions.find(q => q.id === questionId);

    if (!question) {
      return res.status(404).json({ error: `Question "${questionId}" not found` });
    }

    const isCorrect = (selectedAnswer === question.correctAnswer);

    // ── Update user stats ────────────────────────────────────────────────────
    const userStats = readJSON(USER_STATS_FILE);
    let user = userStats.find(u => u.userId === userId);

    // Guard: create profile if it somehow got lost between calls
    if (!user) {
      user = { userId, correct: 0, wrong: 0, avgTime: 0, currentLevel: 1 };
      userStats.push(user);
    }

    // Rolling average for response time
    const totalBefore = user.correct + user.wrong;
    user.avgTime = Math.round(
      (user.avgTime * totalBefore + responseTime) / (totalBefore + 1)
    );

    // Increment correct or wrong counter
    if (isCorrect) {
      user.correct += 1;
    } else {
      user.wrong += 1;
    }

    // ── Adaptive AI: recalculate difficulty level ────────────────────────────
    user.currentLevel = getNextDifficulty(user.currentLevel, user.correct, user.wrong);

    // Persist updated stats
    writeJSON(USER_STATS_FILE, userStats);

    const accuracy = Math.round(calculateAccuracy(user.correct, user.wrong));

    res.json({
      isCorrect,
      correctAnswer: question.correctAnswer,   // reveal the right answer to the client
      nextLevel:     user.currentLevel,
      accuracy,
      score:         user.correct,
      avgTime:       user.avgTime              // milliseconds
    });

  } catch (err) {
    console.error('[POST /answer] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('─────────────────────────────────────────');
  console.log(` Quiz Game Server  →  http://localhost:${PORT}`);
  console.log(' Open that URL in your browser to play!');
  console.log('─────────────────────────────────────────');
});
