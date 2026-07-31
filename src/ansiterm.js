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

  ////////////////////////////////////////////////////////////////////////////////
  // Contructor & init methods

  constructor (args) {

    // log callback function
    if (args && ('log' in args)) {
      this.onLog = args.log;
    }

    if (typeof BGI === 'undefined') {
      this.log('err', 'BGI() missing! Need to load BGI.js!');
    }

    if (args && ('bgi' in args)) {
      this.bgi = args.bgi;
    }
    else {
      this.log('err', "ANSIterm() missing bgi!");
    }

    // ANSI music player
    // called once from any user interaction (audio fix for Safari)
    this.audio = null;
    document.addEventListener('click', (e) => { this.initAudio() }, { once: true });

    /*
      // init default options
      this.opts = {
      };

      // assign or overwrite opts with passed-in options
      Object.entries(args).forEach( ([k, v]) => { this.opts[k] = v } );
    */

    // init vars
    this.udTextDecoder = new TextDecoder("x-user-defined");
    this.fgColor = BGI.WHITE; // 15
    this.bgColor = BGI.BLACK; // 0
    this.cursorColor = BGI.WHITE;
    this.textWindow = { x: 0, y: 0, width: 0, height: 0, wordWrap: false, fontnum: 0, 
      textX: 0, textY: 0, textW: 0, textH: 0, fontW: 8, fontH: 8, enabled: false };

    // cursor related
    this.cp = { row: 1, col: 1, enabled: false };
    this.cursorOn = false;
    this.blinkTimer = null;
    this.blinkInterval = 500; // in milliseconds

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

  /**
   * Initialize audio.
   * Call this once within a click handler to work in Safari.
   */
  initAudio (aud) {
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
        if (this.audio.init()) {
          this.log('trm', 'ANSIterm audio initialized');
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
      if ('row' in cursor) { this.cp.row = cursor.row }
      if ('col' in cursor) { this.cp.col = cursor.col }
      if ('enabled' in cursor) {
        this.cp.enabled = cursor.enabled;
        if (cursor.enabled) { this.showCursor() }
      }
    }
    return this.cp;
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
        this.log('ans', "erase text window"); // DEBUG
        const x1 = tw.x, y1 = tw.y;
        const x2 = tw.x + tw.width - 1;
        const y2 = tw.y + tw.height - 1;
        const bgc = this.bgi.getbkcolor();
        this.bgi._bar(x1, y1, x2, y2, bgc, BGI.COPY_PUT, BGI.SOLID_FILL);
        this.bgi.update();
      }
    }
  }

  // Callback function for onOutputText(). [see usage notes]
  // Displays text in the text window, including parsing ANSI escape sequences.
  // text is a JS UTF-16 String.
  //
  async outputText (text) {

    //this.log('ans', "outputText()"); // DEBUG
    if (typeof text !== "string") { return }
    const tw = this.textWindow;
    //this.log('ans', `textWindow: ${JSON.stringify(tw)}`); // DEBUG
    if (!tw.enabled) { return }
    this.hideCursor();

    // vars
    let x, y;
    const outer = this;
    const tw_width = tw.x + tw.width;
    const tw_height = tw.y + tw.height;
    const tempColor = this.bgi.getcolor();
    this.bgi.setcolor(this.fgColor);
    //this.log('ans', `tw_width:${tw_width} tw_height:${tw_height}`); // DEBUG: REMOVE

    // converts buf array to string to play in ANSI music player.
    async function sendToMusic (buf) {
      if (buf && (buf.length > 0)) {
        const mtext = outer.udTextDecoder.decode(new Uint8Array(buf));
        outer.log('ans', `play: ${mtext}`); // DEBUG
        if (outer.audio) { await outer.audio.play(mtext); }
      }
    }

    // states
    const ST_TEXT=1, ST_ESC=2, ST_CSI=3, ST_MUSIC=4;
    let state = ST_TEXT;
    let ansiBuf = [];

    // ASCII values:
    // 10=LF, 13=CR, 27=ESC, 91=[, 124=|

    // ANSI text state machine
    async function nextByte (byte) {

      switch (state) {
      case ST_TEXT:
        // TODO: finish
        if      (byte === 0x0A) { outer.cp.row += 1; } // LF
        else if (byte === 0x0C) { }                    // FF (TODO: ignore?)
        else if (byte === 0x0D) { outer.cp.col = 1;  } // CR
        else if (byte === 0x1B) { state = ST_ESC; }    // ESC
        else if (byte === 0x07) { if (outer.audio) { await outer.audio.beep(); }} // BEL
        else {
          if ((x < tw_width) && (y < tw_height)) {

            // TODO: draw a bgcolor rectangle prior to drawing text (ignoring viewport)
            // FIXME: this will update bgi's internal info.cp values, which may need to be restored.
            // FIXME: draws using graphics viewport (which shouldn't be done)
            // FIXME: draws using bgi fgColor and write modes.

            outer.bgi.drawPNGChar(byte, tw.fontnum, 1, BGI.HORIZ_DIR, x, y);
            //outer.log('ans', `byte:${byte} fontnum:${tw.fontnum} x:${x} y:${y}`); // DEBUG
          }
          outer.cp.col += 1;
        }
        ansiBuf.length = 0;
        break;

      case ST_ESC:
        // TODO: finish
        if      (byte === 0x0A) { outer.cp.row += 1; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1;  } // CR
        else if (byte === 0x1B) { ansiBuf.length = 0; state = ST_ESC; } // ESC
        else if (byte === 0x5B) { ansiBuf.push(byte); state = ST_CSI; } // [
        else { ansiBuf.push(byte); }
        break;

      case ST_CSI:
        // TODO: finish
        if      (byte === 0x0A) { outer.cp.row += 1; state = ST_TEXT; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1; state = ST_TEXT;  } // CR
        else if (byte === 0x1B) { ansiBuf.length = 0; state = ST_ESC; } // ESC
        else if ((byte === 0x4D) || (byte === 0x6D)) { // M or m
          // ANSI Music (include 'M' byte prefix)
          ansiBuf.length = 0;
          ansiBuf.push(byte);
          state = ST_MUSIC;
        }
        else if ((byte === 0x7C) || (byte === 0x4E) || (byte === 0x6E)) { // | or N or n
          // ANSI Music (less common)
          ansiBuf.length = 0;
          state = ST_MUSIC;
        }
        else { ansiBuf.push(byte); }
        break;

      case ST_MUSIC:
        if      (byte === 0x0A) { outer.cp.row += 1; state = ST_TEXT; } // LF
        else if (byte === 0x0D) { outer.cp.col = 1; state = ST_TEXT;  } // CR
        else if (byte === 0x1B) { ansiBuf.length = 0; state = ST_ESC; } // ESC
        else if (byte === 0x0E) { // SO
          // end of music
          await sendToMusic(ansiBuf);
          ansiBuf.length = 0;
          state = ST_TEXT;
        }
        else { ansiBuf.push(byte); }
        break;

      }
    }

    // loop thru each character in text string
    const chars = text.split('');
    for (let c of chars) {

      const cvalue = c.charCodeAt(0) & 0xFF; // to strip out 2nd byte
      x = tw.x + ((this.cp.col - 1) * tw.fontW);
      y = tw.y + ((this.cp.row - 1) * tw.fontH);

      await nextByte(cvalue);

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

    } // next c

    //this.log('ans', "next"); // DEBUG: REMOVE
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

}

////////////////////////////////////////////////////////////////////////////////
