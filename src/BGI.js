/**
 * BGI.js
 * Copyright (c) 2020-2021 Carl Gorringe 
 * https://carl.gorringe.org
 * https://github.com/cgorringe/RIPtermJS
 *
 * Borland Graphics Interface (BGI) for JavaScript
 * https://en.wikipedia.org/wiki/Borland_Graphics_Interface
 * 
 * This is a subset of the library which emulates only some BGI functions.
 *
 * Used source code from:
 * https://github.com/genpfault/sdl-bgi
 * https://github.com/buhtu4ek/OsXBGI
 *
 * BGI Docs:
 * https://www.cs.colorado.edu/~main/bgi/doc/
 * http://math.ubbcluj.ro/~sberinde/wingraph/
 *
 **/

export class BGI {

  ////////////////////////////////////////////////////////////////////////////////
  // class constants

  static
    // fonts
    DEFAULT_FONT=0, TRIPLEX_FONT=1, SMALL_FONT=2, SANSSERIF_FONT=3,
    GOTHIC_FONT=4, BIG_FONT=5, SCRIPT_FONT=6, SIMPLEX_FONT=7,
    TRIPLEX_SCR_FONT=8, COMPLEX_FONT=9, EUROPEAN_FONT=10, BOLD_FONT=11,

    // text alignment used in settextjustify()
    HORIZ_DIR=0, VERT_DIR=1, // text_just enum
    LEFT_TEXT=0, CENTER_TEXT=1, RIGHT_TEXT=2,
    BOTTOM_TEXT=0, TOP_TEXT=2, // or is it?? top=0 bottom=1 baseline=2

    // BGI colors
    BLACK=0, BLUE=1, GREEN=2, CYAN=3, RED=4, MAGENTA=5, BROWN=6,
    LIGHTGRAY=7, DARKGRAY=8, LIGHTBLUE=9, LIGHTGREEN=10, LIGHTCYAN=11, 
    LIGHTRED=12, LIGHTMAGENTA=13, YELLOW=14, WHITE=15,
    MAXCOLORS=15, 
    BGI_COLORS=16, // do we need this?

    // line style, thickness, and drawing mode
    SOLID_LINE=0, DOTTED_LINE=1, CENTER_LINE=2, DASHED_LINE=3, USERBIT_LINE=4, // line_styles enum
    NORM_WIDTH=1, THICK_WIDTH=3,
    COPY_PUT=0, XOR_PUT=1, OR_PUT=2, AND_PUT=3, NOT_PUT=4, // putimage_ops enum

    // fill styles
    EMPTY_FILL=0, SOLID_FILL=1, LINE_FILL=2, LTSLASH_FILL=3, SLASH_FILL=4,
    BKSLASH_FILL=5, LTBKSLASH_FILL=6, HATCH_FILL=7, XHATCH_FILL=8,
    INTERLEAVE_FILL=9, WIDE_DOT_FILL=10, CLOSE_DOT_FILL=11, USER_FILL=12,

    // numbers
    PI_CONV = (3.1415926 / 180.0);


  // TODO: do I need these?
  //const bgi_palette = [
  //  '#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#a50', '#aaa',
  //  '#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'
  //];

  // don't want both below...

  // packed ARGB values (0xAARRGGBB) in C++ style
  static bgi_palette = [
    0xFF000000, // 00 BLACK
    0xFF0000AA, // 01 BLUE
    0xFF00AA00, // 02 GREEN
    0xFF00AAAA, // 03 CYAN
    0xFFAA0000, // 04 RED
    0xFFAA00AA, // 05 MAGENTA
    0xFFAA5500, // 06 BROWN
    0xFFAAAAAA, // 07 LIGHTGRAY
    0xFF555555, // 08 DARKGRAY
    0xFF5555FF, // 09 LIGHTBLUE
    0xFF55FF55, // 0A LIGHTGREEN
    0xFF55FFFF, // 0B LIGHTCYAN
    0xFFFF5555, // 0C LIGHTRED
    0xFFFF55FF, // 0D LIGHTMAGENTA
    0xFFFFFF55, // 0E YELLOW
    0xFFFFFFFF  // 0F WHITE
  ];

  // RGBA32 format: R, G, B, A
  static ega_palette = [
    0x00, 0x00, 0x00, 0xFF, // 00 BLACK
    0x00, 0x00, 0xAA, 0xFF, // 01 BLUE
    0x00, 0xAA, 0x00, 0xFF, // 02 GREEN
    0x00, 0xAA, 0xAA, 0xFF, // 03 CYAN
    0xAA, 0x00, 0x00, 0xFF, // 04 RED
    0xAA, 0x00, 0xAA, 0xFF, // 05 MAGENTA
    0xAA, 0x55, 0x00, 0xFF, // 06 BROWN
    0xAA, 0xAA, 0xAA, 0xFF, // 07 LIGHTGRAY
    0x55, 0x55, 0x55, 0xFF, // 08 DARKGRAY
    0x55, 0x55, 0xFF, 0xFF, // 09 LIGHTBLUE
    0x55, 0xFF, 0x55, 0xFF, // 0A LIGHTGREEN
    0x55, 0xFF, 0xFF, 0xFF, // 0B LIGHTCYAN
    0xFF, 0x55, 0x55, 0xFF, // 0C LIGHTRED
    0xFF, 0x55, 0xFF, 0xFF, // 0D LIGHTMAGENTA
    0xFF, 0xFF, 0x55, 0xFF, // 0E YELLOW
    0xFF, 0xFF, 0xFF, 0xFF, // 0F WHITE
  ];

