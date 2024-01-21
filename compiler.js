
// Because it IS better !
'use strict';


// Hexadecimal digits.
var hexits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
// Converts hex (a hex number as a string) into its decimal counterpart.
// hex's letters must be caps. (use String.toUpperCase())
function hexToDec(hex) {
	var dec = 0;
	// Avoid recalculating hex.length...
	var n = hex.length;
	
	for(var i = 0; i < n; i++) {
		var hexitDec = hexits.indexOf(hex[i].toLowerCase());
		// Check if it's a valid hex during translation
		if(hexitDec == -1) {
			throw new AsmError('Invalid hexadecimal ' + hex);
		}
		
		dec = dec * 16 + hexitDec;
	}
	
	return dec;
}

// Performs the opposite as hexToDec.
function decToHex(dec) {
	var hex = '';
	
	while(dec || hex.length < 2) {
		hex = hexits[dec % 16] + hex;
		dec = Math.floor(dec / 16);
	}
	
	return hex;
}

// Needs no explanation.
function binToDec(bin) {
	var dec = 0;
	var n = bin.length;
	
	for(var i = 0; i < n; i++) {
		dec *= 2;
		
		if(bin[i] == '1') {
			dec++;
		} else if(bin[i] != '0') {
			throw new AsmError('Invalid binary ' + bin);
		}
	}
	
	return dec;
}

// Give a hex number in the usual format, attempt to extract the hex part.
// If success return the decimal, otherwise return NaN.
var regHex = /^(\$|hex::?|0x)?([0-9A-Fa-f]+)(h|H)?$/;
function parseHex(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regHex) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return hexToDec(RegExp.$2);
	} else {
		throw new AsmError(str + ' is badly formatted hexadecimal !');
	}
}

// Same.
var regBin = /^(%|bin::?|0b)?([01]+)(b|B)?$/;
function parseBin(str) {
	if(typeof str != 'string') {
		throw new TypeError('Expected a string !');
	}
	
	// We need either a prefix or a suffix, but not both.
	if(str.match(regBin) && (RegExp.$1 != '') != (RegExp.$3 != '')) {
		return binToDec(RegExp.$2);
	} else {
		throw new AsmError(str + ' is badly formatted binary !');
	}
}



// Custom error type. HEEEELL YEAAAA.
function AsmError(message) {
	this.message = message || '';
	
	// Remove the call to this constructor from the stack.
	var stack = (new Error()).stack.split('\n');
	this.stack = this.stack || stack.slice(1).join('\n');
	
	// Add info on the caller - this is where the exception is being thrown, after all.
	var callerInfo = stack[1].slice(stack[1].indexOf('@') + 1).split(':');
	this.fileName = this.fileName || callerInfo.slice(0, -2).join(':');
	this.lineNumber = this.lineNumber || parseInt(callerInfo.slice(-2, -1)) || '';
	this.columnNumber = this.columnNumber || parseInt(callerInfo.slice(-1)) || '';
	
	console.error(message);
}
AsmError.prototype = Object.create(Error.prototype);
AsmError.prototype.constructor = AsmError;
AsmError.prototype.name = 'AsmError';



// Global vars. Flushed before use anyways.
var byteStream = [], currentGlobalLabel = '', labels = [];
// Used for syntax checking.
var reg8  = ['b', 'c', 'd', 'e', 'h', 'l', '(hl)', 'a'],
	reg16 = ['bc', 'de', 'hl', 'af'],
	conds = ['nz', 'z', 'nc', 'c'];

function readByte(operand) {
	if(operand.length != 1) {
		throw new AsmError('Only one operand expected to readByte !');
	} else if(operand[0] == '') {
		throw new AsmError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hex
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Bin
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 1, name: operand, isLabel: false});
		return 1;
	} else {
		throw new AsmError('Invalid operand passed to readByte !');
	}
	
	if(number < 0 || number > 256) {
		throw new AsmError(operand + ' is not a 8-bit number !');
	} else {
		byteStream.push(number);
	}
	
	return 1;
}

function readWord(operand) {
	if(operand.length != 1) {
		throw new AsmError('Only one operand expected to readWord !');
	} else if(operand[0] == '') {
		throw new AsmError('Empty operand given !');
	}
	
	operand = operand[0];
	var number = operand;
	if(operand.match(/^\d+$/)) {
		// Decimal
		number = parseInt(operand);
	} else if(operand.match(regHex)) {
		// Hexadecimal
		number = parseHex(operand);
	} else if(operand.match(regBin)) {
		// Binary
		number = parseBin(operand);
	} else if(typeof operand == 'string') {
		// Label
		byteStream.push({size: 2, name: operand, isLabel: false});
		byteStream.push(0);
		return 2;
	} else {
		throw new AsmError('Invalid operand passed to readWord !');
	}
	
	if(number < 0 || number > 65535) {
		throw new AsmError(operand + ' is not a 16-bit number !');
	} else {
		byteStream.push(number % 256);
		byteStream.push(Math.floor(number / 256));
	}
	
	return 2;
}

