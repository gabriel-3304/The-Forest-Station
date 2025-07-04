const socket = io();
const name = sessionStorage.getItem('playerName');
let timer;
let timeLeft = 120; // 2 minutes
let currentQuestion;
let allPlayers = {};
let selectedOption = null;
let currentRound = 1;
let maxRounds = 10;
let battleStats = {};
let questionStartTime = 0;
let isFrozen = false;
let battleCommentary = [];
let visualEffectsActive = false;

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
    if (isFrozen) {
        alert('You are frozen! Wait a moment... ❄️');
        return;
    }
    
    if (selectedOption === null) {
        alert('Please select an answer!');
        return;
    }
    if (!currentQuestion || !currentQuestion.options) {
        alert('No valid question available!');
        return;
    }

    const answerTime = (Date.now() - questionStartTime) / 1000; // Time in seconds
    
    socket.emit('submit_answer', { 
        name, 
        selected_option: selectedOption,
        correct_answer: currentQuestion.correct,
        difficulty: currentQuestion.difficulty || 'easy',
        answer_time: answerTime
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
    const options = [
        "🎯 Power-Up Spin", "💀 Hack Opponent", "⚡ Lightning Round", 
        "🛡️ Defensive Play", "🔥 Aggressive Mode"
    ];
    const shuffled = [...options].sort(() => Math.random() - 0.5).slice(0, 3);

    let html = "<h3>🎮 Choose Your Battle Move:</h3>";
    shuffled.forEach(opt => {
        html += `<button class="battle-btn" onclick="handleOption('${opt}')">${opt}</button>`;
    });

    document.getElementById('options-box').innerHTML = html;
}

function handleOption(opt) {
    document.getElementById('options-box').innerHTML = "";

    if (opt.includes("Hack")) {
        showHackSection();
    } else if (opt.includes("Lightning")) {
        // Skip to next question quickly
        getQuestion();
    } else {
        socket.emit('power_up', {name});
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

function generateHealthBar(lives, maxLives) {
    const hearts = [];
    for (let i = 0; i < maxLives; i++) {
        if (i < lives) {
            hearts.push('❤️');
        } else {
            hearts.push('🤍');
        }
    }
    return `<div style="font-size: 1.2em; margin-top: 5px;">${hearts.join('')}</div>`;
}

function showSpeedBonusEffect() {
    const body = document.body;
    body.style.animation = 'speedBonus 0.5s ease-in-out';
    setTimeout(() => {
        body.style.animation = '';
    }, 500);
}

function showScreenShake() {
    const body = document.body;
    body.style.animation = 'screenShake 0.5s ease-in-out';
    setTimeout(() => {
        body.style.animation = '';
    }, 500);
}

function showVisualDamage(playerName, damageType) {
    const scoreboard = document.getElementById('scoreboard');
    if (scoreboard) {
        scoreboard.style.animation = 'damageFlash 0.3s ease-in-out';
        setTimeout(() => {
            scoreboard.style.animation = '';
        }, 300);
    }
    
    if (damageType === 'critical') {
        showScreenShake();
        playSound('wrong-sound');
    }
}

function showPowerUpEffect(effectType) {
    const questionBox = document.getElementById('question-box');
    if (!questionBox) return;
    
    switch (effectType) {
        case 'shield':
            questionBox.style.boxShadow = '0 0 20px #2196f3';
            setTimeout(() => {
                questionBox.style.boxShadow = '0 0 15px #4caf50';
            }, 1000);
            break;
        case 'double_points':
            questionBox.style.animation = 'sparkle 1s ease-in-out';
            setTimeout(() => {
                questionBox.style.animation = '';
            }, 1000);
            break;
        case 'extra_life':
            questionBox.style.animation = 'heartBurst 0.8s ease-in-out';
            setTimeout(() => {
                questionBox.style.animation = '';
            }, 800);
            break;
    }
}

function showBattleCommentary(message, type = 'normal') {
    const commentaryDiv = document.getElementById('battle-commentary');
    if (!commentaryDiv) return;
    
    const commentaryElement = document.createElement('div');
    commentaryElement.className = `commentary-message ${type}`;
    commentaryElement.textContent = message;
    commentaryElement.style.cssText = `
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
        padding: 8px 15px;
        border-radius: 15px;
        margin: 5px 0;
        font-size: 0.9em;
        font-weight: bold;
        text-align: center;
        animation: commentarySlide 0.5s ease-out;
        border-left: 3px solid #ffc107;
    `;
    
    if (type === 'critical') {
        commentaryElement.style.background = 'rgba(244, 67, 54, 0.3)';
        commentaryElement.style.color = '#f44336';
        commentaryElement.style.borderLeftColor = '#f44336';
        commentaryElement.style.animation = 'criticalCommentary 0.8s ease-out';
    }
    
    commentaryDiv.appendChild(commentaryElement);
    
    // Remove old commentary
    const messages = commentaryDiv.querySelectorAll('.commentary-message');
    if (messages.length > 3) {
        commentaryDiv.removeChild(messages[0]);
    }
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (commentaryElement.parentNode) {
            commentaryElement.style.animation = 'commentaryFadeOut 0.5s ease-in';
            setTimeout(() => {
                if (commentaryElement.parentNode) {
                    commentaryDiv.removeChild(commentaryElement);
                }
            }, 500);
        }
    }, 4000);
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
    questionStartTime = Date.now(); // Track when question was shown
    
    let questionText = q.question;
    if (q.speed_bonus) {
        questionText = `⚡ SPEED BONUS: ${questionText}`;
        playSound('correct-sound'); // Alert sound for speed bonus
        showSpeedBonusEffect();
    }
    
    // Animated question reveal
    const questionElement = document.getElementById('question');
    questionElement.style.opacity = '0';
    questionElement.style.transform = 'translateY(20px)';
    
    questionElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <span style="font-size: 0.9em; color: #81c784;">Round ${currentRound}/${maxRounds}</span>
            <span style="font-size: 0.8em; color: #ffb74d;">${q.difficulty?.toUpperCase() || 'EASY'}</span>
        </div>
        <div class="question-text">${questionText}</div>
    `;
    
    // Animate question in
    setTimeout(() => {
        questionElement.style.transition = 'all 0.5s ease';
        questionElement.style.opacity = '1';
        questionElement.style.transform = 'translateY(0)';
    }, 100);
    
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
        
        let html = "<h2>⚔️ Battle Royale ⚔️</h2>";
        
        // Player 1 (Leader) with avatar and health bar
        html += `<div class="player-card ${leader[0] === name ? 'current-player' : ''}">`;
        html += `<div style="display: flex; align-items: center; margin-bottom: 10px;">`;
        html += `<span style="font-size: 2em; margin-right: 10px;">${leader[1].avatar || '🐻'}</span>`;
        html += `<div style="flex: 1;">`;
        html += `<div style="font-weight: bold; color: ${leader[0] === name ? '#81c784' : '#ffb74d'};">`;
        html += `${leader[0] === name ? '🔥 YOU' : leader[0]}: ${leader[1].score}`;
        html += `</div>`;
        html += generateHealthBar(leader[1].lives, leader[1].max_lives || 3);
        html += `</div></div></div>`;
        
        html += `<div style="text-align: center; margin: 15px 0; font-size: 1.2em; color: #fff;">VS</div>`;
        
        // Player 2 (Opponent) with avatar and health bar
        html += `<div class="player-card ${opponent[0] === name ? 'current-player' : ''}">`;
        html += `<div style="display: flex; align-items: center; margin-bottom: 10px;">`;
        html += `<span style="font-size: 2em; margin-right: 10px;">${opponent[1].avatar || '🦝'}</span>`;
        html += `<div style="flex: 1;">`;
        html += `<div style="font-weight: bold; color: ${opponent[0] === name ? '#81c784' : '#ffb74d'};">`;
        html += `${opponent[0] === name ? '🔥 YOU' : opponent[0]}: ${opponent[1].score}`;
        html += `</div>`;
        html += generateHealthBar(opponent[1].lives, opponent[1].max_lives || 3);
        html += `</div></div></div>`;
        
        if (leadDifference > 0) {
            html += `<div style="color: #4caf50; font-size: 0.9em; margin-top: 15px;">📈 ${leader[0]} leads by ${leadDifference} points!</div>`;
        } else {
            html += `<div style="color: #ffd700; font-size: 0.9em; margin-top: 15px;">🔥 DEAD HEAT!</div>`;
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
        feedbackElement.innerHTML = "Correct! ✓";
        feedbackElement.style.color = '#4caf50';
        
        // Add streak effect
        if (data.streak >= 3) {
            feedbackElement.innerHTML += ` <span style="color: #ffc107;">🔥 ${data.streak} STREAK!</span>`;
        }
        
        // Speed bonus effect
        if (data.visual_effects && data.visual_effects.speed_bonus) {
            feedbackElement.innerHTML += ` <span style="color: #e91e63;">⚡ SPEED BONUS!</span>`;
            showSpeedBonusEffect();
        }
    } else {
        playSound('wrong-sound');
        feedbackElement.innerHTML = `Wrong! The correct answer was: ${correctAnswerText}`;
        feedbackElement.style.color = '#f44336';
        
        // Show damage effect
        showVisualDamage(name, 'normal');
    }
    
    // Highlight correct answer with animation
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach((btn, index) => {
        if (index === data.correct_answer) {
            btn.classList.add('correct');
            btn.style.animation = 'correctPulse 0.5s ease-in-out';
        } else if (index === data.selected && !data.correct) {
            btn.classList.add('wrong');
            btn.style.animation = 'wrongShake 0.5s ease-in-out';
        }
    });

    setTimeout(showOptions, 2000);
});

socket.on('power_result', data => {
    const power = data.power;
    const effects = data.visual_effects || {};
    
    let message = `You got ${power}! `;
    
    switch (power) {
        case "Shield Potion":
            message += "🛡️ Protected from next attack!";
            showPowerUpEffect('shield');
            break;
        case "Double Points":
            message += "✨ Next answers worth 2x points!";
            showPowerUpEffect('double_points');
            break;
        case "Extra Life":
            message += "❤️ Gained a life!";
            showPowerUpEffect('extra_life');
            break;
        case "Steal Points":
            message += "🔮 Ready to steal!";
            break;
        case "Nothing":
            message = "You got Nothing! 😔";
            break;
        default:
            message += "⚡ Special power activated!";
    }
    
    // Show power-up announcement
    showBattleCommentary(message, 'normal');
    
    if (power !== "Nothing") {
        playSound('correct-sound');
    }

    setTimeout(getQuestion, 1000);
});

socket.on('hack_result', data => {
    if (data.success) {
        if (data.critical) {
            showScreenShake();
            showBattleCommentary(`💀 CRITICAL HACK! Stole ${data.stolen} points + life!`, 'critical');
            playSound('wrong-sound'); // Dramatic sound for critical hit
        } else {
            showBattleCommentary(`🎯 Successful hack! Stole ${data.stolen} points!`, 'normal');
            playSound('correct-sound');
        }
        
        // Show hack visual effects
        if (data.visual_effects) {
            const effects = data.visual_effects;
            if (effects.screen_shake) showScreenShake();
            if (effects.red_flash) {
                document.body.style.animation = 'redFlash 0.3s ease-in-out';
                setTimeout(() => { document.body.style.animation = ''; }, 300);
            }
        }
    } else {
        showBattleCommentary(`🛡️ Hack failed! ${data.message || 'Wrong password.'}`, 'normal');
        playSound('wrong-sound');
    }
    setTimeout(getQuestion, 1000);
});

socket.on('round_update', data => {
    currentRound = data.round;
    maxRounds = data.max_rounds;
    console.log(`Round ${currentRound}/${maxRounds}`);
});

socket.on('battle_stats', stats => {
    battleStats = stats;
    updateBattleStats();
});

socket.on('freeze_player', data => {
    if (data.frozen_player === name) {
        isFrozen = true;
        alert(`You've been frozen for ${data.duration} seconds! ❄️`);
        
        setTimeout(() => {
            isFrozen = false;
            alert('You can move again! 🔥');
        }, data.duration * 1000);
    } else {
        alert(`${data.frozen_player} has been frozen! 😈`);
    }
});

socket.on('question_skip', data => {
    if (data.player !== name) {
        showBattleCommentary(`${data.player} used Question Skip! ⚡`);
    }
    setTimeout(getQuestion, 1000);
});

socket.on('battle_commentary', data => {
    showBattleCommentary(data.message, data.type || 'normal');
});

socket.on('visual_damage', data => {
    if (data.player === name) {
        showVisualDamage(data.player, data.damage_type);
    }
});

function updateBattleStats() {
    const statsContainer = document.getElementById('battle-stats');
    if (!statsContainer || !battleStats[name]) return;
    
    const stats = battleStats[name];
    const accuracy = stats.correct + stats.wrong > 0 ? 
        Math.round((stats.correct / (stats.correct + stats.wrong)) * 100) : 0;
    
    statsContainer.innerHTML = `
        <div style="background: rgba(20, 40, 20, 0.9); padding: 15px; border-radius: 8px; margin: 10px 0;">
            <h4 style="color: #81c784; margin: 0 0 10px 0;">📊 Your Battle Stats</h4>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
                <span>Accuracy: ${accuracy}%</span>
                <span>Hacks: ${stats.hacks_successful}/${stats.hacks_successful + stats.hacks_failed}</span>
            </div>
        </div>
    `;
}

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
