/**
 * ripterm.js
 * Copyright (c) 2018 Carl Gorringe 
 * http://carl.gorringe.org
 * 12/22/2017 - 2/2018
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

	// public defaults
	if (typeof self === 'undefined') self = {};
	if (!('timeInterval' in self)) self.timeInterval = 1;
	if (!('floodFill'    in self)) self.floodFill = true;
	if (!('debugVerbose' in self)) self.debugVerbose = false;
	if (!('pauseOn'      in self)) self.pauseOn   = [];
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
	var glob, svg;

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
			clipboard: null,
			viewport: {x0:0, y0:0, x1:639, y1:349},
			fillPattern: fillPatterns[1]
		};
		/*
			textWindow (x0 y0 x1 y1 wrap size)
				text font size = {0:8x8, 1:7x8, 2:8x14, 3:7x14, 4:16x14}
		*/
	}

	function randInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
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

	function svgNode(n, v) {
		n = document.createElementNS("http://www.w3.org/2000/svg", n);
		for (var p in v) {
			n.setAttributeNS(null, p, v[p]);
		}
		return n
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
		console.log('READ_FILE: ' + filename);  // TEST

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
				var c=0;
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
	function updateCanvas() {
		var b, j=0, numpix = cBuf.length;
		for (var i=0; i < numpix; ++i) {
			b = cBuf[i];
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
		return {w:w, h:h, img:img};
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
			pat = (pat << 1) && 0xFFFF;

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
	/*
		// TEST
		ctx.fillStyle = paletteEGA16[colr]; // test
		ctx.lineWidth = glob.lineThick;
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4);
		ctx.stroke();
	*/
		// Cubic Bezier formula:
		// p = (1-t)^3 *P0 + 3*t*(1-t)^2*P1 + 3*t^2*(1-t)*P2 + t^3*P3 
		// where t is 0 to 1

		if (count < 1) { return; }
		var step = 1 / count;
		var xp = x1, yp = y1, xn, yn;
		for (var t=step; t < 1; t += step) {
			// TODO: make more efficient?
			// floor() is correct, not round()
			xn = Math.floor( Math.pow(1-t, 3) * x1 + 3 * t * Math.pow(1-t, 2) * x2 + 3 * Math.pow(t, 2) * (1-t) * x3 + Math.pow(t, 3) * x4 );
			yn = Math.floor( Math.pow(1-t, 3) * y1 + 3 * t * Math.pow(1-t, 2) * y2 + 3 * Math.pow(t, 2) * (1-t) * y3 + Math.pow(t, 3) * y4 );
			drawLine(xp, yp, xn, yn, colr, writeMode, lineThick, linePattern);
			xp = xn;
			yp = yn;
		}
		drawLine(xp, yp, x4, y4, colr, writeMode, lineThick, linePattern);
	}

/*
	// TO REMOVE
	// NOT WORKING YET
	function drawFloodFill1(x0, y0, border, colr, fillPattern) {
		// uses glob.viewport
		// TODO: fillPattern, viewport
		// following modified from paint.js

		if (getPixel(x0, y0) == border) { return; }
		var stack = [{x:x0, y:y0, t:y0, b:y0, s:0}];
		var popped, count = 0;

		while (popped = stack.pop()) {
			var x = popped.x;   
			var y = popped.y;
			var t = popped.t; // top
			var b = popped.b; // bottom
			var s = popped.s; // span -1=left, 0=both, +1=right

			if (self.debugVerbose) {
				console.log('   popped: x='+x+', y='+y+', t='+t+', b='+b+', s='+s );  // TEST
			}

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
			//while ((y <= glob.viewport.y1) && (getPixel(x, y) != border)) {
			for (y = y1; y <= y2; y++) {
				setPixelBuf(x, y, colr);
				count++;

				if (!spanLeft && (x > glob.viewport.x0) && (getPixel(x-1, y) != border)) {
					//if ((s <= 0) || (y < t) || (y > b)) {
					if (s <= 0) {
						stack.push({x:x-1, y:y, t:y1, b:y2, s:-1});
					}
					spanLeft = true;
				}
				else if (spanLeft && (x > glob.viewport.x0) && (getPixel(x-1, y) == border)) {
					spanLeft = false;
				}
				//else if (spanRight && (x <= glob.viewport.x0)) { spanRight = false; }

				if (!spanRight && (x < glob.viewport.x1) && (getPixel(x+1, y) != border)) {
					if ((s >= 0) || (y < t) || (y > b)) {
					//if (s >= 0) {
						stack.push({x:x+1, y:y, t:y1, b:y2, s:1});
					}
					spanRight = true;
				}
				else if (spanRight && (x < glob.viewport.x1) && (getPixel(x+1, y) == border)) {
					spanRight = false;
				}
				//else if (spanRight && (x > glob.viewport.x1)) { spanRight = false; }

				//y++;
			}
			//if (count > 224000) { console.log('** FloodFill MAX **'); return; } // TEST: exit after 350*640 pixels
			if (count > 30000) { console.log('** FloodFill MAX **'); return; } // TEST: exit after 350*640 pixels
		}
	}
//*/

	function drawFloodFill(x0, y0, border, colr, fillPattern) {
		// uses glob.viewport
		// TODO: make more efficient:
		// [ ] convert to horizontal scan lines, write/read buffer array directly

		if (getPixel(x0, y0) == border) { return; }
		var stack = [{x:x0, y:y0}];
		var popped, count = 0;
		tBuf.fill(0);

		while (popped = stack.pop()) {
			var x = popped.x;   
			var y = popped.y;

			if (self.debugVerbose) {
				console.log('   popped: x='+x+', y='+y);  // TEST
			}

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
			//if (count > 224000) { console.log('** FloodFill MAX **'); return; } // TEST: exit after 350*640 pixels
			//if (count > 30000) { console.log('** FloodFill MAX **'); return; } // TEST: exit after 350*640 pixels
		}
	}

/*
	// NOT DONE
	// likely wouldn't work with corner cases (i.e. a corner!)
	function drawFilledPolygon(colr, fillPattern) {
		// Expects tBuf[] to contain polygon outline, which this uses
		// to draw a filled polygon to the canvas buffer cBuf[].
		// uses: cBuf[], tBuf[], cWidth, cHeight
		// ignores glob.writeMode for filling
		// TODO: fillPattern, viewport

		var pixelOn = false;
		for (var y=0; y < cHeight; y++) {
			for (var x=0; x < cWidth; x++) {

				if (pixelOn) { setPixelBuf(x, y, colr); }
			}
		}

	}
*/

	function drawFilledPolygon(xpoly, ypoly, colr, fillPattern) {
		// uses: glob.viewport
		// code based on: http://alienryderflex.com/polygon_fill/

		if (self.debugVerbose) {
			console.log("length xpoly:"+xpoly.length + " ypoly:"+ypoly.length + " colr:"+colr); // TEST
		}

		var numpoly = xpoly.length;
		var i, j, x, y, xnode;

		// scan thru all rows in viewport
		for (y = glob.viewport.y0; y <= glob.viewport.y1; y++) {
			xnode = [];

			// build node list
			j = numpoly - 1;
			for (i=0; i < numpoly; i++) {
				if ( ((ypoly[i] < y) && (ypoly[j] >= y)) || ((ypoly[j] < y) && (ypoly[i] >= y)) ) {
					xnode.push( Math.round( (y-ypoly[i]) / (ypoly[j]-ypoly[i]) * (xpoly[j]-xpoly[i]) + xpoly[i] ));
				}
				j = i;
			}

			// sort nodes
			if (xnode.length == 0) continue;
			//console.log("xnode before: " + xnode);  // TEST
			xnode.sort(function(a, b) { return a - b; });
			//console.log("xnode after:  " + xnode);  // TEST

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
			//break;  // TEST
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
		if (sa < 0) { sa = 0; }
		if (ea > 360) { ea = 360; }
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

// ----------------------------------------------------------------------------------------------------
// RIP commands

	self.cmd = {

		// 'w' RIP_TEXT_WINDOW

		// RIP_VIEWPORT
		'v': function(args) {
			if (args.length >= 8) {
				glob.viewport.x0 = parseInt(args.substr(0,2), 36);
				glob.viewport.y0 = parseInt(args.substr(2,2), 36);
				glob.viewport.x1 = parseInt(args.substr(4,2), 36);
				glob.viewport.y1 = parseInt(args.substr(6,2), 36);
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
			drawBar(glob.viewport.x0, glob.viewport.y0, glob.viewport.x1, glob.viewport.y1);
		},

		// 'g' RIP_GOTOXY
		// 'H' RIP_HOME
		// '>' RIP_ERASE_EOL

		// RIP_COLOR
		'c': function(args) {
			if (args.length >= 2) {
				glob.drawColor = parseInt(args.substr(0,2), 36);
			}
		},

		// RIP_SET_PALETTE
		'Q': function(args) {
			if (args.length >= 32) {
				var p;
				for (var c=0; c < 16; c++) {
					p = parseInt(args.substr(c*2, 2), 36);
					if (p < 64) {
						setPalWithHex(c, paletteEGA64[p]);
					}
				}
			}
		},

		// RIP_ONE_PALETTE
		'a': function(args) {
			if (args.length >= 4) {
				var colr  = parseInt(args.substr(0,2), 36);
				var value = parseInt(args.substr(2,2), 36);
				if ((colr < 16) && (value < 64)) {
					setPalWithHex(colr, paletteEGA64[value]);
				}
			}
		},

		// RIP_WRITE_MODE
		'W': function(args) {
			if (args.length >= 2) {
				glob.writeMode = parseInt(args.substr(0,2), 36);
			}
		},

		// RIP_MOVE
		'm': function(args) {
			if (args.length >= 4) {
				glob.move.x = parseInt(args.substr(0,2), 36);
				glob.move.y = parseInt(args.substr(2,2), 36);
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
				var x = parseInt(args.substr(0,2), 36);
				var y = parseInt(args.substr(2,2), 36);
				var text = unescapeRIPtext(args.substr(4));
				// TODO: draw text
				console.log('RIP_TEXT_XY: ' + text);
			}
		},

		// RIP_FONT_STYLE
		'Y': function(args) {
			if (args.length >= 6) {
				glob.fontStyle = parseInt(args.substr(0,2), 36);
				glob.fontDir   = parseInt(args.substr(2,2), 36);
				glob.fontSize  = parseInt(args.substr(4,2), 36);
				// (2 bytes) reserved
			}
		},
*/
		// RIP_PIXEL
		'X': function(args) {
			if (args.length >= 4) {
				var x = parseInt(args.substr(0,2), 36);
				var y = parseInt(args.substr(2,2), 36);
				setPixelBuf(x, y, glob.drawColor);  // spec says doesn't use drawMode
				if (svg) {
					svg.appendChild( svgNode('circle', {
						"cx":(x+0.5), "cy":(y+0.5), "r":0.5, "fill":pal2hex(glob.drawColor)
					}));
				}
			}
		},

		// RIP_LINE
		'L': function(args) {
			if (args.length >= 8) {
				var x0 = parseInt(args.substr(0,2), 36);
				var y0 = parseInt(args.substr(2,2), 36);
				var x1 = parseInt(args.substr(4,2), 36);
				var y1 = parseInt(args.substr(6,2), 36);
				drawLine(x0, y0, x1, y1, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svg) {
					svg.appendChild( svgNode('line', {
						"x1":x0, "y1":y0, "x2":x1, "y2":y1,
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick
					}));
					// TODO: "stroke-dasharray":"3,5" (means 3 on, 5 off)
				}
			}
		},

		// RIP_RECTANGLE
		'R': function(args) {
			if (args.length >= 8) {
				var x0 = parseInt(args.substr(0,2), 36);
				var y0 = parseInt(args.substr(2,2), 36);
				var x1 = parseInt(args.substr(4,2), 36);
				var y1 = parseInt(args.substr(6,2), 36);
				drawRectangle(x0, y0, x1, y1, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
				if (svg) {
					svg.appendChild( svgNode('rect', {
						"x":x0, "y":y0, "width":(x1-x0+1), "height":(y1-y0+1),
						"stroke":pal2hex(glob.drawColor), "stroke-width":glob.lineThick, "fill":"transparent"
					}));
				}
			}
		},

		// RIP_BAR
		'B': function(args) {
			if (args.length >= 8) {
				var x0 = parseInt(args.substr(0,2), 36);
				var y0 = parseInt(args.substr(2,2), 36);
				var x1 = parseInt(args.substr(4,2), 36);
				var y1 = parseInt(args.substr(6,2), 36);
				// spec says RIP_BAR doesn't use writeMode (could spec be wrong??)
				drawBar(x0, y0, x1, y1, glob.fillColor, 0, glob.fillPattern);
				if (svg) {
					svg.appendChild( svgNode('rect', { 
						"x":x0, "y":y0, "width":(x1-x0+1), "height":(y1-y0+1), "fill":pal2hex(glob.fillColor)
					}));
					// TODO: for patterns see
					// https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Patterns
				}
			}
		},

		// RIP_CIRCLE
		'C': function(args) {
			if (args.length >= 6) {
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var xr = parseInt(args.substr(4,2), 36);
				var yr = xr * (350/480);  // adjust aspect ratio for 640x350 EGA
				//drawOvalArc(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick);
				drawCircle(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick);  // TEST
				if (svg) {
					svg.appendChild( svgNode('ellipse', {
						"cx":xc, "cy":yc, "rx":xr, "ry":yr,
						"stroke":pal2hex(glob.drawColor), "fill":"transparent", "stroke-width":glob.lineThick
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
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var xr = parseInt(args.substr(4,2), 36);
				var yr = parseInt(args.substr(6,2), 36);
				// TODO: fill oval
				drawOvalArc(xc, yc, 0, 360, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
				if (svg) {
					svg.appendChild( svgNode('ellipse', {
						"cx":xc, "cy":yc, "rx":xr, "ry":yr,
						"stroke":pal2hex(glob.drawColor), "fill":pal2hex(glob.fillColor), "stroke-width":glob.lineThick
					}));
				}
			}
		},

		// RIP_ARC
		'A': function(args) {
			if (args.length >= 10) {
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var sa = parseInt(args.substr(4,2), 36);
				var ea = parseInt(args.substr(6,2), 36);
				var xr = parseInt(args.substr(8,2), 36);
				var yr = xr * (350/480);  // adjust aspect ratio for 640x350 EGA
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick);
			}
		},

		// RIP_OVAL_ARC
		'V': function(args) {
			if (args.length >= 12) { 
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var sa = parseInt(args.substr(4,2), 36);
				var ea = parseInt(args.substr(6,2), 36);
				var xr = parseInt(args.substr(8,2), 36);
				var yr = parseInt(args.substr(10,2), 36);
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick);
			}
		},

		// RIP_PIE_SLICE (not done)
		'I': function(args) {
			if (args.length >= 10) {
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var sa = parseInt(args.substr(4,2), 36);
				var ea = parseInt(args.substr(6,2), 36);
				var xr = parseInt(args.substr(8,2), 36);
				var yr = xr * (350/480);  // adjust aspect ratio for 640x350 EGA
				// TODO: draw & fill pie slice
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
			}
		},

		// RIP_OVAL_PIE_SLICE (not done)
		'i': function(args) {
			if (args.length >= 12) { 
				var xc = parseInt(args.substr(0,2), 36);
				var yc = parseInt(args.substr(2,2), 36);
				var sa = parseInt(args.substr(4,2), 36);
				var ea = parseInt(args.substr(6,2), 36);
				var xr = parseInt(args.substr(8,2), 36);
				var yr = parseInt(args.substr(10,2), 36);
				// TODO: draw & fill oval pie slice
				drawOvalArc(xc, yc, sa, ea, xr, yr, glob.drawColor, glob.lineThick, glob.fillColor, glob.fillPattern);
			}
		},

		// RIP_BEZIER
		'Z': function(args) {
			if (args.length >= 18) {
				var x1 = parseInt(args.substr(0,2), 36);
				var y1 = parseInt(args.substr(2,2), 36);
				var x2 = parseInt(args.substr(4,2), 36);
				var y2 = parseInt(args.substr(6,2), 36);
				var x3 = parseInt(args.substr(8,2), 36);
				var y3 = parseInt(args.substr(10,2), 36);
				var x4 = parseInt(args.substr(12,2), 36);
				var y4 = parseInt(args.substr(14,2), 36);
				var cnt = parseInt(args.substr(16,2), 36);
				// using solid linePattern (spec says it uses linePattern, but I think it's wrong.)
				drawBezier(x1, y1, x2, y2, x3, y3, x4, y4, cnt, glob.drawColor, glob.writeMode, glob.lineThick, 0xFFFF);
			}
		},

		// RIP_POLYGON
		'P': function(args) {
			if (args.length >= 6) {
				var num = parseInt(args.substr(0,2), 36);
				var x0 = parseInt(args.substr(2,2), 36);
				var y0 = parseInt(args.substr(4,2), 36);
				var xp = x0, yp = y0, xn, yn;
				for (var i=1; i < num; i++) {
					xn = parseInt(args.substr(i*4+2, 2), 36);
					yn = parseInt(args.substr(i*4+4, 2), 36);
					drawLine(xp, yp, xn, yn, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
					xp = xn; yp = yn;
				}
				drawLine(xp, yp, x0, y0, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
			}
		},

		// RIP_FILL_POLYGON (not done)
		// draws outline using linePattern & writeMode
		// while inner fill doesn't use writeMode, but does use fillPattern
		'p': function(args) {
			if (args.length >= 6) {
				var num = parseInt(args.substr(0,2), 36);
				var xpoly = [], ypoly = [];
				for (var i=0; i < num; i++) {
					xpoly.push( parseInt(args.substr(i*4+2, 2), 36) );
					ypoly.push( parseInt(args.substr(i*4+4, 2), 36) );
				}
				drawFilledPolygon(xpoly, ypoly, glob.fillColor, glob.fillPattern);
				self.cmd['P'](args);
			}
		},

		// RIP_POLYLINE
		'l': function(args) {
			if (args.length >= 6) {
				var num = parseInt(args.substr(0,2), 36);
				var x0 = parseInt(args.substr(2,2), 36);
				var y0 = parseInt(args.substr(4,2), 36);
				var xp = x0, yp = y0, xn, yn;
				for (var i=1; i < num; i++) {
					xn = parseInt(args.substr(i*4+2, 2), 36);
					yn = parseInt(args.substr(i*4+4, 2), 36);
					drawLine(xp, yp, xn, yn, glob.drawColor, glob.writeMode, glob.lineThick, glob.linePattern);
					xp = xn; yp = yn;
				}
			}
		},

		// RIP_FILL
		'F': function(args) {
			if ((args.length >= 6) && self.floodFill) {
				var x = parseInt(args.substr(0,2), 36);
				var y = parseInt(args.substr(2,2), 36);
				var border = parseInt(args.substr(4,2), 36);
				console.log('RIP_FILL: (' + x + ',' + y + ') color:' + glob.fillColor + ' border:' + border);  // TEST
				drawFloodFill(x, y, border, glob.fillColor, glob.fillPattern);
			}
		},

		// RIP_LINE_STYLE
		'=': function(args) {
			if (args.length >= 8) {
				var style = parseInt(args.substr(0,2), 36);
				//var style = 0;  // TEST
				glob.lineThick = parseInt(args.substr(6,2), 36);
				switch (style) {
					case 0: glob.linePattern = 0xFFFF; break;
					case 1: glob.linePattern = 0x3333; break;
					case 2: glob.linePattern = 0x1E3F; break;
					case 3: glob.linePattern = 0x1F1F; break;
					case 4: glob.linePattern = parseInt(args.substr(2,4), 36);
				}
			}
		},

		// RIP_FILL_STYLE
		'S': function(args) {
			if (args.length >= 4) {
				var pat = parseInt(args.substr(0,2), 36);
				if (pat < fillPatterns.length) {
					glob.fillPattern = fillPatterns[pat];
				}
				glob.fillColor = parseInt(args.substr(2,2), 36);
			}
		},

		// RIP_FILL_PATTERN
		's': function(args) {
			if (args.length >= 18) {
				glob.fillPattern = [];
				for (var i=0; i < 8; i++) {
					glob.fillPattern.push( parseInt(args.substr(i*2, 2), 36) );
				}
				glob.fillColor = parseInt(args.substr(16,2), 36);
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
				var x0 = parseInt(args.substr(0,2), 36);
				var y0 = parseInt(args.substr(2,2), 36);
				var x1 = parseInt(args.substr(4,2), 36);
				var y1 = parseInt(args.substr(6,2), 36);
				// 1 byte reserved
				glob.clipboard = getImageClip(x0, y0, x1, y1);
				//console.log('RIP_GET_IMAGE: w:' + glob.clipboard.w + ', h:' + glob.clipboard.h);
				//console.log(glob.clipboard.img);
			}
		},

		// RIP_PUT_IMAGE
		'1P': function(args) {
			if (args.length >= 7) {
				var x0 = parseInt(args.substr(0,2), 36);
				var y0 = parseInt(args.substr(2,2), 36);
				var mode = parseInt(args.substr(4,2), 36);
				// 1 byte reserved
				if (glob.clipboard) {
					putImageClip(x0, y0, glob.clipboard, mode)
					//console.log('RIP_PUT_IMAGE: x0:' + x0 + ' y0:' + y0 + ' mode:' + mode);
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
	}

	self.clear = function() {
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			cBuf.fill(0);
		}
		if (svg) {
			svg.innerHTML = "";
		}
	}

	self.reset = function() {
		if (self.debugVerbose) { console.log('RESET'); }
		self.cmd['*']();
		cmdi = 0;
		if (self.counterId) { counterDiv.innerHTML = cmdi + ' / ' + ripData.length; }
	}

	self.start = function() {
		if (self.debugVerbose) { console.log('START'); }
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
			updateCanvas();
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
		if (self.debugVerbose) { console.log('STOP'); }
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
			self.clear();
			resetGlob();
		}
		else {
			// exiting fullscreen
			fullmode = false;
			// restore canvas
			canvas.style.width = bu.width;
			canvas.style.height = bu.height;
			self.clear();
			resetGlob();
		}
		self.start();
	}

	// constructor
	self.init(self.canvasId, self.svgId);
	return self;
}
