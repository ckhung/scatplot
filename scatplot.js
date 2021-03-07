/* jshint esversion: 6, loopfunc: true */
/* global console, window, alert, location, $, URI, Plotly, math */

// eval using mathjs : https://mathjs.org/examples/basic_usage.js.html

var G = {};	// global variables

// https://community.plot.ly/t/disable-x-axis-hover-text/28970
function rndsfx() {
  return '?' + Math.floor(Math.random() * 1000);
}

function cn2val(text, dict) {
  // substitute column names in a text string with dict values
  for (var cn in dict) {
    var re = new RegExp(cn, 'g');
    text = text.replace(re, dict[cn]);
  }
  return text;
}

function u8varMathEval(expr, dict, u2adict) {
  var anexpr=expr, anDict={}, k;	// alphanumeric expr/dict/variable
  keys = Object.keys(u2adict).sort(function(a,b) { return b.length - a.length});
  // start substituion from longer strings so that
  // every longer name is correctly processed before its substring,
  // e.g. "AvgSpeed" should be processed before "Speed".
  for (k of keys) {
    var re = new RegExp(
      k.match(/^\w+$/) ? '\\b'+k+'\\b' : k,
      'g'
    );
    anexpr = anexpr.replace(re, u2adict[k]);
    anDict[u2adict[k]] = dict[k];
  }
  try {
    return math.eval(anexpr, anDict);
  } catch (e) {
    console.log('eval exception: ' + expr + ' => '+ anexpr + ' was it caused by one var name being a substring of another?');
    console.log(dict, anDict);
    return NaN;
  }
}

// 出處： https://stackoverflow.com/questions/41440945/handling-dynamic-arguments-from-when-in-jquery 超重要！
$.whenAll = function(promises) {
  var d = $.Deferred(), results = [], counter = promises.length;
  promises.forEach(function(promise, index) {
    promise.done(function(result) {
      results[index] = result;
      if (--counter == 0) { d.resolve(results); }
    }).fail(function() {
      alert('failed to read ' + this.url.replace(/\?.*/, ''));
      d.reject(Array.prototype.slice.call(arguments));
    });
  });
  return d.promise();
};

