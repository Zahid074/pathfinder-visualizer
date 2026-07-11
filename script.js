// ===================== Configuration =====================
const ROWS = 16;
const COLS = 30;

const SPEED_MS = {
  fast: { visit: 6, path: 18 },
  normal: { visit: 18, path: 35 },
  slow: { visit: 45, path: 70 },
};

// ===================== State =====================
let grid = [];          // grid[row][col] = node object
let startNode = null;
let endNode = null;
let currentMode = 'start';
let isMousePressed = false;
let isVisualizing = false;

let currentProblem = 'pathfinding'; // 'pathfinding' | 'knapsack'
let isKnapsackRunning = false;

const defaultKnapsackItems = [
  { name: 'Item A', weight: 2, value: 3 },
  { name: 'Item B', weight: 3, value: 4 },
  { name: 'Item C', weight: 4, value: 5 },
  { name: 'Item D', weight: 5, value: 8 },
  { name: 'Item E', weight: 9, value: 10 },
];
let knapsackItems = defaultKnapsackItems.map((it) => ({ ...it }));

// ===================== DOM refs =====================
const gridEl = document.getElementById('grid');
const readoutEl = document.getElementById('coord-readout');
const statStatus = document.getElementById('stat-status');
const statVisited = document.getElementById('stat-visited');
const statPath = document.getElementById('stat-path');
const statTime = document.getElementById('stat-time');

const avatarEl = document.getElementById('cartoon-avatar');
const emojiEl = document.getElementById('cartoon-avatar-emoji');

// ===================== Node factory =====================
function createNode(row, col) {
  return {
    row, col,
    isStart: false,
    isEnd: false,
    isWall: false,
    isVisited: false,
    distance: Infinity,
    heuristic: 0,
    previousNode: null,
  };
}

