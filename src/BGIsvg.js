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
  //   svg: SVGElement()
  //   ctx: CanvasRenderingContext2D() - required
  //   width: int - optional if ctx derived from a <canvas>
  //   height: int - optional if ctx derived from a <canvas>

  constructor (args) {
    console.log('inside BGIsvg constructor'); // DEBUG

    // init SVG
    if (args && (typeof BGI !== 'undefined') && ('svg' in args)) {
      super(args);

      // public vars
      this.svgPrefix = ('svgPrefix' in args) ? args.svgPrefix : 'rip';
      this.svgViewCount = 0;
      this.svgFillCount = 0;
      this.svgFillId = this.svgPrefix + '-fill0';
      this.svgDashArray = [];

      if (args.svg instanceof SVGElement) {
        this.svg = args.svg;
        this.resetSVG();
      }
      else {
        console.error('svg passed in to BGIsvg needs to be an SVGElement!');
      }
    }
    else {
      console.error('BGIsvg() could not be initialized!');
    }

    if (typeof Potrace !== 'undefined') {
      // turnpolicy ("black" / "white" / "left" / "right" / "minority" / "majority")
      Potrace.setParameter({ turdsize: 0, turnpolicy: "minority" });
    }
    else {
      console.error('Potrace() missing! Need to load potrace-modified.js before BGIsvg.js!');
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

  svgNode (elem, dict) {
    elem = document.createElementNS("http://www.w3.org/2000/svg", elem);
    for (var k in dict) {
      if ((dict[k] != null) && (dict[k] != "")) {
        elem.setAttributeNS(null, k, dict[k]);
      }
    }
    return elem
  }

  svgSetViewport (vp) {
    // vp is an object: {left:, top:, right:, bottom:}
    // uses this.svg, this.svgView, this.svgViewCount

    if (this.svg && vp) {
      let id = this.svgPrefix + '-vp' + this.svgViewCount;
      let defs = this.svgNode('defs', {});
      let clipPath = this.svgNode('clipPath', { 'id': id });
      let rect = this.svgNode('rect', {
        'x': vp.left, 'y': vp.top, 'width': (vp.right - vp.left + 1), 'height': (vp.bottom - vp.top + 1)
      });
      clipPath.appendChild(rect);
      defs.appendChild(clipPath);
      this.svg.appendChild(defs);
      this.svgView = this.svgNode('g', { 'clipPath': `url(#${id})` });
      this.svg.appendChild(this.svgView);
      this.svgViewCount++;
    }
  }

  resetSVG () {
    if (this.svg) {
      this.svg.innerHTML = '';
      this.svgSetViewport(this.info.vp);
      this.svgViewCount = 0;
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

    if (this.svgView) {
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
    let x0 = (xc + (xrad * Math.cos(sa * twoPiD))).toFixed(1);
    let y0 = (yc - (yrad * Math.sin(sa * twoPiD))).toFixed(1);
    let x1 = (xc + (xrad * Math.cos(ea * twoPiD))).toFixed(1);
    let y1 = (yc - (yrad * Math.sin(ea * twoPiD))).toFixed(1);
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

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('circle', {
        'cx': (x + 0.5), 'cy': (y + 0.5), 'r': 0.5, 'fill': this.pal2hex(color)
      }));
    }
  }

  /*
  arc (cx, cy, stangle, endangle, radius, thickness = this.info.line.thickness) {
    super.arc(cx, cy, stangle, endangle, radius, thickness);
    // calls ellipse()
  }
  */

  // Draws and fills a rectangle, using fill style and color. Has no border. (see fillrect)
  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {
    super.bar(left, top, right, bottom, color, wmode);

    // swap
    if (left > right) { let tmp = left; left = right; right = tmp; }
    if (top > bottom) { let tmp = top; top = bottom; bottom = tmp; }

    if (this.svgView) {
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('rect', {
        'x': left, 'y': top, 'width': (right - left + 1), 'height': (bottom - top + 1), 'fill': fill
      }));
    }
  }

  /*
  // TODO: already calls arc() (may need to fix)
  circle (cx, cy, radius, thickness = this.info.line.thickness) {
    super.circle(cx, cy, radius, thickness);
    // calls arc() which calls ellipse()
  }
  */

  // TODO: check
  cleardevice (bgcolor = this.info.bgcolor) {
    super.cleardevice(bgcolor);
    this.resetSVG(); // TODO: check if this is correct to call
  }

  // Clears the viewport, filling it with the current background color.
  clearviewport (bgcolor = this.info.bgcolor) {
    super.clearviewport(bgcolor);

    if (this.svgView) {
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

    if (cntpoints && (cntpoints.length >= 8) && this.svgView) {
      const [x1, y1, x2, y2, x3, y3, x4, y4] = cntpoints;
      this.svgView.appendChild( this.svgNode('path', {
        'd': 'M'+(x1+0.5)+','+(y1+0.5)+' C '+(x2+0.5)+','+(y2+0.5)+' '+(x3+0.5)+','+(y3+0.5) +' '+(x4+0.5)+','+(y4+0.5),
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

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('polygon', {
        //"points": polypoints.map(x => [x[0] + 0.5, x[1] + 0.5]).join(' '), // REMOVE
        'points': polypoints.join(' '),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': this.svgDashArray.join(','),
        'fill': 'none', 'fill-rule': 'evenodd'
      }));
    }
  }

  drawpolyline (numpoints, polypoints, color = this.info.fgcolor) {
    super.drawpolyline(numpoints, polypoints, color);

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('polyline', {
        // "points":poly.map(x => [x[0] + svgOff, x[1] + svgOff]).join(' '), // REMOVE
        'points': polypoints.join(' '),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': this.svgDashArray.join(','),
        'fill': 'none', 'fill-rule': 'evenodd'
      }));
    }
  }

  ellipse (cx, cy, stangle, endangle, xradius, yradius, thickness = this.info.line.thickness) {
    super.ellipse(cx, cy, stangle, endangle, xradius, yradius, thickness);

    if (this.svgView) {
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
          'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': thickness, 'fill': 'none'
        }));
      }
    }
  }

  // TODO: implement fill pattern
  fillellipse (cx, cy, xradius, yradius) {
    super.fillellipse(cx, cy, xradius, yradius);

    if (this.svgView) {
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
  fillpoly (numpoints, pp) {
    super.fillpoly(numpoints, pp);

    if (this.svgView) {
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('polygon', {
        //"points": polypoints.map(x => [x[0] + 0.5, x[1] + 0.5]).join(' '), // REMOVE
        'points': pp.join(' '),
        // 'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': this.info.line.thickness,
        // 'stroke-dasharray': this.svgDashArray.join(','),
        'fill': fill, 'fill-rule': 'evenodd'
      }));
    }
  }

  floodfill (x0, y0, border) {
    super.floodfill(x0, y0, border);

    // requires 'potrace-modified.js'
    if (this.svgView && this.fillpixels && (typeof Potrace !== 'undefined')) {
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

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('line', {
        'x1': (x1 + 0.5), 'y1': (y1 + 0.5), 'x2': (x2 + 0.5), 'y2': (y2 + 0.5),
        'stroke': this.pal2hex(color), 'stroke-width': thickness,
        'stroke-dasharray': this.svgDashArray.join(',')
      }));
    }
  }

  // draws in current line style, thickness, and drawing color
  rectangle (left, top, right, bottom, color = this.info.fgcolor, wmode = this.info.writeMode) {
    super.rectangle(left, top, right, bottom, color, wmode);

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('rect', {
        'x': (left + 0.5), 'y': (top + 0.5), 'width': (right - left), 'height': (bottom - top),
        'stroke': this.pal2hex(color), 'stroke-width': this.info.line.thickness,
        'stroke-dasharray': this.svgDashArray.join(','),
        'fill': 'none', 'fill-rule': 'evenodd'
      }));
    }
  }

  // TODO: some pies render full circle incorrectly
  // Draws and fills an elliptical pie slice centered at (x, y).
  sector (cx, cy, stangle, endangle, xradius, yradius) {
    super.sector(cx, cy, stangle, endangle, xradius, yradius);

    if (this.svgView) {
      // draw filled elliptical pie slice with outline
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : this.info.fill.color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(fillcolor) : `url(#${this.svgFillId})`;
      this.svgView.appendChild( this.svgNode('path', {
        'd': this.svgArcPathD((cx + 0.5), (cy + 0.5), stangle, endangle, xradius, yradius, true),
        'stroke': this.pal2hex(this.info.fgcolor), 'stroke-width': this.info.line.thickness, 'fill': fill
      }));
    }
  }

  // fpattern is an array of 8 ints (0-255), each byte is 8 pixels in the pattern.
  setfillpattern (fpattern, color) {
    super.setfillpattern(fpattern, color);
    if (this.svgView && fpattern && (fpattern.length === 8)) {
      this.svgAppendFillPattern(fpattern, color);
    }
  }

  setfillstyle (style, color) {
    super.setfillstyle(style, color);
    if (this.svgView && (style != 1)) {
      this.svgAppendFillPattern(this.info.fill.fpattern, color);
    }
  }

  setlinestyle (linestyle, upattern = 0xFFFF, thickness = 1) {
    super.setlinestyle (linestyle, upattern, thickness);

    switch (linestyle) {
      case 0: this.svgDashArray = []; break;
      case 1: this.svgDashArray = [2,2]; break;
      case 2: this.svgDashArray = [4,3,6,3]; break;
      case 3: this.svgDashArray = [5,3,5,3]; break;
      case 4: this.svgDashArray = this.svgMakeDashArray(upattern);
    }
  }


  ////////////////////////////////////////////////////////////////////////////////
}
