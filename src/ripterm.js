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

function testBGI (args) {

  if (!(args && ('canvasId' in args))) {
    console.error('missing canvasId!');
    return;
  }

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');
  const bgi = new BGI({ ctx, fontsPath:'fonts' });

  // drawing test
  bgi.setcolor(BGI.YELLOW);
  bgi.line(10, 10, 100, 100);

  bgi.setcolor(BGI.LIGHTRED);
  bgi.circle(100, 100, 50);

  bgi.setcolor(BGI.LIGHTBLUE);
  bgi.setfillstyle(BGI.SLASH_FILL, BGI.BLUE);
  bgi.bar3d(200, 200, 300, 300, 20, true);

  bgi.refresh();

  // TEST Fonts

  // SANS.CHR not using correct chars!
  // "!#ABCDE" = "02PQRST" using SANS.CHR
/*
  const fontname = 'BOLD.CHR';
  bgi.fetchFont(fontname);

  // add delay so font can load
  setTimeout(() => {
    console.log('Starting to draw font...');

    bgi.setcolor(BGI.LIGHTGREEN);
    bgi.moveto(100, 200);

    bgi.drawChar(33, fontname, 1, 0); // 33='!'
    bgi.drawChar(35, fontname, 1, 0); // 35='#' (bug)
    bgi.drawChar(65, fontname, 2, 0); // 65='A'
    bgi.drawChar(66, fontname, 2, 0); // 66='B'
    bgi.drawChar(67, fontname, 3, 0); // 67='C'
    bgi.drawChar(68, fontname, 3, 0); // 68='D'
    bgi.drawChar(69, fontname, 4, 0); // 69='E'

    bgi.refresh();

  }, 1000);
*/

}


////////////////////////////////////////////////////////////////////////////////
// Main Class

// html ids that may be set:
//   opts.canvasId  - main canvas (REQUIRED)
//   opts.svgId     - draw to an SVG tag (experimental)
//   opts.commandsId - show list of rip commands in div
//   opts.counterId - show command counter in div (e.g. '5 / 100')
//   opts.ssId      - screenshot canvas id
//   opts.diffId    - canvas id to display diff of main & screenshot canvases
//   opts.logId     - div id to display a debug log

class RIPterm {

  // class constants
  static get paletteEGA16 () { return [
    '#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#a50', '#aaa',
    '#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'
  ]; }

  static get paletteEGA64 () { return [
    '#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#aa0', '#aaa',
    '#005', '#00f', '#0a5', '#0af', '#a05', '#a0f', '#aa5', '#aaf',
    '#050', '#05a', '#0f0', '#0fa', '#a50', '#a5a', '#af0', '#afa',
    '#055', '#05f', '#0f5', '#0ff', '#a55', '#a5f', '#af5', '#aff',
    '#500', '#50a', '#5a0', '#5aa', '#f00', '#f0a', '#fa0', '#faa',
    '#505', '#50f', '#5a5', '#5af', '#f05', '#f0f', '#fa5', '#faf',
    '#550', '#55a', '#5f0', '#5fa', '#f50', '#f5a', '#ff0', '#ffa',
    '#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'
  ]; }

  ////////////////////////////////////////////////////////////////////////////////

