/*
 * Node.js assert.
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

let util = require('util'),
    inherits = util.inherits,
    is_undefined = util.is_undefined,
    is_number = util.is_number,
    is_string = util.is_string,
    is_reg_exp = util.is_reg_exp,
    is_null_or_undefined = util.is_null_or_undefined,
    is_date = util.is_date,
    is_object = util.is_object,
    is_buffer = util.is_buffer,
    slice = Array.prototype.slice

/* Forward decls. */
let assert, get_message, fail, deep_equal
assert = exports = function(value, message)
{
  if (!value) fail(value, true, message, '==', assert.ok)
}
assert.ok = assert

assert.AssertionError = function AssertionError(options)
{
  this.name = 'AssertionError'
  this.actual = options.actual
  this.expected = options.expected
  this.operator = options.operator
  if (options.message) {
    this.message = options.message
    this.generatedMessage = false
  } else {
    this.message = get_message(this)
    this.generatedMessage = true
  }
  let ssf = options.stackStartFunction || fail
  Error.captureStackTrace(this, ssf)
}

inherits(assert.AssertionError, Error)

let replacer = function(key, value)
{
  if (is_undefined(value))
    return '' + value
  if (is_number(value) && (isNaN(value) || !isFinite(value)))
    return value.toString()
  if (is_function(value) || is_reg_exp(value))
    return value.toString()
  return value
}

let truncate = function(s, n)
{
  if (is_string(s))
    return s.length < n ? s : s.slice(0, n)
  return s
}

get_message = function(self)
{
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128)
}

assert.fail = fail = function(actual, expected, message, operator, ssf)
{
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: ssf 
  })
}

assert.equal = function(actual, expected, message)
{
  if (actual != expected)
    fail(actual, expected, message, '==', assert.equal)
}

assert.notEqual = function(actual, expected, message)
{
  if (actual == expected)
    fail(actual, expected, message, '!=', assert.notEqual)
}

let is_arguments = function(object)
{
  return Object.prototype.toString.call(object) == '[object Arguments]'
}

let obj_equiv = function(a, b)
{
  if (is_null_or_undefined(a) || is_null_or_undefined(b))
    return false

  if (a.prototype !== b.prototype)
    return false

  let a_isargs = isArguments(a),
      b_isargs = isArguments(b)

  if ((a_isargs  && !b_isargs) || (!a_isargs && b_isargs))
    return false

  if (a_isargs) {
    a = slice.call(a)
    b = slice.call(b)
    return deep_equal(a, b)
  }

  let ka, kb

  try {
    ka = Object.keys(a)
    kb = Object.keys(b)
  } catch (e) { // Happens when one is a string literal and the other isn't.
    return false
  }
  if (ka.length != kb.length)
    return false

  ka.sort()
  kb.sort()

  for (let i = ka.length - 1; i >= 0; i--)
    if (ka[i] != kb[i])
      return false

  for (let i = ka.length - 1; i >= 0; i--) {
    let key = ka[i]
    if (!deep_equal(a[key], b[key]))
      return false
  }
  return true
}


deep_equal = function(actual, expected)
{
  if (actual === expected) { // All identical.
    return true
  } else if (is_buffer(actual) && is_buffer(expected)) {
    if (actual.length != expected.length)
      return false
    for (let i = 0; i < actual.length; i++)
      if (actual[i] !== expected[i])
        return false
    return true
  } else if (is_date(actual) && is_date(expected)) {
    return actual.getTime() === expected.getTime()
  } else if (is_reg_exp(actual) && is_reg_exp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase
  } else if (!is_object(actual) && !is_object(expected)) {
    return actual == expected
  } else {
    return obj_equiv(actual, expected)
  }
}

assert.present = function(v, name)
{
  if (is_null_or_undefined(v))
    fail(v, "!is_null_or_undefined", name + " must not be null or undefined"
        , "!is_null_or_undefined", assert.present)
  return v
}

assert.deepEqual = function(actual, expected, message)
{
  if (!deep_equal(actual, expected))
    fail(actual, expected, message, 'deepEqual', assert.deepEqual)
}

assert.notDeepEqual = function(actual, expected, message)
{
  if (deep_equal(actual, expected))
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual)
}

assert.strictEqual = function(actual, expected, message)
{
  if (actual !== expected)
    fail(actual, expected, message, '===', assert.strictEqual)
}

assert.notStrictEqual = function(actual, expected, message)
{
  if (actual === expected)
    fail(actual, expected, message, '!==', assert.notStrictEqual)
}

let expected_exception = function(actual, expected)
{
  if (!actual || !expected)
    return false

  if (Object.prototype.toString.call(expected) == '[object RegExp]')
    return expected.test(actual)
  else if (actual instanceof expected)
    return true
  else if (expected.call({}, actual) === true)
    return true

  return false
}

let throws = function(should_throw, block, expected, message)
{
  let actual

  if (is_string(expected)) {
    message = expected
    expected = null
  }

  try {
    block()
  } catch (e) {
    actual = e
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.')

  if (should_throw && !actual)
    fail(actual, expected, 'Missing expected exception' + message)

  if (!should_throw && expected_exception(actual, expected))
    fail(actual, expected, 'Got unwanted exception' + message)

  if ((should_throw && actual && expected &&
      !expected_exception(actual, expected)) || (!should_throw && actual))
    throw actual
}

assert.throws = function(block, /*optional*/error, /*optional*/message)
{
  throws.apply(this, [true].concat(slice.call(arguments)))
}

assert.doesNotThrow = function(block, /*optional*/message)
{
  throws.apply(this, [false].concat(slice.call(arguments)))
}

assert.ifError = function(err)
{
  if (err)
    throw err
}

