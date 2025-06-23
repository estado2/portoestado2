// GAS URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxelfdp7fu36as6kYSf_acmTx4PMCVfWi0vbHt9HzRQ9Qg1yvWYgRaW-5rQRBR4bM6CNA/exec';

// 게임 상태 관리
class GameState {
    constructor() {
        this.currentUser = null;
        this.coins = 0;
        this.gameHistory = [];
        this.ranking = [];
        this.pendingCoinRequests = [];
    }
}

// 게임 설정
const GAME_CONFIG = {
    GAME_DURATION: 30, // 30초
    MOLE_DURATIONS: [0.5, 1.0, 1.5, 2.0], // 두더지 유지 시간
    GOLDEN_MOLE_CHANCE: 0.1, // 10% 확률
    GOLDEN_MOLE_DURATION: 0.5, // 황금두더지 고정 시간
    GOLDEN_MOLE_BONUS: 5, // 황금두더지 점수
    GOLDEN_MOLE_TIME_BONUS: 5, // 황금두더지 시간 보너스
    GOLDEN_MOLE_COIN_BONUS: 1, // 황금두더지 코인 보너스
    INITIAL_COINS: 5, // 초기 코인
    COIN_REQUEST_BONUS: 5 // 코인 요청 수락 시 보너스
};

// 전역 변수
let gameState = new GameState();
let gameTimer = null;
let moleTimer = null;
let currentScore = 0;
let goldenMolesHit = 0;
let gameStartTime = 0;
let isGameActive = false;
let currentMole = null;
let coinRequestPoller = null;
let processedCoinRequests = new Set(); // 처리된 코인 요청 추적

// DOM 요소들
const screens = {
    login: document.getElementById('loginScreen'),
    mainMenu: document.getElementById('mainMenu'),
    game: document.getElementById('gameScreen'),
    gameOver: document.getElementById('gameOverScreen')
};

