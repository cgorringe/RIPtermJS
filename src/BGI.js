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

// not using as a module for now, but
// uncomment this line if you do want to use as a module:
//export default 
class BGI {

  // class static constants moved to end of file.

  // don't want both below...

  // packed ARGB values (0xAARRGGBB) in C++ style
  static get bgi_palette () { return [
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
  ]; }

  // RGBA32 format: R, G, B, A
  static get ega_palette () { return [
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
  ]; }

  static get line_patterns () { return [
    0xFFFF, // 00 SOLID_LINE  : 1111111111111111
    0xCCCC, // 01 DOTTED_LINE : 1100110011001100
    0xFC78, // 02 CENTER_LINE : 1111110001111000
    0xF8F8, // 03 DASHED_LINE : 1111100011111000
    0xFFFF, // 04 USERBIT_LINE
  ]; }

  static get fill_patterns () { return [
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // 00 EMPTY_FILL
    [0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], // 01 SOLID_FILL
    [0xFF, 0xFF, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00], // 02 LINE_FILL
    [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80], // 03 LTSLASH_FILL
    [0xE0, 0xC1, 0x83, 0x07, 0x0E, 0x1C, 0x38, 0x70], // 04 SLASH_FILL
    [0xF0, 0x78, 0x3C, 0x1E, 0x0F, 0x87, 0xC3, 0xE1], // 05 BKSLASH_FILL
    [0xA5, 0xD2, 0x69, 0xB4, 0x5A, 0x2D, 0x96, 0x4B], // 06 LTBKSLASH_FILL
    [0xFF, 0x88, 0x88, 0x88, 0xFF, 0x88, 0x88, 0x88], // 07 HATCH_FILL
    [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81], // 08 XHATCH_FILL
    [0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33], // 09 INTERLEAVE_FILL
    [0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00], // 0A WIDE_DOT_FILL
    [0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00], // 0B CLOSE_DOT_FILL
    [0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55], // 0C USER_FILL / PabloDraw
  ]; }


  ////////////////////////////////////////////////////////////////////////////////
  // Contructor & init methods

  // Pass an object to constructor with these keys:
  //   ctx: CanvasRenderingContext2D() - required
  //   width: int - optional if ctx derived from a <canvas>
  //   height: int - optional if ctx derived from a <canvas>
  //   log: function (type, msg) - optional callback function with 2 arguments.

  constructor (args) {

    // public fields
    this.width = 1;
    this.height = 1;
    this.aspect = { xasp: 1, yasp: 1 }; // use 372, 480 for RipTerm
    this.isBuffered = true; // true = copy pixels to context, false = using context data store
    this.colorMask = 0x0F;  // 0xF = 16-color mode, 0xFF = 256-color mode
    this.fonts = {}; // key is file, e.g. 'GOTH.CHR' (may rethink this later)

    // log callback function
    if ('log' in args) {
      this.logFunc = args.log;
    }

    // need to pass this in to find font files
    if ('fontsPath' in args) {
      this.fontsPath = args.fontsPath;
    }

    this.initContext(args.ctx, args.width, args.height);
    // which assigns these:
    //   this.ctx     : CanvasRenderingContext2D()
    //   this.pixels  : Uint8ClampedArray()
    //   this.imgData : ImageData()
    //   this.width, this.height, this.isBuffered

    this.graphdefaults();
  }

