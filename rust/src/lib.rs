use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use std::collections::{HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use wasm_bindgen::prelude::*;

const MAX_LEVELS: usize = 12;
const MAX_N_OF_BOTTLES: usize = 10;

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

    let solution =
        bfs_liquid_pouring(initial_state).ok_or_else(|| JsError::new("No solution found"))?;

    let movements = extract_movements(solution);

    Ok(serde_wasm_bindgen::to_value(&movements)
        .map_err(|e| JsError::new(&format!("Failed to serialize solution: {}", e)))?)
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

        // Check if JS bottle length matches expected levels
        // Allow flexibility? Or enforce strict match? Let's enforce for now.
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

        let mut current_liquid_level = 0;
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
        current_liquid_level = internal_idx;

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

fn measure_bottle_entropy(bottle: &Bottle) -> i64 {
    if bottle.liquid_level == 0 {
        return 0;
    }
    let mut entropy: i64 = 1;
    let mut previous_liquid = bottle.state[0];
    for k in (1..bottle.liquid_level) {
        let current_liquid = bottle.state[k];
        if current_liquid == 0 {
            break;
        }
        if current_liquid != previous_liquid {
            entropy *= 2;
        }
        previous_liquid = current_liquid;
    }
    entropy
}

fn measure_state_entropy(state: &State) -> i64 {
    let mut entropy: i64 = 0;
    for k in (0..state.n_of_bottles) {
        entropy += measure_bottle_entropy(&state.state[k]);
    }
    entropy
}

fn is_valid_to_move(from_bottle: &Bottle, to_bottle: &Bottle, levels: usize) -> bool {
    if from_bottle.liquid_level == 0 || to_bottle.liquid_level >= levels {
        return false;
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
    (1..bottle.liquid_level).all(|k| bottle.state[k] == bottom_color)
}

fn is_final_state_game(state: &State) -> bool {
    (0..state.n_of_bottles).all(|i| is_final_state_bottle(&state.state[i]))
}

fn move_liquid(from_bottle: &mut Bottle, to_bottle: &mut Bottle, amount: usize) {
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
        if to_bottle.liquid_level + k < MAX_LEVELS {
            to_bottle.state[to_bottle.liquid_level + k] = liquid_to_move;
        } else {
            break;
        }
    }
    to_bottle.liquid_level += amount;
    to_bottle.top_liquid = liquid_to_move;
}

fn move_liquid_state(current_state: &State, from: usize, to: usize, amount: usize) -> State {
    let mut new_state = current_state.clone();

    if from < to {
        let (slice_before_to, slice_from_to) = new_state.state.split_at_mut(to);
        move_liquid(&mut slice_before_to[from], &mut slice_from_to[0], amount);
    } else {
        let (slice_before_from, slice_from_from) = new_state.state.split_at_mut(from);
        move_liquid(&mut slice_from_from[0], &mut slice_before_from[to], amount);
    }

    new_state.previous_state = Some(Box::new(current_state.clone()));
    new_state.last_movement = Some((from, to));
    new_state.how_much_moved = amount;
    new_state
}

fn bfs_liquid_pouring(initial_state: State) -> Option<State> {
    let mut queue = VecDeque::new();
    let mut visited: HashSet<State> = HashSet::new();

    visited.insert(initial_state.clone());
    queue.push_back(initial_state);

    let mut min_visible_entropy = (1u64 << 32);

    while let Some(current) = queue.pop_front() {
        let levels = current.levels;
        let n_of_bottles = current.n_of_bottles;

        if is_final_state_game(&current) {
            return Some(current);
        }

        let initial_entropy: i64 = measure_state_entropy(&current);
        if initial_entropy as f64 > 1.44 * min_visible_entropy as f64 {
            continue;
        }

        let mut future_states: Vec<State> = Vec::new();
        let mut future_states_entropies: Vec<(i64, i64)> = Vec::new();

        let mut position: i64 = 0;
        for i in 0..n_of_bottles {
            for j in 0..n_of_bottles {
                if i == j {
                    continue;
                }

                let amount = how_much_to_move(&current.state[i], &current.state[j], levels);

                if amount > 0 {
                    let next_state = move_liquid_state(&current, i, j, amount);
                    if visited.insert(next_state.clone()) {
                        future_states.push(next_state.clone());
                        future_states_entropies
                            .push((measure_state_entropy(&next_state), position));
                        position += 1;
                    }
                }
            }
        }
        future_states_entropies.sort();
        let prunning_factor: i64 = 2;
        let min_branches: i64 = 5;
        let future_branch_size = min(position, max(position / prunning_factor, min_branches));
        if position != 0 {
            min_visible_entropy = min(min_visible_entropy, future_states_entropies[0].0 as u64);
        }
        for i in (0..future_branch_size) {
            if future_states_entropies[i as usize].0 as f64 > 1.2 * initial_entropy as f64 {
                break;
            }
            let future_position = future_states_entropies[i as usize].1 as usize;
            queue.push_back(future_states[future_position].clone());
        }
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
