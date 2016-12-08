import * as S from './serialise';
import assert = require('assert');

describe('serialization', () => {
	it('should serialize an object literal', () => {

		const test = {
			a: 'thing',
			b: 'anotherThing',
			c: 4
		};

		const serialized = S.serialize(test);

		const deserialized = S.deserialize(serialized)

		assert.deepStrictEqual(deserialized, test);
		
	});

	it('should serialize nested object literals', () => {

		const test = {
			a: 'thing',
			b: 'another thing',
			c: 4,
			d: {
				aa: 'doop',
				bb: 'waz'
			}
		};

		const serialized = S.serialize(test);

		const deserialized = S.deserialize(serialized);

		assert.deepStrictEqual(deserialized, test);

	});



	describe('class serialization', () => {
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
		S.serializable(Test);

		//default propety descriptor
		const dp = function(v: any) { return {v: v, w: true, c: true, e: true}};

		it('should serialize correctly', () => {
			const t = new Test(1, 'one', true, 4);
			const serialized = S.serialize(t);
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
			assert.deepStrictEqual(serialized, desired);
		});

		class Parent {
			t: Test;
			constructor(a: number, b: string, aa: boolean, bb: number) {
				this.t = new Test(a,b,aa,bb);
			}
		}
		S.serializable(Parent);

		it('should serialize nested classes directly', () => {
			const p = new Parent(1, 'one', true, 4);
			const serialized = S.serialize(p);
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
			assert.deepStrictEqual(serialized, desired);
		});

		it('should serialize classes extending from builtins correctly', () => {
			class SuperString extends String {
				p: boolean;
				constructor(s: string) {
					super(s);
					this.p = true;
				}
			}
			S.serializable(SuperString);

			const ss = new SuperString('hello');

			const serialized = S.serialize(ss);

			const deserialized = S.deserialize(serialized);

			assert.deepStrictEqual(deserialized, ss);
		});

	});
});

