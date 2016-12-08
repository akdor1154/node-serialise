const customConstructors: {[key: string]: Function} = {};

export function serialisable(constructor: Function) {
	if (customConstructors[constructor.name] != undefined) {
		throw new Error(`There is already a registered constructor called ${constructor.name}.`);
	}
	customConstructors[constructor.name] = constructor;
}

export function serialise(x: any) {

	const type = getType(x);
	switch (type) {
		case KnownType.object:
			return serialiseObject(x);

		case KnownType.number:
			return x;

		case KnownType.string:
			return x;

		case KnownType.function:
			throw new Error('tried to serialise a function!');

		case KnownType.array:
			return x.map(serialise);

		case KnownType.null:
			return null;

		case KnownType.undefined:
			return serialiseUndefined();

		case KnownType.boolean:
			return x;

		default:
			const xx: never = type;
	}

}

interface SerialisedObject {
	cName: string;
	data: SerialisedProperties;
}

interface SerialisedWrapper {
	cName: string;
	value?: SerialisedPrimitive
	data: SerialisedProperties
}


interface SerialisedProperty {
	v: SerialisedValue;
	w: boolean;
	e: boolean;
	c: boolean;
}

type SerialisedProperties = {[key: string]: SerialisedProperty};

type SerialisedPrimitive = string | number | boolean | null;

type SerialisedValue = SerialisedPrimitive | Array<SerialisedPrimitive> | SerialisedObject | SerialisedWrapper;


const undefinedTypeStr = '__undefined__';
function serialiseUndefined(): SerialisedObject {
	return {cName: undefinedTypeStr, data: {}};
}

function serialiseLiteral(x: any, baseConstructor?: SerialisedWithSpecialConstructor): SerialisedProperties {
	let propertyNames = Object.getOwnPropertyNames(x);
	const properties: any = {};
	const serialised: any = {}

	if (baseConstructor) {
		const deserialised = new baseConstructor.constructor(baseConstructor.serialised);
		propertyNames = propertyNames.filter( (propName) => !deserialised.hasOwnProperty(propName))
	}

	for (let propName of propertyNames) {
		const descriptor = Object.getOwnPropertyDescriptor(x, propName);
		serialised[propName] = {
			v: serialise(descriptor.value),
			w: descriptor.writable,
			e: descriptor.enumerable,
			c: descriptor.configurable
		};
	};
	return serialised;
}


interface SpecialConstructor {
	constructor: WrapperConstructor,
	serialise: (x: any) => any
};

const n: WrapperConstructor = Number;


const specialConstructors: SpecialConstructor[] = [
	{constructor: Number, serialise: (x) => x.valueOf() as number},
	{constructor: String, serialise: (x) => x.valueOf() as string},
	{constructor: Date, serialise: (x) => (x as Date).getTime()},
	{constructor: Boolean, serialise: (x) => x.valueOf() as boolean}
];

interface SerialisedWithSpecialConstructor {
	constructor: WrapperConstructor,
	serialised: SerialisedPrimitive
}

function getWrappedPrimitive(constructor: Function, x: any): SerialisedWithSpecialConstructor | undefined {

	const parentConstructor = specialConstructors
		.find( (sc) => sc.constructor.isPrototypeOf(constructor));

	if (parentConstructor) {
		return {constructor: parentConstructor.constructor, serialised: parentConstructor.serialise(x)};
	}

	return undefined;
}

function serialiseObject(x: Object): SerialisedObject | SerialisedWrapper {
	if (x.constructor === Object) {
		return {
			cName: 'Object',
			data: serialiseLiteral(x)
		}
	} else {

		if (!x.constructor.name) {
			throw new Error('missing constructor name!');
		}
		const constructor = x.constructor;
		const primitiveValue = getWrappedPrimitive(constructor, x);

		const returnValue: SerialisedWrapper = {
			cName: constructor.name,
			data: serialiseLiteral(x, primitiveValue)
		}

		if (primitiveValue) { returnValue.value = primitiveValue.serialised }
		return returnValue;

	}
}


enum KnownType {
	object,
	number,
	string,
	function,
	array,
	boolean,
	null,
	undefined
}

function getType(t: any): KnownType {
	const type = typeof t;
	switch ( type ) {
		case 'object':
			if (t == null) {
				return KnownType.null;
			}
			if (Array.isArray(t)) {
				return KnownType.array;
			}
			return KnownType.object;
		case 'number':
			return KnownType.number;
		case 'string':
			return KnownType.string;
		case 'function':
			return KnownType.function;
		case 'undefined':
			return KnownType.undefined;
		case 'boolean':
			return KnownType.boolean;
		default:
			throw new Error('unknown type: '+type);
	}
}

function getTypeOfSerialised(t: any): KnownType {
	const rawType = getType(t);
	if (rawType == KnownType.object) {
		if (! t.cName ) {
			console.error(t);
			throw new Error('got a raw object (missing cName). We can only deserialise our own object format');
		}
		if (t.cName == undefinedTypeStr) {
			return KnownType.undefined;
		}
	}
	return rawType;
}

export function deserialise<T>(x: any): T;
export function deserialise(x: any): any {
	const type = getTypeOfSerialised(x);
	switch (type) {
		case KnownType.object:
			return deserialiseObject(x);
		case KnownType.number:
			return x;
		case KnownType.string:
			return x;
		case KnownType.boolean:
			return x;
		case KnownType.function:
			// I ain't even mad.
			return x;
		case KnownType.undefined:
			return undefined;
		case KnownType.null:
			return null;
		case KnownType.array:
			return x.map(deserialise);
		default:
			const xx: never = type;
	}
}

function deserialiseObject(o: SerialisedObject): any {
	switch (o.cName) {
		case 'Number':
			return deserialiseObjectWithConstructor(Number, o);
		case 'String':
			return deserialiseObjectWithConstructor(String, o);
		case 'Date':
			return deserialiseObjectWithConstructor(Date, o);
		case 'Boolean':
			return deserialiseObjectWithConstructor(Boolean, o);
		case 'Object':
			return deserialiseObjectWithConstructor(Object, o);
		default:
			const constructor = customConstructors[o.cName];
			if (!constructor) {
				throw new Error('unknown constructor encountered with deserializing: '+o.cName);
			}
			return deserialiseObjectWithConstructor(constructor, o);
	}
}

interface WrapperConstructor {
	new (data?: any): Object;
}

function deserialisationConstructor(o: SerialisedWrapper, constructor: Function) {

	function newConstructor(arg?: any) {

		const propertyNames = Object.getOwnPropertyNames(o.data);
		const properties: PropertyDescriptorMap = {};

		for (let newProp of propertyNames) {
			properties[newProp] = {
				value: deserialise(o.data[newProp].v),
				enumerable: o.data[newProp].e,
				configurable: o.data[newProp].c,
				writable: o.data[newProp].w
			}
		}

		Object.defineProperties(this, properties);

	}
	newConstructor.prototype = constructor.prototype;



	return newConstructor as any as WrapperConstructor;
}

function deserialiseObjectWithConstructor(constructor: Function, o: SerialisedWrapper): Object {

	let specialConstructor: WrapperConstructor | undefined = undefined;
	if (o.value) {
		const sc = specialConstructors.find( (sc) => sc.constructor.isPrototypeOf(constructor));
		specialConstructor = (sc) ? sc.constructor : undefined;
	}

	if (specialConstructor) {
		const d = Reflect.construct(specialConstructor, [o.value], constructor);
		deserialisationConstructor(o, constructor).call(d);
		return d;
	} else {
		return new (deserialisationConstructor(o, constructor))()
	}

}