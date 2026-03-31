# Quiz Game – AI Adaptive Difficulty

A mini quiz game for primary-school students. The backend's AI engine raises or lowers the difficulty level based on the player's running accuracy after every answer.

---

## Project Structure

```
GameTracNghiem/
├── backend/
│   ├── app.js                  ← Express server + API routes
│   ├── package.json
│   ├── services/
│   │   └── ai.js               ← Adaptive difficulty logic
│   └── data/
│       ├── questions.json      ← 25 sample questions (levels 1–5)
│       └── userStats.json      ← Player stats (auto-managed at runtime)
└── frontend/
    ├── index.html              ← AngularJS single-page UI
    ├── app.js                  ← AngularJS module declaration
    └── controller.js           ← Quiz controller (API calls + state)
```

---

## How to Run

### Prerequisites

| Tool    | Version            |
| ------- | ------------------ |
| Node.js | 16 or newer        |
| npm     | comes with Node.js |

> Check: `node -v` and `npm -v` in a terminal.

---

### Step 1 – Install dependencies

Open a terminal and navigate to the **backend** folder:

```bash
cd d:\GameTracNghiem\backend
npm install
```

This installs `express` and `cors` from `package.json`.

---

### Step 2 – Start the server

Still inside `backend/`, run:

```bash
node app.js
```

You should see:

```
─────────────────────────────────────────
 Quiz Game Server  →  http://localhost:3000
 Open that URL in your browser to play!
─────────────────────────────────────────
```

---

### Step 3 – Open the game

Open your browser and go to:

```
http://localhost:3000
```

The Express server serves the `frontend/` folder as static files, so no separate web server is needed.

---

## API Reference

### `GET /question?userId=<id>`

Returns a question matched to the player's current difficulty level.

**Response**

```json
{
  "id": "q6",
  "content": "What is 5 x 6?",
  "answers": ["24", "28", "30", "36"],
  "difficulty": 2,
  "currentLevel": 2,
  "accuracy": 67,
  "score": 4
}
```

> `correctAnswer` is intentionally omitted to prevent client-side cheating.

---

### `POST /answer`

Submit an answer and receive the result.

**Request body**

```json
{
  "userId": "player_1234567890",
  "questionId": "q6",
  "selectedAnswer": "30",
  "responseTime": 4200
}
```

**Response**

```json
{
  "isCorrect": true,
  "correctAnswer": "30",
  "nextLevel": 2,
  "accuracy": 75,
  "score": 5,
  "avgTime": 3800
}
```

---

## Adaptive Difficulty Rules

| Condition            | Action             |
| -------------------- | ------------------ |
| Accuracy > 80%       | Level UP (max 5)   |
| Accuracy < 50%       | Level DOWN (min 1) |
| 50% ≤ accuracy ≤ 80% | Keep same level    |

The accuracy is recalculated after every submitted answer using the player's full history (`correct / (correct + wrong) × 100`).

---

## Data Files

### `backend/data/questions.json`

25 multiple-choice questions spread across 5 difficulty levels:

| Level | Description | Example topic                     |
| ----- | ----------- | --------------------------------- |
| 1     | Very Easy   | `2 + 3 = ?`                       |
| 2     | Easy        | multiplication, hours in a day    |
| 3     | Medium      | percentages, fractions, geography |
| 4     | Hard        | powers, perimeter, planets        |
| 5     | Very Hard   | LCM, area, prime numbers          |

### `backend/data/userStats.json`

Auto-created per player. Example entry:

```json
{
  "userId": "player_1711234567890",
  "correct": 7,
  "wrong": 3,
  "avgTime": 3500,
  "currentLevel": 3
}
```

---

## Resetting Progress

To start a fresh game, either:

- Clear `localStorage` in the browser DevTools (`Application → Local Storage → Delete quizUserId`), **or**
- Edit `backend/data/userStats.json` and remove the player's entry.
