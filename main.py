import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__, static_folder='Static', static_url_path='/Static')
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global game state
players = {}
questions = [
    {
        "question": "What happens when too many trees are cut down?",
        "options": ["Deforestation", "Reforestation", "Afforestation", "Conservation"],
        "correct": 0
    },
    {
        "question": "Trees help clean the...?",
        "options": ["Water", "Air", "Soil", "Ocean"],
        "correct": 1
    },
    {
        "question": "What do forests provide homes for?",
        "options": ["Rocks", "Cars", "Animals", "Buildings"],
        "correct": 2
    },
    {
        "question": "What do trees produce that we breathe?",
        "options": ["Carbon Dioxide", "Oxygen", "Nitrogen", "Methane"],
        "correct": 1
    },
    {
        "question": "Cutting down forests is called...?",
        "options": ["Deforestation", "Planting", "Growing", "Watering"],
        "correct": 0
    },
    {
        "question": "What grows in forests?",
        "options": ["Cars", "Trees", "Houses", "Roads"],
        "correct": 1
    },
    {
        "question": "What gas do trees absorb from the atmosphere?",
        "options": ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"],
        "correct": 2
    },
    {
        "question": "What is the main cause of Amazon rainforest destruction?",
        "options": ["Tourism", "Agriculture", "Mining", "Pollution"],
        "correct": 1
    },
    {
        "question": "Trees prevent soil from washing away, this is called preventing...?",
        "options": ["Erosion", "Growth", "Pollution", "Tourism"],
        "correct": 0
    },
    {
        "question": "What climate change effect is worsened by deforestation?",
        "options": ["Snow", "Rain", "Global Warming", "Wind"],
        "correct": 2
    }
]

prizes = ["Keychain", "Pencil", "Reusable Cutlery", "Nothing", "Draw Again"]
prize_probs = [25, 25, 25, 20, 5]

game_started = False
drawn_players = set()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/quiz')
def quiz():
    return render_template('quiz.html')

@app.route('/result')
def result():
    return render_template('result.html')

@socketio.on('connect')
def handle_connect():
    print(f"[CONNECTION] Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[DISCONNECTION] Client disconnected: {request.sid}")

@socketio.on('join')
def handle_join(data):
    global game_started
    name = data.get('name', '').strip()
    password = data.get('password', '').strip()

    if not name or not password:
        emit('error', {'message': 'Name and password are required!'})
        return

    if name in players:
        emit('error', {'message': f'Player name "{name}" is already taken!'})
        return

    players[name] = {"score": 0, "password": password}
    print(f"[JOIN] Player '{name}' joined. Total players: {len(players)}")

    emit('players_update', list(players.keys()), broadcast=True)

    if len(players) >= 2 and not game_started:
        game_started = True
        print("[GAME] Starting game with sufficient players.")
        emit('start_game', broadcast=True)

@socketio.on('get_question')
def handle_question():
    if questions:
        q = random.choice(questions)
        emit('question', q)
    else:
        emit('error', {'message': 'No questions available'})

@socketio.on('submit_answer')
def handle_answer(data):
    name = data.get('name')
    selected_option = data.get('selected_option')
    correct_answer = data.get('correct_answer')

    if name and name in players:
        correct = selected_option == correct_answer
        if correct:
            players[name]['score'] += 1000
            print(f"[SCORE] {name} scored 1000 points. Total: {players[name]['score']}")
        
        emit('answer_result', {
            'correct': correct,
            'selected': selected_option,
            'correct_answer': correct_answer
        })

    emit('update_score', players, broadcast=True)

@socketio.on('power_up')
def handle_power_up(data):
    power = random.choices(["Nothing", "Single Crypto", "Double Crypto"], weights=[50, 30, 20])[0]
    print(f"[POWER-UP] Power-up awarded: {power}")
    emit('power_result', power)

@socketio.on('hack_attempt')
def handle_hack(data):
    hacker = data.get('hacker')
    target = data.get('target')
    guess = data.get('guess')

    if not all([hacker, target, guess]):
        emit('hack_result', {"success": False, "message": "Incomplete hack attempt data."})
        return

    if target not in players or hacker not in players:
        emit('hack_result', {"success": False, "message": "Invalid player names."})
        return

    if hacker == target:
        emit('hack_result', {"success": False, "message": "You cannot hack yourself!"})
        return

    if players[target]['password'].lower() == guess.lower():
        stolen = players[target]['score'] // 2
        players[hacker]['score'] += stolen
        players[target]['score'] -= stolen
        print(f"[HACK] {hacker} stole {stolen} points from {target}")
        emit('hack_result', {"success": True, "hacker": hacker, "target": target, "stolen": stolen}, broadcast=True)
    else:
        print(f"[HACK] {hacker} failed to hack {target}")
        emit('hack_result', {"success": False, "hacker": hacker, "target": target}, broadcast=True)

    emit('update_score', players, broadcast=True)

@socketio.on('get_scores')
def send_scores():
    emit('update_score', players)

@socketio.on('lucky_draw')
def handle_draw(data):
    name = data.get('name')
    if not name or name not in players:
        emit('draw_result', {"prize": "Invalid player"})
        return

    if name in drawn_players:
        emit('draw_result', {"prize": "Already Drawn"})
        return

    prize = random.choices(prizes, weights=prize_probs, k=1)[0]

    if prize != "Draw Again":
        drawn_players.add(name)
    print(f"[DRAW] Player '{name}' got prize: {prize}")
    emit('draw_result', {"prize": prize})

@socketio.on('reset')
def reset_game():
    global players, game_started, drawn_players
    players.clear()
    drawn_players.clear()
    game_started = False
    print("[GAME] Game reset.")
    emit('reset_game', broadcast=True)

if __name__ == '__main__':
    print("Starting Flask-SocketIO server...")
    socketio.run(app, host='0.0.0.0', port=5000, use_reloader=False, log_output=True)
