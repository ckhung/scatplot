#!/usr/bin/python3
# -*- coding: utf-8 -*-

# 使用範例： python3 scatplot.py -k 'radius>50' -t 'name planet' -X 'log(orbit_major,10)' -Y 'log(rev_cycle,10)' -T 'name[:3]' -A 'log(radius)*50' satellites.csv

import argparse, re, codecs, math
import matplotlib.pyplot as plt
import matplotlib as mpl

NaN = float('nan')
INF = float('inf')
            
def tofloat(v):
    try:
        f = float(v)
        return f
    except (ValueError, TypeError):
        return NaN

def readcsv(fn, textcols=[]):
    table = []
    vardict = {}
    with codecs.open(fn, encoding='utf-8') as F:
        header = [x.strip() for x in F.readline().split(',')]
        for line in F.readlines():
            line = re.sub(r'^\s*#.*', '', line)
            if re.match(r'^\s*$', line):
                continue
            value = [x.strip() for x in line.split(',')]
            row = {}
            for k, v in zip(header, value):
                row[k] = v if k in textcols else tofloat(v)
            table.append(row)
    return table

def safe_eval(expr, localdict):
    # https://www.geeksforgeeks.org/eval-in-python/
    # safe_list = ['math']
    # safe_dict = dict([(k, locals().get(k, None)) for k in safe_list])

    # https://stackoverflow.com/questions/11419463/python-eval-not-working-within-a-function
    safe_list = ['factorial', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'cosh', 'degrees', 'e', 'exp', 'fabs', 'floor', 'fmod', 'hypot', 'log', 'log10', 'modf', 'pi', 'pow', 'radians', 'sin', 'sinh', 'sqrt', 'tan', 'tanh']
    safe_dict = dict((k, getattr(math, k)) for k in safe_list)
    rdict = safe_dict.copy()
    safe_dict.update(localdict)
    return eval(expr, {"__builtins__":None}, safe_dict)

parser = argparse.ArgumentParser(
    description=u'csv 繪圖',
    formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-k', '--keep', type=str,
    default='True', help=u'只保留符合條件的點')
parser.add_argument('-t', '--textcols', type=str,
    default='', help=u'哪些欄位是文字？ (以空格分隔)')
parser.add_argument('-X', '--xexpr', type=str,
    default='無此欄', help=u'X 軸運算式')
parser.add_argument('-Y', '--yexpr', type=str,
    default='無此欄', help=u'Y 軸運算式')
parser.add_argument('-T', '--texpr', type=str,
    default='', help=u'顯示文字運算式')
parser.add_argument('-A', '--aexpr', type=str,
    default='', help=u'圓圈面積運算式')
parser.add_argument('csvfile', type=str,
    help=u'csv 檔名')
args = parser.parse_args()

data = readcsv(args.csvfile, textcols=args.textcols.split())

mpl.rcParams['font.sans-serif'] = ['AR PL UKai TW'] + mpl.rcParams['font.sans-serif']
mpl.rcParams.update({'font.size': 14})

figure, axes = plt.subplots()
plt.xlabel(args.xexpr)
plt.ylabel(args.yexpr)
xmin = ymin = INF
xmax = ymax = -INF

for row in data:
    X = safe_eval(args.xexpr, row)
    Y = safe_eval(args.yexpr, row)
    if safe_eval(args.keep, row):
        if X < xmin: xmin = X
        if X > xmax: xmax = X
        if Y < ymin: ymin = Y
        if Y > ymax: ymax = Y
        # print(X, Y, text)
        if args.aexpr:
            Area = safe_eval(args.aexpr, row)
            plt.scatter(X, Y, s=Area, edgecolors='b', c='none')
            # https://matplotlib.org/api/_as_gen/matplotlib.pyplot.scatter.html
        if args.texpr:
            text = safe_eval(args.texpr, row)
            plt.text(X, Y, text, ha='center', va='center',  size=8)
plt.plot([xmin, xmax], [ymin, ymax], linestyle='')
# https://github.com/matplotlib/matplotlib/issues/10497
plt.autoscale(True)
plt.savefig(re.sub(r'\.\w+$', '.svg', args.csvfile))
# https://github.com/matplotlib/matplotlib/issues/2831
# plt.show()

