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

      this.svgPrefix = ('svgPrefix' in args) ? args.svgPrefix : 'rip';
      this.svgViewCount = 0;
      this.svgFillCount = 0;
      this.svgFillId = this.svgPrefix + '-fill0';

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

  // colr is index color 0-15, returns hex color as '#rrggbb'
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
      let id = this.svgPrefix + "-vp" + this.svgViewCount;
      let defs = this.svgNode('defs', {});
      let clipPath = this.svgNode('clipPath', { "id": id });
      let rect = this.svgNode('rect', {
        "x": vp.left, "y": vp.top, "width": (vp.right - vp.left + 1), "height": (vp.bottom - vp.top + 1)
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
      this.svg.innerHTML = "";
      this.svgSetViewport(this.info.vp);
      this.svgViewCount = 0;
      // fill viewport with background color
      this.svgView.appendChild( this.svgNode('rect', {
        "x": 0, "y": 0, "width": this.width, "height": this.height, "fill": this.pal2hex(0)
      }));
    }
  }

  svgMakeFillPattern (fillPattern) {

    let d = "", bit;
    for (let y=0; y < 8; y++) {
      for (let x=0; x < 8; x++) {
        bit = (fillPattern[y] >> (7 - x)) & 1;
        if (bit) {
          d += ' M'+x+' '+y+' h1 v1 h-1 Z';
        }
      }
    }
    return d;
  }

  svgAppendFillPattern (fillPattern, color) {

    if (this.svgView) {
      this.svgFillId = this.svgPrefix + "-fill" + this.svgFillCount;
      this.svgFillCount++;
      let pathTxt = this.svgMakeFillPattern(fillPattern);
      let defs = this.svgNode('defs', {});
      let pattern = this.svgNode('pattern', {
        'id': this.svgFillId, 'width': 8, 'height': 8, 'patternUnits': 'userSpaceOnUse'
      });
      // fill with background color
      pattern.appendChild( this.svgNode('path', { "d": "M0 0 H8 V8 H0 Z", "fill": this.pal2hex(0) }));
      // fill pattern
      pattern.appendChild( this.svgNode('path', { "d": pathTxt, "fill": this.pal2hex(color) }));
      defs.appendChild(pattern);
      this.svgView.appendChild(defs);
    }
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Standard BGI functions

  putpixel (x, y, color = this.info.fgcolor, wmode = this.info.writeMode) {

    super.putpixel(x, y, color, wmode);

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('circle', {
        "cx": (x + 0.5), "cy": (y + 0.5), "r": 0.5, "fill": this.pal2hex(color)
      }));
    }
  }

  line (x1, y1, x2, y2, color = this.info.fgcolor, wmode = this.info.writeMode,
        linestyle = this.info.line.style, thickness = this.info.line.thickness) {

    super.line(x1, y1, x2, y2, color, wmode, linestyle, thickness);

    if (this.svgView) {
      this.svgView.appendChild( this.svgNode('line', {
        "x1": (x1 + 0.5), "y1": (y1 + 0.5), "x2": (x2 + 0.5), "y2": (y2 + 0.5),
        "stroke": this.pal2hex(color), "stroke-width": thickness,
        // "stroke-dasharray":glob.svgDashArray.join(',')
      }));
    }
  }

  bar (left, top, right, bottom, color = this.info.fill.color, wmode = this.info.writeMode) {

    super.bar(left, top, right, bottom, color, wmode);

    if (this.svgView) {
      const fillcolor = (this.info.fill.style === BGI.EMPTY_FILL) ? this.info.bgcolor : color;
      const fill = (this.info.fill.style === BGI.SOLID_FILL) ? this.pal2hex(color) : "url(#" + this.svgFillId + ")";
      this.svgView.appendChild( this.svgNode('rect', {
        "x": left, "y": top, "width": (right - left + 1), "height": (bottom - top + 1), "fill": fill
        //"stroke":pal2hex(glob.fillColor), "stroke-width":1,   // TODO: test this ??
      }));
    }
  }

  cleardevice (bgcolor = this.info.bgcolor) {
    super.cleardevice(bgcolor);
    this.resetSVG(); // TODO: check if this is correct to call
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


  ////////////////////////////////////////////////////////////////////////////////
}
