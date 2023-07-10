import { Transform } from "stream";
import { makeError } from "./easy-errors.js";

export const InvalidEncodingError = makeError(
	"InvalidEncodingError",
	(encoding, ...expected) => `Invalid encoding. Received: ${encoding}, expected: ${expected.join(", ")}.`,
);

export function FrameBuffer(onFrame, numLength = 4, read = Buffer.prototype.readUIntBE) {
	let buffer = null;
	let frameLength = null;

	return (data) => {
		if (!buffer) {
			buffer = data;
		} else {
			buffer = Buffer.concat([buffer, data]);
		}

		if (frameLength === null && buffer.length >= numLength) {
			frameLength = read.call(buffer, 0, numLength);
			buffer = buffer.slice(numLength);
		}

		while (frameLength !== null && buffer.length >= frameLength) {
			const payload = buffer.slice(0, frameLength);
			buffer = buffer.slice(frameLength);

			process.nextTick(onFrame, payload);

			if (buffer.length >= numLength) {
				frameLength = read.call(buffer, 0, numLength);
				buffer = buffer.slice(numLength);
			} else {
				frameLength = null;
			}
		}
	};
}

export function FrameBufferTransform(numLength = 4, read = Buffer.prototype.readUIntBE) {
	/**
	 * Cyclical dependency here. frameBuffer must be declared before the
	 * Transform stream's transform function implementation, however
	 * we need to assign frameBuffer the result of calling FrameBuffer
	 * with transform's push function as an argument. We get around this
	 * by declaring frameBuffer before transform and assigning frameBuffer
	 * after transform is declared since transform's transform function
	 * will not be called before frameBuffer is assigned.
	 */
	let frameBuffer = null;

	const transform = new Transform({
		transform(chunk, encoding, callback) {
			if (encoding !== "buffer") {
				throw InvalidEncodingError(encoding, "buffer");
			}

			frameBuffer(chunk);
			process.nextTick(callback, null);
		},
	});

	frameBuffer = FrameBuffer(
		(buf) => {
			/**
			 * Don't push empty buffers.
			 * https://nodejs.org/api/stream.html#stream_readable_push
			 */
			if (buf.length) {
				transform.push(buf);
			}
		},
		numLength,
		read,
	);

	return transform;
}
