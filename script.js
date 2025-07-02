const socket = io();

let playerName = "";
let currentQuestion = null;
let timerInterval = null;
let timeLeft = 120; // 2 minutes
let canSpinAgain = false;
let hasDrawn = false;

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === "/quiz") {
    // On quiz page: start the timer and get questions
    startTimer();
    requestQuestion();
  }

  if (window.location.pathname === "/result") {
    // On result page: display final scores and setup lucky draw
    setupLuckyDraw();
  }
});

function startTimer() {
  updateTimerBar();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerBar();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      socket.emit('check_timer');
    }
  }, 1000);
}

function updateTimerBar() {
  let bar = document.getElementById("timer-bar");
  if (!bar.querySelector("#timer-bar-fill")) {
    let fill = document.createElement("div");
    fill.id = "timer-bar-fill";
    bar.appendChild(fill);
  }
  let fill = document.getElementById("timer-bar-fill");
  fill.style.width = ((timeLeft / 120) * 100) + "%";
}

function requestQuestion() {
  socket.emit('get_question');
}

socket.on('question', (q) => {
  currentQuestion = q;
  showQuestion(q);
});

function showQuestion(q) {
  document.getElementById('question-box').innerText = q.q;
  document.getElementById('answer-feedback').innerText = "";
  document.getElementById('options-box').innerHTML = "";

  // For simplicity, show two buttons: Correct or Wrong (simulate answer)
  let correctBtn = document.createElement("button");
  correctBtn.innerText = "Answer Correct";
  correctBtn.onclick = () => submitAnswer(true);
  document.getElementById('options-box').appendChild(correctBtn);

  let wrongBtn = document.createElement("button");
  wrongBtn.innerText = "Answer Wrong";
  wrongBtn.onclick = () => submitAnswer(false);
  document.getElementById('options-box').appendChild(wrongBtn);
}

function submitAnswer(isCorrect) {
  socket.emit('submit_answer', {name: playerName, correct: isCorrect});
}

socket.on('options', (opts) => {
  document.getElementById('options-box').innerHTML = "";
  opts.forEach(opt => {
    let btn = document.createElement("button");
    btn.innerText = opt;
    btn.onclick = () => pickOption(opt);
    document.getElementById('options-box').appendChild(btn);
  });
});

function pickOption(opt) {
  socket.emit('pick_option', {name: playerName, option: opt});
}

socket.on('update_score', (scores) => {
  let sb = document.getElementById('scoreboard');
  sb.innerHTML = "<h3>Scores</h3>";
  for (const [name, score] of Object.entries(scores)) {
    sb.innerHTML += `<div>${name}: ${score}</div>`;
  }
});

socket.on('hack_prompt', (data) => {
  document.getElementById('hack-section').style.display = 'block';
  document.getElementById('hack-guess').value = '';
  document.getElementById('hack-status').innerText = '';
});

function attemptHack() {
  const guess = document.getElementById('hack-guess').value.trim();
  if (guess === '') return;
  socket.emit('attempt_hack', {attacker: playerName, guess});
}

socket.on('hack_result', (data) => {
  if (data.attacker !== playerName) return;
  if (data.success) {
    alert("Hack successful! You stole points!");
  } else {
    alert("Hack failed!");
  }
  document.getElementById('hack-section').style.display = 'none';
});

socket.on('end_game', (scores) => {
  clearInterval(timerInterval);
  localStorage.setItem('finalScores', JSON.stringify(scores));
  window.location.href = "/result";
});

// On result page:

function setupLuckyDraw() {
  const scores = JSON.parse(localStorage.getItem('finalScores'));
  let finalDiv = document.getElementById('final-scores');
  finalDiv.innerHTML = "<h3>Final Scores</h3>";
  for (const [name, score] of Object.entries(scores)) {
    finalDiv.innerHTML += `<div>${name}: ${score}</div>`;
  }

  playerName = prompt("Enter your player name to do the lucky draw:");

  document.getElementById('spin-btn').onclick = () => {
    if (hasDrawn && !canSpinAgain) {
      alert("You cannot spin again unless you got 'Draw Again' prize!");
      return;
    }
    socket.emit('lucky_draw', {name: playerName});
  };

  document.getElementById('continue-btn').onclick = () => {
    socket.emit('reset_game');
    window.location.href = "/";
  };
}

socket.on('draw_result', (data) => {
  const p = document.getElementById('draw-result');
  p.innerText = `You got: ${data.prize}`;
  if (data.prize === 'Draw Again') {
    canSpinAgain = true;
    hasDrawn = false;
  } else if (data.prize === 'Already Drawn') {
    alert("You have already drawn and can't draw again!");
  } else {
    canSpinAgain = false;
    hasDrawn = true;
    document.getElementById('spin-btn').style.display = 'none';
    document.getElementById('continue-btn').style.display = 'inline-block';
  }
});

socket.on('game_reset', () => {
  canSpinAgain = false;
  hasDrawn = false;
});
