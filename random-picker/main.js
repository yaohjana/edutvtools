/**
 * 隨機點名器主程式 (遊戲化單鍵控制與拉霸機風格)
 */

// =================================================================
// 0. 核心定義與狀態
// =================================================================

const $ = (s) => document.querySelector(s);
const STORE_KEY = 'rp_students_v1';
const DISPLAY = $('#display');
const STATS = $('#stats');
const PROGRESS = $('#progress');

const BTN_START = $('#btnStart');
const BTN_RESET = $('#btnReset');
const LIST_UL = $('#compactList'); 
const NAME_LIST_TEXTAREA = $('#nameList');

// 模態框元素
const BTN_HELP = $('#btnHelp');
const HELP_MODAL = $('#helpModal');
const BTN_CLOSE_MODAL = $('#btnCloseModal');
const MODAL_OVERLAY = $('.modal-overlay');

// 核心狀態
let state = {
    students: [], 
    drawn: [],    
    isRolling: false, 
    rollInterval: null, 
    lastDrawnName: '尚未開始', 
    
    // 設定項
    groupSize: 1, 
    noRepeat: true,
    soundOn: true,      // 追蹤音效狀態
    voiceEnabled: true, // 追蹤語音狀態
};

// 新增音效物件 (需要準備 click.mp3, start.mp3, roll.mp3, stop.mp3 檔案)
const sound = {
    click: new Audio('click.mp3'),  
    start: new Audio('start.mp3'),  
    roll: new Audio('roll.mp3'),    
    stop: new Audio('stop.mp3'),    
};

// 閃爍動畫 keyframes
const FLICKER_ANIMATION = [
    { transform: 'scale(1)', textShadow: '0 0 0px #fff' },
    { transform: 'scale(1.06)', textShadow: '0 0 18px #fff' },
    { transform: 'scale(1)', textShadow: '0 0 0px #fff' }
];
const FLICKER_OPTIONS = { duration: 320, easing: 'ease-out' };


// 範本資料 (保持不變)
const TEMPLATES = {
    numbers: Array.from({ length: 33 }, (_, i) => `${i + 1} 號`).join('\n'),
    fruits: [
        '蘋果', '香蕉', '橘子', '草莓', '葡萄', '鳳梨', '西瓜', '芒果', '荔枝', '龍眼', 
        '火龍果', '芭樂', '梨子', '奇異果', '檸檬', '櫻桃', '藍莓', '覆盆子', '酪梨', '木瓜',
        '哈密瓜', '百香果', '柚子', '石榴', '椰子', '榴槤', '蓮霧', '桑葚', '楊桃', '蜜棗',
        '紅毛丹', '山竹', '釋迦'
    ].join('\n'),
    animals: [
        '獅子', '老虎', '大象', '長頸鹿', '熊貓', '猴子', '企鵝', '斑馬', '袋鼠', '無尾熊',
        '老鷹', '貓頭鷹', '海豚', '鯨魚', '鯊魚', '駱駝', '犀牛', '河馬', '蛇', '鱷魚',
        '狐狸', '狼', '兔子', '松鼠', '孔雀', '鸚鵡', '變色龍', '水獺', '樹懶', '蝙蝠',
        '蝸牛', '烏龜', '蜜蜂'
    ].join('\n'),
    characters: [
        '福爾摩斯', '哈利波特', '孫悟空', '林黛玉', '羅密歐', '茱麗葉', '堂吉訶德', '包青天', '佐羅', '白雪公主',
        '阿拉丁', '彼得潘', '愛麗絲', '綠野仙蹤', '魯濱遜', '摩訶婆羅多', '唐老鴨', '米老鼠', '小王子', '茶花女',
        '湯姆索亞', '白鯨記', '簡愛', '達爾文', '莎士比亞', '馬克吐溫', '愛因斯坦', '達文西', '居禮夫人', '霍金',
        '甘地', '華生', '莫札特'
    ].join('\n'),
};


// =================================================================
// 1. 資料存取與初始化
// =================================================================

function save() {
    try {
        const dataToStore = { 
            students: state.students, 
            drawn: state.drawn 
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(dataToStore));
    } catch (e) {
        console.error('LocalStorage save failed:', e);
    }
}

function load() {
    try {
        const stored = localStorage.getItem(STORE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            state.students = data.students || [];
            state.drawn = data.drawn || [];
        }
    } catch (e) {
        console.error('LocalStorage load failed:', e);
    }
}

function loadUISettings() {
    // 從 HTML 元素中讀取當前設定狀態
    state.noRepeat = $('#noRepeat').checked;
    state.soundOn = $('#soundOn').checked;
    state.voiceEnabled = $('#voiceOn').checked;

    const size = parseInt($('#groupSize').value);
    state.groupSize = (size > 0) ? size : 1;
    $('#groupSize').value = state.groupSize;
}

// =================================================================
// 2. 名單管理 (略)
// =================================================================

