/**
 * RIPtermJS - Version 3
 * Copyright (c) 2021 Carl Gorringe 
 * https://carl.gorringe.org
 * https://github.com/cgorringe/RIPtermJS
 *
 * v3: 5/11/2021
 *
 * Renders RIPscrip v1.54 .RIP files in an HTML canvas or SVG.
 * (work in progress)
 **/

// import BGI from './BGI.js'; // uncomment to use modules

////////////////////////////////////////////////////////////////////////////////
// TEST function

function mainRIP (args) {

  // public properties
  if (typeof args === 'undefined') args = {};

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');
  const bgi = new BGI(ctx);

  // drawing test
  bgi.setcolor(BGI.YELLOW);
  bgi.line(10, 10, 100, 100);

  bgi.setcolor(BGI.LIGHTRED);
  bgi.circle(100, 100, 50);

  bgi.setcolor(BGI.LIGHTBLUE);
  bgi.setfillstyle(BGI.SLASH_FILL, BGI.BLUE);
  bgi.bar3d(200, 200, 300, 300, 20, true);

  bgi.refresh();

  return args;
}
// mainRIP({ canvasId: 'rip-canvas' });


////////////////////////////////////////////////////////////////////////////////
// Main Class

function RIPtermJS (args) {

  // public properties
  if (typeof args === 'undefined') args = {};

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');
  const bgi = new BGI(ctx);


  return args;
}

