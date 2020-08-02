/**
 * ripterm.js
 * Copyright (c) 2018 Carl Gorringe 
 * http://carl.gorringe.org
 * v1: 1/9/2011
 * v2: 12/22/2017 - 2/2018
 *
 * Renders RIPscrip v1.54 .RIP files in an HTML canvas or SVG.
 * (work in progress)
 **/

function RIPtermJS (self) {
	'use strict';

	// DIV ids that may be set:
	//   self.canvasId  - main canvas
	//   self.ripTextId - show list of rip commands in div
	//   self.counterId - show command counter in div (e.g. '5 / 100')
	//   self.svgId     - draw to an SVG tag (experimental)

	// public properties
	if (typeof self === 'undefined') self = {};
	if (!('timeInterval' in self)) self.timeInterval = 1;
	if (!('floodFill'    in self)) self.floodFill = true;
	if (!('svgPrefix'    in self)) self.svgPrefix = "rip";  // used in internal SVG id's

	// debug properties
	if (!('debugVerbose' in self)) self.debugVerbose = false;
	if (!('pauseOn'      in self)) self.pauseOn = [];
	if (!('debugFillBuf' in self)) self.debugFillBuf = false;  // display flood-fill buffer
	if (!('svgIncludePut'in self)) self.svgIncludePut = false; // add '1P' RIP_PUT_IMAGE to SVG (experimental)

	// not yet used
	if (!('iconsPath'    in self)) self.iconsPath = 'icons';
	if (!('fontsPath'    in self)) self.fontsPath = 'fonts';
	if (!('fontsFiles'   in self)) {
		self.fontsFiles = ['8x8.png', 'TRIP.CHR', 'LITT.CHR', 'SANS.CHR', 'GOTH.CHR', 
			'SCRI.CHR', 'SIMP.CHR', 'TSCR.CHR', 'LCOM.CHR', 'EURO.CHR', 'BOLD.CHR'];
	}

	// private vars
	var canvas, bgColor, ctx, cImg, cBuf, tBuf, timer, fullmode = false, bu = {};
	var ripTextDiv, counterDiv, ripData = [], cmdi = 0;
	var cWidth, cHeight;
	var cColorMask = 0xF;  // 0xF = 16-color mode, 0xFF = 256-color mode
	var palR = new Uint8ClampedArray(256);
	var palG = new Uint8ClampedArray(256);
	var palB = new Uint8ClampedArray(256);
	var glob, svg, svgView;

	const paletteEGA16 = [
		'#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#a50', '#aaa',
		'#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'
	];
	const paletteEGA64 = [
		'#000', '#00a', '#0a0', '#0aa', '#a00', '#a0a', '#aa0', '#aaa',
		'#005', '#00f', '#0a5', '#0af', '#a05', '#a0f', '#aa5', '#aaf',
		'#050', '#05a', '#0f0', '#0fa', '#a50', '#a5a', '#af0', '#afa',
		'#055', '#05f', '#0f5', '#0ff', '#a55', '#a5f', '#af5', '#aff',
		'#500', '#50a', '#5a0', '#5aa', '#f00', '#f0a', '#fa0', '#faa',
		'#505', '#50f', '#5a5', '#5af', '#f05', '#f0f', '#fa5', '#faf',
		'#550', '#55a', '#5f0', '#5fa', '#f50', '#f5a', '#ff0', '#ffa',
		'#555', '#55f', '#5f5', '#5ff', '#f55', '#f5f', '#ff5', '#fff'
	];
	const fillPatterns = [
		[0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], // 00
		[0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF], // 01
		[0xFF, 0xFF, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00], // 02
		[0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80], // 03
		[0xE0, 0xC1, 0x83, 0x07, 0x0E, 0x1C, 0x38, 0x70], // 04
		[0xF0, 0x78, 0x3C, 0x1E, 0x0F, 0x87, 0xC3, 0xE1], // 05
		[0xA5, 0xD2, 0x69, 0xB4, 0x5A, 0x2D, 0x96, 0x4B], // 06
		[0xFF, 0x88, 0x88, 0x88, 0xFF, 0x88, 0x88, 0x88], // 07
		[0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81], // 08
		[0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33, 0xCC, 0x33], // 09
		[0x80, 0x00, 0x08, 0x00, 0x80, 0x00, 0x08, 0x00], // 0A
		[0x88, 0x00, 0x22, 0x00, 0x88, 0x00, 0x22, 0x00]  // 0B
	];

// ----------------------------------------------------------------------------------------------------
// private methods

	function resetGlob() {
		glob = {
			drawColor: 15,
			fillColor: 0,
			writeMode: 0,  // 0=Normal, 1=XOR
			move: {x:0, y:0},
			fontStyle: 0,  // 0-10
			fontDir: 0,    // 0=horizontal, 1=vertical
			fontSize: 1,   // 1-10
			lineThick: 1,  // 1 or 3
			linePattern: 0xFFFF,
			svgDashArray: [],
			clipboard: null,
			viewport: {x0:0, y0:0, x1:639, y1:349},
			fillStyle: 1,
			fillPattern: fillPatterns[1],
			svgFillId: "",
			svgFillCount: 0,
			svgPutCount: 0,
			svgViewCount: 0
		};
		/*
			textWindow (x0 y0 x1 y1 wrap size)
				text font size = {0:8x8, 1:7x8, 2:8x14, 3:7x14, 4:16x14}
		*/
	}

	function resetSVG() {
		if (svg) {
			svg.innerHTML = "";
			svgSetViewport(glob.viewport);
			glob.svgViewCount = 0;
			// fill viewport with background color
			svgView.appendChild(svgNode('rect', {
				"x":0, "y":0, "width":(glob.viewport.x1+1), "height":(glob.viewport.y1+1), "fill":pal2hex(0)
			}));
		}
	}

	// hex is '#rgb' or '#rrggbb', returns [R, G, B] where values are 0-255
	function hex2rgb(hex) {
		return (hex.length == 4) ?
			['0x' + hex[1] + hex[1] | 0, '0x' + hex[2] + hex[2] | 0, '0x' + hex[3] + hex[3] | 0]:
			['0x' + hex[1] + hex[2] | 0, '0x' + hex[3] + hex[4] | 0, '0x' + hex[5] + hex[6] | 0];
	}

	// colr is index color 0-15, returns hex color as '#rrggbb'
	function pal2hex(colr) {
		return '#' +
			Number(palR[colr]).toString(16).padStart(2, '0') +
			Number(palG[colr]).toString(16).padStart(2, '0') +
			Number(palB[colr]).toString(16).padStart(2, '0');
	}

	function svgNode(elem, dict) {
		elem = document.createElementNS("http://www.w3.org/2000/svg", elem);
		for (var k in dict) {
			if ((dict[k] != null) && (dict[k] != "")) {
				elem.setAttributeNS(null, k, dict[k]);
			}
		}
		return elem
	}

	// set palR[i], palG[i] & palB[i] to color given '#rgb' or '#rrggbb'
	function setPalWithHex(i, hex) {
		var rgb = hex2rgb(hex);
		palR[i] = rgb[0];
		palG[i] = rgb[1];
		palB[i] = rgb[2];
	}

	function resetPalette() {
		for (var i=0; i < paletteEGA16.length; i++) {
				setPalWithHex(i, paletteEGA16[i]);
		}
		setPalWithHex(255, '#fff');  // used to debug fill temp buffer (tBuf)
	}

	// Extracts command code + args from RIP instruction.
	// TODO: not coded to work with ESC character commands
	function parseRIPcmd(inst) {
		var patt = /^[0-9]*./;
		var args = inst;
		var cmd = patt.exec(inst)[0];
		if (cmd) { args = inst.substr(cmd.length); } // grab everything after cmd string
		return [cmd, args];
	}

	function parseRIPint(args, pos) {
		return parseInt(args.substr(pos,2), 36);
	}

	// Unescape these: "\!" "\|" "\\"
	// (somewhat hackish, may fail)
	function unescapeRIPtext(text) {
		text = text.replace(/\\\!/g,'!');
		text = text.replace(/\\\\/g,'\\');
		//text = text.replace(/\\|/g,':');
		return text;
	}

	// NOT DONE (TODO: need to update)
	self.readFile = function(filename) {
		console.log('READ_FILE: ' + filename);

		cmdi = 0;
		var req = new XMLHttpRequest();
		if (req != null) { 
			if (ripTextDiv) { ripTextDiv.innerHTML = ''; }
			if (counterDiv) { counterDiv.innerHTML = ''; }

			req.open("GET", filename, false);
			req.overrideMimeType('text/plain; charset=x-user-defined');  // allows ASCII control chars in input
			req.send(null);
			if (req.status != 200) { console.log('Error downloading file: ' + filename); return; }
			var text = req.responseText;

			// output to ripTextDiv
			var outText = '';
			var c=1;
			ripData = [];

			// process one line at a time
			var lines = text.split("\n");
			for (var i=0; i < lines.length; i++) {
				var aLine = lines[i];
				while (aLine.match( /(.*)\\$/m )) {  // works?
					aLine = RegExp.$1 + lines[i+1];  // works?
					i++;
				}
				if (aLine.charAt(0) == '!') {
					var cmds = aLine.substr(2).split('|');
					for (var j=0; j < cmds.length; j++) {
						var d = parseRIPcmd(cmds[j]);
						
						if (self.pauseOn.includes(d[0])) {
							// RIP command paused
							outText += '<span class="cmd-paused" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
						}
						else if (self.cmd[d[0]]) {
							// RIP command supported
							outText += '<span class="cmd-ok" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
						}
						else {
							// RIP command NOT supported
							outText += '<span class="cmd-not" title="'+ c +'">'+ d[0] + '</span>' + d[1] + '<br>';
						}
						ripData.push(d);  // store command + args in array
						c++;
					}
				} // else skip line
			}
			if (ripTextDiv) {
				ripTextDiv.innerHTML = outText;
			}
		}
		self.reset();
	}

// ----------------------------------------------------------------------------------------------------
// graphics drawing primitives

	// Converts indexed to 24-bit image using palette, then updates canvas
	function updateCanvas(buf) {
		if (!buf) { buf = cBuf; }
		var b, j=0, numpix = buf.length;
		for (var i=0; i < numpix; ++i) {
			b = buf[i];
			cImg.data[j++] = palR[b];
			cImg.data[j++] = palG[b];
			cImg.data[j++] = palB[b];
			cImg.data[j++] = 255;
		}
		ctx.putImageData(cImg, 0, 0);
	}

	function getImageClip(x0, y0, x1, y1) {
		// uses cBuf[], cWidth
		// TODO: viewport? (undefined if outside viewport)
		var w = (x1 - x0 + 1);
		var h = (y1 - y0 + 1);
		var img = new Uint8ClampedArray(w * h);
		var i, o=0;
		for (var y=y0; y <= y1; ++y) {
			i = y * cWidth + x0;
			for (var x=x0; x <= x1; ++x) {
				img[o++] = cBuf[i++];
			}
		}
		return {x:x0, y:y0, w:w, h:h, img:img};
	}

	function putImageClip(x0, y0, imgClip, mode) {
		// uses cBuf[], cWidth, cHeight, cColorMask, glob.viewport
		// mode is {0=copy, 1=XOR, 2=OR, 3=AND, 4=NOT}
		// TODO: viewport
		var img = imgClip.img;
		var x1 = x0 + imgClip.w - 1;
		var y1 = y0 + imgClip.h - 1;
		var i=0, o=0;

		// exit if outside canvas bounds
		if ((x1 >= cWidth) || (y1 >= cHeight)) { return false; }

		switch (mode) {
			case 0: // copy
				for (var y=y0; y <= y1; ++y) {
					o = y * cWidth + x0;
					for (var x=x0; x <= x1; ++x) {
						cBuf[o++] = img[i++];
					}
				}
				break;
			case 1: // XOR
				for (var y=y0; y <= y1; ++y) {
					o = y * cWidth + x0;
					for (var x=x0; x <= x1; ++x) {
						cBuf[o++] ^= img[i++];
					}
				}
				break;
			case 2: // OR
				for (var y=y0; y <= y1; ++y) {
					o = y * cWidth + x0;
					for (var x=x0; x <= x1; ++x) {
						cBuf[o++] |= img[i++];
					}
				}
				break;
			case 3: // AND
				for (var y=y0; y <= y1; ++y) {
					o = y * cWidth + x0;
					for (var x=x0; x <= x1; ++x) {
						cBuf[o++] &= img[i++];
					}
				}
				break;
			case 4: // NOT
				for (var y=y0; y <= y1; ++y) {
					o = y * cWidth + x0;
					for (var x=x0; x <= x1; ++x) {
						cBuf[o++] = ~img[i++] & cColorMask;
					}
				}
		}
		return true;
	}

	function getPixel(x, y, buf) {
		return (buf) ? buf[(y * cWidth) + x] : cBuf[(y * cWidth) + x]; 
	}

	function setPixelBuf(x, y, colr, writeMode, buf) {
		// uses cBuf[], cWidth, glob.viewport
		if (!buf) { buf = cBuf; }
		if ((x >= glob.viewport.x0) && (x <= glob.viewport.x1) && (y >= glob.viewport.y0) && (y <= glob.viewport.y1)) {
			if (writeMode) {
				buf[ (y * cWidth) + x ] ^= colr;  // 1=XOR
			}
			else {
				// default if writeMode missing
				buf[ (y * cWidth) + x ] = colr;  // 0=Copy
			}
		}
	}

	function setPixelPattern(x, y, colr, writeMode, fillPattern) {
		// uses cBuf[], cWidth, glob.viewport
		if ((x >= glob.viewport.x0) && (x <= glob.viewport.x1) && (y >= glob.viewport.y0) && (y <= glob.viewport.y1)) {
			var bit = (fillPattern[y % 8] >> (7 - (x % 8))) & 1;
			//var bit = 1;
			if (writeMode) {
				cBuf[ (y * cWidth) + x ] ^= (bit) ? colr : 0;  // 1=XOR
			}
			else {
				cBuf[ (y * cWidth) + x ] = (bit == 1) ? colr : 0;  // 0=Copy
			}
		}
	}

	function drawLine(x1, y1, x2, y2, colr, writeMode, lineThick, linePattern, buf) {
		// uses glob.viewport
		// linePattern implemented but not tested
		if (!buf) { buf = cBuf; }
		if (typeof writeMode   === 'undefined') { writeMode = 0; }
		if (typeof lineThick   === 'undefined') { lineThick = 1; }
		if (typeof linePattern === 'undefined') { linePattern = 0xFFFF; }

		// Bresenham's line algorithm
		var xinc1, xinc2, yinc1, yinc2, den, num, numadd, numpixels;
		var deltax = Math.abs(x2 - x1);
		var deltay = Math.abs(y2 - y1);
		var x = x1; 
		var y = y1;
		var isThick = (lineThick == 3) ? 1 : 0;
		var xThick = 0;
		var yThick = 0;
		var pat = linePattern;

		if (x2 >= x1) { xinc1 =  1; xinc2 =  1; }
		else          { xinc1 = -1; xinc2 = -1; }

		if (y2 >= y1) { yinc1 =  1; yinc2 =  1; }
		else          { yinc1 = -1; yinc2 = -1; }

		if (deltax >= deltay) {
			xinc1 = 0;
			yinc2 = 0;
			den = deltax;
			num = deltax >> 1;
			numadd = deltay;
			numpixels = deltax;
			yThick = 1;
		}
		else {
			xinc2 = 0;
			yinc1 = 0;
			den = deltay;
			num = deltay >> 1;
			numadd = deltax;
			numpixels = deltay;
			xThick = 1;
		}

		for (var c=0; c <= numpixels; c++) {

			// line pattern
			if (c % 16 == 0) { pat = linePattern; }
			if (pat & 0x8000) {
				// only draw pixel if current pattern bit is 1
				setPixelBuf(x, y, colr, writeMode, buf);
				if (isThick) {
					// thickness is 3
					setPixelBuf(x - xThick, y - yThick, colr, writeMode, buf);
					setPixelBuf(x + xThick, y + yThick, colr, writeMode, buf);
				}
			}
			pat = (pat << 1) & 0xFFFF;

			// increment pixel
			num += numadd;
			if (num >= den) {
				num -= den;
				x += xinc1;
				y += yinc1;
			}
			x += xinc2;
			y += yinc2;
		}
	}

	function drawRectangle(x0, y0, x1, y1, colr, writeMode, lineThick, linePattern) {
		drawLine(x0, y0, x0, y1, colr, writeMode, lineThick, linePattern);
		drawLine(x0, y0, x1, y0, colr, writeMode, lineThick, linePattern);
		drawLine(x0, y1, x1, y1, colr, writeMode, lineThick, linePattern);
		drawLine(x1, y0, x1, y1, colr, writeMode, lineThick, linePattern);
	}

	function drawBar(x0, y0, x1, y1, colr, writeMode, fillPattern) {
		if (typeof writeMode   === 'undefined') { writeMode = 0; }
		if (typeof fillPattern === 'undefined') { fillPattern = fillPatterns[1]; }
		var px0 = Math.min(x0, x1);
		var px1 = Math.max(x0, x1);
		var py0 = Math.min(y0, y1);
		var py1 = Math.max(y0, y1);
		for (var y = py0; y <= py1; y++) {
			for (var x = px0; x <= px1; x++) {
				setPixelPattern(x, y, colr, writeMode, fillPattern);
			}
		}
	}

	function drawBezier(x1, y1, x2, y2, x3, y3, x4, y4, count, colr, writeMode, lineThick, linePattern) {
		// uses glob.viewport
		if (typeof writeMode   === 'undefined') { writeMode = 0; }
		if (typeof lineThick   === 'undefined') { lineThick = 1; }
		if (typeof linePattern === 'undefined') { linePattern = 0xFFFF; }

		// Cubic Bezier formula:
		// p = (1-t)^3 *P0 + 3*t*(1-t)^2*P1 + 3*t^2*(1-t)*P2 + t^3*P3 
		// where t is 0 to 1

		if (count < 1) { return; }
		var step = 1 / count;
		var xp = x1, yp = y1, xn, yn;
		for (var t=step; t < 1; t += step) {
			// TODO: make more efficient?
			// floor() is correct, not round()
			var t1 = 1-t;
			xn = Math.floor( t1*t1*t1 * x1 + 3 * t * t1*t1 * x2 + 3 * t*t * t1 * x3 + t*t*t * x4 );
			yn = Math.floor( t1*t1*t1 * y1 + 3 * t * t1*t1 * y2 + 3 * t*t * t1 * y3 + t*t*t * y4 );
			drawLine(xp, yp, xn, yn, colr, writeMode, lineThick, linePattern);
			xp = xn;
			yp = yn;
		}
		drawLine(xp, yp, x4, y4, colr, writeMode, lineThick, linePattern);
	}

	function drawFloodFill(x0, y0, border, colr, fillPattern) {
		// uses glob.viewport
		// TODO: make more efficient:
		// [ ] convert to horizontal scan lines, write/read buffer array directly

		tBuf.fill(0);
		if (getPixel(x0, y0) == border) { return; }
		var stack = [{x:x0, y:y0}];
		var popped, count = 0;

		while (popped = stack.pop()) {
			var x = popped.x;   
			var y = popped.y;
			//if (self.debugVerbose) console.log('   popped: x='+x+', y='+y);

			// find top of line (y1)
			var y1 = y;
			while ((y1 >= glob.viewport.y0) && (getPixel(x, y1) != border)) {
				y1--;
			}
			y1++;
			// find bottom of line (y2)
			var y2 = y + 1;
			while ((y2 <= glob.viewport.y1) && (getPixel(x, y2) != border)) {
				y2++;
			}
			y2--;

			var spanLeft = false;
			var spanRight = false;
			for (y = y1; y <= y2; y++) {
				//setPixelBuf(x, y, colr, 0, cBuf);
				setPixelPattern(x, y, colr, 0, fillPattern);
				setPixelBuf(x, y, 0xFF, 0, tBuf);
				count++;

				if (!spanLeft && (x > glob.viewport.x0) && (getPixel(x-1, y) != border) && (getPixel(x-1, y, tBuf) != 0xFF)) {
					stack.push({x:x-1, y:y});
					spanLeft = true;
				}
				else if (spanLeft && (x > glob.viewport.x0) && (getPixel(x-1, y) == border)) {
					spanLeft = false;
				}

				if (!spanRight && (x < glob.viewport.x1) && (getPixel(x+1, y) != border) && (getPixel(x+1, y, tBuf) != 0xFF)) {
					stack.push({x:x+1, y:y});
					spanRight = true;
				}
				else if (spanRight && (x < glob.viewport.x1) && (getPixel(x+1, y) == border)) {
					spanRight = false;
				}
			}
		}
	}

	function drawPolyline(poly, colr, writeMode, lineThick, linePattern) {

		var xp = poly[0][0];
		var yp = poly[0][1];
		var xn, yn;
		for (var i=1; i < poly.length; i++) {
			xn = poly[i][0];
			yn = poly[i][1];
			drawLine(xp, yp, xn, yn, colr, writeMode, lineThick, linePattern);
			xp = xn; yp = yn;
		}
	}

	function drawPolygon(poly, colr, writeMode, lineThick, linePattern) {

		if (poly.length > 1) {
			drawPolyline(poly, colr, writeMode, lineThick, linePattern);
			// draw closing line
			var x = poly[poly.length - 1][0];
			var y = poly[poly.length - 1][1];
			drawLine(x, y, poly[0][0], poly[0][1], colr, writeMode, lineThick, linePattern);
		}
	}

	function drawFilledPolygon(poly, colr, fillPattern) {
		// uses: glob.viewport
		// poly is an array of [x,y] array tuples
		// code based on: http://alienryderflex.com/polygon_fill/

		if (self.debugVerbose) {
			console.log("length poly:", poly.length, "colr:", colr); // TEST
		}

		var numpoly = poly.length;
		var i, j, x, y, xnode;

		// scan thru all rows in viewport
		for (y = glob.viewport.y0; y <= glob.viewport.y1; y++) {
			xnode = [];

			// build node list
			j = numpoly - 1;
			for (i=0; i < numpoly; i++) {
				if ( ((poly[i][1] < y) && (poly[j][1] >= y)) || ((poly[j][1] < y) && (poly[i][1] >= y)) ) {
					xnode.push( Math.round( (y-poly[i][1]) / (poly[j][1]-poly[i][1]) * (poly[j][0]-poly[i][0]) + poly[i][0] ));
				}
				j = i;
			}

			// sort nodes
			if (xnode.length == 0) continue;
			xnode.sort(function(a, b) { return a - b; });

			// draw pixes between node pairs
			for (i=0; i < xnode.length; i+=2) {
				// clip to viewport edges
				if (xnode[i] > glob.viewport.x1) break;
				if (xnode[i+1] >= glob.viewport.x0) {
					if (xnode[i+1] > glob.viewport.x1) { xnode[i+1] = glob.viewport.x1; }
					if (xnode[i] < glob.viewport.x0) { xnode[i] = glob.viewport.x0; }
					for (x = xnode[i]; x < xnode[i+1]; x++) {
						setPixelPattern(x, y, colr, 0, fillPattern);
					}
				}
			}
		}
	}

	// NOT DONE
	function drawOvalArc(xc, yc, sa, ea, xrad, yrad, drawColor, lineThick, fillColor, fillPattern) {
		// uses glob.viewport
		// TODO: fillPattern, fillColor
		// TODO: make more efficient
		// TODO: test various arcs & pies
		// FIXME: circle not round enough?

		const twoPiD = 2 * Math.PI / 360;
		if (sa > ea) ea += 360;
		var x0, y0, x1, y1;
		var pieFlag = false;
		if (typeof lineThick === 'undefined') { lineThick = 1; }
		if (typeof fillColor != 'undefined') { 
			if ((sa != 0) || (ea != 360)) { pieFlag = true; }
		}

		// first point of line
		if (pieFlag) {
			x0 = xc; y0 = yc;
		}
		else {
			x0 = xc + Math.round(xrad * Math.cos(sa * twoPiD));
			y0 = yc - Math.round(yrad * Math.sin(sa * twoPiD));
		}

		// draw arc counter-clockwise
		for (var n = sa; n <= ea; n += 3) {
			// test with: Math.floor() .round() .trunc()
			x1 = xc + Math.round(xrad * Math.cos(n * twoPiD));
			y1 = yc - Math.round(yrad * Math.sin(n * twoPiD));
			drawLine(x0, y0, x1, y1, drawColor, 0, lineThick);
			x0 = x1; y0 = y1;
		}

		// end pie line to center
		if (pieFlag) {
			drawLine(x0, y0, xc, yc, drawColor, 0, lineThick);
		}
	}

	// Returns an SVG path string which defines an oval arc
	function svgArcPathD(xc, yc, sa, ea, xrad, yrad, pieFlag) {
		// Arc: "M x0 y0  A rx ry x-axis-rotation large-arc-flag sweep-flag x1 y1"
		// Pie: "M xc yc  L x0 y0  A rx ry x-axis-rotation large-arc-flag sweep-flag x1 y1  Z"

		const twoPiD = 2 * Math.PI / 360;
		if (sa > ea) ea += 360;
		var x0 = (xc + (xrad * Math.cos(sa * twoPiD))).toFixed(1);
		var y0 = (yc - (yrad * Math.sin(sa * twoPiD))).toFixed(1);
		var x1 = (xc + (xrad * Math.cos(ea * twoPiD))).toFixed(1);
		var y1 = (yc - (yrad * Math.sin(ea * twoPiD))).toFixed(1);
		var largeArc = (ea - sa > 180) ? 1 : 0;
		var d;
		if (pieFlag) {
			d = 'M'+xc+' '+yc+' L '+x0+' '+y0+' A '+xrad+' '+yrad+' 0 '+largeArc+' 0 '+x1+' '+y1+' Z';
		}
		else {
			d = 'M'+x0+' '+y0+' A '+xrad+' '+yrad+' 0 '+largeArc+' 0 '+x1+' '+y1;
		}
		return d;
	}

	// alternate, only works for whole circle / oval, thick=1 (so far)
	function drawCircle(x0, y0, sa, ea, xrad, yrad, drawColor, lineThick, fillColor, fillPattern) {

		var x = xrad, y = 0;
		var radiusError = 1 - x;
		var ratio = yrad / xrad;

		while (y <= x) {
			var ay = Math.floor(y * ratio);
			var ax = Math.floor(x * ratio);
			setPixelBuf(  x + x0,  ay + y0, drawColor);
			setPixelBuf(  y + x0,  ax + y0, drawColor);
			setPixelBuf( -x + x0,  ay + y0, drawColor);
			setPixelBuf( -y + x0,  ax + y0, drawColor);
			setPixelBuf( -x + x0, -ay + y0, drawColor);
			setPixelBuf( -y + x0, -ax + y0, drawColor);
			setPixelBuf(  x + x0, -ay + y0, drawColor);
			setPixelBuf(  y + x0, -ax + y0, drawColor);
			y++;
			if (radiusError < 0) {
				radiusError += 2 * y + 1;
			}
			else {
				x--;
				radiusError += 2 * (y - x + 1);
			}
		}
	}

	// Takes a 16-bit RIP linePattern and returns an array of numbers to use in an
	// SVG "stroke-dasharray" attribute.  Since dash arrays must begin with 'on' pixels
	// before any 'off' gaps, the result may be phase-shifted from the original linePattern
	// if it begins with 0s.

	function svgMakeDashArray(linePattern) {

		if (self.debugVerbose) console.log('svgMakeDashArray('+ linePattern.toString(16).padStart(4, '0') +')');
		var dashes = [];
		var pat = linePattern;

		// check for empty pattern
		if ((pat & 0xFFFF) != 0) {
			// shift until first 1 bit
			var n=16, c=16;
			while (((pat & 0x8000) === 0) && (n > 0)) {
				pat = (pat << 1) & 0xFFFF;
				n--;
			}
			//console.log('1   pat:'+ pat.toString(16).padStart(4, '0') +' dashes:'+ dashes);
			while (c > 0) {
				n=0;
				while (((pat & 0x8000) != 0) && (c > 0)) {
					pat = (pat << 1) & 0xFFFF;
					n++; c--;
				}
				dashes.push(n);
				//console.log('2   pat:'+ pat.toString(16).padStart(4, '0') +' dashes:'+ dashes);
				n=0;
				while (((pat & 0x8000) === 0) && (c > 0)) {
					pat = (pat << 1) & 0xFFFF;
					n++; c--;
				}
				dashes.push(n);
				//console.log('3   pat:'+ pat.toString(16).padStart(4, '0') +' dashes:'+ dashes);
			}
		}
		//console.log('svgMakeDashArray('+ linePattern.toString(16).padStart(4, '0') +') => '+ dashes);
		if (self.debugVerbose) console.log('svgMakeDashArray => '+ dashes);
		return dashes;
	}

	function svgSetViewport(vp) {
		// vp is an object: {x0:, y0:, x1:, y1:}
		// uses svg, svgView, glob.svgViewCount

		if (svg) {
			var id = self.svgPrefix + "-vp" + glob.svgViewCount;
			var defs = svgNode('defs', {});
			var clipPath = svgNode('clipPath', { "id":id });
			var rect = svgNode('rect', {
				"x":vp.x0, "y":vp.y0, "width":(vp.x1 - vp.x0 + 1), "height":(vp.y1 - vp.y0 + 1)
			});
			clipPath.appendChild(rect);
			defs.appendChild(clipPath);
			svg.appendChild(defs);
			svgView = svgNode('g', { "clipPath":"url(#"+id+")" });
			svg.appendChild(svgView);
			glob.svgViewCount++;
		}
	}

	function svgMakeFillPattern(fillPattern) {

		var d = "";
		var bit;
		for (var y=0; y < 8; y++) {
			for (var x=0; x < 8; x++) {
				bit = (fillPattern[y] >> (7 - x)) & 1;
				if (bit) {
					d += ' M'+x+' '+y+' h1 v1 h-1 Z';
				}
			}
		}
		return d;
	}

	function svgAppendFillPattern(fillPattern, colr) {

		if (svgView) {
			glob.svgFillId = self.svgPrefix + "-fill" + glob.svgFillCount;
			glob.svgFillCount++;
			var pathTxt = svgMakeFillPattern(fillPattern);
			if (self.debugVerbose) console.log('SVG fillStyle path: ' + pathTxt);
			var defs = svgNode('defs', {});
			var pattern = svgNode('pattern', {
				"id":glob.svgFillId, "width":8, "height":8, "patternUnits":"userSpaceOnUse"
			});
			// fill with background color
			pattern.appendChild(svgNode('path', { "d":"M0 0 H8 V8 H0 Z", "fill":pal2hex(0) }));
			// fill pattern
			pattern.appendChild(svgNode('path', { "d":pathTxt, "fill":pal2hex(colr) }));
			defs.appendChild(pattern);
			svgView.appendChild(defs);
		}
	}

// ----------------------------------------------------------------------------------------------------
// RIP commands

	const svgOff = 0.5;

	self.cmd = {

		// 'w' RIP_TEXT_WINDOW

		// RIP_VIEWPORT
		'v': function(args) {
			if (args.length >= 8) {
				glob.viewport.x0 = parseRIPint(args, 0);
				glob.viewport.y0 = parseRIPint(args, 2);
				glob.viewport.x1 = parseRIPint(args, 4);
				glob.viewport.y1 = parseRIPint(args, 6);
				svgSetViewport(glob.viewport);
			}
		},

		// RIP_RESET_WINDOWS
		// implements: clear screen, restore default palette
		'*': function(args) {
			resetGlob();   // TODO: double-check this
			resetPalette();
			self.clear();
		},

		// 'e' RIP_ERASE_WINDOW
		// Clears Text Window to background color

		// RIP_ERASE_VIEW
		'E': function(args) {
			drawBar(glob.viewport.x0, glob.viewport.y0, glob.viewport.x1, glob.viewport.y1, 0);
			if (svgView) {
				svgView.appendChild(svgNode('rect', {
					"x":glob.viewport.x0, "y":glob.viewport.y0,
					"width":(glob.viewport.x1 - glob.viewport.x0 + 1),
					"height":(glob.viewport.y1 - glob.viewport.y0 + 1),
					"fill":pal2hex(0)
				}));
			}
		},

		// 'g' RIP_GOTOXY
		// 'H' RIP_HOME
		// '>' RIP_ERASE_EOL

		// RIP_COLOR
		'c': function(args) {
			if (args.length >= 2) {
				glob.drawColor = parseRIPint(args, 0);
			}
		},

		// RIP_SET_PALETTE
		'Q': function(args) {
			if (args.length >= 32) {
				var p;
				for (var c=0; c < 16; c++) {
					p = parseRIPint(args, c*2);
					if (p < 64) {
						setPalWithHex(c, paletteEGA64[p]);
					}
				}
			}
		},

		// RIP_ONE_PALETTE
		'a': function(args) {
			if (args.length >= 4) {
				var colr  = parseRIPint(args, 0);
				var value = parseRIPint(args, 2);
				if ((colr < 16) && (value < 64)) {
					setPalWithHex(colr, paletteEGA64[value]);
				}
			}
		},

		// RIP_WRITE_MODE
		'W': function(args) {
			if (args.length >= 2) {
				glob.writeMode = parseRIPint(args, 0);
			}
		},

		// RIP_MOVE
		'm': function(args) {
			if (args.length >= 4) {
				glob.move.x = parseRIPint(args, 0);
				glob.move.y = parseRIPint(args, 2);
			}
		},
/*
		// RIP_TEXT (not done)
		'T': function(args) {
			var text = unescapeRIPtext(args);
			// TODO: draw text using glob.move.x, glob.move.y
			console.log('RIP_TEXT: ' + text);
		},

		// RIP_TEXT_XY (not done)
		'@': function(args) {
			if (args.length >= 4) {
				var x = parseRIPint(args, 0)
				var y = parseRIPint(args, 2);
				var text = unescapeRIPtext(args.substr(4));
				// TODO: draw text
				console.log('RIP_TEXT_XY: ' + text);
			}
		},

		// RIP_FONT_STYLE
		'Y': function(args) {
			if (args.length >= 6) {
				glob.fontStyle = parseRIPint(args, 0);
				glob.fontDir   = parseRIPint(args, 2);
				glob.fontSize  = parseRIPint(args, 4);
				// (2 bytes) reserved
			}
		},
*/
		// RIP_PIXEL
		'X': function(args) {
			if (args.length >= 4) {
				var x = parseRIPint(args, 0);
				var y = parseRIPint(args, 2);
				setPixelBuf(x, y, glob.drawColor);  // spec says doesn't use drawMode
				if (svgView) {
					svgView.appendChild(svgNode('circle', {
						"cx":(x+svgOff), "cy":(y+svgOff), "r":0.5, "fill":pal2hex(glob.drawColor)
					}));
				}
			}
		},

		// RIP_LINE
		'L': function(args) {
			if (args.length >= 8) {
				var x0 = parseRIPint(args, 0);
				var y0 = parseRIPint(args, 2);
				var x1 = parseRIPint(args, 4);
				var y1 = parseRIPint(args, 6);
				drawLine(x0, y0, x1, y1, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svgView) {
					svgView.appendChild(svgNode('line', {
						"x1":(x0+svgOff), "y1":(y0+svgOff), "x2":(x1+svgOff), "y2":(y1+svgOff),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						//"stroke-linecap":"square",  // doesn't work on JULY493.RIP
						"stroke-dasharray":glob.svgDashArray.join(',')
					}));
				}
			}
		},

		// RIP_RECTANGLE
		'R': function(args) {
			if (args.length >= 8) {
				var x0 = parseRIPint(args, 0);
				var y0 = parseRIPint(args, 2);
				var x1 = parseRIPint(args, 4);
				var y1 = parseRIPint(args, 6);
				var s; // force xy0 to upper-left, xy1 to lower-right
				if (x0 > x1) { s=x0; x0=x1; x1=s; }
				if (y0 > y1) { s=y0; y0=y1; y1=s; }
				drawRectangle(x0, y0, x1, y1, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svgView) {
					svgView.appendChild(svgNode('rect', {
						//"x":x0, "y":y0, "width":(x1-x0+1), "height":(y1-y0+1),
						"x":(x0+svgOff), "y":(y0+svgOff), "width":(x1-x0), "height":(y1-y0),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						"stroke-dasharray":glob.svgDashArray.join(','),
						//"fill":"transparent", "style":"fill:none"
						"fill":"none", "fill-rule":"evenodd"
					}));
				}
			}
		},

		// RIP_BAR
		'B': function(args) {
			if (args.length >= 8) {
				var x0 = parseRIPint(args, 0);
				var y0 = parseRIPint(args, 2);
				var x1 = parseRIPint(args, 4);
				var y1 = parseRIPint(args, 6);
				var s; // force xy0 to upper-left, xy1 to lower-right
				if (x0 > x1) { s=x0; x0=x1; x1=s; }
				if (y0 > y1) { s=y0; y0=y1; y1=s; }
				// spec says RIP_BAR doesn't use writeMode (could spec be wrong??)
				drawBar(x0, y0, x1, y1, glob.fillColor, 0, glob.fillPattern);
				if (svgView) {
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('rect', {
						"x":x0, "y":y0, "width":(x1-x0+1), "height":(y1-y0+1), "fill":fill
						//"stroke":pal2hex(glob.fillColor), "stroke-width":1,   // TODO: test this ??
					}));
				}
			}
		},

		// RIP_CIRCLE
		'C': function(args) {
			if (args.length >= 6) {
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var xr = parseRIPint(args, 4) || 1; // 0.5
				var yr = xr * (350/450);  // weird aspect ratio, but fixes SOCCER.RIP
				//var yr = xr * (350/480);  // aspect ratio for 640x350 EGA
				drawOvalArc(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick);
				//drawCircle(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick);  // TEST
				if (svgView) {
					svgView.appendChild(svgNode('ellipse', {
						//"cx":(xc+1.0), "cy":(yc+1.0), "rx":xr, "ry":yr,
						"cx":(xc+svgOff), "cy":(yc+svgOff), "rx":(xr-0.5), "ry":(yr-0.5),
						//"cx":(xc+svgOff+0.5), "cy":(yc+svgOff+0.5), "rx":xr, "ry":yr,  // TODO: test
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":"none"
					}));
				}
			}
		},

		// RIP_OVAL
		'O': function(args) {
			// exactly same as RIP_OVAL_ARC
			self.cmd['V'](args);
		},

		// RIP_FILLED_OVAL (not done)
		'o': function(args) {
			if (args.length >= 8) { 
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var xr = parseRIPint(args, 4) || 1; // 0.5
				var yr = parseRIPint(args, 6) || 1;
				// TODO: fill oval
				drawOvalArc(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
				if (svgView) {
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('ellipse', {
						//"cx":(xc+svgOff), "cy":(yc+svgOff), "rx":xr, "ry":yr,
						"cx":(xc+svgOff), "cy":(yc+svgOff), "rx":(xr-0.5), "ry":(yr-0.5),
						//"cx":(xc+svgOff+0.5), "cy":(yc+svgOff+0.5), "rx":xr, "ry":yr,  // TODO: need to test
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						"fill":fill
						// TODO: SVG fillPattern
					}));
				}
			}
		},

		// RIP_ARC
		'A': function(args) {
			if (args.length >= 10) {
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var sa = parseRIPint(args, 4);
				var ea = parseRIPint(args, 6);
				var xr = parseRIPint(args, 8) || 1;
				var yr = xr * (350/450);  // weird aspect ratio
				//var yr = xr * (350/480);  // aspect ratio for 640x350 EGA
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick);
				if (svgView) {
					svgView.appendChild(svgNode('path', {
						"d":svgArcPathD((xc+svgOff), (yc+svgOff), sa, ea, (xr-0.5), (yr-0.5), false),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":"none"
					}));
				}
			}
		},

		// RIP_OVAL_ARC
		'V': function(args) {
			if (args.length >= 12) { 
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var sa = parseRIPint(args, 4);
				var ea = parseRIPint(args, 6);
				var xr = parseRIPint(args, 8)  || 1;
				var yr = parseRIPint(args, 10) || 1;
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick);

				if (svgView) {
					if ((sa === 0) && (ea === 360)) {
						// draw ellipse
						svgView.appendChild(svgNode('ellipse', {
							"cx":(xc+svgOff), "cy":(yc+svgOff), "rx":(xr-0.5), "ry":(yr-0.5),
							"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":"none"
						}));
					}
					else {
						// draw oval arc
						svgView.appendChild(svgNode('path', {
							"d":svgArcPathD((xc+svgOff), (yc+svgOff), sa, ea, (xr-0.5), (yr-0.5), false),
							"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":"none"
						}));
					}
				}
			}
		},

		// RIP_PIE_SLICE (not done)
		'I': function(args) {
			if (args.length >= 10) {
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var sa = parseRIPint(args, 4);
				var ea = parseRIPint(args, 6);
				var xr = parseRIPint(args, 8) || 1;
				var yr = xr * (350/450);  // weird aspect ratio
				//var yr = xr * (350/480);  // aspect ratio for 640x350 EGA
				// TODO: draw & fill pie slice
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
				if (svgView) {
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('path', {
						"d":svgArcPathD((xc+svgOff), (yc+svgOff), sa, ea, (xr-0.5), (yr-0.5), true),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":fill
					}));
				}
			}
		},

		// RIP_OVAL_PIE_SLICE (not done)
		'i': function(args) {
			if (args.length >= 12) { 
				var xc = parseRIPint(args, 0);
				var yc = parseRIPint(args, 2);
				var sa = parseRIPint(args, 4);
				var ea = parseRIPint(args, 6);
				var xr = parseRIPint(args, 8)  || 1;
				var yr = parseRIPint(args, 10) || 1;
				// TODO: draw & fill oval pie slice
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
				if (svgView) {
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('path', {
						"d":svgArcPathD((xc+svgOff), (yc+svgOff), sa, ea, (xr-0.5), (yr-0.5), true),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":fill
					}));
				}
			}
		},

		// RIP_BEZIER
		'Z': function(args) {
			if (args.length >= 18) {
				var x1 = parseRIPint(args, 0);
				var y1 = parseRIPint(args, 2);
				var x2 = parseRIPint(args, 4);
				var y2 = parseRIPint(args, 6);
				var x3 = parseRIPint(args, 8);
				var y3 = parseRIPint(args, 10);
				var x4 = parseRIPint(args, 12);
				var y4 = parseRIPint(args, 14);
				var cnt = parseRIPint(args, 16);
				// using solid linePattern (spec says it uses linePattern, but I think it's wrong.)
				drawBezier(x1, y1, x2, y2, x3, y3, x4, y4, cnt, glob.drawColor, glob.writeMode, glob.lineThick, 0xFFFF);
				if (svgView) {
					svgView.appendChild(svgNode('path', {
						"d": "M"+(x1+svgOff)+","+(y1+svgOff)+" C "+(x2+svgOff)+","+(y2+svgOff)+" "+(x3+svgOff)+","+(y3+svgOff) +" "+(x4+svgOff)+","+(y4+svgOff),  // TODO: test
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "stroke-linecap":"round",
						//"fill":"transparent", "style":"fill:none"
						"fill":"none", "fill-rule":"evenodd"
					}));
				}
			}
		},

		// RIP_POLYGON
		'P': function(args) {
			if (args.length >= 6) {
				var num = parseRIPint(args, 0);
				var poly = [];
				for (var i=0; i < num; i++) {
					poly.push( [parseRIPint(args, i*4+2), parseRIPint(args, i*4+4)] );
				}
				drawPolygon(poly, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svgView) {
					svgView.appendChild(svgNode('polygon', {
						"points":poly.map(x => [x[0] + svgOff, x[1] + svgOff]).join(' '),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						"stroke-dasharray":glob.svgDashArray.join(','),
						"fill":"none", "fill-rule":"evenodd"
					}));
				}
			}
		},

		// RIP_FILL_POLYGON
		// draws outline using linePattern & writeMode
		// while inner fill doesn't use writeMode, but does use fillPattern
		'p': function(args) {
			if (args.length >= 6) {
				var num = parseRIPint(args, 0);
				var poly = [];
				for (var i=0; i < num; i++) {
					poly.push( [parseRIPint(args, i*4+2), parseRIPint(args, i*4+4)] );
				}
				drawFilledPolygon(poly, glob.fillColor, glob.fillPattern);
				drawPolygon(poly, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svgView) {
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('polygon', {
						"points":poly.map(x => [x[0] + svgOff, x[1] + svgOff]).join(' '),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						"stroke-dasharray":glob.svgDashArray.join(','),
						"fill":fill, "fill-rule":"evenodd"
					}));
				}
			}
		},

		// RIP_POLYLINE
		'l': function(args) {
			if (args.length >= 6) {
				var num = parseRIPint(args, 0);
				var poly = [];
				for (var i=0; i < num; i++) {
					poly.push( [parseRIPint(args, i*4+2), parseRIPint(args, i*4+4)] );
				}
				drawPolyline(poly, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svgView) {
					svgView.appendChild(svgNode('polyline', {
						// "points":poly.join(' '),
						"points":poly.map(x => [x[0] + svgOff, x[1] + svgOff]).join(' '),  // TODO: test
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick,
						// "stroke-linecap":"square",  // does't work with dasharray
						"stroke-dasharray":glob.svgDashArray.join(','),
						"fill":"none", "fill-rule":"evenodd"
					}));
				}
			}
		},

		// RIP_FILL
		'F': function(args) {
			if ((args.length >= 6) && self.floodFill) {
				var x = parseRIPint(args, 0);
				var y = parseRIPint(args, 2);
				var border = parseRIPint(args, 4);
				if (self.debugVerbose) console.log('RIP_FILL: (' + x + ',' + y + ') color:' + glob.fillColor + ' border:' + border);
				drawFloodFill(x, y, border, glob.fillColor, glob.fillPattern);

				// requires 'potrace-modified.js'
				if (svgView && Potrace) {
					Potrace.loadFromData(tBuf, cWidth, cHeight);
					Potrace.process( function() { } );
					var pathTxt = Potrace.getPathD(1);
					if (self.debugVerbose) console.log('SVG path: ' + pathTxt);
					var fill = (glob.fillStyle == 1) ? pal2hex(glob.fillColor) : "url(#"+glob.svgFillId+")";
					svgView.appendChild(svgNode('path', {
						"stroke":pal2hex(glob.fillColor), "stroke-width":0.25,  // TODO: tweak this
						"fill":fill, "fill-rule":"evenodd", "d":pathTxt
					}));
				}
			}
		},

		// RIP_LINE_STYLE
		'=': function(args) {
			if (args.length >= 8) {
				var style = parseRIPint(args, 0);
				glob.lineThick = parseRIPint(args, 6);
				switch (style) {
					case 0: glob.linePattern = 0xFFFF; glob.svgDashArray = []; break;
					case 1: glob.linePattern = 0x3333; glob.svgDashArray = [2,2]; break;
					case 2: glob.linePattern = 0x1E3F; glob.svgDashArray = [4,3,6,3]; break;
					case 3: glob.linePattern = 0x1F1F; glob.svgDashArray = [5,3,5,3]; break;
					case 4:
						glob.linePattern = parseInt(args.substr(2,4), 36);
						glob.svgDashArray = svgMakeDashArray(glob.linePattern);
				}
			}
		},

		// RIP_FILL_STYLE
		'S': function(args) {
			if (args.length >= 4) {
				var pat = parseRIPint(args, 0);
				glob.fillColor = parseRIPint(args, 2);
				if (pat < fillPatterns.length) {
					glob.fillStyle = pat;
					glob.fillPattern = fillPatterns[pat];
					if (svgView && (pat != 1)) {
						svgAppendFillPattern(glob.fillPattern, glob.fillColor);
					}
				}
			}
		},

		// RIP_FILL_PATTERN
		's': function(args) {
			if (args.length >= 18) {
				glob.fillPattern = [];
				for (var i=0; i < 8; i++) {
					glob.fillPattern.push( parseRIPint(args, i*2) );
				}
				glob.fillStyle = fillPatterns.length;
				glob.fillColor = parseRIPint(args, 16);
				if (svgView) {
					svgAppendFillPattern(glob.fillPattern, glob.fillColor);
				}
			}
		},

		// '1M' RIP_MOUSE
		// '1K' RIP_KILL_MOUSE_FIELDS
		// '1T' RIP_BEGIN_TEXT
		// '1t' RIP_REGION_TEXT
		// '1E' RIP_END_TEXT

		// RIP_GET_IMAGE
		'1C': function(args) {
			if (args.length >= 8) {
				var x0 = parseRIPint(args, 0);
				var y0 = parseRIPint(args, 2);
				var x1 = parseRIPint(args, 4);
				var y1 = parseRIPint(args, 6);
				// 1 byte reserved
				var s; // force xy0 to upper-left, xy1 to lower-right
				if (x0 > x1) { s=x0; x0=x1; x1=s; }
				if (y0 > y1) { s=y0; y0=y1; y1=s; }
				glob.clipboard = getImageClip(x0, y0, x1, y1);
				if (self.debugVerbose) console.log('RIP_GET_IMAGE: x:'+x0+' y:'+y0+' w:'+glob.clipboard.w+' h:'+glob.clipboard.h);
			}
		},

		// RIP_PUT_IMAGE
		'1P': function(args) {
			if (args.length >= 7) {
				var x0 = parseRIPint(args, 0);
				var y0 = parseRIPint(args, 2);
				var mode = parseRIPint(args, 4);
				// 1 byte reserved
				if (glob.clipboard) {
					if (self.debugVerbose) console.log('RIP_PUT_IMAGE: x:'+x0+' y:'+y0+' mode:'+mode);
					putImageClip(x0, y0, glob.clipboard, mode)

					if (svg && self.svgIncludePut) {
						// SVG support is really experimental!
						// Filter effects on "BackgroundImage" aren't supported in most browsers.
						// This somewhat works in Inkscape, although renders slow.

						var dx = x0 - glob.clipboard.x;
						var dy = y0 - glob.clipboard.y;
						var id = self.svgPrefix + "-put" + glob.svgPutCount;
						var defs = svgNode('defs', {});
						var filter = svgNode('filter', {
							"id":id,
							"filterUnits":"userSpaceOnUse", "primitiveUnits":"userSpaceOnUse",
							"x": glob.viewport.x0, "y": glob.viewport.y0,
							"width": (glob.viewport.x1 - glob.viewport.x0 + 1),
							"height": (glob.viewport.y1 - glob.viewport.y0 + 1)
						});

						// create a composite intersection of background image with a white filled rect, then position it.
						filter.appendChild(svgNode('feComposite', {
							"in":"BackgroundImage", "in2":"SourceGraphic", "operator":"in"
						}));
						filter.appendChild(svgNode('feOffset', { "dx":dx, "dy":dy }));

						// handle mode {0=copy, 1=XOR, 2=OR, 3=AND, 4=NOT}
						// This can't be done realisticly, as we're dealing with RGB colors and not the color palette.
						switch (mode) {
							case 0: break;  // ok
							case 1: break;  // XOR todo
							case 2: filter.appendChild(svgNode('feBlend', { "in2":"BackgroundImage", "mode":"screen" })); break;
							case 3: filter.appendChild(svgNode('feBlend', { "in2":"BackgroundImage", "mode":"multiply" })); break;
							case 4: break;  // NOT todo
						}

						defs.appendChild(filter);
						svgView.appendChild(defs);
						svgView.appendChild(svgNode('rect', {
							"filter":"url(#"+id+")",
							"fill":"white",
							"x": glob.clipboard.x, "y": glob.clipboard.y,
							"width": glob.clipboard.w, "height": glob.clipboard.h,
							//"stroke":"red", "stroke-width":2, "stroke-dasharray":[2,2]  // DEBUG TEST (remove later)
						}));
						glob.svgPutCount++;
					}
				}
			}
		},

		// '1W' RIP_WRITE_ICON
		// '1I' RIP_LOAD_ICON
		// '1B' RIP_BUTTON_STYLE
		// '1U' RIP_BUTTON
		// '1D' RIP_DEFINE
		// '1<esc>' RIP_QUERY
		// '1G' RIP_COPY_REGION
		// '1R' RIP_READ_SCENE
		// '1F' RIP_FILE_QUERY

		// RIP_NO_MORE
		'#': function(args) {
			// do nothing
		}
	}

