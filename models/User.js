const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    score: { type: Number, default: 0 },
    submittedAnswers: { type: Object, default: {} },
    questionResults: [{
        questionNumber: Number,
        userAnswer: String,
        correctAnswer: String,
        isCorrect: Boolean
    }],
    hasSubmittedQuiz: { type: Boolean, default: false },
    quizStartTime: { type: Date },
    timeRemaining: { type: Number, default: 1200 },
    submittedAt: { type: Date },
    timeTaken: { type: Number }
});

module.exports = mongoose.model('User', userSchema);