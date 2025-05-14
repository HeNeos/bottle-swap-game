use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use wasm_bindgen::prelude::*;

const MAX_LEVELS: usize = 12;
const MAX_N_OF_BOTTLES: usize = 12;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
struct Bottle {
    state: [u8; MAX_LEVELS],
    top_liquid: u8,
    liquid_level: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct JsGameState {
    bottles: Vec<Vec<u8>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Movement {
    from: usize,
    to: usize,
    amount: usize,
}

#[derive(Clone, Debug)]
struct State {
    state: [Bottle; MAX_N_OF_BOTTLES],
    previous_state: Option<Box<State>>,
    last_movement: Option<(usize, usize)>,
    how_much_moved: usize,
    levels: usize,
    n_of_bottles: usize,
}

impl Hash for State {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.state[0..self.n_of_bottles].hash(state);
    }
}

impl PartialEq for State {
    fn eq(&self, other: &Self) -> bool {
        self.n_of_bottles == other.n_of_bottles
            && self.state[0..self.n_of_bottles] == other.state[0..other.n_of_bottles]
    }
}

impl Eq for State {}

struct SearchResult {
    cost: f64,
    is_goal: bool,
}

struct PatternCache {
    cache: HashMap<String, Vec<Movement>>,
}

impl PatternCache {
    fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    fn create_key(state: &State) -> String {
        let mut key = String::new();
        for i in 0..state.n_of_bottles {
            let bottle = &state.state[i];
            key.push('[');
            for j in 0..bottle.liquid_level {
                key.push_str(&bottle.state[j].to_string());
                key.push(',');
            }
            key.push(']');
        }
        key
    }

    fn get(&self, state: &State) -> Option<&Vec<Movement>> {
        let key = Self::create_key(state);
        self.cache.get(&key)
    }

