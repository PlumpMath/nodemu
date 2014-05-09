/*
 * Node.js utils (predicates, pretty print, OO).
 *
 * Nodemu, Node.js emulated
 * (C) Copyright 2014, Karel Tuma <kat@lua.cz>, All rights reserved.
 *
 * Major portions taken verbatim or adapted from Node.JS
 * Copyright Joyent, Inc. and other Node contributors.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict'

let inspect

/* Type predicates. */
let to_str = function(v) {
  return v.prototype.toString.call(v)
}
let is_boolean = exports.is_boolean = function(v) {
  return typeof v === "boolean"
}
let is_null = exports.is_null = function(v) {
  return v === null
}
let is_undefined = exports.is_undefined = function(v) {
  return v === void 0
}
let is_null_or_undefined = exports.is_null_or_undefined = function(v) {
  return v == null
}
let is_number = exports.is_number = function(v) {
  return typeof v === 'number'
}
let is_string = exports.is_string = function(v) {
  return typeof v === 'string'
}
let is_symbol = exports.is_symbol = function(v) {
  return typeof v === 'symbol'
}
let is_function = exports.is_function = function(v) {
  return typeof v === 'function'
}
let is_object = exports.is_object = function(v) {
  return typeof v === 'object' && arg !== null
}
let is_date = exports.is_date = function(v) {
  return is_object(v) && to_str(v) === '[object Date]' ||
    v instanceof Date
}
let is_error = exports.is_error = function(v) {
  return is_object(v) && to_str(v) === '[object Error]' ||
    v instanceof Error
}
let is_reg_exp = exports.is_reg_exp = function(v) {
  return is_object(v) && to_str(v) === '[object RegExp]' ||
    v instanceof RegExp
}
let is_buffer = exports.is_buffer = function(v) {
  return v instanceof ArrayBuffer
}
let is_primitive = exports.is_primitive = function(v) {
  return arg === null ||
  typeof arg === 'boolean' ||
  typeof arg === 'number' ||
  typeof arg === 'string' ||
  typeof arg === 'symbol' ||
  typeof arg === 'undefined'
}

/* Formatter. TBD: Circular refs should tell where. */
let fmt_regex = /%[sdj%]/g
let format = exports.format = function(f) {
  if (!is_string(f)) {
    let objects = []
    for (let i = 0; i < arguments.length; i++)
      objects.push(inspect(arguments[i]))
    return objects.join(' ')
  }

  let i = 1
  let args = arguments
  let len = args.length
  let str = String(f).replace(fmt_regex, function(x) {
    if (x === '%%') return '%'
    if (i >= len) return x
    switch (x) {
      case '%s': return String(args[i++])
      case '%d': return Number(args[i++])
      case '%j':
        try {
          return JSON.stringify(args[i++])
        } catch (_) {
          return '[Circular]'
        }
      default:
        return x
    }
  })
  for (let x = args[i]; i < len; x = args[++i]) {
    if (is_null(x) || !is_object(x)) {
      str += ' ' + x
    } else {
      str += ' ' + inspect(x)
    }
  }
  return str
}

/* Dummy. */
exports.deprecate = function(fn, msg) { return fn }

/* Logger. */
exports.log = function() {
  return console.log('%s - %s', Date.toString(), format(arguments))
}

/* Debug printer. */
let debug_set = exports.debug_set = {}
let debug_environ = exports.debug_environ = {}
exports.debuglog = function(set) {
  if (is_undefined(debug_environ))
    debug_environ = process.env.NODE_DEBUG || ''
  set = set.toUpperCase()
  if (!debug_set[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debug_environ)) {
      let pid = process.pid
      debugs[set] = function() {
        let msg = exports.format.apply(exports, arguments)
        console.error('%s %d: %s', set, pid, msg)
      }
    } else {
      debugs[set] = function() {}
    }
  }
  return debugs[set]
}

/* Prototype inheritance. */
exports.inherits = function(ctor, sup) {
  ctor.super_ = sup
  ctor.prototype = Object.create(sup.prototype, {
    constructor: {
      value: ctor,
      writable: true,
      configurable: true
    }
  })
}

/* Shallow copy src into dst. */
let _extend = exports._extend = function(dst, src)
{
  for (let k in src)
    dst[k] = src[k]
  return dst
}

