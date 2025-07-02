from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random
import time

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

players = {}
passwords = {}
scores = {}
hacked = {}
can_spin_again = {}
winner_drawn = {}
leaderboard = {}
game_started = False
start_time = 0

questions_pool = [
    {"q": "What is deforestation?", "a": "Cutting down trees"},
    {"q": "Why is deforestation bad?", "a": "It destroys animal homes"},
    {"q": "What can we do to help?", "a": "Plant more trees"},
    {"q": "Trees help make?", "a": "Oxygen"},
    {"q": "What lives in forests?", "a": "Animals"},
    {"q": "Cutting too many trees causes?", "a": "Less clean air"},
    {"q": "Forests are homes for?", "a": "Wildlife"},
    {"q": "Deforestation causes?", "a": "Climate change"},
    {"q": "We should ____ trees.", "a": "Protect"},
    {"q": "Who can help stop deforestation?", "a": "Everyone"},
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/quiz')
def quiz():
    return render_template('quiz.html')

@app.route('/result')
def result():
    return render_template('result.html')

@socketio.on('join')
def handle_join(data):
    global game_started, start_time
    name = data['name']
    password = data['password']
    
    if name in players or len(players) >= 2:
        emit('join_error', {'error': 'Name taken or room full'})
        return
    
    players[name] = request.sid
    passwords[name] = password
    scores[name] = 0
    hacked[name] = False
    can_spin_again[name] = False
    winner_drawn[name] = False

    emit('player_list', list(players.keys()), broadcast=True)

    if len(players) == 2 and not game_started:
        game_started = True
        start_time = time.time()
        emit('start_game', broadcast=True)

@socketio.on('get_question')
def send_question():
    q = random.choice(questions_pool)
    emit('question', q)

@socketio.on('submit_answer')
def handle_answer(data):
    name = data['name']
    correct = data['correct']
    
    if correct:
        options = generate_options()
    else:
        options = ['Nothing', 'Nothing', 'Nothing']
    
    emit('options', options)

@socketio.on('pick_option')
def handle_pick(data):
    name = data['name']
    option = data['option']
    
    if option == 'Single Crypto':
        scores[name] += 1000
    elif option == 'Double Crypto':
        scores[name] += 2000
    elif option == 'Hack':
        emit('hack_prompt', {'target': get_opponent(name)}, room=players[name])
    elif option == 'Forest Bonus':
        scores[name] += 500

    emit('update_score', scores, broadcast=True)

@socketio.on('attempt_hack')
def handle_hack(data):
    attacker = data['attacker']
    guess = data['guess']
    target = get_opponent(attacker)

    if guess == passwords[target]:
        stolen = scores[target] // 2
        scores[attacker] += stolen
        scores[target] -= stolen
        emit('hack_result', {'success': True, 'attacker': attacker, 'stolen': stolen}, broadcast=True)
    else:
        emit('hack_result', {'success': False, 'attacker': attacker}, room=players[attacker])
    
    emit('update_score', scores, broadcast=True)

@socketio.on('check_timer')
def check_timer():
    if time.time() - start_time >= 120:
        emit('end_game', scores, broadcast=True)

@socketio.on('lucky_draw')
def handle_draw(data):
    name = data['name']
    if winner_drawn.get(name, False) and not can_spin_again[name]:
        emit('draw_result', {'prize': 'Already Drawn'})
        return

    prize = random.choices(
        ['Keychain', 'Pencil', 'Cutlery', 'Nothing', 'Draw Again'],
        weights=[25, 25, 25, 20, 5],
        k=1
    )[0]

    if prize == 'Draw Again':
        can_spin_again[name] = True
    else:
        winner_drawn[name] = True
        can_spin_again[name] = False

    emit('draw_result', {'prize': prize})

@socketio.on('update_leaderboard')
def update_leaderboard(data):
    winner = data['winner']
    leaderboard[winner] = leaderboard.get(winner, 0) + 1
    emit('leaderboard_update', leaderboard, broadcast=True)

@socketio.on('reset_game')
def reset_game():
    global players, passwords, scores, hacked, can_spin_again, winner_drawn, game_started, start_time
    players.clear()
    passwords.clear()
    scores.clear()
    hacked.clear()
    can_spin_again.clear()
    winner_drawn.clear()
    game_started = False
    start_time = 0
    emit('game_reset', broadcast=True)

def generate_options():
    pool = ['Single Crypto', 'Double Crypto', 'Nothing', 'Hack', 'Forest Bonus']
    return random.sample(pool, 3)

def get_opponent(name):
    for player in players:
        if player != name:
            return player
    return None

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=3000)