    fn put(&mut self, state: &State, movements: Vec<Movement>) {
        let key = Self::create_key(state);
        self.cache.insert(key, movements);
    }
}

static mut PATTERN_CACHE: Option<PatternCache> = None;

#[wasm_bindgen]
pub fn solve(
    levels: usize,
    n_of_bottles: usize,
    game_state_js: JsValue,
) -> Result<JsValue, JsError> {
    if levels == 0 || levels > MAX_LEVELS {
        return Err(JsError::new(&format!(
            "Invalid levels: {}. Must be > 0 and <= {}.",
            levels, MAX_LEVELS
        )));
    }
    if n_of_bottles == 0 || n_of_bottles > MAX_N_OF_BOTTLES {
        return Err(JsError::new(&format!(
            "Invalid n_of_bottles: {}. Must be > 0 and <= {}.",
            n_of_bottles, MAX_N_OF_BOTTLES
        )));
    }

    let game_state: JsGameState = serde_wasm_bindgen::from_value(game_state_js)
        .map_err(|e| JsError::new(&format!("Failed to parse game state: {}", e)))?;

    let initial_state = convert_to_internal_state(&game_state, levels, n_of_bottles)?;

    unsafe {
        if PATTERN_CACHE.is_none() {
            PATTERN_CACHE = Some(PatternCache::new());
        }

        if let Some(cache) = &PATTERN_CACHE {
            if let Some(movements) = cache.get(&initial_state) {
                return Ok(serde_wasm_bindgen::to_value(movements)
                    .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?);
            }
        }
    }

    let empty_bottles = initial_state.state[0..initial_state.n_of_bottles]
        .iter()
        .filter(|b| b.liquid_level == 0)
        .count();

    let optimized_state = if empty_bottles >= 3 {
        optimize_initial_distribution(initial_state.clone())
    } else {
        initial_state.clone()
    };

    if let Some(solution) = ida_star_search(optimized_state) {
        let movements = extract_movements(solution);

        unsafe {
            if let Some(cache) = &mut PATTERN_CACHE {
                cache.put(&initial_state, movements.clone());
            }
        }

        return Ok(serde_wasm_bindgen::to_value(&movements)
            .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?);
    }

    if let Some(solution) = ida_star_search(initial_state.clone()) {
        let movements = extract_movements(solution);

        unsafe {
            if let Some(cache) = &mut PATTERN_CACHE {
                cache.put(&initial_state, movements.clone());
            }
        }

        return Ok(serde_wasm_bindgen::to_value(&movements)
            .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?);
    }

    if let Some(solution) = enhanced_bfs_search(initial_state.clone()) {
        let movements = extract_movements(solution);

        unsafe {
            if let Some(cache) = &mut PATTERN_CACHE {
                cache.put(&initial_state, movements.clone());
            }
        }

        return Ok(serde_wasm_bindgen::to_value(&movements)
            .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?);
    }

    if let Some(solution) = beam_search(initial_state.clone(), 1000) {
        let movements = extract_movements(solution);

        unsafe {
            if let Some(cache) = &mut PATTERN_CACHE {
                cache.put(&initial_state, movements.clone());
            }
        }

        return Ok(serde_wasm_bindgen::to_value(&movements)
            .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?);
    }

    Err(JsError::new("No solution found"))
}

fn convert_to_internal_state(
    game_state_from_js: &JsGameState,
    levels: usize,
    n_of_bottles: usize,
) -> Result<State, JsError> {
    let mut internal_bottles_array = [Bottle {
        state: [0; MAX_LEVELS],
        top_liquid: 0,
        liquid_level: 0,
    }; MAX_N_OF_BOTTLES];

    if game_state_from_js.bottles.len() != n_of_bottles {
        return Err(JsError::new(&format!(
            "JS GameState has {} bottles, expected {}",
            game_state_from_js.bottles.len(),
            n_of_bottles
        )));
    }

    for (i, js_bottle_vec) in game_state_from_js.bottles.iter().enumerate() {
        if i >= n_of_bottles {
            break;
        }

        let js_vec_len = js_bottle_vec.len();
        if js_vec_len != levels {
            if js_vec_len > levels {
                return Err(JsError::new(&format!(
                    "Bottle {} from JS has length {}, exceeds game levels {}",
                    i, js_vec_len, levels
                )));
            }
            return Err(JsError::new(&format!(
                "Bottle {} from JS has length {}, expected game levels {}",
                i, js_vec_len, levels
            )));
        }

        let mut temp_bottle_state = [0u8; MAX_LEVELS];

        let mut internal_idx = 0;
        for &color in js_bottle_vec.iter().rev() {
            if color != 0 {
                if internal_idx < levels {
                    temp_bottle_state[internal_idx] = color;
                    internal_idx += 1;
                } else {
                    return Err(JsError::new(&format!(
                        "Too much liquid in JS bottle {} for specified levels {}",
                        i, levels
                    )));
                }
            }
        }

        let current_liquid_level = internal_idx;
        internal_bottles_array[i].state = temp_bottle_state;
        internal_bottles_array[i].liquid_level = current_liquid_level;

        if current_liquid_level > 0 {
            internal_bottles_array[i].top_liquid =
                internal_bottles_array[i].state[current_liquid_level - 1];
        } else {
            internal_bottles_array[i].top_liquid = 0;
        }
    }

    Ok(State {
        state: internal_bottles_array,
        previous_state: None,
        last_movement: None,
        how_much_moved: 0,
        levels,
        n_of_bottles,
    })
}

fn is_valid_to_move(from_bottle: &Bottle, to_bottle: &Bottle, levels: usize) -> bool {
    if from_bottle.liquid_level == 0 || to_bottle.liquid_level >= levels {
        return false;
    }

    if to_bottle.liquid_level == 0 {
        let top_color = from_bottle.top_liquid;
        let is_single_color =
            (0..from_bottle.liquid_level).all(|i| from_bottle.state[i] == top_color);

        if is_single_color {
            return false;
        }
    }

    to_bottle.liquid_level == 0 || from_bottle.top_liquid == to_bottle.top_liquid
}

fn how_much_to_move(from_bottle: &Bottle, to_bottle: &Bottle, levels: usize) -> usize {
    if !is_valid_to_move(from_bottle, to_bottle, levels) {
        return 0;
    }

    let mut pourable_amount = 0;
    let color_to_pour = from_bottle.top_liquid;
    for k in (0..from_bottle.liquid_level).rev() {
        if from_bottle.state[k] == color_to_pour {
            pourable_amount += 1;
        } else {
            break;
        }
    }

    pourable_amount.min(levels - to_bottle.liquid_level)
}

fn is_final_state_bottle(bottle: &Bottle) -> bool {
    if bottle.liquid_level == 0 {
        return true;
    }

    let bottom_color = bottle.state[0];
    if bottom_color == 0 {
        return false;
    }

    (1..bottle.liquid_level).all(|k| bottle.state[k] == bottom_color)
}

fn is_final_state_game(state: &State) -> bool {
    (0..state.n_of_bottles).all(|i| is_final_state_bottle(&state.state[i]))
}

fn move_liquid(from_bottle: &mut Bottle, to_bottle: &mut Bottle, amount: usize, levels: usize) {
    if amount == 0 {
        return;
    }

    let liquid_to_move = from_bottle.top_liquid;

    for k in 0..amount {
        from_bottle.state[(from_bottle.liquid_level - 1) - k] = 0;
    }
    from_bottle.liquid_level -= amount;
    from_bottle.top_liquid = if from_bottle.liquid_level > 0 {
        from_bottle.state[from_bottle.liquid_level - 1]
    } else {
        0
    };

    for k in 0..amount {
        if to_bottle.liquid_level < levels && to_bottle.liquid_level < MAX_LEVELS {
            to_bottle.state[to_bottle.liquid_level] = liquid_to_move;
            to_bottle.liquid_level += 1;
        } else {
            break;
        }
    }
    to_bottle.top_liquid = liquid_to_move;
}

fn move_liquid_state(current_state: &State, from: usize, to: usize, amount: usize) -> State {
    let mut new_state = current_state.clone();
    let game_levels = current_state.levels;

    if from < to {
        let (slice_before_to, slice_from_to) = new_state.state.split_at_mut(to);
        move_liquid(
            &mut slice_before_to[from],
            &mut slice_from_to[0],
            amount,
            game_levels,
        );
    } else {
        let (slice_before_from, slice_from_from) = new_state.state.split_at_mut(from);
        move_liquid(
            &mut slice_from_from[0],
            &mut slice_before_from[to],
            amount,
            game_levels,
        );
    }

    new_state.previous_state = Some(Box::new(current_state.clone()));
    new_state.last_movement = Some((from, to));
    new_state.how_much_moved = amount;
    new_state
}

fn calculate_heuristic(state: &State) -> f64 {
    let mut score = 0.0;

    let unfinished_bottles = state.state[0..state.n_of_bottles]
        .iter()
        .filter(|b| !is_final_state_bottle(b))
        .count();
    score += unfinished_bottles as f64;

    let mut color_counts: HashMap<u8, Vec<(usize, usize)>> = HashMap::new();

    for i in 0..state.n_of_bottles {
        let bottle = &state.state[i];

        if bottle.liquid_level == 0 {
            continue;
        }

        for level in 0..bottle.liquid_level {
            let color = bottle.state[level];
            if color > 0 {
                color_counts
                    .entry(color)
                    .or_insert_with(Vec::new)
                    .push((i, level));
            }
        }
    }

    for (color, locations) in color_counts {
        if color > 0 {
            let mut bottles_with_this_color = HashSet::new();
            for (bottle_idx, _) in &locations {
                bottles_with_this_color.insert(bottle_idx);
            }

            if bottles_with_this_color.len() > 1 {
                score += (bottles_with_this_color.len() - 1) as f64 * 0.8;
            }

            let total_units = locations.len();
            let max_units_per_bottle = state.levels;

            if total_units > 0 && total_units <= max_units_per_bottle {
                score += (bottles_with_this_color.len() - 1) as f64 * 0.5;
            }
        }
    }

    for i in 0..state.n_of_bottles {
        let bottle = &state.state[i];
        if bottle.liquid_level <= 1 {
            continue;
        }

        let mut transitions = 0;
        for j in 1..bottle.liquid_level {
            if bottle.state[j] != bottle.state[j - 1] {
                transitions += 1;
            }
        }

        score += transitions as f64 * 0.3;
    }

    for i in 0..state.n_of_bottles {
        let bottle = &state.state[i];
        if bottle.liquid_level == 0 || bottle.liquid_level == state.levels {
            continue;
        }

        let mut is_single_color = true;
        let first_color = bottle.state[0];

        for j in 1..bottle.liquid_level {
            if bottle.state[j] != first_color {
                is_single_color = false;
                break;
            }
        }

        if is_single_color {
            score -= 0.3;
        }
    }

    if state.n_of_bottles >= 8 && state.levels >= 7 {
        let partially_filled_bottles = state.state[0..state.n_of_bottles]
            .iter()
            .filter(|b| b.liquid_level > 0 && b.liquid_level < state.levels)
            .count();

        score += partially_filled_bottles as f64 * 0.2;

        for i in 0..state.n_of_bottles {
            let bottle = &state.state[i];
            if bottle.liquid_level > 0 && bottle.liquid_level < state.levels {
                let all_same = (1..bottle.liquid_level).all(|j| bottle.state[j] == bottle.state[0]);

                if all_same {
                    score -= 0.5;
                }
            }
        }
    }

    score
}

fn calculate_move_priority(state: &State, from: usize, to: usize, amount: usize) -> f64 {
    let mut priority = 0.0;
    let from_bottle = &state.state[from];
    let to_bottle = &state.state[to];

    if to_bottle.liquid_level == 0 {
        if amount == from_bottle.liquid_level
            && (0..amount).all(|i| {
                from_bottle.state[from_bottle.liquid_level - 1 - i] == from_bottle.top_liquid
            })
        {
            priority += 1.0;
        } else {
            priority -= 0.5;
        }
    }

    if to_bottle.liquid_level + amount == state.levels {
        let potential_color = from_bottle.top_liquid;
        let mut would_complete = true;

        for j in 0..to_bottle.liquid_level {
            if to_bottle.state[j] != potential_color {
                would_complete = false;
                break;
            }
        }

        if would_complete {
            priority += 3.0;
        }
    }

    if from_bottle.liquid_level == amount {
        priority += 1.5;
    }

    priority += (amount as f64) * 0.1;

    let mut from_bottle_colors = HashSet::new();
    for i in 0..from_bottle.liquid_level - amount {
        from_bottle_colors.insert(from_bottle.state[i]);
    }

    if from_bottle_colors.len() > 1 {
        priority -= 0.3;
    }

    priority
}

fn find_obvious_moves(state: &State) -> Option<(usize, usize, usize)> {
    for from in 0..state.n_of_bottles {
        let from_bottle = &state.state[from];
        if from_bottle.liquid_level == 0 {
            continue;
        }

        for to in 0..state.n_of_bottles {
            if from == to {
                continue;
            }

            let to_bottle = &state.state[to];
            let amount = how_much_to_move(from_bottle, to_bottle, state.levels);

            if amount > 0 {
                if to_bottle.liquid_level > 0
                    && to_bottle.liquid_level + amount == state.levels
                    && (0..to_bottle.liquid_level)
                        .all(|i| to_bottle.state[i] == from_bottle.top_liquid)
                {
                    return Some((from, to, amount));
                }

                if from_bottle.liquid_level == amount
                    && (to_bottle.liquid_level == 0
                        || to_bottle.top_liquid == from_bottle.top_liquid)
                {
                    return Some((from, to, amount));
                }
            }
        }
    }

    None
}

fn assign_empty_bottles_to_colors(state: &State) -> HashMap<usize, u8> {
    let mut assignments = HashMap::new();
    let mut empty_bottles = Vec::new();
    let mut colors_needed = HashSet::new();

    for i in 0..state.n_of_bottles {
        let bottle = &state.state[i];
        if bottle.liquid_level == 0 {
            empty_bottles.push(i);
        } else {
            for j in 0..bottle.liquid_level {
                colors_needed.insert(bottle.state[j]);
            }
        }
    }

    let mut color_counts = HashMap::new();
    for i in 0..state.n_of_bottles {
        let bottle = &state.state[i];
        for j in 0..bottle.liquid_level {
            let color = bottle.state[j];
            *color_counts.entry(color).or_insert(0) += 1;
        }
    }

    let mut color_vec: Vec<(u8, usize)> = color_counts.into_iter().collect();
    color_vec.sort_by(|a, b| b.1.cmp(&a.1));

    for (idx, (color, _)) in color_vec.iter().enumerate() {
        if idx >= empty_bottles.len() {
            break;
        }
        assignments.insert(empty_bottles[idx], *color);
    }

    assignments
}

fn calculate_move_priority_with_assignments(
    state: &State,
    from: usize,
    to: usize,
    amount: usize,
    bottle_assignments: &HashMap<usize, u8>,
) -> f64 {
    let mut priority = calculate_move_priority(state, from, to, amount);

    let from_bottle = &state.state[from];
    let to_bottle = &state.state[to];

    if to_bottle.liquid_level == 0 {
        if let Some(&assigned_color) = bottle_assignments.get(&to) {
            if from_bottle.top_liquid == assigned_color {
                priority += 3.0;
            } else if bottle_assignments
                .values()
                .any(|&c| c == from_bottle.top_liquid)
            {
                priority -= 1.0;
            }
        }
    }

    if to_bottle.liquid_level > 0 && from_bottle.liquid_level == amount {
        if bottle_assignments.get(&from).is_none() {
            priority += 1.0;
        }
    }

    priority
}

fn generate_sorted_moves(state: &State) -> Vec<(usize, usize, usize)> {
    let mut moves = Vec::new();

    for from in 0..state.n_of_bottles {
        if state.state[from].liquid_level == 0 {
            continue;
        }

        for to in 0..state.n_of_bottles {
            if from == to {
                continue;
            }

            let amount = how_much_to_move(&state.state[from], &state.state[to], state.levels);
            if amount > 0 {
                let priority = calculate_move_priority(state, from, to, amount);
                moves.push((from, to, amount, priority));
            }
        }
    }

    moves.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));

    moves
        .into_iter()
        .map(|(from, to, amount, _)| (from, to, amount))
        .collect()
}

