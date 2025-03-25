import React from 'react';
import Graph from './Graph';
import './index.css';

function App() {
  return (
    <div className="app-container">
      <div className="graph-container">
        <h1 className="graph-title">知识图谱</h1>
        <div className="graph-content">
          <Graph />
        </div>
      </div>
    </div>
  );
}

export default App;
