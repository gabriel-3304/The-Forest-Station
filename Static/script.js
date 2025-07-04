const socket = io();
const name = sessionStorage.getItem('playerName');
let timer;
let timeLeft = 120; // 2 minutes
let currentQuestion;
let allPlayers = {};
let selectedOption = null;

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
    if (selectedOption === null) {
        alert('Please select an answer!');
        return;
    }
    if (!currentQuestion || !currentQuestion.options) {
        alert('No valid question available!');
        return;
    }

    socket.emit('submit_answer', { 
        name, 
        selected_option: selectedOption,
        correct_answer: currentQuestion.correct
    });
    
    document.getElementById('submit-btn').disabled = true;
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => btn.disabled = true);
}

function selectOption(index) {
    selectedOption = index;
    const optionButtons = document.querySelectorAll('.option-btn');
    
    optionButtons.forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    document.getElementById('submit-btn').disabled = false;
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
        alert('No opponent to hack!');
        getQuestion();
        return;
    }

    const opponent = otherPlayers[0]; // In 1v1, there's only one opponent
    let html = `<h3>💀 Hack ${opponent}? 💀</h3>`;
    html += `<button class="hack-btn" onclick="guessPassword('${opponent}')">Steal Points from ${opponent}</button>`;
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
    selectedOption = null;
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;

    document.getElementById('answer-feedback').innerText = "";
    document.getElementById('options-box').innerHTML = "";
    document.getElementById('hack-section').innerHTML = "";
}

// Socket event listeners
socket.on('question', q => {
    if (!q || !q.question || !q.options) {
        console.error('Invalid question received:', q);
        return;
    }
    currentQuestion = q;
    document.getElementById('question').innerText = q.question;
    
    // Create option buttons
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'option-btn';
        button.textContent = option;
        button.onclick = () => selectOption(index);
        optionsContainer.appendChild(button);
    });
    
    resetQuestionUI();
});

socket.on('update_score', players => {
    allPlayers = players;
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    const sortedPlayers = Object.entries(players).sort((a, b) => b[1].score - a[1].score);
    
    if (sortedPlayers.length === 2) {
        const [leader, opponent] = sortedPlayers;
        const leadDifference = leader[1].score - opponent[1].score;
        
        let html = "<h2>⚔️ Battle Status ⚔️</h2>";
        html += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
        html += `<p style="${leader[0] === name ? 'font-weight: bold; color: #81c784;' : 'color: #ffb74d;'}">
                    ${leader[0] === name ? '🔥 YOU' : leader[0]}: ${leader[1].score}
                 </p>`;
        html += `<p style="color: #fff; font-size: 0.9em;">VS</p>`;
        html += `<p style="${opponent[0] === name ? 'font-weight: bold; color: #81c784;' : 'color: #ffb74d;'}">
                    ${opponent[0] === name ? '🔥 YOU' : opponent[0]}: ${opponent[1].score}
                 </p>`;
        html += `</div>`;
        
        if (leadDifference > 0) {
            html += `<p style="color: #4caf50; font-size: 0.8em;">📈 ${leader[0]} leads by ${leadDifference} points!</p>`;
        } else {
            html += `<p style="color: #ffd700; font-size: 0.8em;">🔥 It's a tie!</p>`;
        }
        
        scoreboard.innerHTML = html;
    } else {
        let html = "<h2>Waiting for opponent...</h2>";
        sortedPlayers.forEach(([playerName, data]) => {
            const isCurrentPlayer = playerName === name;
            html += `<p ${isCurrentPlayer ? 'style="font-weight: bold; color: #81c784;"' : ''}>
                        ${playerName}: ${data.score} points
                     </p>`;
        });
        scoreboard.innerHTML = html;
    }
});

socket.on('answer_result', data => {
    const feedbackElement = document.getElementById('answer-feedback');
    const correctAnswerText = currentQuestion.options[data.correct_answer];
    
    if (data.correct) {
        playSound('correct-sound');
        feedbackElement.innerText = "Correct! ✓";
        feedbackElement.style.color = '#4caf50';
    } else {
        playSound('wrong-sound');
        feedbackElement.innerText = `Wrong! The correct answer was: ${correctAnswerText}`;
        feedbackElement.style.color = '#f44336';
    }
    
    // Highlight correct answer
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, index) => {
        if (index === data.correct_answer) {
            btn.classList.add('correct');
        } else if (index === data.selected && !data.correct) {
            btn.classList.add('wrong');
        }
    });

    setTimeout(showOptions, 2000);
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