  static line_patterns = [
    0xFFFF, // 00 SOLID_LINE  : 1111111111111111
    0xCCCC, // 01 DOTTED_LINE : 1100110011001100
    0xF1F8, // 02 CENTER_LINE : 1111000111111000
    0xF8F8, // 03 DASHED_LINE : 1111100011111000
    0xFFFF,
  ];

  static fill_patterns = [
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // 00 EMPTY_FILL
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], // 01 SOLID_FILL
    [0xFF, 0xFF, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00], // 02 LINE_FILL
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80], // 03 LTSLASH_FILL
    [0x03, 0x06, 0x0C, 0x18, 0x30, 0x60, 0xC0, 0x81], // 04 SLASH_FILL
    [0xC0, 0x60, 0x30, 0x18, 0x0C, 0x06, 0x03, 0x81], // 05 BKSLASH_FILL
    [0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01], // 06 LTBKSLASH_FILL
    [0x22, 0x22, 0xFF, 0x22, 0x22, 0x22, 0xFF, 0x22], // 07 HATCH_FILL
    [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81], // 08 XHATCH_FILL
    [0x11, 0x44, 0x11, 0x44, 0x11, 0x44, 0x11, 0x44], // 09 INTERLEAVE_FILL
    [0x10, 0x00, 0x01, 0x00, 0x10, 0x00, 0x01, 0x00], // 0A WIDE_DOT_FILL
    [0x11, 0x00, 0x44, 0x00, 0x11, 0x00, 0x44, 0x00], // 0B CLOSE_DOT_FILL
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], // 0C USER_FILL
  ];

  /*
  // from ripterm.js
    [0xE0, 0xC1, 0x83, 0x07, 0x0E, 0x1C, 0x38, 0x70], // 04
    [0xF0, 0x78, 0x3C, 0x1E, 0x0F, 0x87, 0xC3, 0xE1], // 05
    [0xA5, 0xD2, 0x69, 0xB4, 0x5A, 0x2D, 0x96, 0x4B], // 06
    [0xFF, 0x88, 0x88, 0x88, 0xFF, 0x88, 0x88, 0x88], // 07
    [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81], // 08
    [0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33], // 09
    [0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00], // 0A
    [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00]  // 0B
  */

  ////////////////////////////////////////////////////////////////////////////////
  // instance properties

  constructor (ctx, width, height) {

    this.initContext(ctx, width, height);
    // which assigns these:
    //   this.ctx     : CanvasRenderingContext2D()
    //   this.pixels  : Uint8ClampedArray()
    //   this.imgData : ImageData()

    // public fields
    this.width = 1;
    this.height = 1;
    this.isBuffered = true; // true = copy pixels to context, false = using context data store
    this.palette = new Uint8ClampedArray(256 * 4); // RGBA32 [r, g, b, a] same as npm's canvas
    this.info = BGI.infoDefaults();

  }


  // properties

  /*
  // TO REMOVE
  let _imageData;  // ImageData() used in drawing to an html canvas
  get imageData () {
    // TODO: do we copy the byte buffer over here, or in another method call?
    return this._imageData;
  }
  */

  ////////////////////////////////////////////////////////////////////////////////
  // General methods


  unimplemented (method) {
    console.log('BGI.' + method + '() not implemented.')
  }

  // NOT in BGI (REMOVE)
  /*
  initCanvas (canvas_id) {
    // just an idea...
    // grab width & height from canvas
  }
  */

  static infoDefaults () {
    return {
      bgcolor: BGI.BLACK,
      fgcolor: BGI.WHITE,
      // need to set fill.fpattern whenever fill.style is set
      fill: { style: BGI.SOLID_FILL, color: BGI.WHITE, fpattern: BGI.fill_patterns[BGI.SOLID_FILL] },
      line: { style: BGI.SOLID_LINE, upattern: 0xFFFF, thickness: 1 },
      cp: { x: 0, y: 0 }, // current position
      vp: { left: 0, top: 0, right: (this.width - 1), bottom: (this.height - 1), clip: 0 }, // viewport / visual page?
      // ap: { left: 0, top: 0, right: (this.width - 1), bottom: (this.height - 1), clip: 0 }, // active port / page?
      // max: { x: (this.width - 1), y: (this.height - 1) }, // just use width & height?
      writeMode: 0, // 0=COPY, 1=XOR, 2=OR, 3=AND, 4=NOT
      font: { width: 0, height: 0 }, // ??
      fontMag: { x: 1.0, y: 1.0 }, // font magnification
      aspect: { x: 100, y: 100 }, // aspect ratio used to make circles round
      text: { font: 0, direction: 0, charsize: 0, horiz: 0, vert: 0 },
    };
  }

  // Initializes BGI with a canvas context. [not in BGI]
  // ctx comes from canvas.getContext('2d').
  // ctx can come from canvas.getContext('2d', { pixelFormat: 'A8' }) if using a node canvas.
  // width & height are optional if ctx comes from a browser canvas.

  /*
    // Example browser code:
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')
    // ctx in RGBA32 format uses Uint8ClampedArray 4 bytes-per-pixel.

    // Example node code:
    const { createCanvas, loadImage } = require('canvas')
    const canvas = createCanvas(640, 350)
    const ctx = canvas.getContext('2d', { pixelFormat: 'A8' })
    // ctx is indexed Uint8ClampedArray 1 byte-per-pixel.
  */

  initContext (ctx, width, height) {

    this.ctx = ctx
    if (width && height) {
      // used provided size
      this.width = Math.floor(width);
      this.height = Math.floor(height);
    }
    else if (ctx.canvas) {
      // get size from browser canvas
      this.width = Math.floor(ctx.canvas.width);
      this.height = Math.floor(ctx.canvas.height);
    }
    else {
      console.error('Missing width or height in context passed to BGI()!');
      return;
    }

    // needed to access context pixel data ??
    //this.imgData = ctx.getImageData(0, 0, this.width, this.height);
    this.imgData = ctx.createImageData(this.width, this.height);

    // Do we need to use this for 'A8' pixel format?
    // this.imgData = new ImageData(new Uint8ClampedArray(size), width, height)

    // check to see if ctx is already using 8-bit indexed pixel data
    let attr = ctx.getContextAttributes();
    if (attr && (attr.pixelFormat === 'A8') /* && this.imgData && this.imgData.data */) {
      // use existing context data, which may be used in node canvas [NOT TESTED]
      // does this a reference or a copy?
      this.pixels = this.imgData.data;
      //this.pixels = new Uint8ClampedArray(this.width * this.height)
      this.isBuffered = false;
    }
    else {
      // create a new byte buffer for pixel data, which is usually the case in browsers
      this.pixels = new Uint8ClampedArray(this.width * this.height)
      this.isBuffered = true;
    }

  }

  // TODO: rethink this or replace
  // int width, int height, const char* title="Windows BGI", int left=0, int top=0, bool dbflag=false, bool closeflag=true
  // return value is an id to later use in setcurrentwindow()
  initwindow (width, height) {

    /*
    // do I need "this" ?
    this._imageData = new ImageData(width, height);
    this.pixels = new Uint8ClampedArray(width * height);

    this.info.max.x = width - 1;
    this.info.max.y = height - 1;
    */

    // don't need these here, as they're reset in graphdefaults()
    //info.vp = { x1:0, y1:0, x2:0, y2:0, clip:0 };
    //info.ap = { x1:0, y1:0, x2:0, y2:0, clip:0 };

    this.graphdefaults();

    return 0;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Extra methods


  // updates the screen
  refresh () {

    if (!(ctx && this.imgData && this.pixels && this.palette)) { return false; }

    //const img = ctx.getImageData(0, 0, this.width, this.height);
    const img = this.imgData;

    // copy pixel buffer to img
    if (this.isBuffered) {
      // copy 8-bit pixels to 32-bit imgData
      const numpix = this.pixels.length;
      let pi = 0;
      for (let i=0, j=0; i < numpix; i++, j+=4) {
        pi = this.pixels[i] * 4;
        img.data[j + 0] = this.palette[pi + 0]; // R
        img.data[j + 1] = this.palette[pi + 1]; // G
        img.data[j + 2] = this.palette[pi + 2]; // B
        img.data[j + 3] = 255; // A
      }
    }
    /*
    else {
      // using 8-bit imgData
      let numpix = this.pixels.length;
      for (let i=0; i < numpix; i++) {
        img.data[i] = this.pixels[i];
      }
      // assumes this.pixels point to this.imgData.data
      //ctx.putImageData(this.imgData, 0, 0);
    }
    */
    ctx.putImageData(img, 0, 0);
    return true;
  }

  // conditionally refreshes the screen or schedule it
  update () {
    // TODO
    this.refresh();
  }

  // (see line 3225 & 3362 of SDL_bgi.c)
  // Draws a pixel offset by and clipped by current viewport.
  putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {

    const vp = this.info.vp;
    x += vp.left;
    y += vp.top;

    if ( (x >= 0) && (x < this.width) && (y >= 0) && (y < this.height) &&
      (!vp.clip || ((x >= vp.left) && (x <= vp.right) && (y >= vp.top) && (y <= vp.bottom))) ) {

      switch (wmode) {
        default:
        case BGI.COPY_PUT:
          this.pixels[y * this.width + x] = color;
          break;
        case BGI.XOR_PUT:
          this.pixels[y * this.width + x] ^= color;
          break;
        case BGI.OR_PUT:
          this.pixels[y * this.width + x] |= color;
          break;
        case BGI.AND_PUT:
          this.pixels[y * this.width + x] &= color;
          break;
        case BGI.NOT_PUT:
          this.pixels[y * this.width + x] = (~color & 0x0F); // FIXME: currently limited to EGA colors 0-15
      }
    }
  }

  // TODO: compare to _putpixel(x, y)

  // NOT USED
  // Draws a pixel relative to canvas, clipped by viewport.
  putpixel_copy (x, y, pixel) {

    if ((x >= 0) && (x < this.width) && (y >= 0) && (y < this.height)) {
      const vp = this.info.vp;
      if (!vp.clip || ((x >= vp.left) && (x <= vp.right) && (y >= vp.top) && (y <= vp.bottom))) {
        this.pixels[y * this.width + x] = pixel;
      }
    }
  }

  // TODO (skip)
  putpixel_xor (x, y, pixel) {

  }

  // TODO (skip)
  putpixel_or (x, y, pixel) {

  }

  // TODO (skip)
  putpixel_and (x, y, pixel) {

  }

  // TODO (skip)
  putpixel_not (x, y, pixel) {

  }

  // floodfill putpixel using fill pattern.
  // uses info.fgcolor & info.bgcolor, and info.fill.fpattern that must be pre-set.
  ff_putpixel (x, y, fgcolor = this.info.fgcolor, wmode = this.info.writeMode) {

    // skip adjusting offset since putpixel() does it
    const bgcolor = this.info.bgcolor;
    const fpattern = this.info.fill.fpattern; // array

    // draw pixel if bit in pattern is 1
    if ( (fpattern[y % 8] >> (x % 8)) & 1) {
      // forground pixel
      this.putpixel(x, y, fgcolor, wmode);
    }
    else {
      // background pixel
      this.putpixel(x, y, bgcolor, wmode);
    }
  }

  // drawbezier(numpoints, polypoints) { }

  circle_bresenham (x, y, radius) {

    let xx = -radius, yy = 0, err = 2 - (2 * radius);
    do {
      this.putpixel(x - xx, y + yy);
      this.putpixel(x - yy, y - xx);
      this.putpixel(x + xx, y - yy);
      this.putpixel(x + yy, y + xx);
      radius = err;
      if (radius <= yy) { err += ++yy * 2 + 1; }
      if ((radius > xx) || (err > yy)) { err += ++xx * 2 + 1; }
    } while (xx < 0);
  }

  // Bresenham's line algorithm
  line_bresenham (x1, y1, x2, y2, color, wmode, upattern = 0xFFFF) {

    const
      dx = Math.abs(x2 - x1),
      sx = (x1 < x2) ? 1 : -1,
      dy = Math.abs(y2 - y1),
      sy = (y1 < y2) ? 1 : -1;
    let
      count = 0,
      err = Math.floor(((dx > dy) ? dx : -dy) / 2),
      e2;

    while (true) {
      if ((upattern >> (count % 16)) & 1) { // TODO: Test this!
        this.putpixel(x1, y1, color, wmode);
      }
      count++;

      if ((x1 == x2) && (y1 == y2)) { break; }
      e2 = err;
      if (e2 > -dx) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dy) {
        err += dx;
        y1 += sy;
      }
    }
  }

  // NOT USED?
  // Bresenham's line using current fill pattern.
  line_fill (x1, y1, x2, y2, color, wmode) {

    const
      dx = Math.abs(x2 - x1),
      sx = (x1 < x2) ? 1 : -1,
      dy = Math.abs(y2 - y1),
      sy = (y1 < y2) ? 1 : -1;
    let
      err = Math.floor(((dx > dy) ? dx : -dy) / 2),
      e2;

    while (true) {
      this.ff_putpixel(x1, y1, color, wmode);

      if ((x1 == x2) && (y1 == y2)) { break; }
      e2 = err;
      if (e2 > -dx) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dy) {
        err += dx;
        y1 += sy;
      }
    }
  }

  // Returns the octant (1-8) where (x, y) lies, used by line().
  octant (x, y) {
    return (x >= 0) ? ( (y >= 0) ? (( x > y) ? 1 : 2) : (( x > -y) ? 8 : 7) )
                    : ( (y >= 0) ? ((-x > y) ? 4 : 3) : ((-x > -y) ? 5 : 6) );
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Standard BGI functions
  // SEE https://www.cs.colorado.edu/~main/bgi/doc/
  // To convert Pascal syntax to JS, simply convert function names to lowercase.

  // Draw a circular arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  arc (x, y, stangle, endangle, radius, thickness = this.info.line.thickness) {

  }

  // Draws and fills a rectangle, using fill style and color. Has no border. (see fillrect)
  // For a border, use bar3d with depth = 0.
  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {

    const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : color;

    if (this.info.fill.style === BGI.SOLID_FILL) {
      // draw filled solid bar
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          this.putpixel(x, y, fillcolor, wmode);
        }
      }
    }
    else {
      // draw filled patterned bar
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          this.ff_putpixel(x, y, fillcolor, wmode);
        }
      }
    }
  }

  // Draws a 3D filled rectangle using fill color and pattern.
  // Outline drawn using line style and fg color.
  // if topflag != 0, draws a top.
  bar3d (left, top, right, bottom, depth, topflag) {

    /* topflag = true           false
           +----------+                  +
          /          /|                 /|
         +----------+ |     +----------+ |
         |XXXXXXXXXX| +     |XXXXXXXXXX| +
         |XXXXXXXXXX|/      |XXXXXXXXXX|/
         +----------+       +----------+

      Outline uses info.fgcolor & info.line...
      Fill uses info.fill.color & fill.style, or info.bgcolor if using EMPTY_FILL.
      All use info.writeMode. Sides aren't filled in.
    */

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

    // draw filled bar
    const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
    this.bar(left, top, right, bottom, fillcolor)

    // following drawn using info.fgcolor
    if (depth > 0) {
      // TODO: doesn't seem to fill in 3d part, only draws an outline?
      // also calling line() would have thickness and line pattern
      if (topflag) {
        this.line(left, top, left + depth, top - depth);
        this.line(left + depth, top - depth, right + depth, top - depth);
      }
      this.line(right, top, right + depth, top - depth);
      this.line(right, bottom, right + depth, bottom - depth);
      this.line(right + depth, bottom - depth, right + depth, top - depth);
    }
    this.rectangle(left, top, right, bottom);
  }

  // doesn't use linestyle
  circle (x, y, radius, thickness = this.info.line.thickness) {

    // TODO: must draw ellipse if aspect ratio not 1:1
    if (thickness === BGI.NORM_WIDTH) {
      // thin better-looking circle
      circle_bresenham(x, y, radius);
    }
    else {
      // thicker circle
      this.arc(x, y, 0, 360, radius);
    }
  }

  // Clears the screen, filling it with the current background color.
  // Resets CP to (0,0).
  cleardevice (bgcolor = this.info.bgcolor) {

    this.info.cp.x = 0;
    this.info.cp.y = 0;
    this.pixels.fill(bgcolor);
  }

  // Clears the viewport, filling it with the current background color.
  // Resets cp to (0,0).
  clearviewport (bgcolor = this.info.bgcolor) {

    this.info.cp.x = 0;
    this.info.cp.y = 0;
    const vp = this.info.vp;
    for (let y = vp.top; y <= vp.bottom; y++) {
      const row = y * this.width;
      for (let x = vp.left; x <= vp.right; x++) {
        this.pixels[row + x] = bgcolor;
      }
      /*
      // maybe or maybe not faster
      const st = (y * this.width) + vp.left;
      const en = (y * this.width) + vp.right + 1;
      this.pixels.fill(bgcolor, st, en)
      */
    }
  }

  // not implemented (STUB)
  detectgraph (graphdriver, graphmode) {
    // int *graphdriver, int *graphmode
    this.unimplemented('detectgraph')
  }

  drawpoly (numpoints, polypoints) {
    // polypoints array of ints
  }

  ellipse (x, y, stangle, endangle, xradius, yradius) {

  }

  fillellipse (x, y, xradius, yradius) {

  }

  fillpoly (numpoints, polypoints) {
    // polypoints array of ints
  }

  // NOT IN SDL_bgi ?
  // Draws and fills a rectangle, using fgcolor, line & fill style. Includes border.
  fillrect (left, top, right, bottom) {

  }

  // border or color = boundry color
  floodfill (x, y, border) {

  }

  getarccoords (arccoords) { // ***
    // struct arccoordstype *arccoords
  }

  getaspectratio (xasp, yasp) { // ***
    // int *xasp, int *yasp
  }

  getbkcolor (/* void */) {
    return this.info.bgcolor; // int
  }

  getcolor (/* void */) {
    return this.info.fgcolor; // int
  }

  getdefaultpalette (/* void */) {
    // return struct palettetype*
    return this.ega_palette; // TODO: might change
  }

  // not implemented (STUB)
  getdrivername () {
    this.unimplemented('getdrivername');
    return '';
  }

  getfillpattern (pattern) { // ***
    // char *pattern
  }

  getfillsettings (/* fillinfo */) { // ***
    // struct fillsettingstype *fillinfo
    return this.info.fill;
  }

  getgraphmode (/* void */) {
    return 0; // int
  }

  getimage (x1, y1, x2, y2, bitmap) { // ***
    // void *bitmap
  }

  getlinesettings (/* lineinfo */) { // ***
    // struct linesettingstype *lineinfo
    return this.info.line;
  }

  getmaxcolor (/* void */) {
    return 0; // int
  }

  getmaxmode (/* void */) {
    return 0; // int
  }

  getmaxx (/* void */) {
    return this.width - 1; // int
  }

  getmaxy (/* void */) {
    return this.height - 1; // int
  }

  getmodename (mode_number) {
    return '';
  }

  getmoderange(graphdriver, lomode, himode) {
    // int graphdriver, int *lomode, int *himode
  }

  getpalette (/* palette */) { // ***
    // struct palettetype *palette
    // C++ version fills pointer to palette struct provided, returns void.
    // js version returns a RGBA32 palette array.
    return this.palette;
  }

  // returns number of colors in the RGBA32 palette array
  getpalettesize (/* void */) {
    return Math.floor(this.palette.length / 4); // int
  }

  // Get pixel offset by current viewport, else return 0.
  getpixel (x, y) {

    // offset by viewport
    const vp = this.info.vp;
    x += vp.left;
    y += vp.top;

    if ((x >= 0) && (x < this.width) && (y >= 0) && (y < this.height)) {
      return this.pixels[y * this.width + x]; // int
    }
    return 0;
  }

  gettextsettings (texttypeinfo) { // ***
    // struct textsettingstype *texttypeinfo
  }

  getviewsettings (viewport) { // ***
    // struct viewporttype *viewport
  }

  getx (/* void */) {
    return this.info.cp.x; // int
  }

  gety (/* void */) {
    return this.info.cp.y; // int
  }

  graphdefaults (/* void */) {
    /*
    graphdefaults resets all graphics settings to their defaults:
      sets the viewport to the entire screen.
      moves the current position to (0,0).
      sets the default palette colors, background color, and drawing color.
      sets the default fill style and pattern.
      sets the default text font and justification.
    */

    // TODO: need to check & reset palette
    this.info = BGI.infoDefaults();

  }

  // not implemented (STUB)
  grapherrormsg (errorcode) {
    // errorcode from graphresult() return value.
    this.unimplemented('grapherrormsg');
    return '';
  }

  // not implemented (STUB)
  graphresult (/* void */) {
    // returns error code for the last graphics operation that reported an error
    this.unimplemented('graphresult');
    return 0;
  }

  // returns size of memory in bytes required to store a bit image
  imagesize (x1, y1, x2, y2) {
    return 0; // unsigned int
  }


  // initializes the graphics system (old DOS way)
  // don't implement? (STUB)
  initgraph (width, height, pathtodriver) { // modified args
    // int *graphdriver, int *graphmode, char *pathtodriver // original args
    // pathtodriver = is also path to *.CHR files
    // in Windows instead use: initwindow(w, h)
    this.unimplemented('initgraph');
  }

  // don't implement (STUB)
  // old DOS function
  installuserdriver () {
    // char *name, int huge (*detect)(void)
    this.unimplemented('installuserdriver');
    return 0;
  }

  // Installs a font file from disk.
  // name = filename of font .CHR file (e.g. "USER.CHR") not including path?
  // returns a font ID that can be passed to settextstyle()
  installuserfont (name) {
    return 0; // int
  }

  // Draws a line in the current color, using the current write mode, line style, and thickness
  // between the two points without updating the current position (info.cp).
  line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {
    // TODO: pass in 'linesettingstype' object instead?

    /* REMOVE
    // already offset by viewport in putpixel()
    const vp = this.info.vp;
    x1 += vp.left;
    y1 += vp.top;
    x2 += vp.left;
    y2 += vp.top;
    */

    // set pattern
    // TODO: should this be here, or passed into line()?
    let upattern = (linestyle < BGI.USERBIT_LINE) ? BGI.line_patterns[linestyle] : this.info.line.upattern;

    // first line
    this.line_bresenham(x1, y1, x2, y2, color, wmode, upattern);

    // 2nd & 3rd lines
    if (thickness === BGI.THICK_WIDTH) {
      const oct = this.octant(x2 - x1, y1 - y2);
      if ((oct === 1) || (oct === 4) || (oct ===5) || (oct === 8)) {
        this.line_bresenham(x1, y1 - 1, x2, y2 - 1, color, wmode, upattern);
        this.line_bresenham(x1, y1 + 1, x2, y2 + 1, color, wmode, upattern);
      }
      else {
        this.line_bresenham(x1 - 1, y1, x2 - 1, y2, color, wmode, upattern);
        this.line_bresenham(x1 + 1, y1, x2 + 1, y2, color, wmode, upattern);
      }
    }
  }

  // Draws a line from the CP (current position) to a point that is a relative distance (dx,dy)
  // from the CP. The CP is advanced by (dx,dy).
  linerel (dx, dy) {
    this.line(this.info.cp.x, this.info.cp.y, this.info.cp.x + dx, this.info.cp.y + dy);
    this.info.cp.x += dx;
    this.info.cp.y += dy;
  }

  // Draws a line from the CP (current position) to (x,y), then moves the CP to (x,y).
  lineto (x, y) {
    this.line(this.info.cp.x, this.info.cp.y, x, y);
    this.info.cp.x = x;
    this.info.cp.y = y;
  }

  // Moves the CP by (dx, dy) pixels.
  moverel (dx, dy) {
    this.info.cp.x += dx;
    this.info.cp.y += dy;
  }

  // Moves the CP to the position (x, y) relative to the viewport.
  moveto (x, y) {
    this.info.cp.x = x;
    this.info.cp.y = y;
  }

  outtext (text) {

  }

  outtextxy (x, y, text) {

  }

  pieslice (x, y, stangle, endangle, radius) {

  }

  putimage (x1, y1, bitmap, op) {
    // bitmap = points to where image stored
    // op = see putimage_ops enum (0=COPY, 1=XOR, 2=OR, 3=AND, 4=NOT)
    // no info on whether image gets clipped by viewport ???
  }

  // NOT IN BGI
  // random (range) { return (rand() % (range)) }

  readimagefile (filename, x1, y1, x2, y2) {
    // const char* filename=NULL, int left=0, int top=0, int right=INT_MAX, int bottom=INT_MAX
    // reads a BMP, GIF, JPG, ICON, EMF, or WMF image file.
    // displays it in part of the current active window.
    // unknown: would x2,y2 crop the image if under size of image? (I'd think so)
    // nothing returned
  }

  rectangle (x1, y1, x2, y2, color = this.info.fgcolor) {
    // draws in current line style, thickness, and drawing color
    line(x1, y1, x2, y1, color);
    line(x2, y1, x2, y2, color);
    line(x2, y2, x1, y2, color);
    line(x1, y2, x1, y1, color);
  }

  // don't implement these (DOS only) (STUB)
  registerbgidriver () {
    // registerbgidriver(void (*driver)(void)) { }
    this.unimplemented('registerbgidriver');
  }
  registerbgifont () {
    //registerbgifont(void (*font)(void)) { }
    this.unimplemented('registerbgifont');
  }

  // don't implement (DOS only) (STUB)
  // only makes sense when switching to text mode in DOS.
  restorecrtmode (/* void */) {
    this.unimplemented('restorecrtmode');
  }

  // Draws and fills an elliptical pie slice centered at (x, y).
  sector (x, y, start, stop, xradius, yradius) {
    // Outlines using current color, filled using pattern & color 
    // from setfillstyle & setfillpattern.
    // Angles in degrees, counter-clockwise: 0=3o'clock, 90=12o'clock

  }

  // active page where all subsequent graphics output goes
  setactivepage (page) {
  }

  setallpalette (p) {
    // void setallpalette (struct palettetype *palette);
    // This is a little different and might not want to use?
    // To set a palette color to an RGB color, use setrgbpalette()
  }

  // Used to make sure circles are round.
  // SEE getaspectratio()
  setaspectratio (xasp, yasp) {
    this.info.aspect.x = xasp;
    this.info.aspect.y = yasp;
  }

  // sets background to given index color.
  // WIN version doesn't change the 0 pallete, so it's not instant,
  // but any future drawings will use what is currently in color at index [color].
  setbkcolor (color) {
    this.info.bgcolor = color;
  }

  // sets current drawing color: 0 to getmaxcolor(), usually 0-15. WIN allows RGB COLOR()
  setcolor (color) {
    this.info.fgcolor = color;
  }

  // TODO
  // fpattern is a squence of 8 bytes, each byte is 8 pixels in the pattern.
  setfillpattern (fpattern, color) {
    // void setfillpattern(char *upattern, int color);

    this.info.fill.style = BGI.USER_FILL;
    //this.info.fill.fpattern = []; // TODO
  }

  // style is index 0-11 into fill_patterns[]
  // pattern bits 0=current bg color, 1=color (passed in, not global color)
  setfillstyle (style, color) {

    this.info.fill.color = color;
    if ((style >= 0) && (style < BGI.USER_FILL)) {
      this.info.fill.style = style;
      this.info.fill.fpattern = BGI.fill_patterns[style];
    }
  }

  // don't implement (STUB)
  setgraphbufsize (size) {
    // unsigned setgraphbufsize(unsigned bufsize);
    // tells how much memory to allocate for internal graphics buffer used by floodfill.
    this.unimplemented('setgraphbufsize');
  }

  // don't implement?? (STUB)
  setgraphmode (mode) {
    // selects graphics mode different than default set by initgraph()
    // clears screen, resets graphics to defaults.
    this.unimplemented('setgraphmode');
  }

  setlinestyle (linestyle, upattern = 0xFFFF, thickness = 1) {
    // void setlinestyle (int linestyle, unsigned upattern, int thickness);
    // linestyle value from line_styles enum.
    // upattern is a 16-bit int (e.g. 0xFFFF is a solid line).
    // upattern only applies if linestyle == 4 (USERBIT_LINE)
    // The linestyle doesn't effect arcs, circles, ellipses, or pie slices. Only thickness does.

    this.info.line.style = linestyle;
    this.info.line.upattern = upattern;
    this.info.line.thickness = thickness;
  }

  // Set colornum index in palette (0-15) to color (0-15), or RGB color using COLOR() in WIN.
  // TODO: should we support EGA palette colors (0-63)?
  setpalette (colornum, color) {

    if (BGI.IS_RGB_COLOR(color)) {
      this.setrgbpalette(colornum, BGI.RED_VALUE(color), BGI.GREEN_VALUE(color), BGI.BLUE_VALUE(color));
    }
    else if (BGI.IS_BGI_COLOR(color)) {
      // lookup bgi color
      const c = BGI.bgi_palette[color];
      this.setrgbpalette(colornum, BGI.RED_VALUE(c), BGI.GREEN_VALUE(c), BGI.BLUE_VALUE(c));
    }
    else {
      console.log(`BGI.setpalette() color [${color}] not supported!`);
    }
  }

  // colornum can be 0-15 or 0-255 depending on the grapics mode?
  // red, green, blue are 0-255, but only the top 6 bits of byte are used in BGI and WIN.
  // (but this implementation will use all 8 bits.)
  setrgbpalette (colornum, red, green, blue) {
    // setrgbpalette(int colornum, int red, int green, int blue);
    const pi = colornum * 4;
    if (pi < this.palette.length) {
      // RGBA32 format: R, G, B, A
      this.pallete[pi + 0] = red & 0xFF;
      this.pallete[pi + 1] = green & 0xFF;
      this.pallete[pi + 2] = blue & 0xFF;
      this.pallete[pi + 3] = 255;
    }
    else {
      console.log(`BGI.setrgbpalette() colornum [${colornum}] out of range!`);
    }
  }

  // affects text written
  settextjustify (horiz, vert) {
    // SEE text_just enums
    // SEE https://www.cs.colorado.edu/~main/bgi/doc/settextjustify.html
    // Text output after a call to settextjustify is justified around the current position (CP) horizontally 
    // and vertically, as specified. The default justification settings are LEFT_TEXT (for horizontal) and 
    // TOP_TEXT (for vertical). If horiz is equal to LEFT_TEXT and direction equals HORIZ_DIR, the CP's 
    // x component is advanced after a call to outtext(string) by textwidth(string).
  }

  settextstyle (font, direction, charsize) {
    // SEE https://www.cs.colorado.edu/~main/bgi/doc/settextstyle.html
  }

  setusercharsize (multx, divx, multy, divy) {
    // setusercharsize gives finer control over the size of text from stroked fonts.
    // SEE https://www.cs.colorado.edu/~main/bgi/doc/setusercharsize.html
  }

  // Sets the current viewport for graphics output.
  // Current position (CP) is moved to (0,0) in the new window. (so coords change??)
  // If clip is true, all drawings will be clipped to the current viewport.
  setviewport (x1, y1, x2, y2, clip) {
    if ((x1 >= 0) && (x2 < this.width) && (y1 >= 0) && (y2 < this.height)) {
      this.info.vp.left = x1;
      this.info.vp.top = y1;
      this.info.vp.right = x2;
      this.info.vp.bottom = y2;
      this.info.vp.clip = clip;
      this.info.cp.x = 0;
      this.info.cp.y = 0;
    }
  }

  // likely won't implement (STUB)
  // makes page the visual graphics page.
  setvisualpage (page) {
    this.unimplemented('setvisualpage');
  }

  // mode = COPY_PUT (0), XOR_PUT (1)
  // works only with line(), linerel(), lineto(), rectangle(), drawpoly()
  setwritemode (mode) {
  }

  // takes current font size and multiplication factor, and determines the height of text in pixels.
  textheight (text) {
    return 0;
  }
  
  // takes the string length, current font size, and multiplication factor, and determines the width of text in pixels.
  textwidth (text) {

  }

  ////////////////////////////////////////////////////////////////////////////////
  // BGI for Windows Color functions

  // Do we need EGA palette specific functions?
  // Didn't check this code against reference.

  // r,g,b range 0-255
  // returns packed ARGB values (0xAARRGGBB) in C++ style
  static COLOR (r, g, b) {
    return 0xFF000000 | r << 16 | g << 8 | b;
  }

  static IS_BGI_COLOR (color) {
    return ((color >= 0) && (color < 16));
  }

  static IS_RGB_COLOR (color) {
    return ((color & 0xFF000000) !== 0);
  }

  // these return the color component of an RGB color
  static RED_VALUE (rgb_color) {
    return (rgb_color & 0xFF0000) >> 16;
  }

  static GREEN_VALUE (rgb_color) {
    return (rgb_color & 0xFF00) >> 8;
  }

  static BLUE_VALUE (rgb_color) {
    return (rgb_color & 0xFF);
  }

  ////////////////////////////////////////////////////////////////////////////////
  // BGI for Windows functions (some not present)

  closegraph (win) {

  }

  // NOT IN SDL_bgi
  // returns an RGB color from a BGI/index color
  converttorgb (color) {
    return 0;
  }

  delay (millisec) {

  }

  getactivepage (/* void */) {
    this.unimplemented('getactivepage');
  }

  getbkcolor () {

  }

  getdisplaycolor () {

  }

  // EXTRA
  bgi_getch (/* void */) {
    return 0; // int
  }
  // getch = bgi_getch

  getvisualpage (/* void */) {
    this.unimplemented('getvisualpage');
    return 0; // int
  }

  // returns true if a char is in input buffer, else false.
  kbhit (/* void */) {
    return false; // int
  }

  // returns the most recent x coord of the mouse within the graphics window.
  mousex (/* void */) {
    return 0;
  }

  // returns the most recent y coord of the mouse within the graphics window.
  mousey (/* void */) {
    return 0;
  }

  // 2nd arg is a callback function sent x,y mouse position
  registermousehandler (kind, callback) {
    // registermousehandler(int kind, void h(int x, int y));

  }

  setcurrentwindow (win) {
    // not really needed? Assumes multiple windows.
    // We can use multiple instances of the BGI class, one for each canvas,
    // instead of using multiple windows.
    this.unimplemented('setcurrentwindow');
  }

  // NOT IN BGI nor WIN EXTRA, but from WinGraph (not official)
  // floodmode = 
  //   BORDER_FLOOD: fill area is bounded by color
  //   SURFACE_FLOOD: fill regions containing color
  setfloodmode (floodmode) {

  }

}