  infoDefaults () {
    return {
      bgcolor: BGI.BLACK,
      fgcolor: BGI.WHITE,
      // need to set fill.fpattern whenever fill.style is set
      fill: { style: BGI.SOLID_FILL, color: BGI.WHITE, fpattern: BGI.fill_patterns[BGI.SOLID_FILL] },
      line: { style: BGI.SOLID_LINE, upattern: 0xFFFF, thickness: 1 },
      cp: { x: 0, y: 0 }, // current position
      vp: { left: 0, top: 0, // viewport
            right: (this.width - 1), bottom: (this.height - 1),
            width: this.width, height: this.height,
            clip: false },
      // ap: { left: 0, top: 0, right: (this.width - 1), bottom: (this.height - 1), clip: 0 }, // active port / page?
      writeMode: 0, // 0=COPY, 1=XOR, 2=OR, 3=AND, 4=NOT
      font: { width: 0, height: 0 }, // ??
      fontMag: { x: 1.0, y: 1.0 }, // font magnification
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
    else if (ctx && ctx.canvas) {
      // get size from browser canvas
      this.width = Math.floor(ctx.canvas.width);
      this.height = Math.floor(ctx.canvas.height);
    }
    else {
      this.log('err', 'Missing "ctx" canvas context passed to BGI() constructor!');
      return;
    }

    // needed to access context pixel data ??
    //this.imgData = ctx.getImageData(0, 0, this.width, this.height);
    this.imgData = ctx.createImageData(this.width, this.height);

    // Do we need to use this for 'A8' pixel format?
    // this.imgData = new ImageData(new Uint8ClampedArray(size), width, height)

    // check to see if ctx is already using 8-bit indexed pixel data.
    // only works in Chrome & Edge, not Firefox nor Safari.
    if (typeof ctx.getContextAttributes === 'function') {
      let attr = ctx.getContextAttributes();
      this.isBuffered = (attr && (attr.pixelFormat === 'A8')) ? false : true;
      /* && this.imgData && this.imgData.data */
    }
    else {
      this.isBuffered = true;
    }

    if (this.isBuffered) {
      // create a new byte buffer for pixel data, which is usually the case in browsers.
      this.pixels = new Uint8ClampedArray(this.width * this.height)
    }
    else {
      // use existing context data, which may be used in node canvas. [NOT TESTED]
      // does this a reference or a copy?
      this.pixels = this.imgData.data;
    }

    // this pixel buffer is used during flood fill
    this.fillpixels = new Uint8ClampedArray(this.width * this.height)
  }

  // Loads all the vector font .CHR files in BGI.fontFileList[]
  loadFonts () {

    // TODO: may want to try to not load them all at the same time!
    BGI.fontFileList.forEach(filename => {
      if (filename.length > 3) {
        this.fetchFont(filename);
      }
    })
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

  // sends msg to provided log function, else send to console if none provided.
  log (type, msg) {
    if (typeof this.logFunc === 'function') {
      this.logFunc(type, msg);
    }
    else {
      if (type === 'err') {
        console.error(msg);
      }
      else {
        console.log(msg);
      }
    }
  }

  unimplemented (method) {
    this.log('bgi', method + '() not implemented.');
  }

  // updates the screen
  refresh () {

    if (!(this.ctx && this.imgData && this.pixels && this.palette)) { return false; }

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
    this.ctx.putImageData(img, 0, 0);
    return true;
  }

  // conditionally refreshes the screen or schedule it
  update () {
    // TODO
    this.refresh();
  }

  // Draws a pixel offset and clipped by current viewport.
  putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {
    this._putpixel(x, y, color, wmode);
  }
  _putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode, buf = this.pixels) {

    // should these be using .floor() ?
    x = Math.round(x);
    y = Math.round(y);

    const vp = this.info.vp;
    x += vp.left;
    y += vp.top;

    if (!vp.clip || ((x >= vp.left) && (x <= vp.right) && (y >= vp.top) && (y <= vp.bottom))) {
      this._putpixel_abs(x, y, color, wmode, buf);
    }
  }

  // x,y in absolute coordinates
  _putpixel_abs (x, y, color = this.info.fgcolor, wmode = this.info.writeMode, buf = this.pixels) {
    if ((x >= 0) && (x < this.width) && (y >= 0) && (y < this.height)) {
      switch (wmode) {
        default:
        case BGI.COPY_PUT:
          buf[y * this.width + x] = color;
          break;
        case BGI.XOR_PUT:
          buf[y * this.width + x] ^= color;
          break;
        case BGI.OR_PUT:
          buf[y * this.width + x] |= color;
          break;
        case BGI.AND_PUT:
          buf[y * this.width + x] &= color;
          break;
        case BGI.NOT_PUT:
          buf[y * this.width + x] = (~color & this.colorMask);
      }
    }
  }

  // floodfill putpixel using fill pattern.
  // uses info.fill.color, info.bgcolor, and info.fill.fpattern that must be pre-set.
  // pixel will be offset and clipped by current viewport.
  ff_putpixel (x, y, color = this.info.fill.color, wmode = this.info.writeMode) {

    const bgcolor = this.info.bgcolor;
    const fpattern = this.info.fill.fpattern; // array
    const vp = this.info.vp;
    x += vp.left;
    y += vp.top;

    if (!vp.clip || ((x >= vp.left) && (x <= vp.right) && (y >= vp.top) && (y <= vp.bottom))) {
      // draw pixel if bit in pattern is 1
      if ( (fpattern[y % 8] >> (7 - (x % 8))) & 1) {
        // forground pixel
        this._putpixel_abs(x, y, color, wmode);
      }
      else {
        // background pixel
        this._putpixel_abs(x, y, bgcolor, wmode);
      }
    }
  }

  thick_putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {
    // could be more efficient
    //this._putpixel(x-1, y-1, color, wmode);
    this._putpixel(x  , y-1, color, wmode);
    //this._putpixel(x+1, y-1, color, wmode);
    this._putpixel(x-1, y  , color, wmode);
    this._putpixel(x  , y  , color, wmode);
    this._putpixel(x+1, y  , color, wmode);
    //this._putpixel(x-1, y+1, color, wmode);
    this._putpixel(x  , y+1, color, wmode);
    //this._putpixel(x+1, y+1, color, wmode);
  }

  // NOT USED
  circle_bresenham (cx, cy, radius, thickness = this.info.line.thickness) {

    const putpix = (thickness === 3)
      ? (a, b) => this.thick_putpixel(a, b)
      : (a, b) => this._putpixel(a, b);
    let xx = -radius, yy = 0, err = 2 - (2 * radius);
    do {
      putpix(cx - xx, cy + yy);
      putpix(cx - yy, cy - xx);
      putpix(cx + xx, cy - yy);
      putpix(cx + yy, cy + xx);
      radius = err;
      if (radius <= yy) { err += ++yy * 2 + 1; }
      if ((radius > xx) || (err > yy)) { err += ++xx * 2 + 1; }
    } while (xx < 0);
  }

  // Bresenham's ellipse algorithm
  ellipse_bresenham (cx, cy, xradius, yradius, thickness = this.info.line.thickness) {

    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }
    const putpix = (thickness === 3)
      ? (a, b) => this.thick_putpixel(a, b)
      : (a, b) => this._putpixel(a, b);
    const xrad2 = 2 * xradius * xradius;
    const yrad2 = 2 * yradius * yradius;
    let x = -xradius, y = 0;
    let e2 = yradius, dx = (1+2*x)*e2*e2;
    let dy = x*x, err = dx+dy;

    do {
      putpix(cx - x, cy + y);
      putpix(cx + x, cy + y);
      putpix(cx + x, cy - y);
      putpix(cx - x, cy - y);
      e2 = 2 * err;
      if (e2 <= dy) { y++; dy += xrad2; err += dy; } // y step
      if (e2 >= dx || (2 * err) > dy) { x++; dx += yrad2; err += dx; } // x step
    } while (x <= 0);

    // finish tip of ellipse (is this needed?)
    while (y++ < yradius) {
      putpix(cx, cy + y);
      putpix(cx, cy - y);
    }
  }

  // Bresenham's ellipse algorithm modified for filling
  fillellipse_bresenham (cx, cy, xradius, yradius) {

    const xrad2 = 2 * xradius * xradius;
    const yrad2 = 2 * yradius * yradius;
    let x = -xradius, y = 0;
    let e2 = yradius, dx = (1+2*x)*e2*e2;
    let dy = x*x, err = dx+dy;

    do {
      for (let px = x; px <= -x; px++) {
        this.ff_putpixel(cx + px, cy - y);
        this.ff_putpixel(cx + px, cy + y);
      }
      e2 = 2 * err;
      if (e2 <= dy) { y++; dy += xrad2; err += dy; } // y step
      if (e2 >= dx || (2 * err) > dy) { x++; dx += yrad2; err += dx; } // x step
    } while (x <= 0);

    // finish tip of ellipse (is this needed?)
    //while (y++ < yradius) {
    //  this._putpixel(cx, cy + y);
    //  this._putpixel(cx, cy - y);
    //}
  }

