/**
 * BGIsvg.js
 * Copyright (c) 2021 Carl Gorringe 
 * https://carl.gorringe.org
 * https://github.com/cgorringe/RIPtermJS
 *
 **/

class BGIsvg extends BGI {

  ////////////////////////////////////////////////////////////////////////////////
  // Contructor & init methods

  // Pass an object to constructor with these keys:
  //   svg: SVGElement() - required
  //   ctx: CanvasRenderingContext2D() - required
  //   width: int - optional if ctx derived from a <canvas>
  //   height: int - optional if ctx derived from a <canvas>

  constructor (args) {

    // init SVG
    if (args && (typeof BGI !== 'undefined') && ('svg' in args)) {
      super(args);

      // public vars
      this.svgPrefix = ('prefix' in args) ? args.prefix : 'rip';
      this.svgViewCount = 0;
      this.svgFillCount = 0;
      this.svgFillId = this.svgPrefix + '-fill0';
      this.svgDashArray = [1, 0]; // SOLID_LINE
      this.svgActive = true;

      if (args.svg instanceof SVGElement) {
        this.svg = args.svg;
        this.resetSVG();
      }
      else {
        this.log('err', 'svg passed in to BGIsvg() needs to be an SVGElement!');
      }

      if (typeof Potrace !== 'undefined') {
        // turnpolicy ("black" / "white" / "left" / "right" / "minority" / "majority")
        Potrace.setParameter({ turdsize: 0, turnpolicy: "minority" });
      }
      else {
        this.log('err', 'Potrace() missing! Need to load BGIpotrace.js before BGIsvg.js!');
      }
    }
    else {
      // can't use this.log()
      console.error('BGIsvg() could not be initialized!');
    }
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Extra methods

  // color is index color 0-15, returns hex color as '#rrggbb'
  pal2hex (color) {
    const c = color * 4;
    return '#' +
      Number(this.palette[c+0]).toString(16).padStart(2, '0') +
      Number(this.palette[c+1]).toString(16).padStart(2, '0') +
      Number(this.palette[c+2]).toString(16).padStart(2, '0');
  }

  // returns polypoints with dx, dy added to each point.
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  offsetPoints (dx, dy, polypoints) {
    const nump = Math.floor(polypoints.length / 2);
    for (let i=0; i < nump; i++) {
      polypoints[i*2] += dx;
      polypoints[i*2+1] += dy;
    }
    return polypoints;
  }

  // dict is object of key:value attribute pairs.
  // text is optional.
  svgNode (elem, dict, text) {
    elem = document.createElementNS("http://www.w3.org/2000/svg", elem);
    for (var k in dict) {
      if ((dict[k] != null) && (dict[k] != "")) {
        elem.setAttribute(k, dict[k]);
      }
    }
    if (text) {
      elem.appendChild(document.createTextNode(text));
    }
    return elem
  }

  svgSetViewport (vp) {
    // vp is an object: {left:, top:, right:, bottom:}
    // uses this.svg, this.svgView, this.svgViewCount

    if (this.svg && this.svgActive && vp) {
      let id = this.svgPrefix + '-vp' + this.svgViewCount;
      let defs = this.svgNode('defs', {});
      let clipPath = this.svgNode('clipPath', { 'id': id });
      let rect = this.svgNode('rect', {
        'x': vp.left, 'y': vp.top, 'width': (vp.right - vp.left + 1), 'height': (vp.bottom - vp.top + 1)
      });
      clipPath.appendChild(rect);
      defs.appendChild(clipPath);
      this.svg.appendChild(defs);
      this.svgView = this.svgNode('g', { 'clip-path': `url(#${id})` });
      this.svg.appendChild(this.svgView);
      this.svgViewCount++;
    }
  }

  resetSVG () {
    if (this.svg) {
      this.svgViewCount = 0;
      this.svg.innerHTML = '';
      this.svgSetViewport(this.info.vp);
      // fill viewport with background color
      this.svgView.appendChild( this.svgNode('rect', {
        'x': 0, 'y': 0, 'width': this.width, 'height': this.height, 'fill': this.pal2hex(this.info.bgcolor)
      }));
    }
  }

  // Takes a 16-bit RIP linePattern and returns an array of numbers to use in an
  // SVG "stroke-dasharray" attribute.  Since dash arrays must begin with 'on' pixels
  // before any 'off' gaps, the result may be phase-shifted from the original linePattern
  // if it begins with 0s.
  // Returns an empty array for no or transparent stroke.
  // TODO: use "stroke-dashoffset" to fix above?
  //
  svgMakeDashArray (linePattern) {

    let dashes = [], pat = linePattern;

    // check for empty pattern
    if ((pat & 0xFFFF) != 0) {
      // shift until first 1 bit
      let n=16, c=16;
      while (((pat & 0x8000) === 0) && (n > 0)) {
        pat = (pat << 1) & 0xFFFF;
        n--;
      }
      while (c > 0) {
        n=0;
        while (((pat & 0x8000) != 0) && (c > 0)) {
          pat = (pat << 1) & 0xFFFF;
          n++; c--;
        }
        dashes.push(n);
        n=0;
        while (((pat & 0x8000) === 0) && (c > 0)) {
          pat = (pat << 1) & 0xFFFF;
          n++; c--;
        }
        dashes.push(n);
      }
    }
    return dashes;
  }

  svgMakeFillPattern (fillPattern) {

    let d = '', bit;
    for (let y=0; y < 8; y++) {
      for (let x=0; x < 8; x++) {
        bit = (fillPattern[y] >> (7 - x)) & 1;
        if (bit) {
          d += ` M${x} ${y} h1 v1 h-1 Z`;
        }
      }
    }
    return d;
  }

  svgAppendFillPattern (fillPattern, color) {

    if (this.svgView && this.svgActive) {
      this.svgFillId = this.svgPrefix + '-fill' + this.svgFillCount;
      this.svgFillCount++;
      let pathTxt = this.svgMakeFillPattern(fillPattern);
      let defs = this.svgNode('defs', {});
      let pattern = this.svgNode('pattern', {
        'id': this.svgFillId, 'width': 8, 'height': 8, 'patternUnits': 'userSpaceOnUse'
      });
      // fill with background color
      pattern.appendChild( this.svgNode('path', { 'd': 'M0 0 H8 V8 H0 Z', 'fill': this.pal2hex(this.info.bgcolor) }));
      // fill pattern
      pattern.appendChild( this.svgNode('path', { 'd': pathTxt, 'fill': this.pal2hex(color) }));
      defs.appendChild(pattern);
      this.svgView.appendChild(defs);
    }
  }

  // Returns an SVG path string which defines an oval arc
  svgArcPathD (xc, yc, sa, ea, xrad, yrad, pieFlag) {
    // Arc: "M x0 y0  A rx ry x-axis-rotation large-arc-flag sweep-flag x1 y1"
    // Pie: "M xc yc  L x0 y0  A rx ry x-axis-rotation large-arc-flag sweep-flag x1 y1  Z"

    const twoPiD = 2 * Math.PI / 360;
    if (sa > ea) ea += 360;
    let x0 = (xc + Math.floor(xrad * Math.cos(sa * twoPiD))).toFixed(1);
    let y0 = (yc - Math.floor(yrad * Math.sin(sa * twoPiD))).toFixed(1);
    let x1 = (xc + Math.floor(xrad * Math.cos(ea * twoPiD))).toFixed(1);
    let y1 = (yc - Math.floor(yrad * Math.sin(ea * twoPiD))).toFixed(1);
    let largeArc = (ea - sa > 180) ? 1 : 0;
    let d;
    if (pieFlag) {
      d = `M ${xc} ${yc} L ${x0} ${y0} A ${xrad} ${yrad} 0 ${largeArc} 0 ${x1} ${y1} Z`;
    }
    else {
      d = `M ${x0} ${y0} A ${xrad} ${yrad} 0 ${largeArc} 0 ${x1} ${y1}`;
    }
    return d;
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Standard BGI functions

  putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {
    super.putpixel(x, y, color, wmode);

    if (this.svgView && this.svgActive) {
      x += this.info.vp.left;
      y += this.info.vp.top;
      this.svgView.appendChild( this.svgNode('circle', {
        'cx': (x + 0.5), 'cy': (y + 0.5), 'r': 0.5, 'fill': this.pal2hex(color)
      }));
    }
  }

  // Draws and fills a rectangle, using fill style and color. Has no border. (see fillrect)
  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {
    super.bar(left, top, right, bottom, color, wmode);

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

    if (this.svgView && this.svgActive) {
      const vp = this.info.vp;
      left += vp.left; right += vp.left;
      top += vp.top; bottom += vp.top;
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('rect', {
        'x': left, 'y': top, 'width': (right - left + 1), 'height': (bottom - top + 1), 'fill': fill
      }));
    }
  }

  // Draw a circular arc centered at (x, y), from stangle to endangle in degrees,
  // counterclockwise with 0 = 3 o'clock, 90 = 12 o'clock, etc.
  // doesn't use linestyle.
  arc (cx, cy, stangle, endangle, radius, thickness = this.info.line.thickness) {
    // adjust radius based on aspect ratio
    // TODO: this may be off?
    const yradius = Math.floor( radius * (this.aspect.xasp / this.aspect.yasp) );
    this.ellipse(cx, cy, stangle, endangle, radius, yradius, thickness);
  }

  circle (cx, cy, radius, thickness = this.info.line.thickness) {
    // calls arc() which calls ellipse()
    this.arc(cx, cy, 0, 360, radius);
  }

  // TODO: check
  cleardevice (bgcolor = this.info.bgcolor) {
    super.cleardevice(bgcolor);
    this.resetSVG(); // TODO: check if this is correct to call
  }

  // Clears the viewport, filling it with the current background color.
  clearviewport (bgcolor = this.info.bgcolor) {
    super.clearviewport(bgcolor);

    if (this.svgView && this.svgActive) {
      const vp = this.info.vp;
      this.svgView.appendChild( this.svgNode('rect', {
        'x': vp.left, 'y': vp.top,
        'width': (vp.right - vp.left + 1),
        'height': (vp.bottom - vp.top + 1),
        'fill': this.pal2hex(this.info.bgcolor)
      }));
    }
  }

  drawbezier (numsegments, cntpoints) {
    super.drawbezier(numsegments, cntpoints);

    if (cntpoints && (cntpoints.length >= 8) && this.svgView && this.svgActive) {
      const [x1, y1, x2, y2, x3, y3, x4, y4] = this.offsetPoints(this.info.vp.left, this.info.vp.top, cntpoints);
      this.svgView.appendChild( this.svgNode('path', {
        // 'd': 'M'+(x1+0.5)+','+(y1+0.5)+' C '+(x2+0.5)+','+(y2+0.5)+' '+(x3+0.5)+','+(y3+0.5) +' '+(x4+0.5)+','+(y4+0.5),
        'd': 'M'+x1+','+y1+' C '+x2+','+y2+' '+x3+','+y3+' '+x4+','+y4,
        'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': this.info.line.thickness, 'stroke-linecap': 'round',
        //'fill': 'transparent', 'style': 'fill:none'
        'fill': 'none', 'fill-rule': 'evenodd'
      }));
    }
  }

  // Draws a closed polygon.
  // polypoints is an array of ints: [x1, y1, x2, y2, ... xn, yn]
  // where n = numpoints.
  drawpoly (numpoints, polypoints, color = this.info.fgcolor) {
    super.drawpoly(numpoints, polypoints, color);

    const dashArray = this.svgGetDashArray(this.info.line.style);
    if (this.svgView && this.svgActive && dashArray.length) {
      polypoints = this.offsetPoints(this.info.vp.left, this.info.vp.top, polypoints);
      this.svgView.appendChild( this.svgNode('polygon', {
        // 'points': polypoints.join(' '),
        'points': polypoints.map(x => x + 0.5).join(' '),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': dashArray.join(','),
        'stroke-linejoin': 'bevel', 'stroke-linecap': 'round',
        'fill': 'none' //, 'fill-rule': 'evenodd' // not necessary?
      }));
    }
  }

  drawpolyline (numpoints, polypoints, color = this.info.fgcolor) {
    super.drawpolyline(numpoints, polypoints, color);

    const dashArray = this.svgGetDashArray(this.info.line.style);
    if (this.svgView && this.svgActive && dashArray.length) {
      // draw only if dash array isn't empty
      polypoints = this.offsetPoints(this.info.vp.left, this.info.vp.top, polypoints);
      // TODO: remove stroke-dasharray if solid? is fill: none default?
      this.svgView.appendChild( this.svgNode('polyline', {
        // 'points': polypoints.join(' '),
        'points': polypoints.map(x => x + 0.5).join(' '),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': dashArray.join(','),
        'stroke-linejoin': 'bevel', 'stroke-linecap': 'round',
        'fill': 'none' //, 'fill-rule': 'evenodd' // not necessary?
      }));
    }
  }

  ellipse (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {
    super.ellipse(cx, cy, stangle, endangle, xradius, yradius, thickness);

    if (this.svgView && this.svgActive) {
      cx += this.info.vp.left;
      cy += this.info.vp.top;
      if (thickness === 1) {
        if (xradius < 1) { xradius = 1; }
        if (yradius < 1) { yradius = 1; }
      }
      if ((stangle === 0) && (endangle === 360)) {
        // draw ellipse
        this.svgView.appendChild( this.svgNode('ellipse', {
          'cx': (cx + 0.5), 'cy': (cy + 0.5), 'rx': xradius, 'ry': yradius,
          'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': thickness, 'fill': 'none'
        }));
      }
      else {
        // draw oval arc
        this.svgView.appendChild( this.svgNode('path', {
          'd': this.svgArcPathD((cx + 0.5), (cy + 0.5), stangle, endangle, xradius, yradius, false),
          'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': thickness,
          'stroke-linecap': 'round', 'fill': 'none'
        }));
      }
    }
  }

  fillellipse (cx, cy, xradius, yradius) {
    super.fillellipse(cx, cy, xradius, yradius);

    if (this.svgView && this.svgActive) {
      cx += this.info.vp.left;
      cy += this.info.vp.top;
      // draw filled ellipse, no outline
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('ellipse', {
        'cx': (cx + 0.5), 'cy': (cy + 0.5), 'rx': xradius, 'ry': yradius,
        // 'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': thickness,
        'fill': fill
      }));
    }
  }

  // only draw fill without the outline, since super.fillpoly() calls drawpoly()
  // TODO: this is no longer the case, so need to draw outline now?
  fillpoly (numpoints, pp) {
    super.fillpoly(numpoints, pp);

    const dashArray = this.svgGetDashArray(this.info.line.style);
    if (this.svgView && this.svgActive) {
      pp = this.offsetPoints(this.info.vp.left, this.info.vp.top, pp);
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      const stroke = ((this.info.fgcolor === this.info.bgcolor) || (dashArray.length === 0)) ? 'transparent' : this.pal2hex(this.info.fgcolor);
      this.svgView.appendChild( this.svgNode('polygon', {
        //'points': pp.join(' '),
        'points': pp.map(x => x + 0.5).join(' '),
        'stroke': stroke, 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': dashArray.join(','),
        'stroke-linejoin': 'bevel', 'stroke-linecap': 'round',
        'fill': fill, 'fill-rule': 'evenodd'
      }));
    }
  }

  floodfill (x0, y0, border) {
    super.floodfill(x0, y0, border);

    // requires 'potrace-modified.js'
    if (this.svgView && this.svgActive && this.fillpixels && (typeof Potrace !== 'undefined')) {
      Potrace.loadFromData(this.fillpixels, this.width, this.height);
      Potrace.process( function() { } );
      let pathTxt = Potrace.getPathD(1);
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('path', {
        // 'stroke': this.pal2hex(fillcolor), 'stroke-width': 0.25,  // TODO: tweak this
        'fill': fill, 'fill-rule': 'evenodd', 'd': pathTxt
      }));
    }
  }

