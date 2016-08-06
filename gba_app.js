var gba;
var runCommands = [];

try {
  gba = new GameBoyAdvance();
  gba.keypad.eatInput = true;
  gba.setLogger(function(error) {
    console.log(error);
    gba.pause();
    var screen = document.getElementById('screen');
    if (screen.getAttribute('class') == 'dead') {
      console.log('We appear to have crashed multiple times without reseting.');
      return;
    }
    var crash = document.createElement('img');
    crash.setAttribute('id', 'crash');
    crash.setAttribute('src', 'resources/crash.png');
    screen.parentElement.insertBefore(crash, screen);
    screen.setAttribute('class', 'dead');
  });
} catch (exception) {
  gba = null;
}

$(document).ready(function() {
  // Make canvas as big as possible
  var ratio = 1.5;
  if ($(window).width() > $(window).height()) {
    $('canvas').attr('width', $(window).width() * 2 / 3);
    $('canvas').attr('height', $(window).width() * 2 / 3 / ratio);
  } else {
    $('canvas').attr('width', $(window).width());
    $('canvas').attr('height', $(window).width() / ratio);
  }

  if (gba && FileReader) {
    var canvas = document.getElementById('screen');
    gba.setCanvas(canvas);

    gba.logLevel = gba.LOG_ERROR;
    // report fps
    // gba.reportFPS = function(fps) {
    //   var counter = document.getElementById('fps');
    //   counter.textContent = Math.floor(fps);
    // };

    loadRom('resources/bios.bin', function(bios) {
      gba.setBios(bios);
    });

    if (!gba.audio.context) {
      // Remove the sound box if sound isn't available
      var soundbox = document.getElementById('sound');
      soundbox.parentElement.removeChild(soundbox);
    }

    if (window.navigator.appName == 'Microsoft Internet Explorer') {
      // Remove the pixelated option if it doesn't work
      var pixelatedBox = document.getElementById('pixelated');
      pixelatedBox.parentElement.removeChild(pixelatedBox);
    }

    var rom = location.search.substr(location.search.indexOf('=') + 1);
    loadRom('roms/' + rom + '.gba', function (e) {
      gba.setRom(e);
      for (var i = 0; i < runCommands.length; ++i) {
        runCommands[i]();
      }
      runCommands = [];
      fadeOut('preload', 'ingame');
      fadeOut('instructions', null, true);
      gba.runStable();
    });

  } else {
    // Didn't work
  }
});

function fadeOut(id, nextId, kill) {
  var e = document.getElementById(id);
  var e2 = document.getElementById(nextId);
  if (!e) {
    return;
  }
  var removeSelf = function() {
    if (kill) {
      e.parentElement.removeChild(e);
    } else {
      e.setAttribute('class', 'dead');
      e.removeEventListener('webkitTransitionEnd', removeSelf);
      e.removeEventListener('oTransitionEnd', removeSelf);
      e.removeEventListener('transitionend', removeSelf);
    }
    if (e2) {
      e2.setAttribute('class', 'hidden');
      setTimeout(function() {
        e2.removeAttribute('class');
      }, 0);
    }
  }

  e.addEventListener('webkitTransitionEnd', removeSelf, false);
  e.addEventListener('oTransitionEnd', removeSelf, false);
  e.addEventListener('transitionend', removeSelf, false);
  e.setAttribute('class', 'hidden');
}

function run(file) {
  var dead = document.getElementById('loader');
  dead.value = '';
  var load = document.getElementById('select');
  load.textContent = 'Loading...';
  load.removeAttribute('onclick');
  var pause = document.getElementById('pause');
  pause.textContent = "PAUSE";
  gba.loadRomFromFile(file, function(result) {
    if (result) {
      for (var i = 0; i < runCommands.length; ++i) {
        runCommands[i]();
      }
      runCommands = [];
      fadeOut('preload', 'ingame');
      fadeOut('instructions', null, true);
      gba.runStable();
    } else {
      load.textContent = 'FAILED';
      setTimeout(function() {
        load.textContent = 'SELECT';
        load.onclick = function() {
          document.getElementById('loader').click();
        }
      }, 3000);
    }
  });
}