function determineLdType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ld needs two operands !');
	}
	
	var target = reg8.indexOf(operand[0]);
	var dest;
	if(target != -1) {
		// Check for a reg8 target.
		dest = reg8.indexOf(operand[1]);
		if(dest != -1) {
			// That's reg8 to reg8. The easy one.
			
			byteStream.push(64 + target * 8 + dest);
			return 1;
		} else if(target == 7 && operand[1][0] == '(' && operand[1][operand[1].length - 1] == ')') {
			// A memory load to a.
			if(operand[1] == '(bc)') {
				// ld a, (bc)
				
				byteStream.push(10);
				return 1;
			} else if(operand[1] == '(de)') {
				// ld a, (de)
				
				byteStream.push(26);
				return 1;
			} else if(operand[1] == '(hli)') {
				
				byteStream.push(42);
				return 1;
			} else if(operand[1] == '(hld)') {
				
				byteStream.push(58);
				return 1;
			} else if(operand[1] == '(c)' || /\(\$?ff00\+c\)/.test(operand[1])) {
				
				byteStream.push(242);
				return 1;
			} else {
				// ld a, (mem16)
				
				byteStream.push(250);
				readWord([operand[1].slice(1, -1).trim()]);
				return 3;
			}
			
		} else {
			// Assume an immediate load.
			byteStream.push(6 + target * 8);
			readByte([operand[1]]);
			
			return 2;
		}
		
	} else if(operand[1] == 'a') {
		// Memory load from a
		if(operand[0] == '(bc)') {
			
			byteStream.push(2);
			return 1;
		} else if(operand[0] == '(de)') {
			
			byteStream.push(18);
			return 1;
		} else if(operand[0] == '(hli)') {
			
			byteStream.push(34);
			return 1;
		} else if(operand[0] == '(hld)') {
			
			byteStream.push(50);
			return 1;
		} else if(operand[0] == '(c)' || /\(\$?ff00\+c\)/.test(operand[0])) {
			
			byteStream.push(226);
			return 1;
		} else {
			// ld (mem16), a
			
			byteStream.push(234);
			readWord([operand[0].slice(1, -1).trim()]);
			return 3;
		}
	} else if(operand[0] == 'bc') {
		// ld bc, imm16
		
		byteStream.push(1);
		readWord([operand[1]]);
		return 3;
	} else if(operand[0] == 'de') {
		// ld de, imm16
		
		byteStream.push(17);
		readWord([operand[1]]);
		return 3;
	} else if(operand[0] == 'hl') {
		if(operand[1].match(/^\(\s*sp\s*\+(-?\s*(?:\d+)|((?:\$|hex::?|0x)?(?:[0-9A-Fa-f]+)(?:h|H)?)|((?:%|bin::?|0b)?(?:[01]+)(?:b|B)?))\s*\)$/)) {
			// ld hl, [sp+imm8]
			
			byteStream.push(248);
			readByte([RegExp.$1]);
			return 2;
		} else {
			// ld hl, imm16
			byteStream.push(33);
			readWord([operand[1]]);
			return 3;
		}
	} else if(operand[0] == 'sp') {
		if(operand[1] == 'hl') {
			byteStream.push(249);
			return 1;
		} else {
			byteStream.push(49);
			readWord([operand[1]]);
			return 3;
		}
	} else {
		throw new AsmError('Unknown operands to ld !');
	}
}

function determineLdiType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldi takes exactly two arguments !');
	}
	
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(42);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(34);
	} else {
		throw new AsmError('Invalid use of ldi ! Either "ldi (hl), a" or "ldi a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLddType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldd takes exactly two arguments !');
	}
	
	if(operand[0] == 'a' && operand[1] == '(hl)') {
		byteStream.push(58);
	} else if(operand[0] == '(hl)' && operand[1] == 'a') {
		byteStream.push(50);
	} else {
		throw new AsmError('Invalid use of ldd ! Either "ldd (hl), a" or "ldd a, (hl)" are valid.');
	}
	
	return 1;
}