/* Ok this might be taking it too far. */
let has_own_property = function(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

/* Stylize with vt100 escapes. */
let stylize_l33t = function(str, typ) {
  let style
  if (style = inspect.styles[typ])
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm'
  return str // Or not.
}

/* Value not l33t enough. */
let stylize_plain = function(str) {
  return str
}

/* Make set of of array values. */
let array_to_set = function(array) {
  let hash = {}
  for (let val of array.values())
    hash[val] = true
  return hash
}

/* This is the actual formatter called by inspect. */
let format_value = function(ctx, value, recurse_times) {
  if (ctx.customInspect && // User hook.
      value &&
      is_function(value.inspect) &&
      value.inspect !== exports.inspect && // It's us.
      !(value.constructor && value.constructor.prototype === value)) {
    let ret = value.inspect(recurse_times, ctx)
    if (!is_string(ret)) {
      ret = format_value(ctx, ret, recurse_times)
    }
    return ret
  }

  let primitive = format_primitive(ctx, value)
  if (primitive) // Does not have props.
    return primitive

  let keys = Object.keys(value)
  let visible_keys = array_to_set(keys)

  if (ctx.showHidden)
    keys = Object.getOwnPropertyNames(value)

  /*
   * This could be a boxed primitive (new String(), etc.), check valueOf()
   * NOTE: Avoid calling `valueOf` on `Date` instance because it will return
   * a number which, when object has some additional user-stored `keys`,
   * will be printed out.
   */
  let formatted
  let raw = value
  try { // the .valueOf() call can fail for a multitude of reasons
    if (!is_date(value))
      raw = value.valueOf()
  } catch (e) {} // ignore...

  if (is_string(raw))
    keys = keys.filter(function(key) { // Kill num props of string.
      return !(key >= 0 && key < raw.length)
    })

  if (keys.length === 0) { // First primitives, then boxes.
    if (is_function(value)) {
      let name = value.name ? ': ' + value.name : ''
      return ctx.stylize('[Function' + name + ']', 'special')
    }
    if (is_reg_exp(value))
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp')
    if (is_date(value))
      return ctx.stylize(Date.prototype.toString.call(value), 'date')
    if (is_error(value))
      return format_error(value)

    if (is_string(raw)) { // Then boxes.
      formatted = format_primitive_plain(ctx, raw)
      return ctx.stylize('[String: ' + formatted + ']', 'string')
    }
    if (is_number(raw)) {
      formatted = format_primitive_plain(ctx, raw)
      return ctx.stylize('[Number: ' + formatted + ']', 'number')
    }
    if (is_boolean(raw)) {
      formatted = format_primitive_plain(ctx, raw)
      return ctx.stylize('[Boolean: ' + formatted + ']', 'boolean')
    }
  }

  let base = '', array = false, braces = ['{', '}']

  if (is_array(value)) {
    array = true
    braces = ['[', ']']
  }

  if (is_function(value)) {
    let n = value.name ? ': ' + value.name : ''
    base = ' [Function' + n + ']'
  }

  if (is_reg_exp(value))
    base = ' ' + RegExp.prototype.toString.call(value)

  if (is_date(value))
    base = ' ' + Date.prototype.toUTCString.call(value)

  if (is_error(value))
    base = ' ' + format_error(value)

  if (is_string(raw)) { // Boxed.
    formatted = format_primitive_plain(ctx, raw)
    base = ' ' + '[String: ' + formatted + ']'
  }

  if (is_number(raw)) {
    formatted = format_primitive_plain(ctx, raw)
    base = ' ' + '[Number: ' + formatted + ']'
  }

  if (is_boolean(raw)) {
    formatted = format_primitive_plain(ctx, raw)
    base = ' ' + '[Boolean: ' + formatted + ']'
  }

  if (keys.length === 0 && (!array || value.length === 0))
    return braces[0] + base + braces[1]

  if (recurse_times < 0)
    if (is_reg_exp(value))
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp')
    else
      return ctx.stylize('[Object]', 'special')

  ctx.seen.push(value)
  let output
  if (array)
    output = format_array(ctx, value, recurse_times, visible_keys, keys)
  else
    output = keys.map(function(key) {
      return format_property(ctx, value, recurse_times, visible_keys, key, array)
    })

  ctx.seen.pop()
  return reduce_to_single_string(output, base, braces)
}

/* Format one value. */
let format_primitive = function(ctx, value) {
  if (is_undefined(value))
    return ctx.stylize('undefined', 'undefined')
  if (is_string(value)) {
    let simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\''
    return ctx.stylize(simple, 'string')
  }
  if (is_number(value)) {
    /*
     * Format -0 as '-0'. Strict equality won't distinguish 0 from -0,
     * so instead we use the fact that 1 / -0 < 0 whereas 1 / 0 > 0 .
     */
    if (value === 0 && 1 / value < 0)
      return ctx.stylize('-0', 'number')
    return ctx.stylize('' + value, 'number')
  }
  if (is_boolean(value))
    return ctx.stylize('' + value, 'boolean')
  if (is_null(value)) // https://www.destroyallsoftware.com/talks/wat
    return ctx.stylize('null', 'null')
}

/* Format without colors. */
let format_primitive_plain = function(ctx, value) {
  let stylize = ctx.stylize
  ctx.stylize = stylize_plain
  let str = format_primitive(ctx, value)
  ctx.stylize = stylize
  return str
}

/* Format error object. */
let format_error = function(value) {
  return '[' + Error.prototype.toString.call(value) + ']'
}

/* Format array. */
let format_array = function(ctx, value, recurse_times, visible_keys, keys) {
  let output = []
  for (let i = 0, l = value.length; i < l; ++i)
    if (has_own_property(value, String(i)))
      output.push(format_property(ctx, value, recurse_times, visible_keys,
          String(i), true))
    else
      output.push('')
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/))
      output.push(format_property(ctx, value, recurse_times, visible_keys,
          key, true))
  })
  return output
}

