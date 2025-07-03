    from flask import Flask, render_template
    from flask_socketio import SocketIO, emit
    import random
    import eventlet

    eventlet.monkey_patch()

    app = Flask(__name__)
    socketio = SocketIO(app)

    players = {}
    questions = [
        {"question": "What happens when too many trees are cut down?", "answer": "Deforestation"},
        {"question": "Trees help clean the...?", "answer": "Air"},
        {"question": "What do forests provide homes for?", "answer": "Animals"},
        {"question": "What do trees produce that we breathe?", "answer": "Oxygen"},
        {"question": "Cutting down forests is called...?", "answer": "Deforestation"},
        {"question": "What grows in forests?", "answer": "Trees"},
    ]

    prizes = ["Keychain", "Pencil", "Reusable Cutlery", "Nothing", "Draw Again"]
    prize_probs = [25, 25, 25, 20, 5]

    game_started = False
    hacked_passwords = {}
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

    @socketio.on('join')
    def handle_join(data):
        global game_started
        name = data.get('name')
        password = data.get('password')
        print(f"Player joined: {name}")
        if not name or not password:
            emit('error', {'message': 'Name and password required.'})
            return
        if name not in players:
            players[name] = {"score": 0, "password": password}
            print(f"Added player: {name}. Total players: {len(players)}")
        else:
            print(f"Player {name} already joined.")
        emit('players_update', list(players.keys()), broadcast=True)
        if len(players) == 2 and not game_started:
            game_started = True
            print("Starting game - 2 players joined")
            emit('start_game', broadcast=True)

    @socketio.on('get_question')
    def handle_question():
        q = random.choice(questions)
        emit('question', q)

    @socketio.on('submit_answer')
    def handle_answer(data):
        name = data['name']
        correct = data['correct']
        if correct:
            players[name]['score'] += 1000
        emit('update_score', players, broadcast=True)

    @socketio.on('power_up')
    def handle_power_up(data):
        power = random.choice(["Nothing", "Single Crypto", "Double Crypto"])
        emit('power_result', power)

    @socketio.on('hack_attempt')
    def handle_hack(data):
        hacker = data['hacker']
        target = data['target']
        guess = data['guess']
        if players[target]['password'].lower() == guess.lower():
            stolen = players[target]['score'] // 2
            players[hacker]['score'] += stolen
            players[target]['score'] -= stolen
            emit('hack_result', {"success": True, "hacker": hacker, "target": target, "stolen": stolen}, broadcast=True)
        else:
            emit('hack_result', {"success": False, "hacker": hacker, "target": target}, broadcast=True)
        emit('update_score', players, broadcast=True)

    @socketio.on('get_scores')
    def send_scores():
        emit('update_score', players)

    @socketio.on('lucky_draw')
    def handle_draw(data):
        name = data['name']
        if name in drawn_players:
            emit('draw_result', {"prize": "Already Drawn"})
            return
        prize = random.choices(prizes, weights=prize_probs, k=1)[0]
        if prize != "Draw Again":
            drawn_players.add(name)
        emit('draw_result', {"prize": prize})

    @socketio.on('reset')
    def reset_game():
        global players, game_started, drawn_players
        players = {}
        game_started = False
        drawn_players = set()
        emit('reset_game', broadcast=True)

    if __name__ == '__main__':
        print("Starting Flask-SocketIO server...")
        socketio.run(app, host='0.0.0.0', port=5000, use_reloader=False, log_output=True)