// ----------------------------------------------------------------------------------------------------
// public methods

	self.init = function(canvasId, svgId) {
		if (canvasId) {
			canvas = document.getElementById(canvasId);
			ripTextDiv = document.getElementById(self.ripTextId);
			counterDiv = document.getElementById(self.counterId);
			cWidth = canvas.width;
			cHeight = canvas.height;
			bgColor = window.getComputedStyle(canvas, null).getPropertyValue('background-color');
			ctx = canvas.getContext('2d');
			cImg = ctx.createImageData(cWidth, cHeight);
			cBuf = new Uint8ClampedArray(cWidth * cHeight);
			tBuf = new Uint8ClampedArray(cWidth * cHeight);
			resetPalette();
			resetGlob();
			self.clear();
		}
		if (svgId) {
			svg = document.getElementById(svgId);
		}
		if (Potrace) {
			// turnpolicy ("black" / "white" / "left" / "right" / "minority" / "majority")
			Potrace.setParameter({ turdsize:0, turnpolicy:"minority" });
		}
	}

	self.clear = function() {
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			cBuf.fill(0);
			tBuf.fill(0);
		}
		resetSVG();
	}

	self.reset = function() {
		if (self.debugVerbose) console.log('RESET');
		self.cmd['*']();
		cmdi = 0;
		if (self.counterId) { counterDiv.innerHTML = cmdi + ' / ' + ripData.length; }
	}

	self.start = function() {
		if (self.debugVerbose) console.log('START');
		if (ctx) {
			if (cmdi >= ripData.length) { cmdi = 0; }
			if (timer) clearTimeout(timer);
			timer = setInterval(self.drawNext, self.timeInterval);
		}
		else {
			console.log("ERROR: Must set 'canvasId' in constructor, or call init().");
		}
	}

	self.drawNext = function() {
		if (cmdi < ripData.length) {
			var d = ripData[cmdi];
			if (self.cmd[d[0]]) { self.cmd[d[0]](d[1]); }
			updateCanvas( (self.debugFillBuf) ? tBuf : cBuf );
			if (self.pauseOn.includes(d[0])) {
				if (!self.floodFill && (d[0] == 'F')) { }
				else { self.stop(); }
			}
			cmdi++;
			if (self.counterId) { counterDiv.innerHTML = cmdi + ' / ' + ripData.length; }
		}
		else {
			self.stop();
		}
	}

	self.stop = function () {
		if (self.debugVerbose) console.log('STOP');
		if (timer) {
			clearTimeout(timer);
		}
	}

	self.fullscreen = function() {
		if (canvas) {
			if (canvas.requestFullscreen) {
				canvas.requestFullscreen();
				document.addEventListener("fullscreenchange", self.fullscreenchange, false);
			}
			else if (canvas.msRequestFullscreen) {
				canvas.msRequestFullscreen();
				document.addEventListener("msfullscreenchange", self.fullscreenchange, false);
			}
			else if (canvas.mozRequestFullScreen) {
				canvas.mozRequestFullScreen();
				document.addEventListener("mozfullscreenchange", self.fullscreenchange, false);
			}
			else if (canvas.webkitRequestFullscreen) {
				canvas.webkitRequestFullscreen();
				document.addEventListener("webkitfullscreenchange", self.fullscreenchange, false);
			}
		}
	}

	// called when entering and exiting full screen
	self.fullscreenchange = function() {
		self.stop();
		if (fullmode == false) {
			// entering fullscreen
			fullmode = true;
			// backup canvas
			bu.width = canvas.style.width;
			bu.height = canvas.style.height;
			// resize canvas to fullscreen
			var winW = window.innerWidth, winH = window.innerHeight;
			canvas.style.width = winW + 'px';
			canvas.style.height = winH + 'px';
			resetGlob();
			self.clear();
			self.start();
		}
		else {
			// exiting fullscreen
			fullmode = false;
			// restore canvas
			canvas.style.width = bu.width;
			canvas.style.height = bu.height;
			resetGlob();
			self.clear();
		}
	}

	// constructor
	self.init(self.canvasId, self.svgId);
	return self;
}
