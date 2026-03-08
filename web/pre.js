var Module = Module || {};
Module.arguments = Module.arguments || ['-xl'];
Module.preRun = Module.preRun || [];
Module.preRun.push(function() {
  FS.mkdir('/userdata');
  FS.mount(IDBFS, {}, '/userdata');
  addRunDependency('idbfs');
  FS.syncfs(true, function(err) {
    if (err) console.error(err);
    removeRunDependency('idbfs');
  });

  if (window.__a8FetchAutoload) {
    addRunDependency('autoload');
    window.__a8FetchAutoload().then(function(rec) {
      if (rec) {
        var path = '/userdata/' + rec.name;
        return rec.blob.arrayBuffer().then(function(buf) {
          FS.writeFile(path, new Uint8Array(buf));
          var argByType = { disk: ['-run', path], cart: ['-cart', path], tape: ['-tape', path], state: ['-state', path], run: ['-run', path] };
          Module.arguments = (argByType[rec.type] || ['-run', path]);
        });
      }
    }).finally(function() { removeRunDependency('autoload'); });
  }
});

Module.setStatus = function(text) {
  var el = document.getElementById('status');
  if (el && text) el.textContent = text;
};

Module.postRun = Module.postRun || [];
Module.postRun.push(function(){ window.__a8StartupReady = true; Module.setStatus('Emulator running (Altirra default ROM)'); });
