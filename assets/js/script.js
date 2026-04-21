import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { SHEET_CSV_URL, ENCOURAGEMENTS, SOFT_COLORS } from "./dtb.js";
import { getSmartFeedback } from "./smafed.js";
import { updateProcabScore, saveFinalProgress, getCustomLessons } from "./procab.js";
import "./func.js";

export const State = {
    currentUserData: { procab_scores: {}, cumulative_progress: {} },
    LESSONS_DATABASE: {},
    sessionWords: [],
    currentLessonId: "",
    currentIdx: 0,
    attemptsPerWord: 0,
    audioConfig: { 
        lang: localStorage.getItem('audio-lang') || 'en-US', 
        rate: parseFloat(localStorage.getItem('audio-rate')) || 1.0 
    }
};

// 1. Auth & Data Init
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) State.currentUserData = docSnap.data();
        const customs = await getCustomLessons();
        customs.forEach(c => { State.LESSONS_DATABASE[c.id] = c; });
        updateUIForUser(user);
        if (Object.keys(State.LESSONS_DATABASE).length > 0) updateDashboard();
    } else if (!['/index.html', '/'].includes(window.location.pathname)) {
        window.location.href = '/index.html';
    }
});

function updateUIForUser(user) {
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    if (avatar) {
        avatar.src = user.photoURL || 'https://via.placeholder.com/35';
        avatar.style.display = 'block'; 
    }
    if (userName) {
        userName.innerText = user.displayName;
        userName.style.display = 'inline'; 
    }
}

window.addEventListener('load', async () => {
    if (localStorage.getItem('dark-mode') === 'true') document.body.classList.add('dark-mode');
    const speedBtn = document.getElementById('speed-btn');
    if (speedBtn) speedBtn.innerText = State.audioConfig.rate + 'x';
    const voiceLabels = { 'en-US': 'US', 'en-GB': 'UK', 'en-AU': 'AU' };
    const voiceBtn = document.getElementById('voice-btn');
    if (voiceBtn) voiceBtn.innerText = voiceLabels[State.audioConfig.lang] || 'US';
    await fetchFlashcardsFromSheets();
    updateDashboard();
});

async function fetchFlashcardsFromSheets() {
    try {
        const res = await fetch(SHEET_CSV_URL);
        const text = await res.text();
        const rows = parseCSV(text);
        State.LESSONS_DATABASE = {};
        rows.slice(1).forEach(cols => {
            if (cols.length >= 4) {
                if (window.CATEGORY_FILTER && window.CATEGORY_FILTER !== (cols[4] || '').trim()) return;
                const words = [];
                const parts = cols[2].split(',');
                for (let i = 0; i < parts.length; i += 3) {
                    if (parts[i] && parts[i+1] && parts[i+2]) 
                        words.push({ word: parts[i].trim(), ipa: parts[i+1].trim(), meaning: parts[i+2].trim(), originalIndex: i/3 });
                }
                State.LESSONS_DATABASE[cols[0]] = { title: cols[1], words: words, num: parseInt(cols[3]) };
            }
        });
    } catch (e) { console.error("Lỗi fetch:", e); }
}

function parseCSV(t) {
    const r = []; let curR = []; let curC = ''; let q = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === '"' && q && t[i+1] === '"') { curC += '"'; i++; }
        else if (c === '"') q = !q;
        else if (c === ',' && !q) { curR.push(curC.trim()); curC = ''; }
        else if ((c === '\n' || c === '\r') && !q) {
            if (curR.length > 0 || curC !== '') { curR.push(curC.trim()); r.push(curR); curR = []; curC = ''; }
        } else curC += c;
    }
    if (curR.length > 0 || curC !== '') { curR.push(curC.trim()); r.push(curR); }
    return r;
}

