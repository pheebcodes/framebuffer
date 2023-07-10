const stream = require("stream");
const { FrameBuffer, FrameBufferTransform } = require("../");

/**
 * Any frames which cause bugs should be added here.
 */
const frames = [
	/**
	 * Normal frame.
	 */
	Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),

	/**
	 * Single byte frame.
	 */
	Buffer.from([0xab]),

	/**
	 * Empty frame. Should be at the end of this list for FrameBufferTransform's
	 * tests to work properly.
	 */
	Buffer.from([]),
];

function combineInner(lists) {
	if (lists.length === 0) {
		return { type: "LEAF", data: [] };
	}
	if (lists.length === 1) {
		return { type: "LEAF", data: lists[0] };
	}
	const ret = [];
	const [cur, ...rest] = lists;
	const lowerCombinations = combineInner(rest);
	return {
		type: "INTERMEDIATE",
		data: cur.reduce((acc, item) => {
			return [
				...acc,
				...(lowerCombinations.type === "INTERMEDIATE"
					? lowerCombinations.data.map((comb) => [item, ...comb])
					: lowerCombinations.data.map((comb) => [item, comb])),
			];
		}, []),
	};
}

function combine(...args) {
	return combineInner(...args).data;
}

function makeFrames(numLength = 4, f = Buffer.prototype.writeUIntBE) {
	return Buffer.concat(
		frames.map((frame) => {
			const size = Buffer.allocUnsafe(numLength);
			f.call(size, frame.length, 0, numLength);
			return Buffer.concat([size, frame]);
		}),
	);
}

function message(bytes, numLength, [read]) {
	return `should accept: ${bytes < Infinity ? "partial frames" : "multiple frames"} with ${numLength * 8}-bit ${
		read === Buffer.prototype.readUIntBE || read === Buffer.prototype.readUIntLE ? "unsigned" : "signed"
	} ${read === Buffer.prototype.readUIntBE || read === Buffer.prototype.readIntBE ? "big-endian" : "little-endian"}`;
}

const combinations = combine([
	[3, Infinity],
	[1, 2, 4],
	[
		[Buffer.prototype.readUIntBE, Buffer.prototype.writeUIntBE],
		[Buffer.prototype.readUIntLE, Buffer.prototype.writeUIntLE],
		[Buffer.prototype.readIntBE, Buffer.prototype.writeIntBE],
		[Buffer.prototype.readIntLE, Buffer.prototype.writeIntLE],
	],
]);

describe("FrameBuffer", () => {
	function frameBufferTest(bytesToPush, numLength, [read, write]) {
		let frameData = makeFrames(numLength, write);

		return () => {
			const receivedData = [];

			const frameBuffer = FrameBuffer(
				(frame) => {
					receivedData.push(frame);
				},
				numLength,
				read,
			);

			while (frameData.length > 0) {
				const size = Math.min(frameData.length, bytesToPush);
				frameBuffer(frameData.slice(0, size));
				frameData = frameData.slice(size);
			}

			return new Promise((resolve, reject) => {
				process.nextTick(() => {
					expect(receivedData.length).toBe(frames.length);

					receivedData.forEach((frame, i) => {
						expect(frame).toEqual(frames[i]);
					});

					resolve();
				});
			});
		};
	}

	combinations.forEach((comb) => {
		test(message(...comb), frameBufferTest(...comb));
	});
});

describe("FrameBufferTransform", () => {
	function frameBufferTransformTest(bytesToPush, numLength, [read, write]) {
		let frameData = makeFrames(numLength, write);

		if (bytesToPush === Infinity) {
			bytesToPush = frameData.length;
		}

		return () => {
			const readStream = new stream.Readable({
				read(readSize) {
					const size = Math.min(frameData.length, readSize);
					this.push(frameData.slice(0, size));
					frameData = frameData.slice(size);

					if (frameData.length === 0) {
						this.push(null);
					}
				},
				highWaterMark: bytesToPush,
			});

			const frameBufferTransform = FrameBufferTransform(numLength, read);

			const receivedData = [];

			const writeStream = new stream.Writable({
				write(chunk, encoding, callback) {
					receivedData.push(chunk);
					callback(null);
				},
				highWaterMark: bytesToPush,
			});

			return new Promise((resolve, reject) => {
				writeStream.on("error", reject);

				writeStream.on("finish", () => {
					/**
					 * Should be frames.length - 1 because FrameBufferTransform does not push
					 * empty buffers.
					 */
					expect(receivedData.length).toBe(frames.length - 1);

					receivedData.forEach((frame, i) => {
						expect(frame).toEqual(frames[i]);
					});

					resolve();
				});

				readStream.pipe(frameBufferTransform).pipe(writeStream);
			});
		};
	}

	combinations.forEach((comb) => {
		test(message(...comb), frameBufferTransformTest(...comb));
	});
});