// ===================== Grid building =====================
function buildGrid() {
  grid = [];
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${COLS}, 22px)`;
  gridEl.style.gridTemplateRows = `repeat(${ROWS}, 22px)`;

  for (let r = 0; r < ROWS; r++) {
    const rowArr = [];
    for (let c = 0; c < COLS; c++) {
      const node = createNode(r, c);
      rowArr.push(node);

      const cellEl = document.createElement('div');
      cellEl.className = 'cell';
      cellEl.id = `node-${r}-${c}`;
      cellEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isMousePressed = true;
        handleCellInteraction(r, c);
      });
      cellEl.addEventListener('mouseenter', () => {
        readoutEl.textContent = `ROW ${String(r).padStart(2, '0')} / COL ${String(c).padStart(2, '0')}`;
        if (isMousePressed) handleCellInteraction(r, c);
      });
      cellEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isMousePressed = true;
        handleCellInteraction(r, c);
      }, { passive: false });

      gridEl.appendChild(cellEl);
    }
    grid.push(rowArr);
  }

  document.addEventListener('mouseup', () => { isMousePressed = false; });
  document.addEventListener('touchend', () => { isMousePressed = false; });
  gridEl.addEventListener('touchmove', (e) => {
    if (!isMousePressed) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.classList.contains('cell')) {
      const [, r, c] = el.id.split('-').map(Number);
      handleCellInteraction(r, c);
    }
  }, { passive: false });
}

// ===================== Cell interaction =====================
function handleCellInteraction(row, col) {
  if (isVisualizing) return;
  const node = grid[row][col];

  if (currentMode === 'start') {
    if (node.isEnd || node.isWall) return;
    if (startNode) { startNode.isStart = false; renderCell(startNode); }
    node.isStart = true;
    startNode = node;
  } else if (currentMode === 'end') {
    if (node.isStart || node.isWall) return;
    if (endNode) { endNode.isEnd = false; renderCell(endNode); }
    node.isEnd = true;
    endNode = node;
  } else if (currentMode === 'wall') {
    if (node.isStart || node.isEnd) return;
    node.isWall = true;
  } else if (currentMode === 'erase') {
    if (node.isStart || node.isEnd) return;
    node.isWall = false;
  }
  renderCell(node);
  updateVisualizeAvailability();
}

function renderCell(node) {
  const el = document.getElementById(`node-${node.row}-${node.col}`);
  let cls = 'cell';
  if (node.isStart) cls += ' start';
  else if (node.isEnd) cls += ' end';
  else if (node.isWall) cls += ' wall';
  el.className = cls;
}

// ===================== Mode buttons (grid interaction) =====================
document.querySelectorAll('.grid-mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.grid-mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
  });
});

// ===================== Problem selector (Pathfinding vs Knapsack) =====================
function setProblem(problem) {
  currentProblem = problem;
  const isPath = problem === 'pathfinding';

  document.getElementById('pathfinding-controls').classList.toggle('hidden', !isPath);
  document.getElementById('knapsack-controls').classList.toggle('hidden', isPath);
  document.getElementById('pathfinding-section').style.display = isPath ? 'flex' : 'none';
  document.getElementById('stats').style.display = isPath ? 'flex' : 'none';
  document.getElementById('knapsack-section').style.display = isPath ? 'none' : 'block';

  if (!isPath) {
    avatarEl.classList.remove('active');
    readoutEl.textContent = 'ROW --- / COL ---';
  }
}

document.querySelectorAll('.problem-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isVisualizing || isKnapsackRunning) return;
    document.querySelectorAll('.problem-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    setProblem(btn.dataset.problem);
  });
});

// ===================== Reset helpers =====================
function resetSearchState() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      node.isVisited = false;
      node.distance = Infinity;
      node.heuristic = 0;
      node.previousNode = null;
      if (!node.isStart && !node.isEnd && !node.isWall) {
        document.getElementById(`node-${r}-${c}`).className = 'cell';
      }
    }
  }
  avatarEl.classList.remove('active');
  emojiEl.classList.remove('walk', 'cheer');
}

// Lightweight reset used between internal iterations (e.g. IDS) — skips DOM writes for speed.
function resetNodePropsOnly() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      node.isVisited = false;
      node.distance = Infinity;
      node.heuristic = 0;
      node.previousNode = null;
    }
  }
}

function clearWalls() {
  if (isVisualizing) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r][c].isWall = false;
    }
  }
  resetSearchState();
  updateVisualizeAvailability();
}

function clearBoard() {
  if (isVisualizing) return;
  startNode = null;
  endNode = null;
  buildGrid();
  updateStats({ status: 'Place a start and target cell', visited: 0, path: 0, time: 0 });
  updateVisualizeAvailability();
}

function randomMaze() {
  if (isVisualizing) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const node = grid[r][c];
      if (node.isStart || node.isEnd) continue;
      node.isWall = Math.random() < 0.26;
      renderCell(node);
    }
  }
  resetSearchState();
  updateVisualizeAvailability();
}

// ===================== Neighbors =====================
function getNeighbors(node) {
  const { row, col } = node;
  const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const neighbors = [];
  for (const [dr, dc] of deltas) {
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid[r][c].isWall) {
      neighbors.push(grid[r][c]);
    }
  }
  return neighbors;
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function getPath(endNode) {
  const path = [];
  let current = endNode;
  while (current !== null) {
    path.unshift(current);
    current = current.previousNode;
  }
  return path;
}

// ===================== Uninformed search algorithms =====================
function bfs(start, end) {
  const visitedNodesInOrder = [];
  const queue = [start];
  start.isVisited = true;
  while (queue.length) {
    const current = queue.shift();
    visitedNodesInOrder.push(current);
    if (current === end) return { visitedNodesInOrder, path: getPath(end) };
    for (const neighbor of getNeighbors(current)) {
      if (!neighbor.isVisited) {
        neighbor.isVisited = true;
        neighbor.previousNode = current;
        queue.push(neighbor);
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

function dfs(start, end) {
  const visitedNodesInOrder = [];
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    if (current.isVisited) continue;
    current.isVisited = true;
    visitedNodesInOrder.push(current);
    if (current === end) return { visitedNodesInOrder, path: getPath(end) };
    for (const neighbor of getNeighbors(current)) {
      if (!neighbor.isVisited) {
        neighbor.previousNode = current;
        stack.push(neighbor);
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

// Depth-Limited Search — DFS that refuses to expand past `limit` steps from start.
function dls(start, end, limit) {
  const visitedNodesInOrder = [];
  const visited = new Set();
  const stack = [[start, 0]];
  while (stack.length) {
    const [current, depth] = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    current.isVisited = true;
    visitedNodesInOrder.push(current);
    if (current === end) return { visitedNodesInOrder, path: getPath(end) };
    if (depth >= limit) continue;
    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(neighbor)) {
        neighbor.previousNode = current;
        stack.push([neighbor, depth + 1]);
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

// Iterative Deepening Search — reruns DLS with increasing limits until a path is found.
function ids(start, end, maxLimit) {
  let totalVisited = 0;
  let iterations = 0;
  for (let limit = 0; limit <= maxLimit; limit++) {
    resetNodePropsOnly();
    iterations++;
    const result = dls(start, end, limit);
    totalVisited += result.visitedNodesInOrder.length;
    if (result.path.length > 0) {
      return {
        visitedNodesInOrder: result.visitedNodesInOrder,
        path: result.path,
        meta: { totalVisited, iterations },
      };
    }
  }
  resetNodePropsOnly();
  return { visitedNodesInOrder: [], path: [], meta: { totalVisited, iterations } };
}

// Bidirectional Search — two BFS waves (from start and from target) expanding until they meet.
function bidirectional(start, end) {
  if (start === end) {
    start.isVisited = true;
    return { visitedNodesInOrder: [start], path: [start], sides: [{ node: start, side: 'a' }] };
  }

  const sides = []; // {node, side} in visitation order, for two-tone animation
  const visitedA = new Set([start]);
  const visitedB = new Set([end]);
  const prevA = new Map();
  const prevB = new Map();
  let queueA = [start];
  let queueB = [end];

  start.isVisited = true;
  end.isVisited = true;
  sides.push({ node: start, side: 'a' });
  sides.push({ node: end, side: 'b' });

  let meet = null;

  while (queueA.length && queueB.length && !meet) {
    // Expand one layer from the start side
    const newQueueA = [];
    for (const current of queueA) {
      for (const neighbor of getNeighbors(current)) {
        if (visitedB.has(neighbor)) { meet = neighbor; prevA.set(neighbor, current); break; }
        if (!visitedA.has(neighbor)) {
          visitedA.add(neighbor);
          neighbor.isVisited = true;
          prevA.set(neighbor, current);
          sides.push({ node: neighbor, side: 'a' });
          newQueueA.push(neighbor);
        }
      }
      if (meet) break;
    }
    queueA = newQueueA;
    if (meet) break;

    // Expand one layer from the target side
    const newQueueB = [];
    for (const current of queueB) {
      for (const neighbor of getNeighbors(current)) {
        if (visitedA.has(neighbor)) { meet = neighbor; prevB.set(neighbor, current); break; }
        if (!visitedB.has(neighbor)) {
          visitedB.add(neighbor);
          neighbor.isVisited = true;
          prevB.set(neighbor, current);
          sides.push({ node: neighbor, side: 'b' });
          newQueueB.push(neighbor);
        }
      }
      if (meet) break;
    }
    queueB = newQueueB;
  }

  if (!meet) {
    return { visitedNodesInOrder: sides.map((s) => s.node), path: [], sides };
  }

  // Reconstruct start -> meet using prevA
  const startToMeet = [];
  let node = meet;
  while (node !== undefined && node !== start) {
    startToMeet.unshift(node);
    node = prevA.get(node);
  }
  startToMeet.unshift(start);

  // Reconstruct meet -> end using prevB
  const meetToEnd = [];
  node = prevB.get(meet);
  while (node !== undefined && node !== end) {
    meetToEnd.push(node);
    node = prevB.get(node);
  }
  meetToEnd.push(end);

  const fullPath = [...startToMeet, ...meetToEnd];
  return { visitedNodesInOrder: sides.map((s) => s.node), path: fullPath, sides };
}

// ===================== Informed (heuristic) search algorithms =====================
function dijkstra(start, end) {
  const visitedNodesInOrder = [];
  const unvisited = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!grid[r][c].isWall) unvisited.push(grid[r][c]);
    }
  }
  start.distance = 0;

  while (unvisited.length) {
    unvisited.sort((a, b) => a.distance - b.distance);
    const closest = unvisited.shift();
    if (closest.distance === Infinity) break;
    closest.isVisited = true;
    visitedNodesInOrder.push(closest);
    if (closest === end) return { visitedNodesInOrder, path: getPath(end) };

    for (const neighbor of getNeighbors(closest)) {
      const newDist = closest.distance + 1;
      if (newDist < neighbor.distance) {
        neighbor.distance = newDist;
        neighbor.previousNode = closest;
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

function astar(start, end) {
  const visitedNodesInOrder = [];
  const open = [start];
  start.distance = 0;
  start.heuristic = manhattan(start, end);

  while (open.length) {
    open.sort((a, b) => (a.distance + a.heuristic) - (b.distance + b.heuristic));
    const current = open.shift();
    if (current.isVisited) continue;
    current.isVisited = true;
    visitedNodesInOrder.push(current);
    if (current === end) return { visitedNodesInOrder, path: getPath(end) };

    for (const neighbor of getNeighbors(current)) {
      const newDist = current.distance + 1;
      if (newDist < neighbor.distance) {
        neighbor.distance = newDist;
        neighbor.heuristic = manhattan(neighbor, end);
        neighbor.previousNode = current;
        open.push(neighbor);
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

// Greedy Best-First Search — expands purely by heuristic distance to target, no path-cost tracking.
function greedyBestFirst(start, end) {
  const visitedNodesInOrder = [];
  const open = [start];
  const visited = new Set();
  start.heuristic = manhattan(start, end);

  while (open.length) {
    open.sort((a, b) => a.heuristic - b.heuristic);
    const current = open.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    current.isVisited = true;
    visitedNodesInOrder.push(current);
    if (current === end) return { visitedNodesInOrder, path: getPath(end) };

    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(neighbor)) {
        neighbor.heuristic = manhattan(neighbor, end);
        neighbor.previousNode = current;
        open.push(neighbor);
      }
    }
  }
  return { visitedNodesInOrder, path: [] };
}

// Hill Climbing — always steps to the single best unvisited neighbor; can get stuck at a local optimum.
function hillClimbing(start, end) {
  const visitedNodesInOrder = [];
  const visited = new Set([start]);
  let current = start;
  current.isVisited = true;
  visitedNodesInOrder.push(current);

  while (current !== end) {
    const neighbors = getNeighbors(current).filter((n) => !visited.has(n));
    if (neighbors.length === 0) {
      return { visitedNodesInOrder, path: [], stuck: true };
    }
    neighbors.forEach((n) => { n.heuristic = manhattan(n, end); });
    neighbors.sort((a, b) => a.heuristic - b.heuristic);
    const best = neighbors[0];

    if (best.heuristic >= manhattan(current, end)) {
      // No neighbor improves on the current cell — local optimum reached.
      return { visitedNodesInOrder, path: [], stuck: true };
    }

    best.previousNode = current;
    current = best;
    current.isVisited = true;
    visited.add(current);
    visitedNodesInOrder.push(current);
  }
  return { visitedNodesInOrder, path: getPath(end), stuck: false };
}

// Beam Search — keeps only the k most promising cells at each layer (bonus algorithm).
function beamSearch(start, end, beamWidth = 3) {
  const visitedNodesInOrder = [];
  const visited = new Set([start]);
  start.heuristic = manhattan(start, end);
  start.isVisited = true;
  visitedNodesInOrder.push(start);

  let beam = [start];
  while (beam.length) {
    let candidates = [];
    for (const node of beam) {
      if (node === end) return { visitedNodesInOrder, path: getPath(end) };
      for (const neighbor of getNeighbors(node)) {
        if (!visited.has(neighbor)) {
          neighbor.heuristic = manhattan(neighbor, end);
          neighbor.previousNode = node;
          candidates.push(neighbor);
        }
      }
    }
    const uniqueCandidates = Array.from(new Set(candidates));
    uniqueCandidates.sort((a, b) => a.heuristic - b.heuristic);
    beam = uniqueCandidates.slice(0, beamWidth);
    beam.forEach((n) => {
      if (!visited.has(n)) {
        visited.add(n);
        n.isVisited = true;
        visitedNodesInOrder.push(n);
      }
    });
  }
  return { visitedNodesInOrder, path: [] };
}

// ===================== Algorithm dispatcher =====================
function runSelectedAlgorithm(algoKey, start, end) {
  switch (algoKey) {
    case 'bfs': return bfs(start, end);
    case 'dfs': return dfs(start, end);
    case 'dijkstra': return dijkstra(start, end);
    case 'astar': return astar(start, end);
    case 'greedy': return greedyBestFirst(start, end);
    case 'hillclimbing': return hillClimbing(start, end);
    case 'beam': return beamSearch(start, end, 3);
    case 'bidirectional': return bidirectional(start, end);
    case 'dls': {
      const limit = parseInt(document.getElementById('depth-limit-input').value, 10) || 12;
      return dls(start, end, limit);
    }
    case 'ids': {
      const maxLimit = parseInt(document.getElementById('depth-limit-input').value, 10) || 12;
      return ids(start, end, maxLimit);
    }
    default: return bfs(start, end);
  }
}

// ===================== Cartoon avatar helper =====================
function moveAvatarToNode(node) {
  const cellEl = document.getElementById(`node-${node.row}-${node.col}`);
  const wrapRect = document.getElementById('pathfinding-section').getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  const x = cellRect.left - wrapRect.left + cellRect.width / 2;
  const y = cellRect.top - wrapRect.top + cellRect.height / 2;
  avatarEl.style.transform = `translate(${x}px, ${y}px)`;
}

// ===================== Animation =====================
function animate(result, algoKey, speed) {
  isVisualizing = true;
  toggleControls(false);
  const { visit, path: pathDelay } = SPEED_MS[speed];
  const path = result.path || [];
  const cartoonOn = document.getElementById('toggle-cartoon').checked;

  if (cartoonOn) {
    avatarEl.classList.add('active');
    emojiEl.textContent = '🤖';
    emojiEl.classList.remove('cheer');
    emojiEl.classList.add('walk');
  }

  const sequence = (algoKey === 'bidirectional' && result.sides)
    ? result.sides
    : result.visitedNodesInOrder.map((n) => ({ node: n, side: 'a' }));

  sequence.forEach((entry, i) => {
    const node = entry.node;
    setTimeout(() => {
      if (!node.isStart && !node.isEnd) {
        const cls = entry.side === 'b' ? 'visited-b' : 'visited';
        document.getElementById(`node-${node.row}-${node.col}`).classList.add(cls);
      }
      if (cartoonOn) moveAvatarToNode(node);
      if (i === sequence.length - 1) {
        setTimeout(() => drawPath(path, pathDelay, cartoonOn), visit);
      }
    }, i * visit);
  });

  if (sequence.length === 0) {
    drawPath(path, pathDelay, cartoonOn);
  }
}

function drawPath(path, delay, cartoonOn) {
  if (path.length === 0) {
    if (cartoonOn) {
      emojiEl.classList.remove('walk');
      emojiEl.textContent = '😵';
    }
    isVisualizing = false;
    toggleControls(true);
    return;
  }
  path.forEach((node, i) => {
    setTimeout(() => {
      if (!node.isStart && !node.isEnd) {
        document.getElementById(`node-${node.row}-${node.col}`).classList.add('path');
      }
      if (cartoonOn) moveAvatarToNode(node);
      if (i === path.length - 1) {
        if (cartoonOn) {
          emojiEl.classList.remove('walk');
          emojiEl.textContent = '🎉';
          emojiEl.classList.add('cheer');
        }
        isVisualizing = false;
        toggleControls(true);
      }
    }, i * delay);
  });
}

function toggleControls(enabled) {
  document.querySelectorAll('#pathfinding-controls .mode-btn, #pathfinding-controls .btn-secondary, #pathfinding-controls select, #pathfinding-controls input').forEach((el) => {
    el.disabled = !enabled;
  });
  document.querySelectorAll('.problem-btn').forEach((el) => { el.disabled = !enabled; });
  document.getElementById('btn-visualize').disabled = !enabled;
}

// ===================== Stats =====================
function updateStats({ status, visited, path, time }) {
  if (status !== undefined) statStatus.textContent = status;
  if (visited !== undefined) statVisited.textContent = visited;
  if (path !== undefined) statPath.textContent = path;
  if (time !== undefined) statTime.textContent = `${time} ms`;
}

function updateVisualizeAvailability() {
  document.getElementById('btn-visualize').disabled = !(startNode && endNode) || isVisualizing;
}

// ===================== Algorithm select behaviour =====================
document.getElementById('algorithm-select').addEventListener('change', (e) => {
  const val = e.target.value;
  const group = document.getElementById('depth-limit-group');
  const label = document.getElementById('depth-limit-label');
  if (val === 'dls') {
    group.style.display = 'flex';
    label.textContent = 'Depth Limit';
  } else if (val === 'ids') {
    group.style.display = 'flex';
    label.textContent = 'Max Depth';
  } else {
    group.style.display = 'none';
  }
});

// ===================== Visualize button =====================
document.getElementById('btn-visualize').addEventListener('click', () => {
  if (!startNode || !endNode || isVisualizing) return;
  resetSearchState();

  const algoKey = document.getElementById('algorithm-select').value;
  const speed = document.getElementById('speed-select').value;
  const algoName = document.getElementById('algorithm-select').selectedOptions[0].textContent;

  const t0 = performance.now();
  const result = runSelectedAlgorithm(algoKey, startNode, endNode);
  const t1 = performance.now();

  const path = result.path || [];
  let statusText;
  if (result.stuck) {
    statusText = `${algoName} got stuck at a local optimum — no path found`;
  } else if (path.length > 0) {
    statusText = `${algoName} found a path`;
    if (result.meta) statusText += ` (${result.meta.iterations} depth-iterations, ${result.meta.totalVisited} total visits)`;
  } else {
    statusText = `${algoName} found no path`;
  }

  updateStats({
    status: statusText,
    visited: result.meta ? result.meta.totalVisited : result.visitedNodesInOrder.length,
    path: path.length > 0 ? path.length - 1 : 0,
    time: (t1 - t0).toFixed(2),
  });

  animate(result, algoKey, speed);
});

// ===================== Other pathfinding buttons =====================
document.getElementById('btn-clear-walls').addEventListener('click', clearWalls);
document.getElementById('btn-clear-board').addEventListener('click', clearBoard);
document.getElementById('btn-random-maze').addEventListener('click', randomMaze);

// ============================================================
// ===================== 0/1 Knapsack module ==================
// ============================================================

function renderItemsTable() {
  const tbody = document.getElementById('items-tbody');
  tbody.innerHTML = '';
  knapsackItems.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="item-name-input" data-idx="${idx}" value="${item.name}" /></td>
      <td><input type="number" class="item-weight-input" data-idx="${idx}" min="1" max="50" value="${item.weight}" /></td>
      <td><input type="number" class="item-value-input" data-idx="${idx}" min="1" max="999" value="${item.value}" /></td>
      <td><button class="item-remove-btn" data-idx="${idx}" title="Remove item">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.item-name-input').forEach((inp) => inp.addEventListener('input', (e) => {
    knapsackItems[+e.target.dataset.idx].name = e.target.value || `Item ${+e.target.dataset.idx + 1}`;
  }));
  tbody.querySelectorAll('.item-weight-input').forEach((inp) => inp.addEventListener('input', (e) => {
    knapsackItems[+e.target.dataset.idx].weight = Math.max(1, parseInt(e.target.value, 10) || 1);
  }));
  tbody.querySelectorAll('.item-value-input').forEach((inp) => inp.addEventListener('input', (e) => {
    knapsackItems[+e.target.dataset.idx].value = Math.max(1, parseInt(e.target.value, 10) || 1);
  }));
  tbody.querySelectorAll('.item-remove-btn').forEach((btn) => btn.addEventListener('click', (e) => {
    if (knapsackItems.length <= 1) return;
    knapsackItems.splice(+e.target.dataset.idx, 1);
    renderItemsTable();
  }));
}

document.getElementById('btn-knapsack-add-item').addEventListener('click', () => {
  if (knapsackItems.length >= 10) return;
  knapsackItems.push({ name: `Item ${knapsackItems.length + 1}`, weight: 2, value: 3 });
  renderItemsTable();
});

document.getElementById('btn-knapsack-reset').addEventListener('click', () => {
  if (isKnapsackRunning) return;
  knapsackItems = defaultKnapsackItems.map((it) => ({ ...it }));
  renderItemsTable();
});

document.getElementById('knapsack-algo-select').addEventListener('change', (e) => {
  document.getElementById('ga-params-group').style.display = e.target.value === 'ga' ? 'flex' : 'none';
});

// ----- 0/1 Knapsack via Dynamic Programming -----
function knapsackDP(items, capacity) {
  const n = items.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  const steps = []; // {i, w, val} in the order cells get computed, for animation

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= capacity; w++) {
      const { weight, value } = items[i - 1];
      if (weight <= w) {
        const without = dp[i - 1][w];
        const withItem = dp[i - 1][w - weight] + value;
        dp[i][w] = Math.max(without, withItem);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
      steps.push({ i, w, val: dp[i][w] });
    }
  }

  let w = capacity;
  const chosen = [];
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      chosen.push(items[i - 1]);
      w -= items[i - 1].weight;
    }
  }
  chosen.reverse();

  return { dp, steps, chosen, maxValue: dp[n][capacity] };
}

function animateKnapsackDP(items, capacity, dp, steps, chosen, onDone) {
  const wrap = document.getElementById('knapsack-dp-wrap');
  const n = items.length;

  const table = document.createElement('table');
  table.className = 'dp-table';

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>Item \\ Cap</th>' +
    Array.from({ length: capacity + 1 }, (_, w) => `<th>${w}</th>`).join('');
  table.appendChild(headRow);

  for (let i = 0; i <= n; i++) {
    const tr = document.createElement('tr');
    const label = i === 0 ? '∅' : `${items[i - 1].name} (w${items[i - 1].weight}/v${items[i - 1].value})`;
    tr.innerHTML = `<th class="dp-row-label">${label}</th>` +
      Array.from({ length: capacity + 1 }, (_, w) => `<td id="dp-cell-${i}-${w}" class="dp-cell">${i === 0 ? 0 : '·'}</td>`).join('');
    table.appendChild(tr);
  }
  wrap.appendChild(table);

  const stepDelay = steps.length > 300 ? 2 : steps.length > 120 ? 6 : 14;

  steps.forEach((step, idx) => {
    setTimeout(() => {
      const cell = document.getElementById(`dp-cell-${step.i}-${step.w}`);
      if (cell) {
        cell.textContent = step.val;
        cell.classList.add('computing');
        setTimeout(() => cell.classList.remove('computing'), stepDelay * 2);
      }
      if (idx === steps.length - 1) {
        setTimeout(highlightBacktrack, stepDelay * 3);
      }
    }, idx * stepDelay);
  });

  if (steps.length === 0) highlightBacktrack();

  function highlightBacktrack() {
    let w = capacity;
    for (let i = n; i > 0; i--) {
      const cell = document.getElementById(`dp-cell-${i}-${w}`);
      if (cell) cell.classList.add('dp-path-cell');
      if (dp[i][w] !== dp[i - 1][w]) {
        w -= items[i - 1].weight;
      }
    }
    const cell0 = document.getElementById(`dp-cell-0-${w}`);
    if (cell0) cell0.classList.add('dp-path-cell');

    const summary = document.createElement('div');
    summary.className = 'knapsack-chosen-summary';
    summary.textContent = chosen.length
      ? `Chosen: ${chosen.map((it) => it.name).join(', ')}`
      : 'No items fit inside the capacity.';
    wrap.appendChild(summary);

    onDone();
  }
}

// ----- 0/1 Knapsack via Genetic Algorithm -----
function knapsackGA(items, capacity, { populationSize, generations, mutationRate }) {
  const n = items.length;

  function randomChromosome() {
    return Array.from({ length: n }, () => (Math.random() < 0.5 ? 1 : 0));
  }
  function fitness(chromo) {
    let totalW = 0, totalV = 0;
    chromo.forEach((bit, idx) => {
      if (bit) { totalW += items[idx].weight; totalV += items[idx].value; }
    });
    return totalW > capacity ? 0 : totalV;
  }
  function tournamentSelect(pop, fits) {
    const a = Math.floor(Math.random() * pop.length);
    const b = Math.floor(Math.random() * pop.length);
    return fits[a] > fits[b] ? pop[a] : pop[b];
  }
  function crossover(p1, p2) {
    if (n <= 1) return p1.slice();
    const point = 1 + Math.floor(Math.random() * (n - 1));
    return [...p1.slice(0, point), ...p2.slice(point)];
  }
  function mutate(chromo) {
    return chromo.map((bit) => (Math.random() < mutationRate ? 1 - bit : bit));
  }

  let population = Array.from({ length: populationSize }, randomChromosome);
  const genLog = [];
  let best = population[0].slice();
  let bestFit = fitness(best);

  for (let gen = 0; gen < generations; gen++) {
    const fits = population.map(fitness);
    fits.forEach((f, idx) => {
      if (f > bestFit) { bestFit = f; best = population[idx].slice(); }
    });
    const avgFit = fits.reduce((a, b) => a + b, 0) / fits.length;
    genLog.push({ gen: gen + 1, best: bestFit, avg: avgFit.toFixed(1) });

    const newPop = [best.slice()]; // elitism
    while (newPop.length < populationSize) {
      const parentA = tournamentSelect(population, fits);
      const parentB = tournamentSelect(population, fits);
      newPop.push(mutate(crossover(parentA, parentB)));
    }
    population = newPop;
  }

  const chosen = items.filter((_, idx) => best[idx] === 1);
  const totalWeight = chosen.reduce((s, it) => s + it.weight, 0);
  return { genLog, chosen, maxValue: bestFit, totalWeight };
}

function animateKnapsackGA(genLog, chosen, onDone) {
  const wrap = document.getElementById('knapsack-ga-wrap');
  const table = document.createElement('table');
  table.className = 'ga-table';
  table.innerHTML = '<tr><th>Generation</th><th>Best Value</th><th>Avg Value</th></tr>';
  wrap.appendChild(table);

  if (genLog.length === 0) { onDone(); return; }

  const delay = genLog.length > 60 ? 15 : 40;

  genLog.forEach((row, idx) => {
    setTimeout(() => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.gen}</td><td>${row.best}</td><td>${row.avg}</td>`;
      table.appendChild(tr);
      wrap.scrollTop = wrap.scrollHeight;

      if (idx === genLog.length - 1) {
        const summary = document.createElement('div');
        summary.className = 'knapsack-chosen-summary';
        summary.textContent = chosen.length
          ? `Best chromosome selects: ${chosen.map((it) => it.name).join(', ')}`
          : 'No items fit inside the capacity.';
        wrap.appendChild(summary);
        onDone();
      }
    }, idx * delay);
  });
}

