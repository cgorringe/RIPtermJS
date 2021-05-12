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

//import * as BGI from './BGI.js';
import BGI from './BGI.js';


function mainRIP (args) {

  // public properties
  if (typeof args === 'undefined') args = {};

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');

  // tests
  //console.log(ctx);
  console.log(BGI);
  //console.log(BGI.YELLOW);

  //const bgi = new BGI.default(ctx);
  const bgi = new BGI(ctx);
  console.log(bgi);
  //console.log(BGI.LIGHTRED);

  // test
  bgi.setcolor(BGI.YELLOW);
  bgi.line(10, 10, 100, 100);
  bgi.setcolor(BGI.LIGHTRED);
  bgi.circle(100, 100, 50);

  bgi.refresh();

  return args;
}

mainRIP({ canvasId: 'rip-canvas' });