  // TEST, NOT USED
  // draws an elliptical arc using slower method of trig and lines
  arc_lines (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {

    // following copied from ripscript.js v2 drawOvalArc()
    // TODO: find smoother algorithm

    const twoPiD = 2 * Math.PI / 360;
    if (stangle > endangle) { endangle += 360; }
    let x1 = cx + Math.round(xradius * Math.cos(stangle * twoPiD));
    let y1 = cy - Math.round(yradius * Math.sin(stangle * twoPiD));
    let x2, y2;

    // draw arc counter-clockwise
    for (let n = stangle; n <= endangle; n += 1) {
      // test with: Math.floor() .round() .trunc()
      x2 = cx + Math.round(xradius * Math.cos(n * twoPiD));
      y2 = cy - Math.round(yradius * Math.sin(n * twoPiD));
      this._line(x1, y1, x2, y2, this.info.fgcolor, BGI.COPY_PUT, BGI.SOLID_LINE, thickness);
      x1 = x2; y1 = y2;
    }
  }

  // TEST
  // draws an elliptical arc using slower method of trig and pixels
  arc_pixels (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {

    // TODO: find smoother algorithm

    const putpix = (thickness === 3)
      ? (a, b) => this.thick_putpixel(a, b)
      : (a, b) => this._putpixel(a, b);
    const twoPiD = 2 * Math.PI / 360;
    if (stangle > endangle) { endangle += 360; }
    let x, y;
    // calculate a single pixel step along the circumference
    let step = 1 / (twoPiD * Math.max(xradius, yradius));

    // draw arc counter-clockwise
    for (let n = stangle; n <= endangle; n += step) {
      // test with: Math.floor() .round() .trunc()
      x = cx + Math.round(xradius * Math.cos(n * twoPiD));
      y = cy - Math.round(yradius * Math.sin(n * twoPiD));
      putpix(x, y);
    }
  }

  // Bresenham's line algorithm
  line_bresenham (x1, y1, x2, y2, color, wmode, upattern = 0xFFFF) {

    const
      dx = Math.abs(x2 - x1),
      dy = Math.abs(y2 - y1);
    let
      xi1, xi2, yi1, yi2, den, num, numadd,
      x = x1, y = y1, numpixels;

    if (x2 >= x1) { xi1 = xi2 = 1; } else { xi1 = xi2 = -1; }
    if (y2 >= y1) { yi1 = yi2 = 1; } else { yi1 = yi2 = -1; }
    if (dx >= dy) {
      xi1 = yi2 = 0;
      den = dx;
      num = dx >> 1;
      numadd = dy;
      numpixels = dx;
    }
    else {
      xi2 = yi1 = 0;
      den = dy;
      num = dy >> 1;
      numadd = dx;
      numpixels = dy;
    }

    for (let c=0; c <= numpixels; c++) {
      if ((upattern >> (c % 16)) & 1) {
        this._putpixel(x, y, color, wmode);
      }
      num += numadd;
      if (num >= den) {
        num -= den;
        x += xi1;
        y += yi1;
      }
      x += xi2;
      y += yi2;
    }

  }

  // Returns the octant (1-8) where (x, y) lies, used by line().
  // TODO: needs further testing on edge cases ('>=' vs '>')
  octant (x, y) {
    // x=40, y=-40
    // GARFIELD.RIP - OK
    //return (x >= 0) ? ( (y >= 0) ? (( x > y) ? 1 : 2) : (( x > -y) ? 8 : 7) )
    //                : ( (y >= 0) ? ((-x > y) ? 4 : 3) : ((-x > -y) ? 5 : 6) );

    // Fixes L_LINE.RIP, but breaks GARFIELD.RIP floodfill!
    //return (x >= 0) ? ( (y >= 0) ? (( x > y) ? 1 : 2) : (( x >= -y) ? 8 : 7) )
    //                : ( (y >= 0) ? ((-x > y) ? 4 : 3) : ((-x > -y) ? 5 : 6) );

    // this solves L_LINE2.RIP but still breaks GARFIELD.RIP
    // ** BEST GUESS SO FAR **
    return (x >= 0) ? ( (y > 0) ? (( x >= y) ? 1 : 2) : (( x >= -y) ? 8 : 7) )
                    : ( (y >= 0) ? ((-x > y) ? 4 : 3) : ((-x >= -y) ? 5 : 6) );

    // this fixes GARFIELD.RIP (see slanted black line at right edge of canvas)
    // compare to screenshot, it looks like floodfill() is responsible for not leaking at that point.
    // so not fixable in this function!
    //return (x >= 0) ? ( (y > 0) ? (( x >= y) ? 1 : 2) : (( x > -y) ? 8 : 7) )
    //                : ( (y >= 0) ? ((-x > y) ? 4 : 3) : ((-x >= -y) ? 5 : 6) );
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Font methods

  // download and parse given .CHR font file.
  // filename = filename without path, including '.CHR' (e.g. 'BOLD.CHR')
  // uses this.fontsPath
  // TODO: callback or Promise returned?
  fetchFont (filename) {

    if (typeof filename !== 'string') {
      this.log('err', 'fetchFont() missing "filename"!');
      return;
    }
    if (typeof this.fontsPath !== 'string') {
      this.log('err', 'must pass in "fontsPath" to BGI()!');
      return;
    }
    const url = this.fontsPath + '/' + filename;
    this.log('font', 'Fetching font: ' + url);

    let request = new Request(url);
    fetch(request)
      .then(response => response.arrayBuffer())
      .then(buffer => {

        const dview = new DataView(buffer);
        if (dview.getUint8(0x80) === 43) { // 43 = '+'

          // Save font metadata
          let font = {};
          font.numchars = dview.getUint16(0x81, true); // true = little-endian
          font.firstchar = dview.getUint8(0x84); // ASCII value of first char
          font.top = dview.getInt8(0x88); // top of capital, going up from baseline
          font.baseline = dview.getInt8(0x89); // usually 0?
          font.bottom = dview.getInt8(0x8A); // bottom descender, usually negative

          // Create a copy of the char widths byte array buffer to store into font object.
          const widthOffset = 0x90 + (font.numchars * 2);
          const fontWidths = new Uint8Array(buffer, widthOffset, font.numchars);
          font.widths = fontWidths.slice(0); // widths are indexed 0 to numchars-1

          //console.log(font); // DEBUG

          // Must read offsets to char defs stored in file, as some reuse the same def. (e.g. SANS.CHR)
          const charOffsets = new Uint16Array(buffer, 0x90, font.numchars);
          const dataOffset = dview.getUint16(0x85, true) + 0x80;
          const defdata = new Uint8Array(buffer, dataOffset); // length to EOF
          font.data = []; // array of Uint8Array slices, indexed 0 to numchars-1

          // Each pair of bytes is an (x, y) coord, and 2-bit opcode encoded in each high bit.
          // All we care about here is to slice whenever both high bits are 0,
          // which means End of Character definition.
          if ((defdata.length % 2) !== 0) {
            this.log('err', 'Font data length should be a multiple of 2, so something is wrong.');
            return;
          }

          // Scan definition data starting at each offset in charOffsets[] to create sliced copies.
          let byte1, byte2, pos = 0, spos = 0;
          for (let i=0; i < font.numchars; i++) {
            spos = charOffsets[i];
            pos = spos;
            do {
              byte1 = defdata[pos];
              byte2 = defdata[pos + 1];
              pos += 2;
            } while (!(((byte1 & 0x80) === 0) && ((byte2 & 0x80) === 0)) && (pos < defdata.length - 1))
            font.data.push( defdata.slice(spos, pos) );
          }

          // TODO: how to return the font object?
          this.fonts[filename] = font; // TODO: may rethink this
        }
        else {
          this.log('font', 'CHR file marker not correct');
        }

      }); // end fetch()

      // TODO: return a Promise that can run code when finished loading?

  } // end fetchFont()

  // uses and updates this.info.cp, and this.fonts
  // value = ASCII code value of a single character as int.
  // fontname = filename including .CHR (e.g. 'GOTH.CHR') MAY CHANGE.
  // scale = 1 to 10, indexes into BGI.fontScales[] for actual scale factor.
  drawChar (value, fontname, scale, dir) {

    // TODO: dir not yet implemented for vertical direction.
    // current postion (cp) should only update when dir is horizontal, not vertical! (see specs v2.0)

    // check for valid input
    if ((fontname in this.fonts) === false) {
      this.log('font', 'drawChar() font not found!');
      return;
    }

    const font = this.fonts[fontname];
    const color = this.info.fgcolor;
    const actualScale = (scale < BGI.fontScales.length) ? BGI.fontScales[scale] : 1;

    if ((value < font.firstchar) || (value >= font.firstchar + font.numchars)) {
      this.log('font', 'drawChar() value out of range! ' + value);
      return;
    }

    // scan char data
    const chardata = font.data[value - font.firstchar];
    let xbyte, ybyte, dx, dy, x, y;
    let numcmds = chardata.length;
    const x0 = this.info.cp.x;
    const y0 = this.info.cp.y;

    for (let i=0; i < numcmds; i+=2) {

      // read next byte pair
      xbyte = chardata[i];
      ybyte = chardata[i + 1];

      // convert the one's-complement 7-bit signed values
      dx = (xbyte & 0x40) ? -(-xbyte & 0x3F) : (xbyte & 0x3F);
      dy = (ybyte & 0x40) ? -(-ybyte & 0x3F) : (ybyte & 0x3F);

      // multiply by scale factor
      dx = Math.trunc(dx * actualScale);
      dy = Math.trunc(dy * actualScale);
      x = x0 + dx;
      y = y0 - dy;

      // TODO: direction

      if (((xbyte & 0x80) !== 0) && (ybyte & 0x80) === 0) {
        // move pointer when high bits 1 & 0
        //console.log('move', xbyte, ybyte, dx, dy); // DEBUG
        this.moveto(x, y);
      }
      else if (((xbyte & 0x80) !== 0) && (ybyte & 0x80) !== 0) {
        // draw line when high bits 1 & 1
        //console.log('draw', xbyte, ybyte, dx, dy); // DEBUG
        this.lineto(x, y, color, BGI.COPY_PUT, BGI.SOLID_LINE, BGI.NORM_WIDTH);
      }
      else {
        //console.log('????', xbyte, ybyte, dx, dy); // DEBUG
      }
    }

  }


  ////////////////////////////////////////////////////////////////////////////////
  // Standard BGI functions
  // SEE https://www.cs.colorado.edu/~main/bgi/doc/
  // To convert Pascal syntax to JS, simply convert function names to lowercase.

  // Draw a circular arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  arc (cx, cy, stangle, endangle, radius, thickness = this.info.line.thickness) {
    this._arc(cx, cy, stangle, endangle, radius, thickness);
  }
  _arc (cx, cy, stangle, endangle, radius, thickness = this.info.line.thickness) {
    // adjust radius based on aspect ratio
    const yradius = Math.floor( radius * (this.aspect.xasp / this.aspect.yasp) );
    this.ellipse(cx, cy, stangle, endangle, radius, yradius, thickness);
  }

  // Draws and fills a rectangle, using fill style and color. Has no border. (see fillrect)
  // For a border, use bar3d with depth = 0.
  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {
    this._bar(left, top, right, bottom, color, wmode);
  }
  _bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

    const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : color;

    if (this.info.fill.style === BGI.SOLID_FILL) {
      // draw filled solid bar
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          this._putpixel(x, y, fillcolor, wmode);
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
        this._line(left, top, left + depth, top - depth);
        this._line(left + depth, top - depth, right + depth, top - depth);
      }
      this._line(right, top, right + depth, top - depth);
      this._line(right, bottom, right + depth, bottom - depth);
      this._line(right + depth, bottom - depth, right + depth, top - depth);
    }
    this.rectangle(left, top, right, bottom);
  }

