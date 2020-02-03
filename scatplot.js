/* jshint esversion: 6, loopfunc: true */
/* global console, window, alert, location, $, URI, Plotly, math */

// eval using mathjs : https://mathjs.org/examples/basic_usage.js.html

var G = {
  'config': {
    'keep': [ 'true' ],
    'extracols': [],
  },
  'table': {
    'invd': {}, // internal numerical variable dictionary
	        // for mapping utf8 strings to alphanumeric names
	        // for math evaluation
  }
};

const pKeyPrefix='k';
// 當 pkey 的內容是數字時， 用 String(...) 也沒用。
// 一定要在前面加個非數字的字元， 才能強迫表格成為 dict 而非很糟糕的 sparse array

function rndsfx() {
  return '?' + Math.floor(Math.random() * 1000);
}

G.url = new URI(location.href);
G.urlConfig = G.url.search(true);
if (! G.urlConfig.c) { G.urlConfig.c='config.json'; }

// 出處： https://stackoverflow.com/questions/41440945/handling-dynamic-arguments-from-when-in-jquery 超重要！
$.whenAll = function(promises) {
  var d = $.Deferred(), results = [], counter = promises.length;
  promises.forEach(function(promise, index) {
    promise.done(function(result) {
      results[index] = result;
      if (--counter == 0) { d.resolve(results); }
    }).fail(function() {
      d.reject(Array.prototype.slice.call(arguments));
    });
  });
  return d.promise();
};

$.getJSON(G.urlConfig.c, function(cfgdata) {
  // set up config
  $.extend(G.config, cfgdata);
  $.extend(G.config, G.urlConfig);
  if (! Array.isArray(G.config.keep)) { G.config.keep = [ G.config.keep ]; }
  if (! Array.isArray(G.config.csv)) { G.config.csv = [ G.config.csv ]; }
  var csvReq = G.config.csv.map(function (url) { return $.get(url+rndsfx()); });
  $.whenAll(csvReq).then(initB);
  // 最有用： https://stackoverflow.com/questions/41440945/handling-dynamic-arguments-from-when-in-jquery 超級讚！
  // https://stackoverflow.com/questions/14352139/multiple-ajax-calls-from-array-and-handle-callback-when-completed
  // https://stackoverflow.com/questions/4878887/how-do-you-work-with-an-array-of-jquery-deferreds
});

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

function u8varMathEval(expr, dict, u2adict) {
  var k, anDict = {};	// alphanumeric expr and alpha numeric dict
  for (k in u2adict) {
    var re = new RegExp(k, 'g');
    expr = expr.replace(re, u2adict[k]);
    anDict[u2adict[k]] = dict[k];
  }
  return math.eval(expr, anDict);
}

function cn2val(text, dict) {
  // substitute column names in a text string with dict values
  for (var cn in dict) {
    var re = new RegExp(cn, 'g');
    text = text.replace(re, dict[cn]);
  }
  return text;
}

