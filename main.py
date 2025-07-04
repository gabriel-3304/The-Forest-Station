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
        "correct": 0,
        "difficulty": "easy"
    },
    {
        "question": "Trees help clean the...?",
        "options": ["Water", "Air", "Soil", "Ocean"],
        "correct": 1,
        "difficulty": "easy"
    },
    {
        "question": "What do forests provide homes for?",
        "options": ["Rocks", "Cars", "Animals", "Buildings"],
        "correct": 2,
        "difficulty": "easy"
    },
    {
        "question": "What do trees produce that we breathe?",
        "options": ["Carbon Dioxide", "Oxygen", "Nitrogen", "Methane"],
        "correct": 1,
        "difficulty": "easy"
    },
    {
        "question": "Cutting down forests is called...?",
        "options": ["Deforestation", "Planting", "Growing", "Watering"],
        "correct": 0,
        "difficulty": "easy"
    },
    {
        "question": "What grows in forests?",
        "options": ["Cars", "Trees", "Houses", "Roads"],
        "correct": 1,
        "difficulty": "easy"
    },
    {
        "question": "What gas do trees absorb from the atmosphere?",
        "options": ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"],
        "correct": 2,
        "difficulty": "medium"
    },
    {
        "question": "What is the main cause of Amazon rainforest destruction?",
        "options": ["Tourism", "Agriculture", "Mining", "Pollution"],
        "correct": 1,
        "difficulty": "medium"
    },
    {
        "question": "Trees prevent soil from washing away, this is called preventing...?",
        "options": ["Erosion", "Growth", "Pollution", "Tourism"],
        "correct": 0,
        "difficulty": "medium"
    },
    {
        "question": "What climate change effect is worsened by deforestation?",
        "options": ["Snow", "Rain", "Global Warming", "Wind"],
        "correct": 2,
        "difficulty": "medium"
    },
    {
        "question": "Which forest is known as the 'lungs of the Earth'?",
        "options": ["Congo Rainforest", "Amazon Rainforest", "Boreal Forest", "Temperate Forest"],
        "correct": 1,
        "difficulty": "hard"
    },
    {
        "question": "How much of Earth's oxygen is produced by forests?",
        "options": ["10%", "20%", "30%", "40%"],
        "correct": 1,
        "difficulty": "hard"
    },
    {
        "question": "What percentage of the world's land was originally covered by forests?",
        "options": ["40%", "50%", "60%", "70%"],
        "correct": 2,
        "difficulty": "hard"
    }
]

prizes = ["Eco-Warrior Badge", "Tree Seed Pack", "Reusable Water Bottle", "Nothing", "Draw Again"]
prize_probs = [25, 25, 25, 20, 5]

# Enhanced game state
game_started = False
drawn_players = set()
current_round = 1
max_rounds = 10
question_streak = {}
power_ups = {}
battle_stats = {}
speed_bonus_active = False
round_winner = None

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

    if len(players) >= 2:
        emit('error', {'message': 'Game is full! Only 2 players allowed.'})
        return

    if name in players:
        emit('error', {'message': f'Player name "{name}" is already taken!'})
        return

    players[name] = {"score": 0, "password": password, "lives": 3, "shield": False}
    question_streak[name] = 0
    power_ups[name] = {"shield": 0, "double_points": 0, "steal": 0}
    battle_stats[name] = {"correct": 0, "wrong": 0, "hacks_successful": 0, "hacks_failed": 0}
    
    print(f"[JOIN] Player '{name}' joined. Total players: {len(players)}")

    emit('players_update', list(players.keys()), broadcast=True)

    if len(players) == 2 and not game_started:
        game_started = True
        print("[GAME] Starting 1v1 Battle Royale with 2 players.")
        emit('start_game', broadcast=True)
        emit('round_update', {"round": current_round, "max_rounds": max_rounds}, broadcast=True)

@socketio.on('get_question')
def handle_question():
    global speed_bonus_active
    if questions:
        # Choose question based on current round (harder questions in later rounds)
        if current_round <= 3:
            available_questions = [q for q in questions if q.get('difficulty') == 'easy']
        elif current_round <= 7:
            available_questions = [q for q in questions if q.get('difficulty') in ['easy', 'medium']]
        else:
            available_questions = questions
        
        q = random.choice(available_questions if available_questions else questions)
        
        # Random speed bonus rounds
        speed_bonus_active = random.random() < 0.3  # 30% chance
        if speed_bonus_active:
            q['speed_bonus'] = True
            
        emit('question', q)
    else:
        emit('error', {'message': 'No questions available'})