  // doesn't use linestyle
  circle (cx, cy, radius, thickness = this.info.line.thickness) {
    this.arc(cx, cy, 0, 360, radius);
  }

  // Clears the screen, filling it with the current background color.
  // Resets CP to (0,0).
  cleardevice (bgcolor = this.info.bgcolor) {

    this.info.cp.x = 0;
    this.info.cp.y = 0;
    this.pixels.fill(bgcolor);
    this.fillpixels.fill(0);
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

  // Draws a Cubic Bezier. [NOT IN BGI?]
  // numsegments is number of segments in curve.
  // cntpoints is an array of 8 ints (4 control points):
  //  [x1, y1, x2, y2, x3, y3, x4, y4]
  // (x1, y1) and (x4, y4) are on the curve, while others are not.
  // uses line style, thickness, and write mode.
  drawbezier (numsegments, cntpoints) {

    // TODO: I don't know if this matches the one used in original RipTerm.
    // Should test against original images.

    // Cubic Bezier formula:
    // p = (1-t)^3 *P0 + 3*t*(1-t)^2*P1 + 3*t^2*(1-t)*P2 + t^3*P3
    // where t is 0 to 1

    if (!(numsegments && cntpoints && (numsegments >= 1) && (cntpoints.length >= 8))) {
      this.log('bgi', `drawbezier() invalid args! numsegments: ${numsegments}, cntpoints: ${cntpoints}`);
      return;
    }
    const [x1, y1, x2, y2, x3, y3, x4, y4] = cntpoints;
    let step = 1 / numsegments;
    let xp = x1, yp = y1, xn, yn;
    for (let t = step; t < 1; t += step) { // TODO: TEST t <= 1
      let t1 = 1 - t;
      xn = Math.floor( t1*t1*t1 * x1 + 3 * t * t1*t1 * x2 + 3 * t*t * t1 * x3 + t*t*t * x4 );
      yn = Math.floor( t1*t1*t1 * y1 + 3 * t * t1*t1 * y2 + 3 * t*t * t1 * y3 + t*t*t * y4 );
      this._line(xp, yp, xn, yn);
      xp = xn;
      yp = yn;
    }
    this._line(xp, yp, x4, y4);
  }

  // Draws a closed polygon.
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  drawpoly (numpoints, polypoints, color = this.info.fgcolor) {
    this._drawpoly(numpoints, polypoints, color);
  }
  _drawpoly (numpoints, polypoints, color = this.info.fgcolor) {
    // polypoints array of ints

    if (!(numpoints && polypoints && (numpoints >= 2) && (polypoints.length >= numpoints * 2))) {
      this.log('bgi', `drawpoly() invalid args! numpoints: ${numpoints}, polypoints: ${polypoints}`);
      return;
    }

    for (let n=0; n < numpoints - 1; n++) {
      this._line(polypoints[2*n], polypoints[2*n + 1],  polypoints[2*n + 2], polypoints[2*n + 3], color);
    }
    // close the polygon
    this._line(polypoints[2 * numpoints - 2], polypoints[2 * numpoints - 1], polypoints[0], polypoints[1], color);
  }

  // Draws a polyline. [NOT IN BGI]
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  drawpolyline (numpoints, polypoints, color = this.info.fgcolor) {
    // polypoints array of ints

    if (!(numpoints && polypoints && (numpoints >= 2) && (polypoints.length >= numpoints * 2))) {
      this.log('bgi', `drawpolyline() invalid args! numpoints: ${numpoints}, polypoints: ${polypoints}`);
      return;
    }

    for (let n=0; n < numpoints - 1; n++) {
      this._line(polypoints[2*n], polypoints[2*n + 1],  polypoints[2*n + 2], polypoints[2*n + 3], color);
    }
  }

  // Draw an elliptical arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  ellipse (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {
    this._ellipse(cx, cy, stangle, endangle, xradius, yradius, thickness);
  }
  _ellipse (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {

    // need these
    if (stangle === endangle) { return }
    if ((xradius === 0) && (yradius === 0) && (thickness > 1)) { return }
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // bresenham works well for thin lines,
    // while still need to find a solution for thick lines.
    //if (thickness === 1) {
    //if ((thickness === 1) && (stangle === 0) && (endangle === 360)) {
    if ((stangle === 0) && (endangle === 360)) {
      this.ellipse_bresenham(cx, cy, xradius, yradius, thickness);

      /*
      // TEST: trying alternate for thick ovals
      // can't quite get this right!
      if (thickness === 3) {
        // need left x:-1 & +1, right -1 & -2
        // need top y:+1 & +2, bottom -1 & +1
        //this.ellipse_bresenham(cx, cy, xradius + 0.5, yradius + 0.5, 1); // tip on top
        this.ellipse_bresenham(cx     , cy     , xradius -1  , yradius -1  , 1);
        this.ellipse_bresenham(cx -1.5, cy +1.5, xradius -0.5, yradius -0.5 , 1);
      }
      */
    }
    else {
      this.arc_pixels(cx, cy, stangle, endangle, xradius, yradius, thickness);
    }
  }

  fillellipse (cx, cy, xradius, yradius) {

    // TODO: don't know if these are correct, or should we exit?
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // TODO: should this be outlined here or in ripterm code?
    this.fillellipse_bresenham(cx, cy, xradius, yradius)
  }

  // Draw a filled polygon, using current fill pattern, fill color and bgcolor.
  // pp is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  fillpoly (numpoints, pp) {
    // polypoints array of ints

    // code based on: http://alienryderflex.com/polygon_fill/
    const vp = this.info.vp;
    let i, j, x, y, xnode, xval;

    // scan thru all rows in viewport
    for (y = vp.top; y <= vp.bottom; y++) {
      xnode = [];

      // build node list
      j = numpoints - 1;
      for (i=0; i < numpoints; i++) {
        if ( ((pp[i*2+1] < y) && (pp[j*2+1] >= y)) || ((pp[j*2+1] < y) && (pp[i*2+1] >= y)) ) {

          // FIXME: there are off-by-one pixels along edges of polygons.
          // I tried lots of combinations, but could not solve it...
          // (see CAPITOL.RIP)

          xval = (y - pp[i*2+1]) / (pp[j*2+1] - pp[i*2+1]) * (pp[j*2] - pp[i*2]) + pp[i*2];

          /* TO REMOVE
          // tried this, didn't solve bug
          const tx1 = pp[j*2];
          const ty1 = pp[j*2+1];
          const tx2 = pp[i*2];
          const ty2 = pp[i*2+1];
          xval = (y - ty2) / (ty1 - ty2) * (tx1 - tx2) + tx2;

          const oct = this.octant(tx2 - tx1, ty1 - ty2);
          if ((oct === 1) || (oct === 4) || (oct ===5) || (oct === 8)) {
            xnode.push( Math.ceil(xval) );
          }
          else {
            xnode.push( Math.floor(xval) );
          }
          */

          // tried all these (REMOVE)
          //xnode.push( Math.ceil(xval) );
          //xnode.push( Math.floor(xval) );
          //xnode.push( Math.trunc(xval) );
          //xnode.push( xval | 0 ); // same as trunc() but slightly faster?

          xnode.push( Math.round(xval) );
        }
        j = i;
      }

      // sort nodes
      if (xnode.length == 0) continue;
      xnode.sort(function(a, b) { return a - b; });

      // draw pixels between node pairs
      for (i=0; i < xnode.length; i+=2) {
        for (x = xnode[i]; x <= xnode[i+1]; x++) {
          this.ff_putpixel(x, y, this.info.fill.color, BGI.COPY_PUT);
        }
      }
    }
    // this fixes filled polygon border issues
    // not sure if bgcolor should just be 0, but since bgcolor is never set != 0, it doesn't matter
    if (this.info.fgcolor !== this.info.bgcolor) {
      this._drawpoly(numpoints, pp);
    }
  }

/*
  // TO REMOVE
  // TEST: FLIPPING x & y axis (SAME ISSUE AS ABOVE)
  fillpoly2 (numpoints, pp) {
    // polypoints array of ints

    // code based on: http://alienryderflex.com/polygon_fill/
    const vp = this.info.vp;
    let i, j, x, y, ynode, yval;

    // scan thru all rows in viewport
    for (x = vp.left; x <= vp.right; x++) {
      ynode = [];

      // build node list
      j = numpoints - 1;
      for (i=0; i < numpoints; i++) {
        if ( ((pp[i*2] < x) && (pp[j*2] >= x)) || ((pp[j*2] < x) && (pp[i*2] >= x)) ) {

          yval = (x - pp[i*2]) / (pp[j*2] - pp[i*2]) * (pp[j*2+1] - pp[i*2+1]) + pp[i*2+1];
          //ynode.push( Math.round(yval) );
          //ynode.push( Math.floor(yval) );
          //ynode.push( Math.trunc(yval) );
          ynode.push( Math.ceil(yval) );
        }
        j = i;
      }

      // sort nodes
      if (ynode.length == 0) continue;
      ynode.sort(function(a, b) { return a - b; });

      // draw pixels between node pairs
      for (i=0; i < ynode.length; i+=2) {
        // clip to viewport edges
        if (ynode[i] > vp.bottom) break;
        if (ynode[i+1] >= vp.top) {
          if (ynode[i+1] > vp.bottom) { ynode[i+1] = vp.bottom; }
          if (ynode[i] < vp.top) { ynode[i] = vp.top; }
          for (y = ynode[i]; y <= ynode[i+1]; y++) {
            this.ff_putpixel(x, y, this.info.fill.color, BGI.COPY_PUT);
          }
        }
      }
    }
    // this fixes filled polygon border issues
    if (this.info.fgcolor !== this.info.bgcolor) {
      this.drawpoly(numpoints, pp);
    }
  }
*/

