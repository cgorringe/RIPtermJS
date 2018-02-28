/**
 * chrfont.js
 * Copyright (c) 2018 Carl Gorringe 
 * http://carl.gorringe.org
 * 2/27/2018
 *
 * Read and draw .CHR Font Files
 **/
/** NOT DONE **/

function CHRfontJS (self) {
	'use strict';

	// public defaults
	if (typeof self === 'undefined') self = {};
	if (!('path'  in self)) self.fontsPath = 'fonts';
	if (!('files' in self)) {
		self.files = [ /* '8x8.png', */ 'TRIP.CHR', 'LITT.CHR', 'SANS.CHR', 'GOTH.CHR', 
			'SCRI.CHR', 'SIMP.CHR', 'TSCR.CHR', 'LCOM.CHR', 'EURO.CHR', 'BOLD.CHR'];
	}


	// constructor
	return self;
}