fn generate_sorted_moves_with_assignments(state: &State) -> Vec<(usize, usize, usize)> {
    let bottle_assignments = assign_empty_bottles_to_colors(state);

    let mut moves = Vec::new();

    for from in 0..state.n_of_bottles {
        if state.state[from].liquid_level == 0 {
            continue;
        }

        let from_color = state.state[from].top_liquid;

        for (&bottle_idx, &assigned_color) in &bottle_assignments {
            if assigned_color == from_color && state.state[bottle_idx].liquid_level == 0 {
                let amount =
                    how_much_to_move(&state.state[from], &state.state[bottle_idx], state.levels);
                if amount > 0 {
                    moves.push((from, bottle_idx, amount, 10.0));
                }
            }
        }
    }

    for from in 0..state.n_of_bottles {
        if state.state[from].liquid_level == 0 {
            continue;
        }

        for to in 0..state.n_of_bottles {
            if from == to {
                continue;
            }

            let amount = how_much_to_move(&state.state[from], &state.state[to], state.levels);
            if amount > 0 {
                let priority = calculate_move_priority_with_assignments(
                    state,
                    from,
                    to,
                    amount,
                    &bottle_assignments,
                );
                moves.push((from, to, amount, priority));
            }
        }
    }

    moves.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));

    moves
        .into_iter()
        .map(|(from, to, amount, _)| (from, to, amount))
        .collect()
}