  constructor (opts) {

    if (opts && ('canvasId' in opts)) {

      // init default options
      this.opts = {
        'timeInterval' : 1,      // time between running commands (in miliseconds)
        'refreshInterval' : 100, // time between display refreshes (in miliseconds)
        'pauseOn' : [],          // debug: pauses on RIP command, e.g. ['F'] will pause on Flood Fill.
        'diffFGcolor' : '#C86',  // forground color for diff pixels that don't match.
        'diffBGcolor' : '#222',  // background color for diff pixels that match.
        'svgPrefix' : 'rip',     // used to prefix internal SVG ids
        'logQuiet' : false,      // set to true to stop logging to console
        'fontsPath' : 'fonts',
        'iconsPath' : 'icons',

        // these options copied from prior version are not implemented yet.
        'floodFill' : true,
        'debugVerbose' : false,  // verbose flag
        'debugFillBuf' : false,  // display flood-fill buffer in canvas instead of normal drawings.
        'svgIncludePut' : false, // adds RIP_PUT_IMAGE (1P) to SVG (experimental)
      };

      // assign or overwrite opts with passed-in options
      Object.entries(opts).forEach( ([k, v]) => { this.opts[k] = v } );

      // init other vars
      // these copied from v2 and may change
      this.ripData = [];
      this.cmdi = 0;
      this.cmdTimer = null; // commands interval timer
      this.refTimer = null; // refresh interval timer
      this.clipboard = {};  // { x:int, y:int, width:int, height:int, data:Uint8ClampedArray }

      // debug options
      this.commandsDiv = ('commandsId' in opts) ? document.getElementById(opts.commandsId) : null;
      this.counterDiv = ('counterId' in opts) ? document.getElementById(opts.counterId) : null;
      this.logDiv = ('logId' in opts) ? document.getElementById(opts.logId) : null;
      if ('ssId' in opts) {
        this.canvasSS = document.getElementById(opts.ssId);
        this.ctxSS = (this.canvasSS && this.canvasSS.getContext) ? this.canvasSS.getContext('2d') : null;
      }
      if ('diffId' in opts) {
        this.canvasDiff = document.getElementById(opts.diffId);
        this.ctxDiff = (this.canvasDiff && this.canvasDiff.getContext) ? this.canvasDiff.getContext('2d') : null;
      }

      // init canvas
      this.canvas = document.getElementById(opts.canvasId);
      this.ctx = this.canvas.getContext('2d');

      this.isRunning = false;
      this.isFullscreen = false;
      this.backup = {};
      this.initFullScreen(this.canvas);

      // init BGI & SVG
      this.svg = ('svgId' in opts) ? document.getElementById(opts.svgId) : null;
      if (typeof BGI === 'undefined') {
        this.log('err', 'BGI() missing! Need to load BGI.js!');
      }
      else if (this.svg && (typeof BGIsvg === 'undefined')) {
        this.log('err', 'BGIsvg() missing! Need to load BGIsvg.js after BGI.js when using "svgId" option!');
      }
      else {
        this.bgi = (this.svg && (this.svg instanceof SVGElement))
          ? new BGIsvg({
            ctx: this.ctx,
            svg: this.svg,
            prefix: this.opts.svgPrefix,
            fontsPath: this.opts.fontsPath,
            log: (type, msg) => { this.log(type, msg) }
          })
          : new BGI({
            ctx: this.ctx,
            fontsPath: this.opts.fontsPath,
            log: (type, msg) => { this.log(type, msg) }
          });

        // set that weird aspect ratio used in original EGA-mode RipTerm DOS version.
        //this.bgi.setaspectratio(371, 480); // = 0.7729
        this.bgi.setaspectratio(372, 480); // better
        this.initCommands();

        // TODO: may want to move outside constructor?
        this.bgi.loadFonts();
      }
    }
    else {
      console.error('RIPterm() missing canvasId!');
    }

  }

  initFullScreen (canvas) {
    if (canvas.requestFullscreen) {
      canvas.addEventListener("fullscreenchange", (event) => { this.fullscreenchange(event) }, false);
    }
    else if (canvas.webkitRequestFullscreen) {
      canvas.addEventListener("webkitfullscreenchange", (event) => { this.fullscreenchange(event) }, false);
    }
  }