const elements = {
    username: document.getElementById('username'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('loginBtn'),
    userDisplayName: document.getElementById('userDisplayName'),
    coinCount: document.getElementById('coinCount'),
    playGameBtn: document.getElementById('playGameBtn'),
    requestCoinBtn: document.getElementById('requestCoinBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    currentScore: document.getElementById('currentScore'),
    timeLeft: document.getElementById('timeLeft'),
    pauseBtn: document.getElementById('pauseBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn'),
    finalScore: document.getElementById('finalScore'),
    goldenMoles: document.getElementById('goldenMoles'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    backToMenuFromGameOverBtn: document.getElementById('backToMenuFromGameOverBtn'),
    rankingList: document.getElementById('rankingList'),
    coinRequestModal: document.getElementById('coinRequestModal'),
    coinRequestNotificationModal: document.getElementById('coinRequestNotificationModal'),
    requestTargetUser: document.getElementById('requestTargetUser'),
    requestMessage: document.getElementById('requestMessage'),
    sendRequestBtn: document.getElementById('sendRequestBtn'),
    cancelRequestBtn: document.getElementById('cancelRequestBtn'),
    requestFromUser: document.getElementById('requestFromUser'),
    requestMessageText: document.getElementById('requestMessageText'),
    acceptRequestBtn: document.getElementById('acceptRequestBtn'),
    rejectRequestBtn: document.getElementById('rejectRequestBtn')
};

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadRanking();
});

function initializeEventListeners() {
    // 로그인 관련
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.username.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    elements.password.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // 메인 메뉴 관련
    elements.playGameBtn.addEventListener('click', startGame);
    elements.requestCoinBtn.addEventListener('click', showCoinRequestModal);
    elements.logoutBtn.addEventListener('click', handleLogout);

    // 게임 관련
    elements.pauseBtn.addEventListener('click', pauseGame);
    elements.backToMenuBtn.addEventListener('click', backToMenu);

    // 게임 종료 관련
    elements.playAgainBtn.addEventListener('click', startGame);
    elements.backToMenuFromGameOverBtn.addEventListener('click', backToMenu);

    // 코인 요청 모달 관련
    elements.sendRequestBtn.addEventListener('click', sendCoinRequest);
    elements.cancelRequestBtn.addEventListener('click', hideCoinRequestModal);
    elements.acceptRequestBtn.addEventListener('click', acceptCoinRequest);
    elements.rejectRequestBtn.addEventListener('click', rejectCoinRequest);

    // 두더지 클릭 이벤트
    document.querySelectorAll('.mole-hole').forEach(hole => {
        hole.addEventListener('click', handleMoleClick);
    });

    // 모달 외부 클릭 시 닫기
    window.addEventListener('click', (e) => {
        if (e.target === elements.coinRequestModal) {
            hideCoinRequestModal();
        }
        if (e.target === elements.coinRequestNotificationModal) {
            hideCoinRequestNotificationModal();
        }
    });
}

// 로그인 처리
async function handleLogin() {
    const username = elements.username.value.trim();
    const password = elements.password.value.trim();

    if (!username || !password) {
        alert('이름과 비밀번호를 입력해주세요.');
        return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
        alert('비밀번호는 4자리 숫자여야 합니다.');
        return;
    }

    try {
        const userData = await authenticateUser(username, password);
        
        if (userData) {
            gameState.currentUser = userData;
            gameState.coins = userData.coins || GAME_CONFIG.INITIAL_COINS;
            
            elements.userDisplayName.textContent = username;
            elements.coinCount.textContent = gameState.coins;
            
            showScreen('mainMenu');
            startCoinRequestPolling(); // 코인 요청 폴링 시작
        } else {
            alert('로그인에 실패했습니다. 이름과 비밀번호를 확인해주세요.');
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        alert('로그인 중 오류가 발생했습니다.');
    }
}

// 사용자 인증 (GAS 연동)
async function authenticateUser(username, password) {
    try {
        const response = await fetch(`${GAS_URL}?action=getUser&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
        const data = await response.json();
        
        if (data.error) {
            if (data.error === 'wrong password') {
                return null;
            }
            throw new Error(data.error);
        }
        
        return data;
    } catch (error) {
        console.error('인증 오류:', error);
        throw error;
    }
}

// 게임 시작
function startGame() {
    if (gameState.coins <= 0) {
        alert('코인이 부족합니다. 코인을 요청해주세요.');
        return;
    }

    // 코인 차감
    gameState.coins--;
    elements.coinCount.textContent = gameState.coins;
    
    // 게임 상태 초기화
    currentScore = 0;
    goldenMolesHit = 0;
    gameStartTime = Date.now();
    isGameActive = true;
    
    // UI 업데이트
    elements.currentScore.textContent = '0';
    elements.timeLeft.textContent = '30.00';
    showScreen('game');
    
    // 게임 시작
    startGameTimer();
    spawnMole();
}

// 게임 타이머
function startGameTimer() {
    const startTime = Date.now();
    const endTime = startTime + (GAME_CONFIG.GAME_DURATION * 1000);
    
    gameTimer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        const remainingSeconds = (remaining / 1000).toFixed(2);
        
        elements.timeLeft.textContent = remainingSeconds;
        
        if (remaining <= 0) {
            endGame();
        }
    }, 10); // 0.01초 단위 업데이트
}

// 두더지 생성
function spawnMole() {
    if (!isGameActive) return;
    
    // 이전 두더지 숨기기
    if (currentMole) {
        currentMole.classList.remove('show', 'golden');
    }
    
    // 랜덤 위치 선택
    const holes = document.querySelectorAll('.mole-hole');
    const randomIndex = Math.floor(Math.random() * holes.length);
    const selectedHole = holes[randomIndex];
    const mole = selectedHole.querySelector('.mole');
    
    // 황금두더지 여부 결정
    const isGolden = Math.random() < GAME_CONFIG.GOLDEN_MOLE_CHANCE;
    
    if (isGolden) {
        mole.classList.add('golden');
    }
    
    // 두더지 표시
    mole.classList.add('show');
    currentMole = mole;
    
    // 유지 시간 설정
    const duration = isGolden ? GAME_CONFIG.GOLDEN_MOLE_DURATION : 
        GAME_CONFIG.MOLE_DURATIONS[Math.floor(Math.random() * GAME_CONFIG.MOLE_DURATIONS.length)];
    
    // 자동으로 숨기기
    moleTimer = setTimeout(() => {
        if (mole.classList.contains('show')) {
            mole.classList.remove('show', 'golden');
            currentMole = null;
            // 다음 두더지 생성
            setTimeout(spawnMole, 500);
        }
    }, duration * 1000);
}

// 두더지 클릭 처리
function handleMoleClick(event) {
    if (!isGameActive) return;
    
    const hole = event.currentTarget;
    const mole = hole.querySelector('.mole');
    
    if (mole.classList.contains('show')) {
        const isGolden = mole.classList.contains('golden');
        
        // 효과음 재생
        const sound = isGolden ? document.getElementById('goldenHitSound') : document.getElementById('hitSound');
        sound.currentTime = 0;
        sound.play().catch(e => console.log('효과음 재생 실패:', e));
        
        // 점수 추가
        currentScore += isGolden ? GAME_CONFIG.GOLDEN_MOLE_BONUS : 1;
        elements.currentScore.textContent = currentScore;
        
        if (isGolden) {
            goldenMolesHit++;
            
            // 황금 효과 생성
            createGoldenEffect(hole);
            
            // 시간 보너스
            const currentTime = parseFloat(elements.timeLeft.textContent);
            const newTime = Math.min(30, currentTime + GAME_CONFIG.GOLDEN_MOLE_TIME_BONUS);
            elements.timeLeft.textContent = newTime.toFixed(2);
            
            // 코인 보너스
            gameState.coins += GAME_CONFIG.GOLDEN_MOLE_COIN_BONUS;
            elements.coinCount.textContent = gameState.coins;
        }
        
        // 뚝배기 터지는 효과 생성
        createPunchBreakEffect(hole);
        
        // 뚝배기 숨기기
        mole.classList.remove('show', 'golden');
        currentMole = null;
        
        // 타이머 정리
        if (moleTimer) {
            clearTimeout(moleTimer);
        }
        
        // 다음 뚝배기 생성
        setTimeout(spawnMole, 500);
    }
}

// 황금 효과 생성
function createGoldenEffect(hole) {
    const effect = document.createElement('div');
    effect.className = 'golden-effect';
    hole.appendChild(effect);
    
    setTimeout(() => {
        hole.removeChild(effect);
    }, 500);
}

// 뚝배기 터지는 효과 생성
function createPunchBreakEffect(hole) {
    const effect = document.createElement('div');
    effect.className = 'punch-break';
    hole.appendChild(effect);
    
    setTimeout(() => {
        if (hole.contains(effect)) {
            hole.removeChild(effect);
        }
    }, 500);
}

// 게임 종료
function endGame() {
    isGameActive = false;
    
    if (gameTimer) {
        clearInterval(gameTimer);
    }
    if (moleTimer) {
        clearTimeout(moleTimer);
    }
    
    // 현재 두더지 숨기기
    if (currentMole) {
        currentMole.classList.remove('show', 'golden');
    }
    
    // 게임 결과 저장
    const gameResult = {
        score: currentScore,
        goldenMolesHit: goldenMolesHit,
        duration: GAME_CONFIG.GAME_DURATION,
        timestamp: new Date().toISOString()
    };
    
    saveGameResult(gameResult);
    
    // UI 업데이트
    elements.finalScore.textContent = currentScore;
    elements.goldenMoles.textContent = goldenMolesHit;
    
    showScreen('gameOver');
    
    // 랭킹 업데이트
    updateRanking();
}

// 게임 일시정지
function pauseGame() {
    if (!isGameActive) return;
    
    isGameActive = false;
    
    if (gameTimer) {
        clearInterval(gameTimer);
    }
    if (moleTimer) {
        clearTimeout(moleTimer);
    }
    
    elements.pauseBtn.textContent = '▶️';
    elements.pauseBtn.onclick = resumeGame;
}

// 게임 재개
function resumeGame() {
    if (isGameActive) return;
    
    isGameActive = true;
    startGameTimer();
    spawnMole();
    
    elements.pauseBtn.textContent = '⏸️';
    elements.pauseBtn.onclick = pauseGame;
}

// 게임 결과 저장 (GAS 연동)
async function saveGameResult(result) {
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'saveGame',
                game: {
                    username: gameState.currentUser.username,
                    score: result.score,
                    goldenMolesHit: result.goldenMolesHit,
                    duration: result.duration,
                    timestamp: result.timestamp
                }
            })
        });
        
        // 사용자 코인 정보 업데이트
        gameState.coins = Math.max(0, gameState.coins);
        elements.coinCount.textContent = gameState.coins;
    } catch (error) {
        console.error('게임 결과 저장 오류:', error);
    }
}

// 랭킹 로드 (GAS 연동)
async function loadRanking() {
    try {
        const response = await fetch(`${GAS_URL}?action=getRanking`);
        const users = await response.json();
        gameState.ranking = users;
        updateRankingDisplay();
    } catch (error) {
        console.error('랭킹 로드 오류:', error);
    }
}

// 랭킹 업데이트
async function updateRanking() {
    await loadRanking();
}

// 랭킹 표시 업데이트
function updateRankingDisplay() {
    const rankingList = elements.rankingList;
    rankingList.innerHTML = '';
    
    gameState.ranking.slice(0, 10).forEach((user, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = `ranking-item ${index < 3 ? 'top3' : ''}`;
        
        const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '';
        
        rankingItem.innerHTML = `
            <div class="rank-number">${medal}${index + 1}</div>
            <div class="ranking-info">
                <div class="player-name">${user.username}</div>
                <div class="player-stats">
                    총점: ${user.totalScore || 0}점 | 
                    황금뚝배기: ${user.goldenMolesHit || 0}개 | 
                    게임수: ${user.gamesPlayed || 0}회
                </div>
            </div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
}

// 코인 요청 폴링 시작
function startCoinRequestPolling() {
    if (coinRequestPoller) clearInterval(coinRequestPoller);
    coinRequestPoller = setInterval(checkForPendingCoinRequests, 7000); // 7초 간격
}

// 코인 요청 폴링 중지
function stopCoinRequestPolling() {
    if (coinRequestPoller) {
        clearInterval(coinRequestPoller);
        coinRequestPoller = null;
    }
}

// 대기 중인 코인 요청 확인
async function checkForPendingCoinRequests() {
    if (!gameState.currentUser) return;
    
    try {
        // 받은 요청 확인
        const response = await fetch(`${GAS_URL}?action=getCoinRequests&username=${encodeURIComponent(gameState.currentUser.username)}`);
        const requests = await response.json();
        
        if (requests.length > 0) {
            const request = requests[0];
            const requestKey = `${request.fromUser}-${request.timestamp}`;
            
            if (!processedCoinRequests.has(requestKey)) {
                processedCoinRequests.add(requestKey);
                showCoinRequestNotification(request);
            }
        }
        
        // 내가 요청한 것 중 수락된 것 확인
        const response2 = await fetch(`${GAS_URL}?action=getUserCoinRequests&username=${encodeURIComponent(gameState.currentUser.username)}`);
        const myRequests = await response2.json();
        
        myRequests.forEach(req => {
            const requestKey = `${req.toUser}-${req.timestamp}`;
            if (req.status === 'accepted' && !processedCoinRequests.has(requestKey)) {
                processedCoinRequests.add(requestKey);
                alert(`${req.toUser}님이 코인 요청을 수락했습니다! 각자 5개의 코인을 받았습니다.`);
                // 코인 정보 새로고침
                refreshUserCoins();
            }
        });
    } catch (error) {
        console.error('코인 요청 확인 오류:', error);
    }
}

// 사용자 코인 정보 새로고침
async function refreshUserCoins() {
    try {
        const userData = await authenticateUser(gameState.currentUser.username, gameState.currentUser.password);
        if (userData) {
            gameState.coins = userData.coins;
            elements.coinCount.textContent = gameState.coins;
        }
    } catch (error) {
        console.error('코인 정보 새로고침 오류:', error);
    }
}

// 코인 요청 모달 표시
function showCoinRequestModal() {
    elements.coinRequestModal.classList.add('active');
    elements.requestTargetUser.value = '';
    elements.requestMessage.value = '';
}

// 코인 요청 모달 숨기기
function hideCoinRequestModal() {
    elements.coinRequestModal.classList.remove('active');
}

// 코인 요청 보내기 (GAS 연동)
async function sendCoinRequest() {
    const targetUser = elements.requestTargetUser.value.trim();
    const message = elements.requestMessage.value.trim();
    
    if (!targetUser || !message) {
        alert('받는 사람 이름과 메시지를 입력해주세요.');
        return;
    }
    
    if (targetUser === gameState.currentUser.username) {
        alert('자신에게는 코인을 요청할 수 없습니다.');
        return;
    }
    
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'coinRequest',
                request: {
                    fromUser: gameState.currentUser.username,
                    toUser: targetUser,
                    message: message,
                    status: 'pending',
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        hideCoinRequestModal();
        alert('코인 요청을 보냈습니다.');
    } catch (error) {
        console.error('코인 요청 오류:', error);
        alert('코인 요청 중 오류가 발생했습니다.');
    }
}

// 코인 요청 알림 표시
function showCoinRequestNotification(request) {
    elements.requestFromUser.textContent = request.fromUser;
    elements.requestMessageText.textContent = request.message;
    elements.coinRequestNotificationModal.classList.add('active');
    
    // 요청 처리 후 상태 업데이트를 위한 데이터 저장
    elements.acceptRequestBtn.onclick = () => handleCoinRequestResponse(request, 'accepted');
    elements.rejectRequestBtn.onclick = () => handleCoinRequestResponse(request, 'rejected');
}

// 코인 요청 알림 숨기기
function hideCoinRequestNotificationModal() {
    elements.coinRequestNotificationModal.classList.remove('active');
}

// 코인 요청 응답 처리 (GAS 연동)
async function handleCoinRequestResponse(request, response) {
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'coinRespond',
                requestId: request.row,
                response: response
            })
        });
        
        hideCoinRequestNotificationModal();
        
        if (response === 'accepted') {
            alert('코인 요청을 수락했습니다. 각자 5개의 코인을 받았습니다.');
            // 코인 정보 새로고침
            refreshUserCoins();
        } else {
            alert('코인 요청을 거부했습니다.');
        }
        
        // 랭킹 업데이트
        updateRanking();
    } catch (error) {
        console.error('코인 요청 응답 처리 오류:', error);
        alert('처리 중 오류가 발생했습니다.');
    }
}

// 화면 전환
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    screens[screenName].classList.add('active');
}

// 메뉴로 돌아가기
function backToMenu() {
    if (isGameActive) {
        if (confirm('게임을 종료하시겠습니까?')) {
            endGame();
        } else {
            return;
        }
    }
    
    showScreen('mainMenu');
    updateRankingDisplay();
}

// 로그아웃
function handleLogout() {
    stopCoinRequestPolling();
    gameState = new GameState();
    processedCoinRequests.clear();
    elements.username.value = '';
    elements.password.value = '';
    showScreen('login');
}

// 페이지 로드 시 초기화
window.addEventListener('load', () => {
    // 초기 랭킹 로드
    loadRanking();
}); 