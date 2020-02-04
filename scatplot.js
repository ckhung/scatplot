/* jshint esversion: 6, loopfunc: true */
/* global console, window, alert, location, $, URI, Plotly, math */

// eval using mathjs : https://mathjs.org/examples/basic_usage.js.html

var G = {
  'source': {
    'keep': [ 'true' ],
    'extracols': [],
  },
  'table': {
    'invd': {},
  },
  'plotly': {
    'statictraces': [],
    'config': {
      toImageButtonOptions: {
        format: 'svg',
        scale: 1.2
      }
    },
    'layout': {
      'hovermode': 'closest',
      'xaxis': {
	'title': { 'text': '' }
      },
      'yaxis': {
	'title': { 'text': '' }
      }
    }
    // https://community.plot.ly/t/disable-x-axis-hover-text/28970
  },
};

const pKeyPrefix='k';
// 當 pkey 的內容是數字時， 用 String(...) 也沒用。
// 一定要在前面加個非數字的字元， 才能強迫表格成為 dict 而非很糟糕的 sparse array

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
  for (k in u2adict) {
    var re = new RegExp(k, 'g');
    anexpr = anexpr.replace(re, u2adict[k]);
    anDict[u2adict[k]] = dict[k];
  }
  try {
    return math.eval(anexpr, anDict);
  } catch (e) {
    console.log('eval exception: expr="'+expr+'"', dict);
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
  var table=[], ret=[], row, col, keys, i, krow;
  for (row of str.split('\n')) {
    if (row.match(/^\s*#|^\s*$/)) { continue; }
    table.push(row.split(',').map(function (s) { return s.trim(); }));
  }
  keys = table[0];
  for (row of table.slice(1)) {
    krow = {};
    for (i=0; i<keys.length; ++i) {
      // parse all cols into numbers except
      // those explicitly specified in textcols
      krow[keys[i]] = textcols.indexOf(keys[i])>=0 ? row[i] : parseFloat(row[i]);
    }
    ret.push(krow);
  }
  return ret;
}

function redraw() {

  var // aliases for global variables
    tableContent,
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

  // 太奇怪了， DataTables 傳回來的 .data() 竟然是 object 而不是 array，
  // 而且夾雜著其他函數等等。
  // https://stackoverflow.com/questions/33169649/how-to-get-filtered-data-result-set-from-jquery-datatable
  filteredData = G.table.dtobj.rows({ filter : 'applied'}).data();
  // console.log(Object.keys(filteredData));
  // tableContent = [];
  tableContent = Array.from(filteredData).map(function (row) {
    var newrow = {};
    for (var j=0; j<G.table.colnames.length; ++j) {
      newrow[G.table.colnames[j]] = row[j];
    }
    return newrow;
  });

  pltMainTrace.xaxis.expr = $('#X_expr').val();
  G.plotly.layout.xaxis.title.text = pltMainTrace.xaxis.expr;
  pltMainTrace.yaxis.expr = $('#Y_expr').val();
  G.plotly.layout.yaxis.title.text = pltMainTrace.yaxis.expr;
  pltMainTrace.size.expr = $('#Size_expr').val();

  var maintext = tableContent.map(function (row) {
    return cn2val(pltMainTrace.maintext, row);
  });
  var hovertext = tableContent.map(function (row) {
    return cn2val(pltMainTrace.hovertext, row);
  });
  var mainTrace = {
    // https://plot.ly/javascript/bubble-charts/
    // https://plot.ly/javascript/reference/
    'type': 'scatter',
    'x': tableContent.map(function (row) { return u8varMathEval(pltMainTrace.xaxis.expr, row, G.table.invd); } ),
    'y': tableContent.map(function (row) { return u8varMathEval(pltMainTrace.yaxis.expr, row, G.table.invd); } ),
    'name': pltMainTrace.xaxis.expr + ' / ' + pltMainTrace.yaxis.expr,
    'text': maintext,
    // 'hoverinfo': 'text+x+y',
    'hovertemplate': '%{hovertext}<br />(%{x}, %{y})',
    'hovertext': hovertext,
    'mode': pltMainTrace.maintext ? 'markers+text' : 'markers',
    'marker': {
      'symbol': 'circle',
      'size': tableContent.map(function (row) { return ('size' in pltMainTrace && 'expr' in pltMainTrace.size ? u8varMathEval(pltMainTrace.size.expr, row, G.table.invd) : 10); } ),
      'color': 'rgba(255,255,255,0.3)',
      'line': {
	// https://plot.ly/~alex/455/four-ways-to-change-opacity-of-scatter-markers.embed
        'color': 'color' in pltMainTrace && 'palette' in pltMainTrace.color ?
	  tableContent.map(function (row) {
	    var pal = pltMainTrace.color.palette;
	    if (typeof(pal) == 'number') {
	      return '#00f';
	    } else if (typeof(pal) == 'object') {
	      var k = pltMainTrace.color.column;
	      return row[k] in pal ? pal[row[k]] : pltMainTrace.color.default;
	    } else {
	      return pltMainTrace.color.default;
	    }
          }) : pltMainTrace.color.default
      }
    },
    // https://plot.ly/python/hover-text-and-formatting/

    // https://plot.ly/javascript/text-and-annotations/
    // 'mode': 'markers+text',
    // 'text': textlist,
  };

  // https://plot.ly/javascript/configuration-options/

  var traces = G.plotly.statictraces.slice();
  // shallow copy is good enough since this part is never changed
  traces.unshift(mainTrace);
  Plotly.react($('#main_canvas')[0], traces, G.plotly.layout, G.plotly.config);
}

function parseJoin(mainTable, csvText) {
  var t2 = parseCSV(csvText, G.source.textcols);
  // convert t2 array into a dict
  var row, dict2 = {}; 
  for (row of t2) {
    dict2[row[G.source.pkey]] = row;
  }
  var exRow = G.source.samplekey ? dict2[G.source.samplekey] : t2[0];
  for (row of mainTable) {
    var cns = Object.keys(exRow);
    for (var cn of cns) {
      if (! (cn in row)) {
	row[cn] = row[G.source.pkey] in dict2 ? dict2[row[G.source.pkey]][cn] : NaN;
      }
    }
  }
}

function init(lotab) {
  // lotab: list of csv tables
  var i, pk, cn, Ntab = lotab.length;
  G.table.content = parseCSV(lotab[0], G.source.textcols);
  var sampleRow;
  if (G.source.pkey && G.source.samplekey) {
    for (i=0; i<G.table.content.length; ++i) {
      if (G.table.content[i][G.source.pkey] == G.source.samplekey) {
	sampleRow = G.table.content[i];
      }
    }
  } else {
    sampleRow = G.table.content[0];
  }
  var visibleCols = Object.keys(sampleRow);
  if (Ntab > 1) {
    pk = G.source.pkey;
    if (pk == undefined) {
      alert('You have more than 1 csv files.\nPlease define "pkey" in .json.');
      return;
    }
    for (i=1; i<Ntab; ++i) {
      parseJoin(G.table.content, lotab[i]);
    }
  }
  G.table.colnames = Object.keys(sampleRow);
  var colDefs = G.table.colnames.map(function (cn) {
      return {
	'title': cn,
	'type': G.source.textcols.includes(cn) ? 'string' : 'num',
	'visible': visibleCols.includes(cn),
      };
  } );

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
    colDefs.push({
      'title': colname,
      'type': 'num',
      'visible': true,
    });
    for (var row of G.table.content) {
      row[colname] = u8varMathEval(expr, row, G.table.invd).toFixed(2);
    }
  }
  colDefs.forEach(function (col) {
    if (! G.source.textcols.includes(col.title)) {
      col.orderSequence = [ 'desc', 'asc' ];
    }
  });
console.log('global variables: ', G);

  var dtConfig = {
    'paging': false,
    'fixedHeader': true,
    'dom': 'Bflit',
    // https://stackoverflow.com/questions/23724076/how-to-customize-bootstrap-datatable-search-box-and-records-view-position/33617575
    'buttons': [ 'colvis' ],
    // https://datatables.net/extensions/buttons/examples/column_visibility/simple.html
    'data': G.table.content.map(function (row) {
      return G.table.colnames.map(function (cn) { return row[cn]; });
    }),
    'columns': colDefs,
    // browsers on android do not support Object.values()
    // https://stackoverflow.com/questions/38748445/uncaught-typeerror-object-values-is-not-a-function-javascript
  };
  G.table.dtobj = $('#summary_table').DataTable(dtConfig);

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

  $('#keep_expr').val( G.source.keep[0] );
  $('#X_expr').val( G.plotly.maintrace.xaxis.expr );
  $('#Y_expr').val( G.plotly.maintrace.yaxis.expr );
  // $('#Z_expr').val( G.plotly.maintrace.zaxis.expr );
  $('#Size_expr').val( G.plotly.maintrace.size.expr );
  redraw();
}

////////////////////////////////////////////////////////////

G.url = new URI(location.href);
G.urlConfig = G.url.search(true);
console.log('urlConfig: ', G.urlConfig);
if (! G.urlConfig.c) { G.urlConfig.c='config.json'; }

$.getJSON(G.urlConfig.c, function(cfgdata) {
  // set up config
  $.extend(true, G, cfgdata);
  // $.extend(true, G, G.urlConfig);
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
