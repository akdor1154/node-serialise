import * as S from './serialise';
import assert = require('assert');
import util = require('util');

describe('serialisation', () => {
	it('should serialise an object literal', () => {

		const test = {
			a: 'thing',
			b: 'anotherThing',
			c: 4
		};

		const serialised = S.serialise(test);

		const deserialised = S.deserialise(serialised)

		assert.deepStrictEqual(deserialised, test);
		
	});

	it('should serialise nested object literals', () => {

		const test = {
			a: 'thing',
			b: 'another thing',
			c: 4,
			d: {
				aa: 'doop',
				bb: 'waz'
			}
		};

		const serialised = S.serialise(test);

		const deserialised = S.deserialise(serialised);

		assert.deepStrictEqual(deserialised, test);

	});



	describe('class serialisation', () => {
		class Test {
			a: number;
			b: string;
			c: {
				aa: boolean,
				bb: number
			}

			constructor(a: number, b: string, aa: boolean, bb: number) {
				this.a = a;
				this.b = b;
				this.c = {aa, bb};
			}
		}
		S.serialisable(Test);

		//default propety descriptor
		const dp = function(v: any) { return {v: v, w: true, c: true, e: true}};

		it('should serialise correctly', () => {
			const t = new Test(1, 'one', true, 4);
			const serialised = S.serialise(t);
			const desired = {
				cName: 'Test',
				data: {
					a: dp(1),
					b: dp('one'),
					c: dp({
						cName: 'Object',
						data: {
							aa: dp(true),
							bb: dp(4)
						}
					})
				}
			}
			assert.deepStrictEqual(serialised, desired);
		});

		class Parent {
			t: Test;
			constructor(a: number, b: string, aa: boolean, bb: number) {
				this.t = new Test(a,b,aa,bb);
			}
		}
		S.serialisable(Parent);

		it('should serialise nested classes directly', () => {
			const p = new Parent(1, 'one', true, 4);
			const serialised = S.serialise(p);
			const desired = {
				cName: 'Parent',
				data: {
					t: dp({
						cName: 'Test',
						data: {
							a: dp(1),
							b: dp('one'),
							c: dp({
								cName: 'Object',
								data: {
									aa: dp(true),
									bb: dp(4)
								}
							})
						}
					})
				}
			};
			assert.deepStrictEqual(serialised, desired);
		});

		class SuperString extends String {
			p: boolean;
			constructor(s: string) {
				super(`wrapped ${s}`);
				this.p = true;
			}
		}
		S.serialisable(SuperString);

		it('should serialise classes extending from builtins correctly', () => {

			const ss = new SuperString('hello');

			const serialised = S.serialise(ss);

			const deserialised = S.deserialise(serialised);

			assert.deepStrictEqual(deserialised, ss);
		});

		it('should serialise classes extending from builtins and allow their methods to be called', () => {
			const ss = new SuperString('hello');

			assert.equal(ss.valueOf(), 'wrapped hello');

			const deserialised = S.deserialise(S.serialise(ss));

			assert.equal(deserialised.valueOf(), 'wrapped hello');
		})

	});

	describe('prototype serialisation', () => {
		it('should serialise classic prototype based objects:', () => {
			function MyObject(a: number, b: number) {
				this.a = a;
				this.b = b;
			}
			MyObject.prototype = {
				sum: function() { return this.a + this.b },
				constructor: MyObject
			};
			interface MyObject {
				a: number,
				b: number,
				sum: () => number
			}

			function MySpecialObject(a: number, b: number) {
				MyObject.call(this, a, b);
			}
			MySpecialObject.prototype = Object.create(MyObject.prototype);
			MySpecialObject.prototype.sumsq = function() { return this.sum()**2; }
			MySpecialObject.prototype.constructor = MySpecialObject
			interface MySpecialObject extends MyObject {
				sumsq: () => number;
			}

			const t = new MySpecialObject(10, 5);

			S.serialisable(MySpecialObject);

			const deserialized = S.deserialise(S.serialise(t));

			assert.deepStrictEqual(deserialized, t);
			assert.strictEqual(deserialized.sumsq(), (10+5)**2);

		})
	});

	describe('property serialization', () => {
		function MyPathologicalObject() {
			this.a = 5;
			Object.defineProperties(this, {
				f: { value: 1000,   writable: true,  enumerable: false, configurable: true },
				g: { value: 10000,  writable: false, enumerable: false, configurable: true },
				h: { value: 100000, writable: true,  enumerable: true,  configurable: false },
			});
		}
		MyPathologicalObject.prototype = Object.create(Object.prototype, {
			a: { value: 1,   writable: true,  enumerable: false, configurable: true },
			b: { value: 10,  writable: false, enumerable: false, configurable: true },
			c: { value: 100, writable: true,  enumerable: true,  configurable: false },
			d: { value: null },
			e: { value: 5 },
			constructor: { value: MyPathologicalObject }
		});
		type nn = number | null
		interface MyPathologicalObject { a: nn, b: nn, c: nn, d: nn, e: nn }
		S.serialisable(MyPathologicalObject);

		const o = new MyPathologicalObject();
		const deserialised = S.deserialise(S.serialise(o))
		assert.deepStrictEqual(o, deserialised);

		const oProps = Object.getOwnPropertyNames(o).map(Object.getOwnPropertyDescriptor.bind(null, o));
		const dProps = Object.getOwnPropertyNames(deserialised).map(Object.getOwnPropertyDescriptor.bind(null, deserialised));

		assert.deepStrictEqual(oProps, dProps);

	})
});

