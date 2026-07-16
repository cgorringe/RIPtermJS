
// TEST function

function testBGI (args) {

  if (!(args && ('canvasId' in args))) {
    console.error('missing canvasId!');
    return;
  }

  const canvas = document.getElementById(args.canvasId);
  const ctx = canvas.getContext('2d');
  const bgi = new BGI({ ctx, fontsPath:'fonts' });

  // drawing test
  bgi.setcolor(BGI.YELLOW);
  bgi.line(10, 10, 100, 100);

  bgi.setcolor(BGI.LIGHTRED);
  bgi.circle(100, 100, 50);

  bgi.setcolor(BGI.LIGHTBLUE);
  bgi.setfillstyle(BGI.SLASH_FILL, BGI.BLUE);
  bgi.bar3d(200, 200, 300, 300, 20, true);

  bgi.refresh();

  // TEST Fonts
/*
  const fontname = 'BOLD.CHR';
  bgi.fetchCHRFont(fontname);

  // add delay so font can load
  setTimeout(() => {
    console.log('Starting to draw font...');

    bgi.setcolor(BGI.LIGHTGREEN);
    bgi.moveto(150, 150);

    bgi.drawChar(32, fontname, 1, 0); // 32=space
    bgi.drawChar(33, fontname, 1, 0); // 33='!'
    bgi.drawChar(35, fontname, 1, 0); // 35='#' (bug)
    bgi.drawChar(65, fontname, 2, 0); // 65='A'
    bgi.drawChar(66, fontname, 3, 0); // 66='B'
    bgi.drawChar(67, fontname, 4, 0); // 67='C'
    bgi.drawChar(68, fontname, 5, 0); // 68='D'
    bgi.drawChar(69, fontname, 6, 0); // 69='E'

    bgi.refresh();

  }, 1000);
*/
/*
  // TEST Bitmap Fonts
  bgi.fetchPNGFont ('8x8.png', 0, 8, 8);
  bgi.fetchPNGFont ('8x14.png', 2, 8, 14);
  // add delay so font can load
  setTimeout(() => {
    console.log(bgi.bitfonts); // DEBUG
  }, 1000);
*/

}
