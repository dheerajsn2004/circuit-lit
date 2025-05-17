const User = require('../models/User');
const bcrypt = require('bcryptjs');
const path = require('path');

exports.getIndex = (req,res) => {
    res.sendFile(path.join(__dirname, '../','public', 'index.html'));
}

exports.getregister = (req, res) => {
    res.sendFile(path.join(__dirname, '../','public', 'create-account.html'));
};

exports.getlogin = (req, res) => {
    res.sendFile(path.join(__dirname, '../','public', 'login.html'));
};

exports.getQuiz = async (req, res) => {
    try {
        const userId = req.query.userId; // Get userId from query params
        if (!userId) {
            return res.sendFile(path.join(__dirname, '../','public', 'quiz.html'));
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.sendFile(path.join(__dirname, '../','public', 'quiz.html'));
        }

        if (user.hasSubmittedQuiz) {
            // User has already submitted - send a different page or handle differently
            return res.sendFile(path.join(__dirname, '../','public', 'quiz-submitted.html'));
        }

        res.sendFile(path.join(__dirname, '../','public', 'quiz.html'));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        res.json({ userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.startQuizTimer = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.hasSubmittedQuiz) {
            return res.status(400).json({ message: 'Quiz already submitted' });
        }
        
        if (!user.quizStartTime) {
            user.quizStartTime = new Date();
            user.timeRemaining = 1200;
            await user.save();
        }
        
        // Calculate current time remaining
        const currentTime = new Date();
        const elapsedSeconds = Math.floor((currentTime - user.quizStartTime) / 1000);
        const timeRemaining = Math.max(0, 1200 - elapsedSeconds);
        
        user.timeRemaining = timeRemaining;
        await user.save();
        
        res.json({ 
            startTime: user.quizStartTime,
            timeRemaining: user.timeRemaining 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getQuizTime = async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.hasSubmittedQuiz) {
            return res.json({ 
                timeRemaining: 0,
                quizCompleted: true 
            });
        }
        
        let timeRemaining = user.timeRemaining || 1200;
        
        if (user.quizStartTime) {
            const currentTime = new Date();
            const elapsedSeconds = Math.floor((currentTime - user.quizStartTime) / 1000);
            timeRemaining = Math.max(0, 1200 - elapsedSeconds);
            
            // Update the user's time remaining
            user.timeRemaining = timeRemaining;
            await user.save();
        }
        
        res.json({ 
            timeRemaining,
            quizCompleted: false 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const { userId, answers } = req.body;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.hasSubmittedQuiz) {
            return res.status(400).json({ 
                message: 'Quiz already submitted'
            });
        }

        // Calculate time taken
        const timeTaken = user.quizStartTime 
            ? Math.min(1200, Math.floor((new Date() - user.quizStartTime) / 1000))
            : 0;

        // Process answers
        const CORRECT_ANSWERS = {
            answer1: "D",
            answer2: "B", 
            answer3: "C",
            answer4: "A",
            answer5: "D"
        };

        let score = 0;
        const questionResults = [];
        const submittedAnswers = {};

        for (let i = 1; i <= 5; i++) {
            const answerKey = `answer${i}`;
            const userAnswer = answers[answerKey] || '';
            const isCorrect = userAnswer === CORRECT_ANSWERS[answerKey];
            
            if (isCorrect) score += 20;
            
            submittedAnswers[answerKey] = userAnswer;
            questionResults.push({
                questionNumber: i,
                userAnswer,
                correctAnswer: CORRECT_ANSWERS[answerKey],
                isCorrect
            });
        }

        // Update user
        user.score = score;
        user.hasSubmittedQuiz = true;
        user.timeRemaining = 0;
        user.submittedAnswers = submittedAnswers;
        user.questionResults = questionResults;
        user.submittedAt = new Date();
        user.timeTaken = timeTaken;
        user.quizStartTime = undefined;
        
        await user.save();

        res.json({ 
            success: true,
            message: 'Quiz submitted successfully!',
            score,
            totalQuestions: 5,
            correctAnswers: score / 20,
            questionResults
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Server error: ' + error.message 
        });
    }
};