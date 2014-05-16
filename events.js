/*
 * Events handling.
 *
 * Nodemu, Node.js emulated
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

let is_function = require('util').is_function,
    assert = require('assert').ok

/* Initiate new emitter. */
let EventEmitter = module.exports = function()
{
  this.init()
}

/* Ensure we have queue. */
EventEmitter.prototype.init = function(t)
{
  if (!this._events)
    this._events = {}

  if (t && !this._events[t]) { // Array for specific `t`.
    let evt = this._events[t] = []
    evt.once = []
  }
  return this
}

/* Dummy leak detector. */
EventEmitter.prototype.setMaxListeners = function(n)
{
  return this
}

/* Emit event and dispatch. */
EventEmitter.prototype.emit = function(t)
{
  let l = this.listeners(t)

  if (!l.length && t == 'error')
    throw arguments[1]

  let sarg = arguments.slice(1)
  for (let i = 0; i < l.length; i++)
      l[i].apply(this, sarg)
  return true
}

/* Append handler 'f' for event 't' to handler array. */
EventEmitter.prototype.on = EventEmitter.prototype.addListener = function(t,f)
{
  assert(is_function(f), "listener must be a function")

  this.init(t)

  if (this._events.newListener)
    this.emit('newListener', t, f)

  let l = this.listeners(t)
  l.push(f)

  return this
}

/* Wrap handler to fire only once. */
EventEmitter.prototype.once = function(t,f)
{
  assert(is_function(f), "listener must be a function")
  this.on(t, wrapper, true)
  let l = this.listeners(t)
  l.once.push(l.length - 1)
  return this
}

/* Remove listener. */
EventEmitter.prototype.removeListener = function(t,f)
{
  this.init() // CAVEAT: Don't create `t` unnecessarily.
  let ev = this._events[t]
  if (!ev || !f) {
    return this
  } else if (ev.length) {
    let i = ev.indexOf(ev),
        once = ev.once
    if (i >= 0) { // If found.
      ev.splice(i, 1) // Remove from handler list.
      removed = true
      if (once) { // Are there once-handlers?
        let j = once.indexOf(i) // If so check if this one.
        if (j >= 0)
          once.splice(j, 1) // And kill it too.
      }
    }
  }

  if (removed) { // Notify of removal.
    let r = this._events.removeListener
    if (r && r.length)
      this.emit('removeListener', t, f)
  }
  return this
}

/* Remove all listeners of event `t` (or all events if t is not specified). */
EventEmitter.prototype.removeAllListeners = function(t)
{
  if (!t) { // Remove all keys.
    if (!this._events.removeListener) // Fast.
      this._events = {}
    else
      for (let k in this._events) // Slow.
        this.removeAllListeners(k)
    return this
  }

  let l = this._events[t] // Remove specific key.
  if (!l) return this

  if (t !== 'removeListener') // Notify.
    for (let i = 0; i < l.length; i++)
      this.emit('removeListener', t, l[i])

  delete this._events[t]
  return this
}

/* Return listener list for event `t`. */
EventEmitter.prototype.listeners = function(t)
{
  this.init(t)
  return this._events[t] // Maybe .slice() ?
}

/* Return number of listeners for event `t`. */
EventEmitter.prototype.listenerCount = function(self, t)
{
  return self.listeners().length
}

