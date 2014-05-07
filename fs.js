/*
 * Higher level FS
 *
 * Nodemu, Node.js emulated in Lua.
 * (C) Copyright 2014, Karel Tuma <kat@lua.cz>, All rights reserved.
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

let FS = { __proto__: native.fs }
let util = require('util')
let is_string = util.is_string,
    is_number = util.is_number

/* Error handling. A bit silly, but V8-friendly thus fast. */
let clear = function() {
  FS.message = FS.code = FS.syscall = ""
  FS.errno = 0
}
let errstr = function()
{
  return FS.errsym + ", " + FS.errstr
}
let errcode = function(e)
{
  e.errno = FS.errcode
  e.code = FS.errsym
  e.syscall = FS.syscall
  return e
}

/* Protect 2-arg native function. */
let protect2 = function(f) {
  return function(a,b) {
    if (f(a,b) !== 0) {
      throw errcode(new Error(errstr()))
    }
  }
}

/* Rename file. */
exports.renameSync = protect2(function(o, n) {
  return FS.rename(o, n)
})