  // send log messages to a div, if given logId option.
  log (type, msg) {
    if (this.logDiv) {
      const typeStrings = { 'term':'trm', 'rip':'rip', 'bgi':'bgi', 'svg':'svg', 'err':'!!!', 'font':'fnt' }
      const out = typeStrings[type] || '???';
      this.logDiv.innerHTML += `<span class="rip-log-${type}">${out}</span> ${msg}<br>`;
    }
    if (type === 'err') {
      console.error(msg);
    }
    else if (this.opts.logQuiet === false) {
      console.log(msg);
    }
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Public methods

  // TODO: update for v3
  start () {
    this.log('term', 'start()');
    if (this.ctx && this.ripData && (this.ripData.length > 0)) {
      this.isRunning = true;
      if (this.cmdi >= this.ripData.length) { this.cmdi = 0; }
      // timers
      if (this.cmdTimer) { window.clearTimeout(this.cmdTimer); this.cmdTimer = null; }
      if (this.refTimer) { window.clearTimeout(this.refTimer); this.refTimer = null; }
      this.cmdTimer = window.setTimeout(() => { this.drawNext() }, this.opts.timeInterval);
      this.refTimer = window.setTimeout(() => { this.refreshCanvas() }, this.opts.refreshInterval);
    }
    else {
      this.log('term', 'Must set "canvasId" and load a RIP first.');
    }
  }

  // TODO: update for v3
  stop () {
    this.log('term', 'stop()');
    this.isRunning = false;
    if (this.cmdTimer) { window.clearTimeout(this.cmdTimer); this.cmdTimer = null; }
    if (this.refTimer) { window.clearTimeout(this.refTimer); this.refTimer = null; }
    this.refreshCanvas();
  }

  reset () {
    this.log('term', 'reset()');
    this.cmd['*']();
    this.refreshCanvas();
    this.cmdi = 0;
    if (this.counterDiv) { this.counterDiv.innerHTML = this.cmdi + ' / ' + this.ripData.length; }
  }

  clear () {
    this.log('term', 'clear()');
    this.bgi.cleardevice();
    this.refreshCanvas();
  }

  fullscreen () {
    this.log('term', 'fullscreen()');
    if (!this.canvas) { return }
    if (this.canvas.requestFullscreen) {
      this.canvas.requestFullscreen();
    }
    else if (this.canvas.webkitRequestFullscreen) {
      this.canvas.webkitRequestFullscreen();
    }
  }

  // called when entering and exiting full screen
  fullscreenchange (event) {
    if (!this.isFullscreen) {
      // entering fullscreen
      this.log('term', 'Entering Fullscreen'); // DEBUG
      this.isFullscreen = true;
      this.backup.canvasWidth = event.target.style.width;
      this.backup.canvasHeight = event.target.style.height;
      const winW = window.innerWidth, winH = window.innerHeight;
      event.target.style.width = winW + 'px';
      event.target.style.height = winH + 'px';
      this.reset();
      this.start();
    }
    else {
      // exiting fullscreen
      this.log('term', 'Exiting Fullscreen'); // DEBUG
      this.isFullscreen = false;
      event.target.style.width = this.backup.canvasWidth;
      event.target.style.height = this.backup.canvasHeight;
    }
  }


  ////////////////////////////////////////////////////////////////////////////////
  // copied from ripterm.js v2

  // TODO: update for v3
  drawNext () {
    if (!this.isRunning) { return }
    if (this.ripData && (this.cmdi < this.ripData.length)) {
      let d = this.ripData[this.cmdi];
      // console.log(d); // DEBUG
      if ( this.cmd[d[0]] ) { this.cmd[d[0]](d[1]); }
      if (this.opts.pauseOn.includes(d[0])) {
        if (!this.opts.floodFill && (d[0] == 'F')) { }
        else { this.stop(); }
      }
      this.cmdi++;
      this.timer = window.setTimeout(() => { this.drawNext() }, this.opts.timeInterval);
    }
    else {
      this.stop();
    }
  }

  refreshCanvas () {
    if (this.counterDiv) { this.counterDiv.innerHTML = this.cmdi + ' / ' + this.ripData.length; }
    this.bgi.refresh();
    this.refreshDiff();
    if (this.isRunning) {
      this.refTimer = window.setTimeout(() => { this.refreshCanvas() }, this.opts.refreshInterval);
    }
  }

  // TODO: update for v3
  readFile (url) {
    this.log('term', 'readFile(): ' + url);

    this.cmdi = 0;
    let req = new XMLHttpRequest();
    if (req != null) {
      if (this.commandsDiv) { this.commandsDiv.innerHTML = ''; }
      if (this.counterDiv) { this.counterDiv.innerHTML = ''; }

      req.open("GET", url, false);
      req.overrideMimeType('text/plain; charset=x-user-defined');  // allows ASCII control chars in input
      req.send(null);
      if (req.status != 200) { this.log('term', 'Error downloading: ' + url); return; }
      let text = req.responseText;

      // output to commandsDiv
      let outText = '';
      let c = 1;
      this.ripData = [];

      // process one line at a time
      // FIXME: missing \r at end of lines
      let lines = text.split("\n");
      for (let i=0; i < lines.length; i++) {
        let aLine = lines[i];
        while (aLine.match( /(.*)\\$/m )) {  // works?
          aLine = RegExp.$1 + lines[i+1];  // works?
          i++;
        }
        if (aLine.charAt(0) == '!') {
          let cmds = aLine.substr(2).split('|');
          for (let j=0; j < cmds.length; j++) {
            let d = this.parseRIPcmd(cmds[j]);

            // TODO: take this out into another function
            // output html to commandsDiv
            if (this.opts.pauseOn.includes(d[0])) {
              // RIP command paused
              outText += '<span class="cmd-paused" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
            }
            else if (this.cmd[d[0]]) {
              // RIP command supported
              outText += '<span class="cmd-ok" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
            }
            else {
              // RIP command NOT supported
              outText += '<span class="cmd-not" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
            }

            this.ripData.push(d);  // store command + args in array
            c++;
          }
        } // else skip line
      }
      if (this.commandsDiv) { this.commandsDiv.innerHTML = outText; }
    }
    this.reset();

    // console.log(this.ripData); // DEBUG
  }

  // Load and draw a screenshot image file inside a canvas
  // if this.ctxSS ('ssId' option) is set.
  readScreenshot (url) {
    this.log('term', 'readScreenshot(): ' + url);

    if (this.canvasSS && this.ctxSS) {
      this.ctxSS.clearRect(0, 0, this.canvasSS.width, this.canvasSS.height);
      let img = new Image();
      img.onload = () => {
        this.ctxSS.drawImage(img, 0, 0);
        this.refreshDiff();
      }
      img.src = url;
    }
  }

  // Draws diff between Screenshot & Main canvas,
  // where black pixels = match, white pixels = don't match.
  // Both 'ssId' and 'diffId' options must be set.
  // All 3 canvas width & heights must match!
  // (only works in browser, not using node's 'A8' pixel format.)
  refreshDiff () {

    if ( this.canvas && this.ctx && this.canvasSS && this.ctxSS && this.canvasDiff && this.ctxDiff &&
      (this.canvas.width === this.canvasSS.width) && (this.canvas.width === this.canvasDiff.width) &&
      (this.canvas.height === this.canvasSS.height) && (this.canvas.height === this.canvasDiff.height) )
    {
      // prepare image data
      const w = this.canvas.width, h = this.canvas.height;
      let imgMain = this.ctx.getImageData(0, 0, w, h);
      let imgSS = this.ctxSS.getImageData(0, 0, w, h);
      let imgDiff = this.ctxDiff.getImageData(0, 0, w, h);

      // grab color options
      const [fgR, fgG, fgB] = this.hex2rgb(this.opts.diffFGcolor);
      const [bgR, bgG, bgB] = this.hex2rgb(this.opts.diffBGcolor);

      // compare image diffs
      const delta = 40; // accounts for changes in color gamma in source images
      const dlen = imgMain.data.length; // 4 ints in array per pixel
      for (let i=0; i < dlen; i+=4) {
        if ( (Math.abs(imgMain.data[i+0] - imgSS.data[i+0]) < delta)   // R
          && (Math.abs(imgMain.data[i+1] - imgSS.data[i+1]) < delta)   // G
          && (Math.abs(imgMain.data[i+2] - imgSS.data[i+2]) < delta) ) // B
        {
          // pixels match: draw dark
          imgDiff.data[i+0] = bgR;
          imgDiff.data[i+1] = bgG;
          imgDiff.data[i+2] = bgB;
          imgDiff.data[i+3] = 255;
        }
        else {
          // pixels don't match: draw bright
          imgDiff.data[i+0] = fgR;
          imgDiff.data[i+1] = fgG;
          imgDiff.data[i+2] = fgB;
          imgDiff.data[i+3] = 255;
        }
      }

      // draw imgDiff to diff canvas
      this.ctxDiff.putImageData(imgDiff, 0, 0);
    }
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Private methods

  // hex is '#rgb' or '#rrggbb', returns [R, G, B] where values are 0-255
  hex2rgb (hex) {
    return (hex.length == 4) ?
      ['0x' + hex[1] + hex[1] | 0, '0x' + hex[2] + hex[2] | 0, '0x' + hex[3] + hex[3] | 0]:
      ['0x' + hex[1] + hex[2] | 0, '0x' + hex[3] + hex[4] | 0, '0x' + hex[5] + hex[6] | 0];
  }

  // convert these "\!" "\|" "\\" to normal text.
  unescapeRIPtext (text) {
    text = text.replace(/\\\!/g, '!');
    text = text.replace(/\\\|/g, '|');
    text = text.replace(/\\\\/g, '\\');
    return text;
  }

  // Extracts command code + args from RIP instruction.
  // TODO: not coded to work with ESC character commands
  parseRIPcmd (inst) {
    let args = inst;
    const cmd = /^[0-9]*./.exec(inst)[0];
    if (cmd) { args = inst.substr(cmd.length); } // grab everything after cmd string
    return [cmd, args];
  }

  // args = encoded string following the command.
  // fmt = string format.
  // e.g. args = '003PHR9P' where 'B' is command not passed in, '003PHR9P' are 4 2-digit args.
  // e.g. fmt = '2222' means extract 4 2-digit ints, converting from base36.
  // returns an array of numbers.
  // still need to figure out how to parse strings out.
  // TODO: how to handle parsing errors? throw an exception?
  parseRIPargs (args, fmt) {
    let pos = 0, ret = [];
    Array.from(fmt).forEach(f => {
      switch (f) {
        case '1': ret.push( parseInt(args.substr(pos, 1), 36) ); pos += 1; break;
        case '2': ret.push( parseInt(args.substr(pos, 2), 36) ); pos += 2; break;
        case '3': ret.push( parseInt(args.substr(pos, 3), 36) ); pos += 3; break;
        case '4': ret.push( parseInt(args.substr(pos, 4), 36) ); pos += 4; break;
        case '*': ret.push( this.unescapeRIPtext(args.substr(pos)) ); break;
        default:
      }
    });
    return ret;
  }

  // Parses RIP_POLYGON, RIP_FILL_POLYGON, and RIP_POLYLINE
  // which have a variable number of arguments in the form:
  //  npoints:2, x1:2, y1:2, ... xn:2, yn:2
  parseRIPpoly (args) {
    let xy = 0, ret = [];
    const npoints = parseInt(args.substr(0, 2), 36);
    ret.push(npoints);
    if (npoints <= 512) {
      for (let n=0; n < npoints * 2; n++) {
        xy = parseInt(args.substr(n * 2 + 2, 2), 36);
        ret.push(xy);
      }
    }
    return ret;
  }

  // TODO
  runCommand (inst) {

    let [c, args] = parseRIPcmd(inst);
    this.cmd[c](args);

  }


  ////////////////////////////////////////////////////////////////////////////////
  // RIP commands

  initCommands () {
    this.cmd = {

      // RIP_TEXT_WINDOW (w)

      // RIP_VIEWPORT (v)
      'v': (args) => {
        if (args.length >= 8) {
          const [x0, y0, x1, y1] = this.parseRIPargs(args, '2222');
          this.bgi.setviewport(x0, y0, x1, y1, true);
        }
      },

      // RIP_RESET_WINDOWS (*)
      // implements: clear screen, restore default palette
      '*': (args) => {
        this.bgi.graphdefaults();
        this.bgi.cleardevice();
      },

      // RIP_ERASE_WINDOW (e)
      // Clears Text Window to background color

      // RIP_ERASE_VIEW (E)
      'E': (args) => {
        this.bgi.clearviewport();
      },

      // RIP_GOTOXY (g)
      // RIP_HOME (H)
      // RIP_ERASE_EOL (>)

      // RIP_COLOR (c)
      'c': (args) => {
        if (args.length >= 2) {
          const [color] = this.parseRIPargs(args, '2');
          this.bgi.setcolor(color);
        }
      },

      // RIP_SET_PALETTE (Q)
      'Q': (args) => {
        if (args.length >= 32) {
          // parse EGA palette values (0-63)
          const palette = this.parseRIPargs(args, '2222222222222222');
          for (let i=0; i < palette.length; i++) {
            const c = palette[i];
            if (c < 64) {
              const [red, green, blue] = this.hex2rgb( RIPterm.paletteEGA64[c] );
              this.bgi.setrgbpalette(i, red, green, blue);
            }
          }
        }
      },

      // RIP_ONE_PALETTE (a)
      'a': (args) => {
        if (args.length >= 4) {
          // parse EGA palette values (0-63)
          const [color, value] = this.parseRIPargs(args, '22');
          if ((color < 16) && (value < 64)) {
            const [red, green, blue] = this.hex2rgb( RIPterm.paletteEGA64[value] );
            this.bgi.setrgbpalette(color, red, green, blue);
          }
        }
      },

      // RIP_WRITE_MODE (W)
      'W': (args) => {
        if (args.length >= 2) {
          const [mode] = this.parseRIPargs(args, '2');
          this.bgi.setwritemode(mode);
        }
      },

      // RIP_MOVE (m)
      'm': (args) => {
        if (args.length >= 4) {
          const [x, y] = this.parseRIPargs(args, '22');
          this.bgi.moveto(x, y);
        }
      },

      // RIP_TEXT (T)
      // uses and updates info.cp
      'T': (args) => {
        const [text] = this.parseRIPargs(args, '*');
        this.log('rip', 'RIP_TEXT: ' + text);
        this.bgi.outtext(text);
      },

      // RIP_TEXT_XY (@)
      // updates info.cp
      '@': (args) => {
        const [x, y, text] = this.parseRIPargs(args, '22*');
        this.log('rip', 'RIP_TEXT_XY: ' + text);
        this.bgi.outtextxy(x, y, text);
      },

      // RIP_FONT_STYLE (Y)
      'Y': (args) => {
        const [font, direction, size, res] = this.parseRIPargs(args, '2222');
        this.bgi.settextstyle(font, direction, size);
      },

      // RIP_PIXEL (X)
      // spec says this doesn't use writeMode (mistake?)
      'X': (args) => {
        if (args.length >= 4) {
          const [x, y] = this.parseRIPargs(args, '22');
          // this.bgi.putpixel(x, y, this.bgi.getcolor(), BGI.COPY_PUT); // ignores writeMode
          this.bgi.putpixel(x, y); // uses writeMode
        }
      },

      // RIP_LINE (L)
      'L': (args) => {
        if (args.length >= 8) {
          const [x0, y0, x1, y1] = this.parseRIPargs(args, '2222');
          this.bgi.line(x0, y0, x1, y1);
        }
      },

      // RIP_RECTANGLE (R)
      'R': (args) => {
        if (args.length >= 8) {
          const [x0, y0, x1, y1] = this.parseRIPargs(args, '2222');
          this.bgi.rectangle(x0, y0, x1, y1);
        }
      },

      // RIP_BAR (B)
      // Fills a rectangle using fill color and pattern, without border.
      // spec says this doesn't use writeMode (mistake?)
      'B': (args) => {
        if (args.length >= 8) {
          const [x0, y0, x1, y1] = this.parseRIPargs(args, '2222');
          // this.bgi.bar(x0, y0, x1, y1, this.bgi.info.fill.color, BGI.COPY_PUT); // ignores writeMode
          this.bgi.bar(x0, y0, x1, y1); // uses writeMode
        }
      },

      // RIP_CIRCLE (C)
      'C': (args) => {
        if (args.length >= 6) {
          let [x, y, radius] = this.parseRIPargs(args, '222');
          this.bgi.circle(x, y, radius);
        }
      },

      // RIP_OVAL (O)
      // does same as RIP_OVAL_ARC (V)
      // weird that this includes start & end angles
      'O': (args) => {
        this.cmd['V'](args);
      },

      // RIP_FILLED_OVAL (o)
      'o': (args) => {
        if (args.length >= 8) {
          let [x, y, x_rad, y_rad] = this.parseRIPargs(args, '2222');
          this.bgi.fillellipse(x, y, x_rad, y_rad);
          this.bgi.ellipse(x, y, 0, 360, x_rad, y_rad); // may be included in fillellipse() ?
        }
      },

      // RIP_ARC (A)
      'A': (args) => {
        if (args.length >= 10) {
          let [x, y, start_ang, end_ang, radius] = this.parseRIPargs(args, '22222');
          this.bgi.arc(x, y, start_ang, end_ang, radius);
        }
      },

      // RIP_OVAL_ARC (V)
      // does same as RIP_OVAL (O)
      'V': (args) => {
        if (args.length >= 12) {
          let [x, y, st_ang, e_ang, radx, rady] = this.parseRIPargs(args, '222222');
          this.bgi.ellipse(x, y, st_ang, e_ang, radx, rady);
        }
      },

      // RIP_PIE_SLICE (I)
      'I': (args) => {
        if (args.length >= 10) {
          let [x, y, start_ang, end_ang, radius] = this.parseRIPargs(args, '22222');
          this.bgi.pieslice(x, y, start_ang, end_ang, radius);
        }
      },

      // RIP_OVAL_PIE_SLICE (i)
      'i': (args) => {
        if (args.length >= 12) {
          let [x, y, st_ang, e_ang, radx, rady] = this.parseRIPargs(args, '222222');
          this.bgi.sector(x, y, st_ang, e_ang, radx, rady);
        }
      },

      // RIP_BEZIER (Z)
      'Z': (args) => {
        if (args.length >= 18) {
          let points = this.parseRIPargs(args, '222222222'); // 9 ints
          let cnt = points.pop();
          this.bgi.drawbezier(cnt, points);
        }
      },

      // RIP_POLYGON (P)
      'P': (args) => {
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        this.bgi.drawpoly(npoints, pp);
      },

      // RIP_FILL_POLYGON (p)
      'p': (args) => {
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        // draw both a filled polygon using fill color & bgcolor,
        // and polygon outline using fgcolor, line style, and thickness.
        this.bgi.fillpoly(npoints, pp);
        // drawpoly() is called in fillpoly()
      },

      // RIP_POLYLINE (l)
      // this was introduced in RIPscrip v1.54 (not present in v1.52)
      'l': (args) => {
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        this.bgi.drawpolyline(npoints, pp);
      },

      // RIP_FILL (F)
      'F': (args) => {
        if (args.length >= 6) {
          const [x, y, border] = this.parseRIPargs(args, '222');
          this.bgi.floodfill(x, y, border);
        }
      },

      // RIP_LINE_STYLE (=)
      // pre-defined styles introduced in RIPscrip v1.54 (only custom-defined in v1.52 ??)
      '=': (args) => {
        if (args.length >= 8) {
          const [style, user_pat, thick] = this.parseRIPargs(args, '242');
          this.bgi.setlinestyle(style, user_pat, thick);
        }
      },

      // RIP_FILL_STYLE (S)
      'S': (args) => {
        if (args.length >= 4) {
          const [pattern, color] = this.parseRIPargs(args, '22');
          this.bgi.setfillstyle(pattern, color);
        }
      },

      // RIP_FILL_PATTERN (s)
      's': (args) => {
        if (args.length >= 18) {
          const [c1, c2, c3, c4, c5, c6, c7, c8, color] = this.parseRIPargs(args, '222222222');
          this.bgi.setfillpattern([c1, c2, c3, c4, c5, c6, c7, c8], color);
        }
      },

      // RIP_MOUSE (1M)
      // RIP_KILL_MOUSE_FIELDS (1K)
      // RIP_BEGIN_TEXT (1T)
      // RIP_REGION_TEXT (1t)
      // RIP_END_TEXT (1R)

      // RIP_GET_IMAGE (1C)
      '1C': (args) => {
        if (args.length >= 9) {
          const [x0, y0, x1, y1, res] = this.parseRIPargs(args, '22221');
          this.clipboard = this.bgi.getimage(x0, y0, x1, y1)
        }
      },

      // RIP_PUT_IMAGE (1P)
      '1P': (args) => {
        if (args.length >= 7) {
          const [x, y, mode, res] = this.parseRIPargs(args, '2221');
          this.bgi.putimage(x, y, this.clipboard, mode);
        }
      },

      // RIP_WRITE_ICON (1W)
      // RIP_LOAD_ICON (1I)
      // RIP_BUTTON_STYLE (1B)
      // RIP_BUTTON (1U)
      // RIP_DEFINE (1D)
      // RIP_QUERY (1<esc>)
      // RIP_COPY_REGION (1G)
      // RIP_READ_SCENE (1R)
      // RIP_FILE_QUERY (1F)

      // RIP_ENTER_BLOCK_MODE (9<esc>)

      // RIP_HEADER (h) - RIPscrip v2.0
      'h': (args) => {
        if (args.length >= 8) {
          const [revision, flags, res] = this.parseRIPargs(args, '242');
          if (revision > 0) {
            this.log('rip', 'RIPscrip 2.0 or above NOT SUPPORTED at this time!');
          }
        }
      },

      // RIP_NO_MORE (#)
      '#': (args) => {
        // do nothing
      }
    }
  }

} // end class RIPterm
////////////////////////////////////////////////////////////////////////////////
