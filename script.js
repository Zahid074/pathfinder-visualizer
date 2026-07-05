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

// ===================== DOM refs =====================
const gridEl = document.getElementById('grid');
const readoutEl = document.getElementById('coord-readout');
const statStatus = document.getElementById('stat-status');
const statVisited = document.getElementById('stat-visited');
const statPath = document.getElementById('stat-path');
const statTime = document.getElementById('stat-time');

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

// ===================== Mode buttons =====================
document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
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

// ===================== Algorithms =====================
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

const ALGORITHMS = { bfs, dfs, dijkstra, astar };

// ===================== Animation =====================
function animate(visitedNodesInOrder, path, speed) {
  isVisualizing = true;
  toggleControls(false);
  const { visit, path: pathDelay } = SPEED_MS[speed];

  visitedNodesInOrder.forEach((node, i) => {
    setTimeout(() => {
      if (!node.isStart && !node.isEnd) {
        document.getElementById(`node-${node.row}-${node.col}`).classList.add('visited');
      }
      if (i === visitedNodesInOrder.length - 1) {
        setTimeout(() => drawPath(path, pathDelay), visit);
      }
    }, i * visit);
  });

  if (visitedNodesInOrder.length === 0) {
    drawPath(path, pathDelay);
  }
}

function drawPath(path, delay) {
  if (path.length === 0) {
    isVisualizing = false;
    toggleControls(true);
    return;
  }
  path.forEach((node, i) => {
    setTimeout(() => {
      if (!node.isStart && !node.isEnd) {
        document.getElementById(`node-${node.row}-${node.col}`).classList.add('path');
      }
      if (i === path.length - 1) {
        isVisualizing = false;
        toggleControls(true);
      }
    }, i * delay);
  });
}

function toggleControls(enabled) {
  document.querySelectorAll('.mode-btn, .btn-secondary, select').forEach((el) => {
    el.disabled = !enabled;
  });
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

// ===================== Visualize button =====================
document.getElementById('btn-visualize').addEventListener('click', () => {
  if (!startNode || !endNode || isVisualizing) return;
  resetSearchState();

  const algoKey = document.getElementById('algorithm-select').value;
  const speed = document.getElementById('speed-select').value;
  const algoName = document.getElementById('algorithm-select')
    .selectedOptions[0].textContent;

  const t0 = performance.now();
  const { visitedNodesInOrder, path } = ALGORITHMS[algoKey](startNode, endNode);
  const t1 = performance.now();

  updateStats({
    status: path.length > 0 ? `${algoName} found a path` : `${algoName} found no path`,
    visited: visitedNodesInOrder.length,
    path: path.length > 0 ? path.length - 1 : 0,
    time: (t1 - t0).toFixed(2),
  });

  animate(visitedNodesInOrder, path, speed);
});

// ===================== Other buttons =====================
document.getElementById('btn-clear-walls').addEventListener('click', clearWalls);
document.getElementById('btn-clear-board').addEventListener('click', clearBoard);
document.getElementById('btn-random-maze').addEventListener('click', randomMaze);

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
updateVisualizeAvailability();