function determineLdhType(operand) {
	if(operand.length != 2) {
		throw new AsmError('ldh takes exactly two arguments !');
	}
	
	if(operand[0] != 'a' && operand[1] != 'a') {
		throw new AsmError('ldh requires a as one of its operands !');
	}
	
	var isLoadFromMem = operand[0] == 'a';
	var memAccess = operand[0 + isLoadFromMem].trim();
	if(memAccess.match(/^\(((\$|hex::?|0x)?[fF]{2}00(h|H)?\s+\+\s+)?c\)$/) || memAccess == '(c)') {
		if(isLoadFromMem) {
			throw new AsmError('Invalid operand to ldh !');
		}
		
		// ldh ($FF00 + c), a
		byteStream.push(226);
		return 1;
	} else if(memAccess.match(/^\((?:\$|hex::?|0x)(?:[fF]{2}(?:00\s+\+\s+(?:\$|hex::?|0x)?)?)?([0-9A-Fa-f]{2})\)$/)) {
		byteStream.push(224 + isLoadFromMem * 16);
		readByte(['$' + RegExp.$1]);
		return 2;
	} else {
		throw new AsmError('Invalid operand to ldh : ' + memAccess);
	}
}

function determineAddType(operand) {
	if(operand.length != 2) {
		try {
			// Try to read a "add imm8", and but throw an operand error if it fails
			if(operand.length != 1) {
				// Error message doesn't matter : it will be caught.
				throw new AsmError('Welp, at least I tried being lenient.');
			}
			
			byteStream.push(198);
			readByte(operand);
			return 2;
			
		} catch(err) {
			throw new AsmError('add takes exactly 2 operands !');
		}
	}
	
	var reg2;
	if(operand[0] == 'hl') {
		reg2 = reg16.indexOf(operand[1]);
		if(reg2 == -1) {
			throw new AsmError('add hl, reg16 expects a 16-bit register as second argument, but ' + operand[1] + ' obtained.');
		}
		
		byteStream.push(reg2 * 16 + 9);
		return 1;
		
	} else if(operand[0] == 'a') {
		reg2 = reg8.indexOf(operand[1]);
		if(reg2 == -1) {
			// Immediate add
			byteStream.push(198);
			readByte(operand.slice(1));
			return 2;
		}
		
		byteStream.push(128 + reg2);
		return 1;
	} else {
		throw new AsmError('add can only have a or hl as target !');
	}
}

function determineAdcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('adc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for adc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(136 + sourceID);
		return 1;
	} else {
		byteStream.push(206);
		readByte([source]);
		return 2;
	}
}

function determineSubType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('sub takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for sub is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(144 + sourceID);
		return 1;
	} else {
		byteStream.push(214);
		readByte([source]);
		return 2;
	}
}

function determineSbcType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('sbc takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for sbc is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(152 + sourceID);
		return 1;
	} else {
		byteStream.push(222);
		readByte([operand[1]]);
		return 2;
	}
}

function determineIncType(operand) {
	if(operand.length != 1) {
		throw new AsmError('inc takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(4 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(3 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(51);
		return 1;
	} else {
		throw new AsmError('Expected a reg8, reg16 or sp as operand for inc, but got \'' + operand + '\'')
	}
}

function determineDecType(operand) {
	if(operand.length != 1) {
		throw new AsmError('dec takes exactly one argument !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(5 + reg * 8);
		return 1;
	}
	
	reg = reg16.indexOf(operand[0]);
	if(reg != -1) {
		byteStream.push(11 + reg * 16);
		return 1;
	}
	
	if(operand[0] == 'sp') {
		byteStream.push(59);
		return 1;
	} else {
		throw new AsmError('Expected a reg8, reg16 or sp as operand for dec, but got \'' + operand + '\'')
	}
}

function determineAndType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('and takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for and is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(160 + sourceID);
		return 1;
	} else {
		byteStream.push(230);
		readByte([source]);
		return 2;
	}
}

function determineOrType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('or takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for or is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(176 + sourceID);
		return 1;
	} else {
		byteStream.push(246);
		readByte([source]);
		return 2;
	}
}

function determineXorType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('xor takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for xor is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(168 + sourceID);
		return 1;
	} else {
		byteStream.push(238);
		readByte([source]);
		return 2;
	}
}

function determineCpType(operand) {
	var source;
	
	if(operand.length != 1) {
		if(operand.length != 2) {
			throw new AsmError('cp takes exactly 2 operands !');
		} else if(operand[0] != 'a') {
			throw new AsmError('Only possible target for cp is a !');
		}
		source = operand[1];
	} else {
		source = operand[0];
	}
	
	var sourceID = reg8.indexOf(source);
	if(sourceID != -1) {
		byteStream.push(184 + sourceID);
		return 1;
	} else {
		byteStream.push(254);
		readByte([source]);
		return 2;
	}
}

function determineJrTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(24);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for jr !');
		}
		
		byteStream.push(32 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to jr ! ');
	}
	
	readWord([operand[1]]);
	var high = byteStream.pop(), low = byteStream.pop();
	if(typeof low == 'object') {
		low.size = 1;
		low.isLabel = true;
		byteStream.push(low);
	} else {
		
		var addr = high * 256 + low;
		var i = 0, uniqueName = 'jr:0';
		while(labels.indexOf(uniqueName) != -1) {
			i++;
			uniqueName = 'jr:' + i;
		}
		labels.push({name: uniqueName, offset: addr});
		byteStream.push({size: 1, name: uniqueName, isLabel: true});
	}

	return 2;
}

function determineJpTypeAndDest(operand) {
	if(operand.length == 1) {
		if(operand[0] == 'hl' || operand[0] == '(hl)') {
			// jp (hl)
			byteStream.push(233);
			return 1;
		}
		
		operand.push(operand[0]);
		byteStream.push(195);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for jp !');
		}
		
		byteStream.push(194 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to jp ! ');
	}
	
	readWord([operand[1]]);
	if(typeof byteStream[byteStream.length - 2] == 'object') {
		byteStream[byteStream.length - 2].isLabel = true;
	}
	return 3;
}

function determineCallTypeAndDest(operand) {
	if(operand.length == 1) {
		operand.push(operand[0]);
		byteStream.push(205);
	} else if(operand.length == 2) {
		var cond = conds.indexOf(operand[0]);
		if(cond == -1) {
			throw new AsmError('Invalid condition for call !');
		}
		
		byteStream.push(196 + cond * 8);
	} else {
		throw new AsmError('Invalid operands to call ! ');
	}
	
	readWord([operand[1]]);
	if(typeof byteStream[byteStream.length - 2] == 'object') {
		byteStream[byteStream.length - 2].isLabel = true;
	}
	return 3;
}

function determineRetType(operand) {
	if(operand.length != 1) {
		throw new AsmError('ret takes only one operand !');
	}
	
	if(operand[0] == '') {
		byteStream.push(201);
	} else {
		var condOfs = conds.indexOf(operand[0]);
		if(condOfs == -1) {
			throw new AsmError('ret takes one of the following conditionals : nz, z, nc, or c');
		}
		
		byteStream.push(192 + condOfs * 8);
	}
	return 1;
}

function determineRstDestination(operand) {
	if(operand.length != 1) {
		throw new AsmError('rst takes exactly one operand !');
	} else if(!operand[0].match(/^[0-3][08]h$/)) {
		throw new AsmError('rst vector must be of 00h, 08h, 10h, 18h, 20h, 28h, 30h, or 38h !');
	}
	
	byteStream.push(199 + parseHex(operand[0]));
	return 1;
}

function determinePushType(operand) {
	if(operand.length != 1) {
		throw new AsmError('push takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('push : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(197 + reg * 16);
	return 1;
}

function determinePopType(operand) {
	if(operand.length != 1) {
		throw new AsmError('pop takes exactly one operand !');
	}
	
	var reg = reg16.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('pop : unknown operand ' + operand[0] + ' (expected bc, de, hl or af)');
	}
	
	byteStream.push(193 + reg * 16);
	return 1;
}

function placeNop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(0);
	return 1;
}

function placeScf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('scf takes no operands !');
	}
	
	byteStream.push(55);
	return 1;
}

function placeCcf(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('ccf takes no operands !');
	}
	
	byteStream.push(63);
	return 1;
}

function placeCpl(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('cpl takes no operands !');
	}
	
	byteStream.push(47);
	return 1;
}

function placeDaa(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('daa takes no operands !');
	}
	
	byteStream.push(39);
	return 1;
}

function placeRla(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rla takes no operands !');
	}
	
	byteStream.push(23);
	return 1;
}

function placeRra(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rra takes no operands !');
	}
	
	byteStream.push(31);
	return 1;
}

function placeRlca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rlca takes no operands !');
	}
	
	byteStream.push(7);
	return 1;
}

function placeRrca(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('rrca takes no operands !');
	}
	
	byteStream.push(15);
	return 1;
}

function determineRlcType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rlc takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rlc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(reg);
	return 2;
}

function determineRrcType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rrc takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rrc\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(8 + reg);
	return 2;
}

function determineRlType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rl takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(16 + reg);
	return 2;
}