function redraw() {

  var // aliases for global variables
    tableContent,
    filteredData,
    plotlyLayout = G.config.plotly;

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

  plotlyLayout.xaxis.expr = $('#X_expr').val();
  plotlyLayout.xaxis.title = { 'text': plotlyLayout.xaxis.expr };
  plotlyLayout.yaxis.expr = $('#Y_expr').val();
  plotlyLayout.yaxis.title = { 'text': plotlyLayout.yaxis.expr };
  // plotlyLayout.zaxis.expr = $('#Z_expr').val();
  // plotlyLayout.zaxis.title = { 'text': plotlyLayout.zaxis.expr };
  plotlyLayout.size.expr = $('#Size_expr').val();

  // first generate a plotlyLayout trace
  var maintext = tableContent.map(function (row) {
    return cn2val(plotlyLayout.maintext, row);
  });
  var hovertext = tableContent.map(function (row) {
    return cn2val(plotlyLayout.hovertext, row);
  });
  var trace = {
    // https://plot.ly/javascript/bubble-charts/
    // https://plot.ly/javascript/reference/
    'type': 'scatter3d',
    'x': tableContent.map(function (row) { return u8varMathEval(plotlyLayout.xaxis.expr, row, G.table.invd); } ),
    'y': tableContent.map(function (row) { return u8varMathEval(plotlyLayout.yaxis.expr, row, G.table.invd); } ),
    'name': plotlyLayout.xaxis.expr + ' / ' + plotlyLayout.yaxis.expr,
    'text': maintext,
    'hoverinfo': 'x+y+text',
    'hovertext': hovertext,
    'mode': plotlyLayout.maintext ? 'markers+text' : 'markers',
    'marker': {
      'symbol': 'circle',
      'size': tableContent.map(function (row) { return ('size' in plotlyLayout && 'expr' in plotlyLayout.size ? u8varMathEval(plotlyLayout.size.expr, row, G.table.invd) : 10); } ),
      'color': 'rgba(255,255,255,0.3)',
      'line': {
	// https://plot.ly/~alex/455/four-ways-to-change-opacity-of-scatter-markers.embed
        'color': 'color' in plotlyLayout && 'palette' in plotlyLayout.color ?
	  tableContent.map(function (row) {
	    var pal = plotlyLayout.color.palette;
	    if (typeof(pal) == 'number') {
	      return '#00f';
	    } else if (typeof(pal) == 'object') {
	      var k = plotlyLayout.color.column;
	      return row[k] in pal ? pal[row[k]] : plotlyLayout.color.default;
	    } else {
	      return plotlyLayout.color.default;
	    }
          }) : plotlyLayout.color.default
      }
    },
    // https://plot.ly/python/hover-text-and-formatting/

    // https://plot.ly/javascript/text-and-annotations/
    // 'mode': 'markers+text',
    // 'text': textlist,
  };

  // https://plot.ly/javascript/configuration-options/
  var cfg = {
    toImageButtonOptions: {
      format: 'svg',
      scale: 1.2
    }
};

  Plotly.react($('#main_canvas')[0], [trace], plotlyLayout, cfg);
}

function parseJoin(mainTable, csvText) {
  var t2 = parseCSV(csvText, G.config.textcols);
  // convert t2 array into a dict
  var row, dict2 = {}; 
  for (row of t2) {
    dict2[row[G.config.pkey]] = row;
  }
  var exRow = G.config.examplekey ? dict2[G.config.examplekey] : t2[0];
  for (row of mainTable) {
    var cns = Object.keys(exRow);
    for (var cn of cns) {
      if (! (cn in row)) {
	row[cn] = dict2[row[G.config.pkey]][cn];
      }
    }
  }
}

function initB(lotab) {
  // lotab: list of csv tables
  var i, pk, cn, Ntab = lotab.length;
  G.table.content = parseCSV(lotab[0], G.config.textcols);
  var exampleRow;
  if (G.config.pkey && G.config.examplekey) {
    for (i=0; i<G.table.content.length; ++i) {
      if (G.table.content[i][G.config.pkey] == G.config.examplekey) {
	exampleRow = G.table.content[i];
      }
    }
  } else {
    exampleRow = G.table.content[0];
  }
  var visibleCols = Object.keys(exampleRow);
  if (Ntab > 1) {
    pk = G.config.pkey;
    if (pk == undefined) {
      alert('You have more than 1 csv files.\nPlease define "pkey" in .json.');
      return;
    }
    for (i=1; i<Ntab; ++i) {
      parseJoin(G.table.content, lotab[i]);
    }
  }
  G.table.colnames = Object.keys(exampleRow);
  var colDefs = G.table.colnames.map(function (cn) {
      return {
	'title': cn,
	'type': G.config.textcols.includes(cn) ? 'string' : 'num',
	'visible': visibleCols.includes(cn),
      };
  } );
  var invdIndex = 1000;
  G.table.colnames.forEach(function (cn) {
    if (! G.config.textcols.includes(cn)) {
      G.table.invd[cn] = 'inv4me' + invdIndex.toString().substr(1);
      ++invdIndex;
    }
  });

  for (var coldef of G.config.extracols) {
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
    if (! G.config.textcols.includes(col.title)) {
      col.orderSequence = [ "desc", "asc" ];
    }
  });
console.log(G);

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
  $('#keep_expr_options').html(G.config.keep.map(function (kc) {
    return '<option>' + kc + '\n';
  }));

  $('.expr_select').change(function () {
    var nv = $(this).children('option:selected').val();
    var target = $(this).parent().find('.expr_entry');
    target.val( nv.trim() );
  });

  $('#redraw').click(redraw);

  $('#keep_expr').val( G.config.keep[0] );
  $('#X_expr').val( G.config.plotly.xaxis.expr );
  $('#Y_expr').val( G.config.plotly.yaxis.expr );
  // $('#Z_expr').val( G.config.plotly.zaxis.expr );
  $('#Size_expr').val( G.config.plotly.size.expr );
  redraw();

}