  line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {

    super.line(x1, y1, x2, y2, color, wmode, linestyle, thickness);

    const dashArray = this.svgGetDashArray(linestyle);
    if (this.svgView && this.svgActive && dashArray.length) {
      // draw only if dash array isn't empty
      const vp = this.info.vp;
      x1 += vp.left; x2 += vp.left;
      y1 += vp.top; y2 += vp.top;
      // TODO: remove stroke-dasharray if solid?
      this.svgView.appendChild( this.svgNode('line', {
        'x1': (x1 + 0.5), 'y1': (y1 + 0.5), 'x2': (x2 + 0.5), 'y2': (y2 + 0.5),
        'stroke': this.pal2hex(color), 'stroke-width': thickness,
        'stroke-dasharray': dashArray.join(',')
      }));
    }
  }

  getimage (left, top, right, bottom) {
    //if (this.svgActive) { this.log('svg', 'RIP_GET_IMAGE (1C) not supported in SVGs.'); }
    return super.getimage(left, top, right, bottom);
  }

  // Draws text using current info.cp position, info.text.charsize and info.text.direction.
  // Only outputs SVG text for default 8x8 font (0). Other fonts are drawn using lines.
  outtext (text) {
    const fontnum = this.info.text.font;
    if (this.svgView && this.svgActive && (fontnum === 0)) {
      let scale = this.info.text.charsize;
      if (scale < 1) { scale = 1; }
      let fontSize = 8 * scale;
      let textLength = text.length * fontSize; // pixels wide
      let x0 = this.info.cp.x;
      let y0 = this.info.cp.y + fontSize - scale;
      let color = this.info.fgcolor;
      if (this.info.text.direction === BGI.HORIZ_DIR) {
        // horizontal
        this.svgView.appendChild( this.svgNode('text', {
          'x': x0, 'y': y0,
          'font-family': 'monospace', 'font-size': fontSize + 'px', 'style': 'white-space:pre',
          'lengthAdjust': 'spacingAndGlyphs', 'textLength': textLength,
          'fill': this.pal2hex(color)
        }, text));
      }
      else {
        // vertical
        let x = x0 - scale;
        let y = y0 + textLength - fontSize;
        this.svgView.appendChild( this.svgNode('text', {
          'x': x, 'y': y,
          'font-family': 'monospace', 'font-size': fontSize + 'px', 'style': 'white-space:pre',
          'lengthAdjust': 'spacingAndGlyphs', 'textLength': textLength,
          'transform': `rotate(270,${x},${y})`,
          'fill': this.pal2hex(color)
        }, text));
      }
    }
    // must call at end, as it'll modify info.cp text position.
    super.outtext(text);
  }