  // NOT IN SDL_bgi ?
  // Draws and fills a rectangle, using fgcolor, line & fill style. Includes border.
  fillrect (left, top, right, bottom) {
    this.bar(left, top, right, bottom);
    this.rectangle(left, top, right, bottom);
  }

  // Flood Fill
  // uses info.fill.color, info.fill.fpattern, & info.bgcolor.
  // uses info.writeMode but not sure if it should.
  // border or color = boundry color.
  // Returns if (x0, y0) is outside current viewport, or is already border color.
  // Clears then writes pixels of color 0xFF to this.fillpixels[]
  // which can be read after return to find out the fill area.
  // This floods horizontally before vertically in order to support a bug.

  floodfill (x0, y0, border) {
    this._floodfill(x0, y0, border);
  }
  _floodfill (x0, y0, border) {

    const vp = this.info.vp;
    this.fillpixels.fill(0);

    if ((x0 < 0) || (x0 >= vp.width ) || (y0 < 0) || (y0 >= vp.height)) { return }
    if (this.getpixel(x0, y0) === border) { return }

    let stack = [];
    stack.push([x0, y0]);
    let popped, count = 0;

    while (popped = stack.pop()) {
      let [x, y] = popped;
      let x1 = x, x2 = x + 1;

      // find left end of line (x1)
      while ((x1 >= 0) && (this.getpixel(x1, y) != border)) { x1--; }
      x1++;
      // find right end of line (x2)
      while ((x2 < vp.width) && (this.getpixel(x2, y) != border)) { x2++; }
      x2--;

      let spanUp = false, spanDown = false;
      for (x = x1; x <= x2; x++) {
        this.ff_putpixel(x, y, this.info.fill.color, BGI.COPY_PUT);
        this._putpixel(x, y, BGI.WHITE, BGI.COPY_PUT, this.fillpixels);
        count++;

        // intentional bug to prevent flooding up or down
        // through pixels along edges of viewport.
        if ((x <= 0) || (x >= vp.width - 1)) { continue }

        if (!spanUp && (y > 0)
          && (this.getpixel(x, y-1) !== border)
          && (this.getpixel(x, y-1, this.fillpixels) !== BGI.WHITE)) {
          stack.push([x, y-1]);
          spanUp = true;
        }
        else if (spanUp && (y > 0) && (this.getpixel(x, y-1) === border)) {
          spanUp = false;
        }

        if (!spanDown && (y < vp.height - 1)
          && (this.getpixel(x, y+1) != border)
          && (this.getpixel(x, y+1, this.fillpixels) !== BGI.WHITE)) {
          stack.push([x, y+1]);
          spanDown = true;
        }
        else if (spanDown && (y < vp.height - 1) && (this.getpixel(x, y+1) === border)) {
          spanDown = false;
        }
      }
    }
  }