fn optimize_initial_distribution(initial_state: State) -> State {
    let mut current_state = initial_state.clone();
    let bottle_assignments = assign_empty_bottles_to_colors(&current_state);

    let max_moves = 10;
    let mut moves_made = 0;

    while moves_made < max_moves {
        let mut best_move = None;
        let mut best_priority = -1.0;

        for from in 0..current_state.n_of_bottles {
            if current_state.state[from].liquid_level == 0 {
                continue;
            }

            for to in 0..current_state.n_of_bottles {
                if from == to {
                    continue;
                }

                let amount = how_much_to_move(
                    &current_state.state[from],
                    &current_state.state[to],
                    current_state.levels,
                );

                if amount > 0 {
                    let priority = calculate_move_priority_with_assignments(
                        &current_state,
                        from,
                        to,
                        amount,
                        &bottle_assignments,
                    );

                    if current_state.state[to].liquid_level == 0 && priority > best_priority {
                        best_move = Some((from, to, amount));
                        best_priority = priority;
                    }
                }
            }
        }

        if best_move.is_none() || best_priority < 1.0 {
            break;
        }

        let (from, to, amount) = best_move.unwrap();
        current_state = move_liquid_state(&current_state, from, to, amount);
        moves_made += 1;

        let empty_bottles_remaining = current_state.state[0..current_state.n_of_bottles]
            .iter()
            .filter(|b| b.liquid_level == 0)
            .count();

        if empty_bottles_remaining == 0 {
            break;
        }
    }

    current_state
}