/* Format single property of object. */
let format_property = function(ctx, value, recurse_times, visible_keys, key, array) {
  let name, str, desc
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] }
  if (desc.get)
    if (desc.set)
      str = ctx.stylize('[Getter/Setter]', 'special')
    else
      str = ctx.stylize('[Getter]', 'special')
  else
    if (desc.set)
      str = ctx.stylize('[Setter]', 'special')
  if (!has_own_property(visible_keys, key))
    name = '[' + key + ']'
  if (!str)
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (is_null(recurse_times)) {
        str = format_value(ctx, desc.value, null)
      } else {
        str = format_value(ctx, desc.value, recurse_times - 1)
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line
          }).join('\n').substr(2)
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line
          }).join('\n')
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special')
    }
  if (is_undefined(name)) {
    if (array && key.match(/^\d+$/))
      return str
    name = JSON.stringify('' + key)
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2)
      name = ctx.stylize(name, 'name')
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'")
                 .replace(/\\\\/g, '\\')
      name = ctx.stylize(name, 'string')
    }
  }

  return name + ': ' + str
}

/* Flatten the tree into result string. */
let reduce_to_single_string = function(output, base, braces) {
  let length = output.reduce(function(prev, cur) {
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1
  }, 0)

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1]
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1]
}

/* Pretty print. */
exports.p = function()
{
  for (var i = 0, len = arguments.length; i < len; ++i)
    console.error(exports.inspect(arguments[i]))
}

/* Run. */
exports.exec = function()
{
  return require('child_process').exec.apply(this, arguments);
}

/* Write. */
exports.puts = function()
{
  for (let i = 0, len = arguments.length; i < len; ++i)
    process.stderr.write(arguments[i] + '\n');
}
/* WriteLn. */
exports.puts = function()
{
  for (let i = 0, len = arguments.length; i < len; ++i)
    process.stderr.write(arguments[i]);
}

/* Report error. */
exports.error = function()
{
  for (let i = 0, len = arguments.length; i < len; ++i)
    process.stderr.write(arguments[i] + '\n');
}

/* Report debug message. */
exports.debug = function()
{
  process.stderr.write('DEBUG: ')
  exports.error.apply(null, arguments)
}

/* Node.JS pretty printer. */
inspect = exports.inspect = function(obj, opts) {
  let ctx = { // default options
    seen: [],
    stylize: stylize_plain
  }
  if (arguments.length >= 3) ctx.depth = arguments[2] // Legacy.
  if (arguments.length >= 4) ctx.colors = arguments[3]
  if (is_boolean(opts)) {
    ctx.showHidden = opts
  } else if (opts)
    _extend(ctx, opts) // Got an "options" object.
  if (is_undefined(ctx.showHidden)) ctx.showHidden = false
  if (is_undefined(ctx.depth)) ctx.depth = 2
  if (is_undefined(ctx.colors)) ctx.colors = false
  if (is_undefined(ctx.customInspect)) ctx.customInspect = true
  if (ctx.colors) ctx.stylize = stylize_l33t
  return format_value(ctx, obj, ctx.depth)
}

/* Alias from function_name to functionName. */
for (let k in exports) {
  let v = exports[k]
  exports[k] = k.replace(/(_[a-z])/g, function(part) {
    return part.toUpperCase().replace('_','')
  })
}

/* ANSI art spam. */
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
}

inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
}


