const customConstructors: {[key: string]: Function} = {};

export function serializable(constructor: Function) {
	if (customConstructors[constructor.name] != undefined) {
		throw new Error(`There is already a registered constructor called ${constructor.name}.`);
	}
	customConstructors[constructor.name] = constructor;
}

export function serialize(x: any) {

	const type = getType(x);
	switch (type) {
		case KnownType.object:
			return serializeObject(x);

		case KnownType.number:
			return x;

		case KnownType.string:
			return x;

		case KnownType.function:
			throw new Error('tried to serialize a function!');

		case KnownType.array:
			return x.map(serialize);

		case KnownType.null:
			return null;

		case KnownType.undefined:
			return serializeUndefined();

		case KnownType.boolean:
			return x;

		default:
			const xx: never = type;
	}

}

interface SerializedObject {
	cName: string;
	data: SerializedProperties;
}

interface SerializedWrapper {
	cName: string;
	value?: SerializedPrimitive
	data: SerializedProperties
}


interface SerializedProperty {
	v: SerializedValue;
	w: boolean;
	e: boolean;
	c: boolean;
}

type SerializedProperties = {[key: string]: SerializedProperty};

type SerializedPrimitive = string | number | boolean | null;

type SerializedValue = SerializedPrimitive | Array<SerializedPrimitive> | SerializedObject | SerializedWrapper;


const undefinedTypeStr = '__undefined__';
function serializeUndefined(): SerializedObject {
	return {cName: undefinedTypeStr, data: {}};
}

function serializeLiteral(x: any, baseConstructor?: SerializedWithSpecialConstructor): SerializedProperties {
	let propertyNames = Object.getOwnPropertyNames(x);
	const properties: any = {};
	const serialized: any = {}

	if (baseConstructor) {
		const deserialized = new baseConstructor.constructor(baseConstructor.serialized);
		propertyNames = propertyNames.filter( (propName) => !deserialized.hasOwnProperty(propName))
	}

	for (let propName of propertyNames) {
		const descriptor = Object.getOwnPropertyDescriptor(x, propName);
		serialized[propName] = {
			v: serialize(descriptor.value),
			w: descriptor.writable,
			e: descriptor.enumerable,
			c: descriptor.configurable
		};
	};
	return serialized;
}


interface SpecialConstructor {
	constructor: WrapperConstructor,
	serialize: (x: any) => any
};

const n: WrapperConstructor = Number;


const specialConstructors: SpecialConstructor[] = [
	{constructor: Number, serialize: (x) => x.valueOf() as number},
	{constructor: String, serialize: (x) => x.valueOf() as string},
	{constructor: Date, serialize: (x) => (x as Date).getTime()},
	{constructor: Boolean, serialize: (x) => x.valueOf() as boolean}
];

interface SerializedWithSpecialConstructor {
	constructor: WrapperConstructor,
	serialized: SerializedPrimitive
}

function getWrappedPrimitive(constructor: Function, x: any): SerializedWithSpecialConstructor | undefined {

	const parentConstructor = specialConstructors
		.find( (sc) => sc.constructor.isPrototypeOf(constructor));

	if (parentConstructor) {
		return {constructor: parentConstructor.constructor, serialized: parentConstructor.serialize(x)};
	}

	return undefined;
}

function serializeObject(x: Object): SerializedObject | SerializedWrapper {
	if (x.constructor === Object) {
		return {
			cName: 'Object',
			data: serializeLiteral(x)
		}
	} else {

		if (!x.constructor.name) {
			throw new Error('missing constructor name!');
		}
		const constructor = x.constructor;
		const primitiveValue = getWrappedPrimitive(constructor, x);

		const returnValue: SerializedWrapper = {
			cName: constructor.name,
			data: serializeLiteral(x, primitiveValue)
		}

		if (primitiveValue) { returnValue.value = primitiveValue.serialized }
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

function getTypeOfSerialized(t: any): KnownType {
	const rawType = getType(t);
	if (rawType == KnownType.object) {
		if (! t.cName ) {
			console.error(t);
			throw new Error('got a raw object (missing cName). We can only deserialize our own object format');
		}
		if (t.cName == undefinedTypeStr) {
			return KnownType.undefined;
		}
	}
	return rawType;
}

export function deserialize(x: any) {
	const type = getTypeOfSerialized(x);
	switch (type) {
		case KnownType.object:
			return deserializeObject(x);
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
			return x.map(deserialize);
		default:
			const xx: never = type;
	}
}

function deserializeObject<T>(o: SerializedObject): T;
function deserializeObject(o: SerializedObject): any {
	switch (o.cName) {
		case 'Number':
			return deserializeObjectWithConstructor(Number, o);
		case 'String':
			return deserializeObjectWithConstructor(String, o);
		case 'Date':
			return deserializeObjectWithConstructor(Date, o);
		case 'Boolean':
			return deserializeObjectWithConstructor(Boolean, o);
		case 'Object':
			return deserializeObjectWithConstructor(Object, o);
		default:
			const constructor = customConstructors[o.cName];
			if (!constructor) {
				throw new Error('unknown constructor encountered with deserializing: '+o.cName);
			}
			return deserializeObjectWithConstructor(constructor, o);
	}
}

interface WrapperConstructor {
	new (data?: any): Object;
}

function deserializationConstructor(o: SerializedWrapper, constructor: Function, realConstructor?: WrapperConstructor) {

	function newConstructor(arg?: any) {
		if (realConstructor) {
			realConstructor.call(this, arg)
		}

		const propertyNames = Object.getOwnPropertyNames(o.data);
		const properties: PropertyDescriptorMap = {};

		for (let newProp of propertyNames) {
			properties[newProp] = {
				value: deserialize(o.data[newProp].v),
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

function deserializeObjectWithConstructor(constructor: Function, o: SerializedWrapper): Object {

	let specialConstructor: WrapperConstructor | undefined = undefined;
	if (o.value) {
		const sc = specialConstructors.find( (sc) => sc.constructor.isPrototypeOf(constructor));
		specialConstructor = (sc) ? sc.constructor : undefined;
	}
	return new (deserializationConstructor(o, constructor, specialConstructor))()
	

}