function determineRrType(operand) {
	if(operand.length != 1) {
		throw new AsmError('rr takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('rr\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(24 + reg);
	return 2;
}

function determineSlaType(operand) {
	if(operand.length != 1) {
		throw new AsmError('sla takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('sla\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(32 + reg);
	return 2;
}

function determineSraType(operand) {
	if(operand.length != 1) {
		throw new AsmError('sra takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('sra\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(40 + reg);
	return 2;
}

function determineSwapType(operand) {
	if(operand.length != 1) {
		throw new AsmError('swap takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('swap\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(48 + reg);
	return 2;
}

function determineSrlType(operand) {
	if(operand.length != 1) {
		throw new AsmError('srl takes only one operand !');
	}
	
	var reg = reg8.indexOf(operand[0]);
	if(reg == -1) {
		throw new AsmError('srl\'s operand mus be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(56 + reg);
	return 2;
}

function determineBitType(operand) {
	if(operand.length != 2) {
		throw new AsmError('bit takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('bit\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('bit\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(64 + bit * 8 + reg);
	return 2;
}

function determineResType(operand) {
	if(operand.length != 2) {
		throw new AsmError('res takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('res\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('res\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(128 + bit * 8 + reg);
	return 2;
}

function determineSetType(operand) {
	if(operand.length != 2) {
		throw new AsmError('set takes exactly two operands !');
	}
	
	var bit = parseInt(operand[0]);
	if(isNaN(bit) || bit < 0 || bit > 7) {
		throw new AsmError('set\'s first operand must be a number in range 0 - 7 (inclusive) !');
	}
	
	var reg = reg8.indexOf(operand[1]);
	if(reg == -1) {
		throw new AsmError('set\'s second operand must be a reg8 !');
	}
	
	byteStream.push(203);
	byteStream.push(192 + bit * 8 + reg);
	return 2;
}

function placeHalt(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(118);
	return 1;
}

function placeStop(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(16);
	byteStream.push(0);
	return 2;
}

function placeEi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(251);
	return 1;
}

function placeDi(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(243);
	return 1;
}

function placeReti(operand) {
	if(operand.length != 1 || operand[0] != '') {
		throw new AsmError('nop takes no operands !');
	}
	
	byteStream.push(217);
	return 1;
}

var instructions = [{name: 'db', func: readByte}, {name: 'dw', func: readWord},
					{name: 'ld', func: determineLdType}, {name: 'ldi', func: determineLdiType}, {name: 'ldd', func: determineLddType}, {name: 'ldh', func: determineLdhType},
					{name: 'add', func: determineAddType}, {name: 'adc', func: determineAdcType}, {name: 'sub', func: determineSubType}, {name: 'sbc', func: determineSbcType},
					{name: 'inc', func: determineIncType}, {name: 'dec', func: determineDecType},
					{name: 'and', func: determineAndType}, {name: 'or', func: determineOrType}, {name: 'xor', func: determineXorType}, {name: 'cp', func: determineCpType},
					{name: 'jr', func: determineJrTypeAndDest}, {name: 'jp', func: determineJpTypeAndDest},
					{name: 'call', func: determineCallTypeAndDest}, {name: 'ret', func: determineRetType}, {name: 'rst', func: determineRstDestination},
					{name: 'push', func: determinePushType}, {name: 'pop', func: determinePopType},
					{name: 'nop', func: placeNop},
					{name: 'scf', func: placeScf}, {name: 'ccf', func: placeCcf}, {name: 'cpl', func: placeCpl}, {name: 'daa', func: placeDaa},
					{name: 'rla', func: placeRla}, {name: 'rra', func: placeRra}, {name: 'rlca', func: placeRlca}, {name: 'rrca', func: placeRrca},
					{name: 'rlc', func: determineRlcType}, {name: 'rrc', func: determineRrcType}, {name: 'rl', func: determineRlType}, {name: 'rr', func: determineRrType},
						{name: 'swap', func: determineSwapType}, {name: 'srl', func: determineSrlType}, {name: 'sla', func: determineSlaType}, {name: 'sra', func: determineSraType},
					{name: 'bit', func: determineBitType}, {name: 'res', func: determineResType}, {name: 'set', func: determineSetType},
					{name: 'halt', func: placeHalt}, {name: 'stop', func: placeStop},
					{name: 'ei', func: placeEi}, {name: 'di', func: placeDi},
					{name: 'reti', func: placeReti}];

var items = [
		"#j.",
		"Master Ball",
		"Ultra Ball",
		"Great Ball",
		"Pok&eacute; Ball",
		"Town Map",
		"Bicycle",
		"????? (\"Surfboard\")",
		"Safari Ball",
		"Pok&eacute;dex",
		"Moon Stone",
		"Antidote",
		"Burn Heal",
		"Ice Heal",
		"Awakening",
		"Parlyz Heal",
		"Full Restore",
		"Max Potion",
		"Hyper Potion",
		"Super Potion",
		"Potion",
		"Boulder Badge",
		"Cascade Badge",
		"Thunder Badge",
		"Rainbow Badge",
		"Soul Badge",
		"Marsh Badge",
		"Volcano Badge",
		"Earth Badge",
		"Escape Rope",
		"Repel",
		"Old Amber",
		"Fire Stone",
		"Thunderstone",
		"Water Stone",
		"HP Up",
		"Protein",
		"Iron",
		"Carbos",
		"Calcium",
		"Rare Candy",
		"Dome Fossil",
		"Helix Fossil",
		"Secret Key",
		"????? (Unusable)",
		"Bike Voucher",
		"X Accuracy",
		"Leaf Stone",
		"Card Key",
		"Nugget",
		"PP Up (useless)",
		"Pok&eacute; Doll",
		"Full Heal",
		"Revive",
		"Max Revive",
		"Guard Spec.",
		"Super Repel",
		"Max Repel",
		"Dire Hit",
		"Coin",
		"Fresh Water",
		"Soda Pop",
		"Lemonade",
		"S.S. Ticket",
		"Gold Teeth",
		"X Attack",
		"X Defense",
		"X Speed",
		"X Special",
		"Coin Case",
		"Oak's Parcel",
		"Item Finder",
		"Silph Scope",
		"Poke Flute",
		"Lift Key",
		"Exp. All",
		"Old Rod",
		"Good Rod",
		"Super Rod",
		"PP Up",
		"Ether",
		"Max Ether",
		"Elixer",
		"Max Elixer",
		"B2F",
		"B1F",
		"1F",
		"2F",
		"3F",
		"4F",
		"5F",
		"6F",
		"7F",
		"8F",
		"9F",
		"10F",
		"11F",
		"B4F",
		"w #m#",
		"ws# #m#",
		"v# #t#m#",
		"#'#d#m#",
		"#m#",
		"w 'l#m#",
		"#f#m#",
		"#m#",
		"#-g##m#",
		"#",
		"&eacute;",
		"#il#",
		"Lg#-",
		"#-g#",
		"#QGnS#I",
		"Gn#SI",
		"#Q;MP-",
		"MP-",
		"T4 89 ゥ N",
		"ぅ",
		"####",
		"4",
		"",
		"$ ぅ",
		"4 “",
		"ぉ8#",
		"8# 8",
		"# $ $ぅ#######",
		"## ## ## A# ?##",
		"#(player) #7#####6####7#### ",
		"#PC#",
		"4# #4# y PC……4# ぅ4# H# ",
		"4# #",
		":### ##pゥ# #(rival)#E ## ",
		"Trade completed!",
		"Too bad! The trade w",
		"#",
		"####PkMnぉゥ# #ゥ #ゥC ## ",
		"#▶D#",
		"##E#",
		"## O #B## ##p’t’u’v",
		"TRADE CENTER",
		" 	p’é## #### ### Enemy #SROCKE",
		"#a #### #### #######",
		"8##",
		"BATTLE ANIMATION",
		"BATTLE STYLE",
		"CANCEL",
		"#WA4# #z####3#",
		"#—##2pゥ",
		"# E###tE#",
		"##F#",
		"##F#",
		"#XF#",
		"#CC###’### ####♀ POKéi6",
		"POKéTRAINER#: ###",
		"#ァ pゥ #ゥ# WF # 't",
		"###v ##",
		"#ゥ p#ゥ ##ゥL ぅH #4ゥ",
		"#Q r# 4ァ h ェエ##",
		"4# 8# 4# 8# #H#####",
		"ABCDEFGHIJKLMNOPQRST",
		"ェエ#ゥァ # ##########",
		"###2#u 4# ##Vh####V",
		"RIVAL's",
		"NAME?",
		"NICKNAME?",
		"#S#iS MS4# h###.S",
		"#♂ ## ##ぃ## eC##V",
		"#S#'tS MS4# h####L",
		"#▼ ## ## A## eC#!V",
		"#a ##— ### ## #: #",
		"NEW NAME",
		"NEW NAME",
		"##",
		"#5ぉz##—#.CL#: ##",
		"RED/BLUE",
		"ASH/GARY",
		"JACK/JOHN",
		"NEW NAME",
		"BLUE/RED",
		"GARY/ASH",
		"JOHN/JACK",
		"",
		"## #]9## O# # #b9##]",
		"##G#",
		"##G#",
		"#(rival)G#",
		"#‘G#",
		"#QG#",
		"#oG#",
		"# G#",
		"#$G#",
		"##H#",
		"##H#",
		"##4S #v é##: ## ##",
		"#",
		"H#",
		"HM01",
		"HM02",
		"HM03",
		"HM04",
		"HM05",
		"TM01",
		"TM02",
		"TM03",
		"TM04",
		"TM05",
		"TM06",
		"TM07",
		"TM08",
		"TM09",
		"TM10",
		"TM11",
		"TM12",
		"TM13",
		"TM14",
		"TM15",
		"TM16",
		"TM17",
		"TM18",
		"TM19",
		"TM20",
		"TM21",
		"TM22",
		"TM23",
		"TM24",
		"TM25",
		"TM26",
		"TM27",
		"TM28",
		"TM29",
		"TM30",
		"TM31",
		"TM32",
		"TM33",
		"TM34",
		"TM35",
		"TM36",
		"TM37",
		"TM38",
		"TM39",
		"TM40",
		"TM41",
		"TM42",
		"TM43",
		"TM44",
		"TM45",
		"TM46",
		"TM47",
		"TM48",
		"TM49",
		"TM50",
		"TM51",
		"TM52",
		"TM53",
		"TM54",
		"CANCEL"];
var attribs = [
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty:true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: false, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: false},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: true, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: true},
        {used: false, valid: false, qty: false}];
function compile(evt) {
	// Prevent submitting the form (would trigger a page reload or scroll)
	evt.preventDefault();
	
	// Removes the line labels
	$('#dismissError').trigger('click');
	
	// Get all code lines
	var codeElem = document.getElementById('code'),
		lines = codeElem.innerText.split('\n'),
		lastElem = lines.pop();
	
	// Sometimes there is a trailing <br /> that doesn't generate any newline on-screen.
	// If causes a problem with line numbering, though.
	if(lastElem != '') {
		lines.push(lastElem);
	}
	
	codeElem.innerHTML = lines.join('<br />');
	// Declare variables
	var n = lines.length, i, lineNums = [];
	
	for(i = 1; i <= n; i++) {
		lineNums.push('' + i);
	}
	$('#lineNumbers').html(lineNums.join('<br/>')).removeClass('hidden').attr('aria-hidden', 'false');
	
	labels = [];
	currentGlobalLabel = '';
	function getLabelOffset(labelName) {
		var labelOffset = -1;
		labels.forEach(function(label) {
			if(label.name == b) {
				labelOffset = label;
			}
		});
		
		if(labelOffset == -1) {
			throw new AsmError('Line ' + i + ' : Unknown label \'' + b + '\'');
		}
		return labelOffset;
	}
	
	try {
		var offset = hexToDec($('#baseOffset').val().toLowerCase());
	} catch(err) {
		throw new AsmError('Failed to parse Base offset : ' + err.message);
	}
	var baseOffset = offset;
	
	
	/** BEGIN ASSEMBLER **/
	
	// Flush the byte stream
	byteStream = [];
	
	for(i = 0; i < n; ) {
		lines[i].search(/\[(.+)\]/);
		var pieces = lines[i].toLowerCase()
							 .replace('[', '(').replace(']', ')') // Braces will be parsed the same as parentheses. Note that "ld [hl), 1" becomes valid...whatever.
							 .trim() // Trim to make sure the first character is wordy
							 .split(';')[0] // Get the part before the comment,
							 .split(/\s+/); // And split each part, allowing each to be separated by any "white" characters
		var instrName = pieces[0]; // Get the instruction name
		var operands = pieces.slice(1).join('').split(','); // Get the operand part
		
		i++;
		
		if(instrName != '') { // If the line contains nothing, don't process it
			
			if(instrName[0] == '.') {
				// Local label
				// Name will be in format "Global.Local"
				instrName = instrName.trim();
				if(instrName.slice(1) == '') {
					throw new AsmError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(currentGlobalLabel + instrName) != -1) {
					throw new AsmError('Line ' + i + ' : Duplicate label ' + currentGlobalLabel + instrName);
				}
				labels.push({name: currentGlobalLabel + instrName, offset: offset});
				
			} else if(instrName.indexOf(':') != -1) {
				// Global label
				instrName = instrName.replace(':', '').replace(':', '').trim();
				if(instrName == '') {
					throw new AsmError('Line ' + i + ' : Empty label name !');
				}
				
				if(labels.indexOf(instrName) != -1) {
					throw new AsmError('Line ' + i + ' : Duplicate label ' + instrName);
				}
				labels.push({name: instrName, offset: offset});
				currentGlobalLabel = instrName;
				
			} else {
				// Instruction
				var ranFunc = false;
				instructions.forEach(function(instruction) {
					if(instruction.name == instrName) {
						// The function return how many bytes were written.
						try {
							var len = instruction.func(operands);
							offset += len;
							
							// Add the current line number to all added objects
							for(var index = 1; index <= len; index++) {
								if(typeof byteStream[byteStream.length - index] == 'object') {
									byteStream[byteStream.length - index].line = i;
								}
							}
						} catch(err) {
							err.message = 'Line ' + i + ' : ' + err.message;
							throw err;
						}
						ranFunc = true;
					}
				});
				
				if(!ranFunc) {
					throw new AsmError('Line ' + i + ' : Unknown instruction : ' + instrName + ' (line ' + i + ')');
				}
			}
		}
		
		if(offset >= 65536) {
			throw new AsmError('Line ' + i + ' : You went beyond $FFFF in memory !');
		}
	}
	
	/** END ASSEMBLER **/
	
	/** BEGIN COMPILER **/
	
	n = byteStream.length;
	offset = baseOffset;
	var itemList = [];
	var warnings = {duplicate: false, quantity: false, invalid: false};
	
	function processByteStreamElem(i) {
		var b = byteStream[i];
		
		switch(typeof b) {
			case 'number':
				// Leave untouched.
			break;
			
			case 'object':
				// Replace the label with its data, according to the accompanying size attribute.
				var addr = -1;
				labels.forEach(function(label) {
					if(label.name == b.name) {
						addr = label.offset;
					}
				});
				if(addr == -1) {
					if(b.label) {
						console.table(labels);
						throw new AsmError('Line ' + b.line + ' : Label ' + b.name + ' is unknown !');
					} else {
						throw new AsmError('Line ' + b.line + ' : Invalid operand ' + b.name + ' !');
					}
				}
				
				// 8-bit will calculate (jr) offset, 16-bit will calculate the address.
				if(b.size == 2) {
					// 16-bit
					b = addr % 256;
					byteStream[i+1] = Math.floor(addr / 256);
				} else {
					// 8-bit
					b = addr - (offset + 2);
					if(b < -128 || b > 127) {
						throw new AsmError('Line ' + b.line + ' : jr displacement too important ! Can\'t jr from $' + offset + ' to ' + byteStream[i]);
					}
					
					// Signed to unsigned
					if(b < 0) {
						b += 256;
					}
				}
				
				byteStream[i] = b;
			break;
			
			default:
				console.table(byteStream);
				throw new AsmError('Encountered invalid byte stream value at index ' + i);
		}
	}
	
	for(i = 0; i < n; i++) {
		processByteStreamElem(i);
		var b = byteStream[i];
		
		// We now process the thing.
		if(attribs[b].used) {
			warnings.duplicate = true;
		} else {
			attribs[b].used = true;
		}
		if(!attribs[b].qty && i+1 != byteStream.length && byteStream[i+1] != 1) {
			warnings.quantity = true;
		}
		if(!attribs[b].valid) {
			warnings.invalid = true;
		}
		var line = items[b];
		if(!attribs[b].valid) {
			line += ' (hex:' + decToHex(b).toUpperCase() + ')';
		}
		
		line += '</div><div class="col-sm-5">';
		offset++;
		i++;
		
		if(i == byteStream.length) {
			line += 'x[Any qty]';
		} else {
			processByteStreamElem(i);
			line += 'x' + byteStream[i] + ' (hex:' + decToHex(byteStream[i]).toUpperCase() + ')';
		}
		
		itemList.push(line);
		
		offset++;
	}
	
	/** END COMPILER **/
	
	var output = itemList.join('</div><div class="col-sm-7">');
	$('#output').html('<div class="col-sm-7">' + (output == '' ? 'Please type in something on the left.' : output) + '</div>');
}


// Is ran once the DOM has loaded
$(function() {
	// Set the code area to be editable
	$('#code').attr('contentEditable', 'true'); // .html('&nbsp;');
	
	$('#dismissError').click(function() {
		$('#errorPanel, #lineNumbers').addClass('hidden').attr('aria-hidden', 'true');
	});
	
	$('#code').focus(function() {
		$('#lineNumbers').addClass('hidden').attr('aria-hidden', 'true');
	});
	
	$('.form-inline').on('submit', function(evt) {
		$('#app').attr('aria-busy', 'true');
		
		try {
			compile(evt);
		} catch(err) {
			if(err.name == 'AsmError') { // Compilation error, nothing too bad
				$('#errorTitle').html('Error !');
				$('#errorText').html(err.message);
			} else { // Bad internal error
				$('#errorTitle').html('Internal ' + err.name + ' !');
				$('#errorText').html(err.message + ' (line ' + err.lineNumber + ')'
										+ '<br />Stack trace :<br/>' + err.stack.split('\n').join('<br />')
										+ '<br /><br />Please copy this plus the code you\'re trying to compile and report to the developer. Thanksies !');
			}
			$('#errorPanel').removeClass('hidden').attr('aria-hidden', 'false');
			throw err;
		} finally {
			$('#app').attr('aria-busy', 'false');
		}
	});
	
	// Otherwise the <p> is a bit small and tedious to get focus on.
	$('.panel-body').click(function() {
		document.getElementById('code').focus();
	});
});
