// Google Apps Script 백엔드 코드
// 이 코드를 Google Apps Script에 복사하여 배포하세요.

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let response = {};
    
    switch(action) {
      case 'login':
        response = handleLogin(data);
        break;
      case 'saveGameResult':
        response = handleSaveGameResult(data);
        break;
      case 'sendCoinRequest':
        response = handleSendCoinRequest(data);
        break;
      case 'checkCoinRequests':
        response = handleCheckCoinRequests(data);
        break;
      case 'acceptCoinRequest':
        response = handleAcceptCoinRequest(data);
        break;
      case 'rejectCoinRequest':
        response = handleRejectCoinRequest(data);
        break;
      case 'getRankings':
        response = handleGetRankings();
        break;
      default:
        response = { success: false, message: 'Unknown action' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: 'Server error' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleLogin(data) {
  const username = data.username;
  const password = data.password;
  
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('userdata');
  if (!userSheet) {
    return { success: false, message: 'User data sheet not found' };
  }
  
  const userData = userSheet.getDataRange().getValues();
  const userRow = userData.findIndex(row => row[0] === username);
  
  if (userRow === -1) {
    // 새 사용자 생성
    const newUser = [username, password, 5, 0, 0, 0, new Date()]; // username, password, coins, totalScore, totalGames, goldenPunches, created
    userSheet.appendRow(newUser);
    
    return {
      success: true,
      coins: 5,
      totalScore: 0,
      totalGames: 0,
      goldenPunches: 0
    };
  } else {
    // 기존 사용자 확인
    const user = userData[userRow];
    if (user[1] !== password) {
      return { success: false, message: '비밀번호가 일치하지 않습니다.' };
    }
    
    return {
      success: true,
      coins: user[2] || 5,
      totalScore: user[3] || 0,
      totalGames: user[4] || 0,
      goldenPunches: user[5] || 0
    };
  }
}

function handleSaveGameResult(data) {
  const username = data.username;
  const score = data.score;
  const goldenPunches = data.goldenPunches;
  const timeLeft = data.timeLeft;
  
  // 게임 기록 저장
  const gameSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('gamehistory');
  if (gameSheet) {
    const gameRecord = [username, score, goldenPunches, timeLeft, new Date()];
    gameSheet.appendRow(gameRecord);
  }
  
  // 사용자 통계 업데이트
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('userdata');
  if (userSheet) {
    const userData = userSheet.getDataRange().getValues();
    const userRow = userData.findIndex(row => row[0] === username);
    
    if (userRow !== -1) {
      const user = userData[userRow];
      const newTotalScore = (user[3] || 0) + score;
      const newTotalGames = (user[4] || 0) + 1;
      const newGoldenPunches = (user[5] || 0) + goldenPunches;
      const newCoins = (user[2] || 5) + goldenPunches; // 황금뚝배기당 1코인 추가
      
      userSheet.getRange(userRow + 1, 3, 1, 4).setValues([[newCoins, newTotalScore, newTotalGames, newGoldenPunches]]);
      
      return {
        success: true,
        coins: newCoins,
        totalScore: newTotalScore,
        totalGames: newTotalGames,
        goldenPunches: newGoldenPunches
      };
    }
  }
  
  return { success: false, message: 'User not found' };
}

function handleSendCoinRequest(data) {
  const fromUser = data.fromUser;
  const toUser = data.toUser;
  const message = data.message;
  
  // 받는 사용자가 존재하는지 확인
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('userdata');
  if (userSheet) {
    const userData = userSheet.getDataRange().getValues();
    const toUserRow = userData.findIndex(row => row[0] === toUser);
    
    if (toUserRow === -1) {
      return { success: false, message: '받는 사용자를 찾을 수 없습니다.' };
    }
  }
  
  // 코인 요청 저장
  const coinSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('coin');
  if (coinSheet) {
    const requestId = Utilities.getUuid();
    const requestRecord = [requestId, fromUser, toUser, message, 'pending', new Date()];
    coinSheet.appendRow(requestRecord);
    
    return { success: true, message: '코인 요청이 전송되었습니다.' };
  }
  
  return { success: false, message: 'Coin sheet not found' };
}

function handleCheckCoinRequests(data) {
  const username = data.username;
  
  const coinSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('coin');
  if (!coinSheet) {
    return { success: false, message: 'Coin sheet not found' };
  }
  
  const coinData = coinSheet.getDataRange().getValues();
  const pendingRequests = coinData.filter(row => 
    row[2] === username && row[4] === 'pending'
  ).map(row => ({
    id: row[0],
    fromUser: row[1],
    toUser: row[2],
    message: row[3],
    status: row[4],
    timestamp: row[5]
  }));
  
  return {
    success: true,
    requests: pendingRequests
  };
}

function handleAcceptCoinRequest(data) {
  const requestId = data.requestId;
  const username = data.username;
  
  const coinSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('coin');
  if (!coinSheet) {
    return { success: false, message: 'Coin sheet not found' };
  }
  
  const coinData = coinSheet.getDataRange().getValues();
  const requestRow = coinData.findIndex(row => row[0] === requestId);
  
  if (requestRow === -1) {
    return { success: false, message: 'Request not found' };
  }
  
  const request = coinData[requestRow];
  if (request[2] !== username) {
    return { success: false, message: 'Unauthorized' };
  }
  
  // 요청 상태 업데이트
  coinSheet.getRange(requestRow + 1, 5).setValue('accepted');
  
  // 양쪽 사용자에게 코인 지급
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('userdata');
  if (userSheet) {
    const userData = userSheet.getDataRange().getValues();
    
    // 요청한 사용자에게 코인 지급
    const fromUserRow = userData.findIndex(row => row[0] === request[1]);
    if (fromUserRow !== -1) {
      const fromUserCoins = (userData[fromUserRow][2] || 0) + 5;
      userSheet.getRange(fromUserRow + 1, 3).setValue(fromUserCoins);
    }
    
    // 요청 받은 사용자에게 코인 지급
    const toUserRow = userData.findIndex(row => row[0] === request[2]);
    if (toUserRow !== -1) {
      const toUserCoins = (userData[toUserRow][2] || 0) + 5;
      userSheet.getRange(toUserRow + 1, 3).setValue(toUserCoins);
      
      return {
        success: true,
        coins: toUserCoins,
        message: '코인 요청이 수락되었습니다.'
      };
    }
  }
  
  return { success: false, message: 'Failed to update coins' };
}

function handleRejectCoinRequest(data) {
  const requestId = data.requestId;
  
  const coinSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('coin');
  if (!coinSheet) {
    return { success: false, message: 'Coin sheet not found' };
  }
  
  const coinData = coinSheet.getDataRange().getValues();
  const requestRow = coinData.findIndex(row => row[0] === requestId);
  
  if (requestRow === -1) {
    return { success: false, message: 'Request not found' };
  }
  
  // 요청 상태 업데이트
  coinSheet.getRange(requestRow + 1, 5).setValue('rejected');
  
  return { success: true, message: '코인 요청이 거부되었습니다.' };
}

function handleGetRankings() {
  const userSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('userdata');
  if (!userSheet) {
    return { success: false, message: 'User data sheet not found' };
  }
  
  const userData = userSheet.getDataRange().getValues();
  const rankings = userData
    .filter(row => row[0] && row[0] !== 'username') // 헤더 제외
    .map(row => ({
      username: row[0],
      coins: row[2] || 0,
      totalScore: row[3] || 0,
      totalGames: row[4] || 0,
      goldenPunches: row[5] || 0
    }))
    .sort((a, b) => b.totalScore - a.totalScore) // 점수순 정렬
    .slice(0, 10); // 상위 10명만
  
  return {
    success: true,
    rankings: rankings
  };
}

// 스프레드시트 초기 설정 함수 (한 번만 실행)
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // userdata 시트 생성
  let userSheet = ss.getSheetByName('userdata');
  if (!userSheet) {
    userSheet = ss.insertSheet('userdata');
    userSheet.getRange(1, 1, 1, 7).setValues([['username', 'password', 'coins', 'totalScore', 'totalGames', 'goldenPunches', 'created']]);
  }
  
  // gamehistory 시트 생성
  let gameSheet = ss.getSheetByName('gamehistory');
  if (!gameSheet) {
    gameSheet = ss.insertSheet('gamehistory');
    gameSheet.getRange(1, 1, 1, 5).setValues([['username', 'score', 'goldenPunches', 'timeLeft', 'timestamp']]);
  }
  
  // coin 시트 생성
  let coinSheet = ss.getSheetByName('coin');
  if (!coinSheet) {
    coinSheet = ss.insertSheet('coin');
    coinSheet.getRange(1, 1, 1, 6).setValues([['requestId', 'fromUser', 'toUser', 'message', 'status', 'timestamp']]);
  }
  
  console.log('Spreadsheet setup completed');
} 