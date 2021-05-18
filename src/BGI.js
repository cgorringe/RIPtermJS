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

  constructor (ctx, width, height) {

    // public fields
    this.width = 1;
    this.height = 1;
    this.isBuffered = true; // true = copy pixels to context, false = using context data store
    this.colorMask = 0x0F;  // 0xF = 16-color mode, 0xFF = 256-color mode
    this.initContext(ctx, width, height);
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
      vp: { left: 0, top: 0, right: (this.width - 1), bottom: (this.height - 1), clip: 0 }, // viewport / visual page?
      // ap: { left: 0, top: 0, right: (this.width - 1), bottom: (this.height - 1), clip: 0 }, // active port / page?
      // max: { x: (this.width - 1), y: (this.height - 1) }, // just use width & height?
      writeMode: 0, // 0=COPY, 1=XOR, 2=OR, 3=AND, 4=NOT
      font: { width: 0, height: 0 }, // ??
      fontMag: { x: 1.0, y: 1.0 }, // font magnification
      aspect: { xasp: 371, yasp: 480 }, // aspect ratio used to make circles round // TODO: MOVE THIS?
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
      console.error('Missing width or height in context passed to BGI()!');
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

    // this temp pixel buffer is used during flood fill
    this.tpixels = new Uint8ClampedArray(this.width * this.height)
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

  unimplemented (method) {
    console.log('BGI.' + method + '() not implemented.')
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

  // (see line 3225 & 3362 of SDL_bgi.c)
  // Draws a pixel offset by and clipped by current viewport.
  putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {

    const vp = this.info.vp;
    // TODO: Not sure if offsetting pixel is the right thing to do.
    // x += vp.left;
    // y += vp.top;

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
          this.pixels[y * this.width + x] = (~color & this.colorMask);
      }
    }
  }

  // TODO: compare to _putpixel(x, y)

  // floodfill putpixel using fill pattern.
  // uses info.fill.color, info.bgcolor, and info.fill.fpattern that must be pre-set.
  ff_putpixel (x, y, color = this.info.fill.color, wmode = this.info.writeMode) {

    // skip adjusting offset since putpixel() does it
    const bgcolor = this.info.bgcolor;
    const fpattern = this.info.fill.fpattern; // array

    // draw pixel if bit in pattern is 1
    if ( (fpattern[y % 8] >> (7 - (x % 8))) & 1) {
      // forground pixel
      this.putpixel(x, y, color, wmode);
    }
    else {
      // background pixel
      this.putpixel(x, y, bgcolor, wmode);
    }
  }

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
        this.putpixel(x, y, color, wmode);
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
  // Standard BGI functions
  // SEE https://www.cs.colorado.edu/~main/bgi/doc/
  // To convert Pascal syntax to JS, simply convert function names to lowercase.

  // Draw a circular arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  arc (x, y, stangle, endangle, radius, thickness = this.info.line.thickness) {

    if ((radius < 1) || (stangle === endangle)) { return } // TODO: test against reference
    // adjust radius based on aspect ratio
    const yradius = radius * (this.info.aspect.xasp / this.info.aspect.yasp);
    this.ellipse(x, y, stangle, endangle, radius, yradius, thickness)
  }

  // Draws and fills a rectangle, using fill style and color. Has no border. (see fillrect)
  // For a border, use bar3d with depth = 0.
  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

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

    if (radius < 1) { return } // TODO: test against reference image
    if ((this.info.aspect.xasp === this.info.aspect.yasp) && (thickness === BGI.NORM_WIDTH)) {
      // draw better-looking circle only if thin and aspect ratio 1:1
      this.circle_bresenham(x, y, radius);
    }
    else {
      // draw using different algorithm
      this.arc(x, y, 0, 360, radius);
    }
  }

  // Clears the screen, filling it with the current background color.
  // Resets CP to (0,0).
  cleardevice (bgcolor = this.info.bgcolor) {

    this.info.cp.x = 0;
    this.info.cp.y = 0;
    this.pixels.fill(bgcolor);
    this.tpixels.fill(0);
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
      console.log('BGI.drawbezier() invalid args!', numsegments, cntpoints);
      return;
    }
    const [x1, y1, x2, y2, x3, y3, x4, y4] = cntpoints;
    let step = 1 / numsegments;
    let xp = x1, yp = y1, xn, yn;
    for (let t = step; t < 1; t += step) {
      let t1 = 1 - t;
      xn = Math.floor( t1*t1*t1 * x1 + 3 * t * t1*t1 * x2 + 3 * t*t * t1 * x3 + t*t*t * x4 );
      yn = Math.floor( t1*t1*t1 * y1 + 3 * t * t1*t1 * y2 + 3 * t*t * t1 * y3 + t*t*t * y4 );
      this.line(xp, yp, xn, yn);
      xp = xn;
      yp = yn;
    }
    this.line(xp, yp, x4, y4);
  }

  // Draws a closed polygon.
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  drawpoly (numpoints, polypoints) {
    // polypoints array of ints

    if (!(numpoints && polypoints && (numpoints >= 2) && (polypoints.length >= numpoints * 2))) {
      console.log('BGI.drawpoly() invalid args!', numpoints, polypoints);
      return;
    }

    for (let n=0; n < numpoints - 1; n++) {
      this.line(polypoints[2*n], polypoints[2*n + 1],  polypoints[2*n + 2], polypoints[2*n + 3]);
    }
    // close the polygon
    this.line(polypoints[2 * numpoints - 2], polypoints[2 * numpoints - 1], polypoints[0], polypoints[1]);
  }

  // Draws a polyline. [NOT IN BGI]
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  drawpolyline (numpoints, polypoints) {
    // polypoints array of ints

    if (!(numpoints && polypoints && (numpoints >= 2) && (polypoints.length >= numpoints * 2))) {
      console.log('BGI.drawpolyline() invalid args!', numpoints, polypoints);
      return;
    }

    for (let n=0; n < numpoints - 1; n++) {
      this.line(polypoints[2*n], polypoints[2*n + 1],  polypoints[2*n + 2], polypoints[2*n + 3]);
    }
  }

  // Draw an elliptical arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  ellipse (x, y, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {

    // TODO: don't know if these are correct
    if (stangle === endangle) { return }
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // following copied from ripscript.js v2 drawOvalArc()
    // TODO: find smoother algorithm

    const twoPiD = 2 * Math.PI / 360;
    if (stangle > endangle) { endangle += 360; }
    let x1, y1;
    let x0 = x + Math.round(xradius * Math.cos(stangle * twoPiD));
    let y0 = y - Math.round(yradius * Math.sin(stangle * twoPiD));

    // draw arc counter-clockwise
    for (let n = stangle; n <= endangle; n += 3) {
      // test with: Math.floor() .round() .trunc()
      x1 = x + Math.round(xradius * Math.cos(n * twoPiD));
      y1 = y - Math.round(yradius * Math.sin(n * twoPiD));
      this.line(x0, y0, x1, y1, this.info.fgcolor, BGI.COPY_PUT, BGI.SOLID_LINE, thickness);
      x0 = x1; y0 = y1;
    }

  }

  fillellipse (x, y, xradius, yradius) {

    // TODO: don't know if these are correct, or should we exit?
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // TODO: should this be outlined or not?
    // TODO: algorithm here

  }

  // Draw a filled polygon, using current fill pattern, fill color and bgcolor.
  // pp is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  fillpoly (numpoints, pp) {
    // polypoints array of ints

    // code based on: http://alienryderflex.com/polygon_fill/
    const vp = this.info.vp;
    let i, j, x, y, xnode;

    // scan thru all rows in viewport
    for (y = vp.top; y <= vp.bottom; y++) {
      xnode = [];

      // build node list
      j = numpoints - 1;
      for (i=0; i < numpoints; i++) {
        if ( ((pp[i*2+1] < y) && (pp[j*2+1] >= y)) || ((pp[j*2+1] < y) && (pp[i*2+1] >= y)) ) {
          // FIXME: there are off-by-one pixels along edges of polygon.
          // Test PLANE.RIP: ceil() & floor() work on different polygons.
          // GARFIELD.RIP floodfill still buggy (btw lines 293-296 in .RIP) from octant() change???
          xnode.push( Math.round( (y-pp[i*2+1]) / (pp[j*2+1]-pp[i*2+1]) * (pp[j*2]-pp[i*2]) + pp[i*2] ));
          // xnode.push( (y-pp[i*2+1]) / (pp[j*2+1]-pp[i*2+1]) * (pp[j*2]-pp[i*2]) + pp[i*2] );
        }
        j = i;
      }

      // sort nodes
      if (xnode.length == 0) continue;
      xnode.sort(function(a, b) { return a - b; });

      // draw pixels between node pairs
      for (i=0; i < xnode.length; i+=2) {
        // clip to viewport edges
        if (xnode[i] > vp.right) break;
        if (xnode[i+1] >= vp.left) {
          if (xnode[i+1] > vp.right) { xnode[i+1] = vp.right; }
          if (xnode[i] < vp.left) { xnode[i] = vp.left; }
          // for (x = Math.ceil(xnode[i]); x <= Math.floor(xnode[i+1]); x++) { // TEST
          for (x = xnode[i]; x <= xnode[i+1]; x++) {
            this.ff_putpixel(x, y, this.info.fill.color, BGI.COPY_PUT);
          }
        }
      }
    }
    // this fixes filled polygon border issues
    // not sure if bgcolor should just be 0, but since bgcolor is never set != 0, it doesn't matter
    if (this.info.fgcolor !== this.info.bgcolor) {
      this.drawpoly(numpoints, pp);
    }
  }

  // NOT IN SDL_bgi ?
  // Draws and fills a rectangle, using fgcolor, line & fill style. Includes border.
  fillrect (left, top, right, bottom) {
    this.bar(left, top, right, bottom);
    this.rectangle(left, top, right, bottom);
  }

  // Flood Fill
  // uses info.fill.color, info.fill.fpattern, & info.bgcolor
  // uses info.writeMode but not sure if it should
  // border or color = boundry color
  // uses this.tpixels[] temp pixel buffer
  floodfill (x0, y0, border) {

    // may not be the fastest routine
    // copied from ripterm.js v2

    if (this.getpixel(x0, y0) === border) { return }

    this.tpixels.fill(0);
    const vp = this.info.vp;
    let stack = [];
    stack.push([x0, y0]);
    let popped, count = 0;

    while (popped = stack.pop()) {
      let [x, y] = popped;
      let y1 = y, y2 = y + 1;

      // find top of line (y1)
      while ((y1 >= vp.top) && (this.getpixel(x, y1) != border)) { y1--; }
      y1++;
      // find bottom of line (y2)
      while ((y2 <= vp.bottom) && (this.getpixel(x, y2) != border)) { y2++; }
      y2--;

      let spanLeft = false, spanRight = false;
      for (y = y1; y <= y2; y++) {
        this.ff_putpixel(x, y, this.info.fill.color, BGI.COPY_PUT);
        this.tpixels[y * this.width + x] = 0xFF;
        count++;

        if (!spanLeft && (x > vp.left) && (this.getpixel(x-1, y) != border) && (this.tpixels[y * this.width + x-1] != 0xFF)) {
          stack.push([x-1, y]);
          spanLeft = true;
        }
        else if (spanLeft && (x > vp.left) && (this.getpixel(x-1, y) == border)) {
          spanLeft = false;
        }

        if (!spanRight && (x < vp.right) && (this.getpixel(x+1, y) != border) && (this.tpixels[y * this.width + x+1] != 0xFF)) {
          stack.push([x+1, y]);
          spanRight = true;
        }
        else if (spanRight && (x < vp.right) && (this.getpixel(x+1, y) == border)) {
          spanRight = false;
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
    return this.info.aspect;
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

  // Get pixel offset by current viewport, else return 0.
  getpixel (x, y, buf = this.pixels) {

    // offset by viewport (skip for now)
    // const vp = this.info.vp;
    // x += vp.left;
    // y += vp.top;

    if ((x >= 0) && (x < this.width) && (y >= 0) && (y < this.height)) {
      return buf[y * this.width + x]; // int
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
  installuserfont (name) {
    return 0; // int
  }

  // Draws a line in the current color, using the current write mode, line style, and thickness
  // between the two points without updating the current position (info.cp).
  line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {
    // TODO: pass in 'linesettingstype' object instead?

    // already offset by viewport in putpixel()
    const vp = this.info.vp;

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

  // fills with fill color and pattern.
  // outlines with fgcolor and thickness. doesn't use line style.
  pieslice (x, y, stangle, endangle, radius) {

    if ((radius < 1) || (stangle === endangle)) { return } // TODO: test against reference
    // adjust radius based on aspect ratio
    const yradius = radius * (this.info.aspect.xasp / this.info.aspect.yasp);
    this.sector(x, y, stangle, endangle, radius, yradius);
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
      console.log('BGI.putimage() missing image!', image);
      return;
    }

    const data = image.data; // Uint8ClampedArray
    let right = left + image.width - 1;
    let bottom = top + image.height - 1;
    let i=0, o=0;

    // exit if outside canvas bounds
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

  // NOT IN BGI
  // random (range) { return (rand() % (range)) }

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
    this.line(left, top, right, top, color, wmode);
    this.line(right, top, right, bottom, color, wmode);
    this.line(right, bottom, left, bottom, color, wmode);
    this.line(left, bottom, left, top, color, wmode);
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
  sector (x, y, stangle, endangle, xradius, yradius) {
    // Outlines using current color, filled using pattern & color.
    // from setfillstyle & setfillpattern.
    // Angles in degrees, counter-clockwise: 0=3o'clock, 90=12o'clock

    // TODO: don't know if these are correct, or should we exit?
    if (stangle === endangle) { return }
    if (xradius < 1) { xradius = 1; }
    if (yradius < 1) { yradius = 1; }

    // TODO: algorithm here

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
    this.info.aspect.xasp = xasp;
    this.info.aspect.yasp = yasp;
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
      this.palette[pi + 0] = red;
      this.palette[pi + 1] = green;
      this.palette[pi + 2] = blue;
      this.palette[pi + 3] = 255;
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
    this.info.writeMode = mode;
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
  BGI.GOTHIC_FONT=4; BGI.BIG_FONT=5; BGI.SCRIPT_FONT=6; BGI.SIMPLEX_FONT=7;
  BGI.TRIPLEX_SCR_FONT=8; BGI.COMPLEX_FONT=9; BGI.EUROPEAN_FONT=10; BGI.BOLD_FONT=11;

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


////////////////////////////////////////////////////////////////////////////////