fn ida_star_search(initial_state: State) -> Option<State> {
    let mut bound = calculate_heuristic(&initial_state);
    let max_iterations = 100;

    for iteration in 0..max_iterations {
        let mut path = Vec::new();
        path.push(initial_state.clone());

        let mut visited = HashSet::new();
        visited.insert(initial_state.clone());

        let mut transposition_table = HashMap::new();
        let result = ida_star_search_recursive(
            &mut path,
            &mut visited,
            0.0,
            bound,
            &mut transposition_table,
        );

        if result.is_goal {
            return Some(path.last().unwrap().clone());
        }

        if result.cost == f64::INFINITY {
            return None;
        }

        bound = result.cost;
    }

    None
}

fn ida_star_search_recursive(
    path: &mut Vec<State>,
    visited: &mut HashSet<State>,
    g: f64,
    bound: f64,
    transposition_table: &mut HashMap<[Bottle; MAX_N_OF_BOTTLES], f64>,
) -> SearchResult {
    let current = path.last().unwrap().clone();

    let h = calculate_heuristic(&current);
    let f = g + h;

    if f > bound {
        return SearchResult {
            cost: f,
            is_goal: false,
        };
    }

    if is_final_state_game(&current) {
        return SearchResult {
            cost: f,
            is_goal: true,
        };
    }

    if let Some(&previous_cost) = transposition_table.get(&current.state) {
        if previous_cost <= g {
            return SearchResult {
                cost: f64::INFINITY,
                is_goal: false,
            };
        }
    }

    transposition_table.insert(current.state, g);

    if let Some((from, to, amount)) = find_obvious_moves(&current) {
        let next_state = move_liquid_state(&current, from, to, amount);

        if !visited.contains(&next_state) {
            path.push(next_state.clone());
            visited.insert(next_state.clone());

            let result =
                ida_star_search_recursive(path, visited, g + 1.0, bound, transposition_table);

            if result.is_goal {
                return result;
            }

            let last_state = path.pop().unwrap();
            visited.remove(&last_state);
        }
    }

    let mut min_cost = f64::INFINITY;

    for (from, to, amount) in generate_sorted_moves_with_assignments(&current) {
        let next_state = move_liquid_state(&current, from, to, amount);

        if visited.contains(&next_state) {
            continue;
        }

        path.push(next_state.clone());
        visited.insert(next_state);

        let result = ida_star_search_recursive(path, visited, g + 1.0, bound, transposition_table);

        if result.is_goal {
            return result;
        }

        min_cost = min_cost.min(result.cost);

        let last_state = path.pop().unwrap();
        visited.remove(&last_state);
    }

    SearchResult {
        cost: min_cost,
        is_goal: false,
    }
}

