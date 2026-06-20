/* ============================================
   DEUTSCH VOCAB — Quiz Engine
   Two-step quiz: meaning → article
   With homepage, stats tracking & settings
   ============================================ */

(function () {
    'use strict';

    // --- Constants ---
    const STORAGE_KEY = 'deutschVocab';
    const CATEGORY_EMOJIS = {
        'animals': '🐾',
        'food & drink': '🍽️',
        'family & people': '👨‍👩‍👧',
        'body & health': '💪',
        'clothing & accessories': '👕',
        'house & furniture': '🏠',
        'transportation': '🚗',
        'nature & weather': '🌿',
        'school & education': '📚',
        'work & profession': '💼',
        'daily life & objects': '🔑',
        'time & calendar': '📅',
        'city & places': '🏙️',
        'hobbies & sports': '⚽',
        'emotions & adjectives': '😊',
        'numbers & quantities': '🔢',
        'communication & media': '📱',
        'shopping & money': '🛒',
        'travel & vacation': '✈️',
        'colors': '🎨',
    };

    // --- Persistent Data ---
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {
            mastered: [],           // array of word strings that have been answered correctly (both parts)
            bestStreak: 0,
            settings: {
                numOptions: 4,      // 3, 4, or 5
                prioritizeUnlearned: true,
            },
        };
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    let data = loadData();

    // --- State ---
    const state = {
        currentWord: null,
        step: 'meaning',        // 'meaning' | 'article' | 'result'
        meaningCorrect: false,
        articleCorrect: false,
        score: { correct: 0, total: 0 },
        streak: 0,
        answered: false,
        currentView: 'home',    // 'home' | 'quiz'
    };

    // --- DOM References (lazy, resolved when needed) ---
    function $(id) { return document.getElementById(id); }
    function $q(sel) { return document.querySelector(sel); }

    // --- Helpers ---
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function pickRandom(arr, count, exclude) {
        const filtered = arr.filter(w => w.meaning !== exclude);
        const shuffled = shuffle(filtered);
        return shuffled.slice(0, count);
    }

    function getRandomWord() {
        if (data.settings.prioritizeUnlearned) {
            const unmastered = A1_WORDS.filter(w => !data.mastered.includes(w.word));
            if (unmastered.length > 0) {
                // 70% chance to pick unmastered, 30% any word
                if (Math.random() < 0.7) {
                    return unmastered[Math.floor(Math.random() * unmastered.length)];
                }
            }
        }
        return A1_WORDS[Math.floor(Math.random() * A1_WORDS.length)];
    }

    function getMasteredSet() {
        return new Set(data.mastered);
    }

    function getCategoryStats() {
        const masteredSet = getMasteredSet();
        const categories = {};

        A1_WORDS.forEach(w => {
            if (!categories[w.category]) {
                categories[w.category] = { total: 0, mastered: 0 };
            }
            categories[w.category].total++;
            if (masteredSet.has(w.word)) {
                categories[w.category].mastered++;
            }
        });

        return categories;
    }

    // ==================================
    //  HOME VIEW
    // ==================================

    function renderHome() {
        const masteredSet = getMasteredSet();
        const categoryStats = getCategoryStats();
        const totalMastered = masteredSet.size;
        const totalWords = A1_WORDS.length;
        const categoriesComplete = Object.values(categoryStats).filter(c => c.mastered === c.total).length;
        const totalCategories = Object.keys(categoryStats).length;

        // Stats overview
        $('statMastered').textContent = totalMastered;
        $('statTotal').textContent = totalWords;
        $('statStreak').textContent = data.bestStreak;

        // Categories badge
        $('categoriesBadge').textContent = `${categoriesComplete} / ${totalCategories}`;

        // Category list
        const $list = $('categoryList');
        $list.innerHTML = '';

        // Sort categories: incomplete first (by % done desc), then completed
        const sortedCategories = Object.entries(categoryStats).sort((a, b) => {
            const aPct = a[1].mastered / a[1].total;
            const bPct = b[1].mastered / b[1].total;
            if (aPct === 1 && bPct !== 1) return 1;
            if (bPct === 1 && aPct !== 1) return -1;
            return bPct - aPct;
        });

        sortedCategories.forEach(([cat, stats]) => {
            const pct = Math.round((stats.mastered / stats.total) * 100);
            const isComplete = stats.mastered === stats.total;
            const emoji = CATEGORY_EMOJIS[cat] || '📖';

            const row = document.createElement('div');
            row.className = 'category-row';
            row.innerHTML = `
                <div class="category-emoji">${emoji}</div>
                <div class="category-info">
                    <div class="category-name">${cat}</div>
                    <div class="category-progress-bar">
                        <div class="category-progress-fill ${isComplete ? 'complete' : ''}" style="width: ${pct}%"></div>
                    </div>
                </div>
                <div class="category-count">
                    <span class="count-correct">${stats.mastered}</span>/${stats.total}
                </div>
            `;
            $list.appendChild(row);
        });

        // Settings state
        $('optionsValue').textContent = data.settings.numOptions;
        $('optionsMinus').disabled = data.settings.numOptions <= 3;
        $('optionsPlus').disabled = data.settings.numOptions >= 5;
        $('prioritizeToggle').setAttribute('aria-pressed', data.settings.prioritizeUnlearned ? 'true' : 'false');
    }

    // ==================================
    //  VIEW NAVIGATION
    // ==================================

    function showView(viewName) {
        state.currentView = viewName;
        $('homeView').classList.toggle('hidden', viewName !== 'home');
        $('quizView').classList.toggle('hidden', viewName !== 'quiz');

        if (viewName === 'home') {
            renderHome();
        } else if (viewName === 'quiz') {
            state.score.correct = 0;
            state.score.total = 0;
            state.streak = 0;
            renderScore();
            updateStreakBar();
            startNewWord();
        }
    }

    // ==================================
    //  QUIZ ENGINE
    // ==================================

    function renderScore() {
        $('scoreCorrect').textContent = state.score.correct;
        $('scoreTotal').textContent = state.score.total;
    }

    function animateScorePop() {
        const el = $('scoreCorrect');
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
    }

    function updateStreakBar() {
        const bar = $('streakBar');
        if (state.streak >= 3) {
            bar.classList.remove('hidden');
            $('streakCount').textContent = `${state.streak} in a row!`;
        } else {
            bar.classList.add('hidden');
        }
    }

    function updateStepDots() {
        const d1 = $('stepDot1');
        const d2 = $('stepDot2');
        d1.className = 'step-dot';
        d2.className = 'step-dot';

        if (state.step === 'meaning') {
            d1.classList.add('active');
        } else if (state.step === 'article') {
            d1.classList.add(state.meaningCorrect ? 'completed' : 'failed');
            d2.classList.add('active');
        } else if (state.step === 'result') {
            d1.classList.add(state.meaningCorrect ? 'completed' : 'failed');
            d2.classList.add(state.articleCorrect ? 'completed' : 'failed');
        }
    }

    // --- Render Meaning Options ---
    function renderMeaningOptions() {
        const word = state.currentWord;
        const numDistractors = data.settings.numOptions - 1;
        const distractors = pickRandom(A1_WORDS, numDistractors, word.meaning);
        const options = shuffle([
            { text: word.meaning, correct: true },
            ...distractors.map(w => ({ text: w.meaning, correct: false }))
        ]);

        const letters = ['A', 'B', 'C', 'D', 'E'];

        $('questionLabel').textContent = 'Choose the English meaning';
        const grid = $('optionsGrid');
        grid.innerHTML = '';

        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = `
                <span class="option-letter">${letters[i]}</span>
                <span class="option-text">${opt.text}</span>
            `;
            btn.addEventListener('click', () => handleMeaningAnswer(btn, opt, options));
            grid.appendChild(btn);
        });
    }

    function handleMeaningAnswer(selectedBtn, selectedOpt, allOptions) {
        if (state.answered) return;
        state.answered = true;

        state.meaningCorrect = selectedOpt.correct;

        const allBtns = $('optionsGrid').querySelectorAll('.option-btn');
        allBtns.forEach((btn, i) => {
            btn.classList.add('disabled');
            if (allOptions[i].correct) {
                btn.classList.add(selectedOpt.correct ? 'correct' : 'reveal-correct');
            }
        });

        if (!selectedOpt.correct) {
            selectedBtn.classList.add('incorrect');
        }

        setTimeout(() => transitionToArticleStep(), 1000);
    }

    function transitionToArticleStep() {
        state.step = 'article';
        state.answered = false;
        updateStepDots();

        const qa = $q('#quizView .question-area');
        qa.classList.add('slide-out');

        setTimeout(() => {
            renderArticleOptions();
            qa.classList.remove('slide-out');
            qa.classList.add('slide-in');
            setTimeout(() => qa.classList.remove('slide-in'), 350);
        }, 250);
    }

    function renderArticleOptions() {
        const word = state.currentWord;
        const articles = ['der', 'die', 'das'];

        $('questionLabel').textContent = 'Choose the correct article';
        $q('#quizView .word-label').textContent = 'Welcher Artikel?';
        const grid = $('optionsGrid');
        grid.innerHTML = '';

        $('wordText').textContent = `___ ${word.word}`;
        $('wordText').classList.add('with-article');

        articles.forEach(article => {
            const btn = document.createElement('button');
            btn.className = `option-btn article-option article-${article}`;
            btn.innerHTML = `<span class="option-text">${article}</span>`;
            btn.addEventListener('click', () => handleArticleAnswer(btn, article));
            grid.appendChild(btn);
        });
    }

    function handleArticleAnswer(selectedBtn, selectedArticle) {
        if (state.answered) return;
        state.answered = true;

        const correctArticle = state.currentWord.article;
        state.articleCorrect = (selectedArticle === correctArticle);

        const allBtns = $('optionsGrid').querySelectorAll('.option-btn');
        allBtns.forEach(btn => {
            btn.classList.add('disabled');
            const btnArticle = btn.textContent.trim();
            if (btnArticle === correctArticle) {
                btn.classList.add(state.articleCorrect ? 'correct' : 'reveal-correct');
            }
        });

        if (!state.articleCorrect) {
            selectedBtn.classList.add('incorrect');
        }

        $('wordText').textContent = `${correctArticle} ${state.currentWord.word}`;

        // Update score & streak
        const bothCorrect = state.meaningCorrect && state.articleCorrect;
        state.score.total++;
        if (bothCorrect) {
            state.score.correct++;
            state.streak++;

            // Track mastery
            if (!data.mastered.includes(state.currentWord.word)) {
                data.mastered.push(state.currentWord.word);
            }
            if (state.streak > data.bestStreak) {
                data.bestStreak = state.streak;
            }
            saveData();
        } else {
            state.streak = 0;
        }

        renderScore();
        updateStreakBar();
        if (bothCorrect) animateScorePop();

        setTimeout(() => showResult(), 800);
    }

    function showResult() {
        state.step = 'result';
        updateStepDots();

        const word = state.currentWord;
        const bothCorrect = state.meaningCorrect && state.articleCorrect;
        const neitherCorrect = !state.meaningCorrect && !state.articleCorrect;

        $q('#quizView .question-area').classList.add('hidden');
        const banner = $('resultBanner');
        banner.classList.remove('hidden', 'result-correct', 'result-incorrect', 'result-partial');

        if (bothCorrect) {
            banner.classList.add('result-correct');
            $('resultIcon').textContent = '🎉';
            $('resultText').textContent = 'Perfekt!';
            $('resultDetail').innerHTML = `<strong>${word.article} ${word.word}</strong> = ${word.meaning}`;
        } else if (neitherCorrect) {
            banner.classList.add('result-incorrect');
            $('resultIcon').textContent = '😕';
            $('resultText').textContent = 'Not quite';
            $('resultDetail').innerHTML = `The correct answer is:<br><strong>${word.article} ${word.word}</strong> = ${word.meaning}`;
        } else {
            banner.classList.add('result-partial');
            $('resultIcon').textContent = '🤔';
            $('resultText').textContent = 'Almost!';
            const wrongPart = state.meaningCorrect ? 'article' : 'meaning';
            $('resultDetail').innerHTML = `You got the ${wrongPart} wrong.<br><strong>${word.article} ${word.word}</strong> = ${word.meaning}`;
        }

        $('nextBtn').classList.remove('hidden');
    }

    function startNewWord() {
        state.currentWord = getRandomWord();
        state.step = 'meaning';
        state.meaningCorrect = false;
        state.articleCorrect = false;
        state.answered = false;

        $('resultBanner').classList.add('hidden');
        $('nextBtn').classList.add('hidden');
        $q('#quizView .question-area').classList.remove('hidden');
        $q('#quizView .word-label').textContent = 'Was bedeutet…';
        $('wordText').textContent = state.currentWord.word;
        $('wordText').classList.remove('with-article');

        const card = $('wordCard');
        card.classList.remove('new-word');
        void card.offsetWidth;
        card.classList.add('new-word');

        updateStepDots();
        renderMeaningOptions();
    }

    // ==================================
    //  EVENT LISTENERS
    // ==================================

    // Navigation
    $('startBtn').addEventListener('click', () => showView('quiz'));
    $('backBtn').addEventListener('click', () => showView('home'));
    $('nextBtn').addEventListener('click', startNewWord);

    // Settings: number of options
    $('optionsMinus').addEventListener('click', () => {
        if (data.settings.numOptions > 3) {
            data.settings.numOptions--;
            saveData();
            renderHome();
        }
    });

    $('optionsPlus').addEventListener('click', () => {
        if (data.settings.numOptions < 5) {
            data.settings.numOptions++;
            saveData();
            renderHome();
        }
    });

    // Settings: prioritize unlearned toggle
    $('prioritizeToggle').addEventListener('click', () => {
        data.settings.prioritizeUnlearned = !data.settings.prioritizeUnlearned;
        saveData();
        $('prioritizeToggle').setAttribute('aria-pressed', data.settings.prioritizeUnlearned ? 'true' : 'false');
    });

    // Settings: reset all progress
    $('resetProgressBtn').addEventListener('click', () => {
        if (confirm('This will reset all your mastered words and best streak. Are you sure?')) {
            data.mastered = [];
            data.bestStreak = 0;
            saveData();
            renderHome();
        }
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (state.currentView !== 'quiz') return;

        if (state.step === 'result') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startNewWord();
            }
            return;
        }

        if (state.answered) return;

        const btns = $('optionsGrid').querySelectorAll('.option-btn');
        const keyMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
        const index = keyMap[e.key.toLowerCase()];

        if (index !== undefined && index >= 0 && index < btns.length) {
            btns[index].click();
        }
    });

    // Escape to go back
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && state.currentView === 'quiz') {
            showView('home');
        }
    });

    // --- Init ---
    showView('home');

    // --- Register Service Worker ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

})();
