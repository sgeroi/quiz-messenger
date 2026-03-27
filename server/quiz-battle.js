// Вопросы для соревновательной викторины в чатах
const battleQuestions = [
  {
    id: 1, category: "География",
    question: "Какая страна имеет наибольшее количество островов?",
    options: ["Индонезия", "Филиппины", "Швеция", "Финляндия"],
    correct: 2, timeLimit: 15
  },
  {
    id: 2, category: "История",
    question: "Кто был первым президентом США?",
    options: ["Томас Джефферсон", "Джордж Вашингтон", "Бенджамин Франклин", "Джон Адамс"],
    correct: 1, timeLimit: 10
  },
  {
    id: 3, category: "Наука",
    question: "Какая температура кипения воды в градусах Фаренгейта?",
    options: ["200°F", "212°F", "220°F", "232°F"],
    correct: 1, timeLimit: 15
  },
  {
    id: 4, category: "Искусство",
    question: "Кто написал «Реквием»?",
    options: ["Бах", "Бетховен", "Моцарт", "Вивальди"],
    correct: 2, timeLimit: 10
  },
  {
    id: 5, category: "Спорт",
    question: "В каком году прошла первая Олимпиада современности?",
    options: ["1892", "1896", "1900", "1904"],
    correct: 1, timeLimit: 15
  },
  {
    id: 6, category: "Кино",
    question: "Какой фильм получил первый «Оскар» за лучший фильм?",
    options: ["Крылья", "Восход солнца", "Огни большого города", "Метрополис"],
    correct: 0, timeLimit: 15
  },
  {
    id: 7, category: "Литература",
    question: "Кто написал «Сто лет одиночества»?",
    options: ["Борхес", "Маркес", "Кортасар", "Льоса"],
    correct: 1, timeLimit: 10
  },
  {
    id: 8, category: "Природа",
    question: "Какое самое быстрое животное на планете?",
    options: ["Гепард", "Сапсан", "Парусник", "Иглохвостый стриж"],
    correct: 1, timeLimit: 10
  },
  {
    id: 9, category: "Технологии",
    question: "В каком году был выпущен первый iPhone?",
    options: ["2005", "2006", "2007", "2008"],
    correct: 2, timeLimit: 10
  },
  {
    id: 10, category: "Музыка",
    question: "Сколько струн у стандартной гитары?",
    options: ["4", "5", "6", "7"],
    correct: 2, timeLimit: 10
  },
  {
    id: 11, category: "География",
    question: "Через сколько стран протекает Дунай?",
    options: ["8", "10", "12", "14"],
    correct: 1, timeLimit: 15
  },
  {
    id: 12, category: "Еда",
    question: "Из какой страны родом суши?",
    options: ["Китай", "Корея", "Япония", "Таиланд"],
    correct: 2, timeLimit: 10
  },
  {
    id: 13, category: "Космос",
    question: "Сколько планет в Солнечной системе?",
    options: ["7", "8", "9", "10"],
    correct: 1, timeLimit: 10
  },
  {
    id: 14, category: "История",
    question: "В каком веке жил Леонардо да Винчи?",
    options: ["XIV", "XV", "XVI", "XVII"],
    correct: 1, timeLimit: 15
  },
  {
    id: 15, category: "Математика",
    question: "Чему равно число Пи с точностью до второго знака?",
    options: ["3.12", "3.14", "3.16", "3.18"],
    correct: 1, timeLimit: 10
  }
];

class QuizBattle {
  constructor(chatId, startedBy, questionCount = 5) {
    this.chatId = chatId;
    this.startedBy = startedBy;
    this.questionCount = questionCount;
    this.currentQuestion = 0;
    this.questions = this._pickQuestions(questionCount);
    this.scores = {}; // { odId: { nickname, score, streak, answers } }
    this.answers = {}; // { odId: answerIndex } for current question
    this.status = 'waiting'; // waiting, question, results, finished
    this.questionStartTime = null;
    this.participants = new Set();
  }

  _pickQuestions(count) {
    const shuffled = [...battleQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  join(userId, nickname) {
    this.participants.add(userId);
    if (!this.scores[userId]) {
      this.scores[userId] = { nickname, score: 0, streak: 0, answers: [] };
    }
  }

  startNextQuestion() {
    if (this.currentQuestion >= this.questions.length) {
      this.status = 'finished';
      return null;
    }
    this.status = 'question';
    this.answers = {};
    this.questionStartTime = Date.now();
    const q = this.questions[this.currentQuestion];
    return {
      index: this.currentQuestion + 1,
      total: this.questions.length,
      category: q.category,
      question: q.question,
      options: q.options,
      timeLimit: q.timeLimit
    };
  }

  submitAnswer(userId, answerIndex) {
    if (this.status !== 'question') return null;
    if (this.answers[userId] !== undefined) return null; // already answered

    const q = this.questions[this.currentQuestion];
    const elapsed = (Date.now() - this.questionStartTime) / 1000;
    const isCorrect = answerIndex === q.correct;
    const timeBonus = Math.max(0, Math.round((q.timeLimit - elapsed) * 10));

    this.answers[userId] = answerIndex;

    if (isCorrect) {
      const basePoints = 100;
      const points = basePoints + timeBonus;
      this.scores[userId].score += points;
      this.scores[userId].streak += 1;
      // Streak bonus
      if (this.scores[userId].streak >= 3) {
        this.scores[userId].score += 50;
      }
      this.scores[userId].answers.push({ correct: true, points, time: elapsed.toFixed(1) });
    } else {
      this.scores[userId].streak = 0;
      this.scores[userId].answers.push({ correct: false, points: 0, time: elapsed.toFixed(1) });
    }

    return {
      isCorrect,
      correctAnswer: q.correct,
      answeredCount: Object.keys(this.answers).length,
      totalParticipants: this.participants.size
    };
  }

  endQuestion() {
    this.currentQuestion++;
    this.status = 'results';
    const q = this.questions[this.currentQuestion - 1];

    const results = Object.entries(this.scores)
      .map(([userId, data]) => ({
        odId: userId,
        nickname: data.nickname,
        score: data.score,
        lastAnswer: data.answers[data.answers.length - 1] || null
      }))
      .sort((a, b) => b.score - a.score);

    return {
      correctAnswer: q.correct,
      correctText: q.options[q.correct],
      leaderboard: results,
      questionIndex: this.currentQuestion,
      totalQuestions: this.questions.length,
      isLast: this.currentQuestion >= this.questions.length
    };
  }

  getFinalResults() {
    const results = Object.entries(this.scores)
      .map(([userId, data]) => ({
        odId: userId,
        nickname: data.nickname,
        score: data.score,
        correctCount: data.answers.filter(a => a.correct).length,
        totalQuestions: this.questions.length
      }))
      .sort((a, b) => b.score - a.score);

    return {
      leaderboard: results,
      winner: results[0] || null,
      totalQuestions: this.questions.length
    };
  }
}

module.exports = { battleQuestions, QuizBattle };