@socketio.on('submit_answer')
def handle_answer(data):
    global round_winner
    name = data.get('name')
    selected_option = data.get('selected_option')
    correct_answer = data.get('correct_answer')
    question_difficulty = data.get('difficulty', 'easy')
    answer_time = data.get('answer_time', 10)  # Time taken to answer
    
    if name and name in players:
        correct = selected_option == correct_answer
        
        # Calculate base points based on difficulty
        base_points = {"easy": 500, "medium": 750, "hard": 1000}
        points = base_points.get(question_difficulty, 500)
        
        if correct:
            # Update streak
            question_streak[name] += 1
            battle_stats[name]["correct"] += 1
            
            # Streak bonus (every 3 correct answers in a row)
            streak_bonus = (question_streak[name] // 3) * 250
            
            # Speed bonus (if answered quickly during speed round)
            speed_bonus = 0
            if speed_bonus_active and answer_time <= 5:
                speed_bonus = 300
                
            # Double points power-up
            multiplier = 2 if power_ups[name]["double_points"] > 0 else 1
            if multiplier == 2:
                power_ups[name]["double_points"] -= 1
                
            total_points = (points + streak_bonus + speed_bonus) * multiplier
            players[name]['score'] += total_points
            
            print(f"[SCORE] {name} scored {total_points} points (streak: {question_streak[name]}). Total: {players[name]['score']}")
            
            # Check for round winner (first to answer correctly wins the round)
            if not round_winner:
                round_winner = name
                
        else:
            # Reset streak on wrong answer
            question_streak[name] = 0
            battle_stats[name]["wrong"] += 1
            
            # Lose a life for wrong answers
            players[name]['lives'] -= 1
            
        emit('answer_result', {
            'correct': correct,
            'selected': selected_option,
            'correct_answer': correct_answer,
            'points_earned': total_points if correct else 0,
            'streak': question_streak[name],
            'lives_remaining': players[name]['lives'],
            'round_winner': round_winner
        })

    emit('update_score', players, broadcast=True)
    emit('battle_stats', battle_stats, broadcast=True)

@socketio.on('power_up')
def handle_power_up(data):
    name = data.get('name', '')
    power_options = [
        "Nothing", "Shield Potion", "Double Points", "Steal Points", 
        "Extra Life", "Question Skip", "Freeze Opponent"
    ]
    weights = [30, 15, 15, 10, 10, 10, 10]
    
    power = random.choices(power_options, weights=weights)[0]
    
    if name in players:
        if power == "Shield Potion":
            power_ups[name]["shield"] += 1
            players[name]["shield"] = True
        elif power == "Double Points":
            power_ups[name]["double_points"] += 2  # Next 2 correct answers are doubled
        elif power == "Steal Points":
            power_ups[name]["steal"] += 1
        elif power == "Extra Life":
            players[name]["lives"] = min(players[name]["lives"] + 1, 5)  # Max 5 lives
        elif power == "Question Skip":
            # Skip to next question immediately
            emit('question_skip', {"player": name}, broadcast=True)
        elif power == "Freeze Opponent":
            opponent = [p for p in players.keys() if p != name][0]
            emit('freeze_player', {"frozen_player": opponent, "duration": 10}, broadcast=True)
    
    print(f"[POWER-UP] {name} got: {power}")
    emit('power_result', {"power": power, "player": name}, broadcast=True)
    emit('update_score', players, broadcast=True)

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

    # Check if target has shield protection
    if players[target].get('shield', False):
        players[target]['shield'] = False  # Shield is consumed after blocking one attack
        power_ups[target]["shield"] = max(0, power_ups[target]["shield"] - 1)
        battle_stats[hacker]["hacks_failed"] += 1
        emit('hack_result', {
            "success": False, 
            "hacker": hacker, 
            "target": target, 
            "message": f"{target} was protected by a Shield! 🛡️"
        }, broadcast=True)
    elif players[target]['password'].lower() == guess.lower():
        # Successful hack
        stolen = max(players[target]['score'] // 3, 500)  # Steal at least 500 points
        bonus_life_steal = random.random() < 0.3  # 30% chance to steal a life too
        
        players[hacker]['score'] += stolen
        players[target]['score'] = max(0, players[target]['score'] - stolen)
        
        if bonus_life_steal and players[target]['lives'] > 1:
            players[target]['lives'] -= 1
            players[hacker]['lives'] = min(players[hacker]['lives'] + 1, 5)
            battle_stats[hacker]["hacks_successful"] += 1
            
            print(f"[CRITICAL HACK] {hacker} stole {stolen} points AND a life from {target}")
            emit('hack_result', {
                "success": True, 
                "critical": True,
                "hacker": hacker, 
                "target": target, 
                "stolen": stolen,
                "life_stolen": True
            }, broadcast=True)
        else:
            battle_stats[hacker]["hacks_successful"] += 1
            print(f"[HACK] {hacker} stole {stolen} points from {target}")
            emit('hack_result', {
                "success": True, 
                "hacker": hacker, 
                "target": target, 
                "stolen": stolen
            }, broadcast=True)
    else:
        # Failed hack - hacker loses points as penalty
        penalty = 200
        players[hacker]['score'] = max(0, players[hacker]['score'] - penalty)
        battle_stats[hacker]["hacks_failed"] += 1
        
        print(f"[HACK] {hacker} failed to hack {target} and lost {penalty} points")
        emit('hack_result', {
            "success": False, 
            "hacker": hacker, 
            "target": target,
            "penalty": penalty,
            "message": f"Wrong password! You lost {penalty} points! 💥"
        }, broadcast=True)

    emit('update_score', players, broadcast=True)
    emit('battle_stats', battle_stats, broadcast=True)

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
