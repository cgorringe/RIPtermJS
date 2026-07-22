/**
 * ANSIterm - Version 0.4
 * Copyright (c) 2011-2026 Carl Gorringe
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

    if (args && ('bgi' in args)) {
      this.bgi = args.bgi;
      // this.bgi.refresh(); // TO MOVE
    }
    else {
      this.log('err', "ANSIterm() missing bgi!");
    }

    /*
      // init default options
      this.opts = {
      };

      // assign or overwrite opts with passed-in options
      Object.entries(args).forEach( ([k, v]) => { this.opts[k] = v } );
    */

    // init vars
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
  }

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
      this.bgi.refresh();
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
      this.bgi.refresh();
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
      const x2 = x1 + tw.fontW;
      const y2 = y1 + tw.fontH;
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
      if (options.clear == true) {
        // TODO: clear text window
        this.log('ans', "erase text window (TODO)"); // DEBUG
      }
    }
  }

  // Callback function for onOutputText(). [see usage notes]
  // Displays text in the text window, including parsing ANSI escape sequences.
  // text is a JS UTF-16 String.
  //
  outputText (text) {

    //this.log('ans', "outputText()"); // DEBUG
    if (typeof text !== "string") { return }
    const tw = this.textWindow;
    //this.log('ans', `textWindow: ${JSON.stringify(tw)}`); // DEBUG
    if (!tw.enabled) { return }
    this.hideCursor();

    const tw_width = tw.x + tw.width;
    const tw_height = tw.y + tw.height;
    const tempColor = this.bgi.getcolor();
    this.bgi.setcolor(this.fgColor);

    // TODO: draw a bgcolor rectangle prior to drawing text (ignoring viewport)

    // loop thru each character in text string
    text.split('').forEach(c => {

      const cvalue = c.charCodeAt(0) & 0xFF; // to strip out 2nd byte
      const x = tw.x + ((this.cp.col - 1) * tw.fontW);
      const y = tw.y + ((this.cp.row - 1) * tw.fontH);

      // handle control chars and printable chars
      if (cvalue === 13) { // CR
        this.cp.col = 1;
      }
      else if (cvalue === 10) { // LF
        this.cp.row += 1;
      }
      else {
        // draw char only if inside text window
        //this.log(`ans`, `cvalue: ${cvalue}, x: ${x}, y: ${y}`); // DEBUG
        if ((x < tw_width) && (y < tw_height)) {

          // FIXME: this will update bgi's internal info.cp values, which may need to be restored.
          // FIXME: draws using graphics viewport (which shouldn't be done)
          // FIXME: draws using bgi fgColor and write modes.

          this.bgi.drawPNGChar(cvalue, tw.fontnum, 1, BGI.HORIZ_DIR, x, y);
        }
        this.cp.col += 1;
      }

      // word wrap
      if (tw.wordWrap && (this.cp.col >= tw.textW)) {
        this.cp.col = 1;
        this.cp.row += 1;
      }

      // scroll up
      if (this.cp.row >= tw.textH) {
        // TODO
      }

    });

    this.bgi.setcolor(tempColor); // restore fgColor
    this.bgi.refresh();
  }

}

////////////////////////////////////////////////////////////////////////////////