function updateKnapsackStats({ status, value, weight, time }) {
  if (status !== undefined) document.getElementById('k-stat-status').textContent = status;
  if (value !== undefined) document.getElementById('k-stat-value').textContent = value;
  if (weight !== undefined) document.getElementById('k-stat-weight').textContent = weight;
  if (time !== undefined) document.getElementById('k-stat-time').textContent = `${time} ms`;
}

function toggleKnapsackControls(enabled) {
  document.querySelectorAll('#knapsack-controls input, #knapsack-controls select, #knapsack-controls button, #items-tbody input, #items-tbody button').forEach((el) => {
    el.disabled = !enabled;
  });
  document.querySelectorAll('.problem-btn').forEach((el) => { el.disabled = !enabled; });
}

document.getElementById('btn-knapsack-run').addEventListener('click', () => {
  if (isKnapsackRunning) return;

  const capacity = Math.max(1, parseInt(document.getElementById('knapsack-capacity-input').value, 10) || 15);
  const algo = document.getElementById('knapsack-algo-select').value;
  const items = knapsackItems.map((it) => ({ ...it }));

  document.getElementById('knapsack-dp-wrap').innerHTML = '';
  document.getElementById('knapsack-ga-wrap').innerHTML = '';
  isKnapsackRunning = true;
  toggleKnapsackControls(false);
  updateKnapsackStats({ status: 'Running…', value: 0, weight: 0, time: 0 });

  const t0 = performance.now();

  if (algo === 'dp') {
    const { dp, steps, chosen, maxValue } = knapsackDP(items, capacity);
    const t1 = performance.now();
    animateKnapsackDP(items, capacity, dp, steps, chosen, () => {
      const totalWeight = chosen.reduce((s, it) => s + it.weight, 0);
      updateKnapsackStats({
        status: `DP found the optimal selection (${chosen.length} item${chosen.length === 1 ? '' : 's'})`,
        value: maxValue,
        weight: totalWeight,
        time: (t1 - t0).toFixed(2),
      });
      isKnapsackRunning = false;
      toggleKnapsackControls(true);
    });
  } else {
    const populationSize = Math.max(4, parseInt(document.getElementById('ga-population-input').value, 10) || 20);
    const generations = Math.max(1, parseInt(document.getElementById('ga-generations-input').value, 10) || 40);
    const mutationRate = Math.min(1, Math.max(0, parseFloat(document.getElementById('ga-mutation-input').value)) || 0.05);

    const { genLog, chosen, maxValue, totalWeight } = knapsackGA(items, capacity, { populationSize, generations, mutationRate });
    const t1 = performance.now();
    animateKnapsackGA(genLog, chosen, () => {
      updateKnapsackStats({
        status: `GA converged on a selection (${chosen.length} item${chosen.length === 1 ? '' : 's'})`,
        value: maxValue,
        weight: totalWeight,
        time: (t1 - t0).toFixed(2),
      });
      isKnapsackRunning = false;
      toggleKnapsackControls(true);
    });
  }
});

// ===================== Info modal =====================
const infoModal = document.getElementById('info-modal');
document.getElementById('btn-info-open').addEventListener('click', () => infoModal.classList.add('open'));
document.getElementById('btn-info-close').addEventListener('click', () => infoModal.classList.remove('open'));
infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) infoModal.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') infoModal.classList.remove('open');
});

// ===================== Init =====================
buildGrid();
renderItemsTable();
updateVisualizeAvailability();
setProblem('pathfinding');
