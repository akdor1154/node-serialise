import {serialisable, deserialise, serialise} from './serialise';


@serialisable
class SS extends String {
	p: number;
	constructor(s: string) {
		super('hello wrapped' + s);
		this.p = 42;
	}
	method() {
		return 42;
	}
}

@serialisable
class SSS extends SS {
	[k: string]: any
	constructor(s: string) {
		super(s);
		for (let j of 'abcdefghijklmnopqrstuvwxyz'.split(''))
			this[j] = 34;
	}
	method2() {
		return 2*this.method();
	}
}


const num = 10000
{
	const sss = new SS('goodbye');
	const sssArray = new Array(num);
	const timeStart = Date.now();
	for (var i = 0; i < num; i++) {
		sssArray[i] = deserialise(serialise(sss));
		sssArray[i].q = i;
	}
	const timeEnd = Date.now();
	const time = timeEnd - timeStart;
	console.log(`ser/deser instance with one property: time total: ${time}ms. time each (avg): ${time/num}ms. ops/sec = ${1000 / (time / num)}`)
}

{
	const sssArray = new Array(num);
	const timeStart = Date.now();
	for (var i = 0; i < num; i++) {
		sssArray[i] = new SSS('goodbye');
		sssArray[i]['i'] = i;
	}
	const timeEnd = Date.now();
	const time = timeEnd - timeStart;
	console.log(`create instances directly: time total: ${time}ms. time each (avg): ${time/num}ms. ops/sec = ${1000 / (time / num)}`)
}

{
	const sss = new SSS('goodbye');
	const sssArray = new Array(num);
	const timeStart = Date.now();
	for (var i = 0; i < num; i++) {
		sssArray[i] = deserialise(serialise(sss));
		sssArray[i].q = i;
	}
	const timeEnd = Date.now();
	const time = timeEnd - timeStart;
	console.log(`ser/deser instance with heaps of properties: time total: ${time}ms. time each (avg): ${time/num}ms. ops/sec = ${1000 / (time / num)}`)
}