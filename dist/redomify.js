(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define('redomify', factory) :
	(factory());
}(this, (function () { 'use strict';

var text = function (str) { return doc.createTextNode(str); };

function mount (parent, child, before) {
  var parentEl = parent.el || parent;
  var childEl = child.el || child;

  if (isList(childEl)) {
    childEl = childEl.el;
  }

  if (child === childEl && childEl.__redom_view) {
    // try to look up the view if not provided
    child = childEl.__redom_view;
  }

  if (child !== childEl) {
    childEl.__redom_view = child;
  }

  if (child.isMounted) {
    child.remount && child.remount();
  } else {
    child.mount && child.mount();
  }

  if (before) {
    parentEl.insertBefore(childEl, before.el || before);
  } else {
    parentEl.appendChild(childEl);
  }

  if (child.isMounted) {
    child.remounted && child.remounted();
  } else {
    child.isMounted = true;
    child.mounted && child.mounted();
  }

  return child;
}

function unmount (parent, child) {
  var parentEl = parent.el || parent;
  var childEl = child.el || child;

  if (child === childEl && childEl.__redom_view) {
    // try to look up the view if not provided
    child = childEl.__redom_view;
  }

  child.unmount && child.unmount();

  parentEl.removeChild(childEl);

  child.isMounted = false;
  child.unmounted && child.unmounted();

  return child;
}

function setStyle (view, arg1, arg2) {
  var el = view.el || view;

  if (arguments.length > 2) {
    el.style[arg1] = arg2;
  } else if (isString(arg1)) {
    el.setAttribute('style', arg1);
  } else {
    for (var key in arg1) {
      setStyle(el, key, arg1[key]);
    }
  }
}

function setAttr (view, arg1, arg2) {
  var el = view.el || view;
  var isSVG = el instanceof window.SVGElement;

  if (arguments.length > 2) {
    if (arg1 === 'style') {
      setStyle(el, arg2);
    } else if (isSVG && isFunction(arg2)) {
      el[arg1] = arg2;
    } else if (!isSVG && (arg1 in el || isFunction(arg2))) {
      el[arg1] = arg2;
    } else {
      el.setAttribute(arg1, arg2);
    }
  } else {
    for (var key in arg1) {
      setAttr(el, key, arg1[key]);
    }
  }
}

function parseArguments (element, args) {
  for (var i = 0; i < args.length; i++) {
    var arg = args[i];

    if (!arg) {
      continue;
    }

    // support middleware
    if (typeof arg === 'function') {
      arg(element);
    } else if (isString(arg) || isNumber(arg)) {
      element.appendChild(text(arg));
    } else if (isNode(arg) || isNode(arg.el) || isList(arg.el)) {
      mount(element, arg);
    } else if (arg.length) {
      parseArguments(element, arg);
    } else if (typeof arg === 'object') {
      setAttr(element, arg);
    }
  }
}

var isString = function (a) { return typeof a === 'string'; };
var isNumber = function (a) { return typeof a === 'number'; };
var isFunction = function (a) { return typeof a === 'function'; };

var isNode = function (a) { return a && a.nodeType; };
var isList = function (a) { return a && a.__redom_list; };

var doc = document;

var HASH = '#'.charCodeAt(0);
var DOT = '.'.charCodeAt(0);

function createElement (query, ns) {
  var tag;
  var id;
  var className;

  var mode = 0;
  var start = 0;

  for (var i = 0; i <= query.length; i++) {
    var char = query.charCodeAt(i);

    if (char === HASH || char === DOT || !char) {
      if (mode === 0) {
        if (i === 0) {
          tag = 'div';
        } else if (!char) {
          tag = query;
        } else {
          tag = query.substring(start, i);
        }
      } else {
        var slice = query.substring(start, i);

        if (mode === 1) {
          id = slice;
        } else if (className) {
          className += ' ' + slice;
        } else {
          className = slice;
        }
      }

      start = i + 1;

      if (char === HASH) {
        mode = 1;
      } else {
        mode = 2;
      }
    }
  }

  var element = ns ? doc.createElementNS(ns, tag) : doc.createElement(tag);

  if (id) {
    element.id = id;
  }

  if (className) {
    if (ns) {
      element.setAttribute('class', className);
    } else {
      element.className = className;
    }
  }

  return element;
}

var htmlCache = {};

var memoizeHTML = function (query) { return htmlCache[query] || createElement(query); };

function html (query) {
  var arguments$1 = arguments;

  var args = [], len = arguments.length - 1;
  while ( len-- > 0 ) { args[ len ] = arguments$1[ len + 1 ]; }

  var element;

  if (isString(query)) {
    element = memoizeHTML(query).cloneNode(false);
  } else if (isNode(query)) {
    element = query.cloneNode(false);
  } else {
    throw new Error('At least one argument required');
  }

  parseArguments(element, args);

  return element;
}

html.extend = function (query) {
  var clone = memoizeHTML(query);

  return html.bind(this, clone);
};

var el = html;

function setChildren (parent, children) {
  if (children.length === undefined) {
    return setChildren(parent, [children]);
  }

  var parentEl = parent.el || parent;
  var traverse = parentEl.firstChild;

  for (var i = 0; i < children.length; i++) {
    var child = children[i];

    if (!child) {
      continue;
    }

    var childEl = child.el || child;

    if (isList(childEl)) {
      childEl = childEl.el;
    }

    if (childEl === traverse) {
      traverse = traverse.nextSibling;
      continue;
    }

    mount(parent, child, traverse);
  }

  while (traverse) {
    var next = traverse.nextSibling;

    unmount(parent, traverse);

    traverse = next;
  }
}

function getParentEl (parent) {
  if (isString(parent)) {
    return html(parent);
  } else if (isNode(parent.el)) {
    return parent.el;
  } else {
    return parent;
  }
}

var Router = function Router (parent, Views, initData) {
  this.el = getParentEl(parent);
  this.Views = Views;
  this.initData = initData;
};
Router.prototype.update = function update (route, data) {
  if (route !== this.route) {
    var Views = this.Views;
    var View = Views[route];

    this.view = View && new View(this.initData, data);
    this.route = route;

    setChildren(this.el, [ this.view ]);
  }
  this.view && this.view.update && this.view.update(data, route);
};

var SVG = 'http://www.w3.org/2000/svg';

var svgCache = {};

var memoizeSVG = function (query) { return svgCache[query] || createElement(query, SVG); };

var Redomify = function Redomify () {
  this.counter = 0;
  this.render();
  console.log(this);
};
Redomify.prototype.render = function render () {
    var this$1 = this;

  this.view = {};
  this.view[0] = this.view['el'] = el('div', {
  }, [
    text(" "),
    this.view[1] = el('h1', {
      class: 'test',
      id: 'yay',
    }, [
      this.view[2] = text(" Redomify <3")
    ]),
    text(" "),
    this.view[3] = this.view['mypara'] = el('p', {
    }, [
      this.view[4] = text()
    ]),
    text(" "),
    this.view[5] = el('div', {
    }, [
      text(" "),
      this.view[6] = el('button', {
        onclick: function () { this$1.count(); },
      }, [
        this.view[7] = text()
      ]),
      text(" "),
      this.view[8] = el('button', {
        onclick: function () { this$1.toggleShow(); },
      }, [
        this.view[9] = text(" Toggle")
      ]),
      text(" ") ]),
    text(" ") ]);

  this.el = this.view.el;
  this.update();
};
Redomify.prototype.update = function update () {
  this.view[4].textContent ="Hello Redom " + this.counter + " People"; 
  setAttr(this.view[3], 'style','display:' + ((this.show)? 'block': 'none') );
  this.view[7].textContent = this.counter;
  setAttr(this.view[6], 'data-counter', this.counter);
};
Redomify.prototype.toggleShow = function toggleShow () {
  this.show = !this.show;
  this.update();
};
Redomify.prototype.count = function count () {
  this.counter++;
  this.update();
  console.log(this);
};

mount(document.body, new Redomify());

})));
