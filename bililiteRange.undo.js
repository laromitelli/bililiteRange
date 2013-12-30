// implements a simple undo stack for bililiteRange

// version 1.1
// Documentation pending

// depends on bililiteRange.js

// Copyright (c) 2013 Daniel Wachsstock
// MIT license:
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:

// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

if (bililiteRange) (function(){

bililiteRange.fn.undo = function(n){
	if (arguments.length == 0) n = 1; // default
	var state = getundostate(this);
	if (n > 0)  for (var i = 0; i < n; ++i) restore (state, 'undo', this);
	else if (n < 0) for (i = 0; i > n; --i) restore (state, 'redo', this)
};

function getundostate(rng){
	// the undo stack should not contain any DOM elements so we will not create a circular reference that might create a memory leak
	// if we attach it directly to the element.
	if (rng._el.bililiteRangeUndos) return rng._el.bililiteRangeUndos;
	var state = new undostate (rng);
	setuplisteners (rng);
	return state;
}

function undostate (rng){
	// inefficiently just stores the whole text rather than trying to figure out a diff
	this.text = rng.all();
	this.bounds = rng.bounds('selection').bounds(); 
	this.undo = this; // set up a doubly linked list that never ends (so undo with only one element on the list does nothing) 
	this.redo = this;
	var laststate = rng._el.bililiteRangeUndos;
	if (laststate) {
		this.undo = laststate;
		laststate.redo = this;
	}
	rng._el.bililiteRangeUndos = this;
}

function restore (state, dir, rng){
	// dir is 'undo' or 'redo';
	rng.dispatch(dir); // signal it
	state = state[dir];
	state.lastevent = dir; // mark the undo/redo so we don't add the change in text to the undo stack
	rng._el.bililiteRangeUndos = state;
	rng.all(state.text).bounds(state.bounds).select(); // restore the old state
}

function setuplisteners (rng){
	rng.listen('input', function(){
		var state = getundostate(rng), el = rng._el, lastevent = state.lastevent;
		delete state.lastevent;
		switch (lastevent){
			//  catch input events that we should not save  (resulting from undo, redo and keypress events that are contiguous)
			case 'undo': case 'redo':
				return; // don't record the current input
			case 'keypress':
				// if the last event was also a keypress, drop that one (so we would undo back to the beginning of the typing)
				if (state.penultimateevent == 'keypress') el.bililiteRangeUndos = state.undo;
		}
		(new undostate(rng)).penultimateevent = lastevent; // record so we can check for keypress sequences
	}).listen('keypress', function(evt){
		// key presses replace each other, which means that undo will undo all of them, unless the previous event was not a keypress (meaning we are starting a
		// new series of typing) or we type a carriage return, which starts a new series of typing, or the new keypress is in a different place than the old one
		if (evt.which < 32) return; // nonprinting characters; Firefox tends to send them all. We want them all undone individually
		if (evt.altKey || evt.altGraphKey || evt.ctrlKey || evt.metaKey) return;
		var bounds = rng.bounds('selection').bounds();
		if (bounds[0] != bounds[1]) return; // about to erase a selection; start a new undo sequence
		var state = getundostate(rng);
		// only mark this if the previous event was in the same place
		if (state.bounds[0] != bounds[0]) return;
		state.lastevent = 'keypress';
	});	
}

// for use as an event handler
bililiteRange.undo = function (event){
	bililiteRange(event.target).undo();
	event.preventDefault();
}
bililiteRange.redo = function (event){
	bililiteRange(event.target).undo(-1);
	event.preventDefault();
}

// for debugging
function getstack(state, dir){
	dir = dir || 'undo';
	for (var ret = []; ret.push(state), state[dir] != state; state = state[dir]);
	return ret;
}

})();