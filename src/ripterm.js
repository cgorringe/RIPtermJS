/**
 * RIPtermJS - Version 4
 * Copyright (c) 2011-2026 Carl Gorringe
 * https://carl.gorringe.org
 * https://github.com/cgorringe/RIPtermJS
 *
 * v3: 5/11/2021
 * v4: 1/22/2026 streaming file
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
/*
  const fontname = 'BOLD.CHR';
  bgi.fetchCHRFont(fontname);

  // add delay so font can load
  setTimeout(() => {
    console.log('Starting to draw font...');

    bgi.setcolor(BGI.LIGHTGREEN);
    bgi.moveto(150, 150);

    bgi.drawChar(32, fontname, 1, 0); // 32=space
    bgi.drawChar(33, fontname, 1, 0); // 33='!'
    bgi.drawChar(35, fontname, 1, 0); // 35='#' (bug)
    bgi.drawChar(65, fontname, 2, 0); // 65='A'
    bgi.drawChar(66, fontname, 3, 0); // 66='B'
    bgi.drawChar(67, fontname, 4, 0); // 67='C'
    bgi.drawChar(68, fontname, 5, 0); // 68='D'
    bgi.drawChar(69, fontname, 6, 0); // 69='E'

    bgi.refresh();

  }, 1000);
*/
/*
  // TEST Bitmap Fonts
  bgi.fetchPNGFont ('8x8.png', 0, 8, 8);
  bgi.fetchPNGFont ('8x14.png', 2, 8, 14);
  // add delay so font can load
  setTimeout(() => {
    console.log(bgi.bitfonts); // DEBUG
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
        'modemSpeed' : 0,        // simulate modem speed in bps (0 = no delay)
        'timeInterval' : 1,      // time between running commands (in miliseconds)
        'refreshInterval' : 100, // time between display refreshes (in miliseconds)
        'pauseOn' : [],          // debug: pauses on RIP command, e.g. ['F'] will pause on Flood Fill.
        'diffFGcolor' : '#C86',  // forground color for diff pixels that don't match.
        'diffBGcolor' : '#222',  // background color for diff pixels that match.
        'svgPrefix' : 'rip',     // used to prefix internal SVG ids
        'logQuiet' : false,      // set to true to stop logging to console
        'fontsPath' : 'fonts',
        'iconsPath' : 'icons',
        'origButtons' : true,   // set true to use original selected button style

        // these options copied from prior version are not implemented yet.
        'floodFill' : true,
        'debugVerbose' : false,  // verbose flag
        'debugFillBuf' : false,  // display flood-fill buffer in canvas instead of normal drawings.
        'svgIncludePut' : false, // adds RIP_PUT_IMAGE (1P) to SVG (experimental)
      };

      // assign or overwrite opts with passed-in options
      Object.entries(opts).forEach( ([k, v]) => { this.opts[k] = v } );

      // init other vars
      this.ripData = [];    // old v3 file pre-loaded
      this.inStream = null; // new v4 stream
      this.inReader = null; // new v4 stream reader
      this.cmdi = 0;        // command counter
      this.cmdTimer = null; // commands interval timer
      this.refTimer = null; // refresh interval timer
      this.clipboard = {};  // { x:int, y:int, width:int, height:int, data:Uint8ClampedArray }
      this.buttonStyle = {};
      this.buttons = [];  // array of active button objects
      this.buttonClicked = null; // last clicked button object
      this.withinButton = false;

      // debug options
      this.commandsDiv = ('commandsId' in opts) ? document.getElementById(opts.commandsId) : null;
      this.counterDiv = ('counterId' in opts) ? document.getElementById(opts.counterId) : null;
      this.coordsDiv = ('coordsId' in opts) ? document.getElementById(opts.coordsId) : null;
      this.hiliteCmdFlag = false;
      this.diffActive = false;
      if ('logId' in opts) {
        this.logId = opts.logId;
        this.logDiv = document.getElementById(opts.logId);
      }
      if ('ssId' in opts) {
        this.canvasSS = document.getElementById(opts.ssId);
        this.ctxSS = (this.canvasSS && this.canvasSS.getContext) ? this.canvasSS.getContext('2d') : null;
      }
      if ('diffId' in opts) {
        this.canvasDiff = document.getElementById(opts.diffId);
        this.ctxDiff = (this.canvasDiff && this.canvasDiff.getContext) ? this.canvasDiff.getContext('2d') : null;
        this.diffActive = true;
      }

      // init canvas
      this.canvas = document.getElementById(opts.canvasId);
      this.ctx = this.canvas.getContext('2d'); // , { alpha: false } ???

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
            iconsPath: this.opts.iconsPath,
            log: (type, msg) => { this.log(type, msg) }
          })
          : new BGI({
            ctx: this.ctx,
            fontsPath: this.opts.fontsPath,
            iconsPath: this.opts.iconsPath,
            log: (type, msg) => { this.log(type, msg) }
          });

        // set that weird aspect ratio used in original EGA-mode RipTerm DOS version.
        //this.bgi.setaspectratio(371, 480); // = 0.7729
        this.bgi.setaspectratio(372, 480); // better
        this.initCommands();

        // must do once
        this.animate = this.animate.bind(this);
        this.handleMouseEvents = this.handleMouseEvents.bind(this);
        this.setupCmdHover();
        this.setupCoordsMouseEvents();
        //this.setupMouseTestHandler(); // DEBUG testing mouse coords in bgi
      }
    }
    else {
      console.error('RIPterm() missing canvasId!');
    }

  }

  // call this after new RIPterm() to load all the fonts.
  async initFonts () {
    await this.bgi.initFonts();
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
      // 'type' and 'out' are now the same
      //const typeStrings = { 'term':'trm', 'rip':'rip', 'bgi':'bgi', 'svg':'svg', 'err':'!!!', 'font':'fnt' }
      //const out = typeStrings[type] || type;
      const out = type;
      this.logDiv.innerHTML += `<span class="${this.logId}-${type}">${out}</span> ${msg}<br>`;
      this.logDiv.scrollTop = this.logDiv.scrollHeight; // autoscrolls
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
    this.log('trm', 'start()');
    if (this.ctx && this.inReader) {
      // v4 TEST
      this.isRunning = true;
      this.cmdi = 0;
      if (this.refTimer) { window.clearTimeout(this.refTimer); this.refTimer = null; }
      this.refTimer = window.setTimeout(() => { this.refreshCanvas() }, this.opts.refreshInterval);
      this.readStream();
    }
    else if (this.ctx && this.ripData && (this.ripData.length > 0)) {
      // v3
      this.isRunning = true;
      if (this.cmdi >= this.ripData.length) { this.cmdi = 0; }
      // timers
      if (this.cmdTimer) { window.clearTimeout(this.cmdTimer); this.cmdTimer = null; }
      if (this.refTimer) { window.clearTimeout(this.refTimer); this.refTimer = null; }
      this.cmdTimer = window.setTimeout(async () => { await this.drawNext() }, this.opts.timeInterval);
      //this.animationId = requestAnimationFrame(this.animate);
      this.refTimer = window.setTimeout(() => { this.refreshCanvas() }, this.opts.refreshInterval);
    }
    else {
      this.log('trm', 'Must set "canvasId" and load a RIP first.');
    }
  }

  // TODO: update for v3
  stop () {
    this.log('trm', 'stop()');
    this.isRunning = false;
    if (this.cmdTimer) { window.clearTimeout(this.cmdTimer); this.cmdTimer = null; }
    if (this.refTimer) { window.clearTimeout(this.refTimer); this.refTimer = null; }
    //if (this.animationId) { cancelAnimationFrame(this.animationId); }
    // unlock prior stream
    if (this.inStream && this.inStream.locked && this.inReader) {
      this.inReader.releaseLock();
      this.inReader = null;
    }
    this.refreshCanvas();
  }

  reset () {
    this.log('trm', 'reset()');
    this.bgi.graphdefaults();
    this.bgi.cleardevice();
    this.clearAllButtons();
    this.clearDiff();
    this.refreshCanvas();
    this.cmdi = 0;
    //if (this.counterDiv) { this.counterDiv.innerHTML = `${this.cmdi} / ${this.ripData.length}`; }
    if (this.counterDiv) { this.counterDiv.innerHTML = ''; }
  }

  clear () {
    this.log('trm', 'clear()');
    this.bgi.cleardevice();
    this.clearDiff();
    this.refreshCanvas();
  }

  fullscreen () {
    this.log('trm', 'fullscreen()');
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
      this.log('trm', 'Entering Fullscreen'); // DEBUG
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
      this.log('trm', 'Exiting Fullscreen'); // DEBUG
      this.isFullscreen = false;
      event.target.style.width = this.backup.canvasWidth;
      event.target.style.height = this.backup.canvasHeight;
    }
  }

  // NOT USED
  // Called from requestAnimationFrame() ~60 times a second?
  // this is currently slower than using setTimeout()
  //
  async animate (timestamp) {
    await this.drawNext();
  }


  ////////////////////////////////////////////////////////////////////////////////
  // copied from ripterm.js v2

  // OLD v2-3: using pre-loaded ripData[]
  async drawNext () {
    if (!this.isRunning) { return }
    if (this.ripData && (this.cmdi < this.ripData.length)) {
      let d = this.ripData[this.cmdi];
      // console.log(d); // DEBUG
      if ( this.cmd[d[0]] ) {
        const o = this.cmd[d[0]](d[1]);
        if (o && o.run) { await o.run({}); }
        //this.log('rip', `!|${d[0]}${d[1]} ${JSON.stringify(o)}`); // DEBUG
      }
      if (this.opts.pauseOn.includes(d[0])) {
        if (!this.opts.floodFill && (d[0] == 'F')) { }
        else { this.stop(); }
      }
      this.cmdi++;
      this.cmdTimer = window.setTimeout(async () => { await this.drawNext() }, this.opts.timeInterval);
      //this.animationId = requestAnimationFrame(this.animate);
      //this.timer = window.setTimeout(async () => { await this.drawNext() }, this.opts.timeInterval);
    }
    else {
      this.stop();
    }
  }

  refreshCanvas () {
    //if (this.counterDiv) { this.counterDiv.innerHTML = `${this.cmdi} / ${this.ripData.length}`; }
    if (this.counterDiv) { this.counterDiv.innerHTML = `${this.cmdi}`; }
    this.bgi.refresh();
    if (this.diffActive) { this.refreshDiff(); }
    if (this.isRunning) {
      this.refTimer = window.setTimeout(() => { this.refreshCanvas() }, this.opts.refreshInterval);
    }
  }

  // output html to commandsDiv
  outputCmdsHtml(count, cmd0, args) {

    let outHtml = '';
    if (this.opts.pauseOn.includes(cmd0)) {
      // RIP command paused
      const o = this.cmd[cmd0](args);
      const oText = `${count}: ` + (o ? JSON.stringify(o).replaceAll('"', '').replaceAll(',', ', ') : '');
      outHtml = `<div class="rip-cmd" title="${oText}"><span class="cmd-paused">${cmd0}</span>${args}<br></div>`;
    }
    else if (this.cmd[cmd0]) {
      // RIP command supported
      const o = this.cmd[cmd0](args);
      const oText = `${count}: ` + (o ? JSON.stringify(o).replaceAll('"', '').replaceAll(',', ', ') : '');
      //let clickCode = `ripterm.clickCmd('${cmd0}','${args}');`; // TEST
      //outHtml = `<div class="rip-cmd" title="${oText}" onclick="${clickCode}"><span class="cmd-ok">${cmd0}</span>${args}<br></div>`;
      outHtml = `<div class="rip-cmd" title="${oText}"><span class="cmd-ok">${cmd0}</span>${args}<br></div>`;
    }
    else {
      // RIP command NOT supported
      outHtml = `<div><span class="cmd-not" title=${count}>${cmd0}</span>${args}<br></div>`;
    }
    return outHtml;
  }

  // OLD v2-3: stores ripData[] from pre-loaded file
  // returns an array of icon filenames used in RIP file, else empty array.
  readFile (url) {
    this.log('trm', 'readFile(): ' + url);

    let iconNames = [];
    this.cmdi = 0;
    let req = new XMLHttpRequest();
    if (req != null) {

      req.open("GET", url, false);
      req.overrideMimeType('text/plain; charset=x-user-defined');  // allows ASCII control chars in input
      req.send(null);
      if (req.status != 200) { this.log('trm', 'Error downloading: ' + url); return; }
      let text = req.responseText;

      // output to commandsDiv
      let outText = '';
      let c = 1;
      this.ripData = [];

      // process one line at a time
      // FIXME: missing \r at end of lines, and need to remove all \n
      let lines = text.split("\n");
      for (let i=0; i < lines.length; i++) {
        let aLine = lines[i];
        while (aLine.match( /(.*)\\$/m )) {  // works? (NO) FIXME: include spaces?
          aLine = RegExp.$1 + lines[i+1];  // works?
          i++;
        }
        if (aLine.charAt(0) == '!') {
          const cmds = aLine.substr(2).split('|');
          for (let j=0; j < cmds.length; j++) {
            const d = this.parseRIPcmd(cmds[j]);

            // add extracted icon filenames to list
            iconNames.push(...this.parseIconNames(d[0], d[1]));

            outText += this.outputCmdsHtml(c, d[0], d[1]);
            this.ripData.push(d);  // store command + args in array
            c++;
          }
        } // else skip line
      }
      if (this.commandsDiv) { this.commandsDiv.innerHTML = outText; }
    }

    // console.log(this.ripData); // DEBUG
    // this.log('trm', `icons: ${iconNames}`); // DEBUG

    return iconNames;
  }

  clearFile () {
    this.cmdi = 0;
    this.ripData = [];
    this.refreshCanvas();
    if (this.counterDiv) { this.counterDiv.innerHTML = ''; }
    if (this.commandsDiv) { this.commandsDiv.innerHTML = ''; }
  }

  clearScreenshot () {
    if (this.canvasSS && this.ctxSS) {
      this.ctxSS.clearRect(0, 0, this.canvasSS.width, this.canvasSS.height);
    }
  }

  // Load and draw a screenshot image file inside a canvas
  // if this.ctxSS ('ssId' option) is set.
  readScreenshot (url) {
    this.log('trm', 'readScreenshot(): ' + url);

    if (this.canvasSS && this.ctxSS) {
      this.ctxSS.clearRect(0, 0, this.canvasSS.width, this.canvasSS.height);
      let img = new Image();
      img.onload = () => {
        this.ctxSS.drawImage(img, 0, 0);
        if (this.diffActive) {
          this.refreshDiff();
        } else {
          this.clearDiff();
        }
      }
      img.src = url;
    }
  }

  clearDiff () {
    if (this.ctxDiff) {
      this.ctxDiff.save();
      this.ctxDiff.fillStyle = this.opts.diffBGcolor;
      this.ctxDiff.fillRect(0, 0, this.ctxDiff.canvas.width, this.ctxDiff.canvas.height);
      this.ctxDiff.restore();
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

  // convert to uppercase and add .ICN extension
  fixIconFilename (filename) {
    let fname = null;
    if ((typeof filename === 'string') && (filename.length > 0)) {
      fname = filename.toUpperCase();
      if (!fname.includes('.')) { fname += '.ICN'; }
    }
    return fname;
  }

  // convert to hot icon filename by replacing extension with .HIC, else returns null.
  hotIconFilename (filename) {
    let fname = this.fixIconFilename(filename);
    fname = (fname && fname.includes('.ICN')) ? fname.replace('.ICN', '.HIC') : null;
    return fname;
  }

  // fetches the given array of icon files and caches them.
  async loadIcons (filenames) {
    return (await Promise.all(filenames.map(async fname => {
      this.bgi.icons[fname] = await this.bgi.fetchIcon(fname);
    })));
  }


  ////////////////////////////////////////////////////////////////////////////////
  // v4 using file streaming

  // 'speed' can be an int or a string
  setModemSpeed (speed) {
    this.log('trm', `speed set to ${speed}`);
    this.opts.modemSpeed = parseInt(speed);
  }

  // Calculate buffer size based on modemSpeed & refreshInterval.
  // Size returned is number of bytes between refreshes.
  // If modemSpeed == 0 then returns 0.
  //
  calculateStreamBufferSize (speed = this.opts.modemSpeed, interval = this.opts.refreshInterval) {

    // Modem speed is in bits per second assuming 8N1 or 10 bits/byte.
    // speed / 10 => bytes per sec
    // interval is in 1/1000 secs (milliseconds)
    // return (interval / 1000) * (speed / 10)
    //
    // Example #1: 20 ms refresh = 50 Hz
    // (20 ms / 1000) * (1200 bps / 10) => 2.4 bytes (a tiny buffer!)
    // (20 ms / 1000) * (9600 bps / 10) => 19.2 bytes
    // (20 ms / 1000) * (14400 bps / 10) => 28.8 bytes
    // (20 ms / 1000) * (33600 bps / 10) => 67.2 bytes
    // (20 ms / 1000) * (56000 bps / 10) => 112 bytes
    //
    // Example #2: 50 ms refresh = 20 Hz
    // (50 ms / 1000) * (1200 bps / 10) => 6 bytes
    // (50 ms / 1000) * (9600 bps / 10) => 48 bytes
    // (50 ms / 1000) * (14400 bps / 10) => 72 bytes
    // (50 ms / 1000) * (33600 bps / 10) => 168 bytes
    // (50 ms / 1000) * (56000 bps / 10) => 280 bytes

    return Math.ceil((interval / 1000) * (speed / 10));
  }

  async setupStream (name, stream) {

    this.log('trm', `Streaming: ${name}`);

    // close old stream & check for errors?
    if (this.inStream && this.inReader && this.inStream.locked) {
      this.log('trm', `unlocking prior stream`); // DEBUG
      this.inReader.releaseLock();
      await this.inStream.cancel();
    }
    this.inStream = stream;
    this.inReader = stream.getReader();
  }

  // currently reads the entire stream until it's finished.
  // (not done)
  async readStream (reader = this.inReader) {

    this.log('trm', `readStream()`); // DEBUG

    if (!reader) { return }
    let outText='', c=1;

    while (true) {

      // TODO: find out if we can read in less than the default,
      // which appears to be the entire file!

      // BUG on following:
      // Unhandled Promise Rejection: TypeError: read() called on a reader owned by no readable stream
      // (likely happens if 'Play' button pressed in rapid succession?)

      const { value, done } = await reader.read();
      if (done) {
        this.log('trm', 'Stream complete');
        break;
      }

      this.log('trm', `read ${value.length} bytes`); // DEBUG

      // value is an array of bytes (Uint8Array)
      // outputting 'value' will print byte values separated by commas

      // DEBUG
      //const text = String.fromCharCode(...value); // ASCII only (can crash with large array)
      const text = new TextDecoder("utf-8").decode(value);
      //outText += text;

    /*
      // DEBUG
      if (this.commandsDiv) {
        //this.commandsDiv.append(value + '<br>'); // doesn't output html
        this.commandsDiv.innerHTML = outText;
      }
    // */

      // right now, outText is one large string, including newlines CR LF (13,10)
      // 33=!, 124=|, 42=*, 13=CR, 10=LF

      // TODO: REDO the following code

      // process one line at a time
      // FIXME: missing \r at end of lines, and need to remove all \n

      let lines = text.split("\n");
      for (let i=0; i < lines.length; i++) {
        let aLine = lines[i];
        while (aLine.match( /(.*)\\$/m )) {  // works? (NO) FIXME: include spaces?
          aLine = RegExp.$1 + lines[i+1];  // works?
          i++;
        }
        if (aLine.charAt(0) == '!') {
          const cmds = aLine.substr(2).split('|');
          for (let j=0; j < cmds.length; j++) {
            const d = this.parseRIPcmd(cmds[j]);
            outText += this.outputCmdsHtml(c, d[0], d[1]);
            //this.ripData.push(d);  // store command + args in array
            c++;

            // run command
            if ( this.cmd[d[0]] ) {
              const o = this.cmd[d[0]](d[1]);
              if (o && o.run) { await o.run({}); }
            }
            this.cmdi++;
          }
        } // else skip line
      }

      // uncomment once we have count, cmd0, args
      //if (this.commandsDiv) {
      //  this.commandsDiv.append(this.outputCmdsHtml(count, cmd0, args)); // ??
      //}

    }
    // done here
    this.stop();
    if (this.commandsDiv) { this.commandsDiv.innerHTML = outText; }

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
    if (cmd) {
      // grab everything after cmd string
      args = inst.substr(cmd.length);
      // remove all newlines (NOT TESTED)
      args = args.replace(/\r?\n|\r/gm, '');
    }
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
        case '5': ret.push( parseInt(args.substr(pos, 5), 36) ); pos += 5; break;
        case '6': ret.push( parseInt(args.substr(pos, 6), 36) ); pos += 6; break;
        case '7': ret.push( parseInt(args.substr(pos, 7), 36) ); pos += 7; break;
        case '8': ret.push( parseInt(args.substr(pos, 8), 36) ); pos += 8; break;
        case '9': ret.push( parseInt(args.substr(pos, 9), 36) ); pos += 9; break;
        case '*': ret.push( this.unescapeRIPtext(args.substr(pos)) ); break;
        default:
      }
    });
    return ret;
  }

  // takes in an array of keys (strings)
  // returns an object using keys (strings) and values (ints)
  parseRIPargs2 (args, fmt, keys) {
    let pos=0, i=0, ret = {};
    Array.from(fmt).forEach(f => {
      switch (f) {
        case '1': ret[keys[i]] = parseInt(args.substr(pos, 1), 36); pos += 1; break;
        case '2': ret[keys[i]] = parseInt(args.substr(pos, 2), 36); pos += 2; break;
        case '3': ret[keys[i]] = parseInt(args.substr(pos, 3), 36); pos += 3; break;
        case '4': ret[keys[i]] = parseInt(args.substr(pos, 4), 36); pos += 4; break;
        case '5': ret[keys[i]] = parseInt(args.substr(pos, 5), 36); pos += 5; break;
        case '6': ret[keys[i]] = parseInt(args.substr(pos, 6), 36); pos += 6; break;
        case '7': ret[keys[i]] = parseInt(args.substr(pos, 7), 36); pos += 7; break;
        case '8': ret[keys[i]] = parseInt(args.substr(pos, 8), 36); pos += 8; break;
        case '9': ret[keys[i]] = parseInt(args.substr(pos, 9), 36); pos += 9; break;
        case '*': ret[keys[i]] = this.unescapeRIPtext(args.substr(pos)); break;
        default:
      }
      i += 1;
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

  // extracts icon filename(s) from RIP_LOAD_ICON (1I) or RIP_BUTTON (1U).
  // returns an array of strings, else empty array.
  // most often 1 filename, but returns 2 if there's a "hot icon" button.
  // modifies: this.buttonStyle
  //
  parseIconNames (cmd, args) {
    let fnames = [];
    if (cmd === '1I') {
      // RIP_LOAD_ICON
      if (args.length > 9) {
        const [x, y, mode, clipflag, res, filename] = this.parseRIPargs(args, '22212*');
        fnames.push(this.fixIconFilename(filename));
      }
    }
    else if (cmd === '1U') {
      // RIP_BUTTON
      if (args.length > 12) {
        const [x0, y0, x1, y1, hotkey, flags, res, text] = this.parseRIPargs(args, '2222211*');
        const [icon_name, label_text, host_cmd] = text.split("<>");
        const fname1 = this.fixIconFilename(icon_name);
        if (fname1) { fnames.push(fname1); }

        // check current button style if button displays a Hot Icon
        if (this.buttonStyle && ('flags' in this.buttonStyle) && (this.buttonStyle.flags & 4096)) {
          const fname2 = this.hotIconFilename(icon_name);
          if (fname2) { fnames.push(fname2); }
        }
      }
    }
    else if (cmd === '1B') {
      // RIP_BUTTON_STYLE (1B)
      // running this updates this.buttonStyle
      this.cmd[cmd](args);
    }
    return fnames;
  }

  // TODO
  runCommand (inst) {

    let [c, args] = this.parseRIPcmd(inst);
    this.cmd[c](args);

  }

  // Setup events for click, mouseover, and mouseout of individual RIP commands.
  // only call this once
  setupCmdHover () {

    this.hoverTimer = null;
    this.HOVER_DELAY = 300;

    document.addEventListener("click", (event) => {
      if (event.target.classList.contains("rip-cmd")) {
        const inst = event.target.textContent;
        this.log('rip', event.target.title);
      }
    });

    document.addEventListener("mouseover", (event) => {
      const item = event.target.closest(".rip-cmd");
      if (!item) return;
      if (!item.contains(event.relatedTarget)) {
        this.hoverTimer = setTimeout(async () => {
          const inst = event.target.textContent;
          //console.log("mouseover: " + inst); // DEBUG
          await this.onHoverCmd(inst);
          this.hoverTimer = null;
        }, this.HOVER_DELAY);
      }
      // if (event.target.classList.contains("rip-cmd")) { }
    });

    document.addEventListener("mouseout", async (event) => {
      const item = event.target.closest(".rip-cmd");
      if (!item) return;
      if (!item.contains(event.relatedTarget)) {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
        else {
          const inst = event.target.textContent;
          //console.log("mouse out: " + inst); // DEBUG
          await this.onHoverCmd(inst);
        }
      }
    });
  }

  // onClick handler for commands in commandsDiv. (no longer used)
  async clickCmd (cmd0, args) {
    await this.highlightCmd(cmd0, args, true);
  }

  // Click event handler that outputs RIP command details to log. (no longer used)
  onClickCmd (inst) {
    const [c, args] = this.parseRIPcmd(inst);
    if (this.cmd[c]) {
      const o = this.cmd[c](args);
      if (o) {
        this.log('rip', `!|${inst} ${JSON.stringify(o)}`);
      }
    }
  }

  // Event handler called on mouseover & mouseout of RIP commands
  // to highlight RIP commands in the canvas. hiliteCmdFlag must be set true.
  // inst is a full RIP command string (cmd + args).
  //
  async onHoverCmd (inst) {
    if (this.hiliteCmdFlag) {
      const [cmd0, args] = this.parseRIPcmd(inst);
      await this.highlightCmd(cmd0, args, false);
    }
  }

  // Highlight command by setting writemode to XOR then redraw it.
  async highlightCmd (cmd0, args, logFlag = false) {

    // FIXME: pie slices will flood canvas ['I','i']
    // need to fix bgi.sector() so that it doesn't call bgi.floodfill()
    // instead draw a box around it.
    // can't highlight '@' text, as size depends on previously stored font info that changes.

    if (this.cmd[cmd0]) {
      const o = this.cmd[cmd0](args);
      if (o && o.run) {
        if (logFlag) { this.log('rip', `${cmd0}${args} ${JSON.stringify(o)}`); }

        // prepare to draw using XOR
        let activeFlag = this.bgi.svgActive;
        this.bgi.svgActive = false;
        this.bgi.pushState();
        this.bgi.setwritemode(BGI.XOR_PUT);
        this.bgi.setcolor(BGI.WHITE); // BGI.LIGHTRED
        this.bgi.setbkcolor(BGI.YELLOW);
        this.bgi.setlinestyle(BGI.SOLID_LINE, 0xFFFF, BGI.NORM_WIDTH);
        //this.bgi.setlinestyle(BGI.SOLID_LINE, 0xFFFF, BGI.THICK_WIDTH); // buggy
        // thick ovals don't draw correctly using XOR
        // line options: BGI.SOLID_LINE or BGI.DASHED_LINE
        this.bgi.setfillstyle(BGI.SOLID_FILL, BGI.YELLOW);

        // draw and restore state
        await o.run({ hilite: true });
        this.refreshCanvas();
        this.bgi.popState();
        this.bgi.svgActive = activeFlag;
      }
    }
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Mouse event handlers

  // testing BGI mouse handler when canvas is clicked.
  setupMouseTestHandler () {
    this.bgi.registermousehandler(BGI.WM_LBUTTONDOWN, (function(x, y) {
      this.log('bgi', `mouse x,y (${x}, ${y})`);
    }).bind(this));
  }

  // setup mouse events for debug coords display
  setupCoordsMouseEvents () {

    // binding 'this' in event handler to class instance
    this.handleCoordsMouseEvents = this.handleCoordsMouseEvents.bind(this);
    this.canvas.addEventListener('mousemove', this.handleCoordsMouseEvents);
    this.canvas.addEventListener('mouseout', this.handleCoordsMouseEvents);
    if (this.canvasSS) {
      this.canvasSS.addEventListener('mousemove', this.handleCoordsMouseEvents);
      this.canvasSS.addEventListener('mouseout', this.handleCoordsMouseEvents);
    }
    if (this.canvasDiff) {
      this.canvasDiff.addEventListener('mousemove', this.handleCoordsMouseEvents);
      this.canvasDiff.addEventListener('mouseout', this.handleCoordsMouseEvents);
    }
  }

  // event handler for displaying mouse coords
  handleCoordsMouseEvents (e) {

    // debug coords display
    if (this.coordsDiv) {
      const [x, y] = this.bgi._mouseCoords(e);
      if ((e.type === "mouseout") || (x < 0) || (y < 0)) {
        this.coordsDiv.innerHTML = '';
      }
      else if (e.type === "mousemove") {
        this.coordsDiv.innerHTML = `${x}, ${y}`;
      }
    }
  }

  // Draws a Button or Mouse Region, then refreshes canvas.
  // b: object. See createButton() & createMouseRegion() for properties.
  // isDown: true = selected
  updateButton (b, isDown) {

    // FIXME: viewports not implemented yet! (assumes viewport is entire canvas)
    if (typeof b === 'undefined') { return; }
    if (b.isButton) {
      // button
      const bstyle = b.style;
      if ((bstyle.flags & 2) || (bstyle.flags & 4096)) {
        // button is invertable or a Hot Icon
        const bevsize = (bstyle.flags & 512) ? ((bstyle.bevsize > 0) ? bstyle.bevsize : 1) : 0;
        this.drawButton(b.ax1 + bevsize, b.ay1 + bevsize, b.ax2 - bevsize, b.ay2 - bevsize, b, isDown);
      }
    }
    else if (b.invertFlag) {
      // mouse region
      this.drawInvertedBar(b.ax1, b.ay1, b.ax2, b.ay2);
    }
    this.refreshCanvas();
  }

  // selects given button if not already, and unselects all other buttons in same group.
  // uses this.buttons[], modifies button.flags and flags in all buttons in the same group.
  selectRadioButton (button) {

    // if button already selected, ignore it
    if (button && (button.flags & 1)) { return; }

    // only work with radio buttons
    if (button.style.flags & 16384) {

      // cycle thru all radio buttons in the same group
      for (let b of this.buttons) {
        // unselect button only if it's already selected
        if (b.isButton && (b.flags & 1) && (b.style.flags & 16384) && (b.style.grp_no === button.style.grp_no)) {
          b.flags ^= 1; // clear selected flag using XOR
          this.updateButton(b, false);
        }
      }
      // select the button
      this.updateButton(button, true);
      button.flags |= 1; // set selected flag
    }
  }

  // toggles the selected state of a button, and updates selected flag.
  // useful for toggling check buttons, but works with any selected buttons.
  toggleButton (button) {
    const toggled = (button.flags & 1) ? false : true;
    button.flags ^= 1; // toggle selected flag using XOR
    this.updateButton(button, toggled);
  }

  // Activates Button & Mouse Region events,
  // such as normally done after the '#' RIP command.
  // activate: true = turn on, false = turn off mouse events on canvas.
  activateMouseEvents (activate) {
    if (activate) {
      // activate mouse events
      this.canvas.addEventListener('pointerup', this.handleMouseEvents );
      this.canvas.addEventListener('pointerdown', this.handleMouseEvents );
      this.canvas.addEventListener('pointermove', this.handleMouseEvents );
      this.canvas.addEventListener('pointerleave', this.handleMouseEvents );
    }
    else {
      // deactivate mouse events
      this.canvas.removeEventListener('pointerup', this.handleMouseEvents );
      this.canvas.removeEventListener('pointerdown', this.handleMouseEvents );
      this.canvas.removeEventListener('pointermove', this.handleMouseEvents );
      this.canvas.removeEventListener('pointerleave', this.handleMouseEvents );
    }
  }

  // Event listener handler for mouseup, mousedown, mousemove, and mouseleave events.
  // uses: this.buttons[], this.buttonClicked, this.withinButton
  // 'this' is binded to class instance using this.handleMouseEvents.bind(this)
  //
  handleMouseEvents (e) {

    let [x, y] = this.bgi._mouseCoords(e);
    let isWithin = false;

    for (const b of this.buttons) {
      if ((x > b.ax1) && (x < b.ax2) && (y > b.ay1) && (y < b.ay2)) {
        // within area of mouse region
        isWithin = true;
        if ((e.type === 'pointerdown') && (e.button == 0)) {
          // only if main (left) mouse button pressed
          this.updateButton(b, true);
          this.buttonClicked = b;
        }
        else if ((this.buttonClicked !== null) && (e.type === 'pointerup')) {
          this.updateButton(this.buttonClicked, false);

          // only if within previously clicked button or mouse region
          if (b === this.buttonClicked) {
            this.sendHostCommand(b.cmdText);

            // handle radio & check buttons
            if (b.isButton) {
              if (b.style.flags & 16384) {
                // radio button
                this.selectRadioButton(b);
              }
              else if (b.style.flags2 & 1) {
                // toggle check button
                this.toggleButton(b);
              }
            }
          }

          this.buttonClicked = null;
        }
        break;
      }
    }

    // also unselect clicked button if mouseup outside any region
    if ( (isWithin == false) && (this.buttonClicked !== null) && ((e.type === 'pointerup') || (e.type === 'pointerleave')) ) {
      this.updateButton(this.buttonClicked, false);
      this.buttonClicked = null;
    }

    // change cursor if isWithin changed
    if (this.withinButton !== isWithin) {
      this.withinButton = isWithin;
      this.canvas.style.cursor = (isWithin) ? 'pointer' : 'auto';
    }
  }

  // handles sending text to a host from clicking buttons and mouse regions.
  sendHostCommand (text) {

    // TODO: $ variables & host command templates

    this.log('trm', 'send to host: ' + text);
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Drawing methods

  drawBeveledBox (x1, y1, x2, y2, topl_col, botr_col, corner_col, corner_size) {

    if (corner_col && corner_size) {
      const clen = corner_size - 1;

      this.bgi.pushState();
      this.bgi.setlinestyle(BGI.SOLID_LINE);

      // draw bevel polygons
      this.bgi.setcolor(botr_col); // botr_col
      this.bgi.setfillstyle (BGI.SOLID_FILL, botr_col);
      this.bgi.fillpoly(7, [x2-1,y2-1, x1,y2-1, x1+clen+1,y2-clen-2, x2-clen-1,y2-clen-2, x2-clen-1,y1+clen, x2-1,y1-1, x2-1,y2-1] );

      this.bgi.setcolor(topl_col); // topl_col
      this.bgi.setfillstyle (BGI.SOLID_FILL, topl_col);
      this.bgi.fillpoly(7, [x1,y1-1, x2-1,y1-1, x2-clen-2,y1+clen, x1+clen,y1+clen, x1+clen,y2-clen-2, x1,y2-2, x1,y1-1] );

      // draw corners
      this.bgi.line(x1, y1-1, x1+clen, y1+clen-1, corner_col, BGI.COPY_PUT, BGI.SOLID_LINE, 1);
      this.bgi.line(x2-1, y1-1, x2 - clen-1, y1+clen-1, corner_col, BGI.COPY_PUT, BGI.SOLID_LINE, 1);
      this.bgi.line(x1, y2-1, x1+clen, y2-clen-1, corner_col, BGI.COPY_PUT, BGI.SOLID_LINE, 1);
      this.bgi.line(x2-1, y2-1, x2-clen-1, y2-clen-1, corner_col, BGI.COPY_PUT, BGI.SOLID_LINE, 1);

      this.bgi.popState();
    }
  }


  // Implements RIP_MOUSE
  // clk: 1=invert, 0=don't invert.
  // clr: 1= zoom text window to full screen, and clear.
  // text: host command that gets sent when clicked.
  //
  createMouseRegion (x1, y1, x2, y2, clk, clr, text) {

    let button = {};
    button.isButton = false;
    button.cmdText = text;
    button.invertFlag = (clk === 1) ? true : false;
    button.resetFlag = (clr === 1) ? true : false;
    button.zoomFlag = (clr === 1) ? true : false;

    // TODO: use this.bgi.getviewsettings()
    let vp = this.bgi.info.vp;
    button.ax1 = vp.left + x1;
    button.ay1 = vp.top + y1;
    button.ax2 = vp.left + x2 - 1;
    button.ay2 = vp.top + y2 - 1;

    this.buttons.unshift(button);
  }

  clearAllButtons () {
    this.activateMouseEvents(false);
    this.buttons = [];
  }

  // Implements RIP_BUTTON & RIP_BUTTON_STYLE
  // uses this.bgi, this.clipboard, and modifies this.buttonStyle
  //
  async createButton (x1, y1, x2, y2, hotkey, flags, text, bstyle = this.buttonStyle) {

    const [icon_name, label_text, host_cmd] = text.split("<>");
    const bevsize = (bstyle.flags & 512) ? ((bstyle.bevsize > 0) ? bstyle.bevsize : 1) : 0;

    let button = {};
    button.isButton = true;
    button.style = JSON.parse(JSON.stringify(bstyle));
    button.hotkey = hotkey;
    button.flags = flags;
    button.text = text;
    button.cmdText = host_cmd;
    button.invertFlag = (bstyle.flags & 2) ? true : false;
    button.resetFlag = (bstyle.flags & 4) ? true : false; // RIP_RESET_WINDOWS
    button.zoomFlag = (bstyle.flags2 & 4) ? true : false;

    // save current font
    button.textStyle = this.bgi.gettextsettings();

    // include image if Icon button
    if (bstyle.flags & 128) {
      const fname = this.fixIconFilename(icon_name);
      if (fname) {
        button.image = await this.bgi.readimagefile(fname);
      }
    }

    // include image if Clipboard button
    if ((bstyle.flags & 1) && ('width' in this.clipboard) && ('height' in this.clipboard)) {
      button.image = JSON.parse(JSON.stringify(this.clipboard));
    }

    // resize if there's an image
    if (button.image && ('width' in button.image) && ('height' in button.image)) {
      x2 = x1 + button.image.width;
      y2 = y1 + button.image.height;
    }

    // include Hot Icon
    if (bstyle.flags & 4096) {
      const hotname = this.hotIconFilename(icon_name);
      if (hotname) {
        button.hoticon = await this.bgi.readimagefile(hotname);
      }
    }

    // TODO: use this.bgi.getviewsettings()
    let vp = this.bgi.info.vp;
    button.ax1 = vp.left + x1 - bevsize;
    button.ay1 = vp.top + y1 - bevsize;
    button.ax2 = vp.left + x2 + bevsize;
    button.ay2 = vp.top + y2 + bevsize;

    // send host command immediately if pre-selected in a Radio or Checkbox group
    if ((button.flags & 1) && ((bstyle.flags & 16384) || (bstyle.flags2 & 1))) {
      // the spec contradicts itself on this matter, so disabling this for now
      //this.sendHostCommand(host_cmd);
    }

    // only add to list if it's a Mouse Button, and it's a valid button
    if ((bstyle.flags & 1024) && (bstyle.flags & (1 + 128 + 256))) {
      this.buttons.unshift(button);
    }
    return button;
  }

  // Draws an XOR'd white rectangle.
  // (doesn't work in SVG)
  //
  drawInvertedBar (x1, y1, x2, y2) {
    this.bgi._bar(x1, y1, x2-1, y2-1, BGI.WHITE, BGI.XOR_PUT, BGI.SOLID_FILL);
  }

  // Only draws a button without saving anything.
  //
  // properties contained in 'button' obj:
  // hotkey: ASCII value of key to press.
  // flags:
  //   1 = draw as selected.
  //   2 = default when ENTER pressed. (ignore here)
  // text:
  //   ICONFILE[.ICN]<>TEXT LABEL<>HOST COMMAND
  // textStyle: (optional)
  //   { font: 0, direction: 0, charsize: 0 }
  //
  drawButton (x1, y1, x2, y2, button, isSelected = false) {

    const bstyle = button.style;
    const textStyle = button.textStyle;

    if ((bstyle && ('flags' in bstyle) && ((bstyle.flags & (1 + 128 + 256)) !== 0)) === false) {
      // button must be a Clipboard (1), Icon (128), or Plain button (256), else exit
      this.log('rip', "Can't draw invalid button.");
      return;
    }

    const [icon_name, label_text, host_cmd] = button.text.split("<>");
    const bevsize = (bstyle.flags & 512) ? ((bstyle.bevsize > 0) ? bstyle.bevsize : 1) : 0;
    let dback = bstyle.dback;
    let dfore = bstyle.dfore;
    let uline_col = bstyle.uline_col;
    let down = 0, clip_down = 0, isInverted = false;
    if (button.flags & 1) { isSelected = true; }

    //this.log('rip', `${label_text.padStart(10, "_")} : ${bstyle.flags.toString(2).padStart(16, "0")} : ${bstyle.flags2.toString(2).padStart(8, "0")}`); // DEBUG

    // set actual size
    let left = x1, top = y1, right = x2, bot = y2;
    if (bstyle.wid && (bstyle.wid > 0) && bstyle.hgt && (bstyle.hgt > 0)) {
      // style overrides button width & height
      right = left + bstyle.wid; // don't -1!
      bot = top + bstyle.hgt;
    }
    if (('image' in button) && ('width' in button.image) && ('height' in button.image)) {
      // clipboard or icon image overrides button width & height
      right = left + button.image.width;
      bot = top + button.image.height;
      clip_down = 1; // fix to move labels down by 1px (not in spec)
    }

    this.bgi.pushState();
    this.bgi.setlinestyle(BGI.SOLID_LINE);
    this.bgi.setfillstyle(BGI.SOLID_FILL, bstyle.surface);

    // restore text style used when button created
    if (textStyle && ('font' in textStyle) && ('direction' in textStyle) && ('charsize' in textStyle)) {
      this.bgi.settextstyle(textStyle.font, textStyle.direction, textStyle.charsize);
    }

    // prepare if selected
    if (isSelected) {
      // invert normal & highlight text if not center orientation
      if (bstyle.orient != 2) {
        dback ^= 15;
        dfore ^= 15;
        uline_col ^= 15;
      }
      if (this.opts.origButtons === true) {
        isInverted = true;
      }
      else {
        // the alt button rendering shifts by 1 pixel down
        down = 1;
      }
    }

    // draw bevel (+/- bevsize outside)
    if (bevsize > 0) {
      if (isSelected && (this.opts.origButtons === false)) {
        // draw improved selected style: reverse bright & dark colors & shift down
        this.drawBeveledBox(left - bevsize, top - bevsize + 1, right + bevsize, bot + bevsize,
          bstyle.dark, bstyle.bright, bstyle.corner_col, bevsize);
      }
      else {
        // draw not selected
        this.drawBeveledBox(left - bevsize, top - bevsize + 1, right + bevsize, bot + bevsize,
          bstyle.bright, bstyle.dark, bstyle.corner_col, bevsize);
      }
    }

    // draw 1px recess (+/- 2 outside)
    if (bstyle.flags & 16) {
      // draw 1px recess
      this.bgi.line(left-bevsize-1, top-bevsize-2, right+bevsize, top-bevsize-2, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(left-bevsize-2, top-bevsize-1, left-bevsize-2, bot+bevsize, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(right+bevsize+1, top-bevsize-1, right+bevsize+1, bot+bevsize, bstyle.bright, BGI.COPY_PUT);
      this.bgi.line(left-bevsize-1, bot+bevsize+1, right+bevsize, bot+bevsize+1, bstyle.bright, BGI.COPY_PUT);
      // draw corner dots
      this.bgi.putpixel(left-bevsize-2, top-bevsize-2, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(left-bevsize-2, bot+bevsize+1, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(right+bevsize+1, top-bevsize-2, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(right+bevsize+1, bot+bevsize+1, bstyle.corner_col, BGI.COPY_PUT);
      // draw 1px black box outline
      this.bgi.rectangle(left - bevsize - 1, top - bevsize - 1, right + bevsize, bot + bevsize, BGI.BLACK, BGI.COPY_PUT);
    }

    // draw image if present
    if ('image' in button) {
      this.bgi._putimage(left, top, button.image, BGI.COPY_PUT);
    }
    else {
      // draw fill surface
      this.bgi.bar(left, top, right-1, bot-1, bstyle.surface, BGI.COPY_PUT, BGI.SOLID_FILL);
    }

    // draw sunken (inside)
    if (bstyle.flags & 32768) {
      // draw 1px recess
      this.bgi.line(left, top, right-1, top, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(left, top, left, bot-1, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(right-1, top, right-1, bot-1, bstyle.bright, BGI.COPY_PUT);
      this.bgi.line(left, bot-1, right-1, bot-1, bstyle.bright, BGI.COPY_PUT);
      // draw corner dots
      this.bgi.putpixel(left, top, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(right-1, top, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(left, bot-1, bstyle.corner_col, BGI.COPY_PUT);
      this.bgi.putpixel(right-1, bot-1, bstyle.corner_col, BGI.COPY_PUT);
    }

    // draw chisel on top of button image (inside)
    if (bstyle.flags & 8) {
      // position depends on button height and a lookup table of indent values
      let xin, yin, h = bot - top; // don't +1!
      if (h < 12) { xin = 1; yin = 1; }
      else if (h < 25) { xin = 3; yin = 2; }
      else if (h < 40) { xin = 4; yin = 3; }
      else if (h < 75) { xin = 6; yin = 5; }
      else if (h < 150) { xin = 7; yin = 5; }
      else if (h < 200) { xin = 8; yin = 6; }
      else if (h < 250) { xin = 10; yin = 7; }
      else if (h < 300) { xin = 11; yin = 8; }
      else { xin = 13; yin = 9; }

      // draw chisel as 2 rectangles
      // including pixels at top-right & bottom-left
      this.bgi.line(left + xin + down, top + yin + down, right - xin - 1 + down, top + yin + down, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(right - xin - 2 + down, top + yin + down, right - xin - 2 + down, bot - yin - 2 + down, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(right - xin - 2 + down, bot - yin - 2 + down, left + xin + down, bot - yin - 2 + down, bstyle.dark, BGI.COPY_PUT);
      this.bgi.line(left + xin + down, bot - yin - 1 + down, left + xin + down, top + yin + down, bstyle.dark, BGI.COPY_PUT);
      this.bgi.rectangle(left + xin + 1 + down, top + yin + 1 + down, right - xin - 1 + down, bot - yin - 1 + down, bstyle.bright, BGI.COPY_PUT);
    }

    // auto-stamp image onto clipboard
    // TODO: according to spec, this flag modifies future buttons! (see spec)
    if (bstyle.flags & 64) {
      // RipTerm offsets the label by 1px down (not in spec)
      clip_down = 1;
      // TODO: not sure if coords are correct (need to test with recess)
      this.clipboard = this.bgi._getimage(left - bevsize, top - bevsize, right + bevsize - 1, bot + bevsize - 1);
      this.log('rip', 'Auto-stamped button image onto Clipboard.');
      // clear auto-stamp flag so that clipboard save only occurs once
      // TODO: may rethink this? could store in another var instead of clearing flag
      //bstyle.flags = (bstyle.flags & ~64);
    }

    // calculate label text position
    let tw = this.bgi.textwidth(label_text);
    let th = 0;
    let var_h = this.bgi.textheight(label_text, BGI.VAR_HEIGHT); // VAR_HEIGHT, FULL_HEIGHT
    let main_h = this.bgi.textheight(label_text, BGI.MAIN_HEIGHT);
    let above_h = this.bgi.textheight(label_text, BGI.ABOVE_HEIGHT);
    let label_h = main_h;

    //console.log({ left, top, right, bot, orient: bstyle.orient }); // DEBUG
    //console.log({ var_h, main_h, above_h }); // DEBUG
    //console.log({ tw, th }); // DEBUG

    // start with button center
    let tx = left + Math.floor((right - left) / 2);
    let ty = top + Math.floor((bot - top) / 2) + 1 + clip_down;

    //console.log({ tx, ty }); // DEBUG

    // adjust vertical centering of label
    if (bstyle.flags & 8192) {
      // when set, add descenders to height, except when orient = LEFT or RIGHT.
      label_h = var_h;
      //this.log('rip', `adjust vert: ${label_text} main_h=${main_h} var_h=${var_h} above_h=${above_h}`); // DEBUG
    }

    //console.log({ tw, th }); // DEBUG

    // position using orientation
    switch (bstyle.orient) {
      case 0: // above (TODO)
        th += label_h;
        tx -= Math.floor(tw / 2);
        ty = top - th - th + 2; // - bevsize // ??
        break;
      case 1: // left (TODO)
        th += main_h + (main_h - var_h);
        tx = left - bevsize - tw - 8; // ??
        ty -= Math.round(th / 2) + above_h - 1;
        break;
      case 2: // center (testing...)
        // sometimes off by 1 in x or y.
        th += label_h;
        tx -= Math.round(tw / 2) - down; // or floor ?
        ty -= Math.round(th / 2) + above_h - down;
        break;
      case 3: // right (testing...)
        th += main_h + (main_h - var_h);
        tx = right + bevsize + 7; // TODO: replace (+7) constant!?
        ty -= Math.round(th / 2) + above_h - 1;
        break;
      case 4: // below (TODO)
        tx -= Math.ceil(tw / 2); // -1 ??
        ty = bot - 2; // + bevsize // ??
        break;
      default:
    }

    // reposition if left or right aligned
    // TODO: need to consider non-center buttons
    if (bstyle.flags2 & 8) {
      // left-justified
      tx = left + 7; // ?? TODO: increase if chisel is ON?
    }
    else if (bstyle.flags2 & 16) {
      // right-justified
      tx = right - tw - 7; // ??
    }

    //this.log('rip', `tx=${tx}, ty=${ty}, tw=${tw}, th=${th}, above_h=${above_h}`); // DEBUG

    // draw label dropshadow
    if (bstyle.flags & 32) {
      this.bgi.setcolor(dback);
      this.bgi.outtextxy(tx + 1, ty + 1, label_text);
    }
    // draw label text
    this.bgi.setcolor(dfore);
    this.bgi.outtextxy(tx, ty, label_text);

    // only do if a mouse button,
    // underline or highlight first char in label if flags set
    if ((bstyle.flags & 1024) && ((bstyle.flags & 2048) || (bstyle.flags2 & 2))) {

      // find index of hotkey character
      let hotchar = String.fromCharCode(button.hotkey);
      let idx = label_text.indexOf(hotchar);

      if (idx === 0) {
        // highlight first char again as hotkey
        if (bstyle.flags2 & 2) {
          this.bgi.setcolor(uline_col);
          this.bgi.outtextxy(tx, ty, hotchar);
        }
        // underline first char as hotkey (not perfect)
        if (bstyle.flags & 2048) {
          // chars with descenders have underline drawn slightly lower
          let cvalue = button.hotkey & 0xFF; // clip to 0-255
          let under_yoff = (BGI.charDescenders[cvalue] === 0) ? 2 : 3;
          if (bstyle.flags & 32) {
            // draw dropshadow
            this.bgi.setcolor(dback);
            this.bgi.outtextxy(tx + 1, ty + under_yoff + 1, '_');
          }
          this.bgi.setcolor(uline_col);
          this.bgi.outtextxy(tx, ty + under_yoff, '_');
        }
      }
      else if (idx > 0) {
        // draw prefix text again
        this.bgi.setcolor(dfore);
        this.bgi.outtextxy(tx, ty, label_text.slice(0, idx));

        // highlight hotkey
        if (bstyle.flags2 & 2) {
          // TODO: NOT TESTED
          this.bgi.setcolor(uline_col);
          this.bgi.outtext(hotchar);
        }
        // underline hotkey char (not perfect)
        if (bstyle.flags & 2048) {
          // TODO: NOT TESTED
          // chars with descenders have underline drawn slightly lower
          let cvalue = button.hotkey & 0xFF; // clip to 0-255
          let under_yoff = (BGI.charDescenders[cvalue] === 0) ? 2 : 3;
          let cur_tx = this.bgi.getx;
          let cur_ty = this.bgi.gety;
          if (bstyle.flags & 32) {
            // draw dropshadow
            this.bgi.setcolor(dback);
            this.bgi.outtextxy(cur_tx + 1, cur_ty + under_yoff + 1, '_');
          }
          this.bgi.setcolor(uline_col);
          this.bgi.outtextxy(cur_tx, cur_ty + under_yoff, '_');
        }
      }
    }

    // inverts button if drawing as selected
    if (isInverted) {
      this.drawInvertedBar(left - bevsize, top - bevsize, right + bevsize, bot + bevsize);
    }

    // draw hot icon if present
    // (must be here since bevel could invert)
    if (isSelected && ('hoticon' in button)) {
      this.bgi._putimage(left, top, button.hoticon, BGI.COPY_PUT);
    }

    this.bgi.popState();
  }


  ////////////////////////////////////////////////////////////////////////////////
  // RIP commands

  initCommands () {
    this.cmd = {

      // RIP_TEXT_WINDOW (w)

      // RIP_VIEWPORT (v)
      'v': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_VIEWPORT', ...this.parseRIPargs2(args, '2222', ['x0','y0','x1','y1']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              outer.bgi._resetViewport();
              outer.bgi._fillrect(this.x0, this.y0, this.x1, this.y1);
            } else {
              outer.bgi.setviewport(this.x0, this.y0, this.x1, this.y1, true);
            }
          };
          //this.log('rip', `!|v${args} RIP_VIEWPORT ${JSON.stringify(o)}`); // DEBUG
          return o;
        }
      },

      // RIP_RESET_WINDOWS (*)
      //   full text window 80x43, cursor to upper-left, clear screen, viewport to fullscreen
      //   fill with current bgcolor, clear mouse regions, clear clipboard, restore default palette
      '*': (args) => {
        const outer = this;
        let o = { func: 'RIP_RESET_WINDOWS' };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          // don't reset colors & styles!
          // TODO: set text window
          outer.bgi.cleardevice();
          outer.clearAllButtons();
          outer.clipboard = {};
          // TODO: restore default palette
        };
        return o;
      },

      // RIP_ERASE_WINDOW (e)
      // Clears Text Window to background color

      // RIP_ERASE_VIEW (E)
      'E': (args) => {
        const outer = this;
        let o = { func: 'RIP_ERASE_VIEW' };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.bgi.clearviewport();
        };
        return o;
      },

      // RIP_GOTOXY (g)
      // RIP_HOME (H)
      // RIP_ERASE_EOL (>)

      // RIP_COLOR (c)
      'c': (args) => {
        if (args.length >= 2) {
          const outer = this;
          let o = { func: 'RIP_COLOR', ...this.parseRIPargs2(args, '2', ['color']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.setcolor(this.color);
          };
          return o;
        }
      },

      // RIP_SET_PALETTE (Q)
      'Q': (args) => {
        if (args.length >= 32) {
          // parse EGA palette values (0-63)
          const outer = this;
          let o = { func: 'RIP_SET_PALETTE' };
          o.palette = this.parseRIPargs(args, '2222222222222222');
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            for (let i=0; i < this.palette.length; i++) {
              const c = this.palette[i];
              if (c < 64) {
                const [red, green, blue] = outer.hex2rgb( RIPterm.paletteEGA64[c] );
                outer.bgi.setrgbpalette(i, red, green, blue);
              }
            }
          };
          return o;
        }
      },

      // RIP_ONE_PALETTE (a)
      'a': (args) => {
        if (args.length >= 4) {
          // parse EGA palette values (0-63)
          const outer = this;
          let o = { func: 'RIP_ONE_PALETTE', ...this.parseRIPargs2(args, '22', ['color','value']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            if ((this.color < 16) && (this.value < 64)) {
              const [red, green, blue] = outer.hex2rgb( RIPterm.paletteEGA64[this.value] );
              outer.bgi.setrgbpalette(this.color, red, green, blue);
            }
          };
          return o;
        }
      },

      // RIP_WRITE_MODE (W)
      'W': (args) => {
        if (args.length >= 2) {
          const outer = this;
          let o = { func: 'RIP_WRITE_MODE', ...this.parseRIPargs2(args, '2', ['mode']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.setwritemode(this.mode);
          };
          return o;
        }
      },

      // RIP_MOVE (m)
      'm': (args) => {
        if (args.length >= 4) {
          const outer = this;
          let o = { func: 'RIP_MOVE', ...this.parseRIPargs2(args, '22', ['x','y']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.moveto(this.x, this.y);
          };
          return o;
        }
      },

      // RIP_TEXT (T)
      // uses and updates info.cp
      'T': (args) => {
        const outer = this;
        let o = { func: 'RIP_TEXT', ...this.parseRIPargs2(args, '*', ['text']) };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.bgi.outtext(this.text);
        };
        return o;
      },

      // RIP_TEXT_XY (@)
      // updates info.cp
      '@': (args) => {
        const outer = this;
        let o = { func: 'RIP_TEXT_XY', ...this.parseRIPargs2(args, '22*', ['x','y','text']) };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.bgi.outtextxy(this.x, this.y, this.text);
          //outer.log('rip', 'RIP_TEXT_XY: ' + this.text); // DEBUG
        };
        return o;
      },

      // RIP_FONT_STYLE (Y)
      'Y': (args) => {
        const outer = this;
        let o = { func: 'RIP_FONT_STYLE', ...this.parseRIPargs2(args, '2222', ['font','direction','size','res']) };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.bgi.settextstyle(this.font, this.direction, this.size);
        };
        return o;
      },

      // RIP_PIXEL (X)
      // spec says this doesn't use writeMode (mistake?)
      'X': (args) => {
        if (args.length >= 4) {
          const outer = this;
          let o = { func: 'RIP_PIXEL', ...this.parseRIPargs2(args, '22', ['x','y']) };
          o.run = async function(ob = {}) {
            outer.bgi.putpixel(this.x, this.y); // uses writeMode
          };
          return o;
        }
      },

      // RIP_LINE (L)
      'L': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_LINE', ...this.parseRIPargs2(args, '2222', ['x0','y0','x1','y1']) };
          o.run = async function(ob = {}) {
            outer.bgi.line(this.x0, this.y0, this.x1, this.y1);
          };
          return o;
        }
      },

      // RIP_RECTANGLE (R)
      'R': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_RECTANGLE', ...this.parseRIPargs2(args, '2222', ['x0','y0','x1','y1']) };
          o.run = async function(ob = {}) {
            outer.bgi.rectangle(this.x0, this.y0, this.x1, this.y1);
          };
          return o;
        }
      },

      // RIP_BAR (B)
      // Fills a rectangle using fill color and pattern, without border.
      // spec says this doesn't use writeMode (mistake?)
      'B': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_BAR', ...this.parseRIPargs2(args, '2222', ['x0','y0','x1','y1']) };
          o.run = async function(ob = {}) {
            outer.bgi.bar(this.x0, this.y0, this.x1, this.y1); // uses writeMode
          };
          return o;
        }
      },

      // RIP_CIRCLE (C)
      'C': (args) => {
        if (args.length >= 6) {
          const outer = this;
          let o = { func: 'RIP_CIRCLE', ...this.parseRIPargs2(args, '222', ['x','y','radius']) };
          o.run = async function(ob = {}) {
            outer.bgi.circle(this.x, this.y, this.radius);
          };
          return o;
        }
      },

      // RIP_OVAL (O)
      // does same as RIP_OVAL_ARC (V)
      // weird that this includes start & end angles
      'O': (args) => {
        let o = this.cmd['V'](args);
        o.func = 'RIP_OVAL';
        return o;
      },

      // RIP_FILLED_OVAL (o)
      'o': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_FILLED_OVAL', ...this.parseRIPargs2(args, '2222', ['x','y','x_rad','y_rad']) };
          o.run = async function(ob = {}) {
            outer.bgi.fillellipse(this.x, this.y, this.x_rad, this.y_rad);
            outer.bgi.ellipse(this.x, this.y, 0, 360, this.x_rad, this.y_rad); // may be included in fillellipse() ?
          };
          return o;
        }
      },

      // RIP_ARC (A)
      'A': (args) => {
        if (args.length >= 10) {
          const outer = this;
          let o = { func: 'RIP_ARC', ...this.parseRIPargs2(args, '22222', ['x','y','start_ang','end_ang','radius']) };
          o.run = async function(ob = {}) {
            outer.bgi.arc(this.x, this.y, this.start_ang, this.end_ang, this.radius);
          };
          return o;
        }
      },

      // RIP_OVAL_ARC (V)
      // does same as RIP_OVAL (O)
      'V': (args) => {
        if (args.length >= 12) {
          const outer = this;
          let o = { func: 'RIP_OVAL_ARC', ...this.parseRIPargs2(args, '222222', ['x','y','st_ang','e_ang','radx','rady']) };
          o.run = async function(ob = {}) {
            outer.bgi.ellipse(this.x, this.y, this.st_ang, this.e_ang, this.radx, this.rady);
          };
          return o;
        }
      },

      // RIP_PIE_SLICE (I)
      'I': (args) => {
        if (args.length >= 10) {
          const outer = this;
          let o = { func: 'RIP_PIE_SLICE', ...this.parseRIPargs2(args, '22222', ['x','y','start_ang','end_ang','radius']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              // temp highlight: draw a box around it
              outer.bgi._fillrect(this.x-this.radius, this.y-this.radius, this.x+this.radius, this.y+this.radius);
            } else {
              outer.bgi.pieslice(this.x, this.y, this.start_ang, this.end_ang, this.radius);
            }
          };
          return o;
        }
      },

      // RIP_OVAL_PIE_SLICE (i)
      'i': (args) => {
        if (args.length >= 12) {
          const outer = this;
          let o = { func: 'RIP_OVAL_PIE_SLICE', ...this.parseRIPargs2(args, '222222', ['x','y','st_ang','e_ang','radx','rady']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              // temp highlight: draw a box around it
              outer.bgi._fillrect(this.x-this.radx, this.y-this.rady, this.x+this.radx, this.y+this.rady);
            } else {
              outer.bgi.sector(this.x, this.y, this.st_ang, this.e_ang, this.radx, this.rady);
            }
          };
          return o;
        }
      },

      // RIP_BEZIER (Z)
      'Z': (args) => {
        if (args.length >= 18) {
          const outer = this;
          let o = { func: 'RIP_BEZIER' };
          let points = this.parseRIPargs(args, '222222222'); // 9 ints
          o.cnt = points.pop();
          o.points = points;
          o.run = async function(ob = {}) {
            outer.bgi.drawbezier(this.cnt, this.points);
          };
          return o;
        }
      },

      // RIP_POLYGON (P)
      'P': (args) => {
        const outer = this;
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        let o = { func: 'RIP_POLYGON', npoints, pp };
        o.run = async function(ob = {}) {
          outer.bgi.drawpoly(this.npoints, this.pp);
        };
        return o;
      },

      // RIP_FILL_POLYGON (p)
      'p': (args) => {
        const outer = this;
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        // draw both a filled polygon using fill color & bgcolor,
        // and polygon outline using fgcolor, line style, and thickness.
        let o = { func: 'RIP_FILL_POLYGON', npoints, pp };
        o.run = async function(ob = {}) {
          outer.bgi.fillpoly(this.npoints, this.pp);
        };
        return o;
      },

      // RIP_POLYLINE (l)
      // this was introduced in RIPscrip v1.54 (not present in v1.52)
      'l': (args) => {
        const outer = this;
        let pp = this.parseRIPpoly(args);
        let npoints = pp.shift();
        let o = { func: 'RIP_POLYLINE', npoints, pp };
        o.run = async function(ob = {}) {
          outer.bgi.drawpolyline(this.npoints, this.pp);
        };
        return o;
      },

      // RIP_FILL (F)
      'F': (args) => {
        if (args.length >= 6) {
          const outer = this;
          let o = { func: 'RIP_FILL', ...this.parseRIPargs2(args, '222', ['x','y','border']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.floodfill(this.x, this.y, this.border);
          };
          return o;
        }
      },

      // RIP_LINE_STYLE (=)
      // pre-defined styles introduced in RIPscrip v1.54 (only custom-defined in v1.52 ??)
      '=': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_LINE_STYLE', ...this.parseRIPargs2(args, '242', ['style','user_pat','thick']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.setlinestyle(this.style, this.user_pat, this.thick);
          };
          return o;
        }
      },

      // RIP_FILL_STYLE (S)
      'S': (args) => {
        if (args.length >= 4) {
          const outer = this;
          let o = { func: 'RIP_FILL_STYLE', ...this.parseRIPargs2(args, '22', ['pattern','color']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.setfillstyle(this.pattern, this.color);
          };
          return o;
        }
      },

      // RIP_FILL_PATTERN (s)
      's': (args) => {
        if (args.length >= 18) {
          const outer = this;
          let o = { func: 'RIP_FILL_PATTERN', ...this.parseRIPargs2(args, '222222222', ['c1','c2','c3','c4','c5','c6','c7','c8','color']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.setfillpattern([this.c1, this.c2, this.c3, this.c4, this.c5, this.c6, this.c7, this.c8], this.color);
          };
          return o;
        }
      },

      // RIP_MOUSE (1M)
      '1M': (args) => {
        if (args.length >= 17) {
          const outer = this;
          let o = { func: 'RIP_MOUSE', ...this.parseRIPargs2(args, '22222115*', ['num','x0','y0','x1','y1','clk','clr','res','text']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              outer.bgi._fillrect(this.x0, this.y0, this.x1, this.y1);
            } else {
              outer.createMouseRegion(this.x0, this.y0, this.x1, this.y1, this.clk, this.clr, this.text);
            }
          };
          return o;
        }
      },

      // RIP_KILL_MOUSE_FIELDS (1K)
      '1K': (args) => {
        const outer = this;
        let o = { func: 'RIP_KILL_MOUSE_FIELDS' };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.clearAllButtons();
        };
        return o;
      },

      // RIP_BEGIN_TEXT (1T)
      // RIP_REGION_TEXT (1t)
      // RIP_END_TEXT (1R)

      // RIP_GET_IMAGE (1C)
      '1C': (args) => {
        if (args.length >= 9) {
          const outer = this;
          let o = { func: 'RIP_GET_IMAGE', ...this.parseRIPargs2(args, '22221', ['x0','y0','x1','y1','res']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              outer.bgi._fillrect(this.x0, this.y0, this.x1, this.y1);
            } else {
              outer.clipboard = outer.bgi.getimage(this.x0, this.y0, this.x1, this.y1);
            }
          };
          return o;
        }
      },

      // RIP_PUT_IMAGE (1P)
      '1P': (args) => {
        if (args.length >= 7) {
          const outer = this;
          let o = { func: 'RIP_PUT_IMAGE', ...this.parseRIPargs2(args, '2221', ['x','y','mode','res']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.bgi.putimage(this.x, this.y, outer.clipboard, this.mode);
          };
          return o;
        }
      },

      // RIP_WRITE_ICON (1W)

      // RIP_LOAD_ICON (1I)
      '1I': (args) => {
        if (args.length >= 9) {
          const outer = this;
          let o = { func: 'RIP_LOAD_ICON', ...this.parseRIPargs2(args, '22212*', ['x','y','mode','clipflag','res','filename']) };
          o.run = async function(ob = {}) {
            const fname = outer.fixIconFilename(this.filename);
            if (fname) {
              if (ob.hilite) {
                const img = await outer.bgi.readimagefile(fname);
                if (img && img.data) {
                  outer.bgi._fillrect(this.x, this.y, this.x + img.width, this.y + img.height);
                }
              } else {
                outer.log('rip', 'RIP_LOAD_ICON: ' + fname);
                const img = await outer.bgi.readimagefile(fname);
                outer.bgi.putimage(this.x, this.y, img, this.mode);
                if (this.clipflag === 1) {
                  outer.clipboard = img;
                }
              }
            }
          };
          return o;
        }
      },

      // RIP_BUTTON_STYLE (1B)
      '1B': (args) => {
        if (args.length >= 30) {
          const outer = this;
          let o = { func: 'RIP_BUTTON_STYLE', ...this.parseRIPargs2(args, '22242222222222', ['wid','hgt','orient','flags','bevsize','dfore','dback','bright','dark','surface','grp_no','flags2','uline_col','corner_col']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            outer.buttonStyle = this; // doesn't need .func or .run
          };
          return o;
        }
      },

      // RIP_BUTTON (1U)
      '1U': (args) => {
        if (args.length >= 9) {
          const outer = this;
          let o = { func: 'RIP_BUTTON', ...this.parseRIPargs2(args, '2222211*', ['x0','y0','x1','y1','hotkey','flags','res','text']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) {
              outer.bgi._fillrect(this.x0, this.y0, this.x1, this.y1);
            } else {
              let btn = await outer.createButton(this.x0, this.y0, this.x1, this.y1, this.hotkey, this.flags, this.text);
              outer.drawButton(this.x0, this.y0, this.x1, this.y1, btn, false);
            }
          };
          return o;
        }
      },

      // RIP_DEFINE (1D)
      // RIP_QUERY (1<esc>)
      // RIP_COPY_REGION (1G)
      // RIP_READ_SCENE (1R)
      // RIP_FILE_QUERY (1F)

      // RIP_ENTER_BLOCK_MODE (9<esc>)

      // RIP_HEADER (h) - RIPscrip v2.0
      'h': (args) => {
        if (args.length >= 8) {
          const outer = this;
          let o = { func: 'RIP_HEADER', ...this.parseRIPargs2(args, '242', ['revision','flags','res']) };
          o.run = async function(ob = {}) {
            if (ob.hilite) { return }
            if (this.revision > 0) {
              outer.log('rip', 'RIPscrip 2.0 or above NOT SUPPORTED at this time!');
            }
          };
          return o;
        }
      },

      // RIP_COMMENT (!) v2.0
      // (leave commented out so it shows red)
      //'!': (args) => {
        // do nothing
      //},

      // RIP_NO_MORE (#)
      '#': (args) => {
        // do nothing
        const outer = this;
        let o = { func: 'RIP_NO_MORE' };
        o.run = async function(ob = {}) {
          if (ob.hilite) { return }
          outer.activateMouseEvents(true);
        };
        return o;
      }
    }
  }

} // end class RIPterm
////////////////////////////////////////////////////////////////////////////////