export async function updateDashboard() {
    const grid = document.getElementById('dashboard-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const isPersonalPage = window.CATEGORY_FILTER === 'PERSONAL';

    if (isPersonalPage) {
        const createBtn = document.createElement('div');
        createBtn.className = 'lesson-card';
        createBtn.style.border = '2px dashed var(--primary)';
        createBtn.onclick = window.openCreateModal;
        createBtn.innerHTML = `<h3>+ Tạo bộ từ mới</h3><p>Tối đa 50 từ</p>`;
        grid.appendChild(createBtn);

        const customs = await getCustomLessons();
        customs.forEach(c => { 
            if (!State.LESSONS_DATABASE[c.id]) {
                State.LESSONS_DATABASE[c.id] = c;
            }
        });
    }

    const progress = State.currentUserData.cumulative_progress || {};
    
    Object.keys(State.LESSONS_DATABASE).forEach(id => {
        const d = State.LESSONS_DATABASE[id];
        
        if (isPersonalPage && !d.isCustom) return;
        if (!isPersonalPage && d.isCustom) return;

        const count = progress[id] || 0;
        const target = d.num * 5;
        const p = Math.min(Math.floor((count / target) * 100), 100);

        const card = document.createElement('div');
        card.className = `lesson-card ${p >= 100 ? 'done' : ''}`;
        card.onclick = () => window.showSelectionModal(id);
        
        const deleteBtn = (isPersonalPage && d.isCustom) ? 
            `<button onclick="window.handleDeleteLesson(event, '${id}')" style="background:none; border:none; color:var(--error); cursor:pointer; text-decoration:underline; margin-top:10px; font-size:0.8rem;">Xóa bộ từ</button>` : '';

        card.innerHTML = `
            <h3>${d.title}</h3>
            <div class="progress-text">${count}/${target}</div>
            <div class="progress-container"><div class="progress-fill" style="width:${p}%"></div></div>
            ${deleteBtn}
        `;
        grid.appendChild(card);
    });
}

// 2. Core Flashcard Logic
export function renderFlashcard() {
    State.attemptsPerWord = 0;
    const item = State.sessionWords[State.currentIdx];
    const container = document.getElementById('lesson-content');
    
    if (item.type === 'special') {
        const q = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
        const c = SOFT_COLORS[Math.floor(Math.random() * SOFT_COLORS.length)];
        container.innerHTML = `<div class="flashcard special-card"><div class="card-face" style="background:${c}; border-color:${c};"><div class="word-text" style="font-size: 1.5rem;">${q}</div></div></div>`;
        setTimeout(() => { 
            State.currentIdx++; 
            if (State.currentIdx < State.sessionWords.length) renderFlashcard(); else finish(); 
        }, 3000);
    } else {
           container.innerHTML = `
            <div class="flashcard" id="fc" onclick="window.toggleFlip()">
                <div class="flashcard-inner">
                    <div class="card-face">
                        <div class="word-text" onclick="event.stopPropagation(); window.speakWord('${item.word}')">
                            <span class="speak-icon">🔊</span> ${item.word}
                        </div>
                        <div class="ipa-text">/${item.ipa}/</div>
                    </div>
                    <div class="card-face card-back" onclick="event.stopPropagation()">
                        <p style="font-weight: 500; margin-bottom: 20px; cursor: pointer;" onclick="window.speakWord('${item.word}')">
                            <span style="font-size: 1.2rem;">📢</span> ${item.meaning}
                        </p>
                        <input type="text" id="fc-input" placeholder="Gõ từ..." onkeydown="window.handleEnter(event)" autocomplete="off">
                        <div id="fc-error" style="margin-top:12px; min-height: 24px;"></div>
                    </div>
                </div>
            </div>`;
        
        window.speakWord(item.word);
        
       setTimeout(() => {
            const input = document.getElementById('fc-input');
            if (input) input.focus();
        }, 300);
    }
}

// 3. Verify Logic
export function verify() {
    const input = document.getElementById('fc-input');
    const errorDiv = document.getElementById('fc-error');
    const flashcard = document.getElementById('fc');
    const target = State.sessionWords[State.currentIdx];
    const correct = target.word.toLowerCase();
    const val = input.value.trim().toLowerCase();

    if (!input || input.disabled) return;

    if (val === correct) {
        updateProcabScore(true, State.currentLessonId, target.originalIndex, State.currentUserData);
        if (flashcard) flashcard.classList.remove('flipped');
        input.blur();
        setTimeout(() => {
            State.currentIdx++;
            State.attemptsPerWord = 0; 
            if (State.currentIdx < State.sessionWords.length) renderFlashcard(); else finish();
        }, 350);
    } else {
        State.attemptsPerWord++;
        updateProcabScore(false, State.currentLessonId, target.originalIndex, State.currentUserData);
        
        input.style.borderColor = "var(--error)";
        input.disabled = true; 

        const feedback = getSmartFeedback(correct, val);

        if (State.attemptsPerWord === 1) {
            renderInputFeedback(feedback.diffMap, errorDiv, feedback.accuracy);
            setTimeout(() => {
                input.disabled = false;
                input.style.borderColor = "rgba(255,255,255,0.2)";
                input.value = "";
                errorDiv.innerHTML = ''; 
                input.focus();
            }, 2000);
        } else {
            renderCorrectFeedback(correct, val, errorDiv);
            setTimeout(() => {
                input.disabled = false;
                input.style.borderColor = "rgba(255,255,255,0.2)";
                input.value = "";
                errorDiv.innerHTML = '';
                if (flashcard) flashcard.classList.remove('flipped');
                input.blur(); 
                State.attemptsPerWord = 0;
                window.speakWord(target.word);
            }, 2500);
        }
    }
}

function renderInputFeedback(diffMap, targetEl, accuracy) {
    targetEl.innerHTML = '';
    const wrapper = document.createElement('div');

    diffMap.forEach(item => {
        const span = document.createElement('span');
        span.className = `diff-char diff-${item.type}`;
        
        span.innerText = (item.type === 'missing') ? item.expected : item.char;
        
        if (item.char !== '' || item.type === 'missing') {
            span.setAttribute('data-label', item.label);
            wrapper.appendChild(span);
        }
    });
    
    targetEl.appendChild(wrapper);
    const acc = document.createElement('div');
    acc.style.cssText = "color: #fcd34d; font-size: 0.8rem; margin-top: 8px; font-weight: bold;";
    acc.innerText = `Chính xác: ${accuracy}%`;
    targetEl.appendChild(acc);
}

function renderCorrectFeedback(correct, input, targetEl) {
    targetEl.innerHTML = '';
    const feedback = getSmartFeedback(correct, input);
    const wrapper = document.createElement('div');
    
    feedback.diffMap.forEach(item => {
        if (item.expected !== '') {
            const span = document.createElement('span');
            span.innerText = item.expected;
            span.className = `diff-char ${item.type === 'correct' ? 'diff-correct' : 'diff-wrong'}`;
            if (item.type !== 'correct') span.style.textDecoration = "none";
            wrapper.appendChild(span);
        }
    });
    
    const label = document.createElement('div');
    label.style.cssText = "color: rgba(255,255,255,0.7); font-size: 0.75rem; margin-bottom: 8px;";
    label.innerText = "Đáp án đúng là:";
    targetEl.appendChild(label);
    targetEl.appendChild(wrapper);
}

export async function finish() {
    const count = State.sessionWords.filter(w => w.type === 'normal').length;
    await saveFinalProgress(State.currentLessonId, count, State.currentUserData, State.LESSONS_DATABASE);
    document.getElementById('lesson-content').innerHTML = `
        <div class="finish-container">
            <div class="finish-icon">🎉</div>
            <h2>Hoàn thành xuất sắc!</h2>
            <p>Em đã hoàn thành phiên học này rồi.</p>
            <button onclick="window.backToDashboard()" class="back-btn-styled">
                QUAY LẠI BẢNG ĐIỀU KHIỂN
            </button>
        </div>
    `;
}

export function backToDashboard() {
    document.getElementById('view-lesson').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    updateDashboard();
}
window.openCreateModal = () => {
    const modal = document.getElementById('modal-create-lesson');
    if (modal) modal.style.display = 'flex';
};

window.closeCreateModal = () => {
    const modal = document.getElementById('modal-create-lesson');
    if (modal) modal.style.display = 'none';
};
window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
};
