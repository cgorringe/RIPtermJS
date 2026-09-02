/**
 * ANSIterm - Version 0.4
 * Copyright (c) 2026 Carl Gorringe
 * https://carl.gorringe.org
 * https://github.com/cgorringe/RIPtermJS
 * 
 **/

/**
 * This Source Code is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 **/

////////////////////////////////////////////////////////////////////////////////

class ANSIterm {

  // Contructor & init methods

  constructor (args) {

    // init default options
    this.opts = {
      'musicOn'       : true,   // set true to play ANSI music.
      'audioOn'       : true,   // set true to play BEL (ASCII 0x07), false disables ALL audio.
      'audioVolume'   : 0.50,   // set audio volume (0.0-1.0), 0 = pause instead of audio.
      'fgColor'       : 15,     // default white
      'bgColor'       : 0,      // default black
      'cursorColor'   : 15,     // default white
    };

    // assign or overwrite opts with passed-in options
    Object.entries(args).forEach( ([k, v]) => { this.opts[k] = v } );

    // log callback function
    if (args && ('log' in args)) {
      this.onLog = args.log;
    }

    if (typeof BGI === 'undefined') {
      this.log('err', 'BGI() missing! Need to load BGI.js!');
    }

    if (args && ('bgi' in args) && (args.bgi instanceof BGI)) {
      this.bgi = args.bgi;
    }
    else {
      this.log('err', "ANSIterm() missing bgi!");
    }

    // init vars
    this.udTextDecoder = new TextDecoder("x-user-defined");
    this.resetVars();
    this.cursorColor = this.opts.cursorColor;
    this.textWindow = { x: 0, y: 0, width: 0, height: 0, wordWrap: true, fontnum: 0,
      textX: 0, textY: 0, textW: 0, textH: 0, fontW: 8, fontH: 8, enabled: false };

    // cursor related
    this.cp = { row: 1, col: 1, enabled: false };
    this.cpSaved = structuredClone(this.cp);
    this.cursorOn = false;
    this.blinkTimer = null;
    this.blinkInterval = 500; // in milliseconds

    // ANSI music player
    this.audio = null;
    this.audioOn = this.opts.audioOn;
    this.musicOn = this.opts.musicOn;
    if (this.audioOn) {
      // called once from any user interaction (audio fix for Safari)
      document.addEventListener('click', (e) => { this.initAudio() }, { once: true });
    }

  } // end constructor

