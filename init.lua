--[===========================================================================[
  Nodemu, Node.js emulated in Lua.
  (C) Copyright 2014, Karel Tuma <kat@lua.cz>, All rights reserved.

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
--]===========================================================================]
local js = require('lv8'):flags('--harmony')
local lua = {
  js = js,
  require = require,
  io = io,
  print = print,
  tostring = tostring,
  os = os,
  loadstring = loadstring,
}
local mod = {}
local ctx = lua.js { lua = lua, module = mod }

-- Bootstrap.
local basepath = debug.getinfo(1).short_src:match("^(.*)/")
ctx:eval(assert(io.open(basepath..'/require.js','r')):read('*a'))

-- Also add bootstrap path at end of base paths
mod.exports.path:push(basepath)

-- Return node-like require()
return setmetatable({
  Module = mod.exports,
  js = ctx
}, {__call = function(node, m)
  return node.Module.prototype:require(m)
end})

