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

import BGI from 'BGI.js';


function RIPtermJS (args) {

  // public properties
  if (typeof args === 'undefined') args = {};

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');
  const bgi = new BGI(ctx);


  // test
  bgi.setcolor(BGI.YELLOW);
  bgi.line(10, 10, 100, 100);

  bgi.refresh();

  return args;
}
RIPtermJS();
