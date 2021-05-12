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
}


////////////////////////////////////////////////////////////////////////////////
// Main Class

// DIV ids that may be set:
//   args.canvasId  - main canvas (REQUIRED)
//   args.ripTextId - show list of rip commands in div
//   args.counterId - show command counter in div (e.g. '5 / 100')
//   args.svgId     - draw to an SVG tag (experimental)

class RIPterm {

  constructor (args) {

    if (args && ('canvasId' in args)) {

      // passed in args assigned to properties
      this.canvasId = args.canvasId;
      this.svgId    = args.svgId;
      this.ripTextId = args.ripTextId;
      this.counterId = args.counterId;

      // set property defaults if not in args
      this.timeInterval = ('timeInterval' in args) ? args.timeInterval : 1;
      this.floodFill = ('floodFill' in args) ? args.floodFill : true;
      this.svgPrevix = ('svgPrefix' in args) ? args.svgPrefix : 'rip'; // used in internal SVG ids

      // debug properties
      this.debugVerbose = ('debugVerbose' in args) ? args.debugVerbose : false;
      this.pauseOn = ('pauseOn' in args) ? args.pauseOn : [];
      this.debugFillBuf = ('debugFillBuf' in args) ? args.debugFillBuf : false; // display flood-fill buffer
      this.svgIncludePut = ('svgIncludePut'in args) ? args.svgIncludePut : false; // adds '1P' RIP_PUT_IMAGE to SVG (experimental)

      // init canvas
      const canvas = document.getElementById(this.canvasId);
      this.ctx = canvas.getContext('2d');
      this.bgi = new BGI(this.ctx);


      // set that weird aspect ratio used in original EGA-mode RipTerm DOS version.
      this.bgi.setaspectratio(371, 480); // = 0.7729

      this.initCommands();
    }
    else {
      console.error('RIPterm() missing canvasId!');
    }

  }


  ////////////////////////////////////////////////////////////////////////////////
  // Public methods

  start () {
    console.log('RIPterm.start()');

  }

  stop () {
    console.log('RIPterm.stop()');

  }

  reset () {
    console.log('RIPterm.reset()');

  }

  clear () {
    console.log('RIPterm.clear()');

  }

  // .drawNext()


  fullscreen () {
    console.log('RIPterm.fullscreen()');
    // fullscreenchange()

  }

  readFile (url) {
    console.log('RIPterm.readFile(): ' + url);

  }

  ////////////////////////////////////////////////////////////////////////////////
  // Private methods

  // hex is '#rgb' or '#rrggbb', returns [R, G, B] where values are 0-255
  hex2rgb (hex) {
    return (hex.length == 4) ?
      ['0x' + hex[1] + hex[1] | 0, '0x' + hex[2] + hex[2] | 0, '0x' + hex[3] + hex[3] | 0]:
      ['0x' + hex[1] + hex[2] | 0, '0x' + hex[3] + hex[4] | 0, '0x' + hex[5] + hex[6] | 0];
  }

  runCommand (cmd) {
    // TODO
  }

  ////////////////////////////////////////////////////////////////////////////////
  // RIP commands

  initCommands () {
    this.cmd = {

      // RIP_TEXT_WINDOW (w)

      // RIP_VIEWPORT (v)
      'v': (args) => {
        // this.bgi.setviewport(x1, y1, x2, y2, clip);
      },

      /*
      // RIP_RESET_WINDOWS (*)
      // implements: clear screen, restore default palette
      '*': (args) => {
        // resetGlob();
        // resetPalette();
        this.bgi.cleardevice();
      },
      */

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
        // if (args.length >= 2) { glob.drawColor = parseRIPint(args, 0); }
        // this.bgi.setcolor(c);
      },

      // RIP_SET_PALETTE (Q)
      // RIP_ONE_PALETTE (a)
      // RIP_WRITE_MODE (W)
      // RIP_MOVE (m)
      // RIP_TEXT (T)
      // RIP_TEXT_XY (@)
      // RIP_FONT_STYLE (Y)

      // RIP_PIXEL (X)
      // spec says this doesn't use writeMode
      'X': (args) => {
        if (args.length >= 4) {
          // var x = parseRIPint(args, 0);
          // var y = parseRIPint(args, 2);
          // this.bgi.putpixel(x, y);
        }
      },

      // RIP_LINE (L)
      'L': (args) => {
        if (args.length >= 8) {
          // var x0 = parseRIPint(args, 0);
          // var y0 = parseRIPint(args, 2);
          // var x1 = parseRIPint(args, 4);
          // var y1 = parseRIPint(args, 6);
          // this.bgi.line(x0, y0, x1, y1);
        }
      },

      // RIP_RECTANGLE (R)
      'R': (args) => {
        if (args.length >= 8) {
          // var x0 = parseRIPint(args, 0);
          // var y0 = parseRIPint(args, 2);
          // var x1 = parseRIPint(args, 4);
          // var y1 = parseRIPint(args, 6);
          // this.bgi.rectangle (x0, y0, x1, y1);
        }
      },

      // RIP_BAR (B)
      // spec says this doesn't use writeMode (could spec be wrong??)
      'B': (args) => {
        if (args.length >= 8) {
          // var x0 = parseRIPint(args, 0);
          // var y0 = parseRIPint(args, 2);
          // var x1 = parseRIPint(args, 4);
          // var y1 = parseRIPint(args, 6);
          // this.bgi.bar(left, top, right, bottom);
        }
      },

      // RIP_CIRCLE (C)
      'C': (args) => {
        if (args.length >= 6) {
          /*
          var xc = parseRIPint(args, 0);
          var yc = parseRIPint(args, 2);
          var xr = parseRIPint(args, 4) || 1; // 0.5
          var yr = xr * ASPECT_RATIO;
          drawOvalArc(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick);
          */
          // this.bgi.circle(x, y, radius);
        }
      },

      // RIP_OVAL (O) - same as RIP_OVAL_ARC (V)
      // RIP_FILLED_OVAL (o)
      // RIP_ARC (A)
      // RIP_OVAL_ARC (V)
      // RIP_PIE_SLICE (I)
      // RIP_OVAL_PIE_SLICE (i)
      // RIP_BEZIER (Z)
      // RIP_POLYGON (P)
      // RIP_FILL_POLYGON (p)
      // RIP_POLYLINE (l)
      // RIP_FILL (F)
      // RIP_LINE_STYLE (=)
      // RIP_FILL_STYLE (S)
      // RIP_FILL_PATTERN (s)

      // RIP_MOUSE (1M)
      // RIP_KILL_MOUSE_FIELDS (1K)
      // RIP_BEGIN_TEXT (1T)
      // RIP_REGION_TEXT (1t)
      // RIP_END_TEXT (1R)

      // RIP_GET_IMAGE (1C)
      // RIP_PUT_IMAGE (1P)

      // RIP_WRITE_ICON (1W)
      // RIP_LOAD_ICON (1I)
      // RIP_BUTTON_STYLE (1B)
      // RIP_BUTTON (1U)
      // RIP_DEFINE (1D)
      // RIP_QUERY (1<esc>)
      // RIP_COPY_REGION (1G)
      // RIP_READ_SCENE (1R)
      // RIP_FILE_QUERY (1F)

      // RIP_NO_MORE (#)
      '#': (args) => {
        // do nothing
      }
    }
  }

} // end class RIPterm
////////////////////////////////////////////////////////////////////////////////
