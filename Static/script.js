const socket = io();
const name = sessionStorage.getItem('playerName');
let timer;
let timeLeft = 120; // 2 minutes

function startTimer() {
    timer = setInterval(() => {
        timeLeft--;
        const percent = (timeLeft / 120) * 100;
        document.getElementById('timer-bar-fill').style.width = percent + "%";
        if (timeLeft <= 0) {
            clearInterval(timer);
            window.location.href = '/result';
        }
    }, 1000);
}

function getQuestion() {
    socket.emit('get_question');
}

function submitAnswer() {
    const answer = document.getElementById('answer').value.trim();
    const correctAnswer = currentQuestion.answer;
    const correct = answer.toLowerCase() === correctAnswer.toLowerCase();

    if (correct) {
        playSound('correct-sound');
        document.getElementById('answer-feedback').innerText = "Correct!";
    } else {
        playSound('wrong-sound');
        document.getElementById('answer-feedback').innerText = `Wrong! The answer was: ${correctAnswer}`;
    }

    socket.emit('submit_answer', { name, correct });
    showOptions();
}

function showOptions() {
    const options = ["Nothing", "Single Crypto", "Double Crypto", "Hack Player"];
    const shuffled = options.sort(() => 0.5 - Math.random()).slice(0, 3);

    let html = "<h3>Pick one:</h3>";
    shuffled.forEach(opt => {
        html += `<button onclick="handleOption('${opt}')">${opt}</button>`;
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
    let html = "<h3>Who do you want to hack?</h3>";
    for (const player in allPlayers) {
        if (player !== name) {
            html += `<button onclick="guessPassword('${player}')">${player}</button>`;
        }
    }
    document.getElementById('hack-section').innerHTML = html;
}

function guessPassword(target) {
    const guess = prompt(`Guess ${target}'s password:`);
    if (guess) {
        socket.emit('hack_attempt', { hacker: name, target, guess });
    }
    document.getElementById('hack-section').innerHTML = "";
}

function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;  // rewind so it can play repeatedly
        sound.play();
    }
}

let currentQuestion;
let allPlayers = {};

socket.emit('get_scores');
getQuestion();
startTimer();

socket.on('question', q => {
    currentQuestion = q;
    document.getElementById('question').innerText = q.question;
    document.getElementById('answer').value = "";
    document.getElementById('answer-feedback').innerText = "";
    document.getElementById('options-box').innerHTML = "";
    document.getElementById('hack-section').innerHTML = "";

    // Optional: If your questions have images, show them here
    // if(q.image){
    //     document.getElementById('question-image').src = q.image;
    //     document.getElementById('question-image').style.display = 'block';
    // } else {
    //     document.getElementById('question-image').style.display = 'none';
    // }
});

socket.on('update_score', players => {
    allPlayers = players;
    let html = "<h2>Scores:</h2>";
    for (const [p, data] of Object.entries(players)) {
        html += `<p>${p}: ${data.score} points</p>`;
    }
    document.getElementById('scoreboard').innerHTML = html;
});

socket.on('power_result', power => {
    if (power === "Double Crypto") {
        allPlayers[name].score += 2000;
        alert("You got Double Crypto! +2000 points");
    } else if (power === "Single Crypto") {
        allPlayers[name].score += 1000;
        alert("You got Single Crypto! +1000 points");
    } else {
        alert("You got Nothing!");
    }
    socket.emit('update_score', allPlayers);
    getQuestion();
});

socket.on('hack_result', data => {
    if (data.success) {
        alert(`Successful hack! You stole ${data.stolen} points from ${data.target}`);
        playSound('correct-sound'); // play success sound for hack
    } else {
        alert("Hack failed! Wrong password.");
        playSound('wrong-sound');  // play fail sound for hack
    }
    getQuestion();
});
