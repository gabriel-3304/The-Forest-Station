const socket = io();
const name = sessionStorage.getItem('playerName');
let timer;
let timeLeft = 120; // 2 minutes
let currentQuestion;
let allPlayers = {};

// Initialize the game
function initializeGame() {
    if (!name) {
        alert('No player name found. Redirecting to login...');
        window.location.href = '/';
        return;
    }

    socket.emit('get_scores');
    getQuestion();
    startTimer();
}

function startTimer() {
    timer = setInterval(() => {
        timeLeft--;
        const percent = (timeLeft / 120) * 100;
        const timerFill = document.getElementById('timer-bar-fill');

        if (timerFill) {
            timerFill.style.width = `${percent}%`;

            if (percent > 50) {
                timerFill.style.backgroundColor = '#81c784'; // Green
            } else if (percent > 25) {
                timerFill.style.backgroundColor = '#ffb74d'; // Orange
            } else {
                timerFill.style.backgroundColor = '#e57373'; // Red
            }
        }

        if (timeLeft <= 0) {
            clearInterval(timer);
            alert("Time's up! Redirecting to results...");
            window.location.href = '/result';
        }
    }, 1000);
}

function getQuestion() {
    socket.emit('get_question');
}

function submitAnswer() {
    const answerInput = document.getElementById('answer');
    const answer = answerInput.value.trim();

    if (!answer) {
        alert('Please enter an answer!');
        return;
    }
    if (!currentQuestion || !currentQuestion.answer) {
        alert('No valid question available!');
        return;
    }

    const correct = answer.toLowerCase() === currentQuestion.answer.toLowerCase();
    const feedbackElement = document.getElementById('answer-feedback');

    if (correct) {
        playSound('correct-sound');
        feedbackElement.innerText = "Correct! ✓";
        feedbackElement.style.color = '#4caf50';
    } else {
        playSound('wrong-sound');
        feedbackElement.innerText = `Wrong! The answer was: ${currentQuestion.answer}`;
        feedbackElement.style.color = '#f44336';
    }

    socket.emit('submit_answer', { name, correct });
    answerInput.disabled = true;
    document.querySelector('#question-box button').disabled = true;

    setTimeout(showOptions, 1500);
}

function showOptions() {
    const options = ["Nothing", "Single Crypto", "Double Crypto", "Hack Player"];
    const shuffled = [...options].sort(() => Math.random() - 0.5).slice(0, 3);

    let html = "<h3>Pick one:</h3>";
    shuffled.forEach(opt => {
        html += `<button class="option-btn" onclick="handleOption('${opt}')">${opt}</button>`;
    });

    document.getElementById('options-box').innerHTML = html;
}

function handleOption(opt) {
    document.getElementById('options-box').innerHTML = "";

    if (opt === "Hack Player") {
        showHackSection();
    } else {
        socket.emit('power_up');
    }
}

function showHackSection() {
    const otherPlayers = Object.keys(allPlayers).filter(player => player !== name);

    if (otherPlayers.length === 0) {
        alert('No other players to hack!');
        getQuestion();
        return;
    }

    let html = "<h3>Who do you want to hack?</h3>";
    otherPlayers.forEach(player => {
        html += `<button class="hack-btn" onclick="guessPassword('${player}')">${player}</button>`;
    });
    html += `<button class="cancel-btn" onclick="cancelHack()">Cancel</button>`;
    document.getElementById('hack-section').innerHTML = html;
}

function guessPassword(target) {
    const guess = prompt(`Guess ${target}'s password:`);
    if (guess && guess.trim()) {
        socket.emit('hack_attempt', { hacker: name, target, guess: guess.trim() });
    }
    document.getElementById('hack-section').innerHTML = "";
}

function cancelHack() {
    document.getElementById('hack-section').innerHTML = "";
    getQuestion();
}

function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {
            console.log(`Sound '${id}' could not be played (possibly autoplay restriction).`);
        });
    }
}

function resetQuestionUI() {
    const answerInput = document.getElementById('answer');
    const submitBtn = document.querySelector('#question-box button');

    answerInput.value = "";
    answerInput.disabled = false;
    submitBtn.disabled = false;

    document.getElementById('answer-feedback').innerText = "";
    document.getElementById('options-box').innerHTML = "";
    document.getElementById('hack-section').innerHTML = "";
}

// Socket event listeners
socket.on('question', q => {
    if (!q || !q.question) {
        console.error('Invalid question received:', q);
        return;
    }
    currentQuestion = q;
    document.getElementById('question').innerText = q.question;
    resetQuestionUI();
});

socket.on('update_score', players => {
    allPlayers = players;
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    let html = "<h2>Scores:</h2>";
    const sortedPlayers = Object.entries(players).sort((a, b) => b[1].score - a[1].score);

    sortedPlayers.forEach(([playerName, data], index) => {
        const isCurrentPlayer = playerName === name;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += `<p ${isCurrentPlayer ? 'style="font-weight: bold; color: #81c784;"' : ''}>
                    ${medal} ${playerName}: ${data.score} points
                 </p>`;
    });
    scoreboard.innerHTML = html;
});

socket.on('power_result', power => {
    let message = "";
    let points = 0;

    if (power === "Double Crypto") {
        points = 2000;
        message = "You got Double Crypto! +2000 points 🎉";
        playSound('correct-sound');
    } else if (power === "Single Crypto") {
        points = 1000;
        message = "You got Single Crypto! +1000 points 💰";
        playSound('correct-sound');
    } else {
        message = "You got Nothing! 😔";
    }

    alert(message);

    if (points > 0 && allPlayers[name]) {
        allPlayers[name].score += points;
        socket.emit('update_score', allPlayers);
    }

    setTimeout(getQuestion, 1000);
});

socket.on('hack_result', data => {
    if (data.success) {
        alert(`Successful hack! 🎯 You stole ${data.stolen} points from ${data.target}`);
        playSound('correct-sound');
    } else {
        alert(`Hack failed! 🛡️ ${data.message || 'Wrong password.'}`);
        playSound('wrong-sound');
    }
    setTimeout(getQuestion, 1000);
});

socket.on('error', data => {
    alert(`Error: ${data.message}`);
});

// Handle Enter key in answer input
document.addEventListener('DOMContentLoaded', () => {
    const answerInput = document.getElementById('answer');
    if (answerInput) {
        answerInput.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !answerInput.disabled) {
                submitAnswer();
            }
        });
    }
});

// Start game on page load
initializeGame();
