/* jshint esversion: 6, loopfunc: true */
/* global console, window, alert, location, $, URI, Plotly, math */

// eval using mathjs : http://mathjs.org/examples/basic_usage.js.html

var G = {
};

function rndsfx() {
  return '?' + Math.floor(Math.random() * 1000);
}

G.url = new URI(location.href);
G.urlConfig = G.url.search(true);
if (! G.urlConfig.c) { G.urlConfig.c='config.json'; }

$.getJSON(G.urlConfig.c, function(data) {
  G.config = data;
  $.extend(G.config, G.urlConfig);
  G.table = [];
  $.get(G.config.csv + rndsfx(), init);
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

function gentrace(data, plotlyconf) {
  // generate a plotlyconf trace
  var textlist = data.map(function (row) {
    return plotlyconf.text.replace(
      /\b(\w+)\b/g, function (m) {
	return m in row ? row[m] : m;
      }
    );
  } );
  return {
    'name': plotlyconf.xaxis.expr + ' / ' + plotlyconf.yaxis.expr,
    // https://plot.ly/javascript/bubble-charts/
    // https://plot.ly/javascript/reference/
    'type': 'scatter',
    'x': data.map(function (row) { return math.eval(plotlyconf.xaxis.expr, row); } ),
    'y': data.map(function (row) { return math.eval(plotlyconf.yaxis.expr, row); } ),
    'mode': 'markers',
    'marker': {
      'symbol': 'circle',
      'size': data.map(function (row) { return ('size' in plotlyconf && 'expr' in plotlyconf.size ? math.eval(plotlyconf.size.expr, row) : 10); } ),
      'color': 'rgba(255,255,255,0.3)',
      'line': {
	// https://plot.ly/~alex/455/four-ways-to-change-opacity-of-scatter-markers.embed
        'color': 'color' in plotlyconf && 'palette' in plotlyconf.color ?
	  data.map(function (row) {
	    var pal = plotlyconf.color.palette;
	    if (typeof(pal) == 'number') {
	      return '#00f';
	    } else if (typeof(pal) == 'object') {
	      var k = plotlyconf.color.column;
	      return row[k] in pal ? pal[row[k]] : plotlyconf.color.default;
	    } else {
	      return plotlyconf.color.default;
	    }
          }) : plotlyconf.color.default
      }
    },
    // https://plot.ly/python/hover-text-and-formatting/
    'hoverinfo': 'x+y+text',
    'hovertext': textlist,

    // https://plot.ly/javascript/text-and-annotations/
    // 'mode': 'markers+text',
    // 'text': textlist,
  };
}

function init(data) {
  G.table = parseCSV(data, G.config.textcols).filter(function (row) {
    return math.eval(G.config.keep, row);
  });
  Plotly.plot(
    $('#main_canvas')[0],
    [gentrace(G.table, G.config.plotly)],
    G.config.plotly
  );

  var keys = Object.keys(G.table[0]);
  var dtConfig = {
    'paging': false,
    'data': G.table.map(function (row) {
      return keys.map(function (k) { return row[k]; });
    }),
    'columns': keys.map(function (k) {
      return { 'title': k };
    })
    // browsers on android do not support Object.values()
    // https://stackoverflow.com/questions/38748445/uncaught-typeerror-object-values-is-not-a-function-javascript
  };
  $('#summary_table').DataTable(dtConfig);
}


