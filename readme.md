# @phoebecodes/framebuffer

A library for consuming length-prefixed frames.

## Usage

```javascript
import { FrameBuffer, FrameBufferTransform } from "@phoebecodes/framebuffer";

/**
 * Build a frame buffer with a callback for when a frame is received, the
 * number of bytes for the length prefix (between 1 and 6, default is 4),
 * and a function for reading the length prefix (default is
 * Buffer.prototype.readUIntBE, but can be Buffer.prototype.readUIntLE,
 * Buffer.prototype.readIntBE, or Buffer.prototype.readIntLE).
 *
 * FrameBuffer returns a function that you call prividing the length-prefixed
 * data as an argument. The data given to this function should be a buffer and
 * can be a partial frame, a single frame, or many frames. FrameBuffer does the
 * buffering for you, so just send it all your data and it will call the
 * provided callback with a frame's data when it receives a full frame.
 */
const frameBuffer = FrameBuffer(
	/**
	 * Frame callback. Will be called when a frame is received with the frame's
	 * data without the length prefix.
	 */
	onFrame,

	/**
	 * Number of bytes in length-prefix (optional, defaults to 4).
	 */
	4,

	/**
	 * Read function (optional, defaults to Buffer.prototype.readUIntBE).
	 */
	Buffer.prototype.readUIntBE,
);

/**
 * This is our callback that will be called when frameBuffer receives a full
 * frame. It's argument is the frame's data as a buffer without the
 * length prefix.
 */
function onFrame(frameData) {
	// Do something with frameData.
}

/**
 * Just call the returned frameBuffer when you receive data. Can be passed a
 * full frame, partial frame, or multiple frames.
 */
frameBuffer(receivedData);

/**
 * FrameBufferTransform can be used to buffer data coming in from a stream. Its
 * arguments are similar to FrameBuffer's, however it does not take a callback.
 */
const frameBufferTransform = FrameBufferTransform(
	/**
	 * Number of bytes in length-prefix (optional, defaults to 4).
	 */
	4,

	/**
	 * Read function (optional, defaults to Buffer.prototype.readUIntBE).
	 */
	Buffer.prototype.readUIntBE,
);

/**
 * someReadableStream can push full frames, partial frames, or multiple
 * frames in one push. frameBufferTransform pushes the data of the full
 * frames it receives without the length prefix.
 */
someReadableStream.pipe(frameBufferTransform).pipe(someWritableStream);
```