fn enhanced_bfs_search(initial_state: State) -> Option<State> {
    let mut queue = VecDeque::new();
    let mut visited: HashSet<State> = HashSet::new();
    let mut transposition_table: HashMap<[Bottle; MAX_N_OF_BOTTLES], usize> = HashMap::new();

    visited.insert(initial_state.clone());
    queue.push_back(initial_state);

    let mut best_seen_state = None;
    let mut best_heuristic = f64::INFINITY;

    let max_depth = 100000;
    let mut steps = 0;

    while let Some(current) = queue.pop_front() {
        steps += 1;
        if steps > max_depth {
            break;
        }

        if is_final_state_game(&current) {
            return Some(current);
        }

        let current_heuristic = calculate_heuristic(&current);
        if current_heuristic < best_heuristic {
            best_heuristic = current_heuristic;
            best_seen_state = Some(current.clone());
        }

        let current_depth = transposition_table
            .get(&current.state)
            .copied()
            .unwrap_or(0);

        let mut future_states = Vec::new();

        for (from, to, amount) in generate_sorted_moves_with_assignments(&current) {
            let next_state = move_liquid_state(&current, from, to, amount);

            if !visited.insert(next_state.clone()) {
                continue;
            }

            transposition_table.insert(next_state.state, current_depth + 1);

            let next_h = calculate_heuristic(&next_state);
            future_states.push((next_state, next_h));
        }

        future_states.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        for (state, _) in future_states {
            queue.push_back(state);
        }

        if queue.len() > 10000 {
            let mut pruned_queue = VecDeque::new();
            for _ in 0..5000 {
                if let Some(state) = queue.pop_front() {
                    pruned_queue.push_back(state);
                } else {
                    break;
                }
            }
            queue = pruned_queue;
        }
    }

    best_seen_state
}

