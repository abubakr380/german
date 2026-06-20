/* ============================================
   DEUTSCH VOCAB — Quiz Engine
   Multi-page app with filtered practice modes
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
        'verbs': '✏️',
        'adjectives': '🏷️',
        'adverbs': '⏩',
        'prepositions': '📍',
        'conjunctions': '🔗',
    };

    const WORD_TYPE_LABELS = {
        'noun': 'Noun',
        'verb': 'Verb',
        'adjective': 'Adjective',
        'adverb': 'Adverb',
        'preposition': 'Preposition',
        'conjunction': 'Conjunction',
    };

    function getWordType(word) {
        return word.type || 'noun';
    }

    function isNoun(word) {
        return getWordType(word) === 'noun';
    }

    // --- Persistent Data ---
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return {
            mastered: [],
            bestStreak: 0,
            settings: { numOptions: 4, prioritizeUnlearned: true },
            currentLevel: 'A1'
        };
    }

    function saveData() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }

    let data = loadData();

    // --- State ---
    const state = {
        currentWord: null,
        step: 'meaning',
        meaningCorrect: false,
        articleCorrect: false,
        score: { correct: 0, total: 0 },
        streak: 0,
        answered: false,
        filter: { type: 'all', value: null },  // { type: 'all'|'category'|'article', value: string|null }
    };

    // --- DOM helpers ---
    function $(id) { return document.getElementById(id); }
    function $q(sel) { return document.querySelector(sel); }

    // --- Word helpers ---
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function getActiveWords() {
        return data.currentLevel === 'A2' ? A2_WORDS : A1_WORDS;
    }

    function getFilteredWords() {
        let words = getActiveWords();
        if (state.filter.type === 'category') {
            words = words.filter(w => w.category === state.filter.value);
        } else if (state.filter.type === 'article') {
            words = words.filter(w => isNoun(w) && w.article === state.filter.value);
        } else if (state.filter.type === 'wordtype') {
            words = words.filter(w => getWordType(w) === state.filter.value);
        }
        return words;
    }

    function pickRandom(arr, count, exclude) {
        const filtered = arr.filter(w => w.meaning !== exclude);
        return shuffle(filtered).slice(0, count);
    }

    function getRandomWord() {
        const pool = getFilteredWords();
        if (pool.length === 0) return A1_WORDS[0]; // fallback

        if (data.settings.prioritizeUnlearned) {
            const unmastered = pool.filter(w => !data.mastered.includes(w.word));
            if (unmastered.length > 0 && Math.random() < 0.7) {
                return unmastered[Math.floor(Math.random() * unmastered.length)];
            }
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function getMasteredSet() { return new Set(data.mastered); }

    function getCategoryStats() {
        const masteredSet = getMasteredSet();
        const categories = {};
        getActiveWords().forEach(w => {
            if (!categories[w.category]) categories[w.category] = { total: 0, mastered: 0 };
            categories[w.category].total++;
            if (masteredSet.has(w.word)) categories[w.category].mastered++;
        });
        return categories;
    }

    // ==================================
    //  NAVIGATION
    // ==================================

    const tabPages = ['tabHome', 'tabProgress', 'tabSettings'];

    function showTab(tabId) {
        tabPages.forEach(id => $(id).classList.toggle('hidden', id !== tabId));
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        if (tabId === 'tabHome') {
            updateLevelUI();
            renderHome();
        }
        else if (tabId === 'tabProgress') renderProgress();
        else if (tabId === 'tabSettings') renderSettings();
    }

    function updateLevelUI() {
        $('levelA1').classList.toggle('active', data.currentLevel === 'A1');
        $('levelA2').classList.toggle('active', data.currentLevel === 'A2');
        $('countA1').textContent = `${A1_WORDS.length} words`;
        $('countA2').textContent = `${A2_WORDS.length} words`;
    }

    function openSubPage(pageId) {
        $(pageId).classList.remove('hidden');
        $('tabBar').classList.add('hidden');
    }

    function closeSubPage(pageId, callback) {
        const page = $(pageId);
        page.classList.add('slide-out');
        setTimeout(() => {
            page.classList.add('hidden');
            page.classList.remove('slide-out');
            $('tabBar').classList.remove('hidden');
            if (callback) callback();
        }, 250);
    }

    function openQuiz(filterType, filterValue) {
        state.filter = { type: filterType, value: filterValue };
        state.score = { correct: 0, total: 0 };
        state.streak = 0;

        // Set quiz badge
        let badgeText = 'A1';
        if (filterType === 'category') badgeText = filterValue;
        else if (filterType === 'article') badgeText = filterValue;
        $('quizFilterBadge').textContent = badgeText;

        $('quizView').classList.remove('hidden', 'fade-out');
        $('tabBar').classList.add('hidden');
        renderScore();
        updateStreakBar();
        startNewWord();
    }

    function closeQuiz() {
        const quiz = $('quizView');
        quiz.classList.add('fade-out');
        setTimeout(() => {
            quiz.classList.add('hidden');
            quiz.classList.remove('fade-out');
            $('tabBar').classList.remove('hidden');
            renderHome();
        }, 250);
    }

    // ==================================
    //  HOME
    // ==================================

    function renderHome() {
        const masteredSet = getMasteredSet();
        const activeWords = getActiveWords();
        const totalMastered = activeWords.filter(w => masteredSet.has(w.word)).length;
        const totalWords = activeWords.length;

        $('statMastered').textContent = totalMastered;
        $('statRemaining').textContent = totalWords - totalMastered;
        $('statStreak').textContent = data.bestStreak;
    }

    // ==================================
    //  PROGRESS
    // ==================================

    function renderProgress() {
        const masteredSet = getMasteredSet();
        const categoryStats = getCategoryStats();
        const activeWords = getActiveWords();
        const totalMastered = activeWords.filter(w => masteredSet.has(w.word)).length;
        const totalWords = activeWords.length;
        const overallPct = Math.round((totalMastered / totalWords) * 100) || 0;
        const categoriesComplete = Object.values(categoryStats).filter(c => c.mastered === c.total).length;
        const totalCategories = Object.keys(categoryStats).length;

        $('categoriesBadge').textContent = `${categoriesComplete} / ${totalCategories}`;
        $('overallPct').textContent = `${overallPct}%`;
        $('overallFill').style.width = `${overallPct}%`;

        const $list = $('categoryList');
        $list.innerHTML = '';

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
    }

    // ==================================
    //  SETTINGS
    // ==================================

    function renderSettings() {
        $('optionsValue').textContent = data.settings.numOptions;
        $('optionsMinus').disabled = data.settings.numOptions <= 3;
        $('optionsPlus').disabled = data.settings.numOptions >= 5;
        $('prioritizeToggle').setAttribute('aria-pressed', data.settings.prioritizeUnlearned ? 'true' : 'false');
        
        const activeWords = getActiveWords();
        const cats = new Set(activeWords.map(w => w.category)).size;
        $('appInfoText').textContent = `${activeWords.length} ${data.currentLevel}-level German words · ${cats} categories`;
    }

    // ==================================
    //  CATEGORY PICKER
    // ==================================

    function renderCategoryPicker() {
        const masteredSet = getMasteredSet();
        const categoryStats = getCategoryStats();
        const grid = $('categoryPickerGrid');
        grid.innerHTML = '';

        const sorted = Object.entries(categoryStats).sort((a, b) => a[0].localeCompare(b[0]));

        sorted.forEach(([cat, stats]) => {
            const emoji = CATEGORY_EMOJIS[cat] || '📖';
            const card = document.createElement('button');
            card.className = 'picker-card';
            card.innerHTML = `
                <div class="picker-card-emoji">${emoji}</div>
                <div class="picker-card-name">${cat}</div>
                <div class="picker-card-count">${stats.total} words</div>
                <div class="picker-card-progress">${stats.mastered} mastered</div>
            `;
            card.addEventListener('click', () => {
                closeSubPage('pageCategoryPicker', () => openQuiz('category', cat));
            });
            grid.appendChild(card);
        });
    }

    // ==================================
    //  ARTICLE PICKER
    // ==================================

    function renderArticlePicker() {
        const nouns = getActiveWords().filter(w => isNoun(w));
        const derCount = nouns.filter(w => w.article === 'der').length;
        const dieCount = nouns.filter(w => w.article === 'die').length;
        const dasCount = nouns.filter(w => w.article === 'das').length;

        $('countDer').textContent = `${derCount} nouns`;
        $('countDie').textContent = `${dieCount} nouns`;
        $('countDas').textContent = `${dasCount} nouns`;
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
        const hasArticleStep = isNoun(state.currentWord);

        d1.className = 'step-dot';
        d2.className = 'step-dot';
        d2.classList.toggle('hidden', !hasArticleStep);

        if (state.step === 'meaning') {
            d1.classList.add('active');
        } else if (state.step === 'article') {
            d1.classList.add(state.meaningCorrect ? 'completed' : 'failed');
            d2.classList.add('active');
        } else if (state.step === 'result') {
            d1.classList.add(state.meaningCorrect ? 'completed' : 'failed');
            if (hasArticleStep) {
                d2.classList.add(state.articleCorrect ? 'completed' : 'failed');
            }
        }
    }

    function renderMeaningOptions() {
        const word = state.currentWord;
        const numDistractors = data.settings.numOptions - 1;
        // Pull distractors from active level for variety
        const distractors = pickRandom(getActiveWords(), numDistractors, word.meaning);
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
        if (!selectedOpt.correct) selectedBtn.classList.add('incorrect');

        if (isNoun(state.currentWord)) {
            // Nouns: proceed to article step
            setTimeout(() => transitionToArticleStep(), 1000);
        } else {
            // Non-nouns: skip article, go straight to scoring & result
            state.articleCorrect = true; // no article needed
            state.score.total++;
            if (state.meaningCorrect) {
                state.score.correct++;
                state.streak++;
                if (!data.mastered.includes(state.currentWord.word)) {
                    data.mastered.push(state.currentWord.word);
                }
                if (state.streak > data.bestStreak) data.bestStreak = state.streak;
                saveData();
            } else {
                state.streak = 0;
            }
            renderScore();
            updateStreakBar();
            if (state.meaningCorrect) animateScorePop();
            setTimeout(() => showResult(), 1000);
        }
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
        if (!state.articleCorrect) selectedBtn.classList.add('incorrect');

        $('wordText').textContent = `${correctArticle} ${state.currentWord.word}`;

        const bothCorrect = state.meaningCorrect && state.articleCorrect;
        state.score.total++;
        if (bothCorrect) {
            state.score.correct++;
            state.streak++;
            if (!data.mastered.includes(state.currentWord.word)) {
                data.mastered.push(state.currentWord.word);
            }
            if (state.streak > data.bestStreak) data.bestStreak = state.streak;
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
        const noun = isNoun(word);
        const wordDisplay = noun ? `${word.article} ${word.word}` : word.word;
        const bothCorrect = state.meaningCorrect && state.articleCorrect;
        const neitherCorrect = !state.meaningCorrect && !state.articleCorrect;

        $q('#quizView .question-area').classList.add('hidden');
        const banner = $('resultBanner');
        banner.classList.remove('hidden', 'result-correct', 'result-incorrect', 'result-partial');

        if (bothCorrect) {
            banner.classList.add('result-correct');
            $('resultIcon').textContent = '🎉';
            $('resultText').textContent = 'Perfekt!';
            $('resultDetail').innerHTML = `<strong>${wordDisplay}</strong> = ${word.meaning}`;
        } else if (neitherCorrect || (!noun && !state.meaningCorrect)) {
            banner.classList.add('result-incorrect');
            $('resultIcon').textContent = '😕';
            $('resultText').textContent = 'Not quite';
            $('resultDetail').innerHTML = `The correct answer is:<br><strong>${wordDisplay}</strong> = ${word.meaning}`;
        } else {
            banner.classList.add('result-partial');
            $('resultIcon').textContent = '🤔';
            $('resultText').textContent = 'Almost!';
            const wrongPart = state.meaningCorrect ? 'article' : 'meaning';
            $('resultDetail').innerHTML = `You got the ${wrongPart} wrong.<br><strong>${wordDisplay}</strong> = ${word.meaning}`;
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

        // Show word type label
        const wType = getWordType(state.currentWord);
        const typeLabel = WORD_TYPE_LABELS[wType] || wType;
        $q('#quizView .word-label').textContent = `Was bedeutet… (${typeLabel})`;

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

    // Tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // Level Selector
    $('levelA1').addEventListener('click', () => {
        if (data.currentLevel !== 'A1') {
            data.currentLevel = 'A1';
            saveData();
            showTab('tabHome');
        }
    });
    
    $('levelA2').addEventListener('click', () => {
        if (data.currentLevel !== 'A2') {
            data.currentLevel = 'A2';
            saveData();
            showTab('tabHome');
        }
    });

    // Practice modes
    $('modeAll').addEventListener('click', () => openQuiz('all', null));

    $('modeCategory').addEventListener('click', () => {
        renderCategoryPicker();
        openSubPage('pageCategoryPicker');
    });

    $('modeArticle').addEventListener('click', () => {
        renderArticlePicker();
        openSubPage('pageArticlePicker');
    });

    // Sub-page backs
    $('catPickerBack').addEventListener('click', () => closeSubPage('pageCategoryPicker'));
    $('artPickerBack').addEventListener('click', () => closeSubPage('pageArticlePicker'));

    // Article picker cards
    document.querySelectorAll('.article-pick-card').forEach(card => {
        card.addEventListener('click', () => {
            const article = card.dataset.article;
            closeSubPage('pageArticlePicker', () => openQuiz('article', article));
        });
    });

    // Quiz
    $('quizBackBtn').addEventListener('click', closeQuiz);
    $('nextBtn').addEventListener('click', startNewWord);

    // Settings
    $('optionsMinus').addEventListener('click', () => {
        if (data.settings.numOptions > 3) { data.settings.numOptions--; saveData(); renderSettings(); }
    });
    $('optionsPlus').addEventListener('click', () => {
        if (data.settings.numOptions < 5) { data.settings.numOptions++; saveData(); renderSettings(); }
    });
    $('prioritizeToggle').addEventListener('click', () => {
        data.settings.prioritizeUnlearned = !data.settings.prioritizeUnlearned;
        saveData();
        $('prioritizeToggle').setAttribute('aria-pressed', data.settings.prioritizeUnlearned ? 'true' : 'false');
    });
    $('resetProgressBtn').addEventListener('click', () => {
        if (confirm('This will reset all your mastered words and best streak. Are you sure?')) {
            data.mastered = [];
            data.bestStreak = 0;
            saveData();
            showTab('tabSettings');
        }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        // Only in quiz view
        if ($('quizView').classList.contains('hidden')) return;

        if (state.step === 'result') {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startNewWord(); }
            return;
        }

        if (e.key === 'Escape') { closeQuiz(); return; }
        if (state.answered) return;

        const btns = $('optionsGrid').querySelectorAll('.option-btn');
        const keyMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
        const index = keyMap[e.key.toLowerCase()];
        if (index !== undefined && index >= 0 && index < btns.length) btns[index].click();
    });

    // --- Init ---
    showTab('tabHome');

    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

})();