function updateListFromTextarea() {
    playSound('click'); 
    const newStudents = NAME_LIST_TEXTAREA.value
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
    
    const studentsChanged = newStudents.length !== state.students.length || newStudents.some((name, i) => name !== state.students[i]);

    if (studentsChanged) {
        state.students = newStudents;
        state.drawn = []; 
        save();
        renderList();
        updateDisplay('名單已更新');
    } else {
        updateDisplay('名單無變動');
    }
}

function clearList() {
    playSound('click'); 
    if (confirm('確定清空所有名單？')) { 
        state.students = []; 
        state.drawn = []; 
        NAME_LIST_TEXTAREA.value = ''; 
        save(); 
        renderList();
        updateDisplay('尚未開始');
    }
}

function loadTemplate() {
    playSound('click'); 
    const select = $('#templateSelect');
    const templateKey = select.value;
    
    if (templateKey === 'none') {
        alert('請先選擇一個範本。');
        return;
    }
    
    if (!TEMPLATES[templateKey]) {
        console.error('Template key not found:', templateKey);
        return;
    }

    if (state.students.length > 0 && !confirm('確定要載入新的範本？這將會覆蓋當前名單。')) {
        return;
    }
    
    NAME_LIST_TEXTAREA.value = TEMPLATES[templateKey];
    updateListFromTextarea(); 
    select.value = 'none'; 
}


// =================================================================
// 3. UI 渲染與抽點流程
// =================================================================

function playSound(name, loop = false) {
    if (state.soundOn && sound[name]) {
        sound[name].currentTime = 0; 
        sound[name].loop = loop; 
        sound[name].play().catch(e => console.warn("Sound playback blocked or failed:", e));
    }
}

function stopSound(name) {
    if (sound[name]) {
        sound[name].pause();
        sound[name].currentTime = 0;
    }
}