fn beam_search(initial_state: State, beam_width: usize) -> Option<State> {
    let mut beam = vec![initial_state];
    let mut visited = HashSet::new();
    let max_iterations = 10000;

    for _ in 0..max_iterations {
        if beam.is_empty() {
            return None;
        }

        for state in &beam {
            if is_final_state_game(state) {
                return Some(state.clone());
            }
        }

        let mut all_successors = Vec::new();

        for state in beam {
            for (from, to, amount) in generate_sorted_moves_with_assignments(&state) {
                let successor = move_liquid_state(&state, from, to, amount);

                if !visited.contains(&successor) {
                    visited.insert(successor.clone());
                    let h = calculate_heuristic(&successor);
                    all_successors.push((successor, h));
                }
            }
        }

        all_successors.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        beam = all_successors
            .into_iter()
            .take(beam_width)
            .map(|(state, _)| state)
            .collect();
    }

    None
}

fn extract_movements(mut solution: State) -> Vec<Movement> {
    let mut movements = VecDeque::new();
    while let Some(prev_box) = solution.previous_state {
        if let Some((from, to)) = solution.last_movement {
            movements.push_front(Movement {
                from,
                to,
                amount: solution.how_much_moved,
            });
        }
        solution = *prev_box;
    }
    movements.into()
}

fn bfs_liquid_pouring(initial_state: State) -> Option<State> {
    enhanced_bfs_search(initial_state)
}
