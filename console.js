/*
 * Node.js console
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

let util = require('util')
let format = util.format,
    is_function = util.is_function,
    inspect = util.inspect

let Console = function(stdout, stderr)
{
  if (!(this instanceof Console))
    return new Console(stdout, stderr)
  if (!stdout || !is_function(stdout.write))
    throw new TypeError('Console expects a writable stream instance')
  if (!stderr)
    stderr = stdout
  let prop = {
    writable: true,
    configurable: true
  }
  prop.value = stdout
  Object.defineProperty(this, '_stdout', prop)
  prop.value = stderr
  Object.defineProperty(this, '_stderr', prop)
  prop.value = {}
  Object.defineProperty(this, '_times', prop)

  for (k in Console.prototype)
    this[k] = this[k].bind(this)
}

Console.prototype.info =
Console.prototype.log = function()
{
  this._stdout.write(format.apply(this, arguments) + '\n')
}


Console.prototype.error =
Console.prototype.warn = function()
{
  this._stderr.write(format.apply(this, arguments) + '\n')
}

Console.prototype.dir = function(object)
{
  this._stdout.write(inspect(object, { customInspect: false }) + '\n')
}

Console.prototype.time = function(label)
{
  this._times[label] = Date.now()
}

Console.prototype.timeEnd = function(label) {
  let time = this._times[label]
  if (!time)
    throw new Error('No such label: ' + label)
  let duration = Date.now() - time
  this.log('%s: %dms', label, duration)
}

Console.prototype.trace = function()
{
  let err = new Error
  err.name = 'Trace'
  err.message = format.apply(this, arguments)
  Error.captureStackTrace(err, arguments.callee)
  this.error(err.stack)
}

Console.prototype.assert = function(expression)
{
  if (!expression) {
    let arr = Array.prototype.slice.call(arguments, 1)
    require('assert').ok(false, format.apply(this, arr))
  }
}

module.exports = new Console(process.stdout, process.stderr)
module.exports.Console = Console

