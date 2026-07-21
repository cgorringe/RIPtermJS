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

    // init other vars
    this.cp = { row: 1, col: 1, enabled: false };
    this.fgcolor = 15;
    this.bgcolor = 0;
    this.textWindow = { x: 0, y: 0, width: 0, height: 0, wordWrap: false, fontnum: 0, 
      textX: 0, textY: 0, textW: 0, textH: 0, fontW: 8, fontH: 8, enabled: false };

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

  // Set and Retrive the text cursor and update the visible cursor.
  // cursor is an object with zero or more keys to set:
  // { row, col, enabled } where row & col are 1-based.
  // An object with all keys are returned with the currently set values.
  //
  textCursor (cursor) {

    if (typeof cursor === "object") {
      if ('row' in cursor) { this.cp.row = cursor.row }
      if ('col' in cursor) { this.cp.col = cursor.col }
      if ('enabled' in cursor) { this.cp.enabled = cursor.enabled }
    }

    // TODO: update visible cursor

    return this.cp;
  }

  setTextWindow (tw, options) {

    // assign or overwrite with passed-in textWindow
    if (typeof tw === "object") {
      Object.entries(tw).forEach( ([k, v]) => { this.textWindow[k] = v } );
    }

    if (typeof options === "object") {
      if (options.clear == true) {
        // TODO: clear text window
        this.log('ans', "clear text window (TODO)"); // DEBUG
      }
    }

  }

  // DRAFT FUNCTION in progress
  outputText (text) {

    //this.log('ans', "outputText()"); // DEBUG

    if (typeof text !== "string") { return }
    const tw = this.textWindow;
    //this.log('ans', `textWindow: ${JSON.stringify(tw)}`); // DEBUG

    if (!tw.enabled) { return }

    const tw_width = tw.x + tw.width;
    const tw_height = tw.y + tw.height;
    const bak_fgcolor = this.bgi.getcolor();
    this.bgi.setcolor(this.fgcolor);

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
          // FIXME: draws using bgi fgcolor and write modes.

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
      if (this.row >= tw.textH) {
        // TODO
      }

    });

    this.bgi.setcolor(bak_fgcolor); // restore fgcolor
    this.bgi.refresh();
  }

}

////////////////////////////////////////////////////////////////////////////////