function parseCSV(str, textcols) {
  // it's amazing how difficult it is to find
  // a suitable csv lib that also runs on an android phone
  var table=[], ret=[], rowstring, row, col, keys, i, krow;
  for (rowstring of str.split('\n')) {
    if (rowstring.match(/^\s*#|^\s*$/)) { continue; }
    var m = rowstring.match(/"(.*?)"/g), marker='##QUOTED##';
    if (m) { rowstring = rowstring.replace(/"(.*?)"/g, marker); }
    row = rowstring.split(',').map(function (s) { return s.trim(); });
    if (m) {
      var k=0;
      for (i=0; i<row.length; ++i) {
	if (row[i] == marker) { row[i] = m[k]; ++k; }
      }
    }
    table.push(row);
  }
  keys = table[0];
  for (row of table.slice(1)) {
    krow = {};
    for (i=0; i<keys.length; ++i) {
      // parse all cols into numbers except
      // those explicitly specified in textcols
      krow[keys[i]] = textcols.includes(keys[i]) ? row[i] : parseFloat(row[i]);
    }
    ret.push(krow);
  }
  return ret;
}

function redraw() {

  var // aliases for global variables
    keptKeys,
    filteredData,
    pltMainTrace = G.plotly.maintrace;

  $.fn.dataTable.ext.search = [
    function(settings, row, index) {
      // https://stackoverflow.com/questions/21407017/jquery-val-not-working-for-input-fields
      var keepExpr = $('#keep_expr').val();
      var u8dict = {};
      for (var i=0; i<G.table.colnames.length; ++i) {
	u8dict[G.table.colnames[i]] = row[i];
      }
      return u8varMathEval(keepExpr, u8dict, G.table.invd);
  } ];
  G.table.dtobj.draw();

  // https://stackoverflow.com/questions/33169649/how-to-get-filtered-data-result-set-from-jquery-datatable
  filteredData = G.table.dtobj.rows({ filter : 'applied'}).data();
  // console.log(Object.keys(filteredData));
  // keptKeys = [];
  // 但是注意： DataTables 傳回來的 .data() 是 object 而不是 array， 裡面夾雜著其他函數等等。
  var pkidx = G.table.colnames.indexOf(G.source.pkey);
  keptKeys = Array.from(filteredData).map(function (row) { return row[pkidx]; });

  pltMainTrace.xaxis.expr = $('#X_expr').val();
  G.plotly.layout.xaxis.title.text = pltMainTrace.xaxis.expr;
  pltMainTrace.yaxis.expr = $('#Y_expr').val();
  G.plotly.layout.yaxis.title.text = pltMainTrace.yaxis.expr;
  pltMainTrace.size.expr = $('#Size_expr').val();

  var frAsDict = {};
  for (var tk of G.table.timekeys) {
    frAsDict[tk] = { 'name': tk, data: [ { x:[], y:[], marker:{size:[]} } ] };
  }
  var mt = {
    // https://plot.ly/javascript/bubble-charts/
    // https://plot.ly/javascript/reference/
    'type': 'scatter',
    'x': [],
    'y': [],
    'name': pltMainTrace.xaxis.expr + ' / ' + pltMainTrace.yaxis.expr,
    'text': [],
    'ids': [],
    'textfont': pltMainTrace.textfont,
    // 'hoverinfo': 'text+x+y',
    'hovertemplate': '%{hovertext}<br />(%{x}, %{y})',
    'hovertext': [],
    'mode': pltMainTrace.maintext ? 'markers+text' : 'markers',
    'marker': {
      'symbol': 'circle',
      'size': [],
      'color': 'rgba(255,255,255,0.3)',
      'line': { 'color': [] },
    },
    // https://plot.ly/python/hover-text-and-formatting/
  };

  for (var idx in keptKeys) {
    var pk = keptKeys[idx];
    var row = G.table.asDict[pk];
    mt.ids[idx] = pk;
    mt.x[idx] = u8varMathEval(pltMainTrace.xaxis.expr, row, G.table.invd);
    mt.y[idx] = u8varMathEval(pltMainTrace.yaxis.expr, row, G.table.invd);
    // https://plot.ly/python/hover-text-and-formatting/
    mt.text[idx] = cn2val(pltMainTrace.maintext, row);
    mt.hovertext[idx] = cn2val(pltMainTrace.hovertext, row);
    mt.marker.size[idx] = 'size' in pltMainTrace && 'expr' in pltMainTrace.size ?
      u8varMathEval(pltMainTrace.size.expr, row, G.table.invd) : 0;
    var xvals = [], yvals = [], snapshot = G.table.history[tk];
    for (tk of G.table.timekeys) {
      var xval, yval, dict = $.extend({}, row);	// make a copy
      $.extend(dict, G.table.history[tk][pk]);
      xval = u8varMathEval(pltMainTrace.xaxis.expr, dict, G.table.invd);
      frAsDict[tk].data[0].x[idx] = typeof(xval) == 'number' ? xval.toFixed(2) : NaN;
      frAsDict[tk].data[0].x[idx] = xval;
      yval = u8varMathEval(pltMainTrace.yaxis.expr, dict, G.table.invd);
      frAsDict[tk].data[0].y[idx] = typeof(yval) == 'number' ? yval.toFixed(2) : NaN;
      frAsDict[tk].data[0].y[idx] = yval;
      frAsDict[tk].data[0].marker.size[idx] =
	'size' in pltMainTrace && 'expr' in pltMainTrace.size ?
	u8varMathEval(pltMainTrace.size.expr, dict, G.table.invd) : 0;
    }

    // https://plot.ly/~alex/455/four-ways-to-change-opacity-of-scatter-markers.embed
    var pal = pltMainTrace.color.palette;
    if (typeof(pal) == 'object') {
      var k = pltMainTrace.color.colname;
      mt.marker.line.color[idx] = row[k] in pal ?
        pal[row[k]] : pltMainTrace.color.default;
    } else {
      mt.marker.line.color[idx] = pltMainTrace.color.default;
      if ('negative' in pltMainTrace.color && mt.marker.size[idx] < 0) {
        mt.marker.line.color[idx] = pltMainTrace.color.negative;
        mt.marker.size[idx] = - mt.marker.size[idx];
	// bug! what about marker.size in frAsDict?
      }
    }
  }

  var frames = G.table.timekeys.map(function (tk) { return frAsDict[tk]; });
console.log('frames: ', frames);

  var traces = G.plotly.statictraces.slice();
  // shallow copy is good enough since this part is never changed
  traces.unshift(mt);

  if (G.plotly.maintrace.timeaxis.colname) {
    G.plotly.layout.sliders[0].steps = G.table.timekeys.map(function (tk) {
      return {
	'method': 'animate',
	'label': tk,
	'args': [
	  [tk], {
	    'mode': 'immediate',
	    'transition': {'duration': 300},
	    'frame': {'duration': 300, 'redraw': false},
	  }
	]
      };
    });
  }


  // https://plot.ly/javascript/gapminder-example/ (animation)
  Plotly.react($('#main_canvas')[0], {
    'data':traces, 'layout':G.plotly.layout, 'config':G.plotly.config, 'frames': frames
  });
}

function saveHistory(csvRows) {
  var exRow = csvRows[0], timeCN = G.plotly.maintrace.timeaxis.colname;
  if (! (timeCN && timeCN in exRow)) { return; }
  for (var row of csvRows) {
    if (! G.table.allpkeys.includes(row[G.source.pkey])) { continue; }
    if (! (row[timeCN] in G.table.history)) {
      G.table.history[row[timeCN]] = {};
    }
if (! row[timeCN].match(/^\d+$/)) {
console.log('!! ', row[G.source.pkey], row[timeCN], row);
}
    G.table.history[row[timeCN]][row[G.source.pkey]] = row;
  }
}

function toDictJoin(csvRows) {
  // convert csvRows array into a dict, then join it into G.table.asDict
  var row, dict2 = {}, mainDict = G.table.asDict;
  // dict2 的初始化千萬不可寫成 dict2 = [];
  // https://stackoverflow.com/questions/2002923/javascript-using-integer-as-key-in-associative-array
  for (row of csvRows) {
    if (!  G.table.allpkeys.includes(row[G.source.pkey])) { continue; }
    // pkey 若重複出現 (有 timeaxis 時)， 後來的覆蓋舊的
    dict2[row[G.source.pkey]] = row;
  }
  var exRow = dict2[G.source.samplekey];
  for (var pk of G.table.allpkeys) {
    if (! (pk in G.table.asDict)) { G.table.asDict[pk] = {}; }
    row = G.table.asDict[pk];
    var colnames = Object.keys(exRow);
    for (var cn of colnames) {
      if (! (cn in row)) {
	row[cn] = pk in dict2 ? dict2[pk][cn] :
	  G.source.textcols.includes(cn) ? '' : NaN;
      }
    }
  }
}

function init(lotab) {
  // lotab: list of csv tables

  var i, apk, cn, sampleRow, Ntab = lotab.length, csvRows;

  ////////////////////////////////////////////////////////////
  // read csv file, build asDict and history dict, get keys along 3 dimensions

  // Special processing for 0-th csv file
  csvRows = parseCSV(lotab[0], G.source.textcols);
  if (csvRows.length <= 0) {
    alert('main csv file "' + G.source.csv[0] + '" is empty!');
    return;
  }
  if (! G.source.pkey) {
    G.source.pkey = G.source.textcols[0];
    alert('No pkey defined.\nUsing "' + G.source.pkey + '" as primary key');
  }
  var pkname = G.source.pkey;
  apk = {};	// all primary keys
  for (var row of csvRows) { apk[row[pkname]] = 1; }
  // get all keys of the 1st (row-wise) dimension
  G.table.allpkeys = Object.keys(apk);
  G.table.allpkeys.sort();
  if (! G.source.samplekey) {
    G.source.samplekey = G.table.allpkeys[0];
  }
  if (! G.table.allpkeys.includes(G.source.samplekey)) {
    alert('samplekey "' + G.source.samplekey + '" not found,\nusing "' + G.table.allpkeys[0] + '" instead');
    G.source.samplekey = G.table.allpkeys[0];
  }
  saveHistory(csvRows);
  toDictJoin(csvRows);

  sampleRow = G.table.asDict[G.source.samplekey];
  var visibleCols = Object.keys(sampleRow);
  // all columns in the 0-th csv file are visible

  // remaining csv files
  for (i=1; i<Ntab; ++i) {
    csvRows = parseCSV(lotab[i], G.source.textcols);
    saveHistory(csvRows);
    toDictJoin(csvRows);
  }
  if (G.plotly.maintrace.timeaxis.colname && Object.keys(G.table.history).length<=0) {
    alert('timeaxis.colname "' + G.plotly.maintrace.timeaxis.colname +
      '" not found in any csv files,\nignoring time dimension');
    G.plotly.maintrace.timeaxis.colname = undefined;
  }

  // get all keys of the 2nd (column-wise) dimension
  G.table.colnames = Object.keys(sampleRow);

  G.table.asArray = G.table.allpkeys.map(function (pk) { return G.table.asDict[pk]; });
  // more columns may be added later, but it's ok since each row is a reference

  // get all keys of the 3rd (time) dimension
  G.table.timekeys = Object.keys(G.table.history);

  // G.table.timecols = []
  if (G.plotly.maintrace.timeaxis.colname) {
    // for time-dependent columns, use data from
    // the last snapshot of history in the (main) G.table.asDict
    var lastSnapshot = G.table.history[G.table.timekeys[G.table.timekeys.length-1]];
//    G.table.timecols = Object.keys(lastSnapshot[G.source.samplekey]);
//    G.table.timecols = G.table.timecols.filter(function (cn) {
//      return ! G.source.textcols.includes(cn);
//    });
    for (var k of G.table.allpkeys) {
      $.extend(true, G.table.asDict[k], lastSnapshot[k]);
    }
  }

  ////////////////////////////////////////////////////////////
  // eval extracols expressions

  // G.table.invd: internal numerical variable dictionary
  // for mapping utf8 strings to alphanumeric names for math evaluation
  var invdIndex = 1000;
  G.table.colnames.forEach(function (cn) {
    if (! G.source.textcols.includes(cn)) {
      G.table.invd[cn] = 'inv4me' + invdIndex.toString().substr(1);
      ++invdIndex;
    }
  });

  for (var coldef of G.source.extracols) {
    if (! coldef.includes('=')) { coldef += '=' + coldef; }
    var m = coldef.match(/(.+?)=(.*)/);
    var colname=m[1], expr=m[2];
    G.table.invd[colname] = 'inv4me' + invdIndex.toString().substr(1);
    ++invdIndex;
    G.table.colnames.push(colname);
    visibleCols.push(colname);
    for (var pk of G.table.allpkeys) {
      row = G.table.asDict[pk];
      var val = u8varMathEval(expr, row, G.table.invd);
      if (typeof(val) == 'number') {
        row[colname] = val.toFixed(2);
      } else {
        row[colname] = NaN;
	console.log(row);
	console.log('eval error: col '+ colname + ' row ' + pk + ' val ' + val);
      }
      for (var tk in G.table.history) {
	var dict = $.extend({}, row);	// make a copy
	$.extend(dict, G.table.history[tk][pk]);
	var val2 = u8varMathEval(expr, dict, G.table.invd);
	G.table.history[tk][pk][colname] = typeof(val2) == 'number' ? val2.toFixed(2) : NaN;
      }
    }
  }

  ////////////////////////////////////////////////////////////
  // build args for datatables

  var colDefs = G.table.colnames.map(function (cn) {
      var cd = {
	'title': cn,
	'type': G.source.textcols.includes(cn) ? 'string' : 'num',
	'visible': visibleCols.includes(cn),
      };
      if (! G.source.textcols.includes(cn)) {
        cd.orderSequence = [ 'desc', 'asc' ];
      }
      return cd;
  } );

  var dtConfig = {
    'paging': false,
    'fixedHeader': true,
    'dom': 'Bflit',
    // https://stackoverflow.com/questions/23724076/how-to-customize-bootstrap-datatable-search-box-and-records-view-position/33617575
    'buttons': [ 'colvis' ],
    // https://datatables.net/extensions/buttons/examples/column_visibility/simple.html
    'data': G.table.asArray.map(function (row) {
      return G.table.colnames.map(function (cn) { return row[cn]; });
    }),
    'columns': colDefs,
    // browsers on android do not support Object.values()
    // https://stackoverflow.com/questions/38748445/uncaught-typeerror-object-values-is-not-a-function-javascript
  };
  G.table.dtobj = $('#summary_table').DataTable(dtConfig);

  ////////////////////////////////////////////////////////////
  // build scatplot-specific UI

  if (G.plotly.maintrace.timeaxis.colname) {
    // enable animation menu
    G.plotly.layout.updatemenus = G.plotly.layout._updatemenus;
    G.plotly.layout.sliders = G.plotly.layout._sliders;
  }

  var allColnameOptions = Object.keys(G.table.invd).map(function (cn) {
    return '<option>' + cn + '\n';
  }).join('');
  $('#X_expr_options').html(allColnameOptions);
  $('#Y_expr_options').html(allColnameOptions);
  // $('#Z_expr_options').html(allColnameOptions);
  $('#Size_expr_options').html(allColnameOptions);
  $('#keep_expr_options').html(G.source.keep.map(function (kc) {
    return '<option>' + kc + '\n';
  }));

  $('.expr_select').change(function () {
    var nv = $(this).children('option:selected').val();
    var target = $(this).parent().find('.expr_entry');
    target.val( nv.trim() );
  });

  $('#redraw').click(redraw);

  ////////////////////////////////////////////////////////////
  // finally, render table and scatter plot

  $('#keep_expr').val( G.source.keep[0] );
  $('#X_expr').val( G.plotly.maintrace.xaxis.expr );
  $('#Y_expr').val( G.plotly.maintrace.yaxis.expr );
  // $('#Z_expr').val( G.plotly.maintrace.zaxis.expr );
  $('#Size_expr').val( G.plotly.maintrace.size.expr );
  redraw();
}

// setAttr(G, k, G.urlConfig[k]);
function ucExtend(urlConfig) {
  // { 's.csv[0]':'abc.csv' } => G.source.csv[0] = 'abc.csv'
  var attname, obj, rest, match;
  for (attname in urlConfig) {
    match = attname.match(/(\w+)(.+)/);
    if (! match) {
      if (attname != 'c') {
        console.log('ignoring urlConfig: ' + attname + '=' + urlConfig[attname]);
      }
      continue;
    }
    obj = match[1];
    match = match[2].match(/\.\w+|\[\d+\]/g);
    rest = match.map(function (attr) {
      var m = attr.match(/\[(\d+)\]/);
      return m ? parseInt(m[1]) : attr.slice(1);
    });
    for (var k in G) {
      // allow shorthand for 1st level attribute names
      if (k.indexOf(obj) == 0) { obj = k; }
    }
    obj = G[obj];
    for (var i=0; i<rest.length-1; ++i) {
      obj = obj[rest[i]];
    }
    obj[rest[rest.length-1]] = urlConfig[attname];
  }
}

////////////////////////////////////////////////////////////


console.log('global variables: ', G);

$.getJSON('default.json'+rndsfx(), function(defG) {
  $.extend(true, G, defG);
  var urlConfig = new URI(location.href).search(true);
  $.getJSON(urlConfig.c || 'config.json'+rndsfx(), function(cfgdata) {
    // set up config
    $.extend(true, G, cfgdata);
    ucExtend(urlConfig);
    if (! Array.isArray(G.source.csv)) { G.source.csv = [ G.source.csv ]; }
    if (! Array.isArray(G.source.keep)) { G.source.keep = [ G.source.keep ]; }
    var csvReq = G.source.csv.map(function (url) {
      return $.get(url+rndsfx());
    });
    $.whenAll(csvReq).then(init);
    // 最有用： https://stackoverflow.com/questions/41440945/handling-dynamic-arguments-from-when-in-jquery 超級讚！
    // https://stackoverflow.com/questions/14352139/multiple-ajax-calls-from-array-and-handle-callback-when-completed
    // https://stackoverflow.com/questions/4878887/how-do-you-work-with-an-array-of-jquery-deferreds
  }).fail(function( jqxhr, textStatus, error ) {
    alert('failed to read ' + this.url);
  });
});