  // sends msg to provided log function, else send to console if none provided.
  log (type, msg) {
    if (typeof this.onLog === "function") {
      this.onLog(type, msg);
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


  // vars to reset after 'reset' option passed to setTextWindow().
  resetVars () {
    this.state = 1; // ST_TEXT
    this.ansiBuf = [];
    this.fgColor = this.opts.fgColor;
    this.bgColor = this.opts.bgColor;
    this.fgBold = 0;
    this.bgBold = 0;
    this.isBlinkToBright = false;
    this.sauce = {}; // SAUCE meta-data
    this.comnt = ""; // SAUCE comments
  }

  /**
   * Initialize audio.
   * Call this once within a click handler to work in Safari.
   */
  initAudio (aud) {
    if (this.audioOn === false) { return false; }
    if (typeof ANSImusic === 'undefined') {
      this.audio = null;
      this.log('err', 'ANSImusic() missing! Need to load ansimusic.js!');
      return false;
    }
    else {
      if (aud && (aud instanceof ANSImusic)) { this.audio = aud; }
      if (this.audio instanceof ANSImusic) {
        if (this.audio.init() === false) {
          this.log('err', 'ANSIterm audio failed to initialize!');
          return false;
        }
      }
      else {
        this.audio = new ANSImusic();
        this.audio.volume = this.opts.audioVolume;
        if (this.audio.init()) {
          this.log('trm', `ANSIterm audio initialized (volume: ${this.audio.volume})`);
        }
        else {
          this.log('err', 'ANSIterm audio failed to initialize!');
          return false;
        }
      }
    }
    return true;
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Cursor methods

  // Callback function for onTextCursor(). [see usage notes]
  // Set and Retrive the text cursor and update the visible cursor.
  // cursor is an object with zero or more keys to set:
  // { row, col, enabled } where row & col are 1-based.
  // Returns: An object of all keys and currently set values.
  //
  textCursor (cursor) {

    this.hideCursor();
    // move cursor or enabled status
    if (typeof cursor === "object") {
      if ('row' in cursor) { this.moveCursor({ row: cursor.row }) }
      if ('col' in cursor) { this.moveCursor({ col: cursor.col }) }
      if ('enabled' in cursor) {
        this.cp.enabled = cursor.enabled ? true : false;
        if (cursor.enabled) { this.showCursor() }
      }
    }
    return this.cp;
  }

  // row and col are 1-based
  moveCursor ({ row, col }) {
    if (typeof row === "number") {
      this.cp.row = Math.max(1, row);
    }
    if (typeof col === "number") {
      this.cp.col = Math.max(1, col);
    }
  }

  // Show visible cursor.
  showCursor () {
    if (this.cp.enabled && !this.blinkTimer) {
      this.toggleCursor();
    }
  }

  // Erase given cursor.
  hideCursor (cursor = this.cp) {
    if (this.cursorOn) {
      this.drawCursorXOR(cursor);
      this.cursorOn = false;
      this.bgi.update();
    }
    // TODO: Is there a race condition between cleared cursor and call to toggleCursor()?
    // I haven't seen any cases occurring if this were a bug.
  }

  // Draws or erase cursor and setup blink timer.
  toggleCursor () {

    // display cursor
    if (this.cp.enabled || this.cursorOn) {
      this.drawCursorXOR(this.cp);
      this.cursorOn = !this.cursorOn;
      this.bgi.update();
    }
    // stop blinking
    if (this.blinkTimer) {
      window.clearTimeout(this.blinkTimer); this.blinkTimer = null;
    }
    // start blinking
    if (this.cp.enabled) {
      this.blinkTimer = window.setTimeout(() => { this.toggleCursor() }, this.blinkInterval);
    }
  }

  // Draws cursor as a XOR block that fills character.
  drawCursorXOR (cursor) {

    const tw = this.textWindow;
    if (tw.enabled) {
      const x1 = tw.x + ((cursor.col - 1) * tw.fontW);
      const y1 = tw.y + ((cursor.row - 1) * tw.fontH);
      const x2 = x1 + tw.fontW - 1;
      const y2 = y1 + tw.fontH - 1;
      this.bgi._bar(x1, y1, x2, y2, this.cursorColor, BGI.XOR_PUT, BGI.SOLID_FILL);
    }
  }


  ////////////////////////////////////////////////////////////////////////////////
  // Text Window methods

  // Callback function for onTextWindow(). [see usage notes]
  // tw is the textWindow object:
  // { x, y, width, height, textX, textY, textW, textH, fontnum, fontW, fontH, wordWrap, enabled }
  // See usage notes for more info.
  //
  setTextWindow (tw, options) {

    this.hideCursor();
    // assign or overwrite with passed-in textWindow
    if (typeof tw === "object") {
      Object.entries(tw).forEach( ([k, v]) => { this.textWindow[k] = v } );
    }

    // perform options
    if (typeof options === "object") {
      if (options.clear) {
        // clear text window to current graphics background color
        //this.log('ans', "erase text window"); // DEBUG
        const x1 = this.textWindow.x, y1 = this.textWindow.y;
        const x2 = this.textWindow.x + this.textWindow.width - 1;
        const y2 = this.textWindow.y + this.textWindow.height - 1;
        const bgc = this.bgi.getbkcolor();
        this.bgi._bar(x1, y1, x2, y2, bgc, BGI.COPY_PUT, BGI.SOLID_FILL);
        this.bgi.update();
      }
      if (options.reset) {
        this.resetVars();
      }
    }
  }



  // Callback function for onOutputText(). [see usage notes]
  // Displays text in the text window, including parsing ANSI escape sequences.
  // text is a JS UTF-16 String.
  //
  async outputText (text) {

    if (typeof text !== "string") {
      console.log("outputText() text is not a string");
      return;
    }

    // convert UTF-16 string to Uint8Array
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xFF;
    }

    return this.outputBytes(bytes);
  }

  // Callback function for onOutputBytes(). [see usage notes]
  // Displays text in the text window, including parsing ANSI escape sequences.
  // bytes is an Uint8Array
  //
  async outputBytes (bytes) {

    if ((bytes instanceof Uint8Array) !== true) {
      console.log("outputBytes() bytes is not a Uint8Array");
      return;
    }
    const tw = this.textWindow;
    if (!tw.enabled) { return }
    this.hideCursor();

    // vars
    let x, y;
    const outer = this;
    const tw_width = tw.x + tw.width;
    const tw_height = tw.y + tw.height;
    const tempColor = this.bgi.getcolor();
    this.bgi.setcolor(this.fgColor);

    // converts buf array to string to play in ANSI music player.
    async function sendToMusic (buf) {
      if (buf && (buf.length > 0) && (outer.musicOn)) {
        const mtext = outer.udTextDecoder.decode(new Uint8Array(buf));
        outer.log('ans', `play: ${mtext}`); // DEBUG
        await outer.audio?.play?.(mtext);
      }
    }

    // states
    const ST_TEXT=1, ST_ESC=2, ST_CSI=3, ST_MUSIC=4, ST_EOF=5, ST_SAUCE=6, ST_COMNT=7;

    // ANSI text state machine
    async function nextByte (byte) {

      switch (outer.state) {
      case ST_TEXT:
        // TODO: finish
        if (byte === 0x1B) { outer.state = ST_ESC; }      // ESC
        else if (byte === 0x0A) { outer.cp.row += 1; }    // LF
        else if (byte === 0x0C) { }                       // FF (TODO: ignore?)
        else if (byte === 0x0D) { outer.cp.col = 1;  }    // CR
        else if (byte === 0x1A) { outer.state = ST_EOF; } // EOF
        else if ((byte === 0x07) && (outer.audioOn)) { await outer.audio?.beep?.(); } // BEL
        else {
          if ((x < tw_width) && (y < tw_height)) {

            // TODO: draw a bgcolor rectangle prior to drawing text (ignoring viewport)
            outer.bgi.setcolor(outer.bgColor);
            outer.bgi.drawPNGChar(0xDB, tw.fontnum, 1, BGI.HORIZ_DIR, x, y); // FIXME: temporary solution

            // FIXME: this will update bgi's internal info.cp values, which may need to be restored.
            // FIXME: draws using graphics viewport (which shouldn't be done)
            // FIXME: draws using bgi fgColor and write modes.

            outer.bgi.setcolor(outer.fgColor);
            outer.bgi.drawPNGChar(byte, tw.fontnum, 1, BGI.HORIZ_DIR, x, y);
            //outer.log('ans', `byte:${byte} fontnum:${tw.fontnum} x:${x} y:${y}`); // DEBUG
          }
          outer.cp.col += 1;
        }
        outer.ansiBuf.length = 0;
        break;

      case ST_ESC:
        // TODO: finish
        if      (byte === 0x0A) { outer.cp.row += 1; outer.state = ST_TEXT; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1; outer.state = ST_TEXT; } // CR
        else if (byte === 0x1B) { outer.ansiBuf.length = 0; }   // ESC
        else if (byte === 0x5B) { outer.state = ST_CSI; } // [
        else if ((byte >= 0x60) && (byte <= 0x7E)) { outer.ansiBuf.length = 0; outer.state = ST_TEXT; } // type Fs (skip)
        else { outer.ansiBuf.push(byte); }
        break;

      case ST_CSI:
        if      (byte === 0x0A) { outer.cp.row += 1; outer.state = ST_TEXT; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1; outer.state = ST_TEXT;  } // CR
        else if (byte === 0x1B) { outer.ansiBuf.length = 0; outer.state = ST_ESC; } // ESC
        else if (byte === 0x4D) { // M
          // ANSI Music (include 'M' byte prefix)
          outer.ansiBuf.length = 0;
          outer.ansiBuf.push(byte);
          outer.state = ST_MUSIC;
        }
        else if ((byte === 0x7C) || (byte === 0x4E) || (byte === 0x6E)) { // | or N or n
          // ANSI Music (less common)
          outer.ansiBuf.length = 0;
          outer.state = ST_MUSIC;
        }
        else if ((byte >= 0x40) && (byte <= 0x7E)) {
          // CSI Command
          outer.ansiBuf.push(byte);
          runCSI(outer.ansiBuf);
          outer.ansiBuf.length = 0;
          outer.state = ST_TEXT;
        }
        else { outer.ansiBuf.push(byte); }
        break;

      case ST_MUSIC:
        if      (byte === 0x0A) { outer.cp.row += 1; outer.state = ST_TEXT; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1; outer.state = ST_TEXT;  } // CR
        else if (byte === 0x1B) { outer.ansiBuf.length = 0; outer.state = ST_ESC; } // ESC
        else if (byte === 0x0E) { // SO
          // end of music
          await sendToMusic(outer.ansiBuf);
          outer.ansiBuf.length = 0;
          outer.state = ST_TEXT;
        }
        else { outer.ansiBuf.push(byte); }
        break;

      case ST_EOF:
        if (byte !== 0x00) { outer.ansiBuf.push(byte); } // skip NULs
        if ((outer.ansiBuf.length === 5) && ("SAUCE" === outer.udTextDecoder.decode(new Uint8Array(outer.ansiBuf)))) {
          // SAUCE record found
          outer.state = ST_SAUCE;
        }
        else if ((outer.ansiBuf.length === 5) && ("COMNT" === outer.udTextDecoder.decode(new Uint8Array(outer.ansiBuf)))) {
          // SAUCE COMNT record found
          outer.ansiBuf.length = 0;
          outer.state = ST_COMNT;
        }
        else if (outer.ansiBuf.length > 5) {
          outer.state = ST_TEXT;
        }
        break;

      case ST_SAUCE:
        // A SAUCE Record is 128 bytes (including "SAUCE") after an EOF (0x1A),
        // optionally preceded by Comment blocks after EOF. Usually just 1, but there may be more.

        outer.ansiBuf.push(byte);
        if (outer.ansiBuf.length >= 128) {
          outer.sauce = outer.parseSAUCE(new Uint8Array(outer.ansiBuf));
          const outSauce = JSON.stringify(outer.sauce).replaceAll('\\"', '\'').replaceAll('"', '').replaceAll(',', ', ');
          outer.log('ans', `SAUCE: ${outSauce}`);
          //if (outer.sauce.Comments) { outer.log('ans', `SAUCE comment: ${outer.comnt}`); }
          outer.ansiBuf.length = 0;
          outer.state = ST_TEXT;
        }
        break;

      case ST_COMNT:
        // A SAUCE Comment block begins with "COMNT" then 64 bytes for each line * number of lines
        // stored in the "Comments" field of the SAUCE record, which unfortunately comes after.
        // So this block is variable length up to 255 lines. (64 * 255 + 5 bytes)

        outer.ansiBuf.push(byte);
        if (outer.ansiBuf.length >= 64) {
          // store & append comment block
          const cmt1 = outer.comnt || "";
          const cmt2 = outer.udTextDecoder.decode(new Uint8Array(outer.ansiBuf));
          outer.comnt = cmt1 + cmt2;
          outer.log('ans', `SAUCE COMNT: ${cmt2}`);
          outer.ansiBuf.length = 0;
        }
        else if ((outer.ansiBuf.length === 5) && ("SAUCE" === outer.udTextDecoder.decode(new Uint8Array(outer.ansiBuf)))) {
          // SAUCE record found
          outer.state = ST_SAUCE;
        }
        break;

      default:
      }
    }

    // Run CSI command
    function runCSI (buf) {

      // format: ESC-[ (0x30-0x3F)* (0x20-0x2F)* (0x40-0x7E)
      const csiText = outer.udTextDecoder.decode(new Uint8Array(buf));
      const str = csiText.slice(0, -1);
      const cmd = csiText.slice(-1);
      // args usually numbers, but sometimes '?' so store args as strings
      const args = str.split(";");
      let n0, n1;

      switch (cmd) {
        case 'A': // cursor up (CUU)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ row: outer.cp.row - n0 });
          break;
        case 'B': // cursor down (CUD)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ row: outer.cp.row + n0 });
          break;
        case 'C': // cursor forward (CUF)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ col: outer.cp.col + n0 });
          break;
        case 'D': // cursor back (CUB)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ col: outer.cp.col - n0 });
          break;
        case 'E': // cursor next line (CNL)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ row: outer.cp.row + n0, col: 1 });
          break;
        case 'F': // cursor previous line (CPL)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ row: outer.cp.row - n0, col: 1 });
          break;
        case 'G': // cursor horizontal absolute (CHA)
          n0 = parseInt(args[0]) || 1;
          outer.moveCursor({ col: n0 });
          break;
        case 'H': // cursor position (CUP)
        case 'f': // horizontal vertical position (HVP)
          n0 = parseInt(args[0]) || 1;
          n1 = parseInt(args[1]) || 1;
          outer.moveCursor({ row: n0, col: n1 });
          break;
        case 'J': // erase in display (ED)
          if ((args[0] === '') || (args[0] === '0')) {
            // TODO: clear to end of screen
          }
          else if (args[0] === '1') {
            // TODO: clear to beginning of screen
          }
          else if ((args[0] === '2') || (args[0] === '3')) {
            // clear entire screen
            outer.setTextWindow(undefined, { clear: true });
            outer.moveCursor({ row:1, col:1 });
          }
          break;
        case 'K': // erase in line (EL)
          // TODO
          break;
        case 'S': // scroll up (SU)
          // TODO
          break;
        case 'T': // scroll down (SD)
          // TODO
          break;
        case 'h': // set extensions
          if (args[0] === "?33") { outer.isBlinkToBright = true; } // blink to bright background
          break;
        case 'l': // clear extensions
          if (args[0] === "?33") { outer.isBlinkToBright = false; } // blink normal
          break;
        case 'm': {
          // select graphic rendition (display attributes)
          let fg = outer.fgColor, bg = outer.bgColor, fgB = outer.fgBold, bgB = outer.bgBold;
          for (let a of args) {
            let ar = (a === '') ? 0 : parseInt(a);
            switch (ar) {
              case  0: fg = BGI.WHITE; bg = BGI.BLACK; fgB = 0; bgB = 0; break; // default / reset
              case  1: fgB = 8; break;  // bright bold
              case  2: fgB = 0; break;  // dim
              case  3: break;           // italic [not supported]
              case  4: break;           // underline [not supported]
              case  5:                  // slow blink (<150 per min) [not supported]
                if (outer.isBlinkToBright) { bgB = 8 }
                break;
              case  6:                  // rapid blink (150+ per min) [not supported]
                if (outer.isBlinkToBright) { bgB = 8 }
                break;
              case  7: break; // TODO   // negative image (reverse fg & bg)
              case  8: break;           // hide [not supported]
              case  9: break;           // strikeout [not supported]
            // cases 10-20 selecting fonts [not supported]
              case 21: fgB = 0; break;  // double underline or not bold
              case 22: fgB = 0; break;  // normal intensity
              case 23: break;           // not italic
              case 24: break;           // not underlined
              case 25:                  // not blinking
                if (outer.isBlinkToBright) { bgB = 0 }
                break;
              case 26: break;           // proportional spacing (not used)
              case 27: break; // TODO   // positive image (un-reverse fg & bg)
              case 28: break;           // unhide
              case 29: break;           // un-strikeout
            // foreground 3/4-bit colors
              case 30: fg = BGI.BLACK;      break;
              case 31: fg = BGI.RED;        break;
              case 32: fg = BGI.GREEN;      break;
              case 33: fg = BGI.BROWN;      break;
              case 34: fg = BGI.BLUE;       break;
              case 35: fg = BGI.MAGENTA;    break;
              case 36: fg = BGI.CYAN;       break;
              case 37: fg = BGI.LIGHTGRAY;  break;
              case 38:                      break; // 8/24-bit color [not supported]
              case 39: fg = BGI.WHITE;      break; // default foreground (white)
            // background 3/4-bit colors
              case 40: bg = BGI.BLACK;      break;
              case 41: bg = BGI.RED;        break;
              case 42: bg = BGI.GREEN;      break;
              case 43: bg = BGI.BROWN;      break;
              case 44: bg = BGI.BLUE;       break;
              case 45: bg = BGI.MAGENTA;    break;
              case 46: bg = BGI.CYAN;       break;
              case 47: bg = BGI.LIGHTGRAY;  break;
              case 48:                      break; // 8/24-bit color [not supported]
              case 49: bg = BGI.BLACK;      break; // default background (black)
            // case 50-75 not supported
            // no cases 76-89
            // non-standard foreground colors
              case 90: fg = BGI.DARKGRAY;   break;
              case 91: fg = BGI.LIGHTRED;   break;
              case 92: fg = BGI.LIGHTGREEN; break;
              case 93: fg = BGI.YELLOW;     break;
              case 94: fg = BGI.LIGHTBLUE;  break;
              case 95: fg = BGI.LIGHTMAGENTA; break;
              case 96: fg = BGI.LIGHTCYAN;  break;
              case 97: fg = BGI.WHITE;      break;
            // no cases 98-99
            // non-standard background colors
              case 100: bg = BGI.DARKGRAY;   break;
              case 101: bg = BGI.LIGHTRED;   break;
              case 102: bg = BGI.LIGHTGREEN; break;
              case 103: bg = BGI.YELLOW;     break;
              case 104: bg = BGI.LIGHTBLUE;  break;
              case 105: bg = BGI.LIGHTMAGENTA; break;
              case 106: bg = BGI.LIGHTCYAN;  break;
              case 107: bg = BGI.WHITE;      break;
              default:
            }
          }
          outer.fgColor = fg | fgB;
          outer.bgColor = bg | bgB;
          outer.fgBold = fgB;
          outer.bgBold = bgB;
          break;
        }
        case 'n': // "6n" device status report (DSR)
          // TODO: Send cursor position as "ESC[n;mR" where n is row, m is column.
          break;
        case 's': // save cursor position
          outer.cpSaved = structuredClone(outer.cp);
          break;
        case 'u': // restore cursor position
          outer.cp = structuredClone(outer.cpSaved);
          break;
        default:
          outer.log('ans', `unknown CSI: ${csiText}`); // DEBUG
      }
    }

    // loop thru each byte
    for (let b of bytes) {

      // x & y used in nextByte()
      x = tw.x + ((this.cp.col - 1) * tw.fontW);
      y = tw.y + ((this.cp.row - 1) * tw.fontH);
      await nextByte(b);

      // word wrap
      if (tw.wordWrap && (this.cp.col > tw.textW)) {
        this.cp.col = 1;
        this.cp.row += 1;
        this.bgi.update();
      }

      // scroll up
      if (this.cp.row > tw.textH) {
        this.cp.row = tw.textH;
        this.scrollUp(tw);
        this.bgi.update();
      }
    }

    this.bgi.setcolor(tempColor); // restore fgColor
    this.bgi.update();
  }


  // Scrolls up text window by 1 text line & clears last line using graphics bgcolor.
  // (see RIP_COPY_REGION in ripterm.)
  // TODO: should rewrite function in BGI to make more efficient.
  //
  scrollUp (tw) {

    const x1 = tw.x;
    const y1 = tw.y + tw.fontH;
    const x2 = tw.x + tw.width - 1;
    const y2 = tw.y + tw.height - 1;

    // copy and move region
    // TODO: currently uses viewport, which should be ignored.
    const img = this.bgi._getimage(x1, y1, x2, y2);
    this.bgi._putimage(x1, tw.y, img, BGI.COPY_PUT, {});

    // clear last line
    const bgc = this.bgi.getbkcolor();
    this.bgi._bar(x1, y2 - tw.fontH, x2, y2, bgc, BGI.COPY_PUT, BGI.SOLID_FILL);
  }

  // Parses a SAUCE record and returns an object with the parsed data.
  // bytes is a Uint8Array
  //
  parseSAUCE (bytes) {

    let ret = {};
    const view = new DataView(bytes.buffer);

    // strings are supposed to be space-padded, but some may be null-terminated.
    ret.ID       = this.udTextDecoder.decode(bytes.slice( 0,  5)).trim(); //  5 chars
    ret.Version  = this.udTextDecoder.decode(bytes.slice( 5,  7)).trim(); //  2 chars
    ret.Title    = this.udTextDecoder.decode(bytes.slice( 7, 42)).trim(); // 35 chars
    ret.Author   = this.udTextDecoder.decode(bytes.slice(42, 62)).trim(); // 20 chars
    ret.Group    = this.udTextDecoder.decode(bytes.slice(62, 82)).trim(); // 20 chars
    ret.Date     = this.udTextDecoder.decode(bytes.slice(82, 90)); // 8 chars "YYYYMMDD"
    ret.FileSize = view.getUint32(90, true); // true = little-endian
    ret.DataType = bytes[94];
    ret.FileType = bytes[95];
    ret.TInfo1   = view.getUint16(96, true);
    ret.TInfo2   = view.getUint16(98, true);
    ret.TInfo3   = view.getUint16(100, true);
    ret.TInfo4   = view.getUint16(102, true);
    ret.Comments = bytes[104];
    ret.TFlags   = bytes[105];
    // remove anything after a null in this Zstring
    ret.TInfoS   = this.udTextDecoder.decode(bytes.slice(106, 128)).replace(/\0.*$/, '').trim(); // 22 chars

    return ret;
  }

}

////////////////////////////////////////////////////////////////////////////////