function speakResult(text) {
    if (state.voiceEnabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance();
        utterance.text = '抽到！' + text.replace(/、/g, '，還有'); 
        utterance.lang = 'zh-TW'; 
        utterance.rate = 1.0; 
        utterance.pitch = 1.0; 
        
        const voices = window.speechSynthesis.getVoices();
        const chineseVoice = voices.find(voice => voice.lang.includes('zh-'));
        if (chineseVoice) {
            utterance.voice = chineseVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
}

/**
 * 切換音效開關並更新 UI
 */
function toggleSound() {
    state.soundOn = !state.soundOn;
    $('#soundOn').checked = state.soundOn;
    playSound('click');
    if (!state.soundOn) {
        stopSound('roll'); // 如果關閉音效，停止正在播放的滾動音
    }
    // 不需 loadUISettings，因為狀態已經更新
}

/**
 * 切換語音開關並更新 UI
 */
function toggleVoice() {
    state.voiceEnabled = !state.voiceEnabled;
    $('#voiceOn').checked = state.voiceEnabled;
    playSound('click');
    if (state.voiceEnabled) {
        window.speechSynthesis.getVoices(); // 啟動時預載語音
    } else {
        window.speechSynthesis.cancel(); // 關閉時停止正在說話的語音
    }
}

function renderList() {
    if (!state.students || state.students.length === 0) {
        LIST_UL.textContent = '名單是空的。請在上方輸入姓名或載入範本。';
        updateStats();
        return;
    }

    const listHTML = state.students.map((name) => {
        const isDrawn = state.drawn.includes(name);
        
        if (isDrawn) {
            return `<del>${name}</del>`;
        } else {
            return name;
        }
    }).join('、'); 

    LIST_UL.innerHTML = listHTML;
    
    updateStats();
}

function updateStats() {
    const total = state.students.length;
    const drawnCount = state.drawn.length;
    const remaining = total - drawnCount;

    STATS.textContent = `${total} 位學生`;
    
    if (total === 0) {
        PROGRESS.textContent = '名單空白';
        PROGRESS.className = 'muted';
    } else if (drawnCount === 0) {
        PROGRESS.textContent = '尚未抽點';
        PROGRESS.className = 'muted';
    } else if (drawnCount === total) {
        PROGRESS.textContent = `已抽點 ${drawnCount} 位 (全員完成)`;
        PROGRESS.className = 'success';
    } else {
        PROGRESS.textContent = `已抽點 ${drawnCount} 位 (剩餘 ${remaining} 位)`;
        PROGRESS.className = '';
    }
    
    // 按鈕狀態更新
    BTN_START.disabled = total === 0;
    
    if (state.isRolling) {
        BTN_START.textContent = '按下 Space 鍵停止';
        BTN_START.classList.add('rolling');
    } else {
        BTN_START.textContent = '按下 Space 鍵開始';
        BTN_START.classList.remove('rolling');
    }
}

function updateDisplay(name) {
    DISPLAY.textContent = name;
    state.lastDrawnName = name;
}

function rollTheDice() {
    let availableNames = state.students;

    if (state.noRepeat) {
        availableNames = state.students.filter(name => !state.drawn.includes(name));
        
        if (availableNames.length === 0 && state.students.length > 0) {
            resetDraw(false); 
            availableNames = state.students;
        }
    }

    if (availableNames.length === 0) {
        toggleRoll(); // 自動停止
        updateDisplay('名單空白或已抽完');
        return;
    }

    const drawSize = Math.min(state.groupSize, availableNames.length);
    let drawnNames = [];
    let tempNames = [...availableNames];

    for (let i = 0; i < drawSize; i++) {
        const randomIndex = Math.floor(Math.random() * tempNames.length);
        drawnNames.push(tempNames[randomIndex]);
        tempNames.splice(randomIndex, 1);
    }

    const result = drawnNames.join('、');
    updateDisplay(result);
}

function startRoll() {
    loadUISettings(); 
    
    state.isRolling = true;
    updateStats();

    playSound('start'); 
    playSound('roll', true); 

    state.rollInterval = setInterval(rollTheDice, 80);
}

function stopRoll() {
    state.isRolling = false;
    clearInterval(state.rollInterval);
    state.rollInterval = null;
    
    stopSound('roll'); 
    playSound('stop'); 

    rollTheDice(); // 執行最後一次點名
    
    const finalNames = state.lastDrawnName.split('、').map(n => n.trim()).filter(Boolean);

    if (state.noRepeat) {
        finalNames.forEach(name => {
            if (!state.drawn.includes(name)) {
                state.drawn.push(name);
            }
        });
        save();
        renderList();
    } 

    DISPLAY.animate(FLICKER_ANIMATION, FLICKER_OPTIONS);
    speakResult(state.lastDrawnName); 
    
    updateStats(); 
}

// 核心功能：切換開始/停止
function toggleRoll() {
    if (state.students.length === 0) {
        alert('請先輸入名單！');
        return;
    }
    
    if (state.isRolling) {
        stopRoll();
    } else {
        startRoll();
    }
}

function resetDraw(showConfirm = true) {
    playSound('click'); 
    if (state.students.length === 0) return;
    if (showConfirm && !confirm('確定重置抽點名單？')) return;
    
    state.drawn = [];
    save();
    renderList();
    updateDisplay('已重置');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) { 
        document.documentElement.requestFullscreen?.(); 
    } else { 
        document.exitFullscreen?.(); 
    }
}

// 模態框控制
function openModal() {
    playSound('click'); 
    HELP_MODAL.classList.remove('hidden');
}

function closeModal() {
    HELP_MODAL.classList.add('hidden');
}

// =================================================================
// 4. 介面綁定與主程序
// =================================================================

function bindUI() {
    // 名單編輯與載入
    $('#btnUpdateList').onclick = updateListFromTextarea;
    $('#btnClear').onclick = clearList;
    $('#btnLoadTemplate').onclick = loadTemplate;
    
    // 抽點控制：使用單一函式
    BTN_START.onclick = toggleRoll; 
    BTN_RESET.onclick = () => resetDraw(true);

    // 模態框控制
    BTN_HELP.onclick = openModal;
    BTN_CLOSE_MODAL.onclick = closeModal;
    MODAL_OVERLAY.onclick = closeModal; 

    // 設定項監聽 (確保點擊 UI 元素時也能同步更新狀態)
    $('#noRepeat').addEventListener('change', (e) => { state.noRepeat = e.target.checked; updateStats(); playSound('click'); });
    $('#soundOn').addEventListener('change', toggleSound); 
    $('#voiceOn').addEventListener('change', toggleVoice);
    $('#groupSize').addEventListener('change', () => { loadUISettings(); playSound('click'); });

    // 全域快捷鍵
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        
        // 如果模態框開啟，只允許 ESC 關閉
        if (e.key === 'Escape') {
            if (!HELP_MODAL.classList.contains('hidden')) {
                closeModal();
                return;
            }
            return;
        }

        // 排除輸入元素被選中時的快捷鍵干擾
        const isInputFocus = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
        if (isInputFocus) return;

        if (key === ' ') { // Space 鍵
            e.preventDefault(); 
            toggleRoll(); 
        } else if (key === 'r') { // R 鍵
            resetDraw(); 
        } else if (key === 'f') { // F 鍵
            toggleFullscreen(); 
        } else if (key === 'm') { // M 鍵 (靜音/音效)
            toggleSound(); 
        } else if (key === 'v') { // V 鍵 (語音開關)
            toggleVoice();
        }
    });

    // 為所有沒有單獨處理點擊事件的按鈕添加通用點擊音效
    document.querySelectorAll('.btn:not(#btnStart)').forEach(btn => {
        if (btn.onclick === null) {
             btn.addEventListener('click', () => playSound('click'));
        }
    });
}

function main() {
    load(); 
    
    NAME_LIST_TEXTAREA.value = state.students.join('\n');
    
    loadUISettings(); 
    renderList(); 
    bindUI();

    window.speechSynthesis.getVoices();
}

window.addEventListener('DOMContentLoaded', main);