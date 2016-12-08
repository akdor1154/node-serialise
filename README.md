# Serialise

Convert objects and class instances to/from JSON.stringify-able object literals.

In modern Javascript and Typescript, we normally follow the pattern of having data on instances, and methods on the prototype/class:

```js

class MyObject {
	constructor() {
		this.a = 42;
	}

	method() {
		return this.a + this.a;
	}
};

const myInstance = new MyObject();
```

`serialise` can be used to serialise such objects to a format with only primitives, so you can pass them to JSON.stringify happily.

```js

const S = require('serialise');

console.log(JSON.stringify(myInstance)); // Error

console.log(JSON.stringify( S.serialise(myInstance) )); // OK

```

Serialised objects can be deserialised and will have their original prototypes and properties restored for you. The restored object will be identical to the original. You must register any constructors you use before deserialisation.

```js

S.serialisable(MyObject);

const deserialised = S.deserialise(
						JSON.parse(
							JSON.stringify(
								S.serialise(myInstance) )));

assert.deepStrictEqual(deserialised, myInstance); // OK

assert.strictEqual(deserialised.method(), 84); // OK

```

This works by only storing direct properties of the serialised object (in the example, `myInstance.a`), and restoring the prototype onto the deserialised object. Prototype restoration is done without mutation, so performance of deserialised objects should be identical to that with the original objects.

We store full property information (`writable`, `enumerable`, etc), so your pathological classes should truly be identical after deserialisation.

We also do a fair bit of magic to ensure that classes that extend from builtins are also serialisable:

```js

class MyStupidString extends String {
	constructor(s) {
		super(`wrapped s`);

		Object.defineProperty(this, 'wtf', {
			value: 'why would you do this?',
			enumerable: false,
			writable: false,
			configurable: false
		});
	}

	method() { return this.split('').join('-') }
}

const myString = new MyStupidString('hello');
const deserialised = S.deserialise(S.serialise(myInstance));

assert.deepStrictEqual(deserialised, myString); // OK

assert.strictEqual(deserialised.method(), 'w-r-a-p-p-e-d- -h-e-l-l-o'); // OK

assert.strictEqual(deserialised.toString(), 'wrapped hello'); // OK

```

Other serialisation libraries (e.g. the otherwise excellent `serialijse`) fail miserably on the above two intricacies, which is what lead me to write this.

If you are not using classes, classical prototype equivalents also work, as long as you are suitably anal about setting a constructor:

```js
function MyObject() {
	this.a = 42;
}
MyObject.prototype = Object.create(Object.prototype);
MyObject.prototype.constructor = MyObject;
MyObject.prototype.method = function() {
	return this.a + this.a;
}

S.serialisable(MyObject);

const deserialised = S.deserialise(S.serialise(myInstance) )));

assert.deepStrictEqual(deserialised, myInstance); // OK

assert.strictEqual(deserialised.method(), 84); // OK
```

Typescript is also supported (indeed, this module is written in Typescript):

```ts

@S.serialisable
class MyObject {
	a: number;
	constructor() {
		this.a = 42;
	}

	method() {
		return this.a + this.a;
	}
};

const deserialised = S.deserialise<MyObject>(S.serialise(myInstance) )));

assert.deepStrictEqual(deserialised, myInstance); // OK

assert.strictEqual(deserialised.method(), 84); // OK

```

## Caveats

- Functions are not serialised themselves, you should define them on prototypes instead of literals. Even theoretically, is only partially possible to serialise functions, as their code is accessible but not their closure context. So, for example, given the following code,

```js
function buildDoubler(x) {
	return function() {
		return x * 2;
	}
}

const myDoubler = buildDoubler(5);
```

as far as I am aware it is impossible (assuming I'm not about to write a C++ Node hack) for me to properly serialise the function `myDoubler`.

- Serialisation of types inheriting native types (`class SuperString extends String {}`) only works on ES6 implementations, sorry.

## API

### serialise(object)

```ts
serialise(object: any): any
```

Serialises an object. You can pass the result of this to JSON.stringify safely.

### deserialise(serialised)

```ts
deserialise(serialised: any): any
deserialise<T>(serialised: any): T
```

Deserialises a previously serialised object. You must register any constructors your object or its properties are built with before you call this (assuming you have used them; you can [de]serialise literals and primitives without hassle).

### serialisable(Constructor)

```ts
serialisable(MyObject: Function): void
```

```ts
@serialisable
class MyObject { ... }
```

Marks a constructor so that `deserialise` knows where to look to find prototypes etc.