function reset() {
  gba.pause();
  gba.reset();
  var load = document.getElementById('select');
  load.textContent = 'SELECT';
  var crash = document.getElementById('crash');
  if (crash) {
    var context = gba.targetCanvas.getContext('2d');
    context.clearRect(0, 0, 480, 320);
    gba.video.drawCallback();
    crash.parentElement.removeChild(crash);
    var canvas = document.getElementById('screen');
    canvas.removeAttribute('class');
  } else {
    lcdFade(gba.context, gba.targetCanvas.getContext('2d'), gba.video.drawCallback);
  }
  load.onclick = function() {
    document.getElementById('loader').click();
  }
  fadeOut('ingame', 'preload');
}

function uploadSavedataPending(file) {
  runCommands.push(function() { gba.loadSavedataFromFile(file) });
}

function togglePause() {
  var e = document.getElementById('pause');
  if (gba.paused) {
    gba.runStable();
    e.textContent = "PAUSE";
  } else {
    gba.pause();
    e.textContent = "UNPAUSE";
  }
}

function screenshot() {
  var canvas = gba.indirectCanvas;
  window.open(canvas.toDataURL('image/png'), 'screenshot');
}

function lcdFade(context, target, callback) {
  var i = 0;
  var drawInterval = setInterval(function() {
    i++;
    var pixelData = context.getImageData(0, 0, 240, 160);
    for (var y = 0; y < 160; ++y) {
      for (var x = 0; x < 240; ++x) {
        var xDiff = Math.abs(x - 120);
        var yDiff = Math.abs(y - 80) * 0.8;
        var xFactor = (120 - i - xDiff) / 120;
        var yFactor = (80 - i - ((y & 1) * 10) - yDiff + Math.pow(xDiff, 1 / 2)) / 80;
        pixelData.data[(x + y * 240) * 4 + 3] *= Math.pow(xFactor, 1 / 3) * Math.pow(yFactor, 1 / 2);
      }
    }
    context.putImageData(pixelData, 0, 0);
    target.clearRect(0, 0, 480, 320);
    if (i > 40) {
      clearInterval(drawInterval);
    } else {
      callback();
    }
  }, 50);
}

function setVolume(value) {
  gba.audio.masterVolume = Math.pow(2, value) - 1;
}

function setPixelated(pixelated) {
  var screen = document.getElementById('screen');
  var context = screen.getContext('2d');
  if (context.webkitImageSmoothingEnabled) {
    context.webkitImageSmoothingEnabled = !pixelated;
  } else if (context.mozImageSmoothingEnabled) {
    context.mozImageSmoothingEnabled = !pixelated;
  } else if (window.navigator.appName != 'Microsoft Internet Explorer') {
      if (pixelated) {
        screen.setAttribute('width', '240');
        screen.setAttribute('height', '160');
      } else {
        screen.setAttribute('width', '480');
        screen.setAttribute('height', '320');
      }
      if (window.navigator.appName == 'Opera') {
      // Ugly hack! Ew!
      if (pixelated) {
        screen.style.marginTop = '0';
        screen.style.marginBottom = '-325px';
      } else {
        delete screen.style;
      }
    }
  }
}

document.addEventListener('webkitfullscreenchange', function() {
  var canvas = document.getElementById('screen');
  if (document.webkitIsFullScreen) {
    canvas.setAttribute('height', document.body.offsetHeight);
    canvas.setAttribute('width', document.body.offsetHeight / 2 * 3);
    canvas.setAttribute('style', 'margin: 0');
  } else {
    canvas.setAttribute('height', 320);
    canvas.setAttribute('width', 480);
    canvas.removeAttribute('style');
  }
}, false);
