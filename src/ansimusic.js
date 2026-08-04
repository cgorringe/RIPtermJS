/**
 * ANSImusic - Version 0.4
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
/*
 * This class is loosely modeled after these QBasic language commands,
 * and which PLAY strings are also used in ANSI Music Escape Sequences.
 *
 *   BEEP
 *   SOUND freq, duration
 *   PLAY "string"
 *   ON PLAY(n) GOSUB line - branches when < n notes left in buffer.
 *   PLAY ON - enables play event trapping.
 *   PLAY OFF - disables play event trapping.
 *   PLAY STOP - suspends play event trapping.
 *   PLAY(0) - returns notes left in background buffer.
 */

class ANSImusic {

  constructor () {

    this.actx = null;
    this.tempo = 120;
    this.octave = 4;
    this.volume = 0.25;
    this.lengthDen = 4;
    this.percentSound = 0.875; // 7/8 normal
    this.percentPause = 0.125; // 1/8 normal
    this.isPlaying = false;
    this.isBackground = false;
    this.queue = Promise.resolve();
    this.noteCounter = 0;
  }

  /**
   * Initialize audio.
   * Call this once within a click handler to work in Safari.
   * @returns {boolean} true on success, false on failure.
   */
  init () {

    if (!this.actx) {
      // init audio context only once
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return false }
      this.actx = new AC();
    }
    return true;
  }

  /**
   * Beep sound that plays for ASCII 7 (BEL).
   */
  async beep () {
    await this.sound(1000, 75);
    await this.sound(0, 75);
  }

  /**
   * Plays a sound.
   * @param {number} duration - in milliseconds.
   * @param {number} freq - 0 means to pause or rest.
   * @param {number} volume - (optional) value representing 0 to 100% (0.0 - 1.0)
   */
  async sound (freq, duration, volume = this.volume) {

    if (this.actx && (freq > 0) && (volume > 0)) {
      const osc = this.actx.createOscillator();
      const gainNode = this.actx.createGain();
      const t0 = this.actx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t0);
      osc.connect(gainNode);
      gainNode.connect(this.actx.destination);
      gainNode.gain.setValueAtTime(volume * 0.20, t0);
      osc.start(t0);
      osc.stop(t0 + duration/1000);
      this.checkOnPlay();
      return new Promise(res => setTimeout(res, duration));
    }
    else {
      // pause or rest
      return new Promise(res => setTimeout(res, duration));
    }
  }

  /**
   * Calculates the frequency of given noteNum (0-11) and octave (0-6)
   * @param {number} noteNum
   */
  noteFreq (noteNum, octave) {

    // Frequency of C note for octaves 0-6:
    // 65406, 130810, 261620, 523250, 1046500, 2093000, 4186000
    // TODO: make use of these numbers?

    const n = noteNum + (octave + 1) * 12;
    return Math.round(440 * Math.pow(2, (n - 69) / 12));
  }

  /**
   * Calculates 2 duration values in milliseconds, based on current tempo.
   * @returns [ sound_ms, rest_ms ]
   */
  noteDuration (noteLen) {
    const ms = (4 / noteLen) * (60000 / this.tempo);
    return [ ms * this.percentSound, ms * this.percentPause ];
  }

  /*
    PLAY string format:

      Tnnn = Tempo bpm or quarter notes per minute [32-255] default=120 (e.g. "T120")
      On = Octave [0-6] (e.g. "O4"), default=4, middle-C is on O3.
      >  = increase octave
      <  = decrease octave

      An-Gn = note (begins at C at current octave) (e.g. "F" or "F4")
              (n = optional note length as 1/n)
      Pn = Pause (rest) (e.g. "P4") [1-64] 1=whole note, 2=half note, etc.
      Nn = Note by Number [0-84 or 71?], 0=rest
           (other docs say that 0 = C in Octave 0)

      # or + = sharp (e.g. "F#4")
      -  = flat (e.g. "F-4")
      .  = dotted note (extends duration by 3/2) (e.g. "F#4.")
           (multiple dots allowed, i.e. 2 dots = 9/4 * note length)

      Ln = Default note Length for following notes as 1/n (1-64)
      MN = Normal   - plays 7/8 then 1/8 delay
      ML = Legato   - plays full period
      MS = Staccato - plays 3/4 then 1/4 delay

      MF = Music plays in Foregrond
      MB = Music plays in Background

    Not Supported:
    
      Xvarname; - where 'varname' is a variable in BASICA.
                  QBasic uses: PLAY "X" + VARPTR$(varname$)
      =varname; - used in place of a number.

    Frequency of C note for octaves 0-6:
    65406, 130810, 261620, 523250, 1046500, 2093000, 4186000
  */

  /**
   * Plays a sequence of notes based on the play string.
   * @param {notes} string - conforms to BASIC PLAY formatting.
   *        Include 'MF' or 'MB' in string to switch to foreground or background play.
   *        'MF' awaits until all notes & rests are played.
   *        'MB' adds notes & rests to a queue to continue playing while returning to caller.
   */
  async play (notes) {

    notes = notes.toUpperCase();
    console.log(`notes: ${notes}`); // DEBUG
    if (!this.actx) {
      console.err("ANSImusic: play() not ready");
      return;
    }

    // using a regex to parse play string
    const re = /([A-G]|L|MB|MF|ML|MN|MS|N|O|P|T|>|<)(#|\+|-)?(\d*)(\.*)/g;

    const baseNotes = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
    let note;
    this.isPlaying = true;

    while ((note = re.exec(notes)) && this.isPlaying) {
      console.log(note); // DEBUG

      // capture group 4 (dots)
      const dotNum = Math.max(0, Math.min(note[4].length, 4)); // clip dots allowed (0-4)
      const dotExtend = (note[4].length > 0) ? Math.pow(1.5, dotNum) : 1.0; // 3/2 per dot

      // capture group 3 (number)
      const num = parseInt(note[3], 10) || 0; // always a number

      // capture group 2 (sharp or flat)
      const semiOffset = ((note[2] === '#') || (note[2] === '+')) ? 1 : ((note[2] === '-') ? -1 : 0)

      // capture group 1 (letter)
      let noteBase, noteDen, sound_ms, rest_ms, freq;
      switch (note[1]) {
        case 'L': // note length
          if (num > 0) { this.lengthDen = Math.max(1, Math.min(num, 64)); }
          break;

        case 'MB': // play in background
          this.isBackground = true;
          break;

        case 'MF': // play in foreground
          this.isBackground = false;
          break;

        case 'ML': // legato (full)
          this.percentSound = 1.0;
          this.percentPause = 0;
          break;

        case 'MN': // normal (7/8 sound + 1/8 rest)
          this.percentSound = 0.875;
          this.percentPause = 0.125;
          break;

        case 'MS': // staccato (3/4 sound + 1/4 rest)
          this.percentSound = 0.75;
          this.percentPause = 0.25;
          break;

        case 'N': // play note (TODO: needs testing!)
          noteBase = Math.max(0, Math.min(num, 84));
          noteDen = this.lengthDen;
          [sound_ms, rest_ms] = this.noteDuration(noteDen);
          freq = this.noteFreq(noteBase, 0); // doesn't use octave
          if (this.isBackground) {
            // add note to background queue
            this.queue = this.queue.then(() => this.sound(freq, sound_ms * dotExtend));
            if (rest_ms > 0) { this.queue = this.queue.then(() => this.sound(0, rest_ms * dotExtend)); }
          }
          else {
            // play note in foreground
            await this.sound(freq, sound_ms * dotExtend);
            if (rest_ms > 0) { await this.sound(0, rest_ms * dotExtend); }
          }
          break;

        case 'O': // octave
          this.octave = Math.max(0, Math.min(num, 6));
          break;

        case 'P': // pause (rest)
          noteDen = (num > 0) ? Math.max(1, Math.min(num, 64)) : this.lengthDen;
          [sound_ms, rest_ms] = this.noteDuration(noteDen);
          if (this.isBackground) {
            this.queue = this.queue.then(() => this.sound(0, (sound_ms + rest_ms) * dotExtend));
          }
          else {
            await this.sound(0, (sound_ms + rest_ms) * dotExtend);
          }
          break;

        case 'T': // tempo
          this.tempo = Math.max(32, Math.min(num, 255));
          break;

        case '>': // increment octave
          if (this.octave < 6) { this.octave += 1; }
          break;

        case '<': // decrement octave
          if (this.octave > 0) { this.octave -= 1; }
          break;

        default: // play note A-G
          if (note[1] in baseNotes) {
            noteBase = baseNotes[note[1]] + semiOffset;
            noteDen = (num > 0) ? Math.max(1, Math.min(num, 64)) : this.lengthDen;
            [sound_ms, rest_ms] = this.noteDuration(noteDen);
            freq = this.noteFreq(noteBase, this.octave);
            if (this.isBackground) {
              // add note to background queue
              this.queue = this.queue.then(() => this.sound(freq, sound_ms * dotExtend));
              if (rest_ms > 0) { this.queue = this.queue.then(() => this.sound(0, rest_ms * dotExtend)); }
            }
            else {
              // play note in foreground
              await this.sound(freq, sound_ms * dotExtend);
              if (rest_ms > 0) { await this.sound(0, rest_ms * dotExtend); }
            }
          }
      }
    }
    this.isPlaying = false;
  }

  /**
   * Waits until 'num' notes are played, then calls resolve().
   * Set num=0 to deactivate any previous calls.
   * There can only be one active onPlay event at a time.
   * Calls override previous calls still waiting.
  */
  onPlay (num, resolve) {
    if (num <= 0) {
      // reset
      this.noteCounter = 0;
      this.onPlayResolve = null;
    }
    else if (typeof resolve === "function") {
      this.noteCounter = num;
      this.onPlayResolve = resolve;
    }
  }

  /**
   * Called after every note played to handle while onPlay() is active.
  */
  checkOnPlay () {
    if (this.noteCounter > 0) {
      this.noteCounter -= 1;
      if ((this.noteCounter === 0) && (typeof this.onPlayResolve === "function")) {
        this.onPlayResolve();
        this.onPlayResolve = null;
      }
    }
  }

  /**
   * Stops any music still playing.
  */
  stop () {
    this.isPlaying = false;
    this.onPlay(0);
  }

}