  // draws in current line style, thickness, and drawing color
  rectangle (left, top, right, bottom, color = this.info.fgcolor, wmode = this.info.writeMode) {
    super.rectangle(left, top, right, bottom, color, wmode);

    const dashArray = this.svgGetDashArray(this.info.line.style);
    if (this.svgView && this.svgActive && dashArray.length) {
      // draw only if dash array isn't empty
      const vp = this.info.vp;
      left += vp.left; right += vp.left;
      top += vp.top; bottom += vp.top;
      this.svgView.appendChild( this.svgNode('rect', {
        'x': (left + 0.5), 'y': (top + 0.5), 'width': (right - left), 'height': (bottom - top),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': dashArray.join(','),
        'fill': 'none' //, 'fill-rule': 'evenodd' // not necessary?
      }));
    }
  }

  // Draws and fills an elliptical pie slice centered at (x, y).
  sector (cx, cy, stangle, endangle, xradius, yradius) {
    super.sector(cx, cy, stangle, endangle, xradius, yradius);

    if (this.svgView && this.svgActive) {
      // don't draw if start & end angles the same.
      // (single pixel at center drawn in BGI)
      if (stangle === endangle) { return }

      // swap if start > end (unlike elliptical arcs!)
      if (stangle > endangle) { let t = stangle; stangle = endangle; endangle = t; }

      // handles case where start & end angles are 360 deg apart.
      // SVG normally won't display the whole pie, so we tweak it a little.
      if (endangle === (stangle + 360)) { endangle--; }

      // draw filled elliptical pie slice with outline
      cx += this.info.vp.left;
      cy += this.info.vp.top;
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('path', {
        'd': this.svgArcPathD((cx + 0.5), (cy + 0.5), stangle, endangle, xradius, yradius, true),
        'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': this.info.line.thickness, 
        'stroke-linejoin': 'bevel', 'fill': fill
      }));
    }
  }

  // fpattern is an array of 8 ints (0-255), each byte is 8 pixels in the pattern.
  setfillpattern (fpattern, color) {
    super.setfillpattern(fpattern, color);
    if (this.svgView && this.svgActive && fpattern && (fpattern.length === 8)) {
      this.svgAppendFillPattern(fpattern, color);
    }
  }

  setfillstyle (style, color) {
    super.setfillstyle(style, color);
    if (this.svgView && this.svgActive && (style != 1)) {
      this.svgAppendFillPattern(this.info.fill.fpattern, color);
    }
  }

  svgGetDashArray (linestyle, upattern = this.info.line.upattern) {
    // array represents [dash, gap, dash, gap, ...]
    // empty array for no line.
    let dashArray = [1,0];
    switch (linestyle) {
      case 0: dashArray = [1,0]; break;     // SOLID_LINE
      case 1: dashArray = [2,2]; break;     // DOTTED_LINE
      case 2: dashArray = [4,3,6,3]; break; // CENTER_LINE
      case 3: dashArray = [5,3,5,3]; break; // DASHED_LINE
      case 4: dashArray = this.svgMakeDashArray(upattern); // USERBIT_LINE
    }
    return dashArray;
  }

  setlinestyle (linestyle, upattern = 0xFFFF, thickness = 1) {
    super.setlinestyle(linestyle, upattern, thickness);
    this.svgDashArray = this.svgGetDashArray(linestyle, upattern);
    //this.log('svg', `upattern: ${upattern.toString(16).padStart(4, '0')}, stroke-dasharray: ${this.svgDashArray}`); // DEBUG
  }

  // Sets the current viewport for graphics output.
  setviewport (x1, y1, x2, y2, clip) {
    super.setviewport(x1, y1, x2, y2, clip);
    this.svgSetViewport({ left: x1, top: y1, right: x2, bottom: y2 });
  }


  ////////////////////////////////////////////////////////////////////////////////
}
