# Pathfinder — Grid Search Visualizer

An interactive grid where classic pathfinding algorithms — BFS, DFS, Dijkstra, and A* — 
can be watched exploring space step by step, from a start node to a target node.

🔗 **Live demo:** https://zahid074.github.io/pathfinder-visualizer/

## Features

- Place start and target nodes on a grid
- Draw or erase walls (obstacles) by clicking and dragging
- Choose between four search algorithms:
  - Breadth-First Search (BFS)
  - Depth-First Search (DFS)
  - Dijkstra's Algorithm
  - A* Search
- Adjustable animation speed
- Random wall generator
- Live stats: cells visited, path length, run time
- Built-in info panel explaining how each algorithm works

## Tech stack

Pure HTML, CSS, and vanilla JavaScript — no frameworks, no build tools, no dependencies.

## Files

- `index.html` — page structure and info modal
- `style.css` — visual styling and animations
- `script.js` — grid logic, search algorithms, and UI event handling

## How to use

1. Select a mode (Start / Target / Wall / Erase) from the controls
2. Click on the grid to place the start point, target point, and any walls
3. Pick an algorithm and a speed
4. Click **Visualize** to watch the search run
5. Use **Clear Walls** or **Reset Board** to start over

## Why this project

Built to visualize the search algorithms (BFS, DFS, Dijkstra, A*) commonly covered in 
introductory AI coursework — making the trade-offs between speed, memory, and 
path optimality visible instead of abstract.

## Author

Zahid — CSE, East West University
