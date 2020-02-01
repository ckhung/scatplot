/* jshint esversion: 6, loopfunc: true */
/* global console, window, alert, location, $, URI, Plotly, math */

// eval using mathjs : https://mathjs.org/examples/basic_usage.js.html

var G = {
  'config': {
    'keep': [ 'true' ],
  },
  'table': {},
};

function rndsfx() {
  return '?' + Math.floor(Math.random() * 1000);
}

G.url = new URI(location.href);
G.urlConfig = G.url.search(true);
if (! G.urlConfig.c) { G.urlConfig.c='config.json'; }

$.getJSON(G.urlConfig.c, function(cfgdata) {
  $.extend(G.config, cfgdata);
  $.extend(G.config, G.urlConfig);
  $.get(G.config.csv + rndsfx(), init);
  if (! Array.isArray(G.config.keep)) { G.config.keep = [ G.config.keep ]; }
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
  tableContent = Object.keys(filteredData).filter(function (k) {
    return k.match(/^\d+$/);
  });
  tableContent = tableContent.map(function (k) {
    var row = {};
    for (var i=0; i<G.table.colnames.length; ++i) {
      row[G.table.colnames[i]] = filteredData[k][i];
    }
    return(row);
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

function init(data) {
  var tableContent = parseCSV(data, G.config.textcols);
  G.table = {
    'content': tableContent,
    'colnames': Object.keys(tableContent[0]),
    'invd': {}, // internal numerical variable dictionary
	        // for mapping utf8 strings to alphanumeric names
	        // for math evaluation
  };
  var dtConfig = {
    'paging': false,
    'dom': 'lift',
    // https://stackoverflow.com/questions/23724076/how-to-customize-bootstrap-datatable-search-box-and-records-view-position/33617575
    'data': G.table.content.map(function (row) {
      return G.table.colnames.map(function (cn) { return row[cn]; });
    }),
    'columns': G.table.colnames.map(function (cn) {
      return {
	'title': cn,
	'name': cn,
	'type': G.config.textcols.includes(cn) ? 'string' : 'num'
      };
    })
    // browsers on android do not support Object.values()
    // https://stackoverflow.com/questions/38748445/uncaught-typeerror-object-values-is-not-a-function-javascript
  };
  G.table.dtobj = $('#summary_table').DataTable(dtConfig);

  var i=1000;
  G.table.colnames.forEach(function (cn) {
    if (! G.config.textcols.includes(cn)) {
      G.table.invd[cn] = 'inv4me' + i.toString().substr(1);
      ++i;
    }
  });

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


