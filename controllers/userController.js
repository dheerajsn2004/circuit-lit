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
            answer1: "C",
            answer2: "A", 
            answer3: "D",
            answer4: "B",
            answer5: "D",
            answer6: "A",
            answer7: ["0110", "110", "0110 binary", "binary 0110"],
            answer8: ["3 bit xor gate", "odd parity gate", "3-bit xor gate", "xor gate", "3 bit xor", "odd parity"]
        };

        let score = 0;
        const questionResults = [];
        const submittedAnswers = {};

        // Process MCQ questions (1-6)
        for (let i = 1; i <= 6; i++) {
            const answerKey = `answer${i}`;
            const userAnswer = answers[answerKey] || '';
            const isCorrect = userAnswer === CORRECT_ANSWERS[answerKey];
            
            if (isCorrect) score += 3;
            
            submittedAnswers[answerKey] = userAnswer;
            questionResults.push({
                questionNumber: i,
                userAnswer,
                correctAnswer: CORRECT_ANSWERS[answerKey],
                isCorrect
            });
        }

        // Process text answer (question 7)
        const answer7 = (answers.answer7 || '').toLowerCase().trim();
        const normalizedAnswer7 = answer7
            .replace(/\s+/g, ' ')    // collapse multiple spaces
            .replace(/\D/g, '')      // remove non-digit characters
            .replace(/^0+/, '');     // remove leading zeros
        
        const isAnswer7Correct = CORRECT_ANSWERS.answer7.some(correctAnswer => 
            normalizedAnswer7 === correctAnswer.replace(/\D/g, '') || 
            answer7.includes(correctAnswer)
        );

        if (isAnswer7Correct) score += 3;

        submittedAnswers.answer7 = answer7;
        questionResults.push({
            questionNumber: 7,
            userAnswer: answer7,
            correctAnswer: "0110",
            isCorrect: isAnswer7Correct
        });

        // Process text answer (question 8)
        const answer8 = (answers.answer8 || '').toLowerCase().trim();
        const normalizedAnswer8 = answer8
            .replace(/-/g, ' ')      // replace hyphens with spaces
            .replace(/\s+/g, ' ')    // collapse multiple spaces
            .trim();
        
        const isAnswer8Correct = CORRECT_ANSWERS.answer8.some(correctAnswer => 
            normalizedAnswer8.includes(correctAnswer) || 
            correctAnswer.includes(normalizedAnswer8)
        );

        if (isAnswer8Correct) score += 3;

        submittedAnswers.answer8 = answer8;
        questionResults.push({
            questionNumber: 8,
            userAnswer: answer8,
            correctAnswer: "3 bit XOR gate or Odd Parity gate",
            isCorrect: isAnswer8Correct
        });

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
            totalQuestions: 8,
            correctAnswers: Math.round(score / 3),
            questionResults
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: 'Server error: ' + error.message 
        });
    }
};