  getarccoords (arccoords) { // ***
    // struct arccoordstype *arccoords
  }

  // returns an object {xasp:int, yasp:int}
  getaspectratio (/* xasp, yasp */) { // ***
    // int *xasp, int *yasp
    return this.aspect;
  }

  getbkcolor (/* void */) {
    return this.info.bgcolor; // int
  }

  getcolor (/* void */) {
    return this.info.fgcolor; // int
  }

  getdefaultpalette (/* void */) {
    // return struct palettetype*
    return BGI.ega_palette; // TODO: might change
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

  // Grab and return a byte array of image data.
  // returns this image object:
  // { x:int, y:int, width:int, height:int, data:Uint8ClampedArray }
  // uses this.pixels[]
  getimage (left, top, right, bottom) {
    // void *bitmap

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

    let w = (right - left + 1), h = (bottom - top + 1);
    let data = new Uint8ClampedArray(w * h);
    let i, o=0;
    for (let y=top; y <= bottom; ++y) {
      i = y * this.width + left;
      for (let x=left; x <= right; ++x) {
        data[o++] = this.pixels[i++];
      }
    }
    return {x: left, y: top, width: w, height: h, data: data};
  }

  getlinesettings (/* lineinfo */) { // ***
    // struct linesettingstype *lineinfo
    return this.info.line;
  }

  getmaxcolor (/* void */) {
    return BGI.MAXCOLORS; // ok for now
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

  // Get pixel NOT offset by current viewport, else return 0.
  // (if changed to offset, remember to fix it in floodfill().)
  getpixel (x, y, buf = this.pixels) {

    // since this is only called from floodfill(), we know they're already ints
    // x = Math.round(x);
    // y = Math.round(y);

    // offset by viewport
    const vp = this.info.vp;
    x += vp.left;
    y += vp.top;

    if ((x >= 0) && (x < this.width) && (y >= 0) && (y < this.height)) {
      return buf[y * this.width + x]; // int
    }
    return 0; // ???
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

    this.info = this.infoDefaults();

    // RGBA32 [r, g, b, a] same as npm's canvas
    //this.palette = new Uint8ClampedArray(256 * 4);
    this.palette = Uint8ClampedArray.from(BGI.ega_palette); // for now
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
    this.unimplemented('imagesize');
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
  // TODO: not done!
  installuserfont (name) {

    let idnum = BGI.fontFileIds[name];
    // TODO: load font file?
    return (idnum) ? idnum : 0; // TEST
  }

  // Draws a line in the current color, using the current write mode, line style, and thickness
  // between the two points without updating the current position (info.cp).
  line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {
    this._line(x1, y1, x2, y2, color, wmode, linestyle, thickness);
  }
  _line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {
    // TODO: pass in 'linesettingstype' object instead?

    // if y2 < y1, swap points
    if (y2 < y1) {
      let tmp = y1; y1 = y2; y2 = tmp;
      tmp = x1; x1 = x2; x2 = tmp;
    }

    // REMOVE (none of this fixes bug)
    // trying to fix bottom edge lines in FRACTMTN.RIP
    // if points outside viewport, move to inside. Not sure if this should be canvas bounds.
    //if (y1 < vp.top) { y1 = vp.top; }
    //if (y1 > vp.bottom) { return; }
    //if (y2 < vp.top) { return; }
    //if (y2 > vp.bottom) { y2 = vp.bottom + 1; }
    /*
    if (x1 < vp.left) { x1 = vp.left; }
    if (x1 > vp.right) { x1 = vp.right; }
    if (x2 < vp.left) { x2 = vp.left; }
    if (x2 > vp.right) { x2 = vp.right; }
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
  linerel (dx, dy, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {

    this.line(this.info.cp.x, this.info.cp.y, this.info.cp.x + dx, this.info.cp.y + dy,
      color, wmode, linestyle, thickness);
    this.info.cp.x += dx;
    this.info.cp.y += dy;
  }

  // Draws a line from the CP (current position) to (x,y), then moves the CP to (x,y).
  lineto (x, y, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {

    this.line(this.info.cp.x, this.info.cp.y, x, y, color, wmode, linestyle, thickness);
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

  // Draws text using current info.cp position, info.text.charsize and info.text.direction
  // TODO: doesn't yet support BGI.DEFAULT_FONT (0)
  outtext (text) {

    const fontnum = this.info.text.font;

    // TODO: skipping font 0 for now...
    if ((fontnum > 0) && (fontnum < BGI.fontFileList.length)) {
      const fontname = BGI.fontFileList[fontnum];
      // loop thru each character in text string
      text.split('').forEach(c => {
        const cvalue = c.charCodeAt(0) & 0xFF; // to strip out 2nd byte
        this.drawChar(cvalue, fontname, this.info.text.charsize, this.info.text.direction);
      });
    }
  }

  // Draws text after offseting position by (x, y) + offsetting y by other factors.
  outtextxy (x, y, text) {

    const fontnum = this.info.text.font;
    // TODO: skipping font 0 for now...
    if ((fontnum > 0) && (fontnum < BGI.fontFileList.length)) {

      const fontname = BGI.fontFileList[fontnum];
      const font = this.fonts[fontname];
      const scale = this.info.text.charsize;
      const actualScale = (scale < BGI.fontScales.length) ? BGI.fontScales[scale] : 1;

      //console.log(font); // DEBUG

      // offset initial y position
      const yoffset = Math.trunc((font.top - font.bottom) * actualScale);

      // FIXME: most y offsets correct, except in FELIX.RIP, NO-L.RIP, STPATS95.RIP

      this.moveto(x, y + yoffset);
      this.outtext(text);
    }
  }

  // fills with fill color and pattern.
  // outlines with fgcolor and thickness. doesn't use line style.
  pieslice (cx, cy, stangle, endangle, radius) {

    if ((radius < 1) || (stangle === endangle)) { return } // TODO: test against reference
    // adjust radius based on aspect ratio
    const yradius = Math.floor( radius * (this.aspect.xasp / this.aspect.yasp) );
    this.sector(cx, cy, stangle, endangle, radius, yradius);
  }

  // Put byte array of image data on to pixels[]
  // image is an object:
  // { x:int, y:int, width:int, height:int, data:Uint8ClampedArray }
  putimage (left, top, image, wmode) {

    // OLD
    // putimage (left, top, bitmap, op)
    //   bitmap = points to where image stored
    //   op = see putimage_ops enum (0=COPY, 1=XOR, 2=OR, 3=AND, 4=NOT)
    //   no info on whether image gets clipped by viewport ???

    if (!(image && image.data)) {
      this.log('err', 'putimage() missing image!');
      return;
    }

    // offset by viewport
    const vp = this.info.vp;
    left += vp.left;
    top += vp.top;

    const data = image.data; // Uint8ClampedArray
    let right = left + image.width - 1;
    let bottom = top + image.height - 1;
    let i=0, o=0;

    // exit if outside canvas bounds
    // TODO: what about viewport bounds?
    if ((right >= this.width) || (bottom >= this.height)) { return false; }

    switch (wmode) {
      default:
      case BGI.COPY_PUT:
        for (let y=top; y <= bottom; ++y) {
          o = y * this.width + left;
          for (let x=left; x <= right; ++x) {
            this.pixels[o++] = data[i++];
          }
        }
        break;

      case BGI.XOR_PUT:
        for (let y=top; y <= bottom; ++y) {
          o = y * this.width + left;
          for (let x=left; x <= right; ++x) {
            this.pixels[o++] ^= data[i++];
          }
        }
        break;

      case BGI.OR_PUT:
        for (let y=top; y <= bottom; ++y) {
          o = y * this.width + left;
          for (let x=left; x <= right; ++x) {
            this.pixels[o++] |= data[i++];
          }
        }
        break;

      case BGI.AND_PUT:
        for (let y=top; y <= bottom; ++y) {
          o = y * this.width + left;
          for (let x=left; x <= right; ++x) {
            this.pixels[o++] &= data[i++];
          }
        }
        break;

      case BGI.NOT_PUT:
        for (let y=top; y <= bottom; ++y) {
          o = y * this.width + left;
          for (let x=left; x <= right; ++x) {
            this.pixels[o++] = ~data[i++] & this.colorMask;
          }
        }
    }
    return true;
  }

  // returns a non-uniform random integer >= 0 and < range.
  random (range) {
    return Math.floor(Math.random() * range);
  }

  // TODO
  readimagefile (filename, x1, y1, x2, y2) {
    // const char* filename=NULL, int left=0, int top=0, int right=INT_MAX, int bottom=INT_MAX
    // reads a BMP, GIF, JPG, ICON, EMF, or WMF image file.
    // displays it in part of the current active window.
    // unknown: would x2,y2 crop the image if under size of image? (I'd think so)
    // nothing returned
  }

  // draws in current line style, thickness, and drawing color
  rectangle (left, top, right, bottom, color = this.info.fgcolor, wmode = this.info.writeMode) {

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }
    this._line(left, top, right, top, color, wmode);
    this._line(right, top, right, bottom, color, wmode);
    this._line(right, bottom, left, bottom, color, wmode);
    this._line(left, bottom, left, top, color, wmode);
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
  sector (cx, cy, stangle, endangle, xradius, yradius) {
    // Outlines using current color, filled using pattern & color.
    // from setfillstyle & setfillpattern.
    // Angles in degrees, counter-clockwise: 0=3o'clock, 90=12o'clock

    // draw a single pixel at center instead
    if (stangle === endangle) {
      this.putpixel(cx, cy);
      return;
    }

    // TODO: don't know if these are correct, or should we exit?
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // swap if start > end (unlike elliptical arcs!)
    // some pies may not be represented if angles > 360 aren't allowed!
    if (stangle > endangle) { let t = stangle; stangle = endangle; endangle = t; }

    // draw outline
    this._ellipse(cx, cy, stangle, endangle, xradius, yradius);

    // calculate start and end pixels for pie wedge
    const twoPiD = 2 * Math.PI / 360;
    let x1 = cx + Math.round(xradius * Math.cos(stangle * twoPiD));
    let y1 = cy - Math.round(yradius * Math.sin(stangle * twoPiD));
    let x2 = cx + Math.round(xradius * Math.cos(endangle * twoPiD));
    let y2 = cy - Math.round(yradius * Math.sin(endangle * twoPiD));

    // draw pie wedge lines to center
    this._line(cx, cy, x1, y1);
    this._line(cx, cy, x2, y2);

    // TODO: Pie filling
    // May need something like a modified fillellipse_bresenham()
    // which I haven't figured out how to do yet...

    // Alternately use floodfill, which is not perfect.

    // To pick a point for the floodfill, take the angle
    // halfway between the start & end, find that point
    // along ellipse, then take midpoint to center.

    // fill pie using floodfill
    let half_angle = (endangle - stangle) / 2 + stangle; // assuming stangle < endangle
    let fx = Math.round((xradius * Math.cos(half_angle * twoPiD)) / 2 + cx);
    let fy = Math.round((yradius * -Math.sin(half_angle * twoPiD)) / 2 + cy);
    this._floodfill (fx, fy, this.info.fgcolor);
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
    this.aspect = { xasp: xasp, yasp: yasp };
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

  // fpattern is an array of 8 ints (0-255), each byte is 8 pixels in the pattern.
  setfillpattern (fpattern, color) {
    // void setfillpattern(char *upattern, int color);
    this.info.fill.color = color;
    if (fpattern && (fpattern.length === 8)) {
      this.info.fill.style = BGI.USER_FILL;
      this.info.fill.fpattern = fpattern;
    }
  }

  // style is index 0-11 into fill_patterns[]
  // pattern bits 0=current bg color, 1=color (passed in, not global color)
  setfillstyle (style, color) {

    this.info.fill.color = color;
    if ((style >= 0) && (style <= BGI.USER_FILL)) {
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
      this.log('bgi', `setpalette() color [${color}] not supported!`);
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
      this.palette[pi + 0] = red;
      this.palette[pi + 1] = green;
      this.palette[pi + 2] = blue;
      this.palette[pi + 3] = 255;
    }
    else {
      this.log('bgi', `setrgbpalette() colornum [${colornum}] out of range!`);
    }
  }

  // TODO
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
    this.info.text.font = font;
    this.info.text.direction = direction;
    this.info.text.charsize = charsize;
  }

  // TODO
  setusercharsize (multx, divx, multy, divy) {
    // setusercharsize gives finer control over the size of text from stroked fonts.
    // SEE https://www.cs.colorado.edu/~main/bgi/doc/setusercharsize.html
  }

  // Sets the current viewport for graphics output.
  // Current position (CP) is moved to (0,0) in the new window. (so coords change??)
  // If clip is true, all drawings will be clipped to the current viewport.
  setviewport (x1, y1, x2, y2, clip) {

    // swap
    if (x1 > x2) { let tmp = x1; x1 = x2; x2 = tmp; }
    if (y1 > y2) { let tmp = y1; y1 = y2; y2 = tmp; }

    if ((x1 >= 0) && (x2 < this.width) && (y1 >= 0) && (y2 < this.height)) {
      this.info.vp.left = x1;
      this.info.vp.top = y1;
      this.info.vp.right = x2;
      this.info.vp.bottom = y2;
      this.info.vp.width = x2 - x1 + 1;
      this.info.vp.height = y2 - y1 + 1;
      this.info.vp.clip = clip;
      this.info.cp.x = 0;
      this.info.cp.y = 0;
      this.log('bgi', `viewport set to (${x1},${y1})-(${x2},${y2})`);
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
    this.info.writeMode = mode;
  }

  // TODO
  // takes current font size and multiplication factor, and determines the height of text in pixels.
  textheight (text) {
    return 0;
  }
  
  // TODO
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

////////////////////////////////////////////////////////////////////////////////
// class constants

  // fonts
  BGI.DEFAULT_FONT=0; BGI.TRIPLEX_FONT=1; BGI.SMALL_FONT=2; BGI.SANSSERIF_FONT=3;
  BGI.GOTHIC_FONT=4; BGI.SCRIPT_FONT=5; BGI.SIMPLEX_FONT=6; BGI.TRIPLEX_SCR_FONT=7;
  BGI.COMPLEX_FONT=8; BGI.EUROPEAN_FONT=9; BGI.BOLD_FONT=10;

  // text alignment used in settextjustify()
  BGI.HORIZ_DIR=0; BGI.VERT_DIR=1; // text_just enum
  BGI.LEFT_TEXT=0; BGI.CENTER_TEXT=1; BGI.RIGHT_TEXT=2;
  BGI.BOTTOM_TEXT=0; BGI.TOP_TEXT=2; // or is it?? top=0 bottom=1 baseline=2

  // BGI colors
  BGI.BLACK=0; BGI.BLUE=1; BGI.GREEN=2; BGI.CYAN=3; BGI.RED=4; BGI.MAGENTA=5;
  BGI.BROWN=6; BGI.LIGHTGRAY=7; BGI.DARKGRAY=8; BGI.LIGHTBLUE=9; BGI.LIGHTGREEN=10;
  BGI.LIGHTCYAN=11; BGI.LIGHTRED=12; BGI.LIGHTMAGENTA=13; BGI.YELLOW=14; BGI.WHITE=15;
  BGI.MAXCOLORS=15; BGI.BGI_COLORS=16; // do we need this?

  // line style, thickness, and drawing mode
  BGI.SOLID_LINE=0; BGI.DOTTED_LINE=1; BGI.CENTER_LINE=2;
  BGI.DASHED_LINE=3; BGI.USERBIT_LINE=4; // line_styles enum
  BGI.NORM_WIDTH=1; BGI.THICK_WIDTH=3;
  BGI.COPY_PUT=0; BGI.XOR_PUT=1; BGI.OR_PUT=2; BGI.AND_PUT=3; BGI.NOT_PUT=4; // putimage_ops enum

  // fill styles
  BGI.EMPTY_FILL=0; BGI.SOLID_FILL=1; BGI.LINE_FILL=2; BGI.LTSLASH_FILL=3;
  BGI.SLASH_FILL=4; BGI.BKSLASH_FILL=5; BGI.LTBKSLASH_FILL=6; BGI.HATCH_FILL=7;
  BGI.XHATCH_FILL=8; BGI.INTERLEAVE_FILL=9; BGI.WIDE_DOT_FILL=10; BGI.CLOSE_DOT_FILL=11;
  BGI.USER_FILL=12;

  // numbers
  BGI.PI_CONV = (3.1415926 / 180.0);

  // these not in BGI spec
  BGI.fontFileIds = {
    'TRIP.CHR': BGI.TRIPLEX_FONT,
    'LITT.CHR': BGI.SMALL_FONT,
    'SANS.CHR': BGI.SANSSERIF_FONT,
    'GOTH.CHR': BGI.GOTHIC_FONT,
    'SCRI.CHR': BGI.SCRIPT_FONT,
    'SIMP.CHR': BGI.SIMPLEX_FONT,
    'TSCR.CHR': BGI.TRIPLEX_SCR_FONT,
    'LCOM.CHR': BGI.COMPLEX_FONT,
    'EURO.CHR': BGI.EUROPEAN_FONT,
    'BOLD.CHR': BGI.BOLD_FONT
  };
  BGI.fontFileList = [
    '', 'TRIP.CHR', 'LITT.CHR', 'SANS.CHR', 'GOTH.CHR', 'SCRI.CHR',
    'SIMP.CHR', 'TSCR.CHR', 'LCOM.CHR', 'EURO.CHR', 'BOLD.CHR'
  ];
  BGI.fontScales = [ 1, 0.6, 2/3, 0.75, 1, 4/3, 5/3, 2, 2.5, 3, 4 ];


////////////////////////////////////////////////////////////////////////